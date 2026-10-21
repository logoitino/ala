/** Synthetic RPC fixtures prove owner lifetime and confirmed state; they do not exercise RLS or email. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { makeDefaultNotificationPreferences, makeDefaultNotificationConfig, type NotificationInboxPage } from '@tapuai/shared-types/notifications';
import { useNotificationInbox, useNotificationSettings } from '../useNotifications';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';
const NEXT = '44444444-4444-4444-8444-444444444444';
const CUT = '55555555-5555-4555-8555-555555555555';
const auth = (id = A) => ({ user: { id }, isGuest: false, isSessionCurrent: () => true });
let mockAuth = auth();
const mockPrefs = jest.fn(), mockAvailability = jest.fn(), mockSave = jest.fn(), mockInbox = jest.fn();
const mockRead = jest.fn(), mockArchive = jest.fn(), mockAll = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/services/TelemetryManager', () => ({ TelemetryManager: { getInstance: () => ({ trackIssue: jest.fn() }) } }));
jest.mock('@/lib/notifications', () => ({ fetchNotificationPreferences: (...args: unknown[]) => mockPrefs(...args),
  fetchNotificationAvailability: (...args: unknown[]) => mockAvailability(...args), saveNotificationPreferences: (...args: unknown[]) => mockSave(...args),
  fetchNotificationInbox: (...args: unknown[]) => mockInbox(...args), setNotificationRead: (...args: unknown[]) => mockRead(...args),
  setNotificationArchived: (...args: unknown[]) => mockArchive(...args), markAllNotificationsRead: (...args: unknown[]) => mockAll(...args),
  notificationErrorText: () => 'Notifications are not available yet.' }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const page = (overrides: Partial<NotificationInboxPage> = {}): NotificationInboxPage => ({ items: [{ id: ITEM, category: 'account', title: 'Welcome', body: 'Your account',
  createdAt: '2026-10-21T00:00:00Z', readAt: null, archivedAt: null, href: '/profile' }], unreadCount: 1, cutoff: CUT, nextCursor: null, ...overrides });
beforeEach(() => {
  jest.clearAllMocks(); mockAuth = auth(); mockPrefs.mockResolvedValue(makeDefaultNotificationPreferences()); mockAvailability.mockResolvedValue(makeDefaultNotificationConfig());
  mockSave.mockImplementation(async value => ({ ...value, revision: value.revision + 1 })); mockInbox.mockResolvedValue(page());
  mockRead.mockResolvedValue(undefined); mockArchive.mockResolvedValue(undefined); mockAll.mockResolvedValue(1);
});
async function settings() { const hook = await renderHook(() => useNotificationSettings(true)); await waitFor(() => expect(hook.result.current.draft).not.toBeNull()); return hook; }
async function inbox() { const hook = await renderHook(() => useNotificationInbox()); await waitFor(() => expect(hook.result.current.page).not.toBeNull()); return hook; }

describe('notification settings', () => {
  it('ignores an earlier pending read when effect cleanup/setup is replayed', async () => {
    const old = deferred<ReturnType<typeof makeDefaultNotificationPreferences>>();
    mockPrefs.mockReturnValueOnce(old.promise).mockResolvedValue({ ...makeDefaultNotificationPreferences(), revision: 5 });
    // The native test renderer does not replay StrictMode effects. This fixture explicitly
    // runs the recorded cleanup/setup sequence, without claiming a native/browser mode test.
    const React = require('react') as typeof import('react'); const original = React.useEffect;
    const effects: { setup: import('react').EffectCallback; cleanup: void | (() => void) }[] = [];
    const spy = jest.spyOn(React, 'useEffect').mockImplementation((setup, deps) => original(() => {
      const entry = { setup, cleanup: setup() }; effects.push(entry); return () => { entry.cleanup?.(); };
    }, deps));
    try {
      const hook = await renderHook(() => useNotificationSettings(true));
      await act(async () => { for (const effect of effects) effect.cleanup?.(); for (const effect of effects) effect.cleanup = effect.setup(); });
      await waitFor(() => expect(mockPrefs).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(hook.result.current.preferences?.revision).toBe(5));
      await act(async () => { old.resolve(makeDefaultNotificationPreferences()); });
      expect(hook.result.current.preferences?.revision).toBe(5); await hook.unmount();
    } finally { spy.mockRestore(); }
  });
  it('waits for confirmed preferences and keeps every optional email off', async () => {
    const pending = deferred<ReturnType<typeof makeDefaultNotificationPreferences>>(); mockPrefs.mockReturnValue(pending.promise);
    const hook = await renderHook(() => useNotificationSettings(true)); expect(hook.result.current.draft).toBeNull(); expect(hook.result.current.loading).toBe(true);
    await act(async () => { pending.resolve(makeDefaultNotificationPreferences()); });
    await waitFor(() => expect(hook.result.current.draft).not.toBeNull());
    expect(Object.values(hook.result.current.draft!.categories).every(choice => !choice.email)).toBe(true);
  });
  it('does not substitute defaults when the service is missing', async () => {
    mockPrefs.mockRejectedValue(new Error('private error'));
    const hook = await renderHook(() => useNotificationSettings(true)); await waitFor(() => expect(hook.result.current.error).toBe('Notifications are not available yet.'));
    expect(hook.result.current.draft).toBeNull(); await act(async () => { await hook.result.current.save(); }); expect(mockSave).not.toHaveBeenCalled();
  });
  it('saves captured actor/revision and preserves category choices when a master is disabled', async () => {
    const hook = await settings(); await act(async () => { hook.result.current.setChannelEnabled('inApp', false); });
    expect(hook.result.current.draft!.categories.account.inApp).toBe(true);
    await act(async () => { await hook.result.current.save(); });
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ revision: 0, inAppEnabled: false }), A);
    expect(hook.result.current.preferences!.revision).toBe(1); expect(hook.result.current.dirty).toBe(false);
  });
  it('allows one rapid save while the first request is pending', async () => {
    const pending = deferred<ReturnType<typeof makeDefaultNotificationPreferences>>(); mockSave.mockReturnValue(pending.promise);
    const hook = await settings(); await act(async () => { hook.result.current.setChannelEnabled('email', false); });
    let first!: Promise<void>, second!: Promise<void>;
    await act(async () => { first = hook.result.current.save(); second = hook.result.current.save(); });
    expect(mockSave).toHaveBeenCalledTimes(1); expect(hook.result.current.busy).toBe(true);
    await act(async () => { pending.resolve({ ...makeDefaultNotificationPreferences(), revision: 1, emailEnabled: false }); await Promise.all([first, second]); });
  });
  it('requires explicit reload after a conflict and never claims saved', async () => {
    mockSave.mockRejectedValue(Object.assign(new Error('conflict'), { code: 'conflict' })); const hook = await settings();
    await act(async () => { hook.result.current.setChannelEnabled('email', false); }); await act(async () => { await hook.result.current.save(); });
    expect(hook.result.current.conflicted).toBe(true); expect(hook.result.current.preferences!.revision).toBe(0);
    await act(async () => { await hook.result.current.save(); }); expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => { await hook.result.current.reload(); }); expect(hook.result.current.conflicted).toBe(false);
  });
  it('rejects a retained outgoing save even after A to B to A', async () => {
    const hook = await settings(); await act(async () => { hook.result.current.setChannelEnabled('email', false); }); const old = hook.result.current.save;
    mockAuth = auth(B); await hook.rerender({}); mockAuth = auth(); await hook.rerender({});
    await act(async () => { await old(); }); expect(mockSave).not.toHaveBeenCalled();
  });
  it('stops publication when Auth invalidates the guard before another render', async () => {
    let current = true; mockAuth.isSessionCurrent = () => current;
    const pending = deferred<ReturnType<typeof makeDefaultNotificationPreferences>>(); mockSave.mockReturnValue(pending.promise); const hook = await settings();
    await act(async () => { hook.result.current.setChannelEnabled('email', false); }); let task!: Promise<void>;
    await act(async () => { task = hook.result.current.save(); }); current = false;
    await act(async () => { pending.resolve({ ...makeDefaultNotificationPreferences(), revision: 1 }); await task; });
    expect(hook.result.current.preferences?.revision).not.toBe(1); expect(hook.result.current.notice).not.toBe('Notification preferences saved.');
  });
  it('never exposes outgoing data while incoming preferences are pending', async () => {
    const hook = await settings(); const pending = deferred<ReturnType<typeof makeDefaultNotificationPreferences>>(); mockPrefs.mockReturnValue(pending.promise);
    mockAuth = auth(B); await hook.rerender({}); expect(hook.result.current.preferences).toBeNull();
    await hook.unmount(); await act(async () => { pending.resolve(makeDefaultNotificationPreferences()); });
  });
  it('does no reads while the sheet is hidden or the account is a guest', async () => {
    const hook = await renderHook(() => useNotificationSettings(false)); expect(mockPrefs).not.toHaveBeenCalled(); await hook.unmount();
    mockAuth.isGuest = true; await renderHook(() => useNotificationSettings(true)); expect(mockPrefs).not.toHaveBeenCalled();
  });
});
describe('notification inbox', () => {
  it('uses server unread counts and bounded initial page options', async () => {
    const hook = await inbox(); expect(mockInbox).toHaveBeenCalledWith({ archived: false, cursor: null }); expect(hook.result.current.page!.unreadCount).toBe(1);
  });
  it('keeps missing/error different from an empty inbox', async () => {
    mockInbox.mockRejectedValue(new Error('private')); const hook = await renderHook(() => useNotificationInbox());
    await waitFor(() => expect(hook.result.current.error).toBe('Notifications are not available yet.')); expect(hook.result.current.page).toBeNull();
  });
  it('changes read state then reloads current source rather than inventing a count', async () => {
    const hook = await inbox(); mockInbox.mockResolvedValue(page({ unreadCount: 4 }));
    await act(async () => { await hook.result.current.setRead(ITEM, true); }); expect(mockRead).toHaveBeenCalledWith(ITEM, true); expect(hook.result.current.page!.unreadCount).toBe(4);
  });
  it('marks the old server cutoff only and preserves later arrivals on reload', async () => {
    const hook = await inbox(); mockInbox.mockResolvedValue(page({ unreadCount: 2, cutoff: NEXT }));
    await act(async () => { await hook.result.current.markAllRead(); }); expect(mockAll).toHaveBeenCalledWith(CUT); expect(hook.result.current.page!.unreadCount).toBe(2);
  });
  it('does not mark active inbox messages while the archived view is displayed', async () => {
    const hook = await inbox(); const retained = hook.result.current.markAllRead;
    await act(async () => { await hook.result.current.showArchived(true); });
    await act(async () => { await retained(); await hook.result.current.markAllRead(); });
    expect(mockAll).not.toHaveBeenCalled();
  });
  it('archives/restores without assigning a read timestamp', async () => {
    const hook = await inbox(); await act(async () => { await hook.result.current.setArchived(ITEM, true); }); expect(mockArchive).toHaveBeenCalledWith(ITEM, true); expect(mockRead).not.toHaveBeenCalled();
    await act(async () => { await hook.result.current.showArchived(true); }); expect(mockInbox).toHaveBeenLastCalledWith({ archived: true, cursor: null });
    await act(async () => { await hook.result.current.setArchived(ITEM, false); }); expect(mockArchive).toHaveBeenLastCalledWith(ITEM, false);
  });
  it('replaces the current page instead of accumulating notifications', async () => {
    mockInbox.mockResolvedValue(page({ nextCursor: NEXT })); const hook = await inbox();
    mockInbox.mockResolvedValue(page({ items: [{ ...page().items[0], id: NEXT }], nextCursor: null }));
    await act(async () => { await hook.result.current.nextPage(); }); expect(mockInbox).toHaveBeenLastCalledWith({ archived: false, cursor: NEXT });
    expect(hook.result.current.page!.items.map(item => item.id)).toEqual([NEXT]);
  });
  it('stops an outgoing mutation before dispatch and a pending mutation before follow-up', async () => {
    const hook = await inbox(); const old = hook.result.current.setRead; mockAuth = auth(B); await hook.rerender({});
    await act(async () => { await old(ITEM, true); }); expect(mockRead).not.toHaveBeenCalled();
    await waitFor(() => expect(hook.result.current.page).not.toBeNull()); const pending = deferred<void>(); mockRead.mockReturnValue(pending.promise); let task!: Promise<void>;
    await act(async () => { task = hook.result.current.setRead(ITEM, true); }); const calls = mockInbox.mock.calls.length;
    await hook.unmount(); await act(async () => { pending.resolve(); await task; }); expect(mockInbox).toHaveBeenCalledTimes(calls);
  });
  it('opens only an authorized current row and rejects a retained outgoing link', async () => {
    const hook = await inbox(); const navigate = jest.fn(); hook.result.current.openItem(NEXT, navigate); expect(navigate).not.toHaveBeenCalled();
    hook.result.current.openItem(ITEM, navigate); expect(navigate).toHaveBeenCalledWith('/profile'); const old = hook.result.current.openItem;
    mockAuth = auth(B); await hook.rerender({}); navigate.mockClear(); old(ITEM, navigate); expect(navigate).not.toHaveBeenCalled();
  });
});
