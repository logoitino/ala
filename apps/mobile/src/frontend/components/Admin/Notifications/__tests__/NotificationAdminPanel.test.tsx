/** Synthetic admin contracts: denial, source availability, safe previews and bounded repairs. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { makeDefaultNotificationConfig } from '@tapuai/shared-types/notifications';
import { NotificationAdminPanel } from '../NotificationAdminPanel';
import { NotificationHealthSummary } from '../NotificationHealthSummary';

// Keep the outgoing render's callback observable; native Pressability replaces its internal handler.
// These are account-lifetime unit tests, not native press/gesture verification.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native'); const React = jest.requireActual('react');
  const replacement = Object.defineProperties({}, Object.getOwnPropertyDescriptors(actual));
  Object.defineProperty(replacement, 'Pressable', { configurable: true,
    value: (props: Record<string, unknown>) => React.createElement(actual.View,
      { ...props, accessibilityState: { disabled: props.disabled === true } }, props.children) });
  return replacement;
});

const mockAuth = { isAdmin: true, user: { id: 'admin-a' }, isSessionCurrent: () => true };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
const mockConfig = jest.fn(); const mockJobs = jest.fn(); const mockHealth = jest.fn();
const mockSave = jest.fn(); const mockRetry = jest.fn();
jest.mock('@/lib/notifications', () => ({
  notificationErrorText: (error: Error) => error.message === 'Notifications are not available yet.' ? error.message : 'Could not update or load notifications. Try again.',
  fetchAdminNotificationConfig: (...args: unknown[]) => mockConfig(...args),
  fetchAdminNotificationJobs: (...args: unknown[]) => mockJobs(...args),
  fetchAdminNotificationHealth: (...args: unknown[]) => mockHealth(...args),
  saveAdminNotificationConfig: (...args: unknown[]) => mockSave(...args),
  retryNotificationJob: (...args: unknown[]) => mockRetry(...args),
}));
jest.mock('@/services/TelemetryManager', () => ({ TelemetryManager: { getInstance: () => ({ trackIssue: jest.fn(), trackFeature: jest.fn() }) } }));
const at = '2026-10-21T06:00:00Z'; const id = '11111111-1111-4111-8111-111111111111';
const health = { asOf: at, windowStart: at, pending: 2, oldestPendingSeconds: 80, attempted: 3, accepted: 1, delivered: 0, suppressed: 1, failed: 0, bounced: 0, unknown: 1, providerEvidence: false };
beforeEach(() => {
  mockAuth.isAdmin = true;
  mockAuth.user = { id: 'admin-a' };
  mockAuth.isSessionCurrent = () => true;
  mockConfig.mockReset().mockResolvedValue(makeDefaultNotificationConfig());
  mockJobs.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  mockHealth.mockReset().mockResolvedValue(health);
  mockSave.mockReset().mockImplementation(async value => ({ ...value, revision: value.revision + 1 }));
  mockRetry.mockReset().mockResolvedValue(undefined);
});

it('non-admin reads nothing', async () => {
  mockAuth.isAdmin = false; await render(<NotificationAdminPanel />);
  expect(screen.getByText('Admin access is required.')).toBeTruthy();
  expect(mockConfig).not.toHaveBeenCalled(); expect(mockJobs).not.toHaveBeenCalled();
});

it('missing service does not show working controls or fake metrics', async () => {
  mockConfig.mockRejectedValueOnce(new Error('Notifications are not available yet.'));
  await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByText('Notifications are not available yet.')).toBeTruthy());
  expect(screen.queryByLabelText('Save notification controls')).toBeNull();
});

it('unimplemented donation source is visibly unavailable', async () => {
  await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByText('Donations you make')).toBeTruthy());
  expect(screen.getByLabelText('Enable Donations you make')).toBeDisabled();
});

it('preview uses synthetic copy and sends nothing', async () => {
  await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByLabelText('Preview Account welcome and updates')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Preview Account welcome and updates'));
  expect(screen.getByText('Template preview · no email sent')).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalled(); expect(mockRetry).not.toHaveBeenCalled();
});

it('saves a reviewed in-app pause only after server confirmation', async () => {
  const config = makeDefaultNotificationConfig(); config.inAppEnabled = true;
  mockConfig.mockResolvedValue(config);
  await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByLabelText('Pause in-app alerts')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Pause in-app alerts'));
  await fireEvent.press(screen.getByLabelText('Save notification controls'));
  await waitFor(() => expect(screen.getByText('Notification controls saved.')).toBeTruthy());
  expect(mockSave.mock.calls[0][0].inAppEnabled).toBe(false);
});

it('unknown jobs offer no blind retry', async () => {
  mockJobs.mockResolvedValue({ items: [{ id, category: 'account', status: 'unknown', attempts: 1, lastErrorCode: 'NOTIF_UNKNOWN_OUTCOME', createdAt: at, updatedAt: at }], nextCursor: null });
  await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByText('unknown · 1 attempt')).toBeTruthy());
  expect(screen.queryByLabelText(`Retry notification ${id}`)).toBeNull();
  expect(screen.getByText('Unknown outcomes need reconciliation before retry.')).toBeTruthy();
});

it('known failed jobs use the safe repair action', async () => {
  mockJobs.mockResolvedValue({ items: [{ id, category: 'account', status: 'failed', attempts: 1, lastErrorCode: 'NOTIF_RETRYABLE', createdAt: at, updatedAt: at }], nextCursor: null });
  await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByLabelText(`Retry notification ${id}`)).toBeTruthy());
  await fireEvent.press(screen.getByLabelText(`Retry notification ${id}`));
  await waitFor(() => expect(mockRetry).toHaveBeenCalledWith(id, 'admin-a'));
});

it('Health shows snapshot/window and unavailable provider delivery evidence', async () => {
  await render(<NotificationHealthSummary />);
  await waitFor(() => expect(screen.getByText('All queued now: 2')).toBeTruthy());
  expect(screen.getByText('Provider delivery evidence is unavailable. Accepted is not delivered.')).toBeTruthy();
  expect(screen.getByText('Last 24 hours · attempts and outcomes overlap')).toBeTruthy();
  expect(screen.getByText('delivered: unknown')).toBeTruthy();
});

it('Health distinguishes unread source from zero', async () => {
  mockHealth.mockRejectedValueOnce(new Error('Notifications are not available yet.'));
  await render(<NotificationHealthSummary />);
  await waitFor(() => expect(screen.getByText('Notifications are not available yet.')).toBeTruthy());
  expect(screen.queryByText('All queued now: 0')).toBeNull();
});

it('an old failed save cannot publish a notice into the incoming admin session', async () => {
  let rejectOld!: (error: Error) => void;
  mockSave.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject; }));
  const view = await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByLabelText('Save notification controls')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Save notification controls'));
  mockAuth.user = { id: 'admin-b' };
  await view.rerender(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByLabelText('Save notification controls')).toBeEnabled());
  await act(async () => { rejectOld(new Error('private old failure')); });
  expect(screen.queryByText('Could not update or load notifications. Try again.')).toBeNull();
});

it('a retained old-session callback cannot start a save after A to B to A', async () => {
  let firstLifetimeCurrent = true;
  mockAuth.isSessionCurrent = () => firstLifetimeCurrent;
  const view = await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByLabelText('Save notification controls')).toBeTruthy());
  let target = screen.getByLabelText('Save notification controls');
  while (typeof target.props.onPress !== 'function' && target.parent) target = target.parent;
  const retainedSave = target.props.onPress;
  expect(typeof retainedSave).toBe('function');
  firstLifetimeCurrent = false; mockAuth.user = { id: 'admin-b' }; mockAuth.isSessionCurrent = () => true;
  await view.rerender(<NotificationAdminPanel />);
  mockAuth.user = { id: 'admin-a' }; mockAuth.isSessionCurrent = () => true;
  await view.rerender(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByLabelText('Save notification controls')).toBeEnabled());
  await act(async () => { retainedSave(); });
  expect(mockSave).not.toHaveBeenCalled();
});

it('the third failed attempt offers no retry even if its reported code is retryable', async () => {
  mockJobs.mockResolvedValue({ items: [{ id, category: 'account', status: 'failed', attempts: 3, lastErrorCode: 'NOTIF_RETRYABLE', createdAt: at, updatedAt: at }], nextCursor: null });
  await render(<NotificationAdminPanel />);
  await waitFor(() => expect(screen.getByText('failed · 3 attempts')).toBeTruthy());
  expect(screen.queryByLabelText(`Retry notification ${id}`)).toBeNull();
});
