/** Web feedback copy distinguishes app ideas from clip reporting without changing submission or native wording. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { SuggestionSheet } from '@/components/Feedback/SuggestionSheet';

const mockSubmit = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('@/lib/feedback', () => ({ FEEDBACK_KINDS: [{ id: 'suggestion', label: 'Suggestion' }],
  FEEDBACK_SURFACES: [{ id: 'other', label: 'Other' }], submitAppFeedback: (...args: unknown[]) => mockSubmit(...args) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn(), trackIssue: jest.fn() } }));
jest.mock('@/services/SupportSignalManager', () => ({ supportSignals: { capture: jest.fn() } }));
jest.mock('@/hooks/useFanSheetMotion', () => ({ useFanSheetMotion: () => ({ sheetStyle: {}, backdropStyle: {}, playOpen: jest.fn(), playClose: (done: () => void) => done() }) }));
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
const original = Platform.OS;
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }); jest.restoreAllMocks(); mockSubmit.mockClear(); });
const setPlatform = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os });

it('uses one feedback purpose and preserves the minimum-length gate and confirmed submission', async () => {
  setPlatform('web');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}), close = jest.fn();
  await render(<SuggestionSheet visible onClose={close} />);
  expect(screen.getByText('Share feedback')).toBeTruthy();
  expect(screen.getByText('For app ideas and problems. To report a clip, use Report / Hide.')).toBeTruthy();
  expect(screen.getByLabelText('Send feedback').props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Your feedback'), 'Make search clearer');
  await fireEvent.press(screen.getByLabelText('Send feedback'));
  await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('Make search clearer', 'suggestion', 'other'));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(alert).toHaveBeenCalledWith('Got it', 'Your feedback has been sent to the Tapua’i team.');
});

it.each(['ios', 'android'])('retains native %s wording', async os => {
  setPlatform(os);
  await render(<SuggestionSheet visible onClose={jest.fn()} />);
  expect(screen.getByText('Send a suggestion')).toBeTruthy();
  expect(screen.getByText('Goes to the admin Feedback desk — not a clip report.')).toBeTruthy();
  expect(screen.getByLabelText('Send suggestion')).toBeTruthy();
});
