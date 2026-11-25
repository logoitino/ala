/** Home keeps pager geometry and playback intact across guest entry, feed switches and navigation. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import HighlightsTab from '../index';
import { FlatList } from 'react-native';
import { FUN_IDS } from '@/lib/__fixtures__/fanZoneFixtures';
let mockRealDiscovery = false;
let mockDockHeight = 92;
jest.mock('@/context/FanNavigationContext', () => ({ useFanDockHeight: () => mockDockHeight }));
const mockDiscoveryReads: string[] = [];
jest.mock('@/services/MediaUploadService', () => ({ bytesFromUri: jest.fn(), compressHighlight: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: async (fn: string) => {
  mockDiscoveryReads.push(fn);
  const s = jest.requireActual('@/lib/__fixtures__/fanZoneFixtures').fanSnapshotFixture();
  return { data: fn === 'fun_snapshot' ? { ...s, campaign: { ...s.campaign!, status: 'paused' }, entry: null, candidates: [], can_participate: false, guardian_queue: [s.entry] }
    : { availability: 'paused', testing_only: true, week_start: '2026-10-12', week_end: '2026-10-19', status: 'unavailable', sports: [], attempt: null, badges: [], corrections: [] }, error: null };
} } }));

/**
 * Covers the two Highlights jump defects found in the 2026-09-25 audit:
 *  1. a search result must land even when the target pill is already active
 *  2. Spotlight "Watch Full Highlight" must not silently no-op when the award's
 *     clip is filtered out of the current feed
 * Also covers the Beyond switch on the Home bar (owner 2026-10-16): workout + service clips only,
 * a link to the Beyond the Game page, and no switch while Beyond is paused.
 */

const mockPush = jest.fn();
let mockWelcome: string | undefined;
const mockSquad = jest.fn<Promise<string[]>, [string | undefined]>(async () => []);
const mockRankContexts: Array<{ crewIds: Set<string> }> = [];
jest.mock('@/data/highlights', () => {
  const actual = jest.requireActual('@/data/highlights');
  return { ...actual, rankHomeFeed: (...args: unknown[]) => { mockRankContexts.push(args[1] as { crewIds: Set<string> }); return actual.rankHomeFeed(...args); }, rankHomeFeedWithReasons: (...args: unknown[]) => { mockRankContexts.push(args[1] as { crewIds: Set<string> }); return actual.rankHomeFeedWithReasons(...args); } };
});

