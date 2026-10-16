/**
 * DETECT-02 client capture tests: queues and traffic stay bounded, missing sensors are
 * explicit, payloads contain fixed codes only, and recovery never repeats writes or access.
 */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
import { SupportSignalManager } from '@/services/SupportSignalManager';

const setup = (patch: Record<string, unknown> = {}) => {
  const sent: unknown[] = [];
  const manager = new SupportSignalManager({ send: async (args) => { sent.push(args); return { error: null }; }, configured: () => true, now: () => 1_800_000_000_000, ...patch });
  manager.configure({ enabled: true, environment: 'test', release: 'detect-02' });
  return { manager, sent };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('bounded safe capture', () => {
  it('starts disabled and only sends the four allowlisted RPC fields', async () => {
    const sent: unknown[] = [];
    const manager = new SupportSignalManager({ send: async (args) => { sent.push(args); return { error: null }; }, configured: () => true });
    expect(manager.capture({ feature: 'highlights', code: 'render_failure' })).toBe(false);
    expect(manager.getStatus().phase).toBe('disabled');
    manager.configure({ enabled: true, environment: 'test', release: 'detect-02' });
    manager.capture({ feature: 'highlights', code: 'render_failure', message: 'private', stack: 'private', token: 'private', payment: 'private' } as never);
    await manager.flush();
    expect(sent).toEqual([{ p_feature: 'highlights', p_code: 'render_failure', p_environment: 'test', p_release: 'detect-02' }]);
    manager.dispose();
  });
  it('rejects arbitrary scope and trusted-only codes before they enter the queue', async () => {
    const { manager, sent } = setup();
    expect(manager.capture({ feature: '/private-user', code: 'render_failure' } as never)).toBe(false);
    expect(manager.capture({ feature: 'auth', code: 'confirmed_attack' } as never)).toBe(false);
    expect(manager.configure({ enabled: true, environment: 'test', release: 'private:token' })).toBe(false);
    await manager.flush();
    expect(sent).toEqual([]);
    expect(manager.getStatus().phase).toBe('invalid_configuration');
    manager.dispose();
  });
  it('bounds queue depth and the capture rate without deduplicating occurrence evidence', async () => {
    const { manager, sent } = setup({ maxQueue: 3, maxPerMinute: 5 });
    for (let i = 0; i < 12; i++) manager.capture({ feature: 'highlights', code: 'render_failure' });
    expect(manager.getStatus()).toMatchObject({ queued: 3, dropped: 9 });
    await manager.flush();
    expect(sent).toHaveLength(3);
    expect(manager.capture({ feature: 'highlights', code: 'render_failure' })).toBe(false);
    expect(manager.getStatus().lastFailure).toBe('rate_limited');
    manager.dispose();
  });
  it('keeps captures made during a pending flush bounded and preserves each accepted occurrence', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const sent: unknown[] = [];
    const { manager } = setup({ maxQueue: 2, maxPerMinute: 10, send: async (args: unknown) => { sent.push(args); await pending; return { error: null }; } });
    manager.capture({ feature: 'highlights', code: 'render_failure' });
    const flush = manager.flush();
    for (let i = 0; i < 5; i++) manager.capture({ feature: 'profile', code: 'render_failure' });
    expect(manager.getStatus()).toMatchObject({ queued: 2, dropped: 3 });
    await manager.flush();
    release(); await flush;
    expect(manager.getStatus().queued).toBe(2);
    await manager.flush();
    expect(sent).toHaveLength(3);
    manager.dispose();
  });
  it('records missing migration and delivery loss explicitly without endlessly replaying capture writes', async () => {
    const { manager } = setup({ send: async () => ({ error: { code: 'PGRST202', message: 'private backend detail' } }) });
    manager.capture({ feature: 'highlights', code: 'render_failure' });
    await manager.flush();
    expect(manager.getStatus()).toMatchObject({ phase: 'migration_missing', queued: 0, dropped: 1, delivered: 0, lastFailure: 'migration_missing' });
    expect(manager.capture({ feature: 'highlights', code: 'render_failure' })).toBe(false);
    expect(JSON.stringify(manager.getStatus())).not.toContain('private');
    manager.dispose();
  });
  it('does not silently discard unconfigured capture as healthy', async () => {
    const { manager, sent } = setup({ configured: () => false });
    manager.capture({ feature: 'highlights', code: 'render_failure' });
    await manager.flush();
    expect(sent).toEqual([]);
    expect(manager.getStatus()).toMatchObject({ phase: 'not_configured', queued: 0, delivered: 0 });
    manager.dispose();
  });
  it('drops an uncertain failed capture rather than duplicating an RPC that may have committed', async () => {
    let attempts = 0;
    const { manager } = setup({ send: async () => { attempts++; throw { code: 'ETIMEDOUT', message: 'private' }; } });
    manager.capture({ feature: 'highlights', code: 'render_failure' });
    await manager.flush(); await manager.flush();
    expect(attempts).toBe(1);
    expect(manager.getStatus()).toMatchObject({ phase: 'delivery_failed', dropped: 1, lastFailure: 'delivery_failed' });
    manager.dispose();
  });
  it('resets account/release capture context without delivering stale queued evidence', async () => {
    const { manager, sent } = setup();
    manager.capture({ feature: 'profile', code: 'runtime_failure' });
    manager.configure({ enabled: false, environment: 'test', release: 'detect-02' });
    manager.configure({ enabled: true, environment: 'test', release: 'next' });
    await manager.flush();
    expect(sent).toEqual([]);
    expect(manager.getStatus().phase).toBe('ready');
    manager.dispose();
  });
  it('bounds delivery wait and reports failure while the sensor request remains unresolved', async () => {
    const { manager } = setup({ send: async () => new Promise(() => undefined), sendTimeoutMs: 1000 });
    manager.capture({ feature: 'highlights', code: 'render_failure' });
    const flush = manager.flush();
    await jest.advanceTimersByTimeAsync(1000); await flush;
    expect(manager.getStatus()).toMatchObject({ phase: 'delivery_failed', queued: 0, dropped: 1 });
    manager.dispose();
  });
  it('pins the first batch to its captured token and stops remaining old-account writes after context changes', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const deliveries: { code: string; token: unknown }[] = [];
    const { manager } = setup({ send: async (args: { p_code: string }, token: unknown) => { deliveries.push({ code: args.p_code, token }); await pending; return { error: null }; } });
    manager.configure({ enabled: true, environment: 'test', release: 'detect-02', accessToken: 'old-token' });
    manager.capture({ feature: 'profile', code: 'runtime_failure' });
    manager.capture({ feature: 'profile', code: 'render_failure' });
    const flush = manager.flush();
    manager.configure({ enabled: false, environment: 'test', release: 'detect-02' });
    manager.configure({ enabled: true, environment: 'test', release: 'detect-02', accessToken: 'new-token' });
    manager.capture({ feature: 'profile', code: 'user_report' });
    release(); await flush; await manager.flush();
    expect(deliveries).toEqual([{ code: 'runtime_failure', token: 'old-token' }, { code: 'user_report', token: 'new-token' }]);
    expect(JSON.stringify(manager.getStatus())).not.toMatch(/old-token|new-token/);
    manager.dispose();
  });
  it('requires captured authorization for the default RPC sender and keeps it outside the signal payload', async () => {
    const headers: unknown[] = [];
    mockRpc.mockImplementation(() => ({ setHeader: (name: string, value: string) => { headers.push([name, value]); return Promise.resolve({ error: null }); } }));
    const manager = new SupportSignalManager({ configured: () => true });
    expect(manager.configure({ enabled: true, environment: 'test', release: 'detect-02' })).toBe(false);
    expect(manager.getStatus().phase).toBe('invalid_configuration');
    expect(manager.configure({ enabled: true, environment: 'test', release: 'detect-02', accessToken: 'captured-token' })).toBe(true);
    manager.capture({ feature: 'profile', code: 'runtime_failure' }); await manager.flush();
    expect(headers).toEqual([['Authorization', 'Bearer captured-token']]);
    const call = mockRpc.mock.calls[mockRpc.mock.calls.length - 1];
    expect(JSON.stringify(call)).not.toContain('captured-token');
    expect(JSON.stringify(manager.getStatus())).not.toContain('captured-token');
    manager.dispose();
  });
});

