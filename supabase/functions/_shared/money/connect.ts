/**
 * Money server core (SCALE-04): Stripe Connect Express set-up for a payee (Accounts v2). Reads the request mode,
 * applies Terms and service-only adult/guardian context gates, creates or resumes the selected account, mints an onboarding /
 * update / dashboard link after confirming the profile or athlete custodial binding is saved. Used by the Edge Function
 * `create-stripe-account` and the Metro route `POST /api/create-stripe-account`; each runtime injects its database
 * reads/writes and its Stripe client and keeps its own session / configuration order in front of this.
 *
 * The destination is derived by service-only SQL from the live actor and optional athlete UUID; never a request account id.
 * Creating a payee account is a money-moving step, so adapters confirm the live session with `getUser` first.
 * VERIFY-02: once a stored account is saved, Stripe's own identity / TIN answer (v1 account view) is recorded through
 * `record_stripe_kyc`; nothing is recorded until Stripe has answered.
 * Payouts stay blocked regardless (`payout.ts`). Wave 0 is Stripe test mode.
 */

import { errorResult, type CoreResult } from './http.ts';
import type { SessionUser } from './session.ts';

/** 401 copy when the Bearer header is missing on Connect set-up. */
export const CONNECT_SIGN_IN_MESSAGE = 'Sign in to connect payouts.';
/** Who the payee account is for (US individual Express); `sync-front-docs` publishes this as a product fact. */
export const CONNECT_ACCOUNT_IDENTITY = { country: 'us', entity_type: 'individual' } as const;

const ACCOUNT_INCLUDE = ['configuration.recipient', 'requirements', 'defaults'] as const;
type AccountInclude = (typeof ACCOUNT_INCLUDE)[number];

/** `onboarding` (default), `dashboard` (Express login when finished) or `status` (flags only, no link). */
export type ConnectMode = 'onboarding' | 'dashboard' | 'status';

/** Existing response plus the selected athlete for guardian responses; flags are provider capabilities, not KYC. */
export type StripeConnectPayload = {
  url: string | null;
  accountId: string;
  playerId?: string;
  stripe_onboarding_complete: boolean;
  payouts_enabled: boolean;
};

/** Context returned only by stripe_connect_context; actor/target echoes are checked before Stripe. */
export type ConnectContext = {
  owner_user_id?: unknown;
  target_player_id?: unknown;
  target_kind?: unknown;
  id?: unknown;
  stripe_connect_id?: unknown;
  legal_terms_accepted_at?: unknown;
} | null | undefined;

/** The account fields the flags are derived from; Stripe's `V2.Core.Account` satisfies it. */
export type ConnectAccountLike = {
  id: string;
  requirements?: { entries?: Array<{ awaiting_action_from?: string | null }> | null } | null;
  configuration?: {
    recipient?: {
      applied?: boolean | null;
      capabilities?: {
        stripe_balance?: {
          stripe_transfers?: { status?: string | null } | null;
          payouts?: { status?: string | null } | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

/** The v1 account fields that carry Stripe's identity result; Accounts v2 exposes none (VERIFY-02). */
export type ConnectKycAccountLike = {
  individual?: { verification?: { status?: string | null } | null; id_number_provided?: boolean | null } | null;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    pending_verification?: string[] | null;
    errors?: Array<{ code?: string | null }> | null;
  } | null;
};

/** Arguments for `record_stripe_kyc`, all taken from Stripe's answer. */
export type KycEvidence = { identity_verified: boolean; tin_verified: boolean; transfers_active: boolean; details_due: boolean };

type LinkUseCase = {
  configurations: Array<'recipient'>;
  return_url: string;
  refresh_url: string;
  collection_options: { fields: 'eventually_due' };
};

/** Distinguish an unconfirmed database save from a Stripe failure without leaking provider diagnostics. */
class ConnectSaveError extends Error {}
/** Runtime adapters discard raw database messages, retaining only the authorization error category. */
export class ConnectContextError extends Error {
  constructor(public readonly denied: boolean) { super('Bank setup context unavailable.'); }
}
export const CONNECT_FAILURE_MESSAGE = 'Bank setup could not be completed. Try again.';
const PLAYER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ineligible = (): CoreResult => ({ status: 403, body: {
  error: 'This account is not eligible for bank setup. Check your age, athlete and guardian verification.',
  code: 'connect_ineligible',
} });

/** Exactly what is sent to `stripe.v2.core.accounts.create`. */
export type ConnectAccountCreateParams = {
  display_name: string;
  contact_email: string;
  dashboard: 'express';
  identity: { country: 'us'; entity_type: 'individual' };
  defaults: {
    currency: 'usd';
    responsibilities: { fees_collector: 'application'; losses_collector: 'application' };
    profile: { product_description: string };
  };
  configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: boolean } } } } };
  metadata: Record<string, string>;
  include: AccountInclude[];
};

