/** Guardian record answers and provider bank setup are distinct; denied or unread records never expose actions. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GuardianCustodialCard } from '../GuardianCustodialCard';
const PLAYER = '11111111-1111-4111-8111-111111111111';
const mockRefresh = jest.fn(), mockConnect = jest.fn(), mockSetup = jest.fn();
let mockCustodial: Record<string, unknown>;
let mockGuard: () => boolean, mockAuth: { user: { id: string }; session: { user: { id: string } }; profile: { id: string; user_id: string } };
jest.mock('@/hooks/useCustodial', () => ({ useCustodial: () => mockCustodial }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/hooks/useStripeConnect', () => ({ useStripeConnect: (options: unknown) => { mockConnect(options); return { createStripeExpressAccount: jest.fn(), refresh: jest.fn(), busy: false, stripeOnboardingComplete: false, payoutsEnabled: false, linked: false, statusReady: true, statusLoading: false, error: null }; } }));
jest.mock('@/hooks/useLegalAck', () => ({ useLegalAck: () => ({ accepted: true, ready: true, busy: false, error: null, accept: jest.fn(), refresh: jest.fn(), userId: 'guardian' }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ ...mockAuth, isSessionCurrent: mockGuard }) }));
const summary = { viewerRole: 'guardian', playerId: PLAYER, athleteName: 'Malia', guardianLinked: true, guardianName: 'Losa', hasAccount: true, payoutsEnabled: false, bankInAthleteName: true, handoverAge: 18, handoverDate: '2028-01-01', athleteControls: false, receivedCents: 0, familyCents: 0, requests: [] };
beforeEach(() => { jest.clearAllMocks(); mockGuard = () => true; mockAuth = { user: { id: 'guardian' }, session: { user: { id: 'guardian' } }, profile: { id: 'guardian-profile', user_id: 'guardian' } }; mockCustodial = { summary, available: true, loading: false, busy: false, error: null, refresh: mockRefresh, setup: mockSetup, request: jest.fn(), decide: jest.fn(), cancel: jest.fn() }; });
it('makes initial loading visible without exposing bank setup', async () => {
 mockCustodial.summary = null; mockCustodial.loading = true;
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 expect(screen.getByText(/loading.*account/i)).toBeTruthy(); expect(mockConnect).not.toHaveBeenCalled();
});
it('surfaces an unavailable database feature explicitly', async () => {
 mockCustodial.summary = null; mockCustodial.available = false;
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 expect(screen.getByText(/not available/i)).toBeTruthy(); expect(mockConnect).not.toHaveBeenCalled();
});
it('makes a failed read retryable and does not reuse the previous summary', async () => {
 mockCustodial.error = 'Account could not be loaded. Try again.';
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 expect(screen.getByText('Account could not be loaded. Try again.')).toBeTruthy();
 await fireEvent.press(screen.getByRole('button', { name: /retry account/i })); expect(mockRefresh).toHaveBeenCalledTimes(1);
 expect(mockConnect).not.toHaveBeenCalled();
});
it('launches athlete-scoped Stripe only after the custodial record exists', async () => {
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 expect(mockConnect).toHaveBeenCalledWith({ playerId: PLAYER });
 expect(screen.getByText(/^test bank setup$/i)).toBeTruthy();
 expect(screen.queryByText(/payouts active/i)).toBeNull();
});
it('does not treat the bank-name answer as a linked Stripe account', async () => {
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 expect(screen.getByRole('button', { name: /connect.*bank/i })).toBeTruthy();
 expect(screen.queryByText(/test bank connected/i)).toBeNull();
});
it('keeps admin inspection read-only', async () => {
 mockCustodial.summary = { ...summary, viewerRole: 'admin' };
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 expect(screen.getByText(/read.only/i)).toBeTruthy();
 expect(screen.queryByRole('button', { name: /connect.*bank/i })).toBeNull();
 expect(screen.queryByText('Save')).toBeNull(); expect(screen.queryByText('Send to Malia')).toBeNull();
});
it('does not expose actions for a mismatched returned athlete', async () => {
 mockCustodial.summary = { ...summary, playerId: '22222222-2222-4222-8222-222222222222' };
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 expect(mockConnect).not.toHaveBeenCalled(); expect(screen.queryByText('Send to Malia')).toBeNull();
});
it('keeps guardian bank linking closed after control passes to the athlete', async () => {
 mockCustodial.summary = { ...summary, athleteControls: true };
 await render(<GuardianCustodialCard playerId={PLAYER} />); expect(mockConnect).not.toHaveBeenCalled();
 expect(screen.queryByRole('button', { name: /connect.*bank/i })).toBeNull();
});
it('offers an inline final DOB confirmation that works on browser and phone', async () => {
 mockCustodial.summary = { ...summary, handoverDate: null, hasAccount: false };
 mockSetup.mockResolvedValue(undefined);
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 await fireEvent.changeText(screen.getByLabelText("Malia's date of birth"), '2009-03-04');
 await fireEvent.press(screen.getByText('Save'));
 expect(mockSetup).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole('button', { name: /confirm custodial record/i }));
 expect(mockSetup).toHaveBeenCalledWith('2009-03-04', true);
});
it('clears a DOB draft and its confirmation across guardian A B A lifetimes', async () => {
 mockCustodial.summary = { ...summary, handoverDate: null, hasAccount: false };
 const h = await render(<GuardianCustodialCard playerId={PLAYER} />);
 await fireEvent.changeText(screen.getByLabelText("Malia's date of birth"), '2009-03-04'); await fireEvent.press(screen.getByText('Save'));
 mockAuth = { user: { id: 'other' }, session: { user: { id: 'other' } }, profile: { id: 'other-profile', user_id: 'other' } }; mockGuard = () => true;
 await h.rerender(<GuardianCustodialCard playerId={PLAYER} />);
 mockAuth = { user: { id: 'guardian' }, session: { user: { id: 'guardian' } }, profile: { id: 'guardian-profile', user_id: 'guardian' } }; mockGuard = () => true;
 await h.rerender(<GuardianCustodialCard playerId={PLAYER} />);
 expect(screen.getByLabelText("Malia's date of birth").props.value).toBe('');
 expect(screen.queryByRole('button', { name: /confirm custodial record/i })).toBeNull();
});
it('does not restore private drafts when the provider invalidates an account inside one render batch', async () => {
 mockCustodial.summary = { ...summary, handoverDate: null, hasAccount: false };
 const h = await render(<GuardianCustodialCard playerId={PLAYER} />);
 await fireEvent.changeText(screen.getByLabelText("Malia's date of birth"), '2009-03-04');
 mockGuard = () => true; await h.rerender(<GuardianCustodialCard playerId={PLAYER} />);
 expect(screen.getByLabelText("Malia's date of birth").props.value).toBe('');
});
it('single-flights the final confirmation and shows safe mutation failure inline', async () => {
 mockCustodial.summary = { ...summary, handoverDate: null, hasAccount: false };
 let reject!: (error: Error) => void;
 mockSetup.mockReturnValue(new Promise((_yes, no) => { reject = no; }));
 await render(<GuardianCustodialCard playerId={PLAYER} />);
 await fireEvent.changeText(screen.getByLabelText("Malia's date of birth"), '2009-03-04'); await fireEvent.press(screen.getByText('Save'));
 const confirm = screen.getByRole('button', { name: /confirm custodial record/i });
 await fireEvent.press(confirm); await fireEvent.press(confirm); expect(mockSetup).toHaveBeenCalledTimes(1);
 await act(async () => reject(new Error('private raw provider diagnostics')));
 expect(screen.getByText(/could not be confirmed/)).toBeTruthy(); expect(screen.queryByText(/private raw/)).toBeNull();
});
