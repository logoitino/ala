/**
 * UX-14: optional captured clients preserve initiating-account transport without changing existing payloads.
 * Minor accounts (MINOR-01): birth month and year, guardian links and the signed consent, supervision and under-16
 * approvals, and the admin desk's minor tools. Every rule lives in the database (`20261014110000_minor_accounts.sql`);
 * this file calls those functions and names things for the screens. Design: docs/engineering/design/MINOR_ACCOUNTS_DESIGN.md.
 * Birth month and year never go to telemetry. Auth can supply its originating account's bound client for the
 * birth update, so a pending age card cannot borrow an incoming session (UX-13).
 * QUIZ-05: the summary's "fun facts shared" count (null on servers without it) and plain event lines for fun-fact
 * approvals (`change: 'fun_fact'`), which are decided in the guardian panel's fun-fact list, not the generic requests.
 * @sideEffects Database functions through `callRpc`; AsyncStorage for the under-13 device pause.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GUARDIAN_CONSENT_SHA256, GUARDIAN_CONSENT_VERSION } from '@/data/guardianConsent';
import { parsePrivacy, privacyPayload, type PrivacySettings } from '@/lib/privacy';
import { callRpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';

export type AgeBand = 'under_13' | 'teen_13_15' | 'teen_16_17' | 'adult' | 'not_given' | 'unknown';
export type ApprovalKey = 'account_public' | 'friend_requests_everyone';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const BAND_LABEL: Record<AgeBand, string> = {
  under_13: 'Under 13',
  teen_13_15: '13–15',
  teen_16_17: '16–17',
  adult: '18 or older',
  not_given: 'Age not added yet',
  unknown: 'Age not added yet',
};

export const APPROVAL_LABEL: Record<ApprovalKey, string> = {
  account_public: 'Make the profile public',
  friend_requests_everyone: 'Accept friend requests from anyone',
};

/** Neutral refusal for an under-13 date: it must not hint at the age that would work. */
export const AGE_GATE_REFUSAL = "We can't create your account right now.";

/**
 * @purpose The same band rule as `age_band_from` in SQL: a person reaches an age at the start of the month after their
 *   birth month (never early).
 */
export function ageBandFrom(year: number | null, month: number | null, now: Date = new Date()): AgeBand {
  if (!year || !month) return 'unknown';
  const months = now.getFullYear() * 12 + (now.getMonth() + 1) - (year * 12 + month) - 1;
  const years = Math.floor(months / 12);
  if (years < 13) return 'under_13';
  if (years < 16) return 'teen_13_15';
  if (years < 18) return 'teen_16_17';
  return 'adult';
}

export function isMinorBand(band: AgeBand | null | undefined): boolean {
  return band === 'teen_13_15' || band === 'teen_16_17';
}

/** @purpose What is wrong with a birth month and year, or null when it can be sent. */
export function birthInputError(year: number | null, month: number | null, now: Date = new Date()): string | null {
  if (!month) return 'Choose your birth month.';
  if (!year || year < 1900) return 'Enter the year you were born.';
  if (year * 12 + month > now.getFullYear() * 12 + now.getMonth() + 1) return 'Check your birth month and year.';
  return null;
}

const AGE_PAUSE_KEY = 'tapuai.ageGate.pausedAt';
const AGE_PAUSE_MS = 24 * 60 * 60 * 1000;

/** @purpose After an under-13 date, pause account creation on this device for 24 hours (only the time is stored). */
export async function pauseAgeGate(now: number = Date.now()): Promise<void> {
  await AsyncStorage.setItem(AGE_PAUSE_KEY, String(now));
}

/** @purpose True while this device is inside the 24-hour pause. */
export async function isAgeGatePaused(now: number = Date.now()): Promise<boolean> {
  const at = Number(await AsyncStorage.getItem(AGE_PAUSE_KEY));
  return Number.isFinite(at) && at > 0 && now - at < AGE_PAUSE_MS;
}

