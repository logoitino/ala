import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GuardianConsentForm } from '../GuardianConsentForm';
let mockSubmit: (() => Promise<void>) | undefined;
let mockRelationship: (() => void) | undefined;
let mockAuth: any = null;
jest.mock('@/context/AuthContext', () => ({ useOptionalAuth: () => mockAuth }));
jest.mock('@/components/UI/AnimatedButton', () => ({ AnimatedButton: (props: any) => { mockSubmit = props.onPress; return require('react').createElement(jest.requireActual('react-native').Pressable, props); } }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: (props: any) => { if (props.accessibilityLabel === 'Legal guardian') mockRelationship = props.onPress; return require('react').createElement(jest.requireActual('react-native').Pressable, props); } }));
function pending<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => resolve = r); return { promise, resolve }; }
async function ready() { await fireEvent.changeText(screen.getByLabelText('Your full name (signature)'), 'Synthetic Guardian'); await fireEvent.press(screen.getByRole('checkbox', { name: 'I have read this form, and the details I gave are true.' })); }
beforeEach(() => { mockAuth = null; });
it('locks signature, relationship and cancellation through the returned sign promise', async () => {
  const later = pending<void>(); const sign = jest.fn(() => later.promise); const cancel = jest.fn();
  await render(<GuardianConsentForm teenFirstName="Synthetic Teen" canAllowDonations onSign={sign} onCancel={cancel} />); await ready();
  await act(async () => { void mockSubmit?.(); void mockSubmit?.(); mockRelationship?.(); });
  expect(sign).toHaveBeenCalledTimes(1); expect(screen.getByLabelText('Cancel')).toBeDisabled();
  expect(screen.getByLabelText('Your full name (signature)').props.editable).toBe(false);
  await act(async () => later.resolve()); expect(screen.getByLabelText('Cancel')).not.toBeDisabled();
});
it('shows a thrown sign failure and allows an intentional retry', async () => {
  const sign = jest.fn().mockRejectedValueOnce(new Error('Synthetic consent failed')).mockResolvedValue(undefined);
  await render(<GuardianConsentForm teenFirstName="Synthetic Teen" canAllowDonations={false} onSign={sign} />); await ready();
  await act(async () => { await mockSubmit?.(); });
  expect(await screen.findByText('Synthetic consent failed')).toBeTruthy(); expect(screen.getByLabelText('Sign the consent')).not.toBeDisabled();
  await act(async () => { await mockSubmit?.(); }); expect(sign).toHaveBeenCalledTimes(2);
});
it('masks the outgoing signature as soon as the Auth lifetime changes', async () => {
  mockAuth = { user: { id: 'A' }, isSessionCurrent: () => true };
  const view = await render(<GuardianConsentForm teenFirstName="Same Name" canAllowDonations={false} onSign={jest.fn()} />); await ready();
  mockAuth = { user: { id: 'B' }, isSessionCurrent: () => true };
  await view.rerender(<GuardianConsentForm teenFirstName="Same Name" canAllowDonations={false} onSign={jest.fn()} />);
  expect(screen.getByLabelText('Your full name (signature)').props.value).toBe(''); expect(screen.getByLabelText('Sign the consent')).toBeDisabled();
});
