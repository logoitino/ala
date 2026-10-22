/**
 * Characterization of the money server handlers on both runtimes (SCALE-04): the Metro / Node handlers in
 * `src/backend/api` and the Deno Edge Functions in `supabase/functions`. Written against the code before the shared
 * core existed and retained after, with Connect persistence regressions verifying server-only saves before links.
 * Profile/Stripe failures never masquerade as successful durable onboarding.
 * The Edge Functions run here through a small `Deno.serve` / `Deno.env` stand-in and virtual `esm.sh` modules; no
 * network, Stripe or Supabase is reached. Tokens are opaque strings, so every case takes the `getUser` path.
 */

type Row = Record<string, unknown> | null;
type Query = { table: string; ops: unknown[][] };
type Handler = (request: Request) => Promise<Response>;

const mockState = {
  createClientCalls: [] as unknown[][],
  getUser: jest.fn(),
  rpc: jest.fn(),
  profile: null as Row,
  profileError: null as unknown,
  guardian: null as Row,
  contextPatch: {} as Record<string, unknown>,
  updateError: null as unknown,
  updateMatched: true,
  queries: [] as Query[],
};

/** External RPC boundary; atomic SQL authorization/reuse is exercised by the separate replay. */
function mockConnectRpc(fn: string, args: Record<string, unknown>) {
  if (fn === 'stripe_connect_context') {
    if (mockState.profileError) return { data: null, error: mockState.profileError };
    const profile = mockState.profile;
    if (!profile) return { data: null, error: null };
    const guardian = args.target_player_id != null;
    const row = guardian ? mockState.guardian : profile;
    return { data: { ...profile, stripe_connect_id: row?.stripe_connect_id ?? null,
      owner_user_id: args.actor_user_id, target_player_id: args.target_player_id,
      target_kind: guardian ? 'guardian' : 'self', ...mockState.contextPatch }, error: null };
  }
  if (fn === 'save_stripe_connect_account') {
    const guardian = args.target_player_id != null;
    const row = guardian ? mockState.guardian : mockState.profile;
    if (mockState.updateError) return { data: null, error: mockState.updateError };
    if (!mockState.updateMatched || !row || args.expected_profile_id !== mockState.profile?.id
      || row.stripe_connect_id !== args.expected_account_id) return { data: null, error: null };
    Object.assign(row, { stripe_connect_id: args.account_id, payouts_enabled: args.transfers_enabled,
      ...(!guardian ? { stripe_onboarding_complete: args.onboarding_complete } : {}) });
    return { data: args.account_id, error: null };
  }
  return { data: false, error: null };
}

function mockMakeClient() {
  return {
    auth: { getUser: (jwt: string) => mockState.getUser(jwt) },
    rpc: (fn: string, args: unknown) => mockState.rpc(fn, args),
    from: (table: string) => {
      const query: Query = { table, ops: [] };
      mockState.queries.push(query);
      const settle = () => {
        const update = query.ops.find((op) => op[0] === 'update');
        if (!update) return { data: mockState.profile, error: mockState.profileError };
        if (mockState.updateError) return { data: null, error: mockState.updateError };
        if (!mockState.updateMatched || !mockState.profile) return { data: null, error: null };
        const binding = query.ops.find((op) => (op[0] === 'eq' || op[0] === 'is') && op[1] === 'stripe_connect_id');
        if (binding && mockState.profile.stripe_connect_id !== binding[2]) return { data: null, error: null };
        Object.assign(mockState.profile, update[1]);
        return { data: { id: mockState.profile.id }, error: null };
      };
      const builder = {
        select: (columns: string) => { query.ops.push(['select', columns]); return builder; },
        update: (values: unknown) => { query.ops.push(['update', values]); return builder; },
        eq: (column: string, value: unknown) => { query.ops.push(['eq', column, value]); return builder; },
        is: (column: string, value: unknown) => { query.ops.push(['is', column, value]); return builder; },
        maybeSingle: () => Promise.resolve(settle()),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(settle()).then(resolve, reject),
      };
      return builder;
    },
  };
}

const mockStripe = {
  paymentIntents: { create: jest.fn() },
  transfers: { create: jest.fn() },
  accounts: { createLoginLink: jest.fn(), retrieve: jest.fn() },
  v2: { core: { accounts: { retrieve: jest.fn(), create: jest.fn() }, accountLinks: { create: jest.fn() } } },
};
const mockStripeCtorCalls: unknown[][] = [];
function mockStripeModule() {
  function StripeCtor(...args: unknown[]) {
    mockStripeCtorCalls.push(args);
    return mockStripe;
  }
  StripeCtor.createFetchHttpClient = () => 'fetch-http-client';
  return { __esModule: true, default: StripeCtor };
}
function mockSupabaseModule() {
  return {
    createClient: (...args: unknown[]) => {
      mockState.createClientCalls.push(args);
      return mockMakeClient();
    },
  };
}

jest.mock('@supabase/supabase-js', () => mockSupabaseModule());
jest.mock('stripe', () => mockStripeModule());
jest.mock('https://esm.sh/@supabase/supabase-js@2.116.0', () => mockSupabaseModule(), { virtual: true });
jest.mock('https://esm.sh/stripe@22.6.2?target=deno', () => mockStripeModule(), { virtual: true });
const mockCapture = jest.fn();
jest.mock('../services/supportCapture', () => ({
  captureVerifiedAuthFailure: (...args: unknown[]) => mockCapture(...args),
}));

const PLAYER = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AUTH_OPTS = { auth: { persistSession: false, autoRefreshToken: false } };
const SIGNED_IN = { data: { user: { id: 'user-1', email: ' fan@example.test ' } }, error: null };
const PI_STRIPE_MISSING_NODE = 'Missing STRIPE_SECRET_KEY. Add it to .env.local (server only) and restart Expo.';
const ACCOUNT_INCLUDE = ['configuration.recipient', 'requirements', 'defaults'];

function request(body: unknown, authorization: string | null = 'Bearer tok', method = 'POST'): Request {
  const headers = new Headers(authorization === null ? {} : { Authorization: authorization });
  return {
    method,
    headers,
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
  } as unknown as Request;
}

async function read(response: Response) {
  return { status: response.status, body: await response.json() };
}