/** @purpose Record (or correct to a younger age) your birth month and year. 'blocked' means the account is closed. */
export async function recordMyBirthMonth(year: number, month: number, client = supabase): Promise<'ok' | 'blocked'> {
  const raw = await callRpc<Record<string, unknown> | null>('set_my_birth_month', { birth_y: year, birth_m: month }, client);
  return raw?.status === 'blocked' ? 'blocked' : 'ok';
}

export type ConsentSummary = {
  signedAt: string;
  formVersion: string;
  relationship: 'parent' | 'legal_guardian';
  allowsDonations: boolean;
  allowsPublicProfile: boolean;
};

export type GuardianSummary = { linkId: string; firstName: string; since: string; guardianOfRecord: boolean; consent: ConsentSummary | null };
export type PendingLink = { linkId: string; firstName: string; username: string | null; requestedAt: string };
export type PendingApproval = { id: string; changeKey: ApprovalKey; requestedAt: string };

export type MinorStatus = {
  ageBand: AgeBand;
  needsBirth: boolean;
  birthYear: number | null;
  birthMonth: number | null;
  linksEnabled: boolean;
  hasPublicConsent: boolean;
  hasDonationsConsent: boolean;
  guardians: GuardianSummary[];
  pendingLinks: PendingLink[];
  pendingApprovals: PendingApproval[];
};

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const list = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') as Raw[] : []);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
const BANDS: AgeBand[] = ['under_13', 'teen_13_15', 'teen_16_17', 'adult', 'not_given', 'unknown'];
const asBand = (v: unknown): AgeBand => (BANDS.includes(v as AgeBand) ? (v as AgeBand) : 'unknown');
const asApproval = (v: unknown): ApprovalKey | null => (v === 'account_public' || v === 'friend_requests_everyone' ? v : null);

function parseConsent(v: unknown): ConsentSummary | null {
  const c = obj(v);
  if (!c.signed_at) return null;
  return {
    signedAt: str(c.signed_at),
    formVersion: str(c.form_version),
    relationship: c.relationship === 'legal_guardian' ? 'legal_guardian' : 'parent',
    allowsDonations: c.allows_donations === true,
    allowsPublicProfile: c.allows_public_profile === true,
  };
}

/** @purpose The database's minor status → screen shape; null when the database has no minor accounts yet. */
export function parseMinorStatus(raw: unknown): MinorStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = obj(raw);
  return {
    ageBand: asBand(r.age_band),
    needsBirth: r.needs_birth === true,
    birthYear: typeof r.birth_year === 'number' ? r.birth_year : null,
    birthMonth: typeof r.birth_month === 'number' ? r.birth_month : null,
    linksEnabled: r.guardian_links_enabled !== false,
    hasPublicConsent: r.has_public_consent === true,
    hasDonationsConsent: r.has_donations_consent === true,
    guardians: list(r.guardians).flatMap((g) => (typeof g.link_id === 'string'
      ? [{ linkId: g.link_id, firstName: str(g.first_name, 'Guardian'), since: str(g.since), guardianOfRecord: g.guardian_of_record === true, consent: parseConsent(g.consent) }]
      : [])),
    pendingLinks: list(r.pending_links).flatMap((l) => (typeof l.link_id === 'string'
      ? [{ linkId: l.link_id, firstName: str(l.first_name, 'Someone'), username: typeof l.username === 'string' && l.username ? l.username : null, requestedAt: str(l.requested_at) }]
      : [])),
    pendingApprovals: list(r.pending_approvals).flatMap((a) => {
      const key = asApproval(a.change_key);
      return typeof a.id === 'string' && key ? [{ id: a.id, changeKey: key, requestedAt: str(a.requested_at) }] : [];
    }),
  };
}

/** @purpose Your settings plus your minor status (null on databases without MINOR-01). */
export async function fetchMyPrivacyStatus(client = supabase): Promise<{ settings: PrivacySettings; minor: MinorStatus | null }> {
  const raw = obj(await callRpc('get_my_privacy', {}, client));
  return { settings: parsePrivacy(raw), minor: parseMinorStatus(raw.minor) };
}

