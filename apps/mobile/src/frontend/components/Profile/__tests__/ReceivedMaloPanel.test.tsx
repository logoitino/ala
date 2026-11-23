/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ReceivedMaloPanel } from '@/components/Profile/ReceivedMaloPanel';
import { THANKS_MESSAGES } from '@/lib/donationThanks';

const mockThank = jest.fn(async () => ({ ok: true as const }));
const mockToast = jest.fn();
const mockRefresh = jest.fn(async () => undefined);
let mockUser = 'A';
let mockGuard = () => true;
let mockThanksError: string | null = null;
const mockThanksRefresh = jest.fn();
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser }, isSessionCurrent: mockGuard }) }));
let mockLoadError: string | null = null;
type MockRow = { id: string; fan_name: string; amount_cents: number; family_cents?: number | null; origin: string; entry: string; source_label: string | null };
let mockRows: MockRow[] = [
  { id: 't1', fan_name: 'Sina', amount_cents: 500, origin: 'rally', entry: 'in_app', source_label: 'New cleats' },
  { id: 't2', fan_name: 'Tavita', amount_cents: 1000, origin: 'profile', entry: 'in_app', source_label: null },
];

jest.mock('@/hooks/useReceivedMalo', () => ({
  useReceivedMalo: () => ({
    loading: false,
    totalCents: mockRows.reduce((sum, row) => sum + row.amount_cents, 0),
    familyCents: mockRows.length && mockRows.every((row) => row.family_cents != null)
      ? mockRows.reduce((sum, row) => sum + (row.family_cents ?? 0), 0)
      : null,
    rows: mockRows,
    error: mockLoadError,
    refresh: mockRefresh,
  }),
}));

jest.mock('@/hooks/useDonationThanks', () => ({
  useDonationsToThank: () => ({
    rows: mockRows.map(row => ({ tipId: row.id, amountCents: row.amount_cents, createdAt: '', fanName: row.fan_name, rallyTitle: null, thankedKey: row.id === 't2' ? 'family' : null })),
    thank: mockThank, loading: false, error: mockThanksError, refresh: mockThanksRefresh,
  }),
}));

jest.mock('@/context/CelebrationContext', () => ({ useOptionalCelebration: () => ({ showToast: mockToast }) }));

jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});

describe('ReceivedMaloPanel say thanks', () => {
  beforeEach(() => {
    mockLoadError = null; mockThanksError = null; mockUser = 'A'; mockGuard = () => true; mockThank.mockReset(); mockThank.mockResolvedValue({ ok: true }); mockToast.mockClear();
    mockRows = [
      { id: 't1', fan_name: 'Sina', amount_cents: 500, origin: 'rally', entry: 'in_app', source_label: 'New cleats' },
      { id: 't2', fan_name: 'Tavita', amount_cents: 1000, origin: 'profile', entry: 'in_app', source_label: null },
    ];
    mockRefresh.mockClear();
  });

  it('nudges the athlete and sends a preset thank-you in two taps', async () => {
    await render(<ReceivedMaloPanel playerId="p1" />);

    expect(screen.getByText('1 gift sender is waiting for a thank-you.')).toBeTruthy();
    expect(screen.getByText(/Thanked ✓ “My family and I thank you\.”/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Say thanks to Sina'));
    await fireEvent.press(screen.getByText('Thank you — this helps with my gear.'));

    expect(mockThank).toHaveBeenCalledWith('t1', 'gear');
    expect(mockToast).toHaveBeenCalledWith('Thank-you sent 🙏');
  });

  it('offers the five presets only (no free text for minors)', async () => {
    await render(<ReceivedMaloPanel playerId="p1" />);
    await fireEvent.press(screen.getByLabelText('Say thanks to Sina'));
    for (const message of THANKS_MESSAGES) expect(screen.getByText(message.text)).toBeTruthy();
    expect(screen.getByLabelText('Pick a thank-you message').children).toHaveLength(THANKS_MESSAGES.length + 1);
  });

  it('shows load failure with Retry instead of a false zero total/empty ledger', async () => {
    mockRows = [];
    mockLoadError = 'Could not load gifts. Check your connection and retry.';
    await render(<ReceivedMaloPanel playerId="p1" />);
    expect(screen.getByText(mockLoadError)).toBeTruthy();
    expect(screen.queryByText('$0.00 given')).toBeNull();
    expect(screen.queryByText(/No gifts yet/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry gifts' }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
  it('shows thanks read failure and a separate Retry action', async () => {
    mockThanksError = 'Could not load thank-you choices.';
    await render(<ReceivedMaloPanel playerId="p1" />);
    expect(screen.getByText(mockThanksError)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry thank-yous' }));
    expect(mockThanksRefresh).toHaveBeenCalledTimes(1);
  });
  it('refuses an old thank completion from closing or celebrating a new athlete/account picker', async () => {
    let release!: (value: { ok: true }) => void;
    mockThank.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const view = await render(<ReceivedMaloPanel playerId="p1" />);
    await fireEvent.press(screen.getByLabelText('Say thanks to Sina'));
    await fireEvent.press(screen.getByText('Thank you — this helps with my gear.'));
    mockUser = 'B'; mockGuard = () => true; mockRows = [{ id: 't3', fan_name: 'Sina', amount_cents: 800, origin: 'profile', entry: 'in_app', source_label: null }];
    await view.rerender(<ReceivedMaloPanel playerId="p2" />);
    await fireEvent.press(screen.getByLabelText('Say thanks to Sina'));
    await act(async () => release({ ok: true }));
    expect(screen.getByLabelText('Pick a thank-you message')).toBeTruthy();
    expect(mockToast).not.toHaveBeenCalled();
  });
});

describe('ReceivedMaloPanel family share', () => {
  it('leads with what reached the family account, not the gave total', async () => {
    mockRows = [
      { id: 't1', fan_name: 'Sina', amount_cents: 500, family_cents: 450, origin: 'rally', entry: 'in_app', source_label: 'New cleats' },
      { id: 't2', fan_name: 'Tavita', amount_cents: 1000, family_cents: 900, origin: 'profile', entry: 'in_app', source_label: null },
    ];
    await render(<ReceivedMaloPanel playerId="p1" />);
    expect(screen.getByText('$13.50 recorded for your family account so far')).toBeTruthy();
    expect(screen.getByText("Fans gave $15.00. Historical Tapua'i gift share recorded: $1.50.")).toBeTruthy();
    expect(screen.getByText('$4.50 for your family account')).toBeTruthy();
    expect(screen.getByText('$10.00')).toBeTruthy();
  });

  it('keeps historical allocations unknown when the database has no family share yet', async () => {
    mockRows = [{ id: 't1', fan_name: 'Sina', amount_cents: 500, origin: 'rally', entry: 'in_app', source_label: 'New cleats' }];
    await render(<ReceivedMaloPanel playerId="p1" />);
    expect(screen.getByText('$5.00 given')).toBeTruthy();
    expect(screen.getByText("The recorded family share is unavailable. Check the original gift receipts.")).toBeTruthy();
    expect(screen.queryByText(/for your family account/)).toBeNull();
  });
});
