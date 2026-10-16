/**
 * CHAL-01 admin desk (built before the app): "not switched on" before the migration, the switch refused with the
 * missing pieces named, aggregate post counts, the nudge-abuse view with reason-gated holds, retention and erasure.
 * Synthetic data.
 */
import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as adminChrome from '@/components/Admin/AdminChrome';

import { WorkoutChallengesPanel } from '@/components/Admin/WorkoutChallengesPanel';
import * as challenges from '@/lib/challenges';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));
const mockAuth = jest.mocked(useAuth);
const A = { user: { id: '11111111-1111-4111-8111-111111111111' }, profile: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: '11111111-1111-4111-8111-111111111111' }, isAdmin: true, loading: false };
const B = { user: { id: '22222222-2222-4222-8222-222222222222' }, profile: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: '22222222-2222-4222-8222-222222222222' }, isAdmin: true, loading: false };
const authenticate = (value: typeof A) => mockAuth.mockReturnValue(value as ReturnType<typeof useAuth>);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
// Capture callbacks at the real AdminBtn boundary while preserving the native control and its interaction behavior.
const originalBtn = adminChrome.AdminBtn;
let buttons: Map<string, (() => void)[]>;
const captured = (label: string) => buttons.get(label)!.at(-1)!;
afterEach(() => jest.restoreAllMocks());

jest.mock('@/lib/challenges', () => ({
  fetchAdminChallengeStatus: jest.fn(), fetchAdminChallengePosts: jest.fn(), fetchAdminChallengeSenders: jest.fn(),
  adminSetChallengesEnabled: jest.fn(), adminHoldChallengeSender: jest.fn(), adminChallengeRetention: jest.fn(), adminChallengeErase: jest.fn(),
}));
const c = jest.mocked(challenges);

const totals = { responses: 40, responders: 22, invites7d: 9, invitesDropped7d: 2, badges: 3, sendersHeld: 0, athletesOn: 4, athletesOff: 1 };
const status = (over: Partial<Awaited<ReturnType<typeof challenges.fetchAdminChallengeStatus>>> = {}) => ({
  switchedOn: false, live: false, missing: [] as string[], changedAt: null, changeReason: null, totals, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  authenticate(A);
  buttons = new Map();
  jest.spyOn(adminChrome, 'AdminBtn').mockImplementation((props) => {
    const callbacks = buttons.get(props.label) ?? []; callbacks.push(props.onPress); buttons.set(props.label, callbacks);
    return createElement(originalBtn, props);
  });
  c.fetchAdminChallengeStatus.mockResolvedValue(status());
  c.fetchAdminChallengePosts.mockResolvedValue([
    { reelId: 'r1', title: 'Leg day', athleteName: 'Sione', postedAt: '2026-10-16', eligible: true, reason: null,
      counts: { accepted: 24, love_it: 6, im_in: 3, did_it: 7 }, responses: 40, invites: 9, invites7d: 9 },
    { reelId: 'r2', title: 'Core', athleteName: 'Lani', postedAt: '2026-10-16', eligible: false, reason: 'athlete_off',
      counts: { accepted: 0, love_it: 0, im_in: 0, did_it: 0 }, responses: 0, invites: 0, invites7d: 0 },
  ]);
  c.fetchAdminChallengeSenders.mockResolvedValue([
    { senderId: 's1', username: 'spammy', sent: 30, delivered: 20, dropped: 10, recipients: 12, recipientIds: ['p1', 'p2'], mutedBy: 4, hold: null, holdReason: null, lastSentAt: '2026-10-16' },
  ]);
  c.adminSetChallengesEnabled.mockResolvedValue(status({ switchedOn: true, live: true }));
  c.adminHoldChallengeSender.mockResolvedValue(undefined);
  c.adminChallengeRetention.mockResolvedValue({ invites: 5, adminRecords: 0 });
  c.adminChallengeErase.mockResolvedValue({ responses: 2, invites: 1, mutes: 0, badges: 1 });
});