/** @purpose Save your settings; `heldForApproval` lists changes sent to your guardian instead (under 16). */
export async function saveMyPrivacyStatus(next: Partial<PrivacySettings>, client = supabase): Promise<{ settings: PrivacySettings; minor: MinorStatus | null; heldForApproval: ApprovalKey[] }> {
  const raw = obj(await callRpc('set_my_privacy', { settings: privacyPayload(next) }, client));
  const held = Array.isArray(raw.held_for_approval) ? raw.held_for_approval.flatMap((k) => (asApproval(k) ? [asApproval(k) as ApprovalKey] : [])) : [];
  return { settings: parsePrivacy(raw), minor: parseMinorStatus(raw.minor), heldForApproval: held };
}

// Teen side --------------------------------------------------------------------------------------------------------

/** @purpose A one-time 8-character code for a parent or guardian (48 hours; only the newest works). */
export async function createGuardianInvite(client = supabase): Promise<{ code: string; expiresAt: string }> {
  const raw = obj(await callRpc('create_guardian_invite', {}, client));
  return { code: str(raw.code), expiresAt: str(raw.expires_at) };
}

/** @purpose Answer "Is {name} your parent or guardian?". */
export async function respondGuardianLink(linkId: string, accept: boolean, client = supabase): Promise<MinorStatus | null> {
  return parseMinorStatus(await callRpc('respond_guardian_link', { link_id: linkId, accept }, client));
}

/** @purpose End a guardian link (either side, any time). */
export async function endGuardianLink(linkId: string, client = supabase): Promise<void> {
  await callRpc('end_guardian_link', { link_id: linkId }, client);
}

/** @purpose Cancel a change you asked your guardian to approve. */
export async function cancelApprovalRequest(requestId: string, client = supabase): Promise<void> {
  await callRpc('cancel_my_approval_request', { request_id: requestId }, client);
}

export type SupervisionEvent = { kind: string; detail: Raw; at: string; byTeen: boolean };

export type Supervision = {
  profileId: string;
  firstName: string;
  username: string | null;
  settings: PrivacySettings;
  status: MinorStatus | null;
  summary: {
    friends: number; incomingRequests: number; blockedAccounts: number; tagsWaiting: number; hiddenFromSearch: boolean;
    /** CHAL-01: workout challenge invites received in the last 7 days (a count, never who; 0 before that migration). */
    challengeInvites7d: number;
    /** QUIZ-05: fun facts live now (a count only); null when the server does not send it. */
    funFactsShared: number | null;
  };
  events: SupervisionEvent[];
  canAllowDonations: boolean;
};

/** @purpose The shared supervision summary → screen shape. */
export function parseSupervision(raw: unknown): Supervision {
  const r = obj(raw);
  const s = obj(r.summary);
  return {
    profileId: str(r.profile_id),
    firstName: str(r.first_name, 'Your teen'),
    username: typeof r.username === 'string' && r.username ? r.username : null,
    settings: parsePrivacy(r.settings),
    status: parseMinorStatus(r.status),
    summary: {
      friends: num(s.friends),
      incomingRequests: num(s.incoming_requests),
      blockedAccounts: num(s.blocked_accounts),
      tagsWaiting: num(s.tags_waiting),
      hiddenFromSearch: s.hidden_from_search === true,
      challengeInvites7d: num(s.challenge_invites_7d),
      funFactsShared: s.fun_facts_shared === undefined || s.fun_facts_shared === null ? null : num(s.fun_facts_shared),
    },
    events: list(r.events).map((e) => ({ kind: str(e.kind), detail: obj(e.detail), at: str(e.at), byTeen: e.by_teen === true })),
    canAllowDonations: r.can_allow_donations === true,
  };
}

/** @purpose What your guardian sees about you (the teen sees exactly this). */
export async function fetchMySupervision(client = supabase): Promise<Supervision> {
  return parseSupervision(await callRpc('get_my_supervision', {}, client));
}

