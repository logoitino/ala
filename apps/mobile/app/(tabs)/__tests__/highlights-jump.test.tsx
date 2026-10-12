import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import HighlightsTab from '../index';

/**
 * Covers the two Highlights jump defects found in the 2026-09-25 audit:
 *  1. a search result must land even when the target pill is already active
 *  2. Spotlight "Watch Full Highlight" must not silently no-op when the award's
 *     clip is filtered out of the current feed
 */

const mockPush = jest.fn();

// A spotlight award the individual tests reshape before rendering.
const mockSpotlight: {
  award: Record<string, unknown> | null;
  visible: boolean;
  dismiss: jest.Mock;
} = { award: null, visible: false, dismiss: jest.fn(async () => undefined) };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => true }));
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
jest.mock('@/components/TipSheetModal', () => ({ MaloTipModal: () => null }));
jest.mock('@/components/Reels/ReelPage', () => {
  const { View } = require('react-native');
  return { ReelPage: ({ children }: { children?: React.ReactNode }) => <View>{children}</View> };
});

// The only signal the tests need: which clip the pager considers active.
jest.mock('@/components/Reels/ReelCard', () => {
  const { Text: RNText } = require('react-native');
  return {
    ReelCard: ({ clip, active }: { clip: { id: string }; active: boolean }) =>
      active ? <RNText>{`active:${clip.id}`}</RNText> : null,
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

const mockAuth = { user: null, profile: null, loading: false };
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
jest.mock('@/lib/crew', () => ({ fetchSquadAthleteIds: jest.fn(async () => []) }));
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
  await render(<HighlightsTab />);
  const layoutHosts = collectLayoutHosts(screen.root);
  expect(layoutHosts.length).toBeGreaterThan(0);
  for (const host of layoutHosts) {
    await fireEvent(host, 'layout', { nativeEvent: { layout: { width: 390, height: 800 } } });
  }
  await waitFor(() => expect(pill('Home')).toBeTruthy());
  expect(screen.queryByRole('tab', { name: /^All,/ })).toBeNull();
  expect(screen.queryByRole('tab', { name: /^Seki,/ })).toBeNull();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSpotlight.award = null;
  mockSpotlight.visible = false;
  mockSpotlight.dismiss = jest.fn(async () => undefined);
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
