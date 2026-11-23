/**
 * `ReelOwnerPeek` behavior that does not depend on layout: labelled actions, the Give vs pending Tag state, a clip
 * with and without a tag, a missing player, video vs photo story, the real @username (never a name-derived guess),
 * the "Posted by" line, and the close button. Layout (wrapping, 2 x 2 grid, 44-point targets) needs a render check.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { ReelOwnerPeek } from '@/components/Reels/ReelOwnerPeek';
import type { HighlightClip } from '@/data/highlights';
import type { Player } from '@/data/players';

const mockProfiles: Record<string, Record<string, unknown> | null> = {};
let mockReduceMotion = false;
let mockVerified = false;
let mockRealCrew = false, mockCrewUser: string | null = null;
let mockCrewGuard = () => true;
const mockCrewFetch = jest.fn(), mockCrewSet = jest.fn(), mockCrewWall = jest.fn();

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, Text, Image } = jest.requireActual('react-native');
  const entering = { delay: () => entering, springify: () => entering };
  return {
    __esModule: true,
    default: { View, ScrollView, Text, Image, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => mockReduceMotion,
    // VarsityBadge pulses its glow with these.
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
    cancelAnimation: () => undefined,
    Easing: new Proxy({}, { get: () => (value: unknown) => value }),
    FadeInDown: entering,
    FadeInUp: entering,
  };
});
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    // Other people's profiles come through get_public_profiles (PRIV-01): by athlete id or by uploader profile id.
    rpc: async (name: string, args: { player_ids?: string[] | null; profile_ids?: string[] | null }) => ({
      data: name === 'get_public_profiles'
        ? [...(args.player_ids ?? []).map((id) => mockProfiles[`player_id:${id}`]), ...(args.profile_ids ?? []).map((id) => mockProfiles[`id:${id}`])].filter(Boolean)
        : null,
      error: null,
    }),
    from: () => ({
      select: () => ({
        // `column` is `player_id` for the athlete's own account and `id` for the uploader lookup.
        eq: (column: string, value: string) => ({
          maybeSingle: async () => ({ data: mockProfiles[`${column}:${value}`] ?? null }),
        }),
      }),
    }),
  },
}));
jest.mock('@/lib/verification', () => ({
  fetchPlayerVerification: async () => ({ status: mockVerified ? 'verified' : 'unverified', schoolClaimed: false, schoolId: null, avatarUrl: null }),
}));
jest.mock('@/hooks/useCrew', () => ({
  useCrew: (id: string) => mockRealCrew ? jest.requireActual('@/hooks/useCrew').useCrew(id) : ({ crew_count: 12, following: false, busy: false, signedIn: true, toggle: jest.fn() }),
}));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockCrewWall }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockCrewUser ? { id: mockCrewUser } : null, isSessionCurrent: mockCrewGuard }) }));
jest.mock('@/lib/crew', () => ({ fetchCrewGraph: (...args: unknown[]) => mockCrewFetch(...args), setCrewFollow: (...args: unknown[]) => mockCrewSet(...args) }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => { const owner = mockCrewUser, guard = mockCrewGuard; return owner ? { userId: owner, isCurrent: () => owner === mockCrewUser && guard === mockCrewGuard } : null; } } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async () => ({}) }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn() }));

const player = {
  id: 'p1',
  name: 'Marcus Reyes',
  jersey_number: 7,
  position: 'WR',
  height: '',
  school_name: 'Kahuku High',
  backer_count: 0,
  seki_count: 3,
  aura_points: 25,
} as Player;

const video: HighlightClip = {
  id: 'r1',
  athleteName: 'Marcus Reyes',
  school: 'Kahuku High',
  tag: 'Breakaway',
  videoUrl: 'https://x/v.mp4',
};

async function renderPeek(overrides: Partial<React.ComponentProps<typeof ReelOwnerPeek>> = {}) {
  const props = {
    clip: video,
    player,
    open: true,
    maloReady: true,
    totalTipsCents: 2500,
    onOpenProfile: jest.fn(),
    onTip: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  await render(<ReelOwnerPeek {...props} />);
  return props;
}

beforeEach(() => {
  for (const key of Object.keys(mockProfiles)) delete mockProfiles[key];
  mockReduceMotion = false;
  mockVerified = false; mockRealCrew = false; mockCrewUser = null; mockCrewGuard = () => true;
  mockCrewFetch.mockReset(); mockCrewSet.mockReset(); mockCrewWall.mockReset();
  mockCrewFetch.mockResolvedValue({ crew_count: 12, squad_count: 0, following: false, mutual: false });
  mockCrewSet.mockResolvedValue({ crew_count: 13, squad_count: 0, following: true, mutual: false });
});

afterEach(() => jest.restoreAllMocks());

/** Pretend the window is `width` points wide at the given text scale (Jest's default window is 750 wide at 2x text). */
function mockWindow(width: number, fontScale: number) {
  const real = Dimensions.get.bind(Dimensions);
  jest
    .spyOn(Dimensions, 'get')
    .mockImplementation((dim) => (dim === 'window' ? { width, height: 568, scale: 2, fontScale } : real(dim)));
}