describe('read recovery', () => {
  it('recognizes the Supabase offline error shape and retries a retained safe read once', async () => {
    const { manager, sent } = setup(); let attempts = 0;
    const sdkError = { status: 0, code: '', message: 'TypeError: Network request failed; private request detail' };
    const result = await manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => {
      if (++attempts === 1) throw sdkError;
      return ['reconnected'];
    });
    expect(result).toEqual(['reconnected']); expect(attempts).toBe(2);
    await manager.flush();
    expect(sent).toEqual(expect.arrayContaining([expect.objectContaining({ p_code: 'network_unavailable' }), expect.objectContaining({ p_code: 'recovery_succeeded' })]));
    expect(JSON.stringify(sent)).not.toContain('private');
    manager.dispose();
  });
  it('keeps an SDK-shaped status-zero cancellation expected and does not retry it', async () => {
    const { manager, sent } = setup(); let attempts = 0;
    const sdkError = { status: 0, code: '', name: 'AbortError', message: 'AbortError: private request detail' };
    await expect(manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => { attempts++; throw sdkError; })).rejects.toBe(sdkError);
    expect(attempts).toBe(1); await manager.flush();
    expect(sent).toEqual([expect.objectContaining({ p_code: 'user_cancelled' })]);
    expect(JSON.stringify(sent)).not.toContain('private');
    manager.dispose();
  });
  it('does not retry a transient read while capture is disabled', async () => {
    const { manager } = setup(); let attempts = 0;
    manager.dispose();
    await expect(manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => { attempts++; throw { code: 'ETIMEDOUT' }; })).rejects.toEqual({ code: 'ETIMEDOUT' });
    expect(attempts).toBe(1);
  });
  it('does not retry or attach an old read failure to a replacement account context', async () => {
    const { manager, sent } = setup(); let attempts = 0;
    await expect(manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => {
      attempts++;
      manager.configure({ enabled: true, environment: 'test', release: 'replacement-account', accessToken: 'replacement-token' });
      throw { code: 'ETIMEDOUT' };
    })).rejects.toEqual({ code: 'ETIMEDOUT' });
    expect(attempts).toBe(1);
    await manager.flush(); expect(sent).toEqual([]);
    manager.dispose();
  });
  it.each([{ maxPerMinute: 1 }, { maxQueue: 1 }])('does not retry without retained failure evidence when capture bounds are exhausted: %s', async (bounds) => {
    const { manager } = setup(bounds); let attempts = 0;
    manager.capture({ feature: 'profile', code: 'render_failure' });
    await expect(manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => { attempts++; throw { code: 'ETIMEDOUT' }; })).rejects.toEqual({ code: 'ETIMEDOUT' });
    expect(attempts).toBe(1); expect(manager.getStatus().dropped).toBe(1);
    manager.dispose();
  });
  it.each(['PGRST202', '42501'])('does not retry when missing migration or permission has disabled sensor delivery: %s', async (code) => {
    const { manager } = setup({ send: async () => ({ error: { code } }) }); let attempts = 0;
    manager.capture({ feature: 'profile', code: 'render_failure' }); await manager.flush();
    await expect(manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => { attempts++; throw { code: 'ETIMEDOUT' }; })).rejects.toEqual({ code: 'ETIMEDOUT' });
    expect(attempts).toBe(1); manager.dispose();
  });
  it('does not retry when configuration becomes unavailable while the original read is running', async () => {
    let configured = true;
    const { manager } = setup({ configured: () => configured }); let attempts = 0;
    await expect(manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => { configured = false; attempts++; throw { code: 'ETIMEDOUT' }; })).rejects.toEqual({ code: 'ETIMEDOUT' });
    expect(attempts).toBe(1); manager.dispose();
  });
  it('retries a transient read once and captures verified recovery', async () => {
    const { manager, sent } = setup(); let attempts = 0;
    const result = await manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => {
      if (++attempts === 1) throw { code: 'ETIMEDOUT', message: 'private request body' };
      return ['safe result'];
    });
    expect(result).toEqual(['safe result']); expect(attempts).toBe(2);
    await manager.flush();
    expect(sent).toEqual(expect.arrayContaining([expect.objectContaining({ p_code: 'read_timeout' }), expect.objectContaining({ p_code: 'recovery_succeeded' })]));
    expect(JSON.stringify(sent)).not.toContain('private');
    manager.dispose();
  });
  it('stops after one failed retry and propagates the original failure to its caller', async () => {
    const { manager, sent } = setup(); const error = { code: 'NETWORK_ERROR' }; let attempts = 0;
    await expect(manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => { attempts++; throw error; })).rejects.toBe(error);
    expect(attempts).toBe(2);
    await manager.flush();
    expect(sent).toEqual(expect.arrayContaining([expect.objectContaining({ p_code: 'recovery_failed' })]));
    manager.dispose();
  });
  it.each([{ name: 'AbortError' }, { status: 401 }, { status: 403 }, { status: 0, code: '42501' }, { status: 0, code: 'AUTH_EXPIRED' }, new TypeError('invalid application state')])('does not retry cancellation, sign-in or ordinary bugs: %#', async (error) => {
    const { manager } = setup(); let attempts = 0;
    await expect(manager.runWithRecovery({ feature: 'highlights', category: 'network', operation: 'read' }, async () => { attempts++; throw error; })).rejects.toBe(error);
    expect(attempts).toBe(1); manager.dispose();
  });
  it.each([{ feature: 'donation', category: 'finance', operation: 'read' }, { feature: 'auth', category: 'network', operation: 'read' }, { feature: 'highlights', category: 'security', operation: 'read' }, { feature: 'highlights', category: 'network', operation: 'publish' }, { feature: 'donation', category: 'finance', operation: 'payment' }] as const)('never repeats protected work: %s', async (scope) => {
    const { manager } = setup(); let attempts = 0;
    await expect(manager.runWithRecovery(scope, async () => { attempts++; throw { code: 'ETIMEDOUT' }; })).rejects.toEqual({ code: 'ETIMEDOUT' });
    expect(attempts).toBe(1); manager.dispose();
  });
});
