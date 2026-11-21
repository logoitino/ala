/** Receipt totals must describe a successful read, while failed/private states offer their own recovery. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import ReceiptsScreen from '../../../../../app/(tabs)/receipts';
const mockRefresh = jest.fn(), mockRequireAuth = jest.fn();
let mockHistory = { receipts: [], summary: { totalTippedCents: 0, athletesSupported: 0, totalAuraEarned: 0 }, loading: false, signedIn: true, error: null as string | null, refresh: mockRefresh };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useFanTipHistory', () => ({ useFanTipHistory: () => mockHistory }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: { layouts: { receipts: true }, copy: { receiptsKicker: 'Receipts' } } }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/components/TabScreen', () => ({ TabScreen: require('react-native').View }));
jest.mock('@/components/ScreenHeading', () => ({ ScreenHeading: ({ title }: { title: string }) => { const { Text } = require('react-native'); return <Text>{title}</Text>; } }));
jest.mock('@/components/UI/AnimatedButton', () => ({ AnimatedButton: require('react-native').Pressable }));
jest.mock('@/components/UI/EmptyState', () => ({ EmptyState: ({ title, lede, actionLabel, onAction }: { title: string; lede: string; actionLabel: string; onAction: () => void }) => {
  const { View, Text, Pressable } = require('react-native');
  return <View><Text>{title}</Text><Text>{lede}</Text><Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction}><Text>{actionLabel}</Text></Pressable></View>;
} }));
jest.mock('@/components/Profile/ReceiptCard', () => ({ ReceiptCard: () => null }));
beforeEach(() => { jest.clearAllMocks(); mockHistory = { receipts: [], summary: { totalTippedCents: 0, athletesSupported: 0, totalAuraEarned: 0 }, loading: false, signedIn: true, error: null, refresh: mockRefresh }; });
it('shows read failure and Retry before any empty history or zero totals', async () => {
  mockHistory.error = 'Could not load your gift receipts.';
  await render(<ReceiptsScreen />);
  expect(screen.getByText('Could not load your gift receipts.')).toBeTruthy();
  expect(screen.queryByText('No gift receipts yet')).toBeNull();
  expect(screen.queryByLabelText('Gift history totals')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});
it('withholds totals while a read is pending', async () => {
  mockHistory.loading = true;
  await render(<ReceiptsScreen />);
  expect(screen.queryByLabelText('Gift history totals')).toBeNull();
  expect(screen.queryByText('No gift receipts yet')).toBeNull();
});
it('preserves zero totals only for a successful signed-in empty history', async () => {
  await render(<ReceiptsScreen />);
  expect(screen.getByLabelText('Gift history totals')).toBeTruthy();
  expect(screen.getByText('No gift receipts yet')).toBeTruthy();
});
it('keeps guest sign-in recovery without presenting a financial summary', async () => {
  mockHistory.signedIn = false;
  await render(<ReceiptsScreen />);
  expect(screen.queryByLabelText('Gift history totals')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(mockRequireAuth).toHaveBeenCalledWith(expect.objectContaining({ kind: 'signin' }));
});
