import { fireEvent, render, screen } from '@testing-library/react-native';

import { RivalryWeekBanner } from '@/components/Local/RivalryWeekBanner';
import type { Game } from '@/types/database';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  for (const key of ['minDistance', 'onUpdate', 'onEnd']) chain[key] = () => chain;
  return {
    Gesture: { Pan: () => chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});

describe('RivalryWeekBanner', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('stays hidden without an active rivalry', async () => {
    await render(<RivalryWeekBanner game={null} />);
    expect(screen.queryByText('Rivalry week')).toBeNull();
  });

  it('opens the Local polls hub for the rivalry matchup', async () => {
    const game: Game = {
      id: 'g1',
      home_team: 'Westlake',
      away_team: 'Lone Peak',
      home_school: 'Westlake',
      away_school: 'Lone Peak',
      home_score: 0,
      away_score: 0,
      status: 'active',
      venue: '',
      is_active: true,
    };
    await render(<RivalryWeekBanner game={game} />);
    fireEvent.press(screen.getByText('Cheer now'));
    expect(mockPush).toHaveBeenCalledWith('/local?hub=polls');
  });
});
