import {
  fetchLeaderboards,
  parseLeaderboards,
  recordReelView,
  resetReelViewSessionForTests,
} from '@/lib/leaderboards';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const PLAYER = '11111111-1111-4111-8111-111111111111';
const REEL = '22222222-2222-4222-8222-222222222222';
const REEL_2 = '33333333-3333-4333-8333-333333333333';

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockRpc.mockReset();
  resetReelViewSessionForTests();
});

describe('parseLeaderboards', () => {
  it('maps every board from the RPC payload', () => {
    const boards = parseLeaderboards({
      period_kind: 'week',
      start_date: '2026-09-28',
      end_date: '2026-10-04',
      players_hype: [
        { rank: 1, player_id: PLAYER, name: 'Malia T.', school_name: 'Kahuku', hype: 12, seki: 5, aura: 4, flex: 3, views: 40 },
      ],
      players_views: [{ rank: 1, player_id: PLAYER, name: 'Malia T.', school_name: 'Kahuku', views: 40, hype: 12 }],
      highlights: [
        { rank: 1, reel_id: REEL, title: 'Kill shot', category: 'game_play', player_id: PLAYER, name: 'Malia T.', school_name: 'Kahuku', views: 30, hype: 9 },
      ],
      schools: [{ rank: 1, school_name: 'Kahuku', hype: 12, highlights: 2, fans: 7, score: 67 }],
      fans: [{ rank: 1, profile_id: 'profile-1', name: 'auntie_s', avatar_url: '', hype_given: 8, clips_tagged: 1, score: 18 }],
    });
    expect(boards.periodKind).toBe('week');
    expect(boards.startDate).toBe('2026-09-28');
    expect(boards.playersHype[0]).toEqual({
      rank: 1, playerId: PLAYER, name: 'Malia T.', schoolName: 'Kahuku', hype: 12, views: 40, seki: 5, aura: 4, flex: 3,
    });
    expect(boards.playersViews[0].views).toBe(40);
    expect(boards.highlights[0]).toMatchObject({ reelId: REEL, title: 'Kill shot', views: 30 });
    expect(boards.schools[0]).toEqual({ rank: 1, schoolName: 'Kahuku', hype: 12, highlights: 2, fans: 7, score: 67 });
    expect(boards.fans[0]).toMatchObject({ name: 'auntie_s', avatarUrl: null, hypeGiven: 8, clipsTagged: 1, score: 18 });
  });

  it('drops malformed rows and never carries a money field', () => {
    const boards = parseLeaderboards({
      players_hype: [null, { player_id: 'not-a-uuid', hype: 3 }, { player_id: PLAYER, hype: '4', total_tips_cents: 9999 }],
      schools: [{ school_name: '  ', score: 5 }],
      highlights: 'nope',
    });
    expect(boards.playersHype).toHaveLength(1);
    expect(boards.playersHype[0]).toMatchObject({ rank: 1, hype: 4, name: 'Athlete' });
    expect(JSON.stringify(boards)).not.toMatch(/tips|cents|malo/i);
    expect(boards.schools).toEqual([]);
    expect(boards.highlights).toEqual([]);
  });

  it('returns empty boards for a null payload', () => {
    expect(parseLeaderboards(null, 'month')).toMatchObject({ periodKind: 'month', playersHype: [], fans: [] });
  });
});

describe('fetchLeaderboards', () => {
  it('asks for the weekly window by default', async () => {
    mockRpc.mockResolvedValue({ data: { period_kind: 'week', schools: [] }, error: null });
    const result = await fetchLeaderboards();
    expect(mockRpc).toHaveBeenCalledWith('get_leaderboards', { period_kind: 'week' });
    expect(result.status).toBe('ok');
  });

  it('degrades to unavailable when the RPC is not deployed', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.get_leaderboards in the schema cache' },
    });
    await expect(fetchLeaderboards('week')).resolves.toEqual({ status: 'unavailable' });
  });

  it('throws on any other failure so the screen can offer Retry', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
    await expect(fetchLeaderboards('week')).rejects.toThrow('statement timeout');
  });
});

describe('recordReelView', () => {
  it('sends once per reel per session', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    expect(recordReelView(REEL, true)).toBe(true);
    expect(recordReelView(REEL, true)).toBe(false);
    expect(recordReelView(REEL_2, true)).toBe(true);
    await flush();
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith('record_reel_view', { target_reel_id: REEL });
  });

  it('skips guests and seeded demo clips', () => {
    expect(recordReelView(REEL, false)).toBe(false);
    expect(recordReelView('seed-clip-1', true)).toBe(false);
    expect(recordReelView(null, true)).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('swallows failures and stops trying once the RPC is known to be missing', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42883', message: 'function does not exist' } });
    expect(recordReelView(REEL, true)).toBe(true);
    await flush();
    expect(recordReelView(REEL_2, true)).toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('never throws when the request rejects', async () => {
    mockRpc.mockRejectedValueOnce(new Error('offline'));
    expect(() => recordReelView(REEL, true)).not.toThrow();
    await flush();
  });
});
