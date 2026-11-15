/**
 * Desktop card feed: Lovable-outline center column on Expo web ≥820.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DesktopHighlightFeed } from '@/components/Reels/DesktopHighlightFeed';
import type { HighlightClip } from '@/data/highlights';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/context/AppRuntimeContext', () => ({
  useAppRuntime: () => ({
    live: {
      tabs: { upload: true, beyond: true },
      copy: { homeEmpty: 'Quiet' },
    },
  }),
}));

jest.mock('@/context/UploadSheetContext', () => ({
  useUploadSheet: () => ({ openUpload: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isGuest: false }),
}));

jest.mock('@/context/SoftWallContext', () => ({
  useSoftWall: () => ({
    requireAuth: ({ resume }: { resume?: () => void }) => resume?.(),
  }),
}));

jest.mock('@/lib/reelVotes', () => ({
  loadReelVotes: async () => ({ seki: false, aura: false, flex: false }),
  markReelVote: async () => ({ seki: true, aura: false, flex: false }),
  clearReelVote: async () => ({ seki: false, aura: false, flex: false }),
}));

jest.mock('@/lib/reels', () => ({
  bumpReelHype: async (_id: string, _kind: string, current: { seki_count: number }) => ({
    ...current,
    seki_count: current.seki_count + 1,
  }),
  clearReelHype: async (_id: string, _kind: string, current: { seki_count: number }) => ({
    ...current,
    seki_count: Math.max(0, current.seki_count - 1),
  }),
}));

jest.mock('@/services/OfflineQueue', () => ({
  offlineQueue: {
    isOnline: async () => true,
    enqueue: async () => undefined,
  },
}));

jest.mock('@/services/TelemetryManager', () => ({
  telemetry: { trackFeature: jest.fn() },
}));

const modalProps: { onTipped?: (reelId: string, amountCents: number) => void; onHide?: (reelId: string) => void } =
  {};

jest.mock('@/components/Reels/ReelViewModal', () => ({
  ReelViewModal: (props: typeof modalProps & { initialClipId: string | null }) => {
    Object.assign(modalProps, props);
    return null;
  },
}));

jest.mock('@/components/TipSheetModal', () => ({
  MaloTipModal: () => null,
}));

const clip = (id: string, sport: string, name: string): HighlightClip => ({
  id,
  athleteName: name,
  school: 'Founding High',
  tag: `${name} play`,
  videoUrl: 'https://example.com/v.mp4',
  sport,
  sekiCount: 2,
});

const baseProps = () => ({
  feed: [
    { clip: clip('1', 'Volleyball', 'Malia'), player: null },
    { clip: clip('2', 'Football', 'Sione'), player: null },
  ],
  feedReasons: new Map([['1', ['crew', 'sport']]]),
  sportOptions: ['Volleyball', 'Football'],
  emptyCopy: 'Quiet',
  isGuest: false,
  refreshing: false,
  onRefresh: jest.fn(),
  tippedIds: new Set<string>(),
  tipPlayer: jest.fn(),
  onReelHypeChange: jest.fn(),
  tipTarget: null as null,
  onCloseTip: jest.fn(),
  playClipId: null as string | null,
  onPlayClip: jest.fn(),
  onClosePlay: jest.fn(),
  onHideClip: jest.fn(),
  onBacked: jest.fn(),
  onTipped: jest.fn(),
});

describe('DesktopHighlightFeed', () => {
  beforeEach(() => {
    Object.keys(modalProps).forEach((key) => {
      delete (modalProps as Record<string, unknown>)[key];
    });
  });

  it('renders Highlights heading, sport pills, and cards', async () => {
    const tipPlayer = jest.fn();
    const onPlayClip = jest.fn();
    await render(
      <DesktopHighlightFeed
        {...baseProps()}
        tipPlayer={tipPlayer}
        onPlayClip={onPlayClip}
      />,
    );

    expect(screen.getByLabelText('Highlights')).toBeTruthy();
    expect(screen.getByText('Highlights')).toBeTruthy();
    expect(screen.getByTestId('desktop-feed-pill-All')).toBeTruthy();
    expect(screen.getByTestId('desktop-feed-pill-Volleyball')).toBeTruthy();
    expect(screen.getByText('Malia')).toBeTruthy();
    expect(screen.getByText('Sione')).toBeTruthy();
    expect(screen.getByText(/Why this clip/)).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('desktop-feed-pill-Volleyball'));
    });
    expect(screen.getByText('Malia')).toBeTruthy();
    expect(screen.queryByText('Sione')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getAllByLabelText('Send a gift')[0]);
    });
    expect(tipPlayer).toHaveBeenCalled();
  });

  it('routes card play through onPlayClip', async () => {
    const onPlayClip = jest.fn();
    await render(
      <DesktopHighlightFeed
        {...baseProps()}
        onPlayClip={onPlayClip}
      />,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Play Highlight: Malia play'));
    });
    expect(onPlayClip).toHaveBeenCalledWith('1');
  });

  it('forwards playback gift and hide identities to Home', async () => {
    const onTipped = jest.fn();
    const onHideClip = jest.fn();
    await render(
      <DesktopHighlightFeed
        {...baseProps()}
        playClipId="1"
        onTipped={onTipped}
        onHideClip={onHideClip}
      />,
    );
    expect(typeof modalProps.onTipped).toBe('function');
    expect(typeof modalProps.onHide).toBe('function');
    modalProps.onTipped?.('1', 500);
    expect(onTipped).toHaveBeenCalledWith('1', 500);
    modalProps.onHide?.('1');
    expect(onHideClip).toHaveBeenCalledWith('1');
  });

  it('hides Why this clip for guests', async () => {
    await render(
      <DesktopHighlightFeed
        {...baseProps()}
        feed={[{ clip: clip('1', 'Volleyball', 'Malia'), player: null }]}
        feedReasons={new Map([['1', ['crew']]])}
        sportOptions={['Volleyball']}
        isGuest
      />,
    );
    expect(screen.queryByText(/Why this clip/)).toBeNull();
  });
});
