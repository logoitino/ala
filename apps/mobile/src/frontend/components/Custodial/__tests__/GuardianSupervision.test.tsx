/**
 * MINOR-01 guardian screens: link with a teen's code and sign the consent; supervise a linked teen (the shared summary,
 * approve an under-16's request); payouts only for the guardian on record; nothing on databases without the update.
 * Synthetic data.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { GuardianSupervisionPanel } from '@/components/Custodial/GuardianSupervisionPanel';
import * as minors from '@/lib/minors';
import { NOT_SWITCHED_ON } from '@/lib/rpc';

const mockLookup = { press: () => {} };
jest.mock('@/components/UI/AnimatedButton', () => ({ AnimatedButton: (props: any) => {
  if (props.accessibilityLabel === 'Look up code') mockLookup.press = props.onPress;
  return require('react').createElement(jest.requireActual('@/components/UI/AnimatedButton').AnimatedButton, props);
} }));

let mockAuth = { user: { id: 'guardian-user-A' }, isSessionCurrent: () => true };
const mockBoundClient = {};
const mockClient = jest.fn(async (..._args: unknown[]) => mockBoundClient);
jest.mock('@/context/AuthContext', () => ({ useOptionalAuth: () => mockAuth }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: (id: string) => ({ userId: id, isCurrent: () => mockAuth.user.id === id && mockAuth.isSessionCurrent() }) } }));
jest.mock('@/lib/offlineActor', () => ({ ...jest.requireActual('@/lib/offlineActor'), createOfflineActorClient: (...args: unknown[]) => mockClient(...args) }));
jest.mock('@/lib/freshQuestions', () => ({ fetchGuardianFunFacts: async () => ({ profile_id: 'guardian-profile-A', facts: [] }) }));

jest.mock('@/lib/minors', () => ({
  ...jest.requireActual('@/lib/minors'),
  fetchGuardianMinors: jest.fn(), previewGuardianInvite: jest.fn(), acceptGuardianInvite: jest.fn(),
  fetchGuardianSupervision: jest.fn(), decideApproval: jest.fn(), signGuardianConsent: jest.fn(),
  revokeGuardianConsent: jest.fn(), endGuardianLink: jest.fn(),
}));
const m = jest.mocked(minors);

const linked: minors.GuardianMinorRow = {
  profileId: 'm1', firstName: 'Lani', username: 'teenlani', ageBand: 'teen_13_15', linkId: 'l1', linkStatus: 'linked',
  accountPrivate: true, myConsent: { signedAt: '2026-10-14', formVersion: '2026-10-14-draft', relationship: 'parent', allowsDonations: false, allowsPublicProfile: true },
  canAllowDonations: false, pendingApprovals: 1,
};

async function signForm(name = 'Mele Fua') {
  await fireEvent.changeText(screen.getByLabelText('Your full name (signature)'), name);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'I have read this form, and the details I gave are true.' }));
}

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth = { user: { id: 'guardian-user-A' }, isSessionCurrent: () => true };
  mockClient.mockReset().mockResolvedValue(mockBoundClient);
  m.fetchGuardianMinors.mockResolvedValue([]);
});

it('links with a code: preview, read the draft form, choose permissions, sign; then waits for the teen', async () => {
  m.previewGuardianInvite.mockResolvedValue({ status: 'ok', firstName: 'Lani', username: 'teenlani', canAllowDonations: false });
  m.acceptGuardianInvite.mockResolvedValue({ status: 'waiting_for_teen', firstName: 'Lani' });
  await render(<GuardianSupervisionPanel />);
  await fireEvent.changeText(await screen.findByLabelText('Guardian code'), 'k7m2q9xa');
  await fireEvent.press(screen.getByLabelText('Look up code'));
  expect(await screen.findByText(/Draft form .* for testing only/)).toBeTruthy();
  expect(screen.getByText(/only be allowed by the guardian on record/)).toBeTruthy();
  expect(screen.getByLabelText('Sign the consent')).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Lani may have a public profile' }));
  await signForm();
  await fireEvent.press(screen.getByLabelText('Sign the consent'));
  await waitFor(() => expect(m.acceptGuardianInvite).toHaveBeenCalledWith('K7M2Q9XA', { signerName: 'Mele Fua', relationship: 'parent', allowsDonations: false, allowsPublicProfile: true }, mockBoundClient));
  expect(await screen.findByText(/Lani now confirms you as their parent or guardian/)).toBeTruthy();
});

it('a wrong code says so without revealing anything', async () => {
  m.previewGuardianInvite.mockResolvedValue({ status: 'bad_code' });
  await render(<GuardianSupervisionPanel />);
  await fireEvent.changeText(await screen.findByLabelText('Guardian code'), 'AAAAAAAA');
  await fireEvent.press(screen.getByLabelText('Look up code'));
  expect(await screen.findByText("That code didn't work. Ask for a new one.")).toBeTruthy();
});

it('supervises a linked teen: the shared summary and approving a request (no way to change their settings)', async () => {
  m.fetchGuardianMinors.mockResolvedValue([linked]);
  const summary = minors.parseSupervision({
    profile_id: 'm1', first_name: 'Lani', settings: { account_private: true }, summary: { friends: 3, incoming_requests: 1 },
    status: { age_band: 'teen_13_15', pending_approvals: [{ id: 'r1', change_key: 'account_public', requested_at: '2026-10-14' }] },
    events: [{ kind: 'approval_requested', detail: {}, at: '2026-10-14' }],
  });
  m.fetchGuardianSupervision.mockResolvedValue(summary);
  m.decideApproval.mockResolvedValue(summary);
  await render(<GuardianSupervisionPanel />);
  expect(await screen.findByText(/1 request for you/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Lani, show summary'));
  expect(await screen.findByText('3 friends')).toBeTruthy();
  expect(screen.queryByLabelText(/Account: Public/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Approve: Make the profile public'));
  await waitFor(() => expect(m.decideApproval).toHaveBeenCalledWith('r1', true, mockBoundClient));
});

it('the guardian on record signs without a code and may allow payouts', async () => {
  m.fetchGuardianMinors.mockResolvedValue([{ ...linked, linkId: null, linkStatus: 'not_linked', myConsent: null, canAllowDonations: true, pendingApprovals: 0 }]);
  m.signGuardianConsent.mockResolvedValue(minors.parseSupervision({}));
  await render(<GuardianSupervisionPanel />);
  await fireEvent.press(await screen.findByLabelText('Sign the consent for Lani'));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Gifts to Lani may be paid out to the family account on record' }));
  await signForm('Pat Parent');
  await fireEvent.press(screen.getByLabelText('Sign the consent'));
  await waitFor(() => expect(m.signGuardianConsent).toHaveBeenCalledWith('m1', expect.objectContaining({ signerName: 'Pat Parent', allowsDonations: true }), mockBoundClient));
});

it('shows nothing on a database without the minor-accounts update', async () => {
  m.fetchGuardianMinors.mockRejectedValue(new Error(NOT_SWITCHED_ON));
  await render(<GuardianSupervisionPanel />);
  await waitFor(() => expect(screen.queryByText('Teens you supervise')).toBeNull());
});

function later<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => resolve = done); return { promise, resolve }; }
it('keeps the displayed invitation preview and signed consent bound to the lookup code', async () => {
  const lookup = later<minors.InvitePreview>(); m.previewGuardianInvite.mockReturnValue(lookup.promise);
  m.acceptGuardianInvite.mockResolvedValue({ status: 'waiting_for_teen', firstName: 'Lani' });
  await render(<GuardianSupervisionPanel />);
  await fireEvent.changeText(await screen.findByLabelText('Guardian code'), 'AAAABBBB');
  await fireEvent.press(screen.getByLabelText('Look up code'));
  await fireEvent.changeText(screen.getByLabelText('Guardian code'), 'CCCCDDDD');
  await act(async () => lookup.resolve({ status: 'ok', firstName: 'Lani', username: null, canAllowDonations: false }));
  await signForm(); await fireEvent.press(screen.getByLabelText('Sign the consent'));
  await waitFor(() => expect(m.acceptGuardianInvite.mock.calls[0][0]).toBe('AAAABBBB'));
});
it('shows a failed guardian list read and can retry the actual read', async () => {
  m.fetchGuardianMinors.mockRejectedValueOnce(new Error('Synthetic guardian read failed')).mockResolvedValueOnce([linked]);
  await render(<GuardianSupervisionPanel />);
  expect(await screen.findByText('Synthetic guardian read failed')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Retry teens you supervise'));
  expect(await screen.findByLabelText('Lani, show summary')).toBeTruthy();
  expect(m.fetchGuardianMinors).toHaveBeenCalledTimes(2);
});
it('does not send an outgoing lookup after the account changes during client setup', async () => {
  const view = await render(<GuardianSupervisionPanel />); await screen.findByText('No teens linked yet.');
  const client = later<typeof mockBoundClient>(); mockClient.mockReturnValueOnce(client.promise);
  await fireEvent.changeText(screen.getByLabelText('Guardian code'), 'AAAABBBB'); await fireEvent.press(screen.getByLabelText('Look up code'));
  mockAuth = { user: { id: 'guardian-user-B' }, isSessionCurrent: () => true };
  await view.rerender(<GuardianSupervisionPanel />);
  await act(async () => client.resolve(mockBoundClient));
  expect(m.previewGuardianInvite).not.toHaveBeenCalled();
});

it('one lookup flight blocks two direct callbacks before busy renders', async () => {
  const lookup = later<minors.InvitePreview>(); m.previewGuardianInvite.mockReturnValue(lookup.promise);
  await render(<GuardianSupervisionPanel />); await screen.findByText('No teens linked yet.');
  await fireEvent.changeText(screen.getByLabelText('Guardian code'), 'AAAABBBB');
  await act(async () => { mockLookup.press(); mockLookup.press(); }); expect(m.previewGuardianInvite).toHaveBeenCalledTimes(1);
  await act(async () => lookup.resolve({ status: 'bad_code' }));
});
it('keeps an outgoing delayed preview out of an incoming account frame', async () => {
  const lookup = later<minors.InvitePreview>(); m.previewGuardianInvite.mockReturnValue(lookup.promise);
  const view = await render(<GuardianSupervisionPanel />); await screen.findByText('No teens linked yet.');
  await fireEvent.changeText(screen.getByLabelText('Guardian code'), 'AAAABBBB'); await fireEvent.press(screen.getByLabelText('Look up code'));
  mockAuth = { user: { id: 'guardian-user-B' }, isSessionCurrent: () => true }; await view.rerender(<GuardianSupervisionPanel />);
  await act(async () => lookup.resolve({ status: 'ok', firstName: 'Private outgoing teen', username: null, canAllowDonations: false }));
  expect(screen.queryByText(/Private outgoing teen/)).toBeNull(); expect(screen.queryByLabelText('Your full name (signature)')).toBeNull();
});
it('shows a failed linked summary read and retries it without changing the consent target', async () => {
  m.fetchGuardianMinors.mockResolvedValue([linked]);
  m.fetchGuardianSupervision.mockRejectedValueOnce(new Error('Synthetic summary read failed')).mockResolvedValueOnce(minors.parseSupervision({summary:{friends:7}}));
  await render(<GuardianSupervisionPanel />); await fireEvent.press(await screen.findByLabelText('Lani, show summary'));
  expect(await screen.findByText('Synthetic summary read failed')).toBeTruthy(); await fireEvent.press(screen.getByLabelText('Retry summary for Lani'));
  expect(await screen.findByText('7 friends')).toBeTruthy(); expect(m.fetchGuardianSupervision).toHaveBeenLastCalledWith('m1',mockBoundClient);
});
