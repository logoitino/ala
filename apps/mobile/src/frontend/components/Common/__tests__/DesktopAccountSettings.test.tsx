/** Web settings reuse guarded account panels and discard outgoing-account UI. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DesktopAccountSettings } from '@/components/Common/DesktopAccountSettings';

const mockSignOut = jest.fn();
const mockSignIn = jest.fn();
const current = () => true;
let mockAuth = { user: { id: 'one' }, profile: { full_name: 'Test Fan' }, isGuest: false,
  loading: false, isSessionCurrent: current, signOut: mockSignOut };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockSignIn }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { tabs: { home: true } } }) }));
jest.mock('@/components/Profile/NotificationSettingsSheet', () => ({
  NotificationSettingsSheet: ({ onClose }: { onClose: () => void }) => {
    const { Text, Pressable } = require('react-native');
    return <><Text>Existing notification choices</Text><Pressable accessibilityRole="button"
      accessibilityLabel="Close notification settings" onPress={onClose} /></>;
  },
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

beforeEach(() => {
  mockSignOut.mockReset();
  mockSignIn.mockReset();
  mockAuth = { user: { id: 'one' }, profile: { full_name: 'Test Fan' }, isGuest: false,
    loading: false, isSessionCurrent: current, signOut: mockSignOut };
});

it('opens existing notification choices then removes them when the account changes', async () => {
  const view = await render(<DesktopAccountSettings />);
  await fireEvent.press(screen.getByRole('button', { name: 'Account settings' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Notifications' }));
  expect(await screen.findByText('Existing notification choices')).toBeTruthy();
  mockAuth = { ...mockAuth, user: { id: 'two' } };
  await view.rerender(<DesktopAccountSettings />);
  expect(screen.queryByText('Existing notification choices')).toBeNull();
  expect(screen.getByRole('button', { name: 'Account settings' }).props.accessibilityState.expanded).toBe(false);
});

it('keeps signout failure visible and permits retry', async () => {
  mockSignOut.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(undefined);
  await render(<DesktopAccountSettings />);
  await fireEvent.press(screen.getByRole('button', { name: 'Account settings' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Could not sign out. Please try again.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(2));
});

it('opens a full overview from the compact rail with grouped choices', async () => {
  await render(<DesktopAccountSettings compact />);
  await fireEvent.press(screen.getByRole('button', { name: 'Account settings' }));
  expect(screen.getByRole('button', { name: 'Privacy and visibility' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Make Tapua’i yours' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Your preferences' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Highlights preferences' })).toBeTruthy();
});

it('returns from a detail panel to the same overview', async () => {
  await render(<DesktopAccountSettings />);
  await fireEvent.press(screen.getByRole('button', { name: 'Account settings' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Notifications' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Close notification settings' }));
  expect(await screen.findByRole('header', { name: 'Make Tapua’i yours' })).toBeTruthy();
  expect(screen.queryByText('Existing notification choices')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Close account settings' }));
  expect(screen.queryByRole('header', { name: 'Make Tapua’i yours' })).toBeNull();
});