/** Exactly what is sent to `stripe.v2.core.accountLinks.create`. */
export type ConnectAccountLinkParams = {
  account: string;
  use_case:
    | { type: 'account_update'; account_update: LinkUseCase }
    | { type: 'account_onboarding'; account_onboarding: LinkUseCase };
};

/** The Stripe calls Connect set-up needs; the runtime's Stripe SDK instance satisfies it. */
export type ConnectStripeClient = {
  accounts: {
    createLoginLink(accountId: string): Promise<{ url: string }>;
    retrieve(accountId: string): Promise<ConnectKycAccountLike>;
  };
  v2: {
    core: {
      accounts: {
        retrieve(accountId: string, params: { include: AccountInclude[] }): Promise<ConnectAccountLike>;
        create(params: ConnectAccountCreateParams): Promise<ConnectAccountLike>;
      };
      accountLinks: { create(params: ConnectAccountLinkParams): Promise<{ url: string }> };
    };
  };
};

/**
 * @purpose The Connect id stored on the caller's profile (trimmed), or null. The only destination source.
 * @param profile The caller's `profiles` row, or null.
 * @returns A non-empty account id, or null.
 */
export function storedConnectAccountId(profile: { stripe_connect_id?: unknown } | null | undefined): string | null {
  return typeof profile?.stripe_connect_id === 'string' && profile.stripe_connect_id.trim()
    ? profile.stripe_connect_id.trim()
    : null;
}

/**
 * @purpose Onboarding and payout readiness from a Stripe v2 account.
 * @param account The retrieved or created account.
 * @returns `stripe_onboarding_complete` (recipient applied and nothing awaiting the user) and `payouts_enabled`
 *   (payouts or transfers active). `payouts_enabled` is not an identity check (VERIFY-02).
 */
export function flagsFromAccount(
  account: ConnectAccountLike,
): Pick<StripeConnectPayload, 'stripe_onboarding_complete' | 'payouts_enabled'> {
  const dueFromUser = (account.requirements?.entries ?? []).some((entry) => entry.awaiting_action_from === 'user');
  const recipient = account.configuration?.recipient;
  const transfers = recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const payouts = recipient?.capabilities?.stripe_balance?.payouts?.status;
  return {
    stripe_onboarding_complete: Boolean(recipient?.applied) && !dueFromUser,
    payouts_enabled: payouts === 'active' || transfers === 'active',
  };
}

/**
 * @purpose Stripe's identity / TIN answer for `record_stripe_kyc`, or null while Stripe has not answered.
 * @param account The v1 view of the payee account.
 * @param transfersActive The provider capability already derived for the saved binding.
 * @returns Null without a verification status, so an unknown never supersedes a recorded check. TIN counts only when
 *   Stripe verified the person with the full number on file and reports no open tax-id problem.
 */
export function kycEvidence(account: ConnectKycAccountLike, transfersActive: boolean): KycEvidence | null {
  const status = account.individual?.verification?.status;
  if (!status) return null;
  const requirements = account.requirements;
  const due = [...(requirements?.currently_due ?? []), ...(requirements?.past_due ?? [])];
  const idNumberOpen = [...due, ...(requirements?.pending_verification ?? [])].includes('individual.id_number');
  // no-ssn-check: matches Stripe error-code names (verification_failed_tax_id_match, …), never a number.
  const tinError = (requirements?.errors ?? []).some((entry) => /tax_id|id_number/.test(entry.code ?? ''));
  const identity = status === 'verified';
  return {
    identity_verified: identity,
    tin_verified: identity && account.individual?.id_number_provided === true && !idNumberOpen && !tinError,
    transfers_active: transfersActive,
    details_due: due.length > 0,
  };
}

