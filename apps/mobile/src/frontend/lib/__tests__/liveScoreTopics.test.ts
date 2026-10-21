/**
 * SCALE-03 shared private Broadcast topics in `lib/liveGames`: one channel per topic however many scoreboards join,
 * `private: true` on every join, last status replayed to a late joiner, and `removeChannel` only when the last
 * listener leaves. Also the default-off switch. Mocked client; no socket.
 */
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  nextRealtimeTopic: (topic: string) => topic,
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

import { isLiveScoresBroadcastEnabled, subscribeScoreTopic } from '@/lib/liveGames';

type Captured = { onBroadcast?: (message: { event: string; payload: unknown }) => void; onStatus?: (s: string) => void };

type FakeChannel = { on: jest.Mock; subscribe: jest.Mock };

function fakeChannel(captured: Captured): FakeChannel {
  const channel: FakeChannel = {
    on: jest.fn((_type: string, _filter: unknown, cb: Captured['onBroadcast']) => {
      captured.onBroadcast = cb;
      return channel;
    }),
    subscribe: jest.fn((cb: Captured['onStatus']) => {
      captured.onStatus = cb;
      return channel;
    }),
  };
  return channel;
}

beforeEach(() => {
  mockChannel.mockReset();
  mockRemoveChannel.mockReset();
});

it('shares one private channel per topic and removes it after the last listener leaves', async () => {
  const captured: Captured = {};
  const channel = fakeChannel(captured);
  mockChannel.mockReturnValue(channel);
  const first = { onMessage: jest.fn(), onStatus: jest.fn() };
  const second = { onMessage: jest.fn(), onStatus: jest.fn() };

  const leaveFirst = subscribeScoreTopic('game_scores_g1', first);
  captured.onStatus?.('SUBSCRIBED');
  const leaveSecond = subscribeScoreTopic('game_scores_g1', second);
  await Promise.resolve();

  expect(mockChannel).toHaveBeenCalledTimes(1);
  expect(mockChannel).toHaveBeenCalledWith('game_scores_g1', { config: { private: true } });
  expect(second.onStatus).toHaveBeenCalledWith('SUBSCRIBED');

  captured.onBroadcast?.({ event: 'score', payload: { v: 1 } });
  expect(first.onMessage).toHaveBeenCalledWith('score', { v: 1 });
  expect(second.onMessage).toHaveBeenCalledWith('score', { v: 1 });

  leaveFirst();
  expect(mockRemoveChannel).not.toHaveBeenCalled();
  leaveSecond();
  expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  leaveSecond();
  expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
});

it('is off unless the build sets the switch to exactly "true"', () => {
  const before = process.env.EXPO_PUBLIC_LIVE_SCORES_BROADCAST;
  delete process.env.EXPO_PUBLIC_LIVE_SCORES_BROADCAST;
  expect(isLiveScoresBroadcastEnabled()).toBe(false);
  process.env.EXPO_PUBLIC_LIVE_SCORES_BROADCAST = '1';
  expect(isLiveScoresBroadcastEnabled()).toBe(false);
  process.env.EXPO_PUBLIC_LIVE_SCORES_BROADCAST = 'true';
  expect(isLiveScoresBroadcastEnabled()).toBe(true);
  if (before === undefined) delete process.env.EXPO_PUBLIC_LIVE_SCORES_BROADCAST;
  else process.env.EXPO_PUBLIC_LIVE_SCORES_BROADCAST = before;
});
