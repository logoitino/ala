/** OS motion preferences must preserve button actions and disabled behavior without scale animations. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Motion from 'react-native-reanimated';

import { AnimatedButton } from '../AnimatedButton';
import { Text } from 'react-native';

afterEach(() => jest.restoreAllMocks());

it('keeps the action usable with Reduce Motion and skips spring feedback', async () => {
  jest.spyOn(Motion, 'useReducedMotion').mockReturnValue(true);
  const spring = jest.spyOn(Motion, 'withSpring');
  const onPress = jest.fn();
  await render(<AnimatedButton accessibilityLabel="Share story" onPress={onPress}><Text>Share</Text></AnimatedButton>);
  const button = screen.getByRole('button', { name: 'Share story' });
  await fireEvent(button, 'pressIn');
  await fireEvent(button, 'pressOut');
  await fireEvent.press(button);
  expect(spring).not.toHaveBeenCalled();
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('retains feedback with ordinary motion and blocks a disabled action', async () => {
  jest.spyOn(Motion, 'useReducedMotion').mockReturnValue(false);
  const spring = jest.spyOn(Motion, 'withSpring');
  const onPress = jest.fn();
  const view = await render(<AnimatedButton accessibilityLabel="Share story" onPress={onPress}><Text>Share</Text></AnimatedButton>);
  await fireEvent(screen.getByRole('button', { name: 'Share story' }), 'pressIn');
  expect(spring).toHaveBeenCalled();
  await view.rerender(<AnimatedButton disabled accessibilityLabel="Share story" onPress={onPress}><Text>Share</Text></AnimatedButton>);
  await fireEvent.press(screen.getByRole('button', { name: 'Share story' }));
  expect(onPress).not.toHaveBeenCalled();
});