const KEY_LABEL: Record<string, string> = {
  account_private: 'public or private',
  audience: 'who sees each part of the profile',
  hide_from_search: 'search',
  tag_review: 'tag review',
  friend_requests_from: 'who can send friend requests',
  allow_challenges: 'workout challenges on their posts',
};

/** @purpose One plain sentence for a supervision event. */
export function describeEvent(event: SupervisionEvent): string {
  const d = event.detail;
  switch (event.kind) {
    case 'age_recorded': return `Birth month and year added (${BAND_LABEL[asBand(d.band)]}).`;
    case 'age_corrected': return `Age corrected (${BAND_LABEL[asBand(d.band)]}).`;
    case 'invite_created': return 'A guardian code was made.';
    case 'guardian_linked': return `${str(d.guardian, 'A guardian')} was linked as a parent or guardian.`;
    case 'guardian_unlinked': return `${str(d.guardian, 'A guardian')} is no longer linked.`;
    case 'consent_signed': {
      const allowed = [d.public_profile === true ? 'a public profile' : null, d.donations === true ? 'payouts of gifts' : null].filter(Boolean);
      return allowed.length ? `Consent signed for ${allowed.join(' and ')}.` : 'Consent signed (nothing extra allowed).';
    }
    case 'consent_withdrawn': return 'Consent was withdrawn.';
    case 'settings_changed': {
      const keys = Array.isArray(d.keys) ? d.keys.map((k) => KEY_LABEL[String(k)]).filter(Boolean) : [];
      return keys.length ? `Changed: ${keys.join(', ')}.` : 'Privacy settings changed.';
    }
    case 'made_private': return 'The profile went back to private (no consent for public).';
    case 'approval_requested': return Array.isArray(d.changes) && d.changes.length === 1 && d.changes[0] === 'fun_fact'
      ? 'Asked the guardian to approve a fun fact.' : 'Asked the guardian to approve a change.';
    case 'approval_decided': return d.change === 'fun_fact'
      ? `A fun fact was ${d.approved === true ? 'approved' : 'declined'}.`
      : `${APPROVAL_LABEL[asApproval(d.change) ?? 'account_public']}: ${d.approved === true ? 'approved' : 'declined'}.`;
    case 'approval_cancelled': return 'A request to the guardian was cancelled.';
    default: return 'Something changed.';
  }
}

// Guardian side ----------------------------------------------------------------------------------------------------

export type ConsentInput = {
  signerName: string;
  relationship: 'parent' | 'legal_guardian';
  allowsDonations: boolean;
  allowsPublicProfile: boolean;
};

const consentArgs = (consent: ConsentInput) => ({
  signer_name: consent.signerName.trim(),
  relationship: consent.relationship,
  allows_donations: consent.allowsDonations,
  allows_public_profile: consent.allowsPublicProfile,
  form_version: GUARDIAN_CONSENT_VERSION,
  form_sha256: GUARDIAN_CONSENT_SHA256,
});

export type InvitePreview = { status: 'ok'; firstName: string; username: string | null; canAllowDonations: boolean } | { status: 'bad_code' };

/** @purpose Look up a teen's code (adults only; 10 wrong tries a day). */
export async function previewGuardianInvite(code: string, client = supabase): Promise<InvitePreview> {
  const raw = obj(await callRpc('preview_guardian_invite', { invite_code: code.trim().toUpperCase() }, client));
  if (raw.status !== 'ok') return { status: 'bad_code' };
  return { status: 'ok', firstName: str(raw.first_name, 'This teen'), username: typeof raw.username === 'string' ? raw.username : null, canAllowDonations: raw.can_allow_donations === true };
}

