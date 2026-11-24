/**
 * `ReelCard` media branch (UX-05): a photo story renders `PhotoStoryMedia` and never creates an expo-video
 * player; its view counts after 3 s visible (VIEW_PLAY_MS) while the card is current and only once a photo
 * (or the cover) actually loaded. A video clip still gets
 * the player, and loads its source on activation (regression: the lazy-load ref was seeded with the URL, so
 * a card's first clip was never loaded).
 */
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ReelCard } from '@/components/Reels/ReelCard';
import type { HighlightClip, StoryPhoto } from '@/data/highlights';

const mockCreatePlayer = jest.fn();
const mockReplace = jest.fn(async () => undefined);
const mockTracker = jest.fn();
const mockOverlay = jest.fn();
const mockAuth = jest.fn();
const mockSaveDescription = jest.fn();
const mockVideoPlayer = { replaceAsync: mockReplace, play: jest.fn(), pause: jest.fn(), status: 'readyToPlay', playing: false, loop: false, muted: true, duration: 9 };
const mockVideoEvents: Record<string, (payload: any) => void> = {};

jest.mock('expo-video', () => {
  const { View } = jest.requireActual('react-native');
  return {
    useVideoPlayer: (source: unknown) => {
      mockCreatePlayer(source);
      return mockVideoPlayer;
    },
    VideoView: ({ style }: { style: import('react-native').StyleProp<import('react-native').ViewStyle> }) => <View testID="video-view" style={style} />,
  };
});
jest.mock('expo', () => ({ useEventListener: (_player: unknown, event: string, callback: (payload: any) => void) => { mockVideoEvents[event] = callback; } }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurTargetView: View, BlurView: View };
});
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = new Proxy({}, { get: () => () => chain });
  return {
    Gesture: { Tap: () => chain, Exclusive: () => chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/context/AppRuntimeContext', () => ({
  useAppRuntime: () => ({ live: { catalog: { exclusiveDollars: 5, exclusiveAura: 10 }, buttons: { suggest: false }, layouts: {} } }),
}));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/lib/postCaptions', () => ({ saveReelDescription: (...args: unknown[]) => mockSaveDescription(...args) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/CelebrationContext', () => ({ useOptionalCelebration: () => null }));
jest.mock('@/hooks/useAthleteSubscription', () => ({ useAthleteSubscription: () => ({ subscribed: null, grant: jest.fn() }) }));
jest.mock('@/hooks/useTipCheckout', () => ({ useTipCheckout: () => ({ startCheckout: jest.fn(), busy: false }) }));
jest.mock('@/hooks/useSavedReel', () => ({ useSavedReel: () => ({ saved: false, toggling: false, toggle: jest.fn() }) }));
jest.mock('@/hooks/useGameEventBroadcast', () => ({ useGameEventBroadcast: () => ({ lastEvent: null, clear: jest.fn() }) }));
jest.mock('@/hooks/useReelViewTracker', () => ({ useReelViewTracker: (...args: unknown[]) => mockTracker(...args) }));
jest.mock('@/lib/accountTags', () => ({ fetchReelAccountTags: async () => [] }));
jest.mock('@/lib/reelVotes', () => ({
  loadReelVotes: async () => ({ seki: false, aura: false, flex: false }),
  markReelVote: jest.fn(),
  clearReelVote: jest.fn(),
}));
jest.mock('@/services/TelemetryManager', () => ({
  telemetry: { track: jest.fn(), trackFeature: jest.fn(), trackIssue: jest.fn(), trackVideoStall: jest.fn() },
}));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: {} }));
jest.mock('@/components/Reels/ReelActionOverlay', () => ({
  ReelActionOverlay: (props: { onOpenMore: () => void }) => {
    const { Pressable } = jest.requireActual('react-native');
    mockOverlay(props);
    return <Pressable accessibilityLabel="Open Highlight actions" onPress={props.onOpenMore} />;
  },
}));
jest.mock('@/components/Reels/PhotoStoryMedia', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  const { useEffect } = jest.requireActual('react');
  return {
    PhotoStoryMedia: ({
      clip,
      onPhotoChange,
      onContentReady,
    }: {
      clip: HighlightClip;
      onPhotoChange?: (photo: StoryPhoto | null, i: number, n: number) => void;
      onContentReady?: () => void;
    }) => {
      useEffect(() => {
        onPhotoChange?.({ id: 'p0', position: 0, imageUrl: 'https://x/0.jpg', description: 'Food bank morning' }, 0, 3);
      }, [onPhotoChange]);
      return (
        <Pressable accessibilityLabel="simulate photo loaded" onPress={onContentReady}>
          <Text>{`photos:${clip.id}`}</Text>
        </Pressable>
      );
    },
  };
});
jest.mock('@/components/Filmers/FilmerSheet', () => ({ FilmerSheet: () => null }));
jest.mock('@/components/Reels/ReelMoreSheet', () => ({
  ReelMoreSheet: ({ visible, onEditDescription }: { visible: boolean; onEditDescription?: () => void }) => {
    const { Pressable } = jest.requireActual('react-native');
    return visible && onEditDescription ? <Pressable accessibilityLabel="Edit description" onPress={onEditDescription} /> : null;
  },
}));
jest.mock('@/components/Reels/ReportContentModal', () => ({ ReportContentModal: () => null }));
jest.mock('@/components/Feedback/SuggestionSheet', () => ({ SuggestionSheet: () => null }));
jest.mock('@/components/Effects/HypeBurst', () => ({ HypeBurst: () => null }));
jest.mock('@/components/Common/SwipeableBannerWrapper', () => ({ SwipeableBannerWrapper: () => null }));

