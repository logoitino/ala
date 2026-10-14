/** Shared report chrome must navigate every desk, retain actions and satisfy Expo's actual Slot style contract. */
import { act, fireEvent, render, screen, within, type RenderResult } from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';
import {
  AdminBtn, AdminPage, AdminPills, AdminPublishBar, AdminReportHeader, AdminTrail,
} from '@/components/Admin/AdminChrome';
import { DEFAULT_APP_RUNTIME } from '@/lib/runtime';

let mockPathname = '/admin';
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn<Promise<void>, []>();
const mockRequireAuth = jest.fn();
let mockManageProps: { 'aria-expanded'?: boolean } = {};
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = require('react');
  const NativePressable = jest.requireActual('react-native/Libraries/Components/Pressable/Pressable').default;
  return { __esModule: true, default: React.forwardRef((props: { accessibilityLabel?: string; 'aria-expanded'?: boolean }, ref: unknown) => {
    // Native drops this web-only prop before the host tree, so inspect the boundary and retain the actual renderer.
    if (props.accessibilityLabel === 'Manage desks') mockManageProps = props;
    return React.createElement(NativePressable, { ...props, ref });
  }) };
});
let mockLens = 'all';
let mockUser: { id: string } | null = null;
let mockCanGoBack = false;
let mockRuntime = {
  live: DEFAULT_APP_RUNTIME, dirty: false, pendingCount: 0, publishedAt: null as string | null,
  saveError: null as string | null, publishLive: jest.fn<Promise<void>, []>(), discardDraft: jest.fn<Promise<void>, []>(),
};
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => mockRuntime }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true, loading: false, user: mockUser, signOut: mockSignOut }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/context/AdminLensContext', () => ({ useAdminLens: () => ({ lens: mockLens, setLens: jest.fn() }) }));
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
  // Keep navigation synthetic, but use Expo's real Slot so invalid child styles cannot hide behind the router mock.
  Link: ({ href, children }: { href: string; children: React.ReactElement<{ href?: string; onPress?: () => void }> }) =>
    require('react').createElement(jest.requireActual('expo-router/build/ui/Slot').Slot,
      { href, onPress: () => mockPush(href) }, children),
}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('@/lib/spotlight', () => ({ parseSpotlightAward: jest.fn(), utcWeekStart: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

function descendants(node: RenderResult['container']): RenderResult['container'][] {
  return [node, ...node.children.flatMap((child) => typeof child === 'string' ? [] : descendants(child))];
}

beforeEach(() => {
  mockLens = 'all'; mockPathname = '/admin'; mockCanGoBack = false; mockUser = null; jest.clearAllMocks();
  mockManageProps = {};
  mockSignOut.mockReset().mockResolvedValue(undefined);
  mockRuntime = { ...mockRuntime, dirty: false, pendingCount: 0, saveError: null,
    publishLive: jest.fn().mockResolvedValue(undefined), discardDraft: jest.fn().mockResolvedValue(undefined) };
});

it('places one report header within the existing editor page scroll owner', async () => {
  await render(<AdminPage title="Games" lede="Manage the board"><Text>Game editor</Text></AdminPage>);
  expect(screen.getByRole('link', { name: 'Trends' })).toBeTruthy();
  expect(descendants(screen.container).filter((node) => node.type === 'RCTScrollView')).toHaveLength(1);
});

it('opens each main report and keeps Product selected on a child report', async () => {
  mockPathname = '/admin/product/profile';
  await render(<AdminReportHeader />);
  expect(screen.getByRole('link', { name: 'Product' }).props['aria-current']).toBe(true);
  expect(screen.getByRole('link', { name: 'Profile' }).props['aria-current']).toBe('page');
  for (const [label, path] of [['Home', '/admin'], ['Trends', '/admin/trends'], ['Audience', '/admin/audience'],
    ['Revenue', '/admin/revenue'], ['Health', '/admin/health'], ['Product', '/admin/product'],
    ['Analytics', '/admin/analytics'], ['Departments', '/admin/departments']]) {
    await fireEvent.press(screen.getByRole('link', { name: label }));
    expect(mockPush).toHaveBeenLastCalledWith(path);
  }
});

it('keeps the brand and report navigation in the same wrapping header row', async () => {
  await render(<AdminReportHeader />);
  const navigation = screen.getByLabelText('Admin reports');
  const brand = screen.getByRole('link', { name: 'Admin home' });
  expect(navigation.parent).toBe(brand.parent);
  expect(screen.getByText('Main Admin')).toBeTruthy();
  expect(screen.queryByRole('tab')).toBeNull();
});

it('exposes Manage desks expansion to web and native accessibility while toggling its menu', async () => {
  await render(<AdminReportHeader />);
  expect(mockManageProps['aria-expanded']).toBe(false);
  expect(screen.getByRole('button', { name: 'Manage desks' }).props.accessibilityState.expanded).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  expect(mockManageProps['aria-expanded']).toBe(true);
  expect(screen.getByRole('button', { name: 'Manage desks' }).props.accessibilityState.expanded).toBe(true);
  expect(screen.getByLabelText('Desk groups')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  expect(mockManageProps['aria-expanded']).toBe(false);
  expect(screen.queryByLabelText('Desk groups')).toBeNull();
});

it('renders selected and focused route links through the actual Expo Slot while retaining their hit targets', async () => {
  mockPathname = '/admin/product/profile';
  await render(<AdminReportHeader />);
  for (const name of ['Admin home', 'Product', 'Profile', 'Open production app']) {
    const link = screen.getByRole('link', { name });
    expect(link).toHaveStyle({ minHeight: 44 });
  }
  await fireEvent(screen.getByRole('link', { name: 'Profile' }), 'focus');
  expect(screen.getByRole('link', { name: 'Profile' })).toHaveStyle({ borderColor: '#00733c', minHeight: 44 });
  await fireEvent.press(screen.getByRole('link', { name: 'Profile' }));
  expect(mockPush).toHaveBeenLastCalledWith('/admin/product/profile');
});

it('shows route-link keyboard focus and clears that indicator on blur', async () => {
  await render(<AdminReportHeader />);
  await fireEvent(screen.getByRole('link', { name: 'Revenue' }), 'focus');
  expect(screen.getByRole('link', { name: 'Revenue' })).toHaveStyle({ borderColor: '#00733c' });
  await fireEvent(screen.getByRole('link', { name: 'Revenue' }), 'blur');
  expect(screen.getByRole('link', { name: 'Revenue' })).toHaveStyle({ borderColor: 'transparent' });
});

it('omits Sign out when Studio has no authenticated account', async () => {
  await render(<AdminReportHeader />);
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
});

it('opens existing Sign in for a Studio guest and resumes at admin without granting access', async () => {
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(mockRequireAuth).toHaveBeenCalledTimes(1);
  const intent = mockRequireAuth.mock.calls[0][0];
  expect(intent.kind).toBe('signin');
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => intent.resume());
  expect(mockReplace).toHaveBeenLastCalledWith('/admin');
});

it('omits Sign in when an account already exists', async () => {
  mockUser = { id: 'synthetic-admin' };
  await render(<AdminReportHeader />);
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(mockRequireAuth).not.toHaveBeenCalled();
});

it('runs the existing Sign out once, locks the button, and returns Home after it succeeds', async () => {
  mockUser = { id: 'synthetic-admin' };
  let finish!: () => void;
  mockSignOut.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await render(<AdminReportHeader />);
  expect(mockSignOut).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Signing out…' }));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('shows a failed Sign out and keeps the existing account and retry on screen', async () => {
  mockUser = { id: 'synthetic-admin' };
  mockSignOut.mockRejectedValue(new Error('Could not end this session'));
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(screen.getByText('Could not end this session')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('opens the existing write desks and engineering utilities from the report header', async () => {
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Commerce' }));
  await fireEvent.press(screen.getByRole('link', { name: 'Payouts' }));
  expect(mockPush).toHaveBeenLastCalledWith('/admin/money');
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Tools' }));
  await fireEvent.press(screen.getByRole('link', { name: 'QA' }));
  expect(mockPush).toHaveBeenLastCalledWith('/admin/qa');
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Tools' }));

});

it('keeps every existing production desk reachable through its department menu', async () => {
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  const departments: [string, [string, string][]][] = [
    ['Operations', [['Live games', 'games'], ['Sports', 'sports'], ['Polls', 'polls'], ['Boosters', 'boosters'], ['Publish queue', 'publish']]],
    ['Content', [['Highlights & review', 'highlights'], ['Spotlight', 'spotlight']]],
    ['Commerce', [['Drip', 'drip'], ['Locker Room', 'wishlist'], ['Payouts', 'money'], ['Finance & Books', 'books']]],
    ['Audience', [['Athletes', 'athletes'], ['Schools', 'schools'], ['People', 'people']]],
    ['Growth', [['Feedback', 'feedback']]],
    ['System', [['App setup', 'features']]],
  ];
  for (const [department, desks] of departments) {
    await fireEvent.press(within(screen.getByLabelText('Desk groups')).getByRole('button', { name: department }));
    for (const [label, path] of desks) {
      await fireEvent.press(within(screen.getByLabelText('Production desks')).getByRole('link', { name: label }));
      expect(mockPush).toHaveBeenLastCalledWith(`/admin/${path}`);
      await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
    }
  }
});

it('retains Back fallback, history Back and the desk’s production-app target', async () => {
  mockPathname = '/admin/money';
  await render(<AdminTrail />);
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockPush).toHaveBeenLastCalledWith('/admin');
  mockCanGoBack = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockBack).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Open in app' }));
  expect(mockPush).toHaveBeenLastCalledWith('/receipts');
});

it('retains button and pill callbacks with native-size touch targets', async () => {
  const onSave = jest.fn(); const onFilter = jest.fn();
  await render(<><AdminBtn label="Save game" onPress={onSave} /><AdminPills
    items={[{ id: 'live', label: 'Live' }, { id: 'parked', label: 'Parked' }]}
    value="live" onChange={onFilter} /></>);
  await fireEvent.press(screen.getByRole('button', { name: 'Save game' }));
  await fireEvent.press(screen.getByRole('tab', { name: 'Parked' }));
  expect(onSave).toHaveBeenCalledTimes(1); expect(onFilter).toHaveBeenCalledWith('parked');
  for (const target of [screen.getByRole('button', { name: 'Save game' }), screen.getByRole('tab', { name: 'Parked' })]) {
    const styles = descendants(target).map((node) => StyleSheet.flatten(node.props.style));
    expect(styles.some((style) => style?.minHeight >= 44 && style?.minWidth >= 44)).toBe(true);
  }
});

it('starts Publish only on explicit activation and locks it until the promise settles', async () => {
  let finish!: () => void;
  mockRuntime.dirty = true; mockRuntime.pendingCount = 2;
  mockRuntime.publishLive.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await render(<AdminReportHeader />);
  expect(mockRuntime.publishLive).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Publish to app' }));
  expect(screen.getByRole('button', { name: 'Publishing…' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Publishing…' }));
  expect(mockRuntime.publishLive).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.getByRole('button', { name: 'Publish to app' })).toBeEnabled();
});

it('shows a rejected publication and leaves the retry available', async () => {
  mockRuntime.dirty = true; mockRuntime.pendingCount = 1;
  mockRuntime.publishLive.mockRejectedValue(new Error('Publish rejected'));
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Publish to app' }));
  expect(screen.getByText('Publish rejected')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Publish to app' })).toBeEnabled();
});

it('keeps clean drafts unpublishable and preserves the explicit discard action', async () => {
  const view = await render(<AdminPublishBar />);
  expect(screen.getByRole('button', { name: 'Already live' })).toBeDisabled();
  expect(mockRuntime.publishLive).not.toHaveBeenCalled();
  mockRuntime.dirty = true; mockRuntime.pendingCount = 1;
  await view.rerender(<AdminPublishBar />);
  await fireEvent.press(screen.getByRole('button', { name: 'Discard draft' }));
  expect(mockRuntime.discardDraft).toHaveBeenCalledTimes(1);
  expect(mockRuntime.publishLive).not.toHaveBeenCalled();
});

it('uses the editor’s Publish bar instead of rendering a competing Publish button in its header', async () => {
  mockPathname = '/admin/features'; mockRuntime.dirty = true; mockRuntime.pendingCount = 1;
  await render(<AdminPage title="Features" lede="Draft flags"><AdminPublishBar /></AdminPage>);
  expect(screen.getAllByRole('button', { name: 'Publish to app' })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Publish to app' }));
  expect(mockRuntime.publishLive).toHaveBeenCalledTimes(1);
});


it('browses desk groups without navigating away from the current report', async () => {
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.press(within(screen.getByLabelText('Desk groups')).getByRole('button', { name: 'Commerce' }));
  expect(mockPush).not.toHaveBeenCalled();
  expect(within(screen.getByLabelText('Production desks')).getByRole('link', { name: 'Payouts' })).toBeTruthy();
  expect(screen.getByText('Queue and review disbursements')).toBeTruthy();
});

it('finds desks by their description across groups and clears an empty search', async () => {
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.changeText(screen.getByLabelText('Find an admin desk'), '  DONATIONS  ');
  const results = within(screen.getByLabelText('Production desks'));
  expect(results.queryByRole('link', { name: 'Payouts' })).toBeNull();
  expect(results.getByRole('link', { name: 'Catalogs' })).toBeTruthy();
  expect(results.queryByRole('link', { name: 'Live games' })).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
  await fireEvent.press(results.getByRole('link', { name: 'Catalogs' }));
  expect(mockPush).toHaveBeenLastCalledWith('/admin/catalog');
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.changeText(screen.getByLabelText('Find an admin desk'), 'no desk has this name');
  expect(screen.getByText('No desks match this search. Try another name or clear the search.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByLabelText('Find an admin desk').props.value).toBe('');
  expect(within(screen.getByLabelText('Production desks')).getByRole('link', { name: 'Live games' })).toBeTruthy();
});

it('keeps search inside the chosen desk lens and retains QA utilities', async () => {
  mockLens = 'marketing';
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.changeText(screen.getByLabelText('Find an admin desk'), 'scoring');
  expect(within(screen.getByLabelText('Production desks')).queryByRole('link', { name: 'Sports' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Find an admin desk'), 'telemetry');
  expect(within(screen.getByLabelText('Production desks')).getByRole('link', { name: 'QA' })).toBeTruthy();
});


it('keeps the desk menu closed on editor arrival and closes it when navigating to another desk', async () => {
  mockPathname = '/admin/money';
  const view = await render(<AdminReportHeader />);
  expect(screen.queryByLabelText('Production desks')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  expect(within(screen.getByLabelText('Production desks')).getByRole('link', { name: 'Payouts' })).toBeTruthy();
  mockPathname = '/admin/people';
  await view.rerender(<AdminReportHeader />);
  expect(screen.queryByLabelText('Production desks')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  expect(within(screen.getByLabelText('Production desks')).getByRole('link', { name: 'People' })).toBeTruthy();
});

it('offers each engineering utility once and keeps reporting out of the editing directory', async () => {
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Tools' }));
  expect(screen.getAllByRole('link', { name: 'QA' })).toHaveLength(1);
  expect(screen.getAllByRole('link', { name: 'Studio' })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Growth' }));
  expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Find an admin desk'), 'reports');
  expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Analytics' })).toBeTruthy();
});


it('closes the directory when the already-selected desk is chosen again', async () => {
  mockPathname = '/admin/money';
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.press(screen.getByRole('link', { name: 'Payouts' }));
  expect(mockPush).toHaveBeenLastCalledWith('/admin/money');
  expect(screen.queryByLabelText('Production desks')).toBeNull();
});

it('provides one setup workspace with every existing draft editor on arrival', async () => {
  mockPathname = '/admin/look';
  await render(<AdminPage title="Look" lede="Edit presentation"><Text>Editor</Text></AdminPage>);
  const setup = within(screen.getByLabelText('App setup workspace'));
  for (const [label, path] of [['Features', 'features'], ['Look', 'look'], ['Catalogs', 'catalog'], ['Lab', 'lab']]) {
    await fireEvent.press(setup.getByRole('link', { name: label }));
    expect(mockPush).toHaveBeenLastCalledWith(`/admin/${path}`);
  }
});

it('finds merged workspace names and keeps Lab discoverable through every desk lens', async () => {
  mockLens = 'engineer';
  await render(<AdminReportHeader />);
  await fireEvent.press(screen.getByRole('button', { name: 'Manage desks' }));
  await fireEvent.changeText(screen.getByLabelText('Find an admin desk'), 'App setup');
  expect(within(screen.getByLabelText('Production desks')).getByRole('link', { name: 'App setup' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Find an admin desk'), 'Lab');
  expect(within(screen.getByLabelText('Production desks')).getByRole('link', { name: 'Lab' })).toBeTruthy();
});
