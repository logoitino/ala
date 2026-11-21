/**
 * Account-bound client for queued and optimistic fan actions (APP-REPAIR-01).
 * A delayed request must not borrow another account's token. Auth/queue owns the lifetime check;
 * this lib boundary captures its matching JWT in memory and checks again immediately before HTTP.
 * @sideEffects Session read and existing Supabase requests; no credential persistence or auth refresh.
 */
import { createClient } from '@supabase/supabase-js';
import { resolveBackendConnection } from '@tapuai/shared-types/backendConnection';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type OfflineActor = { readonly userId: string; isCurrent: () => boolean };
export type OfflineActorClient = typeof supabase;
const ACCOUNT_CHANGED = 'Offline action account changed. Reopen this action.';

/** Distinct from a network failure or terminal refusal: keep an inactive account's queued intent held. */
export class OfflineActorChangedError extends Error {
  constructor() {
    super(ACCOUNT_CHANGED);
    this.name = 'OfflineActorChangedError';
  }
}

/** @purpose Recognize account-lifetime refusals, including PostgREST's plain wrapped fetch error. */
export function isOfflineActorChanged(error: unknown): boolean {
  return error instanceof OfflineActorChangedError || Boolean(error && typeof error === 'object'
    && 'message' in error && typeof error.message === 'string' && error.message.includes(ACCOUNT_CHANGED));
}

/** @purpose Refuse stale account work before dispatch and before publishing its result. */
export function assertCurrent(actor: OfflineActor): void {
  if (!actor.userId || !actor.isCurrent()) throw new OfflineActorChangedError();
}

/**
 * @purpose Bind existing fan mutations to the actor captured before asynchronous work.
 * @param actor Origin user id and memory-only account-lifetime predicate supplied by Auth/queue.
 * @returns Ephemeral typed client using only this actor's captured token; never the mutable global token getter.
 * @sideEffects `supabase.auth.getSession()`; subsequent requests use existing public backend configuration.
 */
export async function createOfflineActorClient(actor: OfflineActor): Promise<OfflineActorClient> {
  const backend = resolveBackendConnection({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publicKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!isSupabaseConfigured || !backend.connection) throw new Error('Offline actions are not configured.');
  assertCurrent(actor);
  const { data, error } = await supabase.auth.getSession();
  assertCurrent(actor);
  const token = data.session?.access_token?.trim();
  if (error || data.session?.user.id !== actor.userId || !token) throw new OfflineActorChangedError();
  const request = globalThis.fetch.bind(globalThis);
  return createClient<Database>(backend.connection.url, backend.connection.publicKey, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (...args) => {
        // The SDK awaits its token getter. Check after that await, immediately before the underlying fetch.
        assertCurrent(actor);
        return request(...args);
      },
    },
  });
}
