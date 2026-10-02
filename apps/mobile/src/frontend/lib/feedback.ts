/**
 * In-app feedback: types, the kind / surface option lists, and the Supabase reads and writes behind the Feedback sheet
 * and the Expo /admin feedback desk (status moves new → reviewing → planned → shipping → shipped / declined).
 * @sideEffects Reads and writes `app_feedback` through the shared Supabase client.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type AppFeedbackKind = 'suggestion' | 'bug' | 'look' | 'other';
export type AppFeedbackSurface = 'home' | 'local' | 'spotlight' | 'drip' | 'profile' | 'other';
export type AppFeedbackStatus = 'new' | 'reviewing' | 'planned' | 'shipping' | 'shipped' | 'declined';

export type AppFeedback = {
  id: string;
  author_id: string | null;
  body: string;
  kind: AppFeedbackKind;
  surface: AppFeedbackSurface;
  status: AppFeedbackStatus;
  runtime_path: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

export const FEEDBACK_KINDS: { id: AppFeedbackKind; label: string }[] = [
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'bug', label: 'Bug' },
  { id: 'look', label: 'Look / copy' },
  { id: 'other', label: 'Other' },
];

export const FEEDBACK_SURFACES: { id: AppFeedbackSurface; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'local', label: 'Local' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'drip', label: 'Drip' },
  { id: 'profile', label: 'Profile' },
  { id: 'other', label: 'Other' },
];

export const FEEDBACK_STATUSES: { id: AppFeedbackStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'planned', label: 'Planned' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'declined', label: 'Declined' },
];

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asKind(value: unknown): AppFeedbackKind {
  const raw = asText(value, 'suggestion');
  return raw === 'bug' || raw === 'look' || raw === 'other' ? raw : 'suggestion';
}

function asSurface(value: unknown): AppFeedbackSurface {
  const raw = asText(value, 'other');
  return raw === 'home' || raw === 'local' || raw === 'spotlight' || raw === 'drip' || raw === 'profile' ? raw : 'other';
}

function asStatus(value: unknown): AppFeedbackStatus {
  const raw = asText(value, 'new');
  if (raw === 'reviewing' || raw === 'planned' || raw === 'shipping' || raw === 'shipped' || raw === 'declined') {
    return raw;
  }
  return 'new';
}

export function parseAppFeedback(raw: unknown): AppFeedback | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asText(row.id);
  const body = asText(row.body);
  if (!id || !body) return null;
  return {
    id,
    author_id: asText(row.author_id) || null,
    body,
    kind: asKind(row.kind),
    surface: asSurface(row.surface),
    status: asStatus(row.status),
    runtime_path: asText(row.runtime_path),
    admin_note: asText(row.admin_note),
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  };
}

/**
 * @purpose Fan suggestion / bug / look note for the admin improvement queue.
 * @sideEffects `submit_app_feedback`.
 */
export async function submitAppFeedback(
  body: string,
  kind: AppFeedbackKind = 'suggestion',
  surface: AppFeedbackSurface = 'other',
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('submit_app_feedback', {
    p_body: body.trim(),
    p_kind: kind,
    p_surface: surface,
  });
  if (error) throw new Error(error.message);
}

/**
 * @purpose Load the admin feedback inbox (new first).
 * @sideEffects `get_app_feedback`.
 */
export async function fetchAppFeedback(): Promise<AppFeedback[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_app_feedback');
  if (error || !Array.isArray(data)) return [];
  return data.map(parseAppFeedback).filter((row): row is AppFeedback => Boolean(row));
}

/**
 * @purpose Count open suggestions for Overview.
 * @sideEffects `app_feedback` count where status is new.
 */
export async function countNewAppFeedback(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count, error } = await supabase
    .from('app_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new');
  if (error) return 0;
  return count ?? 0;
}

/**
 * @purpose Move a suggestion through triage and optionally pin a runtime path.
 * @sideEffects `triage_app_feedback`.
 */
export async function triageAppFeedback(
  id: string,
  status: AppFeedbackStatus,
  note = '',
  runtimePath = '',
): Promise<AppFeedback> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('triage_app_feedback', {
    target_id: id,
    next_status: status,
    next_note: note,
    next_runtime_path: runtimePath,
  });
  if (error || !data) throw new Error(error?.message || 'Could not update this suggestion.');
  const row = parseAppFeedback(data);
  if (!row) throw new Error('Could not update this suggestion.');
  return row;
}
