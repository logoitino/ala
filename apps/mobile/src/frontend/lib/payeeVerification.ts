/**
 * Payee verification on the admin desk (VERIFY-02): who would receive an athlete's donations, which checks they have,
 * what is missing, and the two-admin payout override. Rules live in `20261014120000_payee_verification.sql`; plan:
 * docs/engineering/design/PAYEE_VERIFICATION_PLAN.md. No SSN ever passes through here: Stripe collects it in its own
 * onboarding and Tapua'i keeps only yes/no results.
 * @sideEffects Admin database functions through `callRpc`.
 */
import { callRpc } from '@/lib/rpc';

export type PayeeCheckMethod = 'stripe_connect_kyc' | 'school_parent_confirmation' | 'document_review' | 'stripe_identity';
export type PayeeMissing = 'payee' | 'identity' | 'relationship';

export const METHOD_LABEL: Record<PayeeCheckMethod, string> = {
  stripe_connect_kyc: 'Stripe identity and tax ID',
  school_parent_confirmation: 'School confirmed the parent on record',
  document_review: 'Support reviewed a birth certificate or court order (not kept)',
  stripe_identity: 'Stripe ID + selfie (disputes only)',
};

export const MISSING_LABEL: Record<PayeeMissing, string> = {
  payee: 'No payee yet (set the guardian on record, or the athlete claims their account)',
  identity: 'Stripe has not verified identity and tax ID',
  relationship: 'No school or document confirmation that this is the parent on record',
};

export type PayeeAthlete = { playerId: string; name: string; as: 'guardian' | 'athlete'; payeeIsThisPerson: boolean; missing: PayeeMissing[]; payoutAllowed: boolean; payoutReason: string | null };
export type PayeeCheck = { id: string; playerId: string | null; method: PayeeCheckMethod; status: string; checks: Record<string, boolean>; verifiedAt: string | null; createdAt: string; reviewer: string | null; secondReviewer: string | null; recordedByMe: boolean; reason: string | null };
export type PayoutOverride = { id: string; target: 'profile' | 'custodial'; playerId: string | null; payoutsEnabled: boolean; reason: string; status: string; requestedAt: string; requestedBy: string | null; mine: boolean };
export type PayeeOverview = { payoutsEnabled: boolean; hasConnectAccount: boolean; isMe: boolean; athletes: PayeeAthlete[]; checks: PayeeCheck[]; overrides: PayoutOverride[] };

type Raw = Record<string, unknown>;
const list = (v: unknown): Raw[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Raw[]) : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const METHODS: PayeeCheckMethod[] = ['stripe_connect_kyc', 'school_parent_confirmation', 'document_review', 'stripe_identity'];
const MISSING: PayeeMissing[] = ['payee', 'identity', 'relationship'];

/** @purpose The database overview → screen shape; malformed rows are dropped. */
export function parsePayeeOverview(raw: unknown): PayeeOverview {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Raw;
  return {
    payoutsEnabled: r.payouts_enabled === true,
    hasConnectAccount: r.has_connect_account === true,
    isMe: r.is_me === true,
    athletes: list(r.athletes).flatMap((a) => {
      if (typeof a.player_id !== 'string') return [];
      const payout = (a.payout && typeof a.payout === 'object' ? a.payout : {}) as Raw;
      return [{
        playerId: a.player_id,
        name: str(a.name) ?? 'Athlete',
        as: a.as === 'guardian' ? 'guardian' : 'athlete',
        payeeIsThisPerson: a.payee_is_this_person === true,
        missing: Array.isArray(a.missing) ? a.missing.filter((m): m is PayeeMissing => MISSING.includes(m as PayeeMissing)) : [],
        payoutAllowed: payout.allowed === true,
        payoutReason: str(payout.reason),
      }];
    }),
    checks: list(r.checks).flatMap((c) => (typeof c.id === 'string' && METHODS.includes(c.method as PayeeCheckMethod)
      ? [{
          id: c.id,
          playerId: str(c.player_id),
          method: c.method as PayeeCheckMethod,
          status: str(c.status) ?? 'unknown',
          checks: Object.fromEntries(Object.entries((c.checks && typeof c.checks === 'object' ? c.checks : {}) as Raw).map(([k, v]) => [k, v === true])),
          verifiedAt: str(c.verified_at),
          createdAt: str(c.created_at) ?? '',
          reviewer: str(c.reviewer),
          secondReviewer: str(c.second_reviewer),
          recordedByMe: c.recorded_by_me === true,
          reason: str(c.reason),
        }]
      : [])),
    overrides: list(r.overrides).flatMap((o) => (typeof o.id === 'string'
      ? [{
          id: o.id,
          target: o.target === 'custodial' ? 'custodial' : 'profile',
          playerId: str(o.player_id),
          payoutsEnabled: o.payouts_enabled === true,
          reason: str(o.reason) ?? '',
          status: str(o.status) ?? 'pending',
          requestedAt: str(o.requested_at) ?? '',
          requestedBy: str(o.requested_by),
          mine: o.mine === true,
        }]
      : [])),
  };
}

/** @purpose Admin: one person's payee picture. */
export async function adminPayeeOverview(profileId: string): Promise<PayeeOverview> {
  return parsePayeeOverview(await callRpc('admin_payee_overview', { target_profile_id: profileId }));
}

/**
 * @purpose Admin: record the school's parent confirmation, a document review, or (disputes) a Stripe Identity result. A
 *   passed check waits for a second admin (`adminConfirmPayeeCheck`).
 */
export async function adminRecordPayeeCheck(playerId: string, subjectProfileId: string, method: Exclude<PayeeCheckMethod, 'stripe_connect_kyc'>, passed: boolean, reason: string): Promise<void> {
  await callRpc('admin_record_payee_check', { target_player_id: playerId, subject: subjectProfileId, check_method: method, passed, p_reason: reason, provider_ref: null });
}

/** @purpose Admin (not the recorder, not the person it is about): confirm a relationship check. */
export async function adminConfirmPayeeCheck(verificationId: string): Promise<void> {
  await callRpc('admin_confirm_payee_check', { verification_id: verificationId });
}

/** @purpose Admin: withdraw a check that turned out wrong. */
export async function adminRevokePayeeCheck(verificationId: string, reason: string): Promise<void> {
  await callRpc('admin_revoke_payee_check', { verification_id: verificationId, p_reason: reason });
}

/** @purpose Admin: ask a second admin to switch payouts on or off by hand (reason required). */
export async function adminRequestPayoutOverride(subjectProfileId: string, playerId: string | null, enable: boolean, reason: string): Promise<void> {
  await callRpc('admin_request_payout_override', { subject: subjectProfileId, target_player_id: playerId, enable, p_reason: reason });
}

/** @purpose Admin (not the requester): approve or reject an override. */
export async function adminDecidePayoutOverride(overrideId: string, approve: boolean): Promise<string> {
  return String(await callRpc<string>('admin_decide_payout_override', { override_id: overrideId, approve }));
}

export type PayeeReport = { verifiedIdentity: number; verifiedRelationship: number; awaitingSecondAdmin: number; needsInput: number; failed30d: number; overridesWaiting: number };

/** @purpose Admin: desk-wide counts. */
export async function adminPayeeReport(): Promise<PayeeReport> {
  const r = ((await callRpc('admin_payee_report')) ?? {}) as Raw;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  return { verifiedIdentity: n(r.verified_identity), verifiedRelationship: n(r.verified_relationship), awaitingSecondAdmin: n(r.awaiting_second_admin), needsInput: n(r.needs_input), failed30d: n(r.failed_30d), overridesWaiting: n(r.overrides_waiting) };
}
