import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { SubscriberRequest } from '@/types/database';

function isPlayerUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * @purpose Load and send exclusive-subscriber shoutout / Q&A requests for one athlete.
 * @param athleteId Target `players.id` (`subscriber_requests.athlete_id`).
 * @returns `{ items, submitting, submit }` — `submit` inserts a row then prepends locally.
 * @sideEffects Selects/inserts `subscriber_requests`.
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

    const { data, error } = await supabase
      .from('subscriber_requests')
      .select('id, subscriber_id, athlete_id, body, created_at')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) {
      setItems([]);
      return;
    }

    setItems(data as SubscriberRequest[]);
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
        const { data, error } = await supabase
          .from('subscriber_requests')
          .insert({
            subscriber_id: user.id,
            athlete_id: athleteId,
            body: trimmed,
          })
          .select('id, subscriber_id, athlete_id, body, created_at')
          .single();

        if (error) {
          return error.message.includes('Could not find the table')
            ? 'The subscriber_requests table is missing. Run supabase/subscriber_requests.sql in the SQL editor.'
            : error.message;
        }

        if (data) {
          setItems((current) => [data as SubscriberRequest, ...current.filter((row) => row.id !== data.id)]);
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