const base: HighlightClip = {
  id: 'c1',
  athleteName: 'Sione',
  school: 'ALA',
  tag: 'Service day',
  videoUrl: '',
  playerId: 'p1',
  tagStatus: 'confirmed',
};

function renderCard(clip: HighlightClip, active = true) {
  return render(<ReelCard clip={clip} player={null} active={active} height={800} tipping={false} onTip={jest.fn()} />);
}

beforeEach(() => {
  mockCreatePlayer.mockReset();
  mockReplace.mockClear();
  mockReplace.mockImplementation(async () => undefined);
  mockVideoPlayer.play.mockClear(); mockVideoPlayer.pause.mockClear();
  mockVideoPlayer.status = 'readyToPlay'; mockVideoPlayer.playing = false;
  for (const key of Object.keys(mockVideoEvents)) delete mockVideoEvents[key];
  mockTracker.mockReset();
  mockOverlay.mockReset();
  mockSaveDescription.mockReset();
  mockAuth.mockReset().mockReturnValue({ user: { id: 'u1' }, profile: null, isAthlete: false });
});

describe('Highlight caption editing', () => {
  const owned = { ...base, id: 'feb80000-2530-4000-a000-000000000001',
    mediaType: 'photo_story' as const, uploadedBy: 'uploader', editCaptionSource: ' Original title ' };

  it('does not give the tagged athlete the uploader’s edit action', async () => {
    mockAuth.mockReturnValue({ user: { id: 'u1' }, profile: { id: 'tagged', user_id: 'u1' },
      isAthlete: true, isSessionCurrent: () => true });
    await renderCard(owned);
    await fireEvent.press(screen.getByLabelText('Open Highlight actions'));
    expect(screen.queryByLabelText('Edit description')).toBeNull();
    expect(mockSaveDescription).not.toHaveBeenCalled();
  });

  it('keeps the raw baseline, preserves the draft after failure and shows only the confirmed edit', async () => {
    mockAuth.mockReturnValue({ user: { id: 'u1' }, profile: { id: 'uploader', user_id: 'u1' },
      isAthlete: false, isSessionCurrent: () => true });
    mockSaveDescription.mockRejectedValueOnce(new Error('Draft still here')).mockResolvedValueOnce('New caption');
    await renderCard(owned);
    await fireEvent.press(screen.getByLabelText('Open Highlight actions'));
    await fireEvent.press(screen.getByLabelText('Edit description'));
    const field = screen.getByLabelText('Post description');
    expect(field.props.value).toBe(' Original title ');
    await fireEvent.changeText(field, '   New caption  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save description' }));
    expect(mockSaveDescription).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'u1', profileId: 'uploader' }),
      owned.id, ' Original title ', 'New caption');
    expect(screen.getByRole('alert')).toHaveTextContent('Draft still here');
    expect(screen.getByLabelText('Post description').props.value).toBe('   New caption  ');
    expect(mockOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ caption: base.tag }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save description' }));
    expect(screen.queryByLabelText('Post description')).toBeNull();
    expect(mockOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ caption: 'New caption' }));
  });
});

