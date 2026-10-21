/**
 * Smoothness rows keep their shape and guards: screen mounts carry their surface, app start carries
 * only a duration, empty surfaces never queue. Synthetic manager + in-memory HTTP transport.
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

import { TelemetryManager } from '@/services/TelemetryManager';

const success = () => new Response(null, { status: 201 });

let manager: TelemetryManager;
let sent: unknown[][];
beforeEach(() => {
  jest.useFakeTimers();
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

async function flushed(): Promise<Record<string, unknown>[]> {
  await manager.flush();
  return sent.flat() as Record<string, unknown>[];
}

describe('smoothness rows', () => {
  it('sends a screen_mount row with the surface and rounded latency', async () => {
    manager.trackScreenMount('home', 12.7);
    expect(await flushed()).toEqual([
      expect.objectContaining({ event_type: 'screen_mount', channel: 'home', duration_ms: 13, payload: {} }),
    ]);
  });

  it('sends an app_start row with only a duration', async () => {
    manager.trackAppStart(1500);
    expect(await flushed()).toEqual([
      expect.objectContaining({ event_type: 'app_start', channel: null, duration_ms: 1500, payload: {} }),
    ]);
  });

  it('drops blank surfaces without queueing', async () => {
    manager.trackScreenMount('   ', 10);
    expect(await flushed()).toEqual([]);
    expect(manager.getHealth().accepted).toBe(0);
  });

  it('caps long surfaces and clamps bad durations at zero', async () => {
    manager.trackScreenMount(`  ${'s'.repeat(200)}  `, -5);
    manager.trackAppStart(NaN);
    expect(await flushed()).toEqual([
      expect.objectContaining({ event_type: 'screen_mount', channel: 's'.repeat(160), duration_ms: 0 }),
      expect.objectContaining({ event_type: 'app_start', duration_ms: 0 }),
    ]);
  });
});
