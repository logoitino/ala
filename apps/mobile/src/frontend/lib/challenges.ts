/**
 * Workout challenges (CHAL-01 part 1a): preset responses on Train Like Me workouts, friend invites in Activity, the
 * athlete's "Allow challenges on my workouts", mutes, the private "Challenge finisher" badge, export, and the admin
 * desk's switch, counts, nudge-abuse view, holds, retention and erasure. Every rule lives in the database
 * (`20261016100000_workout_challenges.sql`); this file sends the caller-captured canonical profile ID for a server session match, calls those functions and parses what they return with the
 * shared parsers in `@tapuai/shared-types/challenges`. On a database without the migration every call throws the
 * shared "not switched on" message (`lib/rpc`). Design: docs/engineering/design/WORKOUT_CHALLENGES_DESIGN.md §6.
 * @sideEffects Database functions through `callRpc`.
 */
import {
  parseAdminChallengePosts,
  parseAdminChallengeSenders,
  parseAdminChallengeStatus,
  parseChallengeCounts,
  parseChallengeInvites,
  parseChallengeStatus,
  type AdminChallengePost,
  type AdminChallengeSender,
  type AdminChallengeStatus,
  type ChallengeCounts,
  type ChallengeInvite,
  type ChallengePreset,
  type ChallengeSenderHold,
  type ChallengeStatus,
} from '@tapuai/shared-types/challenges';

import { callRpc } from '@/lib/rpc';

// Transport success with null/malformed JSON is an unavailable source, never a healthy zero report or saved action.
type Raw = Record<string, unknown>;
const unavailable = (): never => { throw new Error('Workout challenges returned unavailable data. Refresh before continuing.'); };
const record = (value: unknown): Raw => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Raw : unavailable();
const count = (value: unknown): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const string = (value: unknown): boolean => typeof value === 'string' && value.length > 0;
const rows = (value: unknown, valid: (row: Raw) => boolean): Raw[] => {
  if (!Array.isArray(value) || value.some(row => !valid(record(row)))) return unavailable();
  return value as Raw[];
};
const countsSource = (value: unknown): Raw => {
  const r = record(value);
  if (typeof r.enabled !== 'boolean' || typeof r.eligible !== 'boolean' || typeof r.visible !== 'boolean'
    || !(r.total === null || count(r.total)) || !(r.mine === null || ['accepted','love_it','im_in','did_it'].includes(String(r.mine)))) return unavailable();
  if (r.counts !== null) {
    const c = record(r.counts);
    if (['accepted','love_it','im_in','did_it'].some(key => !(c[key] === null || count(c[key])))) return unavailable();
  }
  return r;
};
const statusSource = (value: unknown): Raw => {
  const r = record(value);
  if (['enabled','is_athlete','allow_challenges','allow_default','allow_set','muted_all'].some(key => typeof r[key] !== 'boolean')) return unavailable();
  rows(r.muted_senders, m => string(m.profile_id) && typeof m.name === 'string');
  rows(r.badges, b => b.badge === 'challenge_finisher' && string(b.earned_at));
  return r;
};
const adminSource = (value: unknown): Raw => {
  const r = record(value), t = record(r.totals);
  if (typeof r.switched_on !== 'boolean' || typeof r.live !== 'boolean' || !Array.isArray(r.missing)
    || r.missing.some(v => typeof v !== 'string') || ['responses','responders','invites_7d','invites_dropped_7d','badges','senders_held','athletes_on','athletes_off'].some(key => !count(t[key]))) return unavailable();
  return r;
};

// Participant (the app's ChallengeBar, Activity and settings) -----------------------------------------------------------

/** @purpose Counts per preset on one post (null = hidden: under 5, or a minor athlete's post for everyone else). */
export async function fetchChallengeCounts(reelId: string, expectedActorId: string | null): Promise<ChallengeCounts> {
  return parseChallengeCounts(countsSource(await callRpc('challenge_counts', { expected_actor_id: expectedActorId, target_reel_id: reelId })));
}

/** @purpose Answer a workout with one preset, change it, or remove it (null). Returns the new counts. */
export async function respondToChallenge(reelId: string, preset: ChallengePreset | null, expectedActorId: string): Promise<ChallengeCounts> {
  return parseChallengeCounts(countsSource(await callRpc('challenge_respond', { expected_actor_id: expectedActorId, target_reel_id: reelId, preset })));
}

/**
 * @purpose Invite one accepted friend to try this workout. The answer is the same when the friend has muted the
 *   sender (the invite is dropped silently), so the screen must never claim it was seen.
 */
export async function inviteFriendToChallenge(reelId: string, friendProfileId: string, expectedActorId: string): Promise<{ sentToday: number; dailyLimit: number }> {
  const raw = record(await callRpc('challenge_invite', { expected_actor_id: expectedActorId, target_reel_id: reelId, friend_profile_id: friendProfileId }));
  if (raw.status !== 'sent' || !count(raw.sent_today) || raw.daily_limit !== 5) return unavailable();
  return { sentToday: Number(raw.sent_today) || 0, dailyLimit: Number(raw.daily_limit) || 5 };
}

/** @purpose Mute invites from one sender, or from everyone (`senderProfileId` null); `mute` false lifts it. */
export async function setChallengeMute(senderProfileId: string | null, mute: boolean, expectedActorId: string): Promise<ChallengeStatus> {
  return parseChallengeStatus(statusSource(await callRpc('challenge_mute', { expected_actor_id: expectedActorId, sender_profile_id: senderProfileId, mute })));
}