describe('ReelOwnerPeek', () => {
  it('shows labelled Join Crew, Give and Open profile actions that fire their callbacks', async () => {
    const props = await renderPeek();
    expect(screen.getByLabelText('Join Crew, follow Marcus Reyes')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Give to Marcus Reyes'));
    expect(props.onTip).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Open full profile for Marcus Reyes'));
    expect(props.onOpenProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Give')).toBeTruthy();
  });

  it('reads Tag with a confirm-first label while the athlete tag is pending', async () => {
    await renderPeek({ maloReady: false });
    expect(screen.getByLabelText('Tag: confirm Marcus Reyes on this clip before giving')).toBeTruthy();
    expect(screen.getByText('Tag')).toBeTruthy();
    expect(screen.queryByText('Give')).toBeNull();
  });

  it('puts the clip tag in the "On this clip" row, and falls back to the clip kind without one', async () => {
    await renderPeek();
    expect(screen.getByText('On this clip')).toBeTruthy();
    expect(screen.getByText('“Breakaway”')).toBeTruthy();
    await screen.unmount();

    await renderPeek({ clip: { ...video, tag: '   ' } });
    expect(screen.getByText('Video highlight')).toBeTruthy();
    expect(screen.queryByText(/“/)).toBeNull();
  });

  it('describes a photo story the same way, with its photo count', async () => {
    await renderPeek({ clip: { ...video, tag: '', mediaType: 'photo_story', photoCount: 5 } });
    expect(screen.getByText('Photo story · 5 photos')).toBeTruthy();
    expect(screen.getByLabelText('Open full profile for Marcus Reyes')).toBeTruthy();
    expect(screen.getByText('Give')).toBeTruthy();
    // Spoken form drops the middle dot the visible text uses.
    expect(screen.getByLabelText('On this clip: Photo story, 5 photos')).toBeTruthy();
  });

  it('renders without a player: no Crew button, clip name and aura from the clip, no Give unless a handler exists', async () => {
    await renderPeek({ player: null, onTip: undefined, clip: { ...video, auraCount: 4 } });
    expect(screen.queryByLabelText(/Crew$/)).toBeNull();
    expect(screen.queryByText('Give')).toBeNull();
    expect(screen.getAllByText('Marcus Reyes').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Aura 4')).toBeTruthy();
  });

  it('lays the four stats out as Crew, Gifts, Seki, Aura with the formatted values', async () => {
    await renderPeek();
    expect(screen.getByLabelText('Crew 12')).toBeTruthy();
    expect(screen.getByLabelText('Gifts $25')).toBeTruthy();
    expect(screen.getByLabelText('Seki 3')).toBeTruthy();
    expect(screen.getByLabelText('Aura 25')).toBeTruthy();
  });

  it('shows the real @username of the linked account and never invents one from the name', async () => {
    mockProfiles['player_id:p1'] = { username: '@m_reyes7' };
    await renderPeek();
    await waitFor(() => expect(screen.getByText('@m_reyes7')).toBeTruthy());
    expect(screen.queryByText('@marcus_reyes')).toBeNull();
    await screen.unmount();

    await renderPeek();
    await act(async () => {});
    expect(screen.queryByText('@marcus_reyes')).toBeNull();
  });

  it('names a fan poster by their username, or by their name when the account has none (no guessed handle)', async () => {
    mockProfiles['id:u9'] = { id: 'u9', player_id: null, username: 'filmer_jo', full_name: 'Jo Lee', avatar_url: null };
    await renderPeek({ clip: { ...video, uploadedBy: 'u9' } });
    await waitFor(() => expect(screen.getByLabelText('Posted by @filmer_jo')).toBeTruthy());
    await screen.unmount();

    mockProfiles['id:u9'] = { id: 'u9', player_id: null, username: null, full_name: 'Jo Lee', avatar_url: null };
    await renderPeek({ clip: { ...video, uploadedBy: 'u9' } });
    await waitFor(() => expect(screen.getByLabelText('Posted by Jo Lee')).toBeTruthy());
  });

  it('hides the poster line when the athlete posted the clip themself', async () => {
    mockProfiles['id:u1'] = { id: 'u1', player_id: 'p1', username: 'm_reyes7', full_name: 'Marcus Reyes', avatar_url: null };
    await renderPeek({ clip: { ...video, uploadedBy: 'u1' } });
    await waitFor(() => expect(screen.getByLabelText('Join Crew, follow Marcus Reyes')).toBeTruthy());
    expect(screen.queryByLabelText(/Posted by/)).toBeNull();
  });

  it('closes from the labelled close button and marks the scroll area modal only while open', async () => {
    const props = await renderPeek();
    await fireEvent.press(screen.getByLabelText('Close profile peek'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Marcus Reyes profile peek').props.accessibilityViewIsModal).toBe(true);
    await screen.unmount();

    await renderPeek({ open: false });
    expect(screen.getByLabelText('Marcus Reyes profile peek').props.accessibilityViewIsModal).toBe(false);
  });

  it('speaks the tier and position line without bullet characters and exposes the name as a heading', async () => {
    await renderPeek();
    expect(screen.getByLabelText('Tier 3, Neon Jade')).toBeTruthy();
    expect(screen.getByLabelText('WR, #7, Kahuku High')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Marcus Reyes' })).toBeTruthy();
  });

  it('keeps the Tag label starting with its visible word, and Join Crew containing its visible text', async () => {
    await renderPeek({ maloReady: false });
    expect(screen.getByLabelText(/^Tag/)).toBeTruthy();
    expect(screen.getByLabelText(/^Join Crew/)).toBeTruthy();
  });

  it('renders every stat and the poster row when reduced motion is on', async () => {
    mockReduceMotion = true;
    mockProfiles['id:u9'] = { id: 'u9', player_id: null, username: 'filmer_jo', full_name: 'Jo Lee', avatar_url: null };
    await renderPeek({ clip: { ...video, uploadedBy: 'u9' } });
    await waitFor(() => expect(screen.getByLabelText('Posted by @filmer_jo')).toBeTruthy());
    expect(screen.getByLabelText('Crew 12')).toBeTruthy();
  });

  it('disables Open full profile when there is no profile to open', async () => {
    await renderPeek({ onOpenProfile: undefined });
    const open = screen.getByLabelText('Open full profile for Marcus Reyes');
    expect(open.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });

  it('pins Close and the action footer outside the scroll area at normal text, so Give never scrolls away', async () => {
    mockWindow(320, 1);
    await renderPeek();
    const scroll = screen.getByTestId('peek-scroll');
    expect(within(scroll).queryByLabelText('Close profile peek')).toBeNull();
    expect(within(scroll).queryByLabelText('Give to Marcus Reyes')).toBeNull();
    expect(within(scroll).queryByLabelText('Open full profile for Marcus Reyes')).toBeNull();
    expect(screen.getByLabelText('Give to Marcus Reyes')).toBeTruthy();
    expect(within(scroll).getByLabelText('Crew 12')).toBeTruthy();
  });

  it('moves the footer into the scroll area at large text sizes so the card cannot be swallowed by it', async () => {
    mockWindow(320, 2);
    await renderPeek();
    const scroll = screen.getByTestId('peek-scroll');
    expect(within(scroll).getByLabelText('Give to Marcus Reyes')).toBeTruthy();
    expect(within(scroll).queryByLabelText('Close profile peek')).toBeNull();
  });

  it('puts the verified mark on the avatar (spoken label, no wide label) on a narrow phone, and beside the name on a wide one', async () => {
    mockVerified = true;
    mockWindow(320, 1);
    await renderPeek();
    await waitFor(() => expect(screen.getByLabelText(/verified/i)).toBeTruthy());
    expect(screen.queryByText(/VERIFIED/i)).toBeNull();
    await screen.unmount();

    jest.restoreAllMocks();
    mockWindow(430, 1);
    await renderPeek();
    await waitFor(() => expect(screen.getByText(/VERIFIED/i)).toBeTruthy());
  });
});

it('resumes one guest Join for the same still-open clip/athlete with the current signed-in owner', async () => {
 mockRealCrew = true;
 let resume!: () => void; mockCrewWall.mockImplementation(intent => { resume = intent.resume; });
 const props = { clip: video, player, open: true, maloReady: false, totalTipsCents: 0, onClose: jest.fn() };
 const view = await render(<ReelOwnerPeek {...props} />);
 await waitFor(() => expect(screen.getByLabelText('Join Crew, follow Marcus Reyes')).toBeEnabled());
 await fireEvent.press(screen.getByLabelText('Join Crew, follow Marcus Reyes'));
 mockCrewUser = 'A'; mockCrewGuard = () => true;
 await view.rerender(<ReelOwnerPeek {...props} />);
 await act(async () => { resume(); resume(); });
 await waitFor(() => expect(mockCrewSet).toHaveBeenCalledTimes(1));
 expect(mockCrewSet).toHaveBeenCalledWith('p1', 'A', true, expect.objectContaining({ userId: 'A' }));
});
it.each(['closed', 'retargeted', 'unmounted'])('refuses a guest Join resume after its peek is %s', async mode => {
 mockRealCrew = true;
 let resume!: () => void; mockCrewWall.mockImplementation(intent => { resume = intent.resume; });
 const props = { clip: video, player, open: true, maloReady: false, totalTipsCents: 0, onClose: jest.fn() };
 const view = await render(<ReelOwnerPeek {...props} />);
 await waitFor(() => expect(screen.getByLabelText('Join Crew, follow Marcus Reyes')).toBeEnabled());
 await fireEvent.press(screen.getByLabelText('Join Crew, follow Marcus Reyes'));
 mockCrewUser = 'A'; mockCrewGuard = () => true;
 if (mode === 'unmounted') await view.unmount();
 else await view.rerender(<ReelOwnerPeek {...props} open={mode !== 'closed'} clip={{ ...video, id: mode === 'retargeted' ? 'new-clip' : video.id }} />);
 await act(async () => resume());
 expect(mockCrewSet).not.toHaveBeenCalled();
});
