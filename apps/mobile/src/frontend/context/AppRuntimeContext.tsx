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
  const pendingDraft = useRef<AppRuntimeConfig | null>(null);
  const draftChain = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    const next = await fetchAppRuntimeBundle();
    setBundle(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(nextRealtimeTopic('app-runtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_runtime_config' }, (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row) {
          void refresh();
          return;
        }
        setBundle({
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
  }, [refresh]);

  const saveDraft = useCallback(async (next: AppRuntimeConfig) => {
    setBundle((current) => ({ ...current, draft: next }));
    pendingDraft.current = next;
    const run = draftChain.current.then(async () => {
      while (pendingDraft.current) {
        const toSave = pendingDraft.current;
        pendingDraft.current = null;
        try {
          const saved = await saveAppRuntimeDraft(toSave);
          setBundle(saved);
          setSaveError(null);
        } catch (caught) {
          setSaveError(caught instanceof Error ? caught.message : 'Could not save Look / Features draft.');
          throw caught;
        }
      }
    });
    draftChain.current = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }, []);

  const publishLive = useCallback(async () => {
    try {
      const saved = await publishAppRuntime();
      setBundle(saved);
      setSaveError(null);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not publish to the fan app.');
      throw caught;
    }
  }, []);

  const discardDraft = useCallback(async () => {
    try {
      const saved = await saveAppRuntimeDraft(bundle.published);
      setBundle(saved);
      setSaveError(null);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not discard the draft.');
      throw caught;
    }
  }, [bundle.published]);

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
