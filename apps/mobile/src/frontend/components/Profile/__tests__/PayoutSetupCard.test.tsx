/** Bank setup remains test-only; legal saving and server status failures cannot grant bank readiness. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PayoutSetupCard } from '../PayoutSetupCard';
import { LEGAL_ACK_LABEL } from '@/data/legal';
const mockCreate = jest.fn(), mockRefresh = jest.fn(), mockAccept = jest.fn();
let mockConnect: Record<string, unknown>, mockLegal: Record<string, unknown>;
jest.mock('@/hooks/useStripeConnect', () => ({ useStripeConnect: () => mockConnect }));
jest.mock('@/hooks/useLegalAck', () => ({ useLegalAck: () => mockLegal }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
beforeEach(() => {
 jest.clearAllMocks(); mockCreate.mockResolvedValue(undefined); mockAccept.mockResolvedValue(undefined);
 mockConnect = { createStripeExpressAccount: mockCreate, refresh: mockRefresh, busy: false, stripeOnboardingComplete: false, payoutsEnabled: false, linked: false, statusReady: true, statusLoading: false, error: null };
 mockLegal = { accepted: true, ready: true, busy: false, error: null, accept: mockAccept, refresh: jest.fn(), userId: 'guardian' };
});
it('labels setup as a test bank without promising deposits or payouts', async () => {
 await render(<PayoutSetupCard />);
 expect(screen.getByText(/^test bank setup$/i)).toBeTruthy();
 expect(screen.queryByText(/Receive Donations & Subscription Direct Deposits/)).toBeNull();
});
it('blocks launching while Terms acknowledgement is still saving', async () => {
 mockLegal.busy = true; await render(<PayoutSetupCard />);
 const button = screen.getByRole('button', { name: /connect.*bank/i });
 expect(button.props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(button); expect(mockCreate).not.toHaveBeenCalled();
});
it('shows the legal error without granting bank setup', async () => {
 mockLegal.accepted = false; mockLegal.error = 'Terms could not be saved. Try again.';
 await render(<PayoutSetupCard />);
 expect(screen.getByText('Terms could not be saved. Try again.')).toBeTruthy();
 expect(screen.getByRole('button', { name: /connect.*bank/i }).props.accessibilityState.disabled).toBe(true);
});
it('does not claim identity, relationship or bank verification from test transfer capability', async () => {
 mockConnect.stripeOnboardingComplete = true; mockConnect.payoutsEnabled = true; mockConnect.linked = true;
 await render(<PayoutSetupCard playerId="11111111-1111-4111-8111-111111111111" athleteName="Malia" />);
 expect(screen.getByText(/does not establish identity, tax or relationship verification/i)).toBeTruthy();
 expect(screen.getByText('Stripe test setup submitted')).toBeTruthy();
 expect(screen.queryByText('Test bank connected')).toBeNull();
 expect(screen.queryByText(/payouts active/i)).toBeNull();
});
it('shows status failure with a retry action instead of implying an unlinked bank', async () => {
 mockConnect.error = 'Bank setup is not available. Try again.'; mockConnect.linked = null;
 await render(<PayoutSetupCard playerId="11111111-1111-4111-8111-111111111111" />);
 expect(screen.getByText('Bank setup is not available. Try again.')).toBeTruthy();
 await fireEvent.press(screen.getByRole('button', { name: /retry bank status/i }));
 expect(mockRefresh).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('button', { name: /connect.*bank/i }).props.accessibilityState.disabled).toBe(true);
});
it('shows the current Terms acknowledgement before managing a completed guardian setup', async () => {
 mockConnect.stripeOnboardingComplete = true; mockConnect.linked = true; mockLegal.accepted = false;
 await render(<PayoutSetupCard playerId="11111111-1111-4111-8111-111111111111" />);
 const manage = screen.getByRole('button', { name: 'Manage test bank account' });
 expect(manage.props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(manage); expect(mockCreate).not.toHaveBeenCalled();
 const acknowledgement = screen.getByRole('checkbox', { name: LEGAL_ACK_LABEL });
 expect(acknowledgement.props.accessibilityState.checked).toBe(false);
 await fireEvent.press(acknowledgement); expect(mockAccept).toHaveBeenCalledTimes(1);
});