// A spotlight award the individual tests reshape before rendering.
const mockSpotlight: {
  award: Record<string, unknown> | null;
  visible: boolean;
  dismiss: jest.Mock;
} = { award: null, visible: false, dismiss: jest.fn(async () => undefined) };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }), useIsFocused: () => true, useLocalSearchParams: () => ({ welcome: mockWelcome }),
}));
jest.mock('@/hooks/useReelViewTracker', () => ({ useReelViewTracker: jest.fn() }));
jest.mock('expo-video', () => ({ clearVideoCacheAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Chrome and media we don't assert on.
jest.mock('@/components/TabScreen', () => {
  const { View } = require('react-native');
  return { TabScreen: ({ children }: { children?: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/Reels/LiveMatchBanner', () => ({ LiveMatchBanner: () => null }));
jest.mock('@/components/Local/RivalryWeekBanner', () => ({ RivalryWeekBanner: () => null }));
jest.mock('@/components/Rally/RallyMeter', () => ({ RallyMeter: () => null }));
jest.mock('@/components/Onboarding/SlangGuideBanner', () => ({ SlangGuideBanner: () => null }));
jest.mock('@/components/FamilyFun/FamilyFunDiscovery', () => ({ FamilyFunDiscovery: () => {
  if (mockRealDiscovery) { const Actual = jest.requireActual('@/components/FamilyFun/FamilyFunDiscovery').FamilyFunDiscovery; return <Actual />; }
  const { Text } = require('react-native');
  return <Text>Optional quiz discovery</Text>;
} }));
jest.mock('@/components/TipSheetModal', () => ({ MaloTipModal: () => null }));
// Phone-pager suite: stub the desktop card column so OfflineQueue/NetInfo never boots on import.
jest.mock('@/components/Reels/DesktopHighlightFeed', () => ({ DesktopHighlightFeed: () => null }));
jest.mock('@/hooks/useAppViewport', () => ({
  useWebDesktopMode: () => 'mobile',
  webDesktopMode: () => 'mobile',
}));
jest.mock('@/components/Reels/ReelPage', () => {
  const { View, Text } = require('react-native');
  return { ReelPage: ({ children, peekInsetTop, peekInsetBottom, height }: { children?: React.ReactNode; peekInsetTop: number; peekInsetBottom: number; height: number }) => <View testID="measured-reel-page" height={height} peekInsetBottom={peekInsetBottom}><Text>{`peek:${peekInsetTop}`}</Text>{children}</View> };
});

// The only signal the tests need: which clip the pager considers active.
jest.mock('@/components/Reels/ReelCard', () => {
  const { Text: RNText } = require('react-native');
  return {
    ReelCard: ({ clip, active, height, overlayInsetBottom, welcomePoster }: { clip: { id: string }; active: boolean; height: number; overlayInsetBottom: number; welcomePoster?: boolean }) =>
      active ? <RNText testID="active-reel-card" height={height} overlayInsetBottom={overlayInsetBottom} welcomePoster={welcomePoster}>{`active:${clip.id}`}</RNText> : null,
  };
});

// Stand-ins that expose the two entry points under test as plain buttons.
jest.mock('@/components/Reels/HomeSearchOverlay', () => {
  const { View } = require('react-native');
  const { HapticPressable: P } = require('@/components/UI/HapticPressable');
  const { Text: RNText } = require('react-native');
  return {
    HomeSearchOverlay: ({
      open,
      clips,
      onSelectClip,
    }: {
      open: boolean;
      clips: { clip: { id: string } }[];
      onSelectClip: (id: string) => void;
    }) =>
      open ? (
        <View>
          {clips.map((item) => (
            <P
              key={item.clip.id}
              accessibilityRole="button"
              accessibilityLabel={`search-result-${item.clip.id}`}
              onPress={() => onSelectClip(item.clip.id)}
            >
              <RNText>{item.clip.id}</RNText>
            </P>
          ))}
        </View>
      ) : null,
  };
});

jest.mock('@/components/Spotlight/SpotlightModal', () => {
  const { View, Text: RNText } = require('react-native');
  const { HapticPressable: P } = require('@/components/UI/HapticPressable');
  return {
    SpotlightModal: ({
      visible,
      award,
      onWatch,
    }: {
      visible: boolean;
      award: { reel_id?: string; player?: { id?: string } } | null;
      onWatch: (reelId?: string | null, playerId?: string) => void;
    }) =>
      visible ? (
        <View>
          <P
            accessibilityRole="button"
            accessibilityLabel="watch-full-highlight"
            onPress={() => onWatch(award?.reel_id ?? null, award?.player?.id)}
          >
            <RNText>Watch Full Highlight</RNText>
          </P>
        </View>
      ) : null,
  };
});

let mockAuth: { user: { id: string } | null; profile: { id: string; user_id: string } | null; loading: boolean; isGuest: boolean } = { user: null, profile: null, loading: false, isGuest: true };
const mockSoftWall = { requireAuth: jest.fn() };
const mockUploadSheet = { subscribeUploaded: () => () => undefined };
const mockRuntime = {
  live: {
    tabs: { home: true, local: true, activity: true, spotlight: true, drip: true, profile: true, upload: true },
    layouts: { homeSearch: true, liveMatches: false, spotlightModal: true },
    copy: { homeBannerTitle: '', homeBannerBody: '', homeKicker: '', homeLede: '', homeEmpty: 'No clips' },
    theme: { text: '#000000' },
  },
};

jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => mockSoftWall }));
jest.mock('@/context/UploadSheetContext', () => ({ useUploadSheet: () => mockUploadSheet }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => mockRuntime }));

// These must return *stable* references. The tab memoises `clips` and `feed` on them,
// and defect 1 only reproduces when `feed` keeps its identity across a re-render — a mock
// that returns a fresh [] each call would silently paper over the bug being guarded here.
const mockRoster = { players: [], applyBackerCount: jest.fn() };
const mockReels = {
  reels: [] as unknown[],
  loading: false,
  error: null as string | null,
  refresh: jest.fn(async () => undefined),
  setReels: jest.fn(),
  applyReelHype: jest.fn(),
  applyReelTips: jest.fn(),
};
const mockTipHistory = { receipts: [] };
const mockLiveGame = { gameId: null };
const mockSurfaceUsage = { noteScrollPct: jest.fn(), trackFeature: jest.fn() };

jest.mock('@/hooks/useRoster', () => ({ useRoster: () => mockRoster }));
jest.mock('@/hooks/useReels', () => ({ useReels: () => mockReels }));
jest.mock('@/hooks/useFanTipHistory', () => ({ useFanTipHistory: () => mockTipHistory }));
jest.mock('@/hooks/useLiveGame', () => ({ useLiveGame: () => mockLiveGame }));
jest.mock('@/hooks/useSurfaceUsage', () => ({ useSurfaceUsage: () => mockSurfaceUsage }));
jest.mock('@/hooks/useActiveSpotlight', () => ({ useActiveSpotlight: () => mockSpotlight }));
jest.mock('@/lib/crew', () => ({ fetchSquadAthleteIds: (id: string | undefined) => mockSquad(id) }));
jest.mock('@/lib/reels', () => ({
  ...jest.requireActual('@/lib/reels'),
  readHiddenReelIds: jest.fn(async () => []),
  reelHiddenForUser: () => false,
}));

// Pills announce their clip count too ("All, 5 clips"), so match on the leading label.
const pill = (label: string) => screen.getByRole('tab', { name: new RegExp(`^${label},`) });
const searchToggle = () => screen.getByLabelText('Search clips and athletes');

/**
 * The feed is gated on `pageHeight > 0 && cacheReady`. `onLayout` never fires under
 * Jest, so drive it by hand — the repo has no testID convention, so target the
 * elements that actually carry an onLayout handler.
 */
type HostNode = Parameters<typeof fireEvent>[0];
type TreeNode = { props?: Record<string, unknown>; children?: unknown[] };

function collectLayoutHosts(node: unknown, out: HostNode[] = []): HostNode[] {
  if (!node || typeof node !== 'object') return out;
  const candidate = node as TreeNode;
  if (typeof candidate.props?.onLayout === 'function') out.push(candidate as HostNode);
  for (const child of candidate.children ?? []) collectLayoutHosts(child, out);
  return out;
}

async function mountTab() {
  const view = await render(<HighlightsTab />);
  const layoutHosts = collectLayoutHosts(screen.root);
  expect(layoutHosts.length).toBeGreaterThan(0);
  for (const host of layoutHosts) {
    await fireEvent(host, 'layout', { nativeEvent: { layout: { width: 390, height: 800 } } });
  }
  await waitFor(() => expect(pill('Home')).toBeTruthy());
  expect(screen.queryByRole('tab', { name: /^All,/ })).toBeNull();
  expect(screen.queryByRole('tab', { name: /^Seki,/ })).toBeNull();
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWelcome = undefined;
  mockReels.reels = [];
  mockReels.loading = false;
  mockReels.error = null;
  mockAuth = { user: null, profile: null, loading: false, isGuest: true };
  mockRealDiscovery = false; mockSquad.mockReset().mockResolvedValue([]); mockRankContexts.length = 0;
  (mockRuntime.live.tabs as Record<string, boolean>).beyond = false;
  mockSpotlight.award = null;
  mockSpotlight.visible = false;
  mockSpotlight.dismiss = jest.fn(async () => undefined);
});

it('keeps the welcome art through loading and retry, then opens the public video without an account or Spotlight prompt', async () => {
  mockWelcome = 'highlights';
  mockReels.loading = true;
  mockSpotlight.visible = true;
  const view = await render(<HighlightsTab />);
  await fireEvent(screen.getByTestId('home-pager-viewport'), 'layout', { nativeEvent: { layout: { width: 390, height: 800 } } });
  expect(screen.getByRole('header', { name: 'Getting Highlights ready' })).toBeTruthy();
  expect(screen.queryByTestId('active-reel-card')).toBeNull();

  mockReels.loading = false;
  mockReels.error = 'Fixture connection failed';
  await view.rerender(<HighlightsTab />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Retry Highlights' }));
  expect(mockReels.refresh).toHaveBeenCalledTimes(1);

  mockReels.error = null;
  mockReels.reels = [
    { id: 'vault', title: 'Locked clip', is_vault_only: true, video_url: 'https://example.test/vault.mp4' },
    { id: 'public', title: 'Public clip', video_url: 'https://example.test/public.mp4' },
  ];
  await view.rerender(<HighlightsTab />);
  expect(await screen.findByText('active:public')).toBeTruthy();
  expect(screen.getByTestId('active-reel-card').props.welcomePoster).toBe(true);
  expect(screen.queryByLabelText('watch-full-highlight')).toBeNull();
  expect(mockSoftWall.requireAuth).not.toHaveBeenCalled();
});

it('includes optional discovery inside measured chrome without changing the reel viewport', async () => {
  await mountTab();
  let host: typeof screen.root | null = screen.getByText('Optional quiz discovery');
  while (host && typeof host.props.onLayout !== 'function') host = host.parent;
  expect(host).not.toBeNull();
  await fireEvent(host!, 'layout', { nativeEvent: { layout: { width: 390, height: 240 } } });
  expect(screen.getAllByText('peek:252').length).toBeGreaterThan(0);
});

describe('Highlights search jump', () => {
  // The feed sets initialNumToRender={2}, and Jest has no real scrolling to advance the
  // window, so assertions target a clip inside the initial window (hl-2 is index 1 on All).
  it('lands on the tapped clip from Home', async () => {
    await mountTab();

    await fireEvent.press(searchToggle());
    await fireEvent.press(screen.getByLabelText('search-result-hl-2'));

    await waitFor(() => expect(screen.getByText('active:hl-2')).toBeTruthy());
  });
});

describe('Spotlight Watch Full Highlight from the Highlights tab', () => {
  it('lands on the award clip from Home', async () => {
    mockSpotlight.award = { reel_id: 'hl-2', player: { id: 'not-a-uuid', name: 'Jordan Blake' } };
    mockSpotlight.visible = true;

    await mountTab();
    await fireEvent.press(screen.getByLabelText('watch-full-highlight'));

    await waitFor(() => expect(screen.getByText('active:hl-2')).toBeTruthy());
  });

  it('falls back to the athlete profile when no clip matches at all', async () => {
    const playerId = '11111111-2222-4333-8444-555555555555';
    mockSpotlight.award = {
      reel_id: 'missing-clip',
      player: { id: playerId, name: 'Nobody In The Feed' },
    };
    mockSpotlight.visible = true;

    await mountTab();
    await fireEvent.press(screen.getByLabelText('watch-full-highlight'));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(String(mockPush.mock.calls[0][0])).toContain(playerId);
  });
});

describe('Beyond switch on the Home bar', () => {
  it('plays only workout and service clips and links to the Beyond the Game page', async () => {
    (mockRuntime.live.tabs as Record<string, boolean>).beyond = true;
    await mountTab();

    await fireEvent.press(pill('Beyond'));
    await waitFor(() => expect(screen.getByText('active:hl-3')).toBeTruthy());
    expect(screen.queryByText('active:hl-1')).toBeNull();

    await fireEvent.press(screen.getByLabelText(/^Open Beyond the Game: fan workouts/));
    expect(mockPush).toHaveBeenCalledWith('/beyond');
  });

  it('hides the Beyond switch while Beyond is paused', async () => {
    await mountTab();
    expect(screen.queryByRole('tab', { name: /^Beyond,/ })).toBeNull();
  });
it('actual Home keeps private Fan review inside measured chrome and preserves search/feed', async () => {
  mockRealDiscovery = true; mockAuth = { user: { id: 'auth-a' }, profile: { id: 'profile-a', user_id: 'auth-a' }, loading: false, isGuest: false };
  await mountTab();
  const review = await screen.findByRole('button', { name: 'Review fan permissions' });
  let host: typeof screen.root | null = review;
  while (host && typeof host.props.onLayout !== 'function') host = host.parent;
  expect(host).not.toBeNull();
  await fireEvent(host!, 'layout', { nativeEvent: { layout: { width: 390, height: 300 } } });
  expect(screen.getAllByText('peek:312').length).toBeGreaterThan(0);
  await fireEvent.press(review);
  expect(mockPush).toHaveBeenCalledWith(`/fan-zone?campaign=${FUN_IDS.campaign}&section=permissions`);
  expect(searchToggle()).toBeTruthy(); expect(pill('Home')).toBeTruthy();
  expect(mockDiscoveryReads.every(fn => ['fun_snapshot', 'quiz_snapshot'].includes(fn))).toBe(true);
});
});

it('keeps full media height and clears caption/peek by the measured dock, then realigns the active page on resize', async () => {
 const scroll=jest.spyOn(FlatList.prototype,'scrollToOffset');
 const renderPager=jest.spyOn(FlatList.prototype,'render');
 await mountTab();
 await fireEvent.press(searchToggle());
 await fireEvent.press(screen.getByLabelText('search-result-hl-2'));
 await waitFor(() => expect(screen.getByText('active:hl-2')).toBeTruthy());
 scroll.mockClear();
 await fireEvent(screen.getByTestId('home-pager-viewport'),'layout',{nativeEvent:{layout:{width:320,height:640}}});
 await waitFor(() => expect(scroll).toHaveBeenCalledWith({offset:640,animated:false}));
 expect(screen.getByTestId('active-reel-card').props).toMatchObject({height:640,overlayInsetBottom:mockDockHeight+8});
 for(const page of screen.getAllByTestId('measured-reel-page')) expect(page.props).toMatchObject({height:640,peekInsetBottom:mockDockHeight+12});
 const pager=renderPager.mock.contexts[renderPager.mock.contexts.length-1] as FlatList;
 expect(pager.props.snapToInterval).toBe(640);
 expect(pager.props.getItemLayout!(pager.props.data!,1)).toEqual({length:640,offset:640,index:1});
 scroll.mockRestore();
 renderPager.mockRestore();
});

it('masks outgoing Crew immediately while the incoming account read is pending', async () => {
  mockAuth = { user: { id: 'auth-a' }, profile: null, loading: false, isGuest: false };
  mockSquad.mockResolvedValueOnce(['athlete-a']).mockImplementationOnce(() => new Promise(() => undefined));
  const view = await mountTab();
  await waitFor(() => expect(mockRankContexts.at(-1)?.crewIds.has('athlete-a')).toBe(true));
  mockAuth = { user: { id: 'auth-b' }, profile: null, loading: false, isGuest: false };
  await view.rerender(<HighlightsTab />);
  expect(mockRankContexts.at(-1)?.crewIds.size).toBe(0);
});

it('ignores an outgoing pull-refresh Crew result after the account changes', async () => {
  let finish!: (ids: string[]) => void;
  mockAuth = { user: { id: 'auth-a' }, profile: null, loading: false, isGuest: false };
  mockSquad.mockResolvedValueOnce(['athlete-a']).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
    .mockImplementationOnce(() => new Promise(() => undefined));
  const pagerRender = jest.spyOn(FlatList.prototype, 'render');
  const view = await mountTab();
  await waitFor(() => expect(mockRankContexts.at(-1)?.crewIds.has('athlete-a')).toBe(true));
  const pager = pagerRender.mock.contexts.at(-1) as FlatList;
  await act(async () => { pager.props.refreshControl!.props.onRefresh(); });
  await waitFor(() => expect(mockSquad).toHaveBeenCalledTimes(2));
  mockAuth = { user: { id: 'auth-b' }, profile: null, loading: false, isGuest: false };
  await view.rerender(<HighlightsTab />);
  await act(async () => { finish(['outgoing-refresh']); });
  expect(mockRankContexts.at(-1)?.crewIds.has('outgoing-refresh')).toBe(false);
  pagerRender.mockRestore();
});