/**
 * @purpose Create or resume the server-derived payee's Express account and mint the right link for the mode.
 * @param stripe Stripe client (secret key on the server only).
 * @param input Session user id / email, the stored account id (never a client id), return URLs and mode.
 * @returns `{ url, accountId, stripe_onboarding_complete, payouts_enabled }`; `url` is null for `status`.
 * @sideEffects Stripe `v2.core.accounts` retrieve or create; optional caller-scoped persistence callback
 *   before Express login link or v2 Account Link. The server request wrapper always supplies persistence and,
 *   for a stored account, records Stripe's KYC answer (best effort; payouts stay gated without it).
 */
export async function runStripeConnectForUser(
  stripe: ConnectStripeClient,
  input: {
    userId: string;
    email: string;
    storedAccountId: string | null;
    returnUrl: string;
    refreshUrl: string;
    mode: ConnectMode;
    playerId?: string;
    payeeProfileId?: string;
    persistAccount?: (payload: StripeConnectPayload) => Promise<void>;
    recordKyc?: (accountId: string, evidence: KycEvidence) => Promise<unknown>;
  },
): Promise<StripeConnectPayload> {
  const account = input.storedAccountId
    ? await stripe.v2.core.accounts.retrieve(input.storedAccountId, { include: [...ACCOUNT_INCLUDE] })
    : await stripe.v2.core.accounts.create({
        display_name: "Tapua'i Athlete",
        contact_email: input.email || 'athlete@tapuai.app',
        dashboard: 'express',
        identity: { ...CONNECT_ACCOUNT_IDENTITY },
        defaults: {
          currency: 'usd',
          responsibilities: { fees_collector: 'application', losses_collector: 'application' },
          profile: { product_description: "Tapua'i athlete receiving personal gifts and purchases" },
        },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
        metadata: { tapuai_user_id: input.userId, ...(input.playerId ? {
          tapuai_player_id: input.playerId, tapuai_payee_profile_id: input.payeeProfileId!,
        } : {}) },
        include: [...ACCOUNT_INCLUDE],
      });

  if (typeof account.id !== 'string' || !account.id.trim()
      || (input.storedAccountId && account.id !== input.storedAccountId)) {
    throw new Error('Stripe did not return the linked account. Try again.');
  }
  const flags = flagsFromAccount(account);
  const payload: StripeConnectPayload = { url: null, accountId: account.id, ...flags };

  // A link request may fail independently. Save the binding first so the next attempt resumes it.
  await input.persistAccount?.(payload);

  // A new account has no answer yet. A failed read or record leaves the payout gate closed; the next request retries.
  if (input.storedAccountId && input.recordKyc) {
    try {
      const evidence = kycEvidence(await stripe.accounts.retrieve(account.id), flags.payouts_enabled);
      if (evidence) await input.recordKyc(account.id, evidence);
    } catch { /* best effort, see above */ }
  }

  if (input.mode === 'status') return payload;

  if (input.mode === 'dashboard' && flags.stripe_onboarding_complete) {
    try {
      const login = await stripe.accounts.createLoginLink(account.id);
      payload.url = login.url;
      return payload;
    } catch {
      // Fall through to a v2 Account Link if the Express dashboard login is not ready.
    }
  }

  const useCase: LinkUseCase = {
    configurations: ['recipient'],
    return_url: input.returnUrl,
    refresh_url: input.refreshUrl,
    collection_options: { fields: 'eventually_due' },
  };
  const link = await stripe.v2.core.accountLinks.create({
    account: account.id,
    use_case: flags.stripe_onboarding_complete
      ? { type: 'account_update', account_update: useCase }
      : { type: 'account_onboarding', account_onboarding: useCase },
  });
  payload.url = link.url;
  return payload;
}

/**
 * @purpose After live session validation, resolve service-only context, run Stripe and atomically save before any link.
 * @param input Runtime-injected session, body, SQL context/save callbacks and server Stripe client.
 * @returns Safe errors or account/capability flags; guardian success echoes the selected athlete.
 * @sideEffects SQL repeats ownership/age/consent/relationship checks after Stripe awaits. No KYC or transfer is performed.
 */
