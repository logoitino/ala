/** Finance & Books hub: tabs read one journal, entries go through the ledger RPC with balanced lines,
 * recording stays off before the migration, reconciliation and the data catalog are visible, transactions
 * filter and export exactly what is shown, and exports never need a re-read. Fixtures are synthetic. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BooksScreen } from '../BooksScreen';
import { recordLedgerEntry } from '@/lib/bookkeeping';
import { exportCsv } from '@/lib/csvExport';

const day = new Date().toISOString().slice(0, 10);
const mockRefresh = jest.fn(async () => undefined);
const mockBooks = {
  configured: true,
  input: {
    revenue: [
      { id: 'd1', source: 'malo', source_id: 't1', label: 'Mālo · Highlight · Fixture Athlete', gross_cents: 2000, platform_cents: 200, payout_cents: 1800, payee_kind: 'athlete', player_id: '11111111-0000-0000-0000-000000000000', created_at: `${day}T12:00:00Z` },
    ],
    disbursements: [],
    manual: [] as unknown[],
  },
  playerNames: { '11111111-0000-0000-0000-000000000000': 'Fixture Athlete' },
  revenueTruncated: false,
  missingPaymentIds: true,
  manualConfigured: true,
  closes: [],
  reopens: [] as { period: string; reopened_at: string; reason: string }[],
  queuedPayoutCents: 0,
  sources: {
    tips: [{ id: 't1', player_id: '11111111-0000-0000-0000-000000000000', amount_cents: 2000, platform_tip_cents: 0, cover_fee_cents: 0, origin: 'highlight', entry: 'in_app', source_label: '', created_at: `${day}T12:00:00Z` }],
    subscriptions: [], sponsorships: [], shopOrders: null as unknown[] | null, withdrawals: [], filmerCash: [], coverFeeColumn: true,
  },
  sourceErrors: { shop_orders: 'permission denied' } as Record<string, string>,
  errors: { revenue: null as string | null, disbursements: null as string | null, manual: null as string | null },
  readAt: `${day}T12:30:00Z` as string | null,
  enabled: true,
  disabledReason: null as string | null,
  loading: false,
  refresh: mockRefresh,
};

jest.mock('@/hooks/useBooks', () => ({ useBooks: () => mockBooks }));
jest.mock('@/lib/bookkeeping', () => ({ recordLedgerEntry: jest.fn(async () => 'entry-1'), voidLedgerEntry: jest.fn(), closeLedgerPeriod: jest.fn(), reopenLedgerPeriod: jest.fn() }));
jest.mock('@/lib/csvExport', () => ({ exportCsv: jest.fn(async () => 'downloaded') }));
let mockTab: string | undefined;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ tab: mockTab }),
  usePathname: () => '/admin/books',
  useRouter: () => ({ push: jest.fn(), canGoBack: () => false }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: require('@/lib/runtime').DEFAULT_APP_RUNTIME, dirty: false }) }));
jest.mock('@/context/AdminLensContext', () => ({ useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture-admin' } }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/spotlight', () => ({ parseSpotlightAward: jest.fn(), utcWeekStart: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockBooks.manualConfigured = true;
  mockBooks.readAt = `${day}T12:30:00Z`;
  mockBooks.loading = false;
  mockBooks.errors = { revenue: null, disbursements: null, manual: null };
  mockTab = undefined;
});

const openTab = async (name: string) => { await fireEvent.press(screen.getByRole('tab', { name })); };

it('reads income, money held for families and the checks from one journal', async () => {
  await render(<BooksScreen />);
  expect(screen.getByText('Finance & Books')).toBeTruthy();
  expect(screen.getByText('Owned by CFO')).toBeTruthy();
  expect(screen.getByLabelText("Tapua'i income: $2.00")).toBeTruthy();
  expect(screen.getByLabelText('Still held for families: $18.00')).toBeTruthy();
  expect(screen.getByText(/Review: No card processing fees recorded/)).toBeTruthy();
  expect(screen.getByText(/Review: Drip orders: source not read/)).toBeTruthy();
  await openTab('Statements');
  expect(screen.getByText('Profit and loss')).toBeTruthy();
  expect(screen.getByText('Owned by CONTROLLER')).toBeTruthy();
  await openTab('Taxes');
  expect(screen.getByText(/Tax year \d{4}/)).toBeTruthy();
  expect(screen.getByText('Tax calendar')).toBeTruthy();
  expect(screen.getByText('Ready for taxes?')).toBeTruthy();
});

it('opens a tab from the address and shows reconciliation and the data catalog', async () => {
  mockTab = 'reconcile';
  await render(<BooksScreen />);
  expect(screen.getByText('Every money row reached the books?')).toBeTruthy();
  expect(screen.getByText(/Read problem on shop_orders: permission denied/)).toBeTruthy();
  await openTab('Data');
  expect(screen.getByText('Finance data catalog')).toBeTruthy();
  expect(screen.getByText('Who owns what')).toBeTruthy();
});

it('filters transactions and exports exactly the filtered rows', async () => {
  await render(<BooksScreen />);
  await openTab('Transactions');
  expect(screen.getByText(/1 transactions · \$20\.00 moved/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'Payouts' }));
  expect(screen.getByText(/0 transactions/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'All kinds' }));
  await fireEvent.press(screen.getByLabelText('Export 1 filtered rows (CSV)'));
  await waitFor(() => expect(exportCsv).toHaveBeenCalledWith(`tapuai-transactions-${day.slice(0, 7)}.csv`, expect.stringContaining('Highlight')));
  expect(jest.mocked(exportCsv).mock.calls[0][1]).not.toMatch(/Fixture Athlete/);
});

it('records an expense as two balanced lines through the ledger RPC', async () => {
  await render(<BooksScreen />);
  await openTab('Record & close');
  await fireEvent.press(screen.getByRole('tab', { name: 'Software and hosting' }));
  await fireEvent.changeText(screen.getByLabelText('Amount ($)'), '25');
  await fireEvent.changeText(screen.getByLabelText('Memo'), 'Supabase Pro');
  await fireEvent.press(screen.getByLabelText('Record entry'));
  await waitFor(() => expect(recordLedgerEntry).toHaveBeenCalledWith({
    date: day, kind: 'software', memo: 'Supabase Pro', reference: '',
    lines: [{ account_code: '6000', debit_cents: 2500, credit_cents: 0 }, { account_code: '1000', debit_cents: 0, credit_cents: 2500 }],
  }));
  expect(mockRefresh).toHaveBeenCalled();
});

it('explains a bad amount instead of calling the database', async () => {
  await render(<BooksScreen />);
  await openTab('Record & close');
  await fireEvent.changeText(screen.getByLabelText('Amount ($)'), '12.345');
  await fireEvent.changeText(screen.getByLabelText('Memo'), 'Stripe');
  await fireEvent.press(screen.getByLabelText('Record entry'));
  expect(await screen.findByText(/dollars and cents/)).toBeTruthy();
  expect(recordLedgerEntry).not.toHaveBeenCalled();
});

it('keeps recording off until the bookkeeping migration is applied', async () => {
  mockBooks.manualConfigured = false;
  await render(<BooksScreen />);
  await openTab('Record & close');
  expect(screen.getByText(/Recording is off until the bookkeeping migration/)).toBeTruthy();
  expect(screen.getByLabelText('Record entry')).toBeDisabled();
});

it('exports the general ledger without re-reading the books', async () => {
  await render(<BooksScreen />);
  await openTab('Export');
  await fireEvent.press(screen.getByLabelText('General ledger (CSV)'));
  await waitFor(() => expect(exportCsv).toHaveBeenCalledWith(`tapuai-general-ledger-${day.slice(0, 7)}.csv`, expect.stringContaining('Date,Entry,Kind')));
  expect(mockRefresh).not.toHaveBeenCalled();
  const quickbooks = jest.mocked(exportCsv);
  await fireEvent.press(screen.getByLabelText('QuickBooks journal (daily)'));
  await waitFor(() => expect(quickbooks).toHaveBeenCalledTimes(2));
  expect(quickbooks.mock.calls[1][1]).not.toMatch(/Fixture Athlete|ath-/);
});

it('shows no figures, exports or closing until the books are read', async () => {
  mockBooks.readAt = null;
  mockBooks.loading = true;
  await render(<BooksScreen />);
  expect(screen.getByText(/Reading the books/)).toBeTruthy();
  expect(screen.queryByLabelText(/Tapua'i income/)).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Export' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'Export' }));
  expect(screen.queryByLabelText('Tax pack 2026')).toBeNull();
});

it('blocks every export when a source failed to read', async () => {
  mockBooks.errors = { revenue: null, disbursements: 'permission denied', manual: null };
  await render(<BooksScreen />);
  expect(screen.getByText(/Stop: Payouts could not be read completely/)).toBeTruthy();
  await openTab('Export');
  expect(screen.getByLabelText('General ledger (CSV)')).toBeDisabled();
  expect(screen.getByLabelText(`Tax pack ${day.slice(0, 4)}`)).toBeDisabled();
  expect(screen.getByLabelText('Chart of accounts')).toBeEnabled();
});

it('records a refund of the whole donation against the athlete', async () => {
  await render(<BooksScreen />);
  await openTab('Record & close');
  await fireEvent.press(screen.getByRole('tab', { name: 'Refund a donation or sale' }));
  await fireEvent.press(screen.getByRole('tab', { name: 'Fixture Athlete' }));
  await fireEvent.changeText(screen.getByLabelText('Charge refunded ($)'), '20');
  await fireEvent.changeText(screen.getByLabelText('Memo'), 'Refund, donor request');
  await fireEvent.press(screen.getByLabelText('Record entry'));
  await waitFor(() => expect(recordLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ kind: 'refund', lines: [
    { account_code: '2000', debit_cents: 1800, credit_cents: 0, athlete_ref: 'ath-11111111' },
    { account_code: '4900', debit_cents: 200, credit_cents: 0 },
    { account_code: '1010', debit_cents: 0, credit_cents: 2000 },
  ] })));
  expect(await screen.findByText(/Recorded \$20\.00 · Refund a donation or sale/)).toBeTruthy();
});
