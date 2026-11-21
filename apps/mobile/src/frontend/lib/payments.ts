/**
 * Actor-bound payment followups and small donation helpers: re-exports `createPaymentIntent` and bumps an athlete's `backer_count`.
 * `incrementBackerCount` prefers the `increment_backer_count` RPC and falls back to a plain update when the RPC
 * is not deployed. Checkout itself lives in `hooks/useTipCheckout` and `lib/stripeIntent.ts`.
 */

import type { OfflineActor, OfflineActorClient } from '@/lib/offlineActor';
import { isMissingFunction } from '@/lib/dbErrors';
import { isOfflineActorChanged } from '@/lib/offlineActor';
import { supabase } from '@/lib/supabase';
import type { Player } from '@/types/database';

export { createPaymentIntent } from '@/lib/stripe';

export type PaymentActor = { actor: OfflineActor; client: OfflineActorClient };

export async function incrementBackerCount(player: Player, client = supabase): Promise<number> {
  const { data, error } = await client.rpc('increment_backer_count', {
    target_player_id: player.id,
  });

  if (!error && typeof data === 'number') {
    return data;
  }

  if (client !== supabase && isOfflineActorChanged(error)) throw error;
  if (!isMissingFunction(error)) throw new Error(error?.message || 'Supporter count was not confirmed.');
  const nextCount = (player.backer_count ?? 0) + 1;
  const { data: updated, error: updateError } = await client
    .from('players')
    .update({ backer_count: nextCount })
    .eq('id', player.id).select('id,backer_count').single();

  if (updateError) {
    throw updateError;
  }

  if (!updated || updated.id !== player.id || typeof updated.backer_count !== 'number') throw new Error('Supporter count was not confirmed.');
  return updated.backer_count;
}
