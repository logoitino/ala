import { featuredRivalryGame, isRivalryGame } from '@/data/regions';

const game = (home: string, away: string, active = true) => ({
  id: `${home}-${away}`,
  home_team: home,
  away_team: away,
  home_school: home,
  away_school: away,
  venue: '',
  is_active: active,
});

describe('local rivalry rules', () => {
  it('uses the same rivalry pairs for Local and the Home takeover', () => {
    const rivalry = game('Westlake', 'Lone Peak');
    expect(isRivalryGame(rivalry)).toBe(true);
    expect(featuredRivalryGame([game('Davis', 'Farmington'), rivalry])).toBe(rivalry);
  });

  it('does not feature an inactive or ordinary matchup', () => {
    expect(featuredRivalryGame([
      game('Westlake', 'Lone Peak', false),
      game('Davis', 'Farmington'),
    ])).toBeNull();
  });
});
