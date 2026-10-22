/** Synthetic Profile UI contracts; hook tests own server and session lifetime behavior. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeDefaultNotificationConfig, makeDefaultNotificationPreferences } from '@tapuai/shared-types/notifications';
import { NotificationSettingsSheet } from '../NotificationSettingsSheet';

const mockAuth = { user: { id: 'account-a', email: 'fan@example.invalid', email_confirmed_at: '2026-10-21T00:00:00Z' }, isGuest: false };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/hooks/useSheetFrame', () => ({ useSheetFrame: () => ({ dock: {}, card: {} }) }));
const mockSetChannel = jest.fn(); const mockSetCategory = jest.fn(); const mockSave = jest.fn(); const mockReload = jest.fn();
let mockSettings: Record<string, unknown>;
jest.mock('@/hooks/useNotifications', () => ({ useNotificationSettings: () => mockSettings }));

beforeEach(() => {
  mockAuth.isGuest = false;
  mockSetChannel.mockReset(); mockSetCategory.mockReset(); mockSave.mockReset(); mockReload.mockReset();
  mockSettings = { preferences: makeDefaultNotificationPreferences(), draft: makeDefaultNotificationPreferences(),
    availability: makeDefaultNotificationConfig(), loading: false, busy: false, error: null, notice: null,
    dirty: false, conflicted: false, reload: mockReload, save: mockSave,
    setChannelEnabled: mockSetChannel, setCategory: mockSetCategory };
});

it('does not offer optional email enrollment while delivery is paused', async () => {
  await render(<NotificationSettingsSheet visible onClose={jest.fn()} />);
  const email = screen.getByLabelText('Account welcome and updates: Email');
  expect(email).toBeDisabled();
  expect(email.props.accessibilityState.checked).toBe(false);
  await fireEvent.press(email);
  expect(mockSetCategory).not.toHaveBeenCalled();
  expect(screen.getByText('Verification and password reset')).toBeTruthy();
  expect(screen.queryByLabelText('Disable security emails')).toBeNull();
});

it('allows disabling a previously enabled choice when its source is unavailable', async () => {
  const draft = makeDefaultNotificationPreferences(); draft.categories.donation_receipts.email = true;
  mockSettings.draft = draft;
  await render(<NotificationSettingsSheet visible onClose={jest.fn()} />);
  const choice = screen.getByLabelText('Gifts you make: Email');
  expect(choice).toBeEnabled();
  await fireEvent.press(choice);
  expect(mockSetCategory).toHaveBeenCalledWith('donation_receipts', 'email', false);
  expect(screen.getAllByText('Source not connected yet.').length).toBeGreaterThan(0);
});

it('a master pause changes only that channel and keeps categories as their stored choices', async () => {
  await render(<NotificationSettingsSheet visible onClose={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText('Email notifications'));
  expect(mockSetChannel).toHaveBeenCalledWith('email', false);
  expect(mockSetCategory).not.toHaveBeenCalled();
});

it('conflicts require reload before save', async () => {
  mockSettings.conflicted = true; mockSettings.dirty = true;
  mockSettings.error = 'Your settings changed elsewhere. Reload them and try again.';
  await render(<NotificationSettingsSheet visible onClose={jest.fn()} />);
  expect(screen.getByLabelText('Save notification settings')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Reload notification settings'));
  expect(mockReload).toHaveBeenCalledTimes(1);
  expect(mockSave).not.toHaveBeenCalled();
});

it('missing settings show a retry instead of default or working choices', async () => {
  mockSettings.draft = null; mockSettings.preferences = null; mockSettings.availability = null;
  mockSettings.error = 'Notifications are not available yet.';
  await render(<NotificationSettingsSheet visible onClose={jest.fn()} />);
  expect(screen.getByText('Notifications are not available yet.')).toBeTruthy();
  expect(screen.queryByLabelText('Email notifications')).toBeNull();
  expect(screen.queryByLabelText('Save notification settings')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reload notification settings'));
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('guest and closed sheets expose no account preferences', async () => {
  mockAuth.isGuest = true;
  const view = await render(<NotificationSettingsSheet visible onClose={jest.fn()} />);
  expect(screen.queryByText('fan@example.invalid')).toBeNull();
  expect(screen.queryByLabelText('Email notifications')).toBeNull();
  mockAuth.isGuest = false;
  await view.rerender(<NotificationSettingsSheet visible={false} onClose={jest.fn()} />);
  expect(screen.queryByLabelText('Email notifications')).toBeNull();
});
