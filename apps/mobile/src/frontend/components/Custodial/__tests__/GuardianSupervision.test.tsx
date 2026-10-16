/**
 * MINOR-01 guardian screens: link with a teen's code and sign the consent; supervise a linked teen (the shared summary,
 * approve an under-16's request); payouts only for the guardian on record; nothing on databases without the update.
 * Synthetic data.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { GuardianSupervisionPanel } from '@/components/Custodial/GuardianSupervisionPanel';
import * as minors from '@/lib/minors';
import { NOT_SWITCHED_ON } from '@/lib/rpc';

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
  jest.clearAllMocks();
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
  await waitFor(() => expect(m.acceptGuardianInvite).toHaveBeenCalledWith('K7M2Q9XA', { signerName: 'Mele Fua', relationship: 'parent', allowsDonations: false, allowsPublicProfile: true }));
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
  await waitFor(() => expect(m.decideApproval).toHaveBeenCalledWith('r1', true));
});

it('the guardian on record signs without a code and may allow payouts', async () => {
  m.fetchGuardianMinors.mockResolvedValue([{ ...linked, linkId: null, linkStatus: 'not_linked', myConsent: null, canAllowDonations: true, pendingApprovals: 0 }]);
  m.signGuardianConsent.mockResolvedValue(minors.parseSupervision({}));
  await render(<GuardianSupervisionPanel />);
  await fireEvent.press(await screen.findByLabelText('Sign the consent for Lani'));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Donations to Lani may be paid out to the family account on record' }));
  await signForm('Pat Parent');
  await fireEvent.press(screen.getByLabelText('Sign the consent'));
  await waitFor(() => expect(m.signGuardianConsent).toHaveBeenCalledWith('m1', expect.objectContaining({ signerName: 'Pat Parent', allowsDonations: true })));
});

it('shows nothing on a database without the minor-accounts update', async () => {
  m.fetchGuardianMinors.mockRejectedValue(new Error(NOT_SWITCHED_ON));
  await render(<GuardianSupervisionPanel />);
  await waitFor(() => expect(screen.queryByText('Teens you supervise')).toBeNull());
});