function account(opts: { id?: string; applied?: boolean; due?: boolean; payouts?: string; transfers?: string } = {}) {
  return {
    id: opts.id ?? 'acct_1',
    requirements: { entries: opts.due ? [{ awaiting_action_from: 'user' }] : [{ awaiting_action_from: 'stripe' }] },
    configuration: {
      recipient: {
        applied: opts.applied ?? false,
        capabilities: {
          stripe_balance: {
            ...(opts.payouts ? { payouts: { status: opts.payouts } } : {}),
            ...(opts.transfers ? { stripe_transfers: { status: opts.transfers } } : {}),
          },
        },
      },
    },
  };
}

const NEW_ACCOUNT_PARAMS = (email: string) => ({
  display_name: "Tapua'i Athlete",
  contact_email: email,
  dashboard: 'express',
  identity: { country: 'us', entity_type: 'individual' },
  defaults: {
    currency: 'usd',
    responsibilities: { fees_collector: 'application', losses_collector: 'application' },
    profile: { product_description: "Tapua'i athlete receiving personal gifts and purchases" },
  },
  configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
  metadata: { tapuai_user_id: 'user-1' },
  include: ACCOUNT_INCLUDE,
});

const linkParams = (type: 'account_onboarding' | 'account_update', returnUrl: string, refreshUrl: string) => ({
  account: 'acct_1',
  use_case: {
    type,
    [type]: {
      configurations: ['recipient'],
      return_url: returnUrl,
      refresh_url: refreshUrl,
      collection_options: { fields: 'eventually_due' },
    },
  },
});

const env = process.env;
let denoEnv: Record<string, string> = {};
const served: Handler[] = [];
let node: { pi: Handler; connect: Handler; payout: Handler };
let edge: { pi: Handler; connect: Handler };

beforeAll(() => {
  (globalThis as unknown as { Deno: unknown }).Deno = {
    serve: (handler: Handler) => { served.push(handler); },
    env: { get: (key: string) => denoEnv[key] },
  };
  /* eslint-disable @typescript-eslint/no-require-imports */
  require('../../../../../supabase/functions/create-payment-intent/index.ts');
  require('../../../../../supabase/functions/create-stripe-account/index.ts');
  node = {
    pi: require('./createPaymentIntent').createPaymentIntentHandler,
    connect: require('./createStripeAccount').createStripeAccountHandler,
    payout: require('./createPayout').createPayoutHandler,
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
  edge = { pi: served[0], connect: served[1] };
});

afterAll(() => {
  delete (globalThis as unknown as { Deno?: unknown }).Deno;
});

beforeEach(() => {
  process.env = { ...env, STRIPE_SECRET_KEY: 'sk_test_x' };
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  denoEnv = {
    SUPABASE_URL: 'https://edge.example.test',
    SUPABASE_ANON_KEY: 'edge-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'edge-service',
    STRIPE_SECRET_KEY: 'sk_test_edge',
  };
  mockState.createClientCalls.length = 0;
  mockState.queries.length = 0;
  mockState.profile = null;
  mockState.profileError = null;
  mockState.guardian = null;
  mockState.contextPatch = {};
  mockState.updateError = null;
  mockState.updateMatched = true;
  mockStripeCtorCalls.length = 0;
  jest.clearAllMocks();
  mockState.getUser.mockResolvedValue(SIGNED_IN);
  mockState.rpc.mockResolvedValue({ data: false, error: null });
  mockCapture.mockResolvedValue(undefined);
  mockStripe.paymentIntents.create.mockResolvedValue({ client_secret: 'pi_secret_1' });
  mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account());
  mockStripe.v2.core.accounts.create.mockResolvedValue(account());
  mockStripe.v2.core.accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.test/link' });
  mockStripe.accounts.createLoginLink.mockResolvedValue({ url: 'https://connect.stripe.test/login' });
  mockStripe.accounts.retrieve.mockResolvedValue({ individual: null, requirements: null });
});

afterEach(() => {
  process.env = env;
});

// ------------------------------------------------------------------ shared PaymentIntent cases (both runtimes)

const validation: Array<[string, unknown, string]> = [
  ['amount below 50', { amount: 49 }, 'amount must be an integer number of cents (min 50).'],
  ['fractional amount', { amount: 50.5 }, 'amount must be an integer number of cents (min 50).'],
  ['missing amount', {}, 'amount must be an integer number of cents (min 50).'],
  ['negative tip', { amount: 500, platformTipCents: -1 }, 'platformTipCents must be whole cents, less than amount.'],
  ['tip equal to amount', { amount: 500, platformTipCents: 500 }, 'platformTipCents must be whole cents, less than amount.'],
  ['fractional tip', { amount: 500, platformTipCents: 1.5 }, 'platformTipCents must be whole cents, less than amount.'],
  ['bad player id', { amount: 500, playerId: 'not-a-uuid' }, 'playerId must be a uuid.'],
];

