/** NOTIFY-01: execute the actual Edge webhook with verified synthetic events and local DB/provider boundaries. */
type Handler = (request: Request) => Promise<Response>;
const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockVerify = jest.fn();
const mockRetrieveIntent = jest.fn();
const mockRetrieveCharge = jest.fn();
let handler: Handler;
let mockEnv: Record<string, string> = {};
jest.mock('https://esm.sh/@supabase/supabase-js@2.116.0', () => ({ createClient: () => ({
  rpc: (...args: unknown[]) => mockRpc(...args), from: () => ({ insert: (...args: unknown[]) => {
    mockInsert(...args); return { select: () => ({ maybeSingle: async () => ({ data: {}, error: null }) }), then: (resolve: Function) => resolve({ error: null }) };
  } }),
}) }), { virtual: true });
jest.mock('https://esm.sh/stripe@22.6.2?target=deno', () => {
  function Stripe() { return { webhooks: { constructEventAsync: (...args: unknown[]) => mockVerify(...args) },
    paymentIntents: { retrieve: (...args: unknown[]) => mockRetrieveIntent(...args) },
    charges: { retrieve: (...args: unknown[]) => mockRetrieveCharge(...args) } }; }
  Stripe.createFetchHttpClient = () => ({});
  return { __esModule: true, default: Stripe };
}, { virtual: true });

beforeAll(() => {
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (key: string) => mockEnv[key] },
    serve: (value: Handler) => { handler = value; } };
  require('../../../../../supabase/functions/stripe-webhook/index.ts');
});
afterAll(() => { delete (globalThis as unknown as { Deno?: unknown }).Deno; });
const metadata = { tapuai_user_id: 'fan', tip_player_id: 'athlete', tip_kind: 'malo', tip_aura_points: '50' };
const intent = { id: 'pi_local', amount: 650, amount_received: 650, currency: 'usd', livemode: false, metadata };
beforeEach(() => {
  jest.clearAllMocks();
  mockEnv = { STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: 'whsec_local',
    SUPABASE_URL: 'https://local.example.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' };
  mockVerify.mockResolvedValue({ id: 'evt_local', type: 'payment_intent.succeeded', livemode: false, data: { object: intent } });
  mockRpc.mockResolvedValue({ data: { status: 'source_unavailable', notification: 'unavailable' }, error: null });
});
async function invoke() {
  const result = await handler(new Request('https://local.example.test', { method: 'POST', headers: { 'Stripe-Signature': 'synthetic' }, body: 'raw-signed-body' }));
  return { status: result.status, body: await result.json() };
}
it('never enables legacy rich-metadata tips or Aura writes and reports missing donation authority', async () => {
  expect(await invoke()).toEqual({ status: 200, body: { received: true, notification: 'unavailable' } });
  expect(mockInsert).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalledWith('add_user_aura', expect.anything());
});
it('does not acknowledge a failed durable context observation as applied', async () => {
  mockVerify.mockResolvedValue({ id: 'evt_local', type: 'payment_intent.succeeded', livemode: false,
    data: { object: { ...intent, metadata: { tapuai_context_id: '00000000-0000-0000-0000-000000000003' } } } });
  mockRpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'private DB data' } });
  expect(await invoke()).toEqual({ status: 503, body: { error: 'Payment observation unavailable.' } });
  expect(mockInsert).not.toHaveBeenCalled();
});
it('rejects live provider events in the test-only payment environment', async () => {
  mockVerify.mockResolvedValue({ id: 'evt_local', type: 'payment_intent.succeeded', livemode: true, data: { object: { ...intent, livemode: true } } });
  expect((await invoke()).status).toBe(503);
  expect(mockRpc).not.toHaveBeenCalled();
});
it('binds a cumulative partial refund to its retrieved original intent without granting credits', async () => {
  mockVerify.mockResolvedValue({ id: 'evt_refund', type: 'charge.refunded', livemode: false,
    data: { object: { id: 'ch_local', payment_intent: 'pi_local', amount: 650, amount_refunded: 100, currency: 'usd', livemode: false } } });
  mockRetrieveIntent.mockResolvedValue({ ...intent, metadata: { tapuai_context_id: '00000000-0000-0000-0000-000000000003' } });
  expect((await invoke()).body).toEqual({ received: true, notification: 'unavailable' });
  expect(mockRpc).toHaveBeenCalledWith('apply_notification_payment_event', expect.objectContaining({
    provider_event_id: 'evt_refund', provider_intent_id: 'pi_local', observation_kind: 'refund', refunded_cents: 100, total_cents: 650,
  }));
  expect(mockInsert).not.toHaveBeenCalled();
});
it('rejects refund currency mismatches against the retrieved payment before a durable observation', async () => {
  mockVerify.mockResolvedValue({ id: 'evt_refund', type: 'charge.refunded', livemode: false,
    data: { object: { id: 'ch_local', payment_intent: 'pi_local', amount: 650, amount_refunded: 100, currency: 'eur', livemode: false } } });
  mockRetrieveIntent.mockResolvedValue(intent);
  expect((await invoke()).status).toBe(503);
  expect(mockRpc).not.toHaveBeenCalled();
});
it('does not treat an arbitrary RPC result as a committed observation', async () => {
  mockVerify.mockResolvedValue({ id: 'evt_local', type: 'payment_intent.succeeded', livemode: false,
    data: { object: { ...intent, metadata: { tapuai_context_id: '00000000-0000-0000-0000-000000000003' } } } });
  mockRpc.mockResolvedValue({ data: { status: 'applied' }, error: null });
  expect((await invoke()).status).toBe(503);
});
it('binds a dispute to the original charge/intent and never grants a fresh receipt', async () => {
  mockVerify.mockResolvedValue({ id: 'evt_dispute', type: 'charge.dispute.closed', livemode: false,
    data: { object: { id: 'dp_local', charge: 'ch_local', amount: 100, currency: 'usd', livemode: false } } });
  mockRetrieveCharge.mockResolvedValue({ id: 'ch_local', payment_intent: 'pi_local', amount: 650, currency: 'usd', livemode: false });
  mockRetrieveIntent.mockResolvedValue({ ...intent, metadata: { tapuai_context_id: '00000000-0000-0000-0000-000000000003' } });
  expect((await invoke()).body.notification).toBe('unavailable');
  expect(mockRpc).toHaveBeenCalledWith('apply_notification_payment_event', expect.objectContaining({ observation_kind: 'dispute', refunded_cents: 0 }));
  expect(mockInsert).not.toHaveBeenCalled();
});
it('rejects a dispute larger than its original charge', async () => {
  mockVerify.mockResolvedValue({ id: 'evt_dispute', type: 'charge.dispute.created', livemode: false,
    data: { object: { id: 'dp_local', charge: 'ch_local', amount: 700, currency: 'usd', livemode: false } } });
  mockRetrieveCharge.mockResolvedValue({ id: 'ch_local', payment_intent: 'pi_local', amount: 650, currency: 'usd', livemode: false });
  mockRetrieveIntent.mockResolvedValue(intent);
  expect((await invoke()).status).toBe(503);
  expect(mockRpc).not.toHaveBeenCalled();
});
