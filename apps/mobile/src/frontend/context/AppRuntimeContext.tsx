import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  cloneAppRuntime,
  countRuntimeChanges,
  DEFAULT_APP_RUNTIME,
  fetchAppRuntimeBundle,
  parseAppRuntimeConfig,
  publishAppRuntime,
  runtimeConfigsEqual,
  saveAppRuntimeDraft,
  type AppRuntimeBundle,
  type AppRuntimeConfig,
} from '@/lib/runtime';
import { assertCurrent, createOfflineActorClient, OfflineActorChangedError, type OfflineActor } from '@/lib/offlineActor';
import { offlineQueue } from '@/services/OfflineQueue';
import { isSupabaseConfigured, nextRealtimeTopic, supabase } from '@/lib/supabase';

type AppRuntimeContextValue = {
  live: AppRuntimeConfig;
  draft: AppRuntimeConfig;
  published: AppRuntimeConfig;
  publishedAt: string | null;
  dirty: boolean;
  pendingCount: number;
  loading: boolean;
  saveError: string | null;
  saveDraft: (next: AppRuntimeConfig) => Promise<void>;
  publishLive: () => Promise<void>;
  discardDraft: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AppRuntimeContext = createContext<AppRuntimeContextValue | null>(null);

/**
 * @purpose Fan chrome reads `live` (published). Admin Features / Look writes `draft` until Publish to app.
 * @sideEffects `app_runtime_config` SELECT + Realtime UPDATE; serializes draft writes so Look copy typing cannot race.
 */
export function AppRuntimeProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<AppRuntimeBundle>({
    draft: cloneAppRuntime(DEFAULT_APP_RUNTIME),
    published: cloneAppRuntime(DEFAULT_APP_RUNTIME),
    publishedAt: null,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latestBundle = useRef(bundle);
  const localDraft = useRef<{ config: AppRuntimeConfig; revision: number; actor: OfflineActor | null } | null>(null);
  const draftRevision = useRef(0);
  const failedDraft = useRef<{ revision: number; error: unknown; actor: OfflineActor | null } | null>(null);
  type DraftBatch = { next: { config: AppRuntimeConfig; revision: number; actor: OfflineActor | null } | null; actor: OfflineActor | null; promise: Promise<void> };
  const pendingDraft = useRef<DraftBatch | null>(null);
  const operationChain = useRef(Promise.resolve());

  // Every write and explicit read shares one order. Recovering the tail does not turn a failed save into a publish.
  const enqueue = useCallback((work: () => Promise<void>) => {
    const run = operationChain.current.then(work);
    operationChain.current = run.catch(() => undefined);
    return run;
  }, []);
  const adopt = useCallback((next: AppRuntimeBundle) => {
    if (localDraft.current?.actor && !localDraft.current.actor.isCurrent()) localDraft.current = null;
    const merged = { ...next, draft: localDraft.current?.config ?? next.draft };
    latestBundle.current = merged;
    setBundle(merged);
  }, []);

  const capture = () => isSupabaseConfigured ? offlineQueue.captureActor() : null;
  const check = (actor: OfflineActor | null) => { if (actor) assertCurrent(actor); };
  const boundClient = async (actor: OfflineActor | null) => {
    check(actor);
    return actor ? createOfflineActorClient(actor) : undefined;
  };

  const refresh = useCallback(() => enqueue(async () => {
    try { adopt(await fetchAppRuntimeBundle()); }
    finally { setLoading(false); }
  }), [adopt, enqueue]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(nextRealtimeTopic('app-runtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_runtime_config' }, (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row) {
          void refresh().catch(() => undefined);
          return;
        }
        adopt({
          draft: parseAppRuntimeConfig(row.draft),
          published: parseAppRuntimeConfig(row.published),
          publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
          updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
        });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [adopt, refresh]);

  const saveDraft = useCallback((next: AppRuntimeConfig) => {
    const actor = capture();
    if (isSupabaseConfigured && !actor) return Promise.reject(new OfflineActorChangedError());
    const entry = { config: cloneAppRuntime(next), revision: ++draftRevision.current, actor };
    localDraft.current = entry;
    adopt({ ...latestBundle.current, draft: entry.config });
    // Coalesce typing only within this segment. Publish/discard seal it before queuing their barrier.
    if (pendingDraft.current && (!pendingDraft.current.actor || pendingDraft.current.actor.isCurrent())) {
      pendingDraft.current.next = entry;
      return pendingDraft.current.promise;
    }
    const batch: DraftBatch = { next: entry, actor, promise: Promise.resolve() };
    pendingDraft.current = batch;
    batch.promise = enqueue(async () => {
      try {
        while (batch.next) {
          const write = batch.next;
          batch.next = null;
          try {
            const client = await boundClient(write.actor);
            const saved = await saveAppRuntimeDraft(write.config, client);
            check(write.actor);
            if (localDraft.current?.revision === write.revision) localDraft.current = null;
            failedDraft.current = null;
            adopt(saved);
            setSaveError(null);
          } catch (error) {
            if (!write.actor || write.actor.isCurrent()) {
              failedDraft.current = { revision: write.revision, error, actor: write.actor };
              setSaveError(error instanceof Error ? error.message : 'Could not save Look / Features draft.');
            } else if (localDraft.current === write) adopt(latestBundle.current);
            throw error;
          }
        }
      } finally {
        if (pendingDraft.current === batch) pendingDraft.current = null;
      }
    });
    return batch.promise;
  }, [adopt, enqueue]);

  const publishLive = useCallback(() => {
    const actor = capture();
    if (isSupabaseConfigured && !actor) return Promise.reject(new OfflineActorChangedError());
    pendingDraft.current = null;
    const requestedRevision = draftRevision.current;
    return enqueue(async () => {
      try {
        const client = await boundClient(actor);
        if (failedDraft.current && (!failedDraft.current.actor || failedDraft.current.actor.isCurrent()) && failedDraft.current.revision <= requestedRevision) throw failedDraft.current.error;
        const saved = await publishAppRuntime(client);
        check(actor);
        adopt(saved);
        setSaveError(null);
      } catch (caught) {
        if (!actor || actor.isCurrent()) setSaveError(caught instanceof Error ? caught.message : 'Could not publish to the fan app.');
        throw caught;
      }
    });
  }, [adopt, enqueue]);

  const discardDraft = useCallback(() => {
    const actor = capture();
    if (isSupabaseConfigured && !actor) return Promise.reject(new OfflineActorChangedError());
    pendingDraft.current = null;
    const revision = ++draftRevision.current;
    return enqueue(async () => {
      try {
        // Read published at execution, after any earlier queued publish has completed.
        const client = await boundClient(actor);
        const saved = await saveAppRuntimeDraft(latestBundle.current.published, client);
        check(actor);
        if (localDraft.current && localDraft.current.revision <= revision) localDraft.current = null;
        failedDraft.current = null;
        adopt(saved);
        setSaveError(null);
      } catch (caught) {
        if (!actor || actor.isCurrent()) setSaveError(caught instanceof Error ? caught.message : 'Could not discard the draft.');
        throw caught;
      }
    });
  }, [adopt, enqueue]);

  const dirty = !runtimeConfigsEqual(bundle.draft, bundle.published);
  const pendingCount = countRuntimeChanges(bundle.draft, bundle.published);

  const value = useMemo<AppRuntimeContextValue>(
    () => ({
      live: bundle.published,
      draft: bundle.draft,
      published: bundle.published,
      publishedAt: bundle.publishedAt,
      dirty,
      pendingCount,
      loading,
      saveError,
      saveDraft,
      publishLive,
      discardDraft,
      refresh,
    }),
    [bundle, dirty, discardDraft, loading, pendingCount, publishLive, refresh, saveDraft, saveError],
  );

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime(): AppRuntimeContextValue {
  const context = useContext(AppRuntimeContext);
  if (!context) {
    throw new Error('useAppRuntime must be used within AppRuntimeProvider');
  }
  return context;
}
