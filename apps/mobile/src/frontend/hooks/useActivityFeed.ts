import { useCallback, useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useFanTipHistory } from '@/hooks/useFanTipHistory';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import { useReceivedMalo } from '@/hooks/useReceivedMalo';

export type ActivityKind = 'malo_received' | 'malo_sent' | 'tag_pending';

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  /** ISO timestamp the row is sorted by. */
  at: string;
  title: string;
  body: string;
  amountCents?: number;
  /** Highlight this row refers to, when there is one. */
  reelId?: string | null;
  /** Rows the fan is expected to act on float above the plain timeline. */
  actionable?: boolean;
};

function centsToUsd(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(Math.abs(cents) % 100 === 0 ? 0 : 2)}`;
}

/**
 * @purpose The Activity timeline — Mālo received, Mālo sent, and highlight tags waiting on a
 * decision, merged newest-first.
 * @remarks Deliberately derived from sources that already exist (`get_received_malo`,
 * `get_fan_tip_history`, pending tags) rather than a new `notifications` table, so nothing
 * has to be deployed for this to work. The consequence is that there is **no read/unread
 * state and no push** — `unseenCount` below is "things waiting on you", not "unread".
 * A real notifications table is the upgrade path when per-event read state is wanted.
 * @sideEffects Delegates to the three source hooks; each refetches on focus.
 */
export function useActivityFeed() {
  const { profile } = useAuth();
  const playerId = profile?.player_id ?? null;

  const received = useReceivedMalo(playerId);
  const sent = useFanTipHistory();
  const tags = usePendingPlayerTags();

  // `get_pending_player_tags` returns every tag the viewer may confirm — for admins that is
  // any player, for operators and guardians other athletes too. Only clips tagging this
  // account's own player are "A highlight tagged you".
  const ownTags = useMemo(
    () => (playerId ? tags.tags.filter((row) => row.player_id === playerId) : []),
    [playerId, tags.tags],
  );

  const items = useMemo<ActivityItem[]>(() => {
    const rows: ActivityItem[] = [];

    for (const row of received.rows) {
      rows.push({
        id: `malo-in:${row.id}`,
        kind: 'malo_received',
        at: row.created_at,
        title: `${row.fan_name || 'A fan'} sent you Mālo`,
        body: row.source_label?.trim() || 'Thanks for the play.',
        amountCents: row.amount_cents,
        reelId: row.reel_id,
      });
    }

    for (const row of sent.receipts) {
      rows.push({
        id: `malo-out:${row.id}`,
        kind: 'malo_sent',
        at: row.created_at,
        title: `You backed ${row.athlete_name || 'an athlete'}`,
        body: row.school_name?.trim() || row.source_label?.trim() || 'Mālo sent.',
        amountCents: row.amount_cents,
        reelId: row.reel_id,
      });
    }

    for (const row of ownTags) {
      rows.push({
        id: `tag:${row.id}`,
        kind: 'tag_pending',
        at: row.created_at,
        title: 'A highlight tagged you',
        body: `${row.title || 'Untitled clip'} — confirm it is you before Mālo can reach you.`,
        reelId: row.id,
        actionable: true,
      });
    }

    return rows.sort((a, b) => {
      // Anything waiting on the fan stays on top; the rest is a plain newest-first timeline.
      if (Boolean(a.actionable) !== Boolean(b.actionable)) return a.actionable ? -1 : 1;
      return Date.parse(b.at || '') - Date.parse(a.at || '');
    });
  }, [received.rows, sent.receipts, ownTags]);

  const refresh = useCallback(async () => {
    await Promise.all([received.refresh(), sent.refresh(), tags.refresh()]);
  }, [received, sent, tags]);

  return {
    items,
    loading: received.loading || sent.loading || tags.loading,
    /** First source that failed to load, so an outage is not mistaken for an empty feed. */
    error: received.error ?? sent.error ?? tags.error,
    /** Rows needing a decision. Drives the tab-bar dot — not an unread count. */
    unseenCount: ownTags.length,
    refresh,
  };
}