describe.each([
  ['node', () => node.pi],
  ['edge', () => edge.pi],
])('create-payment-intent (%s)', (runtime, handler) => {
  test.each(validation)('%s answers 400', async (_label, body, message) => {
    expect(await read(await handler()(request(body)))).toEqual({ status: 400, body: { error: message } });
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  test('missing bearer is 401 with the sign-in message', async () => {
    expect(await read(await handler()(request({ amount: 500 }, null)))).toEqual({
      status: 401,
      body: { error: 'Sign in to complete payment.' },
    });
    expect(mockState.getUser).not.toHaveBeenCalled();
  });

  test('rejected session is 401', async () => {
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    expect(await read(await handler()(request({ amount: 500 })))).toEqual({
      status: 401,
      body: { error: 'Invalid or expired session.' },
    });
    expect(mockState.getUser).toHaveBeenCalledWith('tok');
  });

  test('a thrown auth provider error is 400 with its message', async () => {
    mockState.getUser.mockRejectedValue(new Error('auth down'));
    expect(await read(await handler()(request({ amount: 500 })))).toEqual({ status: 400, body: { error: 'auth down' } });
  });

  test('unreadable JSON is 400 with the parser message', async () => {
    expect(await read(await handler()(request(new SyntaxError('Unexpected token x'))))).toEqual({
      status: 400,
      body: { error: 'Unexpected token x' },
    });
  });

  test('a null JSON body is 400 with the runtime TypeError message', async () => {
    const result = await read(await handler()(request(null)));
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/Cannot read properties of null/);
  });

  test('frozen athlete is 403 before any charge', async () => {
    mockState.rpc.mockResolvedValue({ data: true, error: null });
    expect(await read(await handler()(request({ amount: 500, playerId: PLAYER })))).toEqual({
      status: 403,
      body: { error: 'This athlete cannot currently receive gifts.' },
    });
    expect(mockState.rpc).toHaveBeenCalledWith('malo_target_frozen', { target_player_id: PLAYER });
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  test.each([
    ['a lookup error', { data: true, error: { code: '42883' } }],
    ['a non-boolean true', { data: 'true', error: null }],
  ])('freeze check fails open on %s', async (_label, rpcResult) => {
    mockState.rpc.mockResolvedValue(rpcResult);
    expect(await read(await handler()(request({ amount: 500, playerId: PLAYER })))).toEqual({
      status: 200,
      body: { clientSecret: 'pi_secret_1' },
    });
  });

  test('success mints the intent with the metadata contract', async () => {
    const result = await read(
      await handler()(request({ amount: '500', playerId: `  ${PLAYER}  ` })),
    );
    expect(result).toEqual({ status: 200, body: { clientSecret: 'pi_secret_1' } });
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
      amount: 500,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: { tapuai_user_id: 'user-1', tapuai_player_id: PLAYER },
    });
    expect(mockStripeCtorCalls).toEqual([
      runtime === 'node' ? ['sk_test_x'] : ['sk_test_edge', { httpClient: 'fetch-http-client' }],
    ]);
  });

  test('player-agnostic charge with no tip skips the freeze check and tip metadata', async () => {
    expect((await handler()(request({ amount: 50 }))).status).toBe(200);
    expect(mockState.rpc).not.toHaveBeenCalled();
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, metadata: { tapuai_user_id: 'user-1' } }),
    );
  });
  test('forged gift extras fail before charge without trusted service quotation', async () => {
    expect(await read(await handler()(request({ amount: 650, playerId: PLAYER, platformTipCents: 50,
      donation: { giftCents: 500, coverFees: true, platformTipPercent: 10 },
      tapuai_context_id: 'client-cannot-create-authority', donorId: 'someone-else', purpose: 'donation' })))).toEqual({
      status: 503, body: { error: 'Payment context unavailable.' },
    });
    expect(mockState.rpc).toHaveBeenCalledWith('malo_target_frozen', { target_player_id: PLAYER });
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('omitting gift declaration cannot bypass optional-tip admission', async () => {
    expect(await read(await handler()(request({ amount: 500, playerId: PLAYER, platformTipCents: 50 })))).toEqual({
      status: 400, body: { error: "Gift allocation required for an optional tip to Tapua'i." },
    });
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('service quote is wired through this runtime and bound before returning a payable secret', async () => {
    const donor='00000000-0000-0000-0000-000000000001';
    const context={id:'00000000-0000-0000-0000-000000000003',donorId:donor,athleteId:PLAYER,purpose:'donation',currency:'usd',
      giftCents:5000,coverFeeCents:50,platformTipCents:500,totalCents:5550,livemode:false,notificationAuthority:false};
    process.env.SUPABASE_SERVICE_ROLE_KEY='node-service';
    mockState.getUser.mockResolvedValue({data:{user:{id:donor,email:null}},error:null});
    mockState.rpc.mockImplementation(async(fn:string)=>({data:fn==='prepare_tip_payment_context'?context:fn==='record_notification_payment_context',error:null}));
    mockStripe.paymentIntents.create.mockResolvedValue({id:'pi_runtime1234',client_secret:'pi_secret_1',livemode:false});
    expect(await read(await handler()(request({amount:5550,playerId:PLAYER,platformTipCents:500,
      donation:{giftCents:5000,coverFees:true,platformTipPercent:10}})))).toEqual({status:200,body:{clientSecret:'pi_secret_1'}});
    expect(mockState.rpc).toHaveBeenCalledWith('prepare_tip_payment_context',{donor_user_id:donor,athlete_id:PLAYER,gift_cents:5000,cover_fees:true,platform_tip_percent:10});
    expect(mockState.rpc).toHaveBeenCalledWith('record_notification_payment_context',{context_id:context.id,provider_intent_id:'pi_runtime1234',donor_user_id:donor,
      athlete_id:PLAYER,gift_cents:5000,cover_fee_cents:50,platform_tip_cents:500,currency_code:'usd',provider_livemode:false});
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({amount:5550,metadata:expect.objectContaining({tapuai_notification_authority:'false',tapuai_gift_cents:'5000'})}));
  });

  test('a Stripe error is 400 with its message', async () => {
    mockStripe.paymentIntents.create.mockRejectedValue(new Error('card declined'));
    expect(await read(await handler()(request({ amount: 500 })))).toEqual({ status: 400, body: { error: 'card declined' } });
  });
});

describe('create-payment-intent runtime differences (kept on purpose)', () => {
  test('node reads only a well-formed Bearer header', async () => {
    expect(await read(await node.pi(request({ amount: 500 }, 'Token abc')))).toEqual({
      status: 401,
      body: { error: 'Sign in to complete payment.' },
    });
    expect(mockState.getUser).not.toHaveBeenCalled();
  });

  test('edge strips a leading Bearer and passes anything else to getUser', async () => {
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    expect((await edge.pi(request({ amount: 500 }, 'Token abc'))).status).toBe(401);
    expect(mockState.getUser).toHaveBeenCalledWith('Token abc');
    // Headers trims the value to `Bearer`, which the loose pattern does not strip, so it reaches getUser.
    expect((await read(await edge.pi(request({ amount: 500 }, 'Bearer   ')))).body).toEqual({
      error: 'Invalid or expired session.',
    });
    expect(mockState.getUser).toHaveBeenLastCalledWith('Bearer');
  });

  test('a live Stripe key is refused on both runtimes while Wave 0 is test mode (security review P3)', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_replaytest';
    denoEnv.STRIPE_SECRET_KEY = 'sk_live_replaytest';
    const body = { error: 'Live payments are not switched on yet (Stripe test mode only).' };
    expect(await read(await node.pi(request({ amount: 500 })))).toEqual({ status: 503, body });
    expect(await read(await edge.pi(request({ amount: 500 })))).toEqual({ status: 503, body });
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  test('node checks the session before the Stripe key; edge checks configuration first', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete denoEnv.STRIPE_SECRET_KEY;
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    expect(await read(await node.pi(request({ amount: 500 })))).toEqual({
      status: 401,
      body: { error: 'Invalid or expired session.' },
    });
    mockState.getUser.mockClear();
    expect(await read(await edge.pi(request({ amount: 500 })))).toEqual({
      status: 500,
      body: { error: 'Missing STRIPE_SECRET_KEY.' },
    });
    expect(mockState.getUser).not.toHaveBeenCalled();
    mockState.getUser.mockResolvedValue(SIGNED_IN);
    expect(await read(await node.pi(request({ amount: 500 })))).toEqual({
      status: 500,
      body: { error: PI_STRIPE_MISSING_NODE },
    });
  });

  test('edge reports missing Supabase configuration', async () => {
    delete denoEnv.SUPABASE_ANON_KEY;
    expect(await read(await edge.pi(request({ amount: 500 })))).toEqual({
      status: 500,
      body: { error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY.' },
    });
  });

  test('node runs the freeze check as the service role when configured, else as the caller', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'node-service';
    await node.pi(request({ amount: 500, playerId: PLAYER }));
    expect(mockState.createClientCalls[1]).toEqual([
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      'node-service',
      { ...AUTH_OPTS, global: undefined },
    ]);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    mockState.createClientCalls.length = 0;
    await node.pi(request({ amount: 500, playerId: PLAYER }));
    expect(mockState.createClientCalls[0]).toEqual([process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, AUTH_OPTS]);
    expect(mockState.createClientCalls[1]).toEqual([
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      { ...AUTH_OPTS, global: { headers: { Authorization: 'Bearer tok' } } },
    ]);
  });

  test('edge uses one caller-scoped client for the session and the freeze check', async () => {
    await edge.pi(request({ amount: 500, playerId: PLAYER }, 'Bearer tok'));
    expect(mockState.createClientCalls).toEqual([
      ['https://edge.example.test', 'edge-anon', { global: { headers: { Authorization: 'Bearer tok' } }, ...AUTH_OPTS }],
    ]);
  });

  test('edge answers the CORS preflight and adds CORS to JSON responses', async () => {
    const preflight = await edge.pi(request(null, null, 'OPTIONS'));
    expect(preflight.status).toBe(200);
    expect(await preflight.text()).toBe('ok');
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toBe('authorization, x-client-info, apikey, content-type');
    const denied = await edge.pi(request({ amount: 500 }, null));
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(denied.headers.get('Content-Type')).toBe('application/json');
  });

  test('node reports the rejected session to support capture', async () => {
    const error = { code: 'bad_jwt' };
    mockState.getUser.mockResolvedValue({ data: { user: null }, error });
    await node.pi(request({ amount: 500 }));
    expect(mockCapture).toHaveBeenCalledWith(error, process.env.EXPO_PUBLIC_SUPABASE_URL);
  });
});

// ------------------------------------------------------------------ shared Connect cases (both runtimes)

describe.each([
  ['node', () => node.connect],
  ['edge', () => edge.connect],
])('create-stripe-account (%s)', (runtime, handler) => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'node-service';
    mockState.rpc.mockImplementation(mockConnectRpc);
  });
  const ret = 'alasports://stripe-connect/return';
  const refresh = 'alasports://stripe-connect/refresh';

  test('missing bearer is 401', async () => {
    expect(await read(await handler()(request({}, null)))).toEqual({ status: 401, body: { error: 'Sign in to connect payouts.' } });
  });

  test('rejected session is 401 and is never sent to support capture', async () => {
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    expect(await read(await handler()(request({ returnUrl: ret })))).toEqual({
      status: 401,
      body: { error: 'Invalid or expired session.' },
    });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  test('loose Bearer parsing passes an unusual header to getUser', async () => {
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    await handler()(request({}, 'Token abc'));
    expect(mockState.getUser).toHaveBeenCalledWith('Token abc');
  });

  test('a thrown auth provider error is safe 400', async () => {
    mockState.getUser.mockRejectedValue(new Error('auth down'));
    expect(await read(await handler()(request({ returnUrl: ret })))).toEqual({ status: 400, body: { error: 'Bank setup could not be completed. Try again.' } });
  });

  test.each([
    ['no mode, no returnUrl', {}],
    ['unknown mode falls back to onboarding', { mode: 'transfer' }],
    ['dashboard without returnUrl', { mode: 'dashboard', returnUrl: '   ' }],
  ])('%s is 400', async (_label, body) => {
    expect(await read(await handler()(request(body)))).toEqual({
      status: 400,
      body: { error: 'returnUrl is required for Connect onboarding.' },
    });
    expect(mockState.queries).toEqual([]);
  });

  test('first onboarding without the Terms acknowledgement is 403', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: null, legal_terms_accepted_at: null };
    expect(await read(await handler()(request({ returnUrl: ret })))).toEqual({
      status: 403,
      body: { error: 'Agree to Terms of Service & NIL Compliance before connecting a bank.' },
    });
    expect(mockState.rpc).toHaveBeenCalledWith('stripe_connect_context', {
      actor_user_id: 'user-1', target_player_id: null,
    });
    expect(mockStripe.v2.core.accounts.create).not.toHaveBeenCalled();
  });

  test('no profile row is treated as no Terms acknowledgement', async () => {
    expect((await handler()(request({ returnUrl: ret }))).status).toBe(403);
  });

  test.each(['dashboard', 'status'])('%s with no linked account is 400', async (mode) => {
    mockState.profile = { id: 'p1', stripe_connect_id: '   ', legal_terms_accepted_at: '2026-09-01' };
    expect(await read(await handler()(request({ mode, returnUrl: ret })))).toEqual({
      status: 400,
      body: { error: 'No Stripe Express account is linked to this athlete yet.', code: 'connect_not_linked' },
    });
  });

  test('status reads the stored account, stores the flags and returns no link', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: ' acct_1 ' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true, payouts: 'active' }));
    expect(await read(await handler()(request({ mode: 'status' })))).toEqual({
      status: 200,
      body: { url: null, accountId: 'acct_1', stripe_onboarding_complete: true, payouts_enabled: true },
    });
    expect(mockStripe.v2.core.accounts.retrieve).toHaveBeenCalledWith('acct_1', { include: ACCOUNT_INCLUDE });
    expect(mockStripe.v2.core.accountLinks.create).not.toHaveBeenCalled();
    expect(mockState.rpc).toHaveBeenCalledWith('save_stripe_connect_account', {
      actor_user_id: 'user-1', target_player_id: null, expected_profile_id: 'p1',
      expected_account_id: ' acct_1 ', account_id: 'acct_1', onboarding_complete: true, transfers_enabled: true,
    });
  });

  test('first onboarding creates a US individual Express account and an onboarding link', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: null, legal_terms_accepted_at: '2026-09-01' };
    expect(await read(await handler()(request({ returnUrl: ` ${ret} ` })))).toEqual({
      status: 200,
      body: {
        url: 'https://connect.stripe.test/link',
        accountId: 'acct_1',
        stripe_onboarding_complete: false,
        payouts_enabled: false,
      },
    });
    expect(mockStripe.v2.core.accounts.create).toHaveBeenCalledWith(NEW_ACCOUNT_PARAMS('fan@example.test'));
    expect(mockStripe.v2.core.accountLinks.create).toHaveBeenCalledWith(linkParams('account_onboarding', ret, ret));
    expect(mockStripeCtorCalls).toEqual([
      runtime === 'node' ? ['sk_test_x'] : ['sk_test_edge', { httpClient: 'fetch-http-client' }],
    ]);
  });

  test('a user with no email gets the placeholder contact email', async () => {
    mockState.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockState.profile = { id: 'p1', stripe_connect_id: null, legal_terms_accepted_at: '2026-09-01' };
    await handler()(request({ returnUrl: ret }));
    expect(mockStripe.v2.core.accounts.create).toHaveBeenCalledWith(NEW_ACCOUNT_PARAMS('athlete@tapuai.app'));
  });

  test('a finished account gets an account_update link with the given refresh URL', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true, transfers: 'active' }));
    const result = await read(await handler()(request({ mode: 'onboarding', returnUrl: ret, refreshUrl: refresh })));
    expect(result.body).toEqual({
      url: 'https://connect.stripe.test/link',
      accountId: 'acct_1',
      stripe_onboarding_complete: true,
      payouts_enabled: true,
    });
    expect(mockStripe.v2.core.accountLinks.create).toHaveBeenCalledWith(linkParams('account_update', ret, refresh));
  });

  test('requirements awaiting the user keep onboarding incomplete', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true, due: true, payouts: 'pending' }));
    const result = await read(await handler()(request({ mode: 'dashboard', returnUrl: ret })));
    expect(result.body).toMatchObject({ stripe_onboarding_complete: false, payouts_enabled: false });
    expect(mockStripe.accounts.createLoginLink).not.toHaveBeenCalled();
    expect(mockStripe.v2.core.accountLinks.create).toHaveBeenCalledWith(linkParams('account_onboarding', ret, ret));
  });

  test('dashboard on a finished account returns the Express login link', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true }));
    const result = await read(await handler()(request({ mode: 'dashboard', returnUrl: ret })));
    expect(result.body.url).toBe('https://connect.stripe.test/login');
    expect(mockStripe.accounts.createLoginLink).toHaveBeenCalledWith('acct_1');
    expect(mockStripe.v2.core.accountLinks.create).not.toHaveBeenCalled();
  });

  test('dashboard falls back to an account link when the login link fails', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true }));
    mockStripe.accounts.createLoginLink.mockRejectedValue(new Error('not ready'));
    const result = await read(await handler()(request({ mode: 'dashboard', returnUrl: ret })));
    expect(result.body.url).toBe('https://connect.stripe.test/link');
    expect(mockStripe.v2.core.accountLinks.create).toHaveBeenCalledWith(linkParams('account_update', ret, ret));
  });

  test('a profile read failure stops before Stripe and does not expose database error contents', async () => {
    mockState.profileError = { message: 'sensitive provider diagnostics', code: 'XX000' };
    const response = await read(await handler()(request({ returnUrl: ret })));
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('sensitive');
    expect(mockStripe.v2.core.accounts.create).not.toHaveBeenCalled();
    expect(mockStripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
  });

  test.each(['database error', 'zero matching rows'])('%s cannot return a link or successful status', async (failure) => {
    mockState.profile = { id: 'p1', stripe_connect_id: null, legal_terms_accepted_at: '2026-09-01' };
    if (failure === 'database error') mockState.updateError = { message: 'protected update rejected' };
    else mockState.updateMatched = false;
    const result = await read(await handler()(request({ returnUrl: ret })));
    expect(result.status).toBe(503);
    expect(result.body).toHaveProperty('error');
    expect(result.body).not.toHaveProperty('url');
    expect(mockStripe.v2.core.accountLinks.create).not.toHaveBeenCalled();
    expect(mockState.profile.stripe_connect_id).toBeNull();
  });

  test.each(['status', 'dashboard'])('an unconfirmed %s save cannot return ready flags or a dashboard link', async (mode) => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockState.updateError = { message: 'database unavailable' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true, transfers: 'active' }));
    const result = await read(await handler()(request({ mode, returnUrl: ret })));
    expect(result.status).toBe(503);
    expect(result.body).not.toHaveProperty('payouts_enabled');
    expect(mockStripe.accounts.createLoginLink).not.toHaveBeenCalled();
    expect(mockStripe.v2.core.accountLinks.create).not.toHaveBeenCalled();
  });

  test('saves the created account before a failed link request, then retries that saved account', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: null, legal_terms_accepted_at: '2026-09-01' };
    mockStripe.v2.core.accountLinks.create.mockRejectedValueOnce(new Error('link unavailable'));
    expect((await handler()(request({ returnUrl: ret }))).status).toBe(400);
    expect(mockState.profile.stripe_connect_id).toBe('acct_1');
    const result = await read(await handler()(request({ returnUrl: ret })));
    expect(result.status).toBe(200);
    expect(result.body.accountId).toBe('acct_1');
    expect(mockStripe.v2.core.accounts.create).toHaveBeenCalledTimes(1);
    expect(mockStripe.v2.core.accounts.retrieve).toHaveBeenCalledWith('acct_1', { include: ACCOUNT_INCLUDE });
  });

  test('competing first-onboarding requests cannot issue links for two different bindings', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: null, legal_terms_accepted_at: '2026-09-01' };
    mockStripe.v2.core.accounts.create.mockResolvedValueOnce(account({ id: 'acct_first' }))
      .mockResolvedValueOnce(account({ id: 'acct_second' }));
    const results = await Promise.all([handler()(request({ returnUrl: ret })), handler()(request({ returnUrl: ret }))]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 503]);
    expect(mockState.profile.stripe_connect_id).toBe('acct_first');
    expect(mockStripe.v2.core.accountLinks.create).toHaveBeenCalledTimes(1);
    expect(mockStripe.v2.core.accountLinks.create).toHaveBeenCalledWith(expect.objectContaining({ account: 'acct_first' }));
  });

  test('a delayed status cannot overwrite an account replacement', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockImplementationOnce(async () => {
      mockState.profile!.stripe_connect_id = 'acct_replaced';
      return account({ id: 'acct_1', applied: true, transfers: 'active' });
    });
    const result = await read(await handler()(request({ mode: 'status' })));
    expect(result.status).toBe(503);
    expect(mockState.profile.stripe_connect_id).toBe('acct_replaced');
    expect(result.body).not.toHaveProperty('accountId');
  });

  test('a retrieved account cannot replace a different stored binding', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ id: 'acct_other' }));
    const result = await read(await handler()(request({ mode: 'status' })));
    expect(result.status).toBe(400);
    expect(mockState.profile.stripe_connect_id).toBe('acct_1');
    expect(mockState.queries.filter((query) => query.ops.some((op) => op[0] === 'update'))).toEqual([]);
  });

  test('an invalid profile id cannot create an account or publish unpersisted status', async () => {
    mockState.profile = { id: '   ', stripe_connect_id: 'acct_1', legal_terms_accepted_at: '2026-09-01' };
    expect((await handler()(request({ mode: 'status' }))).status).toBe(403);
    expect(mockStripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
  });

  test('guardian onboarding selects only the athlete custodial binding and records target metadata', async () => {
    mockState.profile = { id: 'parent1', stripe_connect_id: 'acct_parent_own', legal_terms_accepted_at: '2026-09-01' };
    mockState.guardian = { stripe_connect_id: null, payouts_enabled: false };
    const result = await read(await handler()(request({ returnUrl: ret, playerId: PLAYER, ownerUserId: 'attacker' })));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ playerId: PLAYER, accountId: 'acct_1' });
    expect(mockState.profile.stripe_connect_id).toBe('acct_parent_own');
    expect(mockState.guardian.stripe_connect_id).toBe('acct_1');
    expect(mockStripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
    expect(mockState.rpc).toHaveBeenCalledWith('stripe_connect_context', { actor_user_id: 'user-1', target_player_id: PLAYER });
    expect(mockStripe.v2.core.accounts.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: {
      tapuai_user_id: 'user-1', tapuai_player_id: PLAYER, tapuai_payee_profile_id: 'parent1',
    } }));
  });

  test('guardian status cannot borrow the guardian own-profile account when no athlete bank is linked', async () => {
    mockState.profile = { id: 'parent1', stripe_connect_id: 'acct_parent_own' };
    mockState.guardian = { stripe_connect_id: null };
    const result = await read(await handler()(request({ mode: 'status', playerId: PLAYER })));
    expect(result).toEqual({ status: 400, body: { error: 'No Stripe Express account is linked to this athlete yet.', code: 'connect_not_linked', playerId: PLAYER } });
    expect(mockStripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
    expect(mockStripe.v2.core.accounts.create).not.toHaveBeenCalled();
  });

  test('guardian status persists only the custodial row and confirms the selected target', async () => {
    mockState.profile = { id: 'parent1', stripe_connect_id: 'acct_parent_own', payouts_enabled: false };
    mockState.guardian = { stripe_connect_id: 'acct_1', payouts_enabled: false };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true, transfers: 'active' }));
    const result = await read(await handler()(request({ mode: 'status', playerId: PLAYER })));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ playerId: PLAYER, payouts_enabled: true, url: null });
    expect(mockState.profile.payouts_enabled).toBe(false);
    expect(mockState.guardian.payouts_enabled).toBe(true);
    expect(mockState.rpc).toHaveBeenCalledWith('save_stripe_connect_account', expect.objectContaining({
      actor_user_id: 'user-1', target_player_id: PLAYER, expected_profile_id: 'parent1', expected_account_id: 'acct_1',
    }));
  });

  test.each([null, [], 'not an object', 42])('invalid body %p fails safely before provider or DB work', async (body) => {
    const result = await read(await handler()(request(body)));
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('A bank setup request must be an object.');
    expect(mockState.rpc).not.toHaveBeenCalled();
    expect(mockStripe.v2.core.accounts.create).not.toHaveBeenCalled();
  });

  test.each(['', 'not-a-uuid', null, 7, [PLAYER]])('invalid target %p cannot silently fall back to self', async (playerId) => {
    mockState.profile = { id: 'parent1', stripe_connect_id: 'acct_parent_own', legal_terms_accepted_at: '2026-09-01' };
    const result = await read(await handler()(request({ returnUrl: ret, playerId })));
    expect(result.status).toBe(400);
    expect(mockState.rpc).not.toHaveBeenCalled();
    expect(mockStripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
  });

  test.each([
    { owner_user_id: 'someone-else' }, { target_player_id: null }, { target_kind: 'self' },
  ])('a mismatched trusted guardian context %p fails closed before Stripe', async (context) => {
    mockState.profile = { id: 'parent1', legal_terms_accepted_at: '2026-09-01' };
    mockState.contextPatch = context;
    expect((await handler()(request({ returnUrl: ret, playerId: PLAYER }))).status).toBe(403);
    expect(mockStripe.v2.core.accounts.create).not.toHaveBeenCalled();
  });

  test('eligibility refusal is safe and cannot expose the RPC diagnostics', async () => {
    mockState.profileError = { code: '42501', message: 'secret sensitive guardian evidence' };
    const result = await read(await handler()(request({ returnUrl: ret, playerId: PLAYER })));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('connect_ineligible');
    expect(JSON.stringify(result.body)).not.toContain('sensitive');
    expect(mockStripe.v2.core.accounts.create).not.toHaveBeenCalled();
  });

  test('guardian eligibility change during Stripe await stops before any link', async () => {
    mockState.profile = { id: 'parent1', legal_terms_accepted_at: '2026-09-01' };
    mockState.guardian = { stripe_connect_id: null };
    mockStripe.v2.core.accounts.create.mockImplementationOnce(async () => {
      mockState.updateError = { code: '42501', message: 'guardian revoked' };
      return account();
    });
    expect((await handler()(request({ returnUrl: ret, playerId: PLAYER }))).status).toBe(503);
    expect(mockStripe.v2.core.accountLinks.create).not.toHaveBeenCalled();
    expect(mockState.guardian.stripe_connect_id).toBeNull();
  });

  test('capability-only flags never fabricate or overwrite identity/TIN evidence', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true, transfers: 'active' }));
    expect((await handler()(request({ mode: 'status' }))).status).toBe(200);
    expect(mockState.rpc.mock.calls.map(([name]) => name)).toEqual(['stripe_connect_context', 'save_stripe_connect_account']);
    expect(mockState.queries).toEqual([]);
  });

  /** v1 view of the account carrying Stripe's own verification answer (VERIFY-02). */
  const kycAccount = (status: string, idNumber: boolean, requirements: Record<string, unknown> = {}) => ({
    individual: { verification: { status }, id_number_provided: idNumber },
    requirements: { currently_due: [], past_due: [], pending_verification: [], errors: [], ...requirements },
  });

  test("records Stripe's verified identity and TIN after the binding is saved, then still links", async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockResolvedValue(account({ applied: true, transfers: 'active' }));
    mockStripe.accounts.retrieve.mockResolvedValue(kycAccount('verified', true));
    expect((await read(await handler()(request({ mode: 'dashboard', returnUrl: ret })))).body.url).toBe('https://connect.stripe.test/login');
    expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith('acct_1');
    expect(mockState.rpc.mock.calls.map(([name]) => name)).toEqual(['stripe_connect_context', 'save_stripe_connect_account', 'record_stripe_kyc']);
    expect(mockState.rpc).toHaveBeenLastCalledWith('record_stripe_kyc', {
      account_id: 'acct_1', identity_verified: true, tin_verified: true, transfers_active: true, details_due: false,
    });
  });

  test.each([
    ['only the last four digits were collected', kycAccount('verified', false), true, false],
    ['Stripe reports a tax-id mismatch', kycAccount('verified', true, { errors: [{ code: 'verification_failed_tax_id_match' }] }), true, false],
    ['the full number is still pending review', kycAccount('verified', true, { pending_verification: ['individual.id_number'] }), true, false],
    ['identity is pending with details due', kycAccount('pending', true, { currently_due: ['external_account'] }), false, true],
  ])('TIN is not claimed when %s', async (_label, v1, identity, due) => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.accounts.retrieve.mockResolvedValue(v1);
    expect((await handler()(request({ mode: 'status' }))).status).toBe(200);
    expect(mockState.rpc).toHaveBeenLastCalledWith('record_stripe_kyc', {
      account_id: 'acct_1', identity_verified: identity, tin_verified: false, transfers_active: false, details_due: due,
    });
  });

  test('a new account records nothing and never reads the v1 account', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: null, legal_terms_accepted_at: '2026-09-01' };
    expect((await handler()(request({ returnUrl: ret }))).status).toBe(200);
    expect(mockStripe.accounts.retrieve).not.toHaveBeenCalled();
    expect(mockState.rpc.mock.calls.map(([name]) => name)).not.toContain('record_stripe_kyc');
  });

  test.each([
    ['the v1 read fails', () => mockStripe.accounts.retrieve.mockRejectedValue(new Error('rate limited'))],
    ['the record call fails', () => {
      mockStripe.accounts.retrieve.mockResolvedValue(kycAccount('verified', true));
      mockState.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
        if (fn === 'record_stripe_kyc') throw new Error('db down');
        return mockConnectRpc(fn, args);
      });
    }],
  ])('bank setup still succeeds when %s (payouts stay gated)', async (_label, arrange) => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    arrange();
    expect(await read(await handler()(request({ returnUrl: ret })))).toEqual({
      status: 200,
      body: { url: 'https://connect.stripe.test/link', accountId: 'acct_1', stripe_onboarding_complete: false, payouts_enabled: false },
    });
  });

  test('a Stripe failure reports fixed safe copy', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    mockStripe.v2.core.accounts.retrieve.mockRejectedValue(new Error('no such account'));
    expect(await read(await handler()(request({ mode: 'status' })))).toEqual({ status: 400, body: { error: 'Bank setup could not be completed. Try again.' } });
  });
});

