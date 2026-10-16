/**
 * Profile privacy, friends and blocking (PRIV-01). Every rule is enforced in the database
 * (`20261014090000_profile_privacy.sql`); this file only calls those functions and names things for the screens.
 * Design: docs/engineering/design/PROFILE_PRIVACY_DESIGN.md.
 * @sideEffects Database functions through `callRpc`; a missing migration reads as "not switched on".
 */
import { isMissingFunction } from '@/lib/dbErrors';
import { callRpc, untypedRpc } from '@/lib/rpc';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ProfilePublic } from '@/types/database';

export type Audience = 'everyone' | 'friends' | 'only_me';
export type PrivacyItem = 'photo' | 'bio' | 'school' | 'social_links' | 'stats' | 'aura' | 'crew' | 'friends_list';

export type PrivacySettings = {
  accountPrivate: boolean;
  audience: Record<PrivacyItem, Audience>;
  hideFromSearch: boolean;
  tagReview: 'review_all' | 'auto_friends';
  /** 'teens' (only accounts aged 13–17, plus a linked guardian) is the teen default (MINOR-01). */
  friendRequestsFrom: 'everyone' | 'teens' | 'nobody';
};

/** The profile items a person can choose an audience for, in screen order. */
export const PRIVACY_ITEMS: { key: PrivacyItem; label: string; hint: string }[] = [
  { key: 'photo', label: 'Profile photo', hint: 'Your picture on your profile and in lists.' },
  { key: 'bio', label: 'Bio', hint: 'The few lines about you.' },
  { key: 'school', label: 'School', hint: 'Your clips still show your school.' },
  { key: 'social_links', label: 'Social links', hint: 'Links to your other accounts.' },
  { key: 'stats', label: 'Stats', hint: 'Career numbers and game lines.' },
  { key: 'aura', label: 'Aura and points', hint: 'Your Aura card and where you rank.' },
  { key: 'crew', label: 'Crew lists', hint: 'Who is in your Crew and who you ride with.' },
  { key: 'friends_list', label: 'Friends list', hint: 'Who your friends are.' },
];

export const AUDIENCE_LABEL: Record<Audience, string> = { everyone: 'Everyone', friends: 'Friends', only_me: 'Only me' };

/** What stays visible to everyone even on a private account, so tags, donations and recruiting keep working. */
export const ALWAYS_PUBLIC_NOTE =
  'Even when private, everyone still sees your name, the Highlights you approved being tagged in, Donate, Rally and gear goals, and Join Crew.';

const DEFAULT_AUDIENCE: Record<PrivacyItem, Audience> = {
  photo: 'friends', bio: 'friends', school: 'friends', social_links: 'only_me',
  stats: 'friends', aura: 'friends', crew: 'friends', friends_list: 'only_me',
};

function asAudience(value: unknown, fallback: Audience): Audience {
  return value === 'everyone' || value === 'friends' || value === 'only_me' ? value : fallback;
}

/** @purpose Database settings object → screen shape. Unknown values fall back to the private defaults. */
export function parsePrivacy(raw: unknown): PrivacySettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const a = (r.audience && typeof r.audience === 'object' ? r.audience : {}) as Record<string, unknown>;
  const audience = { ...DEFAULT_AUDIENCE };
  for (const item of PRIVACY_ITEMS) audience[item.key] = asAudience(a[item.key], DEFAULT_AUDIENCE[item.key]);
  return {
    accountPrivate: r.account_private !== false,
    audience,
    hideFromSearch: r.hide_from_search === true,
    tagReview: r.tag_review === 'auto_friends' ? 'auto_friends' : 'review_all',
    friendRequestsFrom: r.friend_requests_from === 'nobody' ? 'nobody' : r.friend_requests_from === 'teens' ? 'teens' : 'everyone',
  };
}

/** Screen shape → the object `set_my_privacy` accepts. */
export function privacyPayload(next: Partial<PrivacySettings>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (next.accountPrivate !== undefined) out.account_private = next.accountPrivate;
  if (next.audience) out.audience = next.audience;
  if (next.hideFromSearch !== undefined) out.hide_from_search = next.hideFromSearch;
  if (next.tagReview) out.tag_review = next.tagReview;
  if (next.friendRequestsFrom) out.friend_requests_from = next.friendRequestsFrom;
  return out;
}

/** @purpose Your own settings. */
export async function fetchMyPrivacy(): Promise<PrivacySettings> {
  return parsePrivacy(await callRpc('get_my_privacy'));
}

/* Saving goes through lib/minors `saveMyPrivacyStatus`, which also reads the minor-account result (MINOR-01). */

export type FriendRow = {
  requestId: string;
  profileId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: 'friend' | 'incoming' | 'outgoing';
  since: string;
};

/** @purpose Friends, requests waiting for you, and requests you sent. */
export async function fetchMyFriends(): Promise<FriendRow[]> {
  const rows = await callRpc<Record<string, unknown>[] | null>('list_my_friends');
  return (rows ?? []).flatMap((r) => {
    const status = r.status === 'friend' || r.status === 'incoming' || r.status === 'outgoing' ? r.status : null;
    if (typeof r.profile_id !== 'string' || typeof r.request_id !== 'string' || !status) return [];
    return [{
      requestId: r.request_id,
      profileId: r.profile_id,
      name: typeof r.display_name === 'string' && r.display_name.trim() ? r.display_name.trim() : 'Fan',
      username: typeof r.username === 'string' && r.username ? r.username : null,
      avatarUrl: typeof r.avatar_url === 'string' && r.avatar_url ? r.avatar_url : null,
      status,
      since: typeof r.since === 'string' ? r.since : '',
    }];
  });
}