describe('ReelCard photo-story branch', () => {
  it('gives the real web video explicit dimensions so its replaced element fills the measured page', async () => {
    await renderCard({ ...base, id: 'v1', videoUrl: 'https://x/v.mp4' });
    expect(StyleSheet.flatten(screen.getByTestId('video-view').props.style)).toMatchObject({ width: '100%', height: '100%' });
  });

  it('updates memoized chrome when enlarged dock clearance changes while media keeps its full page', async () => {
    const clip={...base,id:'v1',videoUrl:'https://x/v.mp4'},onTip=jest.fn();
    const view=await render(<ReelCard clip={clip} player={null} active height={800} overlayInsetBottom={70} tipping={false} onTip={onTip} />);
    const renders=mockOverlay.mock.calls.length;
    await view.rerender(<ReelCard clip={clip} player={null} active height={800} overlayInsetBottom={118} tipping={false} onTip={onTip} />);
    expect(mockOverlay.mock.calls.length).toBeGreaterThan(renders);
    expect(StyleSheet.flatten(screen.getByTestId('video-view').props.style)).toMatchObject({width:'100%',height:'100%'});
  });

  it('renders photos instead of a video player and counts a view after 3 s once a photo loaded', async () => {
    await renderCard({ ...base, mediaType: 'photo_story', photoCount: 3, coverUrl: 'https://x/0.jpg' });
    await act(async () => {});
    expect(screen.getByText('photos:c1')).toBeTruthy();
    expect(screen.queryByTestId('video-view')).toBeNull();
    expect(mockCreatePlayer).not.toHaveBeenCalled();
    // Nothing on screen yet (photos still loading or failed): no view time accrues.
    expect(mockTracker).toHaveBeenLastCalledWith(
      'c1',
      true,
      false,
      3000,
      expect.objectContaining({ athleteId: 'p1', school: 'ALA' }),
    );
    await fireEvent.press(screen.getByLabelText('simulate photo loaded'));
    // reelId, signedIn, "playing" = loaded, visible and current, 3000 ms threshold (+ FEED-01 meta).
    expect(mockTracker).toHaveBeenLastCalledWith(
      'c1',
      true,
      true,
      3000,
      expect.objectContaining({ athleteId: 'p1', school: 'ALA' }),
    );
    expect(mockOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ storyNote: 'Food bank morning', caption: 'Service day' }));
  });

  it('does not count a photo story that is not the current card', async () => {
    await renderCard({ ...base, mediaType: 'photo_story', photoCount: 3 }, false);
    await fireEvent.press(screen.getByLabelText('simulate photo loaded'));
    expect(mockTracker).toHaveBeenLastCalledWith(
      'c1',
      true,
      false,
      3000,
      expect.objectContaining({ athleteId: 'p1', school: 'ALA' }),
    );
  });

  it('keeps a mounted neighbor on an empty player and loads its source when the card becomes current', async () => {
    const clip = { ...base, id: 'v1', videoUrl: 'https://x/v.mp4' };
    const view = await renderCard(clip, false);
    expect(screen.queryByTestId('video-view')).toBeNull();
    expect(mockCreatePlayer).toHaveBeenCalledWith(null);
    expect(mockReplace).not.toHaveBeenCalled();
    await view.rerender(<ReelCard clip={clip} player={null} active height={800} tipping={false} onTip={jest.fn()} />);
    expect(screen.getByTestId('video-view')).toBeTruthy();
    expect(mockReplace).toHaveBeenCalledWith('https://x/v.mp4');
    expect(screen.queryByText(/photos:/)).toBeNull();
    expect(mockOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ storyNote: null }));
  });

  it('shows an accessible Retry after a failed video without counting it as playback', async () => {
    mockReplace.mockRejectedValueOnce(new Error('Private media URL must not appear in the UI'));
    await renderCard({ ...base, id: 'v1', videoUrl: 'https://x/v.mp4' });
    await act(async () => {});
    expect(screen.getByText("This Highlight couldn't play.")).toBeTruthy();
    expect(screen.queryByText(/Private media/)).toBeNull();
    const retry = screen.getByRole('button', { name: 'Retry this Highlight' });
    expect(retry.props.style.minHeight).toBeGreaterThanOrEqual(44);
    expect(mockTracker.mock.calls.every(call => call[2] === false)).toBe(true);
    await fireEvent.press(retry); await act(async () => {});
    expect(mockReplace).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Retry this Highlight' })).toBeNull();
    await act(async () => {
      mockVideoEvents.sourceChange({ source: { uri: 'https://x/v.mp4' } });
      mockVideoEvents.statusChange({ status: 'readyToPlay' });
    });
    expect(mockVideoPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockTracker.mock.calls.every(call => call[2] === false)).toBe(true);
    await act(async () => { mockVideoEvents.playingChange({ isPlaying: true, oldIsPlaying: false }); });
    expect(mockTracker).toHaveBeenLastCalledWith(
      'v1',
      true,
      true,
      3000,
      expect.objectContaining({ athleteId: 'p1', school: 'ALA' }),
    );
  });

  it('hides failed-source recovery on an offscreen card and never resumes it from a ready event', async () => {
    mockReplace.mockRejectedValueOnce(new Error('Unavailable'));
    const clip = { ...base, id: 'v1', videoUrl: 'https://x/v.mp4' }; const view = await renderCard(clip);
    await act(async () => {}); expect(screen.getByRole('button', { name: 'Retry this Highlight' })).toBeTruthy();
    await view.rerender(<ReelCard clip={clip} player={null} active={false} height={800} tipping={false} onTip={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Retry this Highlight' })).toBeNull();
    await act(async () => { mockVideoEvents.statusChange({ status: 'readyToPlay' }); });
    expect(mockVideoPlayer.play).not.toHaveBeenCalled();
  });

  it('shows Retry for a delayed web media error even when no source metadata could load', async () => {
    const platform = require('react-native').Platform; const originalOS = platform.OS;
    platform.OS = 'web'; mockVideoPlayer.status = 'loading';
    try {
      await renderCard({ ...base, id: 'v1', videoUrl: 'https://x/bad.mp4' }); await act(async () => {});
      await act(async () => { mockVideoEvents.statusChange({ status: 'error', error: { message: 'Unsupported source' } }); });
      expect(screen.getByRole('button', { name: 'Retry this Highlight' })).toBeTruthy();
      expect(mockTracker.mock.calls.every(call => call[2] === false)).toBe(true);
    } finally { platform.OS = originalOS; }
  });
});