/** @purpose Invites to me for Activity (last 30 days; muted and blocked senders left out). Empty while switched off. */
export async function fetchChallengeInbox(maxRows = 30, expectedActorId: string): Promise<ChallengeInvite[]> {
  return parseChallengeInvites(rows(await callRpc('challenge_inbox', { expected_actor_id: expectedActorId, max_rows: maxRows }), r => ['id','reel_id','sender_id','sender_name','athlete_name','created_at'].every(k => string(r[k]))));
}

/** @purpose Bounded accepted-friend choices from the same server-checked actor as the invitation write. */
export async function fetchChallengeFriends(maxRows = 50, expectedActorId: string): Promise<{ profileId: string; name: string }[]> {
  const bounded = Number.isFinite(maxRows) ? Math.max(1, Math.min(50, Math.floor(maxRows))) : 50;
  const result = rows(await callRpc('challenge_friends', { expected_actor_id: expectedActorId, max_rows: bounded }), r => string(r.profile_id) && string(r.name));
  if (result.length > bounded) return unavailable();
  return result.map(r => ({ profileId: r.profile_id as string, name: r.name as string }));
}

/** @purpose My athlete switch, mutes and badges. */
export async function fetchMyChallengeStatus(expectedActorId: string): Promise<ChallengeStatus> {
  return parseChallengeStatus(statusSource(await callRpc('challenge_my_status', { expected_actor_id: expectedActorId })));
}

/** @purpose The athlete's "Allow challenges on my workouts" (a minor's change is shown to their guardian). */
export async function setAllowChallenges(allow: boolean, expectedActorId: string): Promise<ChallengeStatus> {
  return parseChallengeStatus(statusSource(await callRpc('set_allow_challenges', { expected_actor_id: expectedActorId, allow })));
}

/** @purpose Everything the challenge tables hold about me (responses, rolling quota, invites, mutes, badges, setting). */
export async function exportMyChallengeData(expectedActorId: string): Promise<Record<string, unknown>> {
  const raw = await callRpc<unknown>('challenge_export_my_data', { expected_actor_id: expectedActorId });
  const r = record(raw);
  if (['response_quota','responses','invites_sent','invites_received','mutes','badges'].some(k => !Array.isArray(r[k])) || !('athlete_setting' in r)) return unavailable();
  return r;
}

// Admin (Highlights desk → Workout challenges) ---------------------------------------------------------------------------

/** @purpose The switch, the PRIV-01 / MINOR-01 pieces still missing, the last change and desk totals. */
export async function fetchAdminChallengeStatus(expectedActorId: string): Promise<AdminChallengeStatus> {
  return parseAdminChallengeStatus(adminSource(await callRpc('admin_challenge_status', { expected_actor_id: expectedActorId })));
}

/** @purpose Switch challenges on or off with a reason. On is refused, naming what is missing, until PRIV-01 and MINOR-01 exist. */
export async function adminSetChallengesEnabled(turnOn: boolean, reason: string, expectedActorId: string): Promise<AdminChallengeStatus> {
  return parseAdminChallengeStatus(adminSource(await callRpc('admin_set_challenges_enabled', { expected_actor_id: expectedActorId, turn_on: turnOn, reason: reason.trim() })));
}

/** @purpose Aggregate counts per workout post: responses by preset and invites. */
export async function fetchAdminChallengePosts(maxRows = 50, expectedActorId: string): Promise<AdminChallengePost[]> {
  return parseAdminChallengePosts(rows(await callRpc('admin_challenge_post_counts', { expected_actor_id: expectedActorId, max_rows: maxRows }), r => string(r.reel_id) && ['accepted','love_it','im_in','did_it','responses','invites','invites_7d'].every(k => count(r[k]))));
}

/** @purpose Invite counts per sender over the last `days` days (recipients as ids only). */
export async function fetchAdminChallengeSenders(days = 7, expectedActorId: string): Promise<AdminChallengeSender[]> {
  return parseAdminChallengeSenders(rows(await callRpc('admin_challenge_nudge_senders', { expected_actor_id: expectedActorId, days }), r => string(r.sender_id) && ['sent','delivered','dropped','recipients','muted_by'].every(k => count(r[k])) && Array.isArray(r.recipient_ids) && r.recipient_ids.every(string)));
}

/** @purpose Mute (dropped silently), suspend (refused) or clear one sender's invites, with a reason. Audited. */
export async function adminHoldChallengeSender(senderProfileId: string, hold: ChallengeSenderHold | 'clear', reason: string, expectedActorId: string): Promise<void> {
  const raw = record(await callRpc('admin_hold_challenge_sender', { expected_actor_id: expectedActorId, sender_profile_id: senderProfileId, hold, reason: reason.trim() }));
  if (raw.sender_id !== senderProfileId || raw.hold !== (hold === 'clear' ? null : hold)) return unavailable();
}

/** @purpose Retention: invites after 30 days, expired rolling response-quota entries, admin records after 2 years. */
export async function adminChallengeRetention(expectedActorId: string): Promise<{ invites: number; adminRecords: number }> {
  const raw = record(await callRpc('admin_challenge_retention', { expected_actor_id: expectedActorId }));
  if (!count(raw.invites) || !count(raw.admin_records) || !count(raw.response_quota)) return unavailable();
  return { invites: Number(raw.invites) || 0, adminRecords: Number(raw.admin_records) || 0 };
}

/** @purpose Remove one person from every challenge table (a deletion request), with a reason. Audited. */
export async function adminChallengeErase(profileId: string, reason: string, expectedActorId: string): Promise<Record<string, number>> {
  const raw = record(await callRpc('admin_challenge_erase', { expected_actor_id: expectedActorId, target_profile_id: profileId.trim(), reason: reason.trim() }));
  if (['responses','invites','mutes','badges','settings','holds','response_quota','audit_identities'].some(k => !count(raw[k]))) return unavailable();
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v) || 0]));
}
