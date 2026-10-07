import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * School-side athlete confirmation (docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md §4).
 *
 * The athletic director or coach opens `alasports://school-confirm?t=TOKEN` — a link Tapua'i issues
 * per staff member (`admin_add_school_confirmer`). They do not need an account: the token is the
 * credential and is only ever stored hashed. They meet the student in person, type the 6-digit code
 * on the student's phone, tick the roster box and sign with their name.
 */

export type ConfirmationRequest = {
  id: string;
  fullName: string;
  sport: string | null;
  classYear: string | null;
  jersey: string | null;
  createdAt: string | null;
  /** The student has a live school code on their screen right now. */
  codeReady: boolean;
};

export type ConfirmationQueue = {
  confirmerName: string;
  staffRole: 'athletic_director' | 'coach';
  sport: string | null;
  schoolName: string | null;
  requests: ConfirmationRequest[];
};

export type ConfirmResult = { ok: true; status: 'approved' | 'rejected' } | { ok: false; error: string };

function asText(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/**
 * @purpose Parse `get_school_confirmation_queue` JSON. Throws the server's message for a dead link.
 */
export function parseConfirmationQueue(raw: unknown): ConfirmationQueue {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (row.ok !== true) {
    throw new Error(asText(row.error) ?? 'This link is not active. Ask Tapua’i for a new one.');
  }
  const list = Array.isArray(row.requests) ? row.requests : [];
  const requests: ConfirmationRequest[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = asText(r.id);
    if (!id) continue;
    requests.push({
      id,
      fullName: asText(r.full_name) ?? 'Athlete',
      sport: asText(r.sport),
      classYear: r.class_year == null ? null : String(r.class_year),
      jersey: r.jersey == null ? null : String(r.jersey),
      createdAt: asText(r.created_at),
      codeReady: r.code_ready === true,
    });
  }
  return {
    confirmerName: asText(row.confirmer_name) ?? 'School staff',
    staffRole: row.staff_role === 'coach' ? 'coach' : 'athletic_director',
    sport: asText(row.sport),
    schoolName: asText(row.school_name),
    requests,
  };
}

/**
 * @purpose Load the students waiting on this staff member's school (and sport, for a coach link).
 * @sideEffects `get_school_confirmation_queue` RPC (anon-callable; the token is checked server-side).
 */
export async function fetchConfirmationQueue(token: string): Promise<ConfirmationQueue> {
  if (!token.trim()) throw new Error('This link is missing its code. Open it again from your email.');
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('get_school_confirmation_queue', { confirm_token: token.trim() });
  if (error) throw new Error(error.message);
  return parseConfirmationQueue(data);
}

/**
 * @purpose Confirm ("met in person, on my roster") or decline ("not on my roster") one student.
 * @param input.meetCode 6-digit code from the student's screen — required to confirm, ignored to decline.
 * @param input.signature The staff member's typed full name.
 * @returns `{ok:false, error}` for a wrong code etc. — the server counts wrong codes, so these are
 *   returned, not thrown.
 * @sideEffects `school_confirm_athlete` RPC.
 */
export async function confirmAthlete(input: {
  token: string;
  requestId: string;
  approve: boolean;
  meetCode?: string;
  signature: string;
  note?: string;
}): Promise<ConfirmResult> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('school_confirm_athlete', {
    confirm_token: input.token.trim(),
    request_id: input.requestId,
    approve: input.approve,
    meet_code: input.approve ? input.meetCode?.replace(/\D/g, '') || null : null,
    confirmer_signature: input.signature.trim() || null,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (row.ok !== true) return { ok: false, error: asText(row.error) ?? 'Could not save. Try again.' };
  return { ok: true, status: row.status === 'rejected' ? 'rejected' : 'approved' };
}
