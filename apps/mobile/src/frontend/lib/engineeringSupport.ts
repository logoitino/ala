/** DETECT-02 bounded admin RPCs. Server identity/time remain authoritative; missing data stays unknown. */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { parseEngineeringSupportSnapshot, type EngineeringSupportSnapshot, type SupportDisposition } from '@tapuai/shared-types/admin/engineeringSupport';
export type SupportRead = { snapshot: EngineeringSupportSnapshot | null; error: string | null };
export type SupportReviewInput = { fingerprint: string; disposition: SupportDisposition; rationale: string; reviewedThrough: string; parentReviewId?: string | null };
const READ_ERROR = 'Support data could not be read. Refresh or ask Engineering to check the migration and access.';
export async function fetchEngineeringSupport(): Promise<SupportRead> {
  if (!isSupabaseConfigured) return { snapshot: null, error: 'Supabase is not configured. Support coverage is unknown.' };
  try {
    const { data, error } = await supabase.rpc('get_engineering_support_snapshot');
    if (error) return { snapshot: null, error: READ_ERROR };
    return { snapshot: parseEngineeringSupportSnapshot(data), error: null };
  } catch { return { snapshot: null, error: READ_ERROR }; }
}
export async function recordSupportReview(input: SupportReviewInput, accessToken: string): Promise<void> {
  if (!isSupabaseConfigured || !accessToken || !input.rationale.trim() || input.rationale.length > 600 || input.fingerprint.length > 240 || !Number.isFinite(Date.parse(input.reviewedThrough))) throw new Error('Add a short review rationale and a valid occurrence before saving.');
  const { data, error } = await supabase.rpc('record_support_review', { p_fingerprint: input.fingerprint, p_disposition: input.disposition, p_rationale: input.rationale.trim(), p_reviewed_through: input.reviewedThrough, p_parent_review_id: input.parentReviewId ?? null }).setHeader('Authorization', `Bearer ${accessToken}`);
  if (error || typeof data !== 'string') throw new Error('Review was not confirmed. Refresh and check your access or the required second reviewer.');
}
export async function registerSupportRelease(text: string, accessToken: string): Promise<void> {
  if (!isSupabaseConfigured || !accessToken || text.length > 64000) throw new Error('Paste bounded recovery metadata from the local package command.');
  let manifest: EngineeringSupportSnapshot['releases'][number]['manifest'];
  try {
    const parsed = JSON.parse(text);
    const now = new Date().toISOString();
    manifest = parseEngineeringSupportSnapshot({ version: 1, read_at: now, signals: [], reviews: [], audit: [], releases: [{ id: '11111111-1111-1111-1111-111111111111', actor_id: '11111111-1111-1111-1111-111111111111', created_at: now, manifest: parsed }], limits: { signals: 200, reviews: 300, audit: 200, releases: 20 } }).releases[0].manifest;
  } catch { throw new Error('Recovery metadata is invalid. Use the generated metadata JSON, without source code or credentials.'); }
  const { data, error } = await supabase.rpc('register_support_release', { p_manifest: manifest }).setHeader('Authorization', `Bearer ${accessToken}`);
  if (error || typeof data !== 'string') throw new Error('Recovery metadata was not registered. Check access and refresh.');
}
