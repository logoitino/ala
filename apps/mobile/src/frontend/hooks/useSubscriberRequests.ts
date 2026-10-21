import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { fetchSubscriberRequests, insertSubscriberRequest, isPlayerUuid } from '@/lib/subscriptions';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { SubscriberRequest } from '@/types/database';

/**
 * @purpose Load and send exclusive-subscriber shoutout / Q&A requests for one athlete.
 * @param athleteId Target `players.id` (`subscriber_requests.athlete_id`).
 * @returns `{ items, submitting, submit }` — `submit` inserts a row then prepends locally.
 * @sideEffects Selects/inserts `subscriber_requests` through `lib/subscriptions`.
 */
export function useSubscriberRequests(athleteId: string | undefined) {
  const { user } = useAuth();
  const [items, setItems] = useState<SubscriberRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!athleteId || !isSupabaseConfigured || !isPlayerUuid(athleteId)) {
      setItems([]);
      return;
    }

    setItems(await fetchSubscriberRequests(athleteId));
  }, [athleteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * @purpose Insert a shoutout / question for this athlete.
   * @param body Request text.
   * @returns Error message, or null on success.
   * @sideEffects `subscriber_requests` insert; optimistic prepend.
   */
  const submit = useCallback(
    async (body: string): Promise<string | null> => {
      const trimmed = body.trim();
      if (!trimmed) return 'Add a question or shoutout first.';
      if (!athleteId || !isPlayerUuid(athleteId)) return 'Missing athlete.';
      if (!user?.id) return 'Sign in to send a shoutout or question.';
      if (!isSupabaseConfigured) return 'Supabase is not configured.';
      if (submitting) return null;

      setSubmitting(true);
      try {
        const { row, error } = await insertSubscriberRequest(user.id, athleteId, trimmed);
        if (error) return error;
        if (row) {
          setItems((current) => [row, ...current.filter((item) => item.id !== row.id)]);
        }
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [athleteId, submitting, user?.id],
  );

  return { items, submitting, submit, refresh };
}
