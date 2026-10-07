/** Pending mentions stay visible when a confirmation failed or changed no owned pending row. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AccountTagInbox } from '@/components/Profile/AccountTagInbox';

const mockConfirm = jest.fn();
const mockFetch = jest.fn();
jest.mock('@/lib/accountTags', () => ({
  confirmAccountTag: (...args: unknown[]) => mockConfirm(...args),
  fetchMyAccountTags: () => mockFetch(),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual('react');
    React.useEffect(effect, [effect]);
  },
}));
jest.mock('@/components/UI/HapticPressable', () => ({
  HapticPressable: jest.requireActual('react-native').Pressable,
}));

describe('AccountTagInbox write outcomes', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue([{ id: 't1', reelId: 'r1', reelTitle: 'Friday game', label: 'Ana', status: 'pending' }]);
    mockConfirm.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('retains the mention and explains a no-op answer', async () => {
    mockConfirm.mockResolvedValue(false);
    await render(<AccountTagInbox />);
    await waitFor(() => expect(screen.getByText('Friday game')).toBeTruthy());
    await fireEvent.press(screen.getByText("That's me"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Mention not updated', expect.any(String)));
    expect(screen.getByText('Friday game')).toBeTruthy();
  });

  it('removes the mention only after SQL confirms its decision', async () => {
    mockConfirm.mockResolvedValue(true);
    await render(<AccountTagInbox />);
    await waitFor(() => expect(screen.getByText('Friday game')).toBeTruthy());
    await fireEvent.press(screen.getByText('Not me'));
    await waitFor(() => expect(screen.queryByText('Friday game')).toBeNull());
    expect(mockConfirm).toHaveBeenCalledWith('t1', 'reject');
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
