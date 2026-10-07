/** Stats labels/measurables follow the recorded sport, while missing totals remain visibly unavailable. */
import { render, screen } from '@testing-library/react-native';
import { AthleteStatsTab } from '@/components/Profile/AthleteStatsTab';
import { applyAthleteStatsPlaybook, emptyAthleteStats } from '@/data/athleteStats';
import { SPORT_CONFIG_SEEDS } from '@/data/sports';

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));
const volleyball = SPORT_CONFIG_SEEDS.find((row) => row.sport === 'Volleyball')!;
const football = SPORT_CONFIG_SEEDS.find((row) => row.sport === 'Football')!;

it('rejects a football playbook for volleyball values and hides football combine fields', async () => {
  const stats = emptyAthleteStats(null, 'Volleyball');
  stats.career.scoringValue = 0;
  stats.career.volumeValue = 7;
  await render(<AthleteStatsTab stats={stats} config={football} />);
  expect(screen.getByText('Kills')).toBeTruthy();
  expect(screen.getByText('Digs')).toBeTruthy();
  expect(screen.queryByText('Yards')).toBeNull();
  expect(screen.queryByText('40-Yard Dash')).toBeNull();
  expect(screen.queryByText('Weight')).toBeNull();
  expect(screen.getByText('0')).toBeTruthy();
});

it('shows missing totals as a dash rather than zero', async () => {
  await render(<AthleteStatsTab stats={emptyAthleteStats(null, 'Volleyball')} />);
  expect(screen.queryByText('0')).toBeNull();
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
});

it('applies published volleyball labels and visibility to both Stats and Aura preview', async () => {
  const config = { ...volleyball, statFields: [
    { source: 'volume' as const, label: 'Defensive digs', show: true },
    { source: 'games' as const, label: 'Matches', show: true },
    { source: 'scoring' as const, label: 'Kills', show: false },
  ] };
  const stats = emptyAthleteStats(null, 'Volleyball');
  stats.career.gamesPlayed = 5;
  stats.career.volumeValue = 8;
  const shown = applyAthleteStatsPlaybook(stats, config);
  expect(shown.topThree).toEqual([{ label: 'Defensive digs', value: 8 }, { label: 'Matches', value: 5 }]);
  await render(<AthleteStatsTab stats={shown} config={config} />);
  expect(screen.getByText('Defensive digs')).toBeTruthy();
  expect(screen.getByText('Matches')).toBeTruthy();
  expect(screen.queryByText('Kills')).toBeNull();
});
