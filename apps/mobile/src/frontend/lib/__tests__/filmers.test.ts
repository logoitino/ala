import { filmerTier, nextFilmerTierHint, parseFilmerStats, parseTopFilmers, type FilmerStats } from '@/lib/filmers';

const stats = (patch: Partial<FilmerStats> = {}): FilmerStats => ({
  clips: 0,
  views: 0,
  hype: 0,
  props: 0,
  auraEarned: 0,
  ...patch,
});

describe('filmer tiers', () => {
  it('has no tier before the first confirmed clip', () => {
    expect(filmerTier(stats())).toBeNull();
    expect(filmerTier(null)).toBeNull();
  });

  it('climbs on clips or on views', () => {
    expect(filmerTier(stats({ clips: 1 }))?.id).toBe('rookie');
    expect(filmerTier(stats({ clips: 5 }))?.id).toBe('sideline');
    expect(filmerTier(stats({ clips: 1, views: 1_000 }))?.id).toBe('sideline');
    expect(filmerTier(stats({ clips: 2, views: 12_000 }))?.id).toBe('pro');
    expect(filmerTier(stats({ clips: 100 }))?.id).toBe('legend');
  });

  it('says what the next tier needs, and nothing at the top', () => {
    expect(nextFilmerTierHint(stats({ clips: 2, views: 600 }))).toBe('3 more clips or 400 more views to Sideline Filmer');
    expect(nextFilmerTierHint(stats({ clips: 0 }))).toBe('1 more clip to Rookie Filmer');
    expect(nextFilmerTierHint(stats({ clips: 100, views: 100_000 }))).toBeNull();
  });
});

describe('parsing', () => {
  it('reads filmer_stats and clamps junk to zero', () => {
    expect(parseFilmerStats({ clips: 3, views: '120', hype: -4, props: 2, aura_earned: 21 })).toEqual({
      clips: 3,
      views: 120,
      hype: 0,
      props: 2,
      auraEarned: 21,
    });
    expect(parseFilmerStats(null)).toBeNull();
  });

  it('reads get_top_filmers and drops rows without a profile', () => {
    const rows = parseTopFilmers([
      { rank: 1, profile_id: 'a', name: 'hawksmom', views: 40, hype: 5, props: 2, clips: 3, score: 65 },
      { rank: 2, name: 'ghost' },
      'junk',
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ profileId: 'a', name: 'hawksmom', score: 65, avatarUrl: null });
    expect(parseTopFilmers(null)).toEqual([]);
  });
});
