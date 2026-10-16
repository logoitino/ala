/**
 * @purpose Workout challenges (CHAL-01 part 1a) contracts shared by the app and admin: the fixed presets and their
 *   words, the limits the server enforces, the shapes its functions return and pure parsers from raw RPC JSON.
 *   Every rule lives in `supabase/migrations/20261016100000_workout_challenges.sql`; these mirror it for screens.
 *   No React Native / Next imports. Design: docs/engineering/design/WORKOUT_CHALLENGES_DESIGN.md §6.
 */

/** The four responses, in display order. Stored keys; the words are in CHALLENGE_PRESET_LABEL. No free text exists. */
export const CHALLENGE_PRESETS = ['accepted', 'love_it', 'im_in', 'did_it'] as const;
export type ChallengePreset = (typeof CHALLENGE_PRESETS)[number];

export const CHALLENGE_PRESET_LABEL: Record<ChallengePreset, string> = {
  accepted: 'Challenge accepted!',
  love_it: 'Love this workout',
  im_in: "I'm in",
  did_it: 'Did it! 💪',
};

/** Limits enforced by the server (shown in copy only; the database is the rule). */
export const CHALLENGE_LIMITS = { minShown: 5, responsesPerDay: 50, invitesPerDay: 5, inviteRetentionDays: 30, badgeWorkouts: 3 } as const;

/** Why a post takes no responses. `switched_off`: the admin switch is off or PRIV-01 / MINOR-01 are missing. */
export type ChallengeClosedReason =
  | 'switched_off' | 'not_found' | 'not_workout' | 'vault' | 'exclusive' | 'not_listed' | 'no_athlete_account' | 'athlete_off';

export const CHALLENGE_REASON_LABEL: Record<ChallengeClosedReason, string> = {
  switched_off: 'Challenges are switched off',
  not_found: 'Post not found',
  not_workout: 'Not a Train Like Me post',
  vault: 'Vault post',
  exclusive: 'Exclusive post',
  not_listed: 'Not on Highlights (removed, no media or tag not approved)',
  no_athlete_account: 'Athlete has no verified account',
  athlete_off: 'Athlete has challenges off',
};

/** Counts for one post as the caller may see them. A null count is hidden (under 5, or a minor athlete's post). */
export type ChallengeCounts = {
  enabled: boolean;
  eligible: boolean;
  reason: ChallengeClosedReason | null;
  visible: boolean;
  counts: Record<ChallengePreset, number | null> | null;
  total: number | null;
  mine: ChallengePreset | null;
  canRespond: boolean;
  badgeEarned: boolean;
};

export type ChallengeInvite = { id: string; reelId: string; senderId: string; senderName: string; athleteName: string; createdAt: string };

export type ChallengeBadge = { badge: 'challenge_finisher'; earnedAt: string };

export type ChallengeStatus = {
  enabled: boolean;
  isAthlete: boolean;
  allowChallenges: boolean;
  allowDefault: boolean;
  allowSet: boolean;
  mutedAll: boolean;
  mutedSenders: { profileId: string; name: string }[];
  badges: ChallengeBadge[];
};

export type ChallengeSenderHold = 'mute' | 'suspend';

export type AdminChallengeStatus = {
  switchedOn: boolean;
  live: boolean;
  missing: string[];
  changedAt: string | null;
  changeReason: string | null;
  totals: {
    responses: number; responders: number; invites7d: number; invitesDropped7d: number; badges: number;
    sendersHeld: number; athletesOn: number; athletesOff: number;
  };
};

export type AdminChallengePost = {
  reelId: string; title: string; athleteName: string; postedAt: string; eligible: boolean | null; reason: ChallengeClosedReason | null;
  counts: Record<ChallengePreset, number>; responses: number; invites: number; invites7d: number;
};

export type AdminChallengeSender = {
  senderId: string; username: string | null; sent: number; delivered: number; dropped: number; recipients: number;
  recipientIds: string[]; mutedBy: number; hold: ChallengeSenderHold | null; holdReason: string | null; lastSentAt: string | null;
};

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const list = (v: unknown): Raw[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Raw[]) : []);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const count = (v: unknown): number => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
const countOrNull = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));

/** @purpose A stored preset key, or null for anything else (the server never returns free text). */
export function asChallengePreset(v: unknown): ChallengePreset | null {
  return CHALLENGE_PRESETS.includes(v as ChallengePreset) ? (v as ChallengePreset) : null;
}

const REASONS = Object.keys(CHALLENGE_REASON_LABEL) as ChallengeClosedReason[];
const asReason = (v: unknown): ChallengeClosedReason | null => (REASONS.includes(v as ChallengeClosedReason) ? (v as ChallengeClosedReason) : null);

