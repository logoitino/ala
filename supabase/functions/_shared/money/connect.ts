/**
 * Money server core (SCALE-04): Stripe Connect Express set-up for a payee (Accounts v2). Reads the request mode,
 * applies the Terms and linked-account gates, creates or resumes the caller's own account, mints an onboarding /
 * update / dashboard link and reports the flags to store on `profiles`. Used by the Edge Function
 * `create-stripe-account` and the Metro route `POST /api/create-stripe-account`; each runtime injects its database
 * reads/writes and its Stripe client and keeps its own session / configuration order in front of this.
 *
 * The account is always the caller's (`profiles.stripe_connect_id` for the session user), never a client-supplied id.
 * Creating a payee account is a money-moving step, so adapters confirm the live session with `getUser` first.
 * Payouts stay blocked regardless (`payout.ts`). Wave 0 is Stripe test mode.
 */

import { errorResult, type CoreResult } from './http.ts';
import type { SessionUser } from './session.ts';

/** 401 copy when the Bearer header is missing on Connect set-up. */
export const CONNECT_SIGN_IN_MESSAGE = 'Sign in to connect payouts.';
/** Columns the Connect gates read from the caller's `profiles` row. */
export const CONNECT_PROFILE_COLUMNS = 'id, stripe_connect_id, legal_terms_accepted_at, legal_terms_version';
/** Who the payee account is for (US individual Express); `sync-front-docs` publishes this as a product fact. */
export const CONNECT_ACCOUNT_IDENTITY = { country: 'us', entity_type: 'individual' } as const;

const ACCOUNT_INCLUDE = ['configuration.recipient', 'requirements', 'defaults'] as const;
type AccountInclude = (typeof ACCOUNT_INCLUDE)[number];

/** `onboarding` (default), `dashboard` (Express login when finished) or `status` (flags only, no link). */
export type ConnectMode = 'onboarding' | 'dashboard' | 'status';

/** The response body and the flags stored on `profiles`. */
export type StripeConnectPayload = {
  url: string | null;
  accountId: string;
  stripe_onboarding_complete: boolean;
  payouts_enabled: boolean;
};

/** The caller's `profiles` row as the gates read it (`null` when there is none). */
export type ConnectProfile = {
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

type LinkUseCase = {
  configurations: Array<'recipient'>;
  return_url: string;
  refresh_url: string;
  collection_options: { fields: 'eventually_due' };
};

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
  accounts: { createLoginLink(accountId: string): Promise<{ url: string }> };
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
 * @purpose Create or resume the caller's Express account and mint the right link for the mode.
 * @param stripe Stripe client (secret key on the server only).
 * @param input Session user id / email, the stored account id (never a client id), return URLs and mode.
 * @returns `{ url, accountId, stripe_onboarding_complete, payouts_enabled }`; `url` is null for `status`.
 * @sideEffects Stripe `v2.core.accounts` retrieve or create; Express login link or v2 Account Link.
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
          profile: { product_description: "Tapua'i athlete receiving Mālo tips and subscriptions" },
        },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
        metadata: { tapuai_user_id: input.userId },
        include: [...ACCOUNT_INCLUDE],
      });

  const flags = flagsFromAccount(account);
  const payload: StripeConnectPayload = { url: null, accountId: account.id, ...flags };

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
 * @purpose The whole Connect request after the session is confirmed: read the body, apply the gates, run Stripe and
 *   store the flags on the caller's own profile row.
 * @param input Live-session `user`; parsed JSON `body`; `loadProfile` / `saveFlags` (the runtime's `profiles` read and
 *   update, scoped to the user id); `stripe` (called only after the gates pass).
 * @returns 400 (missing return URL, no linked account), 403 (Terms not accepted) or 200 with the payload.
 * @sideEffects One `profiles` read, Stripe calls, one `profiles` update when the row exists. Throws for the adapter's
 *   catch-all when the body is not an object or Stripe fails.
 */
export async function runCreateStripeAccount(input: {
  user: SessionUser;
  body: unknown;
  loadProfile: (userId: string) => Promise<ConnectProfile>;
  saveFlags: (
    profileId: unknown,
    userId: string,
    flags: Pick<StripeConnectPayload, 'stripe_onboarding_complete' | 'payouts_enabled'> & { stripe_connect_id: string },
  ) => Promise<unknown>;
  stripe: () => ConnectStripeClient;
}): Promise<CoreResult> {
  const body = input.body as { returnUrl?: unknown; refreshUrl?: unknown; mode?: unknown };
  const mode: ConnectMode = body.mode === 'dashboard' || body.mode === 'status' ? body.mode : 'onboarding';
  const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : '';
  const refreshUrl = (typeof body.refreshUrl === 'string' ? body.refreshUrl.trim() : '') || returnUrl;

  if (mode !== 'status' && (!returnUrl || !refreshUrl)) {
    return errorResult('returnUrl is required for Connect onboarding.', 400);
  }

  const profile = await input.loadProfile(input.user.id);
  const storedAccountId = storedConnectAccountId(profile);

  if (mode === 'onboarding' && !storedAccountId && !profile?.legal_terms_accepted_at) {
    return errorResult('Agree to Terms of Service & NIL Compliance before connecting a bank.', 403);
  }
  if ((mode === 'dashboard' || mode === 'status') && !storedAccountId) {
    return errorResult('No Stripe Express account is linked to this athlete yet.', 400);
  }

  const payload = await runStripeConnectForUser(input.stripe(), {
    userId: input.user.id,
    email: input.user.email?.trim() ?? '',
    storedAccountId,
    returnUrl,
    refreshUrl,
    mode,
  });

  if (profile?.id) {
    await input.saveFlags(profile.id, input.user.id, {
      stripe_connect_id: payload.accountId,
      stripe_onboarding_complete: payload.stripe_onboarding_complete,
      payouts_enabled: payload.payouts_enabled,
    });
  }

  return { status: 200, body: payload };
}
