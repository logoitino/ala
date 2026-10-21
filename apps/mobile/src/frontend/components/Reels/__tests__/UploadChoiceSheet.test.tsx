/** Upload ＋ chooser: both choices are plain, labelled buttons and Cancel closes without choosing. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { UploadChoiceSheet } from '../UploadChoiceSheet';

jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

it('offers Highlight and Beyond moment and reports which was chosen', async () => {
  const onHighlight = jest.fn(), onBeyond = jest.fn(), onClose = jest.fn();
  await render(<UploadChoiceSheet visible onHighlight={onHighlight} onBeyond={onBeyond} onClose={onClose} />);
  expect(screen.getByText('What are you sharing?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^Highlight\. An athlete's game play/));
  expect(onHighlight).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText(/^Beyond moment\. Your own workout/));
  expect(onBeyond).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText('Cancel'));
  expect(onClose).toHaveBeenCalled();
});
