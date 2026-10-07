/** Scoreboard dismissal must expose a button and a full 44-point target independent of hit slop. */
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SwipeableBannerWrapper } from '@/components/Common/SwipeableBannerWrapper';

// Gesture recognition is native; this test checks the actual rendered close control.
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  return { ...actual, GestureDetector: ({ children }: { children: React.ReactNode }) => children };
});

it('makes scoreboard dismissal a labelled 44-point button', async () => {
  await render(<SwipeableBannerWrapper accessibilityLabel="Dismiss scoreboard" onDismiss={jest.fn()}>
    <Text>Scoreboard</Text>
  </SwipeableBannerWrapper>);
  const close = screen.getByRole('button', { name: 'Dismiss scoreboard' });
  expect(close).toHaveStyle({ width: 44, height: 44 });
});
