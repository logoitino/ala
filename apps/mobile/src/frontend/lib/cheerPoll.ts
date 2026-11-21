/**
 * Cheer poll votes (`cast_cheer_vote`), shared by the live hook and the offline queue so the call and its fallback live
 * in one lib module (PORT-01: app code reaches the backend through lib/). Older databases do not take the team names, so
 * a failed call is retried without them. The poll row read and its live channel live here too.
 * @sideEffects `cast_cheer_vote` RPC; `cheer_polls` SELECT and Realtime.
 */
import { realtimeEq } from '@/lib/postgrestFilter';
import { untypedRpc } from '@/lib/rpc';
import { nextRealtimeTopic, supabase } from '@/lib/supabase';

export type CheerVote = { slug: string; side: string; previousSide: string | null; homeName?: string | null; awayName?: string | null };

/** @purpose Cast (or move) a vote; returns the database row and error as the caller expects. */
export async function castCheerVote(vote: CheerVote, client = supabase): Promise<{ data: unknown; error: { code?: string; message?: string } | null }> {
  const first = await untypedRpc('cast_cheer_vote', {
    poll_slug: vote.slug,
    side: vote.side,
    previous_side: vote.previousSide,
    home_name: vote.homeName ?? null,
    away_name: vote.awayName ?? null,
  }, client);
  if (!first.error) return first;
  return untypedRpc('cast_cheer_vote', { poll_slug: vote.slug, side: vote.side, previous_side: vote.previousSide }, client);
}

/**
 * @purpose Read one poll row by slug.
 * @param slug Unique poll key (`westlake-lone-peak` or `game-{id}`).
 * @returns The raw row, or null when it is missing or the read failed (the card keeps its seed counts).
 * @sideEffects `cheer_polls` SELECT.
 */
export async function fetchCheerPollRow(slug: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from('cheer_polls').select('*').eq('slug', slug).maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/**
 * @purpose Stream vote count changes for one poll.
 * @param slug Unique poll key.
 * @param onRow Called with each new raw row.
 * @returns Unsubscribe.
 * @sideEffects Realtime `postgres_changes` channel on `cheer_polls` filtered to `slug`.
 */
export function subscribeCheerPoll(slug: string, onRow: (row: Record<string, unknown>) => void): () => void {
  const filter = realtimeEq('slug', slug);
  if (!filter) return () => {};
  const channel = supabase
    .channel(nextRealtimeTopic(`cheer_poll_${slug}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cheer_polls', filter },
      (payload) => {
        const next = payload.new as Record<string, unknown> | null;
        if (!next) return;
        onRow(next);
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
