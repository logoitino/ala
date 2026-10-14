/**
 * VERIFY-02 admin desk (built before any app change): what the payee still needs, check history without SSNs, recording
 * the school's parent confirmation with a reason, and the two-admin payout override (no self-approval button).
 * Synthetic data.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PayeeReport, PayeeVerificationPanel } from '@/components/Admin/PayeeVerificationPanel';
import * as payee from '@/lib/payeeVerification';

jest.mock('@/lib/payeeVerification', () => ({
  ...jest.requireActual('@/lib/payeeVerification'),
  adminPayeeOverview: jest.fn(), adminPayeeReport: jest.fn(), adminRecordPayeeCheck: jest.fn(), adminRevokePayeeCheck: jest.fn(),
  adminRequestPayoutOverride: jest.fn(), adminDecidePayoutOverride: jest.fn(),
}));
const m = jest.mocked(payee);

const overview = payee.parsePayeeOverview({
  payouts_enabled: false, has_connect_account: true,
  athletes: [{ player_id: 'pl1', name: 'Lani Teen', as: 'guardian', payee_is_this_person: true, missing: ['relationship'], payout: { allowed: false, reason: 'needs_payee_verification' } }],
  checks: [{ id: 'v1', method: 'stripe_connect_kyc', status: 'verified', checks: { identity: true, tin: true }, created_at: '2026-10-14T00:00:00Z' }],
  overrides: [
    { id: 'o1', target: 'profile', payouts_enabled: true, reason: 'Stripe support confirmed fix', status: 'pending', requested_at: '2026-10-14', requested_by: 'Ana', mine: false },
    { id: 'o2', target: 'profile', payouts_enabled: true, reason: 'Mine, waiting on someone else', status: 'pending', requested_at: '2026-10-14', requested_by: 'Me', mine: true },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  m.adminPayeeOverview.mockResolvedValue(overview);
  m.adminRecordPayeeCheck.mockResolvedValue(undefined);
  m.adminDecidePayoutOverride.mockResolvedValue('approved');
});

it('shows what is missing and records the school confirmation only with a reason', async () => {
  await render(<PayeeVerificationPanel profileId="g1" name="Mele" />);
  expect(await screen.findByText(/needs: No school or document confirmation/)).toBeTruthy();
  expect(screen.getByText(/Stripe identity and tax ID · verified/)).toBeTruthy();
  const school = screen.getByLabelText("School confirmed Mele is Lani Teen's parent");
  expect(school).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText(/^Reason/), 'AD Smith confirmed in person, parent on school record');
  await fireEvent.press(screen.getByLabelText("School confirmed Mele is Lani Teen's parent"));
  await waitFor(() => expect(m.adminRecordPayeeCheck).toHaveBeenCalledWith('pl1', 'g1', 'school_parent_confirmation', true, 'AD Smith confirmed in person, parent on school record'));
});

it('a second admin can approve someone else\'s override; there is no button for your own', async () => {
  await render(<PayeeVerificationPanel profileId="g1" name="Mele" />);
  const approve = await screen.findAllByLabelText('Approve: transfers on');
  expect(approve).toHaveLength(1);
  await fireEvent.press(approve[0]);
  await waitFor(() => expect(m.adminDecidePayoutOverride).toHaveBeenCalledWith('o1', true));
});

it('the report says when it cannot be read', async () => {
  m.adminPayeeReport.mockRejectedValue(new Error('This control is not switched on yet.'));
  await render(<PayeeReport />);
  expect(await screen.findByText('This control is not switched on yet.')).toBeTruthy();
});
