/** Vault lock changes only succeed after storage confirms them; actor-bound fallbacks never borrow a new session. */
import { assertCurrent, createOfflineActorClient, type OfflineActor } from '@/lib/offlineActor';
import { isMissingFunction } from '@/lib/dbErrors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * @purpose Persist the athlete’s master Vault lock (`players.vault_locked`).
 * @param playerId Target `players.id`.
 * @param locked `true` = fans must subscribe; `false` = Vault is open.
 * @returns The stored lock flag.
 * @sideEffects `set_player_vault_locked` RPC; `players` UPDATE fallback when the RPC is missing.
 */
export async function setPlayerVaultLocked(playerId: string, locked: boolean, actor?: OfflineActor): Promise<boolean> {
  if (!isSupabaseConfigured || playerId.startsWith('demo-') || playerId.startsWith('dev-')) {
    return locked;
  }

  const client = actor ? await createOfflineActorClient(actor) : supabase;
  if (actor) assertCurrent(actor);
  const { data, error } = await client.rpc('set_player_vault_locked', {
    target_player_id: playerId,
    is_locked: locked,
  });

  if (actor) assertCurrent(actor);
  if (!error && typeof data === 'boolean') return data;

  if (!isMissingFunction(error)) throw new Error(error?.message || 'Vault lock was not confirmed.');
  const { data: updated, error: updateError } = await client.from('players').update({ vault_locked: locked }).eq('id', playerId).select('id,vault_locked').single();
  if (actor) assertCurrent(actor);
  if (updateError) throw new Error(updateError.message);
  if (!updated || updated.id !== playerId || typeof updated.vault_locked !== 'boolean') throw new Error('Vault lock was not confirmed.');
  return updated.vault_locked;
}

/**
 * @purpose Vault clips require a subscription unless the athlete has opened the Vault.
 * @param vaultLocked `players.vault_locked`. Missing/undefined defaults to locked.
 */
export function isVaultSealed(vaultLocked: boolean | null | undefined): boolean {
  return vaultLocked !== false;
}