/** @purpose Redeem the code and sign. The link counts once the teen confirms it. */
export async function acceptGuardianInvite(code: string, consent: ConsentInput, client = supabase): Promise<{ status: 'waiting_for_teen' | 'linked' | 'bad_code'; firstName: string }> {
  const raw = obj(await callRpc('accept_guardian_invite', { invite_code: code.trim().toUpperCase(), ...consentArgs(consent) }, client));
  const status = raw.status === 'waiting_for_teen' || raw.status === 'linked' ? raw.status : 'bad_code';
  return { status, firstName: str(raw.first_name, 'your teen') };
}

/** @purpose Sign (or sign again, to change permissions) for a teen you are linked to, or as the guardian on record. */
export async function signGuardianConsent(minorId: string, consent: ConsentInput, client = supabase): Promise<Supervision> {
  return parseSupervision(await callRpc('sign_guardian_consent', { minor_profile_id: minorId, ...consentArgs(consent) }, client));
}

/** @purpose Withdraw your consent (a public profile goes private; payouts wait). */
export async function revokeGuardianConsent(minorId: string, client = supabase): Promise<Supervision> {
  return parseSupervision(await callRpc('revoke_guardian_consent', { minor_profile_id: minorId }, client));
}

export type GuardianMinorRow = {
  profileId: string;
  firstName: string;
  username: string | null;
  ageBand: AgeBand;
  linkId: string | null;
  linkStatus: 'linked' | 'waiting_for_teen' | 'not_linked';
  accountPrivate: boolean | null;
  myConsent: ConsentSummary | null;
  canAllowDonations: boolean;
  pendingApprovals: number;
};

/** @purpose Teens you supervise, are waiting on, or are the guardian on record for. */
export async function fetchGuardianMinors(client = supabase): Promise<GuardianMinorRow[]> {
  const rows = await callRpc<Raw[] | null>('guardian_list_minors', {}, client);
  return (rows ?? []).flatMap((r) => (typeof r.profile_id === 'string'
    ? [{
        profileId: r.profile_id,
        firstName: str(r.first_name, 'Your teen'),
        username: typeof r.username === 'string' && r.username ? r.username : null,
        ageBand: asBand(r.age_band),
        linkId: typeof r.link_id === 'string' ? r.link_id : null,
        linkStatus: r.link_status === 'linked' || r.link_status === 'waiting_for_teen' ? r.link_status : 'not_linked',
        accountPrivate: typeof r.account_private === 'boolean' ? r.account_private : null,
        myConsent: parseConsent(r.my_consent),
        canAllowDonations: r.can_allow_donations === true,
        pendingApprovals: num(r.pending_approvals),
      }]
    : []));
}

/** @purpose The supervision summary for one teen you supervise. */
export async function fetchGuardianSupervision(minorId: string, client = supabase): Promise<Supervision> {
  return parseSupervision(await callRpc('guardian_get_supervision', { minor_profile_id: minorId }, client));
}

/** @purpose Approve or decline an under-16's request. */
export async function decideApproval(requestId: string, approve: boolean, client = supabase): Promise<Supervision> {
  return parseSupervision(await callRpc('guardian_decide_approval', { request_id: requestId, approve }, client));
}

// Admin ------------------------------------------------------------------------------------------------------------

export type AdminMinorLink = {
  linkId: string;
  guardianName: string;
  guardianTeens: number;
  source: 'invite' | 'custodial';
  createdAt: string;
  confirmedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
};

export type AdminConsentRecord = ConsentSummary & { signerName: string; revokedAt: string | null; revokeReason: string | null };

export type AdminMinorOverview = {
  ageBand: AgeBand;
  birthYear: number | null;
  birthMonth: number | null;
  ageBlockedAt: string | null;
  links: AdminMinorLink[];
  consents: AdminConsentRecord[];
  supervision: Supervision;
};