export async function runCreateStripeAccount(input: {
  user: SessionUser;
  body: unknown;
  loadContext: (userId: string, playerId: string | null) => Promise<ConnectContext>;
  saveAccount: (
    profileId: string,
    userId: string,
    flags: Pick<StripeConnectPayload, 'stripe_onboarding_complete' | 'payouts_enabled'> & { stripe_connect_id: string },
    expectedAccountId: string | null,
    playerId: string | null,
  ) => Promise<unknown>;
  recordKyc: (accountId: string, evidence: KycEvidence) => Promise<unknown>;
  stripe: () => ConnectStripeClient;
}): Promise<CoreResult> {
  if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) {
    return errorResult('A bank setup request must be an object.', 400);
  }
  const body = input.body as { returnUrl?: unknown; refreshUrl?: unknown; mode?: unknown; playerId?: unknown };
  let playerId: string | null = null;
  // An explicitly malformed target must not accidentally open the guardian's own-profile account.
  if (Object.prototype.hasOwnProperty.call(body, 'playerId')) {
    if (typeof body.playerId !== 'string' || !PLAYER_UUID.test(body.playerId.trim())) {
      return errorResult('playerId must be a uuid for guardian bank setup.', 400);
    }
    playerId = body.playerId.trim().toLowerCase();
  }
  const mode: ConnectMode = body.mode === 'dashboard' || body.mode === 'status' ? body.mode : 'onboarding';
  const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : '';
  const refreshUrl = (typeof body.refreshUrl === 'string' ? body.refreshUrl.trim() : '') || returnUrl;
  if (mode !== 'status' && (!returnUrl || !refreshUrl)) {
    return errorResult('returnUrl is required for Connect onboarding.', 400);
  }

  let profile: ConnectContext;
  try { profile = await input.loadContext(input.user.id, playerId); }
  catch (error) {
    if (error instanceof ConnectContextError && error.denied) return ineligible();
    return errorResult('Could not load your payout account. Try again.', 503);
  }
  if (typeof profile?.id !== 'string' || !profile.id.trim()) {
    return errorResult('Create your Tapua\'i profile before connecting payouts.', 403);
  }
  if (profile.owner_user_id !== input.user.id || profile.target_player_id !== playerId
    || profile.target_kind !== (playerId === null ? 'self' : 'guardian')) return ineligible();
  const profileId = profile.id;
  // Preserve the exact database value for SQL CAS, separately from the trimmed retrieval id.
  const expectedAccountId = typeof profile.stripe_connect_id === 'string' ? profile.stripe_connect_id : null;
  const storedAccountId = storedConnectAccountId(profile);
  if (mode === 'onboarding' && !storedAccountId && !profile.legal_terms_accepted_at) {
    return errorResult('Agree to Terms of Service & NIL Compliance before connecting a bank.', 403);
  }
  if ((mode === 'dashboard' || mode === 'status') && !storedAccountId) {
    return { status: 400, body: { error: 'No Stripe Express account is linked to this athlete yet.',
      code: 'connect_not_linked', ...(playerId ? { playerId } : {}) } };
  }

  try {
    const payload = await runStripeConnectForUser(input.stripe(), {
      userId: input.user.id, email: input.user.email?.trim() ?? '', storedAccountId,
      returnUrl, refreshUrl, mode, playerId: playerId ?? undefined, payeeProfileId: profileId,
      persistAccount: async (account) => {
        try {
          await input.saveAccount(profileId, input.user.id, {
            stripe_connect_id: account.accountId,
            stripe_onboarding_complete: account.stripe_onboarding_complete,
            payouts_enabled: account.payouts_enabled,
          }, expectedAccountId, playerId);
        } catch { throw new ConnectSaveError(); }
      },
      recordKyc: input.recordKyc,
    });
    return { status: 200, body: { ...payload, ...(playerId ? { playerId } : {}) } };
  } catch (error) {
    if (error instanceof ConnectSaveError) {
      return errorResult('Could not confirm your Stripe account was saved. Try again before continuing.', 503);
    }
    return errorResult(CONNECT_FAILURE_MESSAGE, 400);
  }
}
