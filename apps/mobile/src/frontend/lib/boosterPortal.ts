/**
 * Booster HQ data: the athlete-verification queue and bulk roster (CSV) inserts. Used by app/(booster).
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
export async function fetchBoosterVerificationQueue(): Promise<{
  rows: VerificationRequest[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
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
export async function insertBoosterRoster(rows: BoosterRosterInput[]): Promise<PortalWriteResult> {
  const { error } = await supabase.from('players').insert(rows);
  return error ? { ok: false, message: error.message } : { ok: true };
}

/**
 * @purpose Correct one athlete's jersey from Booster HQ.
 * @sideEffects `players` UPDATE.
 */
export async function updateBoosterJersey(playerId: string, jerseyNumber: number): Promise<PortalWriteResult> {
  const { error } = await supabase.from('players').update({ jersey_number: jerseyNumber }).eq('id', playerId);
  return error ? { ok: false, message: error.message } : { ok: true };
}

/**
 * @purpose Record a Booster verification-queue decision.
 * @sideEffects `verification_requests` UPDATE.
 */
export async function setBoosterVerification(id: string, status: string): Promise<PortalWriteResult> {
  const { error } = await supabase.from('verification_requests').update({ status }).eq('id', id);
  return error ? { ok: false, message: error.message } : { ok: true };
}
