import { fireEvent, render, screen } from '@testing-library/react-native';

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
    const season = screen.getByLabelText('Show season stats');
    const identity = screen.getByLabelText('Show identity');
    expect(identity.props.accessibilityState).toMatchObject({ selected: true });
    expect(season.props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.queryByText('🔄 Season')).toBeNull();

    await fireEvent.press(season);
    expect(screen.getByLabelText('Show season stats').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText(/season stats face\. Tap to flip\./)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Show identity'));
    expect(screen.getByLabelText(/identity face\. Tap to flip\./)).toBeTruthy();
  });
});
