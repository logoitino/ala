/**
 * HEALTH-01 delivery regressions run the real Supabase/PostgREST request builder against
 * an in-memory HTTP transport. They exercise loss, batching and uncertain commits without
 * contacting a project or collecting new telemetry fields.
 */
const mockFetch = jest.fn();
jest.mock('@/lib/supabase', () => {
  const { createClient } = jest.requireActual('@supabase/supabase-js');
  return {
    isSupabaseConfigured: true,
    supabase: createClient('https://telemetry.invalid', 'test-public-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (...args: unknown[]) => mockFetch(...args) },
    }),
  };
});

import { TelemetryManager, telemetry } from '@/services/TelemetryManager';

type SentRow = { event_type: string; duration_ms: number | null; payload: Record<string, unknown> };
type PendingReply = { resolve: (response: Response) => void; signal: AbortSignal | undefined };
const success = () => new Response(null, { status: 201 });
const failure = (code: string, message: string, status = 400) => new Response(JSON.stringify({ code, message, details: '', hint: '' }), { status });
const event = (manager: TelemetryManager, count = 1) => {
  for (let i = 0; i < count; i++) manager.track({ event_type: 'feature_tap', payload: { private: 'private-payload' } });
};

let manager: TelemetryManager;
let sent: SentRow[][];
beforeAll(() => telemetry.dispose());
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-13T20:00:00.000Z'));
  delete (globalThis as typeof globalThis & { __tapuaiTelemetryManager?: TelemetryManager }).__tapuaiTelemetryManager;
  manager = TelemetryManager.getInstance();
  sent = [];
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string));
    return success();
  });
});
afterEach(() => {
  manager.dispose();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('telemetry delivery loss and bounds', () => {
  it('does not replay a write after a server commit followed by a lost response', async () => {
    const committed: SentRow[] = [];
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      committed.push(...JSON.parse(init.body as string));
      throw new TypeError('response lost after commit; private detail');
    });
    event(manager);
    await manager.flush();
    await manager.flush();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(committed).toHaveLength(1);
  });

  it('never sends more than fifteen rows when events accumulate during delivery', async () => {
    let pending!: PendingReply;
    mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
      sent.push(JSON.parse(init.body as string));
      return new Promise<Response>((resolve) => { pending = { resolve, signal: init.signal ?? undefined }; });
    });
    event(manager, 15);
    await jest.advanceTimersByTimeAsync(0);
    event(manager, 200);
    pending.resolve(success());
    await jest.advanceTimersByTimeAsync(0);
    await manager.flush();
    expect(sent.map((batch) => batch.length)).toEqual([15, 15]);
  });

  it('records configuration loss instead of silently clearing events', async () => {
    jest.replaceProperty(jest.requireMock('@/lib/supabase'), 'isSupabaseConfigured', false);
    event(manager);
    await manager.flush();
    expect(manager.getHealth()).toMatchObject({ phase: 'not_configured', queued: 0, delivered: 0, dropped: 1, uncertain: 0, lastFailure: 'not_configured' });
    expect(sent).toEqual([]);
  });

  it.each([
    ['42501', 'permission denied for table telemetry_logs', 403, 'permission_denied'],
    ['23514', 'new row for relation telemetry_logs violates check constraint', 400, 'delivery_failed'],
    ['42703', 'column telemetry_logs.private_field does not exist', 400, 'delivery_failed'],
    ['PGRST200', 'relationship for telemetry_logs does not exist', 400, 'delivery_failed'],
    ['42P01', 'relation telemetry_logs does not exist', 404, 'migration_missing'],
    ['PGRST205', 'Could not find the table public.telemetry_logs in the schema cache', 404, 'migration_missing'],
  ])('classifies %s without treating every table-named error as missing', async (code, message, status, phase) => {
    mockFetch.mockImplementation(async () => failure(code as string, message as string, status as number));
    event(manager);
    await manager.flush();
    expect(manager.getHealth()).toMatchObject({ phase, dropped: 1, uncertain: 0, delivered: 0, lastDeliveredAt: null });
  });

  it('starts unknown and exposes a frozen snapshot without event or error details', async () => {
    expect(manager.getHealth()).toMatchObject({ phase: 'unknown', accepted: 0, delivered: 0, lastDeliveredAt: null, capacity: 120, batchSize: 15, timeoutMs: 10_000 });
    event(manager);
    await manager.flush();
    const snapshot = manager.getHealth();
    expect(snapshot).toMatchObject({ phase: 'delivered', accepted: 1, delivered: 1, queued: 0, inFlight: 0, dropped: 0, lastDeliveredAt: '2026-10-13T20:00:00.000Z' });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/private|payload|event_type/);
    event(manager);
    expect(snapshot.queued).toBe(0);
  });

  it('bounds queued plus pending rows and rejects overflow even while HTTP is hung', async () => {
    mockFetch.mockImplementation(() => new Promise<Response>(() => undefined));
    event(manager, 215);
    await jest.advanceTimersByTimeAsync(0);
    expect(manager.getHealth()).toMatchObject({ phase: 'sending', accepted: 120, queued: 105, inFlight: 15, dropped: 95 });
    event(manager, 30);
    expect(manager.getHealth()).toMatchObject({ accepted: 120, queued: 105, inFlight: 15, dropped: 125, lastFailure: 'queue_full' });
  });

  it('finishes flush at ten seconds, aborts, and holds the pending reservation until a late reply', async () => {
    let pending!: PendingReply;
    mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
      sent.push(JSON.parse(init.body as string));
      return new Promise<Response>((resolve) => { pending = { resolve, signal: init.signal ?? undefined }; });
    });
    manager.track({ event_type: 'old-attempt' });
    let finished = false;
    const flush = manager.flush().then(() => { finished = true; });
    await jest.advanceTimersByTimeAsync(0);
    event(manager, 200);
    await jest.advanceTimersByTimeAsync(9_999);
    expect(finished).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(finished).toBe(true);
    await flush;
    expect(pending.signal?.aborted).toBe(true);
    expect(manager.getHealth()).toMatchObject({ phase: 'delivery_uncertain', accepted: 120, queued: 119, inFlight: 1, delivered: 0, dropped: 82, uncertain: 1, lastFailure: 'timeout', lastFailureAt: '2026-10-13T20:00:10.000Z' });
    await jest.advanceTimersByTimeAsync(30_000);
    await manager.flush();
    expect(sent).toHaveLength(1);
    pending.resolve(success());
    await jest.advanceTimersByTimeAsync(0);
    expect(manager.getHealth()).toMatchObject({ phase: 'delivery_uncertain', inFlight: 0, delivered: 0, uncertain: 1 });
    await manager.flush();
    expect(sent[1]).toHaveLength(15);
    expect(sent[1].every((row) => row.event_type === 'feature_tap')).toBe(true);
    expect(manager.getHealth()).toMatchObject({ phase: 'delivered', delivered: 15, queued: 104, uncertain: 1, dropped: 82 });
  });

  it.each([503, 504])('counts HTTP %s as uncertain and never replays the attempted batch', async (status) => {
    mockFetch.mockImplementation(async () => failure('', 'private upstream response', status));
    event(manager);
    await manager.flush();
    await manager.flush();
    expect(manager.getHealth()).toMatchObject({ phase: 'delivery_uncertain', dropped: 1, uncertain: 1, queued: 0, delivered: 0, lastFailure: 'transport_error' });
  });

  it('retains last success and reports a later rejected delivery as failed', async () => {
    event(manager); await manager.flush();
    mockFetch.mockImplementation(async () => failure('23514', 'private row check detail'));
    await jest.advanceTimersByTimeAsync(1_000);
    event(manager); await manager.flush();
    expect(manager.getHealth()).toMatchObject({ phase: 'delivery_failed', accepted: 2, delivered: 1, dropped: 1, uncertain: 0, lastDeliveredAt: '2026-10-13T20:00:00.000Z', lastFailureAt: '2026-10-13T20:00:01.000Z' });
    expect(JSON.stringify(manager.getHealth())).not.toContain('private');
  });

  it('dispose aborts pending delivery, clears timers, counts loss and ignores late success', async () => {
    let pending!: PendingReply;
    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      sent.push(JSON.parse(init.body as string));
      return new Promise<Response>((resolve) => { pending = { resolve, signal: init.signal ?? undefined }; });
    });
    event(manager);
    let finished = false;
    const flush = manager.flush().then(() => { finished = true; });
    await jest.advanceTimersByTimeAsync(0);
    event(manager, 3);
    manager.dispose();
    await jest.advanceTimersByTimeAsync(0);
    expect(finished).toBe(true);
    await flush;
    expect(pending.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    expect(manager.getHealth()).toMatchObject({ phase: 'disposed', queued: 0, inFlight: 1, accepted: 4, delivered: 0, dropped: 4, uncertain: 1, lastFailure: 'disposed' });
    pending.resolve(success());
    await jest.advanceTimersByTimeAsync(0);
    await manager.flush();
    event(manager);
    expect(sent).toHaveLength(1);
    expect(manager.getHealth()).toMatchObject({ phase: 'disposed', inFlight: 0, accepted: 4, delivered: 0, dropped: 5, uncertain: 1 });
    manager.dispose();
    expect(manager.getHealth().dropped).toBe(5);
  });

  it('accounts every admitted row when disposal crosses response completion', async () => {
    for (let microtasks = 0; microtasks < 40; microtasks++) {
      manager.dispose();
      delete (globalThis as typeof globalThis & { __tapuaiTelemetryManager?: TelemetryManager }).__tapuaiTelemetryManager;
      manager = TelemetryManager.getInstance();
      event(manager);
      const flush = manager.flush();
      for (let tick = 0; tick < microtasks; tick++) await Promise.resolve();
      manager.dispose();
      await flush;
      const snapshot = manager.getHealth();
      expect({ microtasks, accounted: snapshot.delivered + snapshot.dropped }).toEqual({ microtasks, accounted: 1 });
    }
  });

  it('does not start replacement singleton writes while a disposed HTTP request remains unresolved', async () => {
    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      sent.push(JSON.parse(init.body as string));
      return new Promise<Response>(() => undefined);
    });
    event(manager, 15);
    await jest.advanceTimersByTimeAsync(0);
    manager.dispose();
    const singleton = TelemetryManager.getInstance();
    event(singleton, 15);
    await jest.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
    expect(singleton).toBe(manager);
    expect(singleton.getHealth()).toMatchObject({ phase: 'disposed', queued: 0, inFlight: 15, accepted: 15, dropped: 30, uncertain: 15 });
  });

  it('never counts an SDK status-zero response with an empty error as confirmed delivery', async () => {
    // Some transport adapters return an empty success-shaped response after cancellation.
    mockFetch.mockImplementation(async () => ({ ok: true, status: 0, statusText: '', text: async () => '', headers: new Headers() } as Response));
    event(manager); await manager.flush();
    expect(manager.getHealth()).toMatchObject({ phase: 'delivery_uncertain', delivered: 0, dropped: 1, uncertain: 1, lastFailure: 'transport_error' });
  });

  it('reports a thrown SDK boundary as uncertain without replaying or exposing its error', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase');
    jest.spyOn(supabase, 'from').mockImplementation(() => { throw new Error('private SDK adapter failure'); });
    event(manager); await manager.flush(); await manager.flush();
    expect(manager.getHealth()).toMatchObject({ phase: 'delivery_uncertain', queued: 0, inFlight: 0, delivered: 0, dropped: 1, uncertain: 1 });
    expect(JSON.stringify(manager.getHealth())).not.toContain('private');
  });

  it('keeps event helpers and singleton usage compatible', async () => {
    expect(TelemetryManager.getInstance()).toBe(manager);
    manager.trackVideoStall('clip', 49);
    manager.trackVideoStall('clip', 50.6);
    manager.trackCheckoutLatency('intent', -5);
    manager.trackTabDwell('home', 499);
    manager.trackTabDwell('home', 600);
    manager.trackScroll('home', 200);
    manager.trackFeature('search');
    manager.trackIssue('report');
    manager.trackSocketReconnect('live-game', 0);
    await manager.flush();
    expect(sent[0].map((row) => [row.event_type, row.duration_ms])).toEqual([
      ['video_stall', 51], ['checkout_latency', 0], ['tab_dwell', 600], ['surface_scroll', 100],
      ['feature_tap', null], ['ui_issue', null], ['socket_reconnect', null],
    ]);
  });
});
