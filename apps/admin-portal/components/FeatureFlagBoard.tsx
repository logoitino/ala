'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { APP_RUNTIME_FLAG_GROUPS, type AppRuntimeFlagGroup } from '@tapuai/shared-types';

import { getSupabaseBrowserClient } from '@/lib/supabase';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @purpose Overlay draft keys onto published so a Next toggle cannot wipe Look copy / catalogs.
 */
function mergeRuntimeBags(
  published: Record<string, unknown>,
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...published };
  for (const [key, value] of Object.entries(draft)) {
    const live = published[key];
    if (isPlainObject(value) && isPlainObject(live)) {
      out[key] = { ...live, ...value };
    } else {
      out[key] = value;
    }
  }
  return out;
}

function readFlag(bag: Record<string, unknown>, path: string): boolean {
  const [root, key] = path.split('.');
  if (!root || !key) return true;
  const group = bag[root];
  if (!isPlainObject(group)) return true;
  const value = group[key];
  return typeof value === 'boolean' ? value : true;
}

function setFlag(bag: Record<string, unknown>, path: string, value: boolean): Record<string, unknown> {
  const [root, key] = path.split('.');
  if (!root || !key) return bag;
  const group = {
    ...(isPlainObject(bag[root]) ? bag[root] : {}),
    [key]: value,
  };
  return { ...bag, [root]: group };
}

/**
 * @purpose Interactive Features toggles on the Next portal — same `app_runtime_config` draft Expo `/admin/features` + Look write.
 * @param groupIds Limit to Profile chrome on the Profile desk; omit for the full Features board.
 * @sideEffects `patch_app_runtime_draft`, `publish_app_runtime`.
 */
export function FeatureFlagBoard({
  initialDraft,
  initialPublished,
  dirty: initialDirty,
  groupIds,
}: {
  initialDraft: Record<string, unknown>;
  initialPublished: Record<string, unknown>;
  dirty: boolean;
  groupIds?: AppRuntimeFlagGroup['id'][];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [published, setPublished] = useState(initialPublished);
  const [dirty, setDirty] = useState(initialDirty);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const groups = useMemo(
    () =>
      APP_RUNTIME_FLAG_GROUPS.filter((group) => !groupIds || groupIds.includes(group.id)),
    [groupIds],
  );

  const persistDraft = async (nextDraft: Record<string, unknown>, ok: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFailed(true);
      setMessage('Add NEXT_PUBLIC_SUPABASE_* to apps/admin-portal/.env.local (same project as the Expo app).');
      return;
    }
    const { error } = await supabase.rpc('patch_app_runtime_draft', { next_draft: nextDraft });
    if (error) throw error;
    setDraft(nextDraft);
    setDirty(JSON.stringify(nextDraft) !== JSON.stringify(published));
    setFailed(false);
    setMessage(ok);
    router.refresh();
  };

  const toggle = async (path: string) => {
    const merged = mergeRuntimeBags(published, draft);
    const nextValue = !readFlag(merged, path);
    const nextDraft = setFlag(merged, path, nextValue);
    setBusy(path);
    setMessage(null);
    try {
      await persistDraft(nextDraft, `Draft updated · ${path} ${nextValue ? 'ON' : 'OFF'}. Publish to ship to Expo.`);
    } catch (caught) {
      setFailed(true);
      setMessage(caught instanceof Error ? caught.message : 'Could not save draft.');
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFailed(true);
      setMessage('Add NEXT_PUBLIC_SUPABASE_* to apps/admin-portal/.env.local');
      return;
    }
    setBusy('publish');
    setMessage(null);
    try {
      const merged = mergeRuntimeBags(published, draft);
      const { error: patchError } = await supabase.rpc('patch_app_runtime_draft', { next_draft: merged });
      if (patchError) throw patchError;
      const { error } = await supabase.rpc('publish_app_runtime');
      if (error) throw error;
      setDraft(merged);
      setPublished(merged);
      setDirty(false);
      setFailed(false);
      setMessage('Published to the fan app. Expo reads app_runtime_config.published over Realtime.');
      router.refresh();
    } catch (caught) {
      setFailed(true);
      setMessage(caught instanceof Error ? caught.message : 'Could not publish.');
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    setBusy('discard');
    setMessage(null);
    try {
      await persistDraft(published, 'Draft discarded — matches live chrome.');
      setDirty(false);
    } catch (caught) {
      setFailed(true);
      setMessage(caught instanceof Error ? caught.message : 'Could not discard draft.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy === 'publish' || !dirty}
          onClick={() => void publish()}
          className="rounded-full bg-[var(--jade)] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
        >
          {busy === 'publish' ? 'Publishing…' : 'Publish to app'}
        </button>
        <button
          type="button"
          disabled={busy === 'discard' || !dirty}
          onClick={() => void discard()}
          className="rounded-full border border-emerald-900/15 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-800 disabled:opacity-40"
        >
          {busy === 'discard' ? 'Reverting…' : 'Discard draft'}
        </button>
        <p className="text-sm text-slate-600">
          {dirty ? 'Draft differs from live Expo chrome.' : 'Draft matches published.'}
        </p>
      </div>
      {message ? (
        <p
          className={
            failed
              ? 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'
              : 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-[var(--jade)]'
          }
        >
          {message}
        </p>
      ) : null}
      {groups.map((group) => (
        <div key={group.id} className="space-y-3">
          <div>
            <h3 className="text-sm font-extrabold tracking-wide text-[var(--gold)] uppercase">{group.label}</h3>
            <p className="mt-1 text-sm text-slate-600">{group.hint}</p>
          </div>
          {group.flags.map((row) => {
            const merged = mergeRuntimeBags(published, draft);
            const on = readFlag(merged, row.path);
            const live = readFlag(published, row.path);
            return (
              <div
                key={row.path}
                className="flex flex-col gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-extrabold text-[var(--ink)]">{row.label}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {row.hint}
                    {on !== live
                      ? on
                        ? ' · draft ON, live OFF'
                        : ' · draft OFF, live ON'
                      : live
                        ? ' · live'
                        : ' · live off'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{row.path}</p>
                </div>
                <button
                  type="button"
                  disabled={busy === row.path}
                  onClick={() => void toggle(row.path)}
                  className={
                    on
                      ? 'rounded-full bg-[var(--jade)] px-4 py-2 text-sm font-bold text-white'
                      : 'rounded-full bg-[var(--ember)] px-4 py-2 text-sm font-bold text-white'
                  }
                >
                  {busy === row.path ? '…' : on ? 'On' : 'Off'}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
