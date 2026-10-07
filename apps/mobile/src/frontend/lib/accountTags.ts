/**
 * Account mentions on a Highlight. The athlete tag still decides who receives a donation.
 * A mentioned account stays hidden until that person confirms.
 * @sideEffects `search_taggable_accounts`, `tag_reel_accounts`, `get_reel_account_tags`,
 *   `get_my_account_tags`, `confirm_account_tag`. Reads stay optional before SQL deployment;
 *   attachment errors propagate, and confirmation succeeds only after an actual state change.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type AccountTagHit = { id: string; label: string };
export type ReelAccountTag = AccountTagHit & { profileId: string; status: string };
export type MyAccountTag = { id: string; reelId: string; reelTitle: string; label: string; status: string };

function missingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883'
    || /could not find the function/i.test(error.message ?? '');
}

function labelOf(row: Record<string, unknown> | null): string {
  const label = row && typeof row.label === 'string' ? row.label.trim() : '';
  return label || 'Account';
}

/**
 * @purpose Find accounts a signed-in uploader may mention. Shows a username or first name.
 * @param query At least two characters.
 * @returns Up to eight matches. Empty when the SQL is not applied yet.
 * @sideEffects `search_taggable_accounts`.
 */
export async function searchTaggableAccounts(query: string): Promise<AccountTagHit[]> {
  const text = query.trim();
  if (text.length < 2 || !isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('search_taggable_accounts', { search_query: text });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
      const id = typeof record?.id === 'string' ? record.id : '';
      if (!id) return null;
      return { id, label: labelOf(record) };
    })
    .filter((row): row is AccountTagHit => Boolean(row));
}

/**
 * @purpose Attach pending mentions after a Highlight publishes. Does not change who the donation goes to.
 * @param reelId `reels.id` the signed-in uploader just created.
 * @param profileIds Profile ids, at most three.
 * @returns How many new mentions were stored. Zero when the SQL is not applied yet.
 * @throws When a deployed RPC fails, so publishing can disclose incomplete mentions.
 * @sideEffects `tag_reel_accounts`.
 */
export async function attachAccountTags(reelId: string, profileIds: string[]): Promise<number> {
  const ids = profileIds.filter(Boolean).slice(0, 3);
  if (!reelId || ids.length === 0 || !isSupabaseConfigured) return 0;
  const { data, error } = await supabase.rpc('tag_reel_accounts', {
    target_reel_id: reelId,
    profile_ids: ids,
  });
  if (error) {
    if (missingRpc(error)) return 0;
    throw new Error('Could not save the account mentions.');
  }
  if (typeof data !== 'number' || !Number.isInteger(data) || data < 0 || data > ids.length) {
    throw new Error('Could not verify the account mentions were saved.');
  }
  return data;
}

/**
 * @purpose Names confirmed on this Highlight, plus pending names for the uploader or the tagged account.
 * @param reelId `reels.id`.
 * @sideEffects `get_reel_account_tags`.
 */
export async function fetchReelAccountTags(reelId: string): Promise<ReelAccountTag[]> {
  if (!reelId || !isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_reel_account_tags', { target_reel_id: reelId });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
      const id = typeof record?.id === 'string' ? record.id : '';
      const profileId = typeof record?.profile_id === 'string' ? record.profile_id : '';
      if (!record || !id || !profileId) return null;
      return {
        id,
        profileId,
        label: labelOf(record),
        status: typeof record.status === 'string' ? record.status : 'pending',
      };
    })
    .filter((row): row is ReelAccountTag => Boolean(row));
}

/**
 * @purpose Mentions waiting on the signed-in account.
 * @sideEffects `get_my_account_tags`.
 */
export async function fetchMyAccountTags(): Promise<MyAccountTag[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_my_account_tags');
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
      const id = typeof record?.id === 'string' ? record.id : '';
      const reelId = typeof record?.reel_id === 'string' ? record.reel_id : '';
      if (!record || !id || !reelId) return null;
      return {
        id,
        reelId,
        reelTitle: typeof record.reel_title === 'string' && record.reel_title.trim() ? record.reel_title : 'Highlight',
        label: labelOf(record),
        status: typeof record.status === 'string' ? record.status : 'pending',
      };
    })
    .filter((row): row is MyAccountTag => Boolean(row));
}

/**
 * @purpose The tagged account accepts or declines a mention. Only a pending row of theirs moves.
 * @sideEffects `confirm_account_tag`.
 */
export async function confirmAccountTag(tagId: string, action: 'confirm' | 'reject'): Promise<boolean> {
  if (!tagId || !isSupabaseConfigured) return false;
  const { data, error } = await supabase.rpc('confirm_account_tag', {
    target_tag_id: tagId,
    tag_action: action,
  });
  // A valid RPC response can still mean no owned pending mention was changed.
  return !error && data === (action === 'confirm' ? 'confirmed' : 'rejected');
}
