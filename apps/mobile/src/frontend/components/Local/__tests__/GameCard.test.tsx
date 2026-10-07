/** Local scoreboard regressions: no invented live state, clock or zeroes; roster navigation stays intact. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GameCard } from '@/components/Local/GameCard';
import type { Game } from '@/types/database';

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
const recordedGame: Game = {
  id: 'scoreboard-game', home_team: 'North Valley Timberwolves', away_team: 'South Ridge Falcons',
  home_school: 'North Valley High School', away_school: 'South Ridge High School',
  home_score: 72, away_score: 68, sport: 'Basketball', status: 'live', quarter: 'Q4', clock: '1:09',
  venue: 'Community gym', is_active: true,
};

describe('GameCard scoreboard', () => {
  it('includes distinct school names in the spoken scoreboard identity', async () => {
    await render(<GameCard game={{ ...recordedGame, home_team: 'Falcons', away_team: 'Eagles' }} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Falcons, North Valley High School 72 against Eagles, South Ridge High School 68/ })).toBeTruthy();
  });
  it('ties each score to its team and opens the existing roster action', async () => {
    const onPress = jest.fn();
    await render(<GameCard game={recordedGame} onPress={onPress} />);
    expect(screen.getByText('Basketball')).toBeTruthy();
    expect(screen.getByText('Q4 · 1:09')).toBeTruthy();
    expect(screen.getByText('North Valley Timberwolves')).toBeTruthy();
    expect(screen.getByText('North Valley High School')).toBeTruthy();
    expect(screen.getByText('72')).toBeTruthy();
    expect(screen.getByText('68')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Basketball. Live, Q4 · 1:09.*North Valley Timberwolves, North Valley High School 72 against South Ridge Falcons, South Ridge High School 68/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('shows scheduled despite prefilled quarter, clock and zeroes', async () => {
    await render(<GameCard game={{ ...recordedGame, status: 'scheduled', home_score: 0, away_score: 0, is_clock_running: true }} onPress={jest.fn()} />);
    expect(screen.getByText('Scheduled')).toBeTruthy();
    expect(screen.getByText('Start time TBA')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByText('Q4 · 1:09')).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Scheduled.*score not reported/ })).toBeTruthy();
  });
  it('keeps final authoritative even when a stale clock is still running', async () => {
    await render(<GameCard game={{ ...recordedGame, status: 'Final', is_clock_running: true }} onPress={jest.fn()} />);
    expect(screen.getByText('Final')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByText('Q4 · 1:09')).toBeNull();
    expect(screen.getByText('72')).toBeTruthy();
  });
  it('reports a missing score honestly while preserving a recorded zero', async () => {
    const game = { ...recordedGame, home_score: undefined, away_score: 0, clock: null } as unknown as Game;
    await render(<GameCard game={game} onPress={jest.fn()} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('Q4')).toBeTruthy();
    expect(screen.queryByText(/4:15/)).toBeNull();
    expect(screen.getByRole('button', { name: /North Valley Timberwolves, North Valley High School score not reported against South Ridge Falcons, South Ridge High School 0/ })).toBeTruthy();
  });
  it('does not invent a quarter, live state, team or sport when information is absent', async () => {
    const game = { ...recordedGame, status: '', quarter: null, clock: null, home_team: ' ', home_school: 'North Valley High School', sport: null };
    await render(<GameCard game={game} onPress={jest.fn()} />);
    expect(screen.getByText('Status TBA')).toBeTruthy();
    expect(screen.getByText('North Valley High School')).toBeTruthy();
    expect(screen.getByText('Game day')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByText('Football')).toBeNull();
    expect(screen.queryByText(/4:15/)).toBeNull();
  });
  it('shows real untimed volleyball sets without adding a clock', async () => {
    await render(<GameCard game={{ ...recordedGame, sport: 'Volleyball', quarter: 'S2', clock: null, home_score: 23, away_score: 21 }} onPress={jest.fn()} />);
    expect(screen.getByText('S2')).toBeTruthy();
    expect(screen.getByText('Volleyball')).toBeTruthy();
    expect(screen.queryByText(/4:15/)).toBeNull();
  });
});