/** @purpose Admin: the safety case file for one account (names shown; admins only). */
export async function adminMinorOverview(profileId: string): Promise<AdminMinorOverview> {
  const r = obj(await callRpc('admin_minor_overview', { target_profile_id: profileId }));
  return {
    ageBand: asBand(r.age_band),
    birthYear: typeof r.birth_year === 'number' ? r.birth_year : null,
    birthMonth: typeof r.birth_month === 'number' ? r.birth_month : null,
    ageBlockedAt: typeof r.age_blocked_at === 'string' ? r.age_blocked_at : null,
    links: list(r.links).flatMap((l) => (typeof l.link_id === 'string'
      ? [{
          linkId: l.link_id,
          guardianName: str(l.guardian_name, 'Guardian'),
          guardianTeens: num(l.guardian_teens),
          source: l.source === 'custodial' ? 'custodial' : 'invite',
          createdAt: str(l.created_at),
          confirmedAt: typeof l.confirmed_at === 'string' ? l.confirmed_at : null,
          endedAt: typeof l.ended_at === 'string' ? l.ended_at : null,
          endReason: typeof l.end_reason === 'string' ? l.end_reason : null,
        }]
      : [])),
    consents: list(r.consents).flatMap((c) => {
      const base = parseConsent(c);
      return base ? [{ ...base, signerName: str(c.signer_name), revokedAt: typeof c.revoked_at === 'string' ? c.revoked_at : null, revokeReason: typeof c.revoke_reason === 'string' ? c.revoke_reason : null }] : [];
    }),
    supervision: parseSupervision(r.supervision),
  };
}

/** @purpose Admin: correct a birth month and year (either direction) with a reason. */
export async function adminSetBirthMonth(profileId: string, year: number, month: number, reason: string): Promise<void> {
  await callRpc('admin_set_birth_month', { target_profile_id: profileId, birth_y: year, birth_m: month, reason });
}

/** @purpose Admin: end a guardian link with a reason. */
export async function adminEndGuardianLink(linkId: string, reason: string): Promise<void> {
  await callRpc('admin_end_guardian_link', { link_id: linkId, reason });
}

export type MinorReport = {
  teen1315: number;
  teen1617: number;
  adult: number;
  notGiven: number;
  unknown: number;
  under13Blocked: number;
  teensWithGuardian: number;
  teensPublicConsent: number;
  teensDonationsConsent: number;
  pendingApprovals: number;
  invites7d: number;
  guardiansOver3Teens: number;
  adultRequestsToTeens7d: number;
  linksEnabled: boolean;
};

/** @purpose Admin: counts for the minor accounts report. */
export async function adminMinorReport(): Promise<MinorReport> {
  const r = obj(await callRpc('admin_minor_report'));
  return {
    teen1315: num(r.teen_13_15),
    teen1617: num(r.teen_16_17),
    adult: num(r.adult),
    notGiven: num(r.not_given),
    unknown: num(r.unknown),
    under13Blocked: num(r.under_13_blocked),
    teensWithGuardian: num(r.teens_with_guardian),
    teensPublicConsent: num(r.teens_public_consent),
    teensDonationsConsent: num(r.teens_donations_consent),
    pendingApprovals: num(r.pending_approvals),
    invites7d: num(r.invites_7d),
    guardiansOver3Teens: num(r.guardians_over_3_teens),
    adultRequestsToTeens7d: num(r.adult_requests_to_teens_7d),
    linksEnabled: r.guardian_links_enabled !== false,
  };
}

/** @purpose Admin: under-13 accounts waiting for deletion of their sign-in. */
export async function adminListAgeBlocked(): Promise<{ profileId: string; userId: string; blockedAt: string }[]> {
  const rows = await callRpc<Raw[] | null>('admin_list_age_blocked');
  return (rows ?? []).flatMap((r) => (typeof r.profile_id === 'string' ? [{ profileId: r.profile_id, userId: str(r.user_id), blockedAt: str(r.blocked_at) }] : []));
}

/** @purpose Admin: apply the retention schedule (events, codes, tries, old requests). */
export async function adminPurgeMinorRecords(): Promise<{ events: number; invites: number; attempts: number; approvals: number }> {
  const r = obj(await callRpc('admin_purge_minor_records'));
  return { events: num(r.events), invites: num(r.invites), attempts: num(r.attempts), approvals: num(r.approvals) };
}
