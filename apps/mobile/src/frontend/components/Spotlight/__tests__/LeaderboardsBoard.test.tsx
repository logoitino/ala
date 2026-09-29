import { fireEvent, render, screen } from '@testing-library/react-native';

import { LeaderboardsBoard } from '@/components/Spotlight/LeaderboardsBoard';
import type { Leaderboards } from '@/lib/leaderboards';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false }),
}));

const BOARDS: Leaderboards = {
  periodKind: 'week',
  startDate: '2026-09-28',
  endDate: '2026-10-04',
  playersHype: [{
    rank: 1,
    playerId: 'player-1',
    name: 'Kaleo',
    schoolName: 'Westlake',
    hype: 12,
    views: 40,
    seki: 5,
    aura: 4,
    flex: 3,
  }],
  playersViews: [],
  highlights: [],
  schools: [],
  fans: [],
  filmers: [],
};

describe('LeaderboardsBoard', () => {
  it('opens an athlete from a board row', async () => {
    const onOpenAthlete = jest.fn();
    await render(
      <LeaderboardsBoard
        boards={BOARDS}
        loading={false}
        error={null}
        onRetry={jest.fn()}
        onOpenAthlete={onOpenAthlete}
      />,
    );
    fireEvent.press(screen.getByText('Kaleo'));
    expect(onOpenAthlete).toHaveBeenCalledWith('player-1');
  });

  it('shows a retry instead of an empty board after a load failure', async () => {
    const onRetry = jest.fn();
    await render(
      <LeaderboardsBoard
        boards={null}
        loading={false}
        error="Boards unavailable"
        onRetry={onRetry}
        onOpenAthlete={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
