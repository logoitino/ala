const getSession = jest.fn();
const insert = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: () => getSession() },
    from: () => ({ insert: (...args: unknown[]) => insert(...args) }),
  },
}));

import { telemetry } from '@/services/TelemetryManager';

/**
 * @purpose Guest analytics stay on the device until a session exists, matching the insert guard.
 */
describe('TelemetryManager flush', () => {
  beforeEach(() => {
    getSession.mockReset();
    insert.mockReset();
    const bag = globalThis as typeof globalThis & { __tapuaiTelemetryQueue?: undefined };
    // Reach the private queue through a flush that no-ops, then overwrite via track after clearing.
    void bag;
  });

  it('holds events until a session exists, then inserts once', async () => {
    const manager = telemetry as unknown as { queue: unknown[] };
    manager.queue = [];

    getSession.mockResolvedValue({ data: { session: null } });
    telemetry.trackFeature('rally_donate', 'highlight');
    await telemetry.flush();
    expect(insert).not.toHaveBeenCalled();
    expect(manager.queue).toHaveLength(1);

    getSession.mockResolvedValue({ data: { session: { user: { id: 'fan-1' } } } });
    insert.mockResolvedValue({ error: null });
    await telemetry.flush();
    expect(insert).toHaveBeenCalledTimes(1);
    const batch = insert.mock.calls[0][0] as { event_type: string; step: string }[];
    expect(batch[0]).toMatchObject({ event_type: 'feature_tap', step: 'rally_donate', channel: 'highlight' });
    expect(manager.queue).toHaveLength(0);
  });
});
