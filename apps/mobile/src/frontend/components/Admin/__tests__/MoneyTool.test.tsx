/** Money owns disbursement actions; report reads and a second reporting dashboard must stay out of editing desks. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { MoneyTool } from '../MoneyTool';
import { ReportsTool } from '../ReportsTool';
import { LabTool } from '../LabTool';
import { fetchAppFeedback } from '@/lib/feedback';
import { fetchAdminDisbursements, queueDisbursement, setDisbursementStatus } from '@/lib/adminCatalog';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: () => '/admin/money',
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: mockPush, canGoBack: () => false }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
  Redirect: ({ href }: { href: string }) => require('react').createElement(require('react-native').Text, { accessibilityLabel: 'Report destination' }, href),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: require('@/lib/runtime').DEFAULT_APP_RUNTIME, draft: require('@/lib/runtime').DEFAULT_APP_RUNTIME, published: require('@/lib/runtime').DEFAULT_APP_RUNTIME, pendingCount: 0, saveDraft: jest.fn(), dirty: false }) }));
jest.mock('@/context/AdminLensContext', () => ({ useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture-admin' } }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useRoster', () => ({ useRoster: () => ({ players: [{ id: 'athlete-1', name: 'Fixture Athlete', school_name: 'Fixture School' }] }) }));
jest.mock('@/lib/adminCatalog', () => ({
  centsFromDollarsInput: (value: string) => Math.round(Number(value) * 100),
  fetchAdminDisbursements: jest.fn(),
  queueDisbursement: jest.fn(), setDisbursementStatus: jest.fn(),
}));
jest.mock('@/lib/feedback', () => ({ fetchAppFeedback: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/spotlight', () => ({ parseSpotlightAward: jest.fn(), utcWeekStart: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchAdminDisbursements).mockReset().mockResolvedValue([]);
  jest.mocked(queueDisbursement).mockResolvedValue(undefined);
  jest.mocked(setDisbursementStatus).mockResolvedValue(undefined);
});

it('reads the disbursement queue without fetching or repeating the Revenue report', async () => {
  await render(<MoneyTool />);
  expect(fetchAdminDisbursements).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Revenue streams')).toBeNull();
  expect(screen.queryByText('Gross Platform Volume')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'View revenue report' }));
  expect(mockPush).toHaveBeenLastCalledWith('/admin/revenue');
});

it('preserves athlete selection, amount presets and explicit queue submission', async () => {
  await render(<MoneyTool />);
  await fireEvent.changeText(screen.getByPlaceholderText('Search roster'), 'Fixture');
  await fireEvent.press(screen.getByText('Fixture Athlete'));
  await fireEvent.press(screen.getByRole('button', { name: '$100' }));
  expect(queueDisbursement).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Queue payout' }));
  expect(queueDisbursement).toHaveBeenCalledWith('athlete-1', 10000);
  expect(fetchAdminDisbursements).toHaveBeenCalledTimes(2);
});

it('keeps paid status behind confirmation and the existing write lock', async () => {
  jest.mocked(fetchAdminDisbursements).mockResolvedValue([{ id: 'payout-1', player_id: 'athlete-1', amount_cents: 5000, status: 'queued', created_at: '2026-10-12T12:00:00Z' }]);
  const confirm = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  let finish!: () => void;
  jest.mocked(setDisbursementStatus).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  await render(<MoneyTool />);
  await fireEvent.press(screen.getByRole('button', { name: 'Mark paid' }));
  expect(setDisbursementStatus).not.toHaveBeenCalled();
  const action = confirm.mock.calls[0][2]?.find(button => button.text === 'Mark paid');
  await act(async () => action?.onPress?.());
  expect(setDisbursementStatus).toHaveBeenCalledWith('payout-1', 'paid');
  expect(screen.getAllByRole('button', { name: '…' }).every(button => button.props.accessibilityState.disabled)).toBe(true);
  await act(async () => finish());
  expect(screen.getByRole('button', { name: 'Mark paid' })).toBeEnabled();
  confirm.mockRestore();
});

it('does not announce an empty queue until the read finishes', async () => {
  let finish!: () => void;
  jest.mocked(fetchAdminDisbursements).mockImplementation(() => new Promise(resolve => { finish = () => resolve([]); }));
  await render(<MoneyTool />);
  expect(screen.queryByText('No disbursements yet.')).toBeNull();
  await act(async () => finish());
  expect(screen.getByText('No disbursements yet.')).toBeTruthy();
});

it('opens the canonical Analytics report from the legacy Reports desk', async () => {
  await render(<ReportsTool />);
  expect(screen.getByLabelText('Report destination')).toHaveTextContent('/admin/analytics');
  expect(screen.queryByText('Clips · 7 days')).toBeNull();
});

it('keeps Lab draft editing while removing secondary financial and inbox summary reads', async () => {
  await render(<LabTool />);
  expect(fetchAppFeedback).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Runtime draft JSON')).toBeTruthy();
  expect(screen.queryByText('Health (read-only)')).toBeNull();
});
