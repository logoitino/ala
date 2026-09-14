import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * @purpose Persist the athlete’s master Vault lock (`players.vault_locked`).
 * @param playerId Target `players.id`.
 * @param locked `true` = fans must subscribe; `false` = Vault is open.
 * @returns The stored lock flag.
 * @sideEffects `set_player_vault_locked` RPC; `players` UPDATE fallback when the RPC is missing.
 */
export async function setPlayerVaultLocked(playerId: string, locked: boolean): Promise<boolean> {
  if (!isSupabaseConfigured || playerId.startsWith('demo-') || playerId.startsWith('dev-')) {
    return locked;
  }

  const { data, error } = await supabase.rpc('set_player_vault_locked', {
    target_player_id: playerId,
    is_locked: locked,
  });

  if (!error && typeof data === 'boolean') return data;

  const { error: updateError } = await supabase.from('players').update({ vault_locked: locked }).eq('id', playerId);
  if (updateError) {
    console.warn('[vault] Could not save vault_locked', updateError.message);
  }
  return locked;
}

/**
 * @purpose Vault clips require a subscription unless the athlete has opened the Vault.
 * @param vaultLocked `players.vault_locked`. Missing/undefined defaults to locked.
 */
export function isVaultSealed(vaultLocked: boolean | null | undefined): boolean {
  return vaultLocked !== false;
}
