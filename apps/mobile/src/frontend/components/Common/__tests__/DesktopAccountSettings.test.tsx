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
jest.mock('@/components/Profile/NotificationSettingsSheet', () => ({
  NotificationSettingsSheet: () => { const { Text } = require('react-native'); return <Text>Existing notification choices</Text>; },
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

it('keeps compact controls named for keyboard and screen reader use', async () => {
  await render(<DesktopAccountSettings compact />);
  await fireEvent.press(screen.getByRole('button', { name: 'Account settings' }));
  expect(screen.getByRole('button', { name: 'Privacy and visibility' })).toBeTruthy();
  expect(screen.queryByText('Test Fan')).toBeNull();
});