describe('create-stripe-account runtime differences (kept on purpose)', () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'node-service';
    mockState.rpc.mockImplementation(mockConnectRpc);
  });
  test('node: the Stripe key is checked after the session; edge: before it', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete denoEnv.STRIPE_SECRET_KEY;
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    expect((await node.connect(request({ returnUrl: 'x' }))).status).toBe(401);
    expect(await read(await edge.connect(request({ returnUrl: 'x' })))).toEqual({
      status: 500,
      body: { error: 'Missing STRIPE_SECRET_KEY.' },
    });
    mockState.getUser.mockResolvedValue(SIGNED_IN);
    expect(await read(await node.connect(request({ returnUrl: 'x' })))).toEqual({
      status: 500,
      body: { error: 'Missing STRIPE_SECRET_KEY. Load it into the private server process and restart Expo.' },
    });
  });

  test('both runtimes require a service credential before protected profile operations', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete denoEnv.SUPABASE_SERVICE_ROLE_KEY;
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    for (const handler of [node.connect, edge.connect]) {
      expect(await read(await handler(request({ mode: 'status' })))).toEqual({
        status: 500, body: { error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' },
      });
    }
    expect(mockState.queries).toEqual([]);
    expect(mockStripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
  });

  test('node uses the service role for profiles when configured', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'node-service';
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    await node.connect(request({ mode: 'status' }));
    expect(mockState.createClientCalls[1]).toEqual([
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      'node-service',
      { ...AUTH_OPTS, global: undefined },
    ]);
  });

  test('edge builds a caller client for the session and a service client for profiles', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1' };
    await edge.connect(request({ mode: 'status' }));
    expect(mockState.createClientCalls).toEqual([
      ['https://edge.example.test', 'edge-anon', { global: { headers: { Authorization: 'Bearer tok' } }, ...AUTH_OPTS }],
      ['https://edge.example.test', 'edge-service', AUTH_OPTS],
    ]);
  });

  test('edge reports missing Supabase configuration and answers the preflight', async () => {
    const preflight = await edge.connect(request(null, null, 'OPTIONS'));
    expect([preflight.status, await preflight.text()]).toEqual([200, 'ok']);
    delete denoEnv.SUPABASE_URL;
    expect(await read(await edge.connect(request({})))).toEqual({
      status: 500,
      body: { error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY.' },
    });
  });

  test('a profile without an id is not updated', async () => {
    mockState.profile = { stripe_connect_id: 'acct_1' };
    expect((await node.connect(request({ mode: 'status' }))).status).toBe(403);
    expect((await edge.connect(request({ mode: 'status' }))).status).toBe(403);
    expect(mockStripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
    expect(mockState.queries.filter((q) => q.ops.some((op) => op[0] === 'update'))).toEqual([]);
  });
});

