/**
 * Exclusive passes (`subscriptions`) and subscriber shoutout / Q&A requests (`subscriber_requests`).
 * The hooks keep their local cache and on-screen state; these calls live here (PORT-01) so a host change
 * rewrites this file, not the hooks.
 * @sideEffects Supabase SELECT / INSERT on `subscriptions` and `subscriber_requests`.
 */

import { supabase } from '@/lib/supabase';
import type { SubscriberRequest } from '@/types/database';

const REQUEST_COLUMNS = 'id, subscriber_id, athlete_id, body, created_at';

/** True for a real roster id. Sample athletes use short placeholder ids that must never reach the database. */
export function isPlayerUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * @purpose The 20 newest shoutout / question requests sent to one athlete.
 * @param athleteId `players.id`.
 * @returns Rows, newest first; empty when the read fails or the table is missing.
 * @sideEffects `subscriber_requests` SELECT.
 */
export async function fetchSubscriberRequests(athleteId: string): Promise<SubscriberRequest[]> {
  const { data, error } = await supabase
    .from('subscriber_requests')
    .select(REQUEST_COLUMNS)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data as SubscriberRequest[];
}

/**
 * @purpose Send one shoutout / question to an athlete.
 * @param subscriberId The signed-in fan's auth user id.
 * @param athleteId `players.id`.
 * @param body Trimmed request text.
 * @returns The saved row, or an error message (a missing table names the SQL file to run).
 * @sideEffects `subscriber_requests` INSERT.
 */
export async function insertSubscriberRequest(
  subscriberId: string,
  athleteId: string,
  body: string,
): Promise<{ row: SubscriberRequest | null; error: string | null }> {
  const { data, error } = await supabase
    .from('subscriber_requests')
    .insert({ subscriber_id: subscriberId, athlete_id: athleteId, body })
    .select(REQUEST_COLUMNS)
    .single();
  if (error) {
    return {
      row: null,
      error: error.message.includes('Could not find the table')
        ? 'The subscriber_requests table is missing. Run supabase/legacy/subscriber_requests.sql in the SQL editor.'
        : error.message,
    };
  }
  return { row: (data as SubscriberRequest | null) ?? null, error: null };
}

/**
 * @purpose Whether this fan holds an active exclusive pass for one athlete.
 * @returns `active` from the server, or `failed` when the read errored (the caller falls back to its cache).
 * @sideEffects `subscriptions` SELECT.
 */
export async function fetchActiveSubscription(
  subscriberId: string,
  athleteId: string,
): Promise<{ active: boolean; failed: boolean }> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('subscriber_id', subscriberId)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) return { active: false, failed: true };
  return { active: Boolean(data), failed: false };
}

/**
 * @purpose Record an active exclusive pass.
 * @returns `ok` when saved or already present (`23505` duplicate key); false on any other rejection
 *   (frozen athlete via RLS, network, missing table).
 * @sideEffects `subscriptions` INSERT.
 */
export async function insertSubscription(subscriberId: string, athleteId: string, client = supabase): Promise<{ ok: boolean }> {
  const { error } = await client.from('subscriptions').insert({
    subscriber_id: subscriberId,
    athlete_id: athleteId,
    status: 'active',
  });
  return { ok: !error || error.code === '23505' };
}
