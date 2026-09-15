'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase';

type FlagRow = {
  path: string;
  label: string;
  hint: string;
  group: string;
};

const FLAG_ROWS: FlagRow[] = [
  { group: 'Soft-Wall related', path: 'buttons.malo', label: 'Mālo', hint: 'Soft wall when On' },
  { group: 'Soft-Wall related', path: 'buttons.crew', label: 'Join Crew', hint: 'Soft wall when On' },
  { group: 'Soft-Wall related', path: 'buttons.subscribe', label: 'Subscribe / Vault exclusive', hint: 'Exclusive Soft Wall when On' },
  { group: 'Soft-Wall related', path: 'layouts.wishlist', label: 'Locker Room Wishlist', hint: 'Chip In Soft Wall when On' },
  {
    group: 'Soft-Wall related',
    path: 'layouts.operatorConsole',
    label: 'Operator console',
    hint: 'Paused at launch — On + Publish opens /operator',
  },
  { group: 'Fan bar', path: 'tabs.home', label: 'Home', hint: 'Highlights ⚡' },
  { group: 'Fan bar', path: 'tabs.local', label: 'Local', hint: 'Scores + polls' },
  { group: 'Fan bar', path: 'tabs.spotlight', label: 'Spotlight', hint: 'Awards' },
  { group: 'Fan bar', path: 'tabs.drip', label: 'Drip', hint: 'Gear shop' },
  { group: 'Fan bar', path: 'tabs.profile', label: 'Profile', hint: 'Card + Crew' },
];

function readFlag(bag: Record<string, unknown>, path: string): boolean {
  const [root, key] = path.split('.');
  if (!root || !key) return true;
  const group = bag[root];
  if (!group || typeof group !== 'object') return true;
  const value = (group as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : true;
}

function setFlag(bag: Record<string, unknown>, path: string, value: boolean): Record<string, unknown> {
  const [root, key] = path.split('.');
  if (!root || !key) return bag;
  const group = {
    ...((bag[root] && typeof bag[root] === 'object' ? bag[root] : {}) as Record<string, unknown>),
    [key]: value,
  };
  return { ...bag, [root]: group };
}

/**
 * @purpose Interactive Soft-Wall + fan-bar Features toggles on the Next portal. Drafts via RPC; Publish ships to the fan app.
 * @sideEffects `patch_app_runtime_draft`, `publish_app_runtime`.
 */
export function FeatureFlagBoard({
  initialDraft,
  initialPublished,
  dirty: initialDirty,
}: {
  initialDraft: Record<string, unknown>;
  initialPublished: Record<string, unknown>;
  dirty: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [published] = useState(initialPublished);
  const [dirty, setDirty] = useState(initialDirty);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = async (path: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage('Add NEXT_PUBLIC_SUPABASE_* to apps/admin-portal/.env.local');
      return;
    }
    const nextValue = !readFlag(draft, path);
    const nextDraft = setFlag(draft, path, nextValue);
    setBusy(path);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('patch_app_runtime_draft', { next_draft: nextDraft });
      if (error) throw error;
      setDraft(nextDraft);
      setDirty(JSON.stringify(nextDraft) !== JSON.stringify(published));
      setMessage(`Draft updated · ${path} ${nextValue ? 'ON' : 'OFF'}. Publish to ship.`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save draft.');
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage('Add NEXT_PUBLIC_SUPABASE_* to apps/admin-portal/.env.local');
      return;
    }
    setBusy('publish');
    setMessage(null);
    try {
      const { error } = await supabase.rpc('publish_app_runtime');
      if (error) throw error;
      setDirty(false);
      setMessage('Published to the fan app.');
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not publish.');
    } finally {
      setBusy(null);
    }
  };

  const groups = Array.from(new Set(FLAG_ROWS.map((row) => row.group)));

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
        <p className="text-sm text-slate-600">
          {dirty ? 'Draft differs from live chrome.' : 'Draft matches published.'}
        </p>
      </div>
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-[var(--jade)]">
          {message}
        </p>
      ) : null}
      {groups.map((group) => (
        <div key={group} className="space-y-3">
          <h3 className="text-sm font-extrabold tracking-wide text-[var(--gold)] uppercase">{group}</h3>
          {FLAG_ROWS.filter((row) => row.group === group).map((row) => {
            const on = readFlag(draft, row.path);
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
                    {on !== live ? (on ? ' · draft ON, live OFF' : ' · draft OFF, live ON') : live ? ' · live' : ' · live off'}
                  </p>
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