// ------------------------------------------------------------------ payout (Node only; no Edge twin by design)

describe('create-payout (node only)', () => {
  test('missing bearer is 401 in the payout shape', async () => {
    expect(await read(await node.payout(request({ amountCents: 500 }, null)))).toEqual({
      status: 401,
      body: { status: 'error', message: 'Sign in to request a payout.' },
    });
  });

  test('rejected session is 401 in the payout shape', async () => {
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    expect(await read(await node.payout(request({ amountCents: 500 })))).toEqual({
      status: 401,
      body: { status: 'error', message: 'Invalid or expired session.' },
    });
  });

  test('the destination comes from the caller profile only', async () => {
    mockState.profile = null;
    expect(await read(await node.payout(request({ amountCents: 500, destinationAccountId: 'acct_attacker' })))).toEqual({
      status: 400,
      body: { status: 'error', message: 'No Stripe Express account is linked to this profile.' },
    });
    expect(mockState.queries[0]).toEqual({
      table: 'profiles',
      ops: [['select', 'id, stripe_connect_id, payouts_enabled'], ['eq', 'user_id', 'user-1']],
    });
  });

  test('payouts not enabled is 400', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1', payouts_enabled: false };
    expect(await read(await node.payout(request({ amountCents: 500 })))).toEqual({
      status: 400,
      body: { status: 'error', message: 'Payouts are not enabled for this Stripe Express account yet.' },
    });
  });

  test('an enabled account is still blocked with 503 and no transfer', async () => {
    mockState.profile = { id: 'p1', stripe_connect_id: 'acct_1', payouts_enabled: true };
    expect(await read(await node.payout(request({ amountCents: 500 })))).toEqual({
      status: 503,
      body: {
        status: 'error',
        message:
          'Self-service payouts are temporarily disabled while balance verification is built. Contact an admin for a manual disbursement.',
      },
    });
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
  });

  test('without Stripe configured a small amount is 400', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(await read(await node.payout(request({ amountCents: 99 })))).toEqual({
      status: 400,
      body: { status: 'error', message: 'Payout amount must be at least $1.00.' },
    });
  });

  test('without Stripe configured a valid request is queued for an admin', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(await read(await node.payout(request({ amountCents: 1234, description: '  Rent  ' })))).toEqual({
      status: 200,
      body: { status: 'queued', message: 'Rent queued for admin disbursement ($12.34).' },
    });
    expect(await read(await node.payout(request({ amountCents: 100 })))).toEqual({
      status: 200,
      body: { status: 'queued', message: "Tapua'i payout queued for admin disbursement ($1.00)." },
    });
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
  });

  test('thrown errors are 400 in the payout shape', async () => {
    expect(await read(await node.payout(request(new SyntaxError('bad json'))))).toEqual({
      status: 400,
      body: { status: 'error', message: 'bad json' },
    });
    mockState.getUser.mockRejectedValue(new Error('auth down'));
    expect(await read(await node.payout(request({ amountCents: 500 })))).toEqual({
      status: 400,
      body: { status: 'error', message: 'auth down' },
    });
  });
});

