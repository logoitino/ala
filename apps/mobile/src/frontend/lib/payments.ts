/**
 * Small donation helpers: re-exports `createPaymentIntent` and bumps an athlete's `backer_count`.
 * `incrementBackerCount` prefers the `increment_backer_count` RPC and falls back to a plain update when the RPC
 * is not deployed. Checkout itself lives in `hooks/useTipCheckout` and `lib/stripeIntent.ts`.
 */

import { supabase } from '@/lib/supabase';
import type { Player } from '@/types/database';

export { createPaymentIntent } from '@/lib/stripe';

export async function incrementBackerCount(player: Player): Promise<number> {
  const { data, error } = await supabase.rpc('increment_backer_count', {
    target_player_id: player.id,
  });

  if (!error && typeof data === 'number') {
    return data;
  }

  const nextCount = (player.backer_count ?? 0) + 1;
  const { error: updateError } = await supabase
    .from('players')
    .update({ backer_count: nextCount })
    .eq('id', player.id);

  if (updateError) {
    throw updateError;
  }

  return nextCount;
}
