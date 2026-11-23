/**
 * Local scoreboard regressions: no invented live state, clock or zeroes; roster navigation stays intact; booster logos
 * render from a legacy full URL or an `sb:` reference (SCALE-02) and fall back to initials.
 */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GameCard } from '@/components/Local/GameCard';
import type { Game, Sponsorship } from '@/types/database';

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { storage: { from: (bucket: string) => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://abc123.supabase.co/storage/v1/object/public/${bucket}/${path}` } }) }) } },
}));
const recordedGame: Game = {
  id: 'scoreboard-game', home_team: 'North Valley Timberwolves', away_team: 'South Ridge Falcons',
  home_school: 'North Valley High School', away_school: 'South Ridge High School',
  home_score: 72, away_score: 68, sport: 'Basketball', status: 'live', quarter: 'Q4', clock: '1:09',
  venue: 'Community gym', is_active: true,
};

describe('GameCard scoreboard', () => {
  it('offers one direct scorecard action without a repeated full-width roster panel', async () => {
    await render(<GameCard game={recordedGame} onPress={jest.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('View game & roster')).toBeNull();
    expect(screen.getByRole('button', { name: /Community gym. View game, roster and give/ })).toBeTruthy();
  });
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

describe('GameCard booster logos', () => {
  const sponsor = (id: string, logo_url: string): Sponsorship => ({
    id, sponsor_user_id: null, business_name: `Pizza ${id}`, logo_url, school_team: 'North Valley High School',
    tier: 'silver', amount_cents: 5000, aura_points: 50, billing_interval: 'month', status: 'active',
  });
  it('renders a legacy full URL and an sb: reference, and shows initials when the logo is blank', async () => {
    const legacy = 'https://abc123.supabase.co/storage/v1/object/public/avatars/sponsors/u1/1.png';
    await render(
      <GameCard game={recordedGame} onPress={jest.fn()}
        sponsors={[sponsor('a', legacy), sponsor('b', 'sb:avatars/sponsors/u2/2.png'), sponsor('c', '  ')]} />,
    );
    const uris: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      const { props, children } = node as { props?: { source?: { uri?: string } }; children?: unknown };
      if (props?.source?.uri) uris.push(props.source.uri);
      walk(children);
    };
    walk(screen.toJSON());
    expect(uris).toEqual([legacy, 'https://abc123.supabase.co/storage/v1/object/public/avatars/sponsors/u2/2.png']);
    expect(screen.getByText('PC')).toBeTruthy();
  });
});

// UX-19: shorter score cards — the HOME/AWAY caption shares the team line, and venue shares a row with Boosted by.
const rowOf = (text: string) => {
  let node = screen.getByText(text, { includeHiddenElements: true }).parent;
  while (node && StyleSheet.flatten(node.props.style)?.flexDirection !== 'row') node = node.parent;
  return node;
};
const boosted: Sponsorship = { id: 'a', sponsor_user_id: null, business_name: 'Pizza a', logo_url: '  ', school_team: 'North Valley High School',
  tier: 'silver', amount_cents: 5000, aura_points: 50, billing_interval: 'month', status: 'active' };
it('puts HOME/AWAY on the team line and venue with Boosted by on one row', async () => {
  await render(<GameCard game={recordedGame} onPress={jest.fn()} sponsors={[boosted]} />);
  expect(rowOf('Home')).toBe(rowOf('North Valley Timberwolves'));
  expect(within(rowOf('Community gym')!).getByText('Boosted by', { includeHiddenElements: true })).toBeTruthy();
});

// UX-19 review I3: the venue keeps a real basis so boosters wrap below it instead of squeezing it into a letter column.
it('gives the venue a real width basis and pins the open arrow right', async () => {
  await render(<GameCard game={recordedGame} onPress={jest.fn()} sponsors={[boosted]} />);
  expect(StyleSheet.flatten(screen.getByText('Community gym', { includeHiddenElements: true }).props.style)).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: 140 });
  expect(StyleSheet.flatten(screen.getByText('↗', { includeHiddenElements: true }).props.style).marginLeft).toBe('auto');
});

