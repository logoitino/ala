/** Synthetic inbox presentation contracts, including the compact disclosure and independent refresh action. */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { NotificationInbox } from '../NotificationInbox';

const mockAuth = { user: { id: 'account-a' }, isGuest: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockNavigate }) }));
const mockRead = jest.fn(); const mockArchive = jest.fn(); const mockAll = jest.fn();
const mockReload = jest.fn(); const mockNext = jest.fn(); const mockShow = jest.fn(); const mockOpen = jest.fn();
let mockInbox: Record<string, unknown>;
jest.mock('@/hooks/useNotifications', () => ({ useNotificationInbox: () => mockInbox }));
const item = { id: 'notif-one', category: 'account', title: 'Welcome to your account', body: 'Review your account.',
  createdAt: '2026-10-21T00:00:00Z', readAt: null, archivedAt: null, href: '/profile' };

beforeEach(() => {
  mockAuth.isGuest = false;
  [mockRead, mockArchive, mockAll, mockReload, mockNext, mockShow, mockOpen, mockNavigate].forEach(mock => mock.mockReset());
  mockInbox = { page: { items: [item], unreadCount: 3, cutoff: 'server-snapshot', nextCursor: 'next' },
    archived: false, loading: false, busy: false, error: null, notice: null,
    reload: mockReload, nextPage: mockNext, showArchived: mockShow, setRead: mockRead,
    setArchived: mockArchive, markAllRead: mockAll, openItem: mockOpen };
});

it('uses the real unread count and read action separately from existing Activity history', async () => {
  await render(<NotificationInbox />);
  expect(screen.getByText('3 unread')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Mark Welcome to your account as read'));
  expect(mockRead).toHaveBeenCalledWith('notif-one', true);
});

it('archive and restore preserve the read choice', async () => {
  const view = await render(<NotificationInbox />);
  await fireEvent.press(screen.getByLabelText('Archive Welcome to your account'));
  expect(mockArchive).toHaveBeenCalledWith('notif-one', true);
  expect(mockRead).not.toHaveBeenCalled();
  mockInbox.archived = true;
  mockInbox.page = { items: [{ ...item, readAt: '2026-10-21T01:00:00Z', archivedAt: '2026-10-21T02:00:00Z' }], unreadCount: 0, cutoff: 'server-snapshot', nextCursor: null };
  await view.rerender(<NotificationInbox />);
  await fireEvent.press(screen.getByLabelText('Restore Welcome to your account'));
  expect(mockArchive).toHaveBeenLastCalledWith('notif-one', false);
  await fireEvent.press(screen.getByLabelText('Mark Welcome to your account as unread'));
  expect(mockRead).toHaveBeenCalledWith('notif-one', false);
});

it('mark-all requires an issued snapshot and uses the hook cutoff action', async () => {
  const view = await render(<NotificationInbox />);
  await fireEvent.press(screen.getByLabelText('Mark all notifications as read'));
  expect(mockAll).toHaveBeenCalledTimes(1);
  mockInbox.page = { items: [item], unreadCount: 3, cutoff: null, nextCursor: null };
  await view.rerender(<NotificationInbox />);
  expect(screen.getByLabelText('Mark all notifications as read')).toBeDisabled();
});

it('archived view offers individual read and restore without marking the unseen inbox', async () => {
  mockInbox.archived = true;
  mockInbox.page = { items: [{ ...item, archivedAt: '2026-10-21T02:00:00Z' }], unreadCount: 3, cutoff: 'active-inbox-snapshot', nextCursor: null };
  await render(<NotificationInbox />);
  expect(screen.queryByLabelText('Mark all notifications as read')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Mark Welcome to your account as read'));
  expect(mockRead).toHaveBeenCalledWith('notif-one', true);
  await fireEvent.press(screen.getByLabelText('Restore Welcome to your account'));
  expect(mockArchive).toHaveBeenCalledWith('notif-one', false);
  expect(mockAll).not.toHaveBeenCalled();
});

it('permission checks run through openItem before navigation', async () => {
  mockOpen.mockImplementation(async (_id, navigate) => { navigate('/profile'); });
  await render(<NotificationInbox />);
  await fireEvent.press(screen.getByLabelText('Open Welcome to your account'));
  expect(mockOpen).toHaveBeenCalledWith('notif-one', expect.any(Function));
  expect(mockNavigate).toHaveBeenCalledWith('/profile');
});

it('removed or unavailable destinations offer no navigation', async () => {
  mockInbox.page = { items: [{ ...item, href: null }], unreadCount: 1, cutoff: 'server-snapshot', nextCursor: null };
  await render(<NotificationInbox />);
  expect(screen.queryByLabelText('Open Welcome to your account')).toBeNull();
  expect(mockOpen).not.toHaveBeenCalled();
});

it('a failed source is not presented as an empty inbox', async () => {
  mockInbox.page = null; mockInbox.error = 'Notifications are not available yet.';
  await render(<NotificationInbox />);
  expect(screen.getByText('Notifications are not available yet.')).toBeTruthy();
  expect(screen.queryByText('No notifications yet')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Refresh notifications'));
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('paging replaces pages through the hook and archived view uses its own query', async () => {
  await render(<NotificationInbox />);
  await fireEvent.press(screen.getByLabelText('Next notifications page'));
  expect(mockNext).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText('Archived notifications'));
  expect(mockShow).toHaveBeenCalledWith(true);
});

it('guests see no private inbox', async () => {
  mockAuth.isGuest = true;
  await render(<NotificationInbox />);
  expect(screen.queryByText('Welcome to your account')).toBeNull();
});

it('groups Inbox and Archived in one segment track with Refresh as a 44pt icon button', async () => {
  await render(<NotificationInbox />);
  const track = screen.getByTestId('notification-segments');
  expect(within(track).getByLabelText('Current notifications')).toBeTruthy();
  expect(within(track).getByLabelText('Archived notifications')).toBeTruthy();
  expect(screen.queryByText('Refresh')).toBeNull();
  // Refresh sits in the track, separate from the full-size header disclosure.
  const refresh = within(track).getByLabelText('Refresh notifications');
  const style = StyleSheet.flatten(refresh.props.style);
  expect(style).toMatchObject({ minWidth: 44, minHeight: 44 });
  expect(style.marginVertical).toBeUndefined();
  expect(within(track).queryByRole('button', { name: /^More about notifications/ })).toBeNull();
  await fireEvent.press(refresh);
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('opens the full explanation independently of inbox actions and announces expansion', async () => {
  await render(<NotificationInbox />);
  const explanation = 'New connected account updates appear here. Your gift history and invitations stay in their own sections.';
  const more = screen.getByRole('button', { name: `More about notifications. ${explanation}`, expanded: false });
  expect(StyleSheet.flatten(more.props.style)).toMatchObject({ minWidth: 44, minHeight: 44 });
  expect(screen.queryByText(explanation)).toBeNull();
  await fireEvent.press(more);
  expect(screen.getByText(explanation).props.numberOfLines).toBeUndefined();
  await fireEvent.press(screen.getByRole('button', { name: 'Less about notifications', expanded: true }));
  expect(screen.queryByText(explanation)).toBeNull();
  expect(mockReload).not.toHaveBeenCalled();
  expect(mockShow).not.toHaveBeenCalled();
});

// UX-19 follow-up M7: Refresh is icon-only, so the paging hint names the button rather than the old visible word.
it('describes paging without relying on a visible Refresh label', async () => {
  await render(<NotificationInbox />);
  expect(screen.getByText('Up to 20 notifications per page. The refresh button returns to the newest page.')).toBeTruthy();
});