it('says "not switched on" before the migration is applied', async () => {
  c.fetchAdminChallengeStatus.mockRejectedValue(new Error(NOT_SWITCHED_ON));
  await render(<WorkoutChallengesPanel />);
  expect(await screen.findByText(/Workout challenges are not switched on/)).toBeTruthy();
  expect(screen.queryByLabelText('Switch challenges on')).toBeNull();
});

it('refuses to switch on while PRIV-01 / MINOR-01 pieces are missing, and names them', async () => {
  c.fetchAdminChallengeStatus.mockResolvedValue(status({ missing: ['PRIV-01 friends (friendships, are_friends)', 'MINOR-01 age bands'] }));
  await render(<WorkoutChallengesPanel />);
  expect(await screen.findByText(/Can't switch on yet\. Missing: PRIV-01 friends .*; MINOR-01 age bands\./)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'Owner approved launch');
  expect(screen.getByLabelText('Switch challenges on')).toBeDisabled();
});

it('switches on with a reason and shows aggregate counts per post (never who)', async () => {
  await render(<WorkoutChallengesPanel />);
  expect(await screen.findByLabelText('Responses 40')).toBeTruthy();
  expect(c.fetchAdminChallengeStatus).toHaveBeenCalledWith(A.profile.id);
  expect(c.fetchAdminChallengePosts).toHaveBeenCalledWith(30, A.profile.id);
  expect(c.fetchAdminChallengeSenders).toHaveBeenCalledWith(7, A.profile.id);
  expect(screen.getByText(/Challenge accepted! 24 · Love this workout 6 · I'm in 3 · Did it! 💪 7 · Invites 9/)).toBeTruthy();
  expect(screen.getByText(/Closed: Athlete has challenges off/)).toBeTruthy();
  expect(screen.getByLabelText('Switch challenges on')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'Owner approved launch');
  await fireEvent.press(screen.getByLabelText('Switch challenges on'));
  await waitFor(() => expect(c.adminSetChallengesEnabled).toHaveBeenCalledWith(true, 'Owner approved launch', A.profile.id));
  expect(await screen.findByText('Workout challenges are on.')).toBeTruthy();
});

it('the nudge-abuse view lists counts per sender with recipient ids only; mute needs a reason', async () => {
  await render(<WorkoutChallengesPanel />);
  expect(await screen.findByText(/Sent 30 · delivered 20 · dropped 10 · 12 people · Muted by 4 · Recipient ids: p1, p2/)).toBeTruthy();
  expect(screen.getByLabelText('Mute spammy')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'Four mutes in a day');
  await fireEvent.press(screen.getByLabelText('Mute spammy'));
  await waitFor(() => expect(c.adminHoldChallengeSender).toHaveBeenCalledWith('s1', 'mute', 'Four mutes in a day', A.profile.id));
  expect(await screen.findByText(/dropped without telling them/)).toBeTruthy();
});

it('applies retention and erases one person with a reason', async () => {
  await render(<WorkoutChallengesPanel />);
  await fireEvent.press(await screen.findByLabelText('Apply retention (invites 30 days)'));
  expect(await screen.findByText('Removed 5 old invites and 0 old admin records.')).toBeTruthy();
  expect(c.adminChallengeRetention).toHaveBeenCalledWith(A.profile.id);
  await fireEvent.changeText(screen.getByLabelText('Profile id to erase from challenges'), 'p9');
  expect(screen.getByLabelText('Erase this person from challenges')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'Deletion request 42');
  await fireEvent.press(screen.getByLabelText('Erase this person from challenges'));
  await waitFor(() => expect(c.adminChallengeErase).toHaveBeenCalledWith('p9', 'Deletion request 42', A.profile.id));
  expect(await screen.findByText('Erased 2 responses, 1 invites, 0 mutes and 1 badges.')).toBeTruthy();
});


it.each([
  ['loading', { ...A, loading: true }],
  ['nonadmin', { ...A, isAdmin: false }],
  ['mismatched profile', { ...A, profile: B.profile }],
])('does not fetch protected challenge data for %s access', async (_name, auth) => {
  authenticate(auth);
  await render(<WorkoutChallengesPanel />);
  expect(c.fetchAdminChallengeStatus).not.toHaveBeenCalled();
  expect(screen.queryByText(/Recipient ids:/)).toBeNull();
  expect(screen.queryByLabelText('Apply retention (invites 30 days)')).toBeNull();
});

it('masks A data immediately and ignores A read success after B has loaded', async () => {
  const old = deferred<Awaited<ReturnType<typeof challenges.fetchAdminChallengeSenders>>>();
  c.fetchAdminChallengeSenders.mockReturnValueOnce(old.promise).mockResolvedValueOnce([]);
  const view = await render(<WorkoutChallengesPanel />);
  authenticate(B);
  await view.rerender(<WorkoutChallengesPanel />);
  expect(screen.queryByText(/Recipient ids:/)).toBeNull();
  await waitFor(() => expect(c.fetchAdminChallengeStatus).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('No invites sent this week.')).toBeTruthy();
  expect(c.fetchAdminChallengeStatus).toHaveBeenLastCalledWith(B.profile.id);
  expect(c.fetchAdminChallengePosts).toHaveBeenLastCalledWith(30, B.profile.id);
  expect(c.fetchAdminChallengeSenders).toHaveBeenLastCalledWith(7, B.profile.id);
  await act(async () => old.resolve([{ senderId: 'old', username: 'outgoing-A', sent: 1, delivered: 1, dropped: 0, recipients: 1, recipientIds: ['private-A-id'], mutedBy: 0, hold: null, holdReason: null, lastSentAt: '2026-10-16' }]));
  expect(screen.queryByText(/private-A-id|outgoing-A/)).toBeNull();
});

it('does not revive A data or accept its retained callbacks after A B A', async () => {
  const view = await render(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'A private reason');
  const oldMute = captured('Mute spammy');
  const oldRetention = captured('Apply retention (invites 30 days)');
  const oldErase = captured('Erase this person from challenges');
  const oldSwitch = captured('Switch challenges on');
  const incoming = deferred<Awaited<ReturnType<typeof challenges.fetchAdminChallengeStatus>>>();
  c.fetchAdminChallengeStatus.mockReturnValueOnce(incoming.promise).mockResolvedValueOnce(status());
  authenticate(B); await view.rerender(<WorkoutChallengesPanel />);
  expect(screen.queryByText('spammy')).toBeNull();
  authenticate(A); await view.rerender(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  await act(async () => { oldMute(); oldRetention(); oldErase(); oldSwitch(); });
  expect(c.adminHoldChallengeSender).not.toHaveBeenCalled();
  expect(c.adminChallengeRetention).not.toHaveBeenCalled();
  expect(c.adminChallengeErase).not.toHaveBeenCalled();
  expect(c.adminSetChallengesEnabled).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Reason (required for the switch, holds and erasing)').props.value).toBe('');
  await act(async () => incoming.resolve(status({ totals: { ...totals, responses: 888 } })));
  expect(screen.queryByLabelText('Responses 888')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'Fresh authorized reason');
  await fireEvent.press(screen.getByLabelText('Mute spammy'));
  expect(c.adminHoldChallengeSender).toHaveBeenCalledWith('s1', 'mute', 'Fresh authorized reason', A.profile.id);
});

it('invalidates same-account actions through access loss and reentry', async () => {
  const view = await render(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  const old = captured('Apply retention (invites 30 days)');
  authenticate({ ...A, loading: true }); await view.rerender(<WorkoutChallengesPanel />);
  expect(screen.queryByText('spammy')).toBeNull();
  authenticate(A); await view.rerender(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  await act(async () => old());
  expect(c.adminChallengeRetention).not.toHaveBeenCalled();
});

it('clears failed-source protected rows and actions, then retries with an honest fresh read', async () => {
  await render(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  const oldMute = captured('Mute spammy');
  c.fetchAdminChallengeSenders.mockRejectedValueOnce(new Error('Temporary source failure'));
  await fireEvent.press(screen.getByLabelText('Refresh workout challenges'));
  expect(await screen.findByText('Temporary source failure')).toBeTruthy();
  expect(screen.queryByText(/Recipient ids:/)).toBeNull();
  expect(screen.queryByText('No invites sent this week.')).toBeNull();
  expect(screen.queryByLabelText('Switch challenges on')).toBeNull();
  await act(async () => oldMute());
  expect(c.adminHoldChallengeSender).not.toHaveBeenCalled();
  c.fetchAdminChallengeSenders.mockResolvedValueOnce([]);
  await fireEvent.press(screen.getByLabelText('Refresh workout challenges'));
  expect(await screen.findByText('No invites sent this week.')).toBeTruthy();
  expect(screen.queryByText('Temporary source failure')).toBeNull();
  await act(async () => oldMute());
  expect(c.adminHoldChallengeSender).not.toHaveBeenCalled();
});

it('does not clear an incoming account form or refresh after an outgoing write', async () => {
  const write = deferred<void>();
  c.adminHoldChallengeSender.mockReturnValueOnce(write.promise);
  const view = await render(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'Outgoing reason');
  await fireEvent.press(screen.getByLabelText('Mute spammy'));
  expect(c.adminHoldChallengeSender).toHaveBeenCalledTimes(1);
  authenticate(B); await view.rerender(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'Incoming reason');
  await act(async () => write.resolve());
  expect(screen.getByLabelText('Reason (required for the switch, holds and erasing)').props.value).toBe('Incoming reason');
  expect(screen.queryByText(/now dropped without telling/)).toBeNull();
  expect(c.fetchAdminChallengeStatus).toHaveBeenCalledTimes(2);
  await fireEvent.press(screen.getByLabelText('Mute spammy'));
  expect(c.adminHoldChallengeSender).toHaveBeenLastCalledWith('s1', 'mute', 'Incoming reason', B.profile.id);
});

it('rejects retained actions after unmount and preserves single flight for a current mutation', async () => {
  const write = deferred<{ invites: number; adminRecords: number }>();
  c.adminChallengeRetention.mockReturnValueOnce(write.promise);
  const view = await render(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  const retained = captured('Apply retention (invites 30 days)');
  await act(async () => { retained(); retained(); });
  expect(c.adminChallengeRetention).toHaveBeenCalledTimes(1);
  await view.unmount();
  await act(async () => { retained(); write.resolve({ invites: 4, adminRecords: 0 }); });
  expect(c.adminChallengeRetention).toHaveBeenCalledTimes(1);
  expect(c.fetchAdminChallengeStatus).toHaveBeenCalledTimes(1);
});


it('ignores an outgoing account read failure after an incoming authorized read', async () => {
  const old = deferred<Awaited<ReturnType<typeof challenges.fetchAdminChallengeStatus>>>();
  c.fetchAdminChallengeStatus.mockReturnValueOnce(old.promise).mockResolvedValueOnce(status());
  const view = await render(<WorkoutChallengesPanel />);
  authenticate(B); await view.rerender(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  await act(async () => old.reject(new Error('Outgoing private error')));
  expect(screen.queryByText('Outgoing private error')).toBeNull();
  expect(screen.getByText('spammy')).toBeTruthy();
});

it('binds read generations to canonical profile identity even when the auth user is unchanged', async () => {
  const old = deferred<Awaited<ReturnType<typeof challenges.fetchAdminChallengeStatus>>>();
  c.fetchAdminChallengeStatus.mockReturnValueOnce(old.promise).mockResolvedValueOnce(status());
  const view = await render(<WorkoutChallengesPanel />);
  authenticate({ ...A, profile: { ...A.profile, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } });
  await view.rerender(<WorkoutChallengesPanel />);
  expect(await screen.findByLabelText('Responses 40')).toBeTruthy();
  await act(async () => old.resolve(status({ totals: { ...totals, responses: 888 } })));
  expect(screen.queryByLabelText('Responses 888')).toBeNull();
  expect(c.fetchAdminChallengeStatus).toHaveBeenCalledTimes(2);
});


it('invalidates protected controls after an uncertain mutation failure until an explicit refresh', async () => {
  c.adminHoldChallengeSender.mockRejectedValueOnce(new Error('Request timed out; outcome unknown'));
  await render(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  await fireEvent.changeText(screen.getByLabelText('Reason (required for the switch, holds and erasing)'), 'Reviewed abuse');
  const old = captured('Mute spammy');
  await fireEvent.press(screen.getByLabelText('Mute spammy'));
  expect(await screen.findByText('Request timed out; outcome unknown')).toBeTruthy();
  expect(screen.queryByText(/Recipient ids:/)).toBeNull();
  expect(screen.queryByLabelText('Mute spammy')).toBeNull();
  await act(async () => old());
  expect(c.adminHoldChallengeSender).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText('Refresh workout challenges'));
  await screen.findByText('spammy');
  await act(async () => old());
  expect(c.adminHoldChallengeSender).toHaveBeenCalledTimes(1);
});

it('keeps a committed action acknowledgment distinct from its failed report refresh', async () => {
  await render(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  c.fetchAdminChallengeStatus.mockRejectedValueOnce(new Error('Could not refresh source'));
  await fireEvent.press(screen.getByLabelText('Apply retention (invites 30 days)'));
  expect(await screen.findByText('Removed 5 old invites and 0 old admin records.')).toBeTruthy();
  expect(await screen.findByText('Could not refresh source')).toBeTruthy();
  expect(screen.queryByText(/Recipient ids:/)).toBeNull();
  expect(screen.queryByText('No invites sent this week.')).toBeNull();
});

it('offers a real retry after an unapplied source without claiming empty data', async () => {
  c.fetchAdminChallengeStatus.mockRejectedValueOnce(new Error(NOT_SWITCHED_ON));
  await render(<WorkoutChallengesPanel />);
  await screen.findByText(/Workout challenges are not switched on/);
  expect(screen.queryByText('No invites sent this week.')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Refresh workout challenges'));
  expect(await screen.findByText('spammy')).toBeTruthy();
  expect(screen.queryByText(/Workout challenges are not switched on/)).toBeNull();
});


it('drops protected state and retained controls on closure, then starts a fresh same-ID reopening lifetime', async () => {
  const view = await render(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  const outgoingRetention = captured('Apply retention (invites 30 days)');
  authenticate({ ...A, profile: { ...A.profile, age_blocked_at: '2026-10-16T02:00:00Z' } } as typeof A);
  await view.rerender(<WorkoutChallengesPanel />);
  expect(screen.queryByText(/Recipient ids:/)).toBeNull();
  expect(screen.queryByLabelText('Apply retention (invites 30 days)')).toBeNull();
  await act(async () => outgoingRetention());
  expect(c.adminChallengeRetention).not.toHaveBeenCalled();
  expect(c.fetchAdminChallengeStatus).toHaveBeenCalledTimes(1);

  authenticate(A);
  await view.rerender(<WorkoutChallengesPanel />);
  await screen.findByText('spammy');
  expect(c.fetchAdminChallengeStatus).toHaveBeenCalledTimes(2);
  await act(async () => outgoingRetention());
  expect(c.adminChallengeRetention).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Apply retention (invites 30 days)'));
  expect(c.adminChallengeRetention).toHaveBeenCalledWith(A.profile.id);
});