/** @purpose `challenge_counts` / `challenge_respond` JSON → screen shape. Unknown or missing fields read as hidden. */
export function parseChallengeCounts(raw: unknown): ChallengeCounts {
  const r = obj(raw);
  const c = r.counts && typeof r.counts === 'object' ? obj(r.counts) : null;
  return {
    enabled: r.enabled === true,
    eligible: r.eligible === true,
    reason: asReason(r.reason),
    visible: r.visible === true,
    counts: c ? { accepted: countOrNull(c.accepted), love_it: countOrNull(c.love_it), im_in: countOrNull(c.im_in), did_it: countOrNull(c.did_it) } : null,
    total: countOrNull(r.total),
    mine: asChallengePreset(r.mine),
    canRespond: r.can_respond === true,
    badgeEarned: r.badge_earned === true,
  };
}

/** @purpose `challenge_inbox` rows → Activity items. */
export function parseChallengeInvites(raw: unknown): ChallengeInvite[] {
  return list(raw).map((row) => ({
    id: str(row.id),
    reelId: str(row.reel_id),
    senderId: str(row.sender_id),
    senderName: str(row.sender_name, 'A friend'),
    athleteName: str(row.athlete_name, 'an athlete'),
    createdAt: str(row.created_at),
  }));
}

/** @purpose The Activity line for an invite (design §6.3 wording). */
export function challengeInviteText(invite: Pick<ChallengeInvite, 'senderName' | 'athleteName'>): string {
  return `${invite.senderName} invited you to try ${invite.athleteName}'s workout`;
}

/** @purpose `challenge_my_status` / `set_allow_challenges` / `challenge_mute` JSON → settings shape. */
export function parseChallengeStatus(raw: unknown): ChallengeStatus {
  const r = obj(raw);
  return {
    enabled: r.enabled === true,
    isAthlete: r.is_athlete === true,
    allowChallenges: r.allow_challenges === true,
    allowDefault: r.allow_default === true,
    allowSet: r.allow_set === true,
    mutedAll: r.muted_all === true,
    mutedSenders: list(r.muted_senders).map((m) => ({ profileId: str(m.profile_id), name: str(m.name, 'Someone') })),
    badges: list(r.badges).filter((b) => b.badge === 'challenge_finisher').map((b) => ({ badge: 'challenge_finisher' as const, earnedAt: str(b.earned_at) })),
  };
}

/** @purpose `admin_challenge_status` JSON → desk shape. */
export function parseAdminChallengeStatus(raw: unknown): AdminChallengeStatus {
  const r = obj(raw);
  const t = obj(r.totals);
  return {
    switchedOn: r.switched_on === true,
    live: r.live === true,
    missing: Array.isArray(r.missing) ? r.missing.filter((m): m is string => typeof m === 'string') : [],
    changedAt: strOrNull(r.changed_at),
    changeReason: strOrNull(r.change_reason),
    totals: {
      responses: count(t.responses), responders: count(t.responders), invites7d: count(t.invites_7d), invitesDropped7d: count(t.invites_dropped_7d),
      badges: count(t.badges), sendersHeld: count(t.senders_held), athletesOn: count(t.athletes_on), athletesOff: count(t.athletes_off),
    },
  };
}

/** @purpose `admin_challenge_post_counts` rows → desk rows (aggregate counts, never who). */
export function parseAdminChallengePosts(raw: unknown): AdminChallengePost[] {
  return list(raw).map((row) => ({
    reelId: str(row.reel_id),
    title: str(row.title).trim() || 'Untitled workout',
    athleteName: str(row.athlete_name, 'Not tagged'),
    postedAt: str(row.posted_at),
    eligible: typeof row.eligible === 'boolean' ? row.eligible : null,
    reason: asReason(row.reason),
    counts: { accepted: count(row.accepted), love_it: count(row.love_it), im_in: count(row.im_in), did_it: count(row.did_it) },
    responses: count(row.responses),
    invites: count(row.invites),
    invites7d: count(row.invites_7d),
  }));
}

/** @purpose `admin_challenge_nudge_senders` rows → abuse view rows (recipients as ids only). */
export function parseAdminChallengeSenders(raw: unknown): AdminChallengeSender[] {
  return list(raw).map((row) => ({
    senderId: str(row.sender_id),
    username: strOrNull(row.sender_username),
    sent: count(row.sent),
    delivered: count(row.delivered),
    dropped: count(row.dropped),
    recipients: count(row.recipients),
    recipientIds: Array.isArray(row.recipient_ids) ? row.recipient_ids.filter((x): x is string => typeof x === 'string') : [],
    mutedBy: count(row.muted_by),
    hold: row.hold === 'mute' || row.hold === 'suspend' ? row.hold : null,
    holdReason: strOrNull(row.hold_reason),
    lastSentAt: strOrNull(row.last_sent_at),
  }));
}
