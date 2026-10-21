/**
 * Trivia funnel rows keep their shape, drop unknown actions, and sanitize kind/counts/text.
 * Synthetic manager + in-memory HTTP transport; no project contact.
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

describe('trivia funnel rows', () => {
  it('sends a start row as feature_tap with kind, mode, topic, learn and rounded latency', async () => {
    manager.trackTriviaStep('start', { kind: 'personal', mode: 'round', topic: 'sport', learn: true, durationMs: 123.6 });
    expect(await flushed()).toEqual([
      expect.objectContaining({
        event_type: 'feature_tap',
        channel: 'sport-quiz',
        step: 'trivia.start',
        duration_ms: 124,
        payload: { kind: 'personal', mode: 'round', topic: 'sport', learn: true },
      }),
    ]);
  });

  it('sends a completion row with counts, outcome and no duration', async () => {
    manager.trackTriviaStep('complete', { kind: 'group', answered: 5, planned: 5, outcome: 'completed' });
    expect(await flushed()).toEqual([
      expect.objectContaining({
        event_type: 'feature_tap',
        channel: 'sport-quiz',
        step: 'trivia.complete',
        duration_ms: null,
        payload: { kind: 'group', answered: 5, planned: 5, outcome: 'completed' },
      }),
    ]);
  });

  it('sends funnel-top view and press rows with kind and topic', async () => {
    manager.trackTriviaStep('view_prep', { kind: 'group' });
    manager.trackTriviaStep('press_start', { kind: 'personal', topic: 'sport' });
    expect(await flushed()).toEqual([
      expect.objectContaining({ event_type: 'feature_tap', channel: 'sport-quiz', step: 'trivia.view_prep', payload: { kind: 'group' } }),
      expect.objectContaining({ event_type: 'feature_tap', channel: 'sport-quiz', step: 'trivia.press_start', payload: { kind: 'personal', topic: 'sport' } }),
    ]);
  });

  it('drops unknown actions without queueing', async () => {
    manager.trackTriviaStep('frobnicate', { kind: 'personal' });
    expect(await flushed()).toEqual([]);
    expect(manager.getHealth().accepted).toBe(0);
  });

  it('omits unknown kinds but keeps the step', async () => {
    manager.trackTriviaStep('answer', { kind: 'bogus', position: 2 });
    expect(await flushed()).toEqual([
      expect.objectContaining({ step: 'trivia.answer', payload: { position: 2 } }),
    ]);
  });

  it('rounds positions and clamps negative counts at zero', async () => {
    manager.trackTriviaStep('answer', { kind: 'personal', position: 2.7 });
    manager.trackTriviaStep('next', { kind: 'personal', position: -5 });
    expect(await flushed()).toEqual([
      expect.objectContaining({ step: 'trivia.answer', payload: { kind: 'personal', position: 3 } }),
      expect.objectContaining({ step: 'trivia.next', payload: { kind: 'personal', position: 0 } }),
    ]);
  });

  it('caps free text at eighty characters and omits a false learn flag', async () => {
    manager.trackTriviaStep('abandon', { kind: 'life', chapter: 'x'.repeat(200), learn: false, reason: 'left_page', answered: 1, planned: 5 });
    expect(await flushed()).toEqual([
      expect.objectContaining({
        step: 'trivia.abandon',
        payload: { kind: 'life', chapter: 'x'.repeat(80), reason: 'left_page', answered: 1, planned: 5 },
      }),
    ]);
  });
});
