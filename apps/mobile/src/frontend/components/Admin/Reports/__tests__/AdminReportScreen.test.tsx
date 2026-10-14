/** Main Expo admin reports retain twelve distinct destinations, complete analytics/catalog content,
 * donation privacy and read-error semantics. Fixtures never query a hosted database. */
import { fireEvent, render, screen, within } from '@testing-library/react-native';

const mockRefresh = jest.fn(async () => undefined);
const mockRouter = { push: jest.fn() };
const missing = { configured: true, error: null };
const mockSnapshot = {
  reports: { ...missing, generatedAt: null, engagement: {}, money: { malo_cents_7d: 0 }, content: {}, audience: {}, live: {}, reliability: {}, usage: {},
    tabs: [], features: [], issues: [], scroll: [], leaders: { malo: [{ label: 'Private athlete donation total', value: 90000 }], hype: [], schools: [] },
    series: { clips: [], malo: [], stalls: [], dwell: [] }, donationBands: null },
  revenue: { ...missing, gross_volume_cents: null, company_net_cents: null, payouts_cents: null, stripe_paid_cents: null, streams: [], recent: [] },
  breakdown: { ...missing, byOrigin: [], byEntry: [], byDay: [], recent: [], source: 'rpc' },
  runtime: { ...missing, draft: {}, published: {}, publishedAt: null, dirty: null },
  profile: { ...missing, claimedAthletes: null, athleteProfiles: null, showCard: null, statsFirst: null, chromeFlags: [] },
  softWall: { ...missing, fanProfiles: null, fansLast7d: null, maloLive: null, crewLive: null, wishlistLive: null, softWallGates: [], authProviders: [] },
  people: { ...missing, people: [] }, stock: { ...missing, lowStock: null }, enabled: true, disabledReason: null, loading: false, refresh: mockRefresh,
};
jest.mock('@/hooks/useAdminReports', () => ({ useAdminReports: () => mockSnapshot }), { virtual: true });
jest.mock('expo-router', () => ({
  // Navigation stays local, but real Expo Slot must validate child styles and merge focus/press props.
  Link: ({ children, href }: { children: React.ReactElement; href: string }) => require('react').createElement(
    jest.requireActual('expo-router/build/ui/Slot').Slot, { href, onPress: () => mockRouter.push(href) }, children),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/Admin/AdminChrome', () => ({ AdminReportHeader: () => null }));

function report() { return require('../AdminReportScreen').AdminReportScreen; }
const destinations = { home: 'A week of community support.', trends: 'Trends', audience: 'Audience', revenue: 'Revenue', health: 'Health', product: 'Product',
  analytics: 'Analytics', departments: 'Departments', features: 'Features', profile: 'Profile', 'sign-in': 'Sign-in', people: 'People' };
beforeEach(() => { mockSnapshot.reports.money = { malo_cents_7d: 0 }; mockSnapshot.reports.engagement = {}; });

it.each(Object.entries(destinations))('renders the distinct %s report', async (page, title) => {
  const Screen = report();
  await render(<Screen page={page} />);
  expect(screen.getByRole('header', { name: title })).toBeTruthy();
});

it('keeps the whole analytics catalog and eight dashboards available without named donation rankings', async () => {
  const Screen = report();
  await render(<Screen page="analytics" />);
  for (const title of ['Highlights', 'Donations', 'Audience', 'Attention', 'Trust', 'Live games', 'Playback', 'Ledger', 'Measure catalog', 'List catalog', 'Not measured']) {
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  }
  expect(screen.queryByText('Private athlete donation total')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Donations' }));
  expect(screen.getAllByText(/Needs the 2026-10-12 reports update/).length).toBeGreaterThan(0);
});

it('switches Health panels while retaining their detail rows', async () => {
  const Screen = report();
  await render(<Screen page="health" />);
  mockSnapshot.reports.reliability = { events_24h: 92 };
  await fireEvent.press(screen.getByRole('tab', { name: 'Errors' }));
  expect(screen.getByRole('tab', { name: 'Errors' }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Data for Additional measures' }));
  expect(screen.getByText('92')).toBeTruthy();
});

it('opens existing editing desks from Product instead of creating a second control plane', async () => {
  const Screen = report();
  await render(<Screen page="features" />);
  await fireEvent.press(screen.getByRole('link', { name: 'Open Features desk' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/features');
});

it('keeps selected and focused report links valid through the actual Expo Slot', async () => {
  const Link = require('../AdminReportSection').AdminReportLink;
  await render(<Link href="/admin/trends" label="Open Trends" selected />);
  const link = screen.getByRole('link', { name: 'Open Trends' });
  expect(link).toHaveStyle({ minHeight: 44, minWidth: 44 });
  await fireEvent(link, 'focus');
  expect(screen.getByRole('link', { name: 'Open Trends' })).toHaveStyle({ backgroundColor: '#e6f4ec' });
  await fireEvent.press(screen.getByRole('link', { name: 'Open Trends' }));
  expect(mockRouter.push).toHaveBeenLastCalledWith('/admin/trends');
});

it('shows the complete Home donation hero, clip comparison and at-a-glance sentence', async () => {
  Object.assign(mockSnapshot.reports.money, { malo_cents_7d: 75000, malo_cents_prev_7d: 60000, malo_count_7d: 162 });
  Object.assign(mockSnapshot.reports.engagement, { clips_7d: 214, clips_prev_7d: 181 });
  const Screen = report(); await render(<Screen page="home" />);
  expect(screen.getByText('162 donations recorded')).toBeTruthy();
  expect(screen.getByText('+25% versus the prior week')).toBeTruthy();
  expect(screen.getByText('+18%')).toBeTruthy();
  expect(screen.getByText('Prior 7 days: 181 clips.')).toBeTruthy();
  expect(screen.getByText('Last 7 days: 214 clips.')).toBeTruthy();
  expect(screen.getByText('$750.00 in recorded donations and 214 clips uploaded over the last 7 days.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'View Trends' }));
  expect(mockRouter.push).toHaveBeenLastCalledWith('/admin/trends');
});

it('does not invent a growth percent when the prior donation week is zero', async () => {
  Object.assign(mockSnapshot.reports.money, { malo_cents_7d: 500, malo_cents_prev_7d: 0, malo_count_7d: 1 });
  Object.assign(mockSnapshot.reports.engagement, { clips_7d: 1, clips_prev_7d: 0 });
  const Screen = report(); await render(<Screen page="home" />);
  expect(screen.getByText('1 donation recorded')).toBeTruthy();
  expect(screen.getAllByText('Prior week was zero; no percent comparison').length).toBeGreaterThan(0);
  expect(screen.queryByText('+100%')).toBeNull();
});

it('retains native font fitting and the full spoken value for large report figures', async () => {
  const Kpi = require('../AdminReportSection').AdminReportKpi;
  await render(<Kpi item={{ label: 'Gross volume', value: '$9,999,999.99' }} />);
  const value = screen.getByLabelText('Gross volume: $9,999,999.99');
  expect(value.props.numberOfLines).toBe(1); expect(value.props.adjustsFontSizeToFit).toBe(true);
  expect(screen.getByText('$9,999,999.99')).toBeTruthy();
});


it('offers section shortcuts on longer reports without opening another route', async () => {
  const Screen = report(); await render(<Screen page="revenue" />);
  const shortcuts = within(screen.getByLabelText('In this report'));
  await fireEvent.press(shortcuts.getByRole('button', { name: 'Streams' }));
  expect(screen.getByRole('header', { name: 'Streams' })).toBeTruthy();
});

it('lets Home refresh its snapshots and locks refresh while a read is in progress', async () => {
  const Screen = report(); mockRefresh.mockClear();
  const view = await render(<Screen page="home" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh report' }));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  mockSnapshot.loading = true;
  await view.rerender(<Screen page="home" />);
  expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Refreshing…' }));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  mockSnapshot.loading = false;
});

it('shows one Analytics board at a time while preserving every board and catalog', async () => {
  const Screen = report(); await render(<Screen page="analytics" />);
  expect(screen.getByRole('header', { name: 'Highlights' })).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'Playback' })).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Playback' }));
  expect(screen.getByRole('header', { name: 'Playback' })).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'Highlights' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Data for Measure catalog' }).props.accessibilityState.expanded).toBe(false);
});

it('keeps future uncataloged numeric keys visible in Analytics', async () => {
  mockSnapshot.reports.engagement = { future_counter: 83 };
  const Screen = report(); await render(<Screen page="analytics" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Data for Engagement' }));
  expect(screen.getByText('83')).toBeTruthy();
});

it('makes Product the canonical menu destination and removes the duplicate Health button-row disclosure', async () => {
  const Screen = report(); await render(<Screen page="health" />);
  expect(screen.queryByRole('tab', { name: 'Menus' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Published menus in Product' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'Buttons' }));
  expect(screen.queryByText('Every row')).toBeNull();
});