/** @purpose Send a friend request; returns 'friends' when they had already asked you. */
export async function requestFriend(profileId: string): Promise<'friends' | 'requested'> {
  return (await callRpc<string>('request_friend', { target_profile_id: profileId })) === 'friends' ? 'friends' : 'requested';
}

/** @purpose Accept or decline a request sent to you. The sender is never told about a decline. */
export async function respondFriend(requestId: string, accept: boolean): Promise<void> {
  await callRpc('respond_friend', { request_id: requestId, accept });
}

/** @purpose Unfriend someone, or cancel a request you sent. */
export async function removeFriend(profileId: string): Promise<void> {
  await callRpc('remove_friend', { target_profile_id: profileId });
}

/** @purpose Block someone: ends the friendship, requests, Crew follows and pending tags between you. They are not told. */
export async function blockUser(profileId: string): Promise<void> {
  await callRpc('block_user', { target_profile_id: profileId });
}

/** @purpose Unblock someone. */
export async function unblockUser(profileId: string): Promise<void> {
  await callRpc('unblock_user', { target_profile_id: profileId });
}

export type BlockedRow = { profileId: string; name: string; blockedAt: string };

/** @purpose The accounts you blocked. */
export async function fetchMyBlocks(): Promise<BlockedRow[]> {
  const rows = await callRpc<Record<string, unknown>[] | null>('list_my_blocks');
  return (rows ?? []).flatMap((r) => (typeof r.profile_id === 'string'
    ? [{ profileId: r.profile_id, name: typeof r.display_name === 'string' ? r.display_name : 'Account', blockedAt: typeof r.blocked_at === 'string' ? r.blocked_at : '' }]
    : []));
}

export type AdminPrivacy = PrivacySettings & {
  friendCount: number;
  pendingIncoming: number;
  pendingOutgoing: number;
  requestsSent7d: number;
  blocksMade: number;
  blocksReceived: number;
};

const count = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

/** @purpose Admin: a person's settings and counts (never who they blocked or befriended). */
export async function adminFetchPrivacy(profileId: string): Promise<AdminPrivacy> {
  const raw = await callRpc<Record<string, unknown>>('admin_get_privacy', { target_profile_id: profileId });
  return {
    ...parsePrivacy(raw),
    friendCount: count(raw?.friend_count),
    pendingIncoming: count(raw?.pending_incoming),
    pendingOutgoing: count(raw?.pending_outgoing),
    requestsSent7d: count(raw?.requests_sent_7d),
    blocksMade: count(raw?.blocks_made),
    blocksReceived: count(raw?.blocks_received),
  };
}

/** @purpose Admin: put a person back on the private defaults. */
export async function adminResetPrivacy(profileId: string): Promise<void> {
  await callRpc('admin_reset_privacy', { target_profile_id: profileId });
}

/** @purpose Admin: hide (or show) a person in search. */
export async function adminSetHideFromSearch(profileId: string, hidden: boolean): Promise<void> {
  await callRpc('admin_set_hide_from_search', { target_profile_id: profileId, hidden });
}

export type PrivacyReport = {
  privateAccounts: number;
  publicAccounts: number;
  hiddenFromSearch: number;
  friendships: number;
  requests7d: number;
  blocks7d: number;
  friendRequestsEnabled: boolean;
};

/** @purpose Admin: counts for the Privacy & safety report. */
export async function adminPrivacyReport(): Promise<PrivacyReport> {
  const r = await callRpc<Record<string, unknown>>('admin_privacy_report');
  return {
    privateAccounts: count(r?.private_accounts),
    publicAccounts: count(r?.public_accounts),
    hiddenFromSearch: count(r?.hidden_from_search),
    friendships: count(r?.friendships),
    requests7d: count(r?.requests_7d),
    blocks7d: count(r?.blocks_7d),
    friendRequestsEnabled: r?.friend_requests_enabled !== false,
  };
}

/**
 * @purpose Other people's profiles, as this viewer may see them (`get_public_profiles`): by profile id, roster athlete
 *   id or exact handle — never a search, so hide-from-search holds. Up to 50 of each per call.
 * @returns Matching rows; an empty list on any failure (hidden fields are never guessed). Databases without PRIV-01
 *   still expose the old view, so that is read there instead.
 */
export async function getPublicProfiles(query: { profileIds?: string[]; playerIds?: string[]; handle?: string | null }): Promise<ProfilePublic[]> {
  if (!isSupabaseConfigured) return [];
  const profileIds = (query.profileIds ?? []).filter(Boolean).slice(0, 50);
  const playerIds = (query.playerIds ?? []).filter(Boolean).slice(0, 50);
  const handle = query.handle?.trim() || null;
  if (!profileIds.length && !playerIds.length && !handle) return [];
  const { data, error } = await untypedRpc('get_public_profiles', {
    profile_ids: profileIds.length ? profileIds : null,
    player_ids: playerIds.length ? playerIds : null,
    handle,
  });
  if (!error) return Array.isArray(data) ? (data as ProfilePublic[]) : [];
  if (!isMissingFunction(error)) return [];
  const legacy = supabase.from('profiles_public').select('*');
  const filtered = profileIds.length ? legacy.in('id', profileIds) : playerIds.length ? legacy.in('player_id', playerIds) : legacy.ilike('username', handle ?? '');
  const old = await filtered.limit(50);
  return Array.isArray(old.data) ? (old.data as ProfilePublic[]) : [];
}
