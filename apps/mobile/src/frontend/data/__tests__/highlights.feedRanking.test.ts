/**
 * FEED-01 interest-feed ranking: picks, Crew, money-never-ranks, personalization off,
 * diversity (Phase 3 behind flag), determinism.
 */
import {
  applyFeedDiversity,
  feedImplicitSignalsEnabled,
  pinFeedOrder,
  rankHomeFeed,
  whyThisClipLine,
  type HighlightClip,
  type HomeFeedContext,
  type UserFeedPrefs,
} from '@/data/highlights';

type Row = {
  clip: HighlightClip;
  player: { id?: string; school_name?: string; name?: string } | null;
};

function clip(partial: Partial<HighlightClip> & Pick<HighlightClip, 'id'>): HighlightClip {
  return {
    id: partial.id,
    athleteName: partial.athleteName ?? partial.id,
    school: partial.school ?? '',
    tag: partial.tag ?? '',
    videoUrl: partial.videoUrl ?? '',
    sekiCount: partial.sekiCount ?? 0,
    auraCount: partial.auraCount ?? 0,
    flexCount: partial.flexCount ?? 0,
    totalTipsCents: partial.totalTipsCents ?? 0,
    viewCount: partial.viewCount ?? 0,
    createdAt: partial.createdAt,
    sport: partial.sport,
    category: partial.category ?? 'game_play',
    playerId: partial.playerId,
    sekiPlay: partial.sekiPlay,
    flashUnlockUntil: partial.flashUnlockUntil,
  } as HighlightClip;
}

function row(
  id: string,
  opts: {
    athlete?: string;
    school?: string;
    sport?: string;
    category?: HighlightClip['category'];
    createdAt?: string;
    seki?: number;
    tips?: number;
    name?: string;
  } = {},
): Row {
  const athlete = opts.athlete ?? id;
  return {
    clip: clip({
      id,
      athleteName: opts.name ?? athlete,
      playerId: athlete,
      school: opts.school ?? '',
      sport: opts.sport,
      category: opts.category ?? 'game_play',
      createdAt: opts.createdAt,
      sekiCount: opts.seki ?? 0,
      totalTipsCents: opts.tips ?? 0,
    }),
    player: { id: athlete, school_name: opts.school, name: opts.name ?? athlete },
  };
}

const NOW = Date.parse('2026-11-14T12:00:00.000Z');
const HOUR = 3_600_000;

