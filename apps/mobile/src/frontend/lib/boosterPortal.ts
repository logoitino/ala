/**
 * Booster HQ data uses an optional initiating-account client; writes report success only for confirmed stored rows.
 */

import { supabase } from '@/lib/supabase';
import type { VerificationRequest } from '@/types/database';

export type BoosterRosterInput = {
  name: string;
  jersey_number: number;
  position: string;
  school_name: string;
  height: string;
  backer_count: number;
};

export type PortalWriteResult = { ok: true } | { ok: false; message: string };

/**
 * @purpose Load the Booster HQ athlete-verification queue.
 * @returns Queue rows plus a friendly failure message.
 * @sideEffects `verification_requests` SELECT.
 */
export async function fetchBoosterVerificationQueue(client = supabase): Promise<{
  rows: VerificationRequest[];
  error: string | null;
}> {
  try {
    const { data, error } = await client
      .from('verification_requests')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) return { rows: [], error: 'Could not load verification requests. Try again.' };
    return { rows: (data as VerificationRequest[] | null) ?? [], error: null };
  } catch {
    return { rows: [], error: 'Could not load verification requests. Try again.' };
  }
}

/**
 * @purpose Add a Booster CSV roster batch.
 * @param rows Parsed roster rows.
 * @sideEffects `players` INSERT.
 */
export async function insertBoosterRoster(rows: BoosterRosterInput[], client = supabase): Promise<PortalWriteResult> {
  const { data, error } = await client.from('players').insert(rows).select('id');
  if (error) return { ok: false, message: error.message };
  return Array.isArray(data) && data.length === rows.length && data.every(row => typeof row.id === 'string')
    ? { ok: true } : { ok: false, message: 'Roster insertion was not confirmed. Refresh before trying again.' };
}

/**
 * @purpose Correct one athlete's jersey from Booster HQ.
 * @sideEffects `players` UPDATE.
 */
export async function updateBoosterJersey(playerId: string, jerseyNumber: number, client = supabase): Promise<PortalWriteResult> {
  const { data, error } = await client.from('players').update({ jersey_number: jerseyNumber }).eq('id', playerId).select('id,jersey_number').single();
  if (error) return { ok: false, message: error.message };
  return data?.id === playerId && data.jersey_number === jerseyNumber ? { ok: true } : { ok: false, message: 'Jersey update was not confirmed.' };
}

/**
 * @purpose Record a Booster verification-queue decision.
 * @sideEffects `verification_requests` UPDATE.
 */
export async function setBoosterVerification(id: string, status: string, client = supabase): Promise<PortalWriteResult> {
  const { data, error } = await client.from('verification_requests').update({ status }).eq('id', id).select('id,status').single();
  if (error) return { ok: false, message: error.message };
  return data?.id === id && data.status === status ? { ok: true } : { ok: false, message: 'Verification update was not confirmed.' };
}
