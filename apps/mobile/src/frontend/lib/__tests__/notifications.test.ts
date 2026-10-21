/** Notification SDK contracts use synthetic RPC data; these tests do not prove hosted SQL/RLS. */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

import { makeDefaultNotificationConfig, makeDefaultNotificationPreferences } from '@tapuai/shared-types/notifications';
import {
  fetchNotificationPreferences, saveNotificationPreferences, fetchNotificationAvailability,
  fetchNotificationInbox, setNotificationRead, markAllNotificationsRead, setNotificationArchived,
  fetchAdminNotificationConfig, saveAdminNotificationConfig, fetchAdminNotificationHealth,
  fetchAdminNotificationJobs, retryNotificationJob,
} from '@/lib/notifications';

const id = '11111111-1111-4111-8111-111111111111';
const at = '2026-10-21T06:00:00Z';
const preferences = () => makeDefaultNotificationPreferences();
const inbox = () => ({ items: [{ id, category: 'account', title: 'Welcome', body: 'Your account is ready.', createdAt: at, readAt: null, archivedAt: null, href: '/profile' }], unreadCount: 1, cutoff: id, nextCursor: null });
beforeEach(() => mockRpc.mockReset());
const respond = (data: unknown) => mockRpc.mockResolvedValueOnce({ data, error: null });

it('returns saved preferences with every optional email off', async () => {
  respond(preferences());
  const result = await fetchNotificationPreferences();
  expect(Object.values(result.categories).every(choice => !choice.email)).toBe(true);
  expect(result.revision).toBe(0);
});

it('reports unavailable migration instead of fake default settings', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Private diagnostic' } });
  await expect(fetchNotificationPreferences()).rejects.toThrow('Notifications are not available yet.');
});

it('sanitizes database diagnostics', async () => {
  mockRpc.mockRejectedValueOnce(new Error('private@example.invalid internal statement'));
  await expect(fetchNotificationPreferences()).rejects.toThrow('Could not update or load notifications. Try again.');
});

it('denies without exposing server details', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'secret guard' } });
  await expect(fetchNotificationPreferences()).rejects.toThrow('You do not have access to these notifications.');
});

it('surfaces revision conflict instead of a saved result', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'notification_preferences_conflict' } });
  await expect(saveNotificationPreferences(preferences(), id)).rejects.toThrow('Your settings changed elsewhere. Reload them and try again.');
});

it('saves only category/channel choices with the expected revision', async () => {
  const draft = { ...preferences(), revision: 4, recipientId: 'untrusted' };
  draft.categories.donation_receipts.email = true;
  respond({ ...draft, revision: 5 });
  await saveNotificationPreferences(draft, id);
  const [name, args] = mockRpc.mock.calls[0];
  expect(name).toBe('save_notification_preferences');
  expect(args.expected_revision).toBe(4);
  expect(args.expected_actor).toBe(id);
  expect(args.preferences.categories.donation_receipts.email).toBe(true);
  expect(args.preferences.recipientId).toBeUndefined();
  expect(args.preferences.revision).toBeUndefined();
});

it('rejects malformed settings instead of claiming a save', async () => {
  respond({ ...preferences(), revision: -1 });
  await expect(fetchNotificationPreferences()).rejects.toThrow('The notification response could not be verified.');
});

it('uses bounded own inbox reads', async () => {
  respond(inbox());
  const page = await fetchNotificationInbox({ archived: false, cursor: id });
  expect(page.unreadCount).toBe(1);
  expect(mockRpc).toHaveBeenCalledWith('get_notification_inbox', { archived: false, cursor: id, page_size: 20 });
});

it('rejects unknown inbox categories rather than showing a partial success', async () => {
  const page = inbox(); page.items[0].category = 'unregistered'; respond(page);
  await expect(fetchNotificationInbox()).rejects.toThrow('The notification response could not be verified.');
});

it('rejects external destinations', async () => {
  const page = inbox(); page.items[0].href = 'https://untrusted.invalid'; respond(page);
  await expect(fetchNotificationInbox()).rejects.toThrow('The notification response could not be verified.');
});

it('does not call the server with an invalid cursor', async () => {
  await expect(fetchNotificationInbox({ cursor: 'bad' })).rejects.toThrow('The notification response could not be verified.');
  expect(mockRpc).not.toHaveBeenCalled();
});

it('read and archive send no recipient ID', async () => {
  respond(true); await setNotificationRead(id, true);
  expect(mockRpc).toHaveBeenLastCalledWith('set_notification_read', { notification_id: id, is_read: true });
  respond(true); await setNotificationArchived(id, true);
  expect(mockRpc).toHaveBeenLastCalledWith('set_notification_archived', { notification_id: id, is_archived: true });
});

it('does not treat a refused mutation as success', async () => {
  respond(false);
  await expect(setNotificationRead(id, true)).rejects.toThrow('Could not update or load notifications. Try again.');
});

it('mark all read uses the server-issued snapshot only', async () => {
  respond(3);
  await expect(markAllNotificationsRead(id)).resolves.toBe(3);
  expect(mockRpc).toHaveBeenCalledWith('mark_all_notifications_read', { cutoff: id });
});

it('reads safe source availability separately from privileged config', async () => {
  const { revision: _revision, ...availability } = makeDefaultNotificationConfig(); respond(availability);
  const result = await fetchNotificationAvailability();
  expect(result.sourceAvailability.account).toBe(true);
  expect(mockRpc).toHaveBeenCalledWith('get_notification_availability', {});
});

it('staff config save cannot write source authority', async () => {
  const config = makeDefaultNotificationConfig(); respond(config); await fetchAdminNotificationConfig();
  respond({ ...config, revision: 1 }); await saveAdminNotificationConfig(config, id);
  const [name, args] = mockRpc.mock.calls[1];
  expect(name).toBe('set_admin_notification_config');
  expect(args.reason).toBe('reviewed_change');
  expect(args.expected_actor).toBe(id);
  expect(args.config.sourceAvailability).toBeUndefined();
});

it('failed job reads and repair remain bounded and fixed-reason', async () => {
  respond({ items: [{ id, category: 'account', status: 'unknown', attempts: 1, lastErrorCode: 'NOTIF_UNKNOWN_OUTCOME', createdAt: at, updatedAt: at }], nextCursor: null });
  expect((await fetchAdminNotificationJobs()).items[0].status).toBe('unknown');
  expect(mockRpc).toHaveBeenCalledWith('get_admin_notification_jobs', { cursor: null, page_size: 20 });
  respond(true); await retryNotificationJob(id, id);
  expect(mockRpc).toHaveBeenLastCalledWith('retry_notification_job', { job_id: id, expected_actor: id, reason: 'retry_known_failure' });
});

it('Health rejects fabricated invalid measures', async () => {
  respond({ asOf: at, windowStart: at, pending: -1, oldestPendingSeconds: null, attempted: 0, accepted: 0, delivered: 0, suppressed: 0, failed: 0, bounced: 0, unknown: 0, providerEvidence: false });
  await expect(fetchAdminNotificationHealth()).rejects.toThrow('The notification response could not be verified.');
});
