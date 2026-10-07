/** Highlight scoreboard preserves game navigation and distinguishes reported data from hook defaults. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LiveMatchBanner } from '@/components/Reels/LiveMatchBanner';
import type { useLiveGame } from '@/hooks/useLiveGame';
import type { Game } from '@/types/database';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useLiveGame', () => ({ useLiveGame: () => ({ game: null }) }));
jest.mock('@/hooks/useSportConfigs', () => ({ useSportConfigs: () => ({ configFor: () => ({ callouts: [] }) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/components/Common/SwipeableBannerWrapper', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { SwipeableBannerWrapper: ({ children, onPress, pressAccessibilityLabel }: any) => (
    <Pressable accessibilityRole="button" accessibilityLabel={pressAccessibilityLabel} onPress={onPress}>{children}</Pressable>
  ) };
});

const game: Game = {
  id: 'highlight-scoreboard', home_team: 'North Valley', away_team: 'South Ridge',
  home_school: 'North Valley High School', away_school: 'South Ridge High School',
  home_score: 7, away_score: 0, sport: 'Football', status: 'live', quarter: 'Q2', clock: '5:00',
  venue: 'Stadium', is_active: true,
};
function snapshot(row: Game): ReturnType<typeof useLiveGame> {
  // Derived hook fields deliberately differ: the banner must not publish missing data as defaults.
  return { game: row, homeScore: 99, awayScore: 99, isLive: true, clockLabel: '4:59', lastPlay: null, clearLastPlay: jest.fn() } as unknown as ReturnType<typeof useLiveGame>;
}

describe('LiveMatchBanner recorded scoreboard', () => {
  it('pairs real scores with teams, ticks a recorded clock and opens the match', async () => {
    await render(<LiveMatchBanner live={snapshot(game)} />);
    expect(screen.getByText('Q2 · 4:59')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Live, Q2 · 4:59.*North Valley 7 against South Ridge 0/ }));
    expect(mockPush).toHaveBeenCalledWith(`/local/game/${game.id}`);
  });
  it('preserves a recorded three-digit clock instead of displaying the hook fallback', async () => {
    await render(<LiveMatchBanner live={snapshot({ ...game, clock: '120:00' })} />);
    expect(screen.getByText('Q2 · 120:00')).toBeTruthy();
    expect(screen.queryByText('Q2 · 4:59')).toBeNull();
  });
  it('does not turn scheduled defaults into a live score or clock', async () => {
    await render(<LiveMatchBanner live={snapshot({ ...game, status: 'scheduled', is_clock_running: true })} />);
    expect(screen.getByText('Scheduled')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('Q2 · 4:59')).toBeNull();
  });
  it('keeps final authoritative and never substitutes a missing score or clock', async () => {
    await render(<LiveMatchBanner live={snapshot({ ...game, status: 'Final', home_score: undefined, clock: null, is_clock_running: true } as unknown as Game)} />);
    expect(screen.getByText('Final')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('99')).toBeNull();
    expect(screen.queryByText('Q2 · 4:59')).toBeNull();
  });
});
