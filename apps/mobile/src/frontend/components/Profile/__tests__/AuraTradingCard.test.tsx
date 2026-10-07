/** Aura card keeps sport career values separate from fan rewards and allows both faces to be reached. */
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { AuraTradingCard } from '@/components/Profile/AuraTradingCard';

jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});
jest.mock('@/components/Effects/CardShine', () => ({ CardShine: () => null }));
jest.mock('@/components/Profile/GlowingCardWrapper', () => ({
  GlowingCardWrapper: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Medium: 'medium' } }));
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  for (const key of ['maxDuration', 'maxDistance', 'onEnd']) chain[key] = () => chain;
  return {
    Gesture: { Tap: () => chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

describe('AuraTradingCard flip toggle', () => {
  it('the Identity / Season stats toggle flips the card (regression: chip overlapped the tier badge and never flipped)', async () => {
    await render(<AuraTradingCard name="Sione Fifita" auraPoints={40} />);
    const season = screen.getByLabelText('Show stats');
    const identity = screen.getByLabelText('Show identity');
    expect(identity.props.accessibilityState).toMatchObject({ selected: true });
    expect(season.props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.queryByText('🔄 Season')).toBeNull();

    await fireEvent.press(season);
    expect(screen.getByLabelText('Show stats').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText(/stats face\. Tap to flip\./)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Show identity'));
    expect(screen.getByLabelText(/identity face\. Tap to flip\./)).toBeTruthy();
  });

  it('shows volleyball career stats with reward Aura kept separate, preserving missing and recorded zero values', async () => {
    await render(<AuraTradingCard name="Ana Tui" role="athlete" sport="Volleyball" auraPoints={40}
      careerPreview={[{ label: 'Matches Played', value: '—' }, { label: 'Kills', value: 0 }, { label: 'Digs', value: 7 }]} />);
    await fireEvent.press(screen.getByLabelText('Show stats'));
    expect(screen.getByText(/Volleyball/)).toBeTruthy();
    expect(screen.getByText('Matches Played')).toBeTruthy();
    expect(screen.getByText('Kills')).toBeTruthy();
    expect(screen.getByText('Digs')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(within(screen.getByText('Kills').parent!).getByText('0')).toBeTruthy();
    expect(screen.getByText('Aura points')).toBeTruthy();
    expect(screen.queryByText('Season Points')).toBeNull();
    expect(screen.queryByText('Yards')).toBeNull();
    expect(screen.queryByText('Games Played')).toBeNull();
  });
});