describe('FEED-01 rankHomeFeed interest picks', () => {
  const prefs: UserFeedPrefs = {
    sports: ['Football'],
    schools: ['East High'],
    categoryPref: 'train_like_me',
    personalizationOn: true,
  };

  it('picks beat bare recency when personalization is on', () => {
    const freshOther = row('fresh', {
      athlete: 'a1',
      sport: 'Soccer',
      school: 'West',
      createdAt: new Date(NOW - 1 * HOUR).toISOString(),
    });
    const olderPick = row('pick', {
      athlete: 'a2',
      sport: 'Football',
      school: 'North',
      createdAt: new Date(NOW - 40 * HOUR).toISOString(),
    });
    const order = rankHomeFeed([freshOther, olderPick], {
      crewIds: new Set(),
      prefs,
      nowMs: NOW,
    }).map((item) => item.clip.id);
    expect(order[0]).toBe('pick');
  });

  it('Crew still outranks sport picks', () => {
    const crew = row('crew', {
      athlete: 'jordan',
      sport: 'Soccer',
      createdAt: new Date(NOW - 30 * HOUR).toISOString(),
      name: 'Jordan',
    });
    const picked = row('picked', {
      athlete: 'other',
      sport: 'Football',
      createdAt: new Date(NOW - 1 * HOUR).toISOString(),
    });
    const order = rankHomeFeed([picked, crew], {
      crewIds: new Set(['jordan']),
      prefs,
      nowMs: NOW,
    }).map((item) => item.clip.id);
    expect(order[0]).toBe('crew');
  });

  it('money amounts never change order', () => {
    const base = [
      row('a', { athlete: 'a', sport: 'Football', createdAt: new Date(NOW - 2 * HOUR).toISOString(), tips: 0 }),
      row('b', { athlete: 'b', sport: 'Soccer', createdAt: new Date(NOW - 3 * HOUR).toISOString(), tips: 0 }),
      row('c', { athlete: 'c', sport: 'Football', createdAt: new Date(NOW - 4 * HOUR).toISOString(), tips: 0 }),
    ];
    const rich = base.map((item, index) =>
      row(item.clip.id, {
        athlete: item.player?.id,
        sport: item.clip.sport ?? undefined,
        createdAt: item.clip.createdAt,
        tips: (index + 1) * 50_000,
      }),
    );
    const context: HomeFeedContext = { crewIds: new Set(), prefs, nowMs: NOW };
    expect(rankHomeFeed(base, context).map((item) => item.clip.id)).toEqual(
      rankHomeFeed(rich, context).map((item) => item.clip.id),
    );
  });

  it('personalization off returns newest-first', () => {
    const older = row('old', {
      athlete: 'a',
      sport: 'Football',
      createdAt: new Date(NOW - 10 * HOUR).toISOString(),
    });
    const newer = row('new', {
      athlete: 'b',
      sport: 'Soccer',
      createdAt: new Date(NOW - 1 * HOUR).toISOString(),
    });
    const order = rankHomeFeed([older, newer], {
      crewIds: new Set(['a']),
      prefs: { ...prefs, personalizationOn: false },
      nowMs: NOW,
    }).map((item) => item.clip.id);
    expect(order).toEqual(['new', 'old']);
  });

  it('is deterministic for the same inputs', () => {
    const items = [
      row('a', { athlete: 'a', sport: 'Football', createdAt: new Date(NOW - 2 * HOUR).toISOString() }),
      row('b', { athlete: 'b', sport: 'Football', createdAt: new Date(NOW - 2 * HOUR).toISOString() }),
      row('c', { athlete: 'c', school: 'East High', createdAt: new Date(NOW - 5 * HOUR).toISOString() }),
    ];
    const context: HomeFeedContext = { crewIds: new Set(['a']), prefs, nowMs: NOW };
    const first = rankHomeFeed(items, context).map((item) => item.clip.id);
    const second = rankHomeFeed(items, context).map((item) => item.clip.id);
    expect(first).toEqual(second);
  });

  it('pinFeedOrder still keeps the clip under the finger after a hype change', () => {
    const before = [
      row('a', { athlete: 'a', seki: 4, createdAt: new Date(NOW - 2 * HOUR).toISOString() }),
      row('b', { athlete: 'b', seki: 2, createdAt: new Date(NOW - 3 * HOUR).toISOString() }),
    ];
    const order = rankHomeFeed(before, { crewIds: new Set(), prefs, nowMs: NOW }).map((item) => item.clip.id);
    const after = [
      row('a', { athlete: 'a', seki: 0, createdAt: new Date(NOW - 2 * HOUR).toISOString() }),
      row('b', { athlete: 'b', seki: 2, createdAt: new Date(NOW - 3 * HOUR).toISOString() }),
    ];
    expect(pinFeedOrder(order, after).map((item) => item.clip.id)).toEqual(order);
  });

  it('whyThisClipLine never includes a score number', () => {
    const line = whyThisClipLine(['crew', 'fresh'], { athleteName: 'Jordan' });
    expect(line).toBe('Because you follow Jordan • Fresh');
    expect(line).not.toMatch(/\d{2,}/);
  });
});

describe('FEED-01 Phase 3 diversity (flag gated)', () => {
  const original = process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS;

  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS;
    else process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS = original;
  });

  it('caps consecutive athletes and schools when the Phase 2 flag is on', () => {
    process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS = '1';
    expect(feedImplicitSignalsEnabled()).toBe(true);
    const items: Row[] = [];
    for (let i = 0; i < 30; i += 1) {
      // Spread athletes/schools so hard caps are satisfiable (homogeneous pools may still force a break).
      const athlete = `a${i % 8}`;
      const school = `s${i % 6}`;
      items.push(
        row(`c${i}`, {
          athlete,
          school,
          sport: 'Football',
          createdAt: new Date(NOW - i * HOUR).toISOString(),
        }),
      );
    }
    const ranked = rankHomeFeed(items, {
      crewIds: new Set(),
      prefs: {
        sports: ['Football'],
        schools: ['East High'],
        categoryPref: 'all',
        personalizationOn: true,
      },
      nowMs: NOW,
    });
    expect(ranked).toHaveLength(30);
    for (let i = 2; i < ranked.length; i += 1) {
      const a0 = ranked[i].player?.id;
      const a1 = ranked[i - 1].player?.id;
      const a2 = ranked[i - 2].player?.id;
      expect(!(a0 && a0 === a1 && a1 === a2)).toBe(true);
    }
    for (let i = 3; i < ranked.length; i += 1) {
      const s0 = (ranked[i].player?.school_name || '').toLowerCase();
      const s1 = (ranked[i - 1].player?.school_name || '').toLowerCase();
      const s2 = (ranked[i - 2].player?.school_name || '').toLowerCase();
      const s3 = (ranked[i - 3].player?.school_name || '').toLowerCase();
      expect(!(s0 && s0 === s1 && s1 === s2 && s2 === s3)).toBe(true);
    }
  });

  it('leaves order alone when the Phase 2 flag is off', () => {
    process.env.EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS = '0';
    const items = [
      row('a', { athlete: 'star', school: 'East High' }),
      row('b', { athlete: 'star', school: 'East High' }),
      row('c', { athlete: 'star', school: 'East High' }),
    ];
    const rankedOnly = items.map((item) => item);
    expect(applyFeedDiversity(rankedOnly, { crewIds: new Set() }).map((item) => item.clip.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