// ------------------------------------------------------------------ local token check through the handlers (SCALE-04)

describe('local token verification through the handlers', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { generateKeyPairSync, sign } = require('node:crypto') as typeof import('node:crypto');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');
  const realFetch = globalThis.fetch;
  const jwksFetch = jest.fn(async (url: string) => ({
    ok: url.endsWith('/auth/v1/.well-known/jwks.json'),
    status: 200,
    json: async () => ({ keys: [{ ...keys.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256', use: 'sig' }] }),
  }));
  const tokenFor = (project: string, claims: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const input = `${b64(JSON.stringify({ alg: 'ES256', kid: 'k1', typ: 'JWT' }))}.${b64(
      JSON.stringify({ sub: 'local-user', aud: 'authenticated', iss: `${project}/auth/v1`, exp: now + 600, ...claims }),
    )}`;
    return `${input}.${b64(sign('sha256', Buffer.from(input), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }))}`;
  };
  const nodeProject = () => String(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const edgeProject = 'https://edge.example.test';

  beforeAll(() => {
    globalThis.fetch = jwksFetch as unknown as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  test.each([
    ['node', () => node.pi, nodeProject],
    ['edge', () => edge.pi, () => edgeProject],
  ])('checkout (%s) accepts a locally verified token without calling getUser', async (_runtime, handler, project) => {
    const result = await read(await handler()(request({ amount: 500 }, `Bearer ${tokenFor(project())}`)));
    expect(result).toEqual({ status: 200, body: { clientSecret: 'pi_secret_1' } });
    expect(mockState.getUser).not.toHaveBeenCalled();
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { tapuai_user_id: 'local-user' } }),
    );
    expect(jwksFetch).toHaveBeenCalledWith(`${project()}/auth/v1/.well-known/jwks.json`, expect.anything());
  });

  test.each([
    ['node', () => node.pi, nodeProject],
    ['edge', () => edge.pi, () => edgeProject],
  ])('checkout (%s) refuses a locally expired token with the same 401, without calling getUser', async (runtime, handler, project) => {
    const expired = tokenFor(project(), { exp: Math.floor(Date.now() / 1000) - 5 });
    expect(await read(await handler()(request({ amount: 500 }, `Bearer ${expired}`)))).toEqual({
      status: 401,
      body: { error: 'Invalid or expired session.' },
    });
    expect(mockState.getUser).not.toHaveBeenCalled();
    if (runtime === 'node') {
      expect(mockCapture).toHaveBeenCalledWith({ code: 'jwt_expired', source: 'local' }, process.env.EXPO_PUBLIC_SUPABASE_URL);
    }
  });

  test('a token from another project goes to the auth server, which refuses it', async () => {
    const foreign = tokenFor('https://other.example.test');
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'bad_jwt' } });
    expect((await node.pi(request({ amount: 500 }, `Bearer ${foreign}`))).status).toBe(401);
    expect(mockState.getUser).toHaveBeenCalledWith(foreign);
  });

  test.each([
    ['node connect', () => node.connect, nodeProject, { mode: 'status' }],
    ['edge connect', () => edge.connect, () => edgeProject, { mode: 'status' }],
    ['node payout', () => node.payout, nodeProject, { amountCents: 500 }],
  ])('%s ignores the local check and confirms the live session (signed out → 401)', async (label, handler, project, body) => {
    const jwt = tokenFor(project());
    mockState.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'session_not_found' } });
    const result = await read(await handler()(request(body, `Bearer ${jwt}`)));
    expect(result.status).toBe(401);
    expect(mockState.getUser).toHaveBeenCalledWith(jwt);
    expect(result.body).toEqual(
      label.includes('payout') ? { status: 'error', message: 'Invalid or expired session.' } : { error: 'Invalid or expired session.' },
    );
    expect(mockStripe.v2.core.accounts.retrieve).not.toHaveBeenCalled();
    expect(mockStripe.transfers.create).not.toHaveBeenCalled();
  });
});
