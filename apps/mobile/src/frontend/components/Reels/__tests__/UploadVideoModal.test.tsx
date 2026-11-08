/**
 * Staged upload drafts, explicit rights and navigation protect uploads and optional mention failures.
 * Photo stories (UX-05): Photos appears only when the SQL exists, picks with privacy options, reorders with
 * labelled buttons, keeps per-photo descriptions, uses photo rights wording, hides Vault, keeps the draft
 * on failure and across Video ↔ Photos switches, and passes the failed server id for safe retirement before a fresh retry, even if the athlete changes — the athlete decides who receives donations and is fixed after insert.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Animated, Platform } from 'react-native';
import { UploadVideoModal } from '@/components/Reels/UploadVideoModal';
import { HIGHLIGHT_PUBLISH_LABEL, REEL_CATEGORY_GAME } from '@/data/highlights';
import { PHOTO_RIGHTS_VERSION, rightsChecksFor, shareConfirmationLabel } from '@/data/contentRights';
import type { Player } from '@/types/database';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockUpload = jest.fn();
const mockReloadSportChoices = jest.fn();
const mockAttach = jest.fn();
jest.mock('@/lib/accountTags', () => ({ attachAccountTags: (...args: unknown[]) => mockAttach(...args) }));
jest.mock('@/lib/reels', () => ({
  uploadSekiPlay: (...args: unknown[]) => mockUpload(...args),
  playerTagLabel: () => 'Ana', gameMatchupLabel: () => 'Game',
}));
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: () => ({ select: () => ({
    eq: async () => ({ data: [], error: null }),
    order: async () => ({ data: [], error: null }),
  }) }) },
}));
let mockOwnerId = '11111111-1111-4111-8111-111111111111';
let mockOwnPlayerId: string | null = 'p1';
let mockSessionGuard = () => true;
let mockSportChoices = { sportNames: ['Football', 'Volleyball'], status: 'ready' };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockOwnerId }, profile: { user_id: mockOwnerId, player_id: mockOwnPlayerId, athlete_sport: 'Football' }, isSessionCurrent: mockSessionGuard }) }));
jest.mock('@/hooks/useStoredSportChoices', () => ({ useStoredSportChoices: () => ({ ...mockSportChoices, reload: mockReloadSportChoices }) }));
jest.mock('@/context/AppRuntimeContext', () => ({
  useAppRuntime: () => ({ live: { catalog: { reelCategories: [], exclusiveDollars: 5 }, layouts: {} } }),
}));
let mockPhotosAvailable = false;
const mockCreateStory = jest.fn();
const mockCleanupStory = jest.fn();
const mockRememberCleanup = jest.fn();
const mockQueuedCleanup = jest.fn();
jest.mock('@/lib/photoStoryCleanup', () => ({
  cleanupFailedPhotoStory: (...args: unknown[]) => mockCleanupStory(...args),
  rememberPhotoStoryCleanup: (...args: unknown[]) => mockRememberCleanup(...args),
  queuedPhotoStoryCleanups: (...args: unknown[]) => mockQueuedCleanup(...args),
}));
const mockLaunchLibrary = jest.fn();
const mockLaunchCamera = jest.fn();
let mockClipDurationMs = 1000;
jest.mock('expo-constants', () => ({ __esModule: true, default: { isDevice: true } }));
jest.mock('@/lib/photoStories', () => ({
  photoStoriesAvailable: async () => mockPhotosAvailable,
  createPhotoStory: (...args: unknown[]) => mockCreateStory(...args),
  movePhoto: jest.requireActual('@/lib/photoStories').movePhoto,
  PhotoStoryPublishError: jest.requireActual('@/lib/photoStories').PhotoStoryPublishError,
  PhotoStoryAlreadyPublishedError: jest.requireActual('@/lib/photoStories').PhotoStoryAlreadyPublishedError,
}));
const { PhotoStoryPublishError: StoryError } = jest.requireActual('@/lib/photoStories');
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchLibrary(...args),
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCamera(...args),
  MediaTypeOptions: { Videos: 'Videos' },
}));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn(), trackIssue: jest.fn() } }));
jest.mock('@/services/MediaUploadService', () => {
  const actual = jest.requireActual('@/services/MediaUploadService');
  return { assetDurationMs: actual.assetDurationMs, isHighlightTooLong: actual.isHighlightTooLong };
});
jest.mock('@/components/Effects/CardShine', () => ({ CardShine: () => null }));
jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ replaceAsync: async () => {}, pause: () => {} }), VideoView: () => null,
}));
let mockPublishPress: (() => void) | undefined;
jest.mock('@/components/UI/AnimatedButton', () => ({ AnimatedButton: (props: { accessibilityLabel?: string; onPress: () => void }) => {
  if (props.accessibilityLabel?.startsWith('Publish')) mockPublishPress = props.onPress;
  const { Pressable } = jest.requireActual('react-native');
  return <Pressable {...props} />;
} }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: jest.requireActual('react-native').Pressable }));
jest.mock('@/components/Reels/AccountTagField', () => ({
  AccountTagField: ({ onChange }: { onChange: (rows: unknown[]) => void }) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return <Pressable onPress={() => onChange([{ id: 'mentioned-profile', label: 'Sina' }])}><Text>Choose Sina</Text></Pressable>;
  },
}));
jest.mock('@/components/Reels/HighlightPickerModal', () => ({
  HighlightPickerModal: ({ visible, onPicked, onClose }: { visible: boolean; onClose: () => void; onPicked: (clip: unknown) => void }) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return visible ? <><Pressable onPress={() => onPicked({ uri: 'file:///clip.mp4', durationMs: mockClipDurationMs, compressed: true })}><Text>Pick test clip</Text></Pressable><Pressable onPress={onClose}><Text>Cancel picking</Text></Pressable></> : null;
  },
}));

const players = [{ id: 'p1', name: 'Ana', jersey_number: 1, school_name: 'Westlake' } as Player];
const props = { visible: true, players, onUploaded: jest.fn(), onClose: jest.fn() };
const chooseClip = async () => {
  await fireEvent.press(screen.getByLabelText('Choose a video from library'));
  await fireEvent.press(screen.getByText('Pick test clip'));
};
const details = async () => {
  await chooseClip();
  await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Friday game');
  await fireEvent.press(screen.getByLabelText('Next'));
};
const confirmRights = async () => {
  await fireEvent.press(screen.getByLabelText(shareConfirmationLabel(REEL_CATEGORY_GAME)));
};

describe('staged Highlight upload', () => {
  beforeEach(() => {
    mockSportChoices = { sportNames: ['Football', 'Volleyball'], status: 'ready' };
    mockClipDurationMs = 1000;
    mockSessionGuard = () => true;
    mockLaunchCamera.mockReset();
    mockUpload.mockReset();
    jest.clearAllMocks(); mockCleanupStory.mockReset().mockResolvedValue('discarded'); mockRememberCleanup.mockReset().mockResolvedValue(undefined); mockQueuedCleanup.mockReset().mockResolvedValue([]); mockOwnerId = '11111111-1111-4111-8111-111111111111'; mockOwnPlayerId = 'p1';
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // Decorative native animation must not outlive the draft/I/O scenarios.
    for (const method of ['timing', 'spring', 'loop'] as const) {
      jest.spyOn(Animated, method).mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    }
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps an explicit optional sport through review, Back and a failed publish', async () => {
    mockUpload.mockRejectedValueOnce(new Error('offline'));
    await render(<UploadVideoModal {...props} />); await chooseClip();
    await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Volleyball game');
    await fireEvent.press(screen.getByLabelText('More options'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tag a sport (optional)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose Volleyball sport' }));
    await fireEvent.press(screen.getByLabelText('Done'));
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText(/Sport: Volleyball/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.getByLabelText('Tag a sport (optional)').props.accessibilityValue.text).toBe('Volleyball');
    await fireEvent.press(screen.getByLabelText('Done')); await confirmRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ sport: 'Volleyball' })));
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.getByLabelText('Tag a sport (optional)').props.accessibilityValue.text).toBe('Volleyball');
  });

  it('defaults sport only when the uploader chooses their exact linked athlete', async () => {
    await render(<UploadVideoModal {...props} />); await chooseClip();
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.getByLabelText('Tag a sport (optional)').props.accessibilityValue.text).toBe('Football');
    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('Who’s in this clip?'));
    await fireEvent.press(screen.getByLabelText('Tag later'));
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.getByLabelText('Tag a sport (optional)').props.accessibilityValue.text).toBe('No sport tag');
    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('Who’s in this clip?'));
    await fireEvent.press(screen.getByLabelText('This is me'));
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.getByLabelText('Tag a sport (optional)').props.accessibilityValue.text).toBe('Football');
  });

  it('retains an explicit sport and blocks publish when stored choices become unavailable', async () => {
    const view = await render(<UploadVideoModal {...props} />); await chooseClip();
    await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Volleyball game');
    await fireEvent.press(screen.getByLabelText('More options'));
    await fireEvent.press(screen.getByLabelText('Tag a sport (optional)'));
    await fireEvent.press(screen.getByLabelText('Choose Volleyball sport'));
    await fireEvent.press(screen.getByLabelText('Done'));
    await fireEvent.press(screen.getByLabelText('Next')); await confirmRights();
    mockSportChoices = { sportNames: [], status: 'unavailable' };
    await view.rerender(<UploadVideoModal {...props} />);
    expect(screen.getByText(/Sport choices are unavailable/)).toBeTruthy();
    await act(async () => mockPublishPress?.());
    expect(mockUpload).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.getByLabelText('Tag a sport (optional)').props.accessibilityValue.text).toBe('Volleyball');
    await fireEvent.press(screen.getByLabelText('Reload sport choices'));
    expect(mockReloadSportChoices).toHaveBeenCalledTimes(1);
    mockSportChoices = { sportNames: ['Football', 'Volleyball'], status: 'ready' };
    await view.rerender(<UploadVideoModal {...props} />);
    expect(screen.getByLabelText('Tag a sport (optional)').props.accessibilityValue.text).toBe('Volleyball');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(screen.getByText(/Sport: Volleyball/)).toBeTruthy();
    expect(screen.getByText('Volleyball game')).toBeTruthy();
    mockUpload.mockReturnValue(new Promise(() => {}));
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ sport: 'Volleyball', title: 'Volleyball game' })));
  });

  it('retains a visible self default through catalog reload until the uploader explicitly removes it', async () => {
    const view = await render(<UploadVideoModal {...props} />); await details(); await confirmRights();
    expect(screen.getByText(/Sport: Football/)).toBeTruthy();
    for (const status of ['loading', 'unavailable', 'ready']) {
      mockSportChoices = { sportNames: [], status };
      await view.rerender(<UploadVideoModal {...props} />);
      expect(screen.getByText(/Sport: Football/)).toBeTruthy();
      await act(async () => mockPublishPress?.());
      expect(mockUpload).not.toHaveBeenCalled();
    }
    await fireEvent.press(screen.getByLabelText('More options'));
    await fireEvent.press(screen.getByLabelText('Tag a sport (optional)'));
    await fireEvent.press(screen.getByLabelText('No sport tag'));
    await fireEvent.press(screen.getByLabelText('Done'));
    mockUpload.mockReturnValue(new Promise(() => {}));
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ sport: null })));
  });

  it('blocks repeat publication after a committed sport readback needs confirmation', async () => {
    mockUpload.mockRejectedValueOnce(Object.assign(new Error('Saved, confirmation unknown'), { code: 'HIGHLIGHT_SPORT_CONFIRMATION', reel: { id: 'saved-reel', sport: null } }));
    await render(<UploadVideoModal {...props} />); await details(); await confirmRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(screen.getByText(/Highlight saved, but its sport/)).toBeTruthy());
    await act(async () => { mockPublishPress?.(); });
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockCleanupStory).not.toHaveBeenCalled();
  });

  it('discards a delayed upload completion after A→B→A replaces the session lifetime', async () => {
    let resolve!: (row: { id: string }) => void;
    mockUpload.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = await render(<UploadVideoModal {...props} />); await details(); await confirmRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    mockSessionGuard = () => true;
    await view.rerender(<UploadVideoModal {...props} />);
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    await act(async () => resolve({ id: 'old-session-reel' }));
    expect(props.onUploaded).not.toHaveBeenCalled();
  });

  it('keeps the library duration in milliseconds when publishing an exactly 45-second clip', async () => {
    mockClipDurationMs = 45000;
    mockUpload.mockResolvedValueOnce({ id: 'duration-reel' });
    await render(<UploadVideoModal {...props} />);
    await details(); await confirmRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 45000 })));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it.each([['ios', 500, 500], ['android', 1000, 1000], ['web', 0.5, 500]] as const)(
    'publishes a short %s camera clip using its declared duration unit', async (platform, raw, expectedMs) => {
      jest.replaceProperty(Platform, 'OS', platform);
      mockLaunchCamera.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///camera.mp4', duration: raw }] });
      mockUpload.mockResolvedValueOnce({ id: 'camera-reel' });
      await render(<UploadVideoModal {...props} />);
      await fireEvent.press(screen.getByLabelText('Record a video'));
      await waitFor(() => expect(screen.getByLabelText('Highlight caption')).toBeTruthy());
      await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Short camera clip');
      await fireEvent.press(screen.getByLabelText('Next')); await confirmRights();
      await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
      await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ durationMs: expectedMs })));
      await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    },
  );

  it.each([45.001, null, 0])('keeps an unreadable or over-limit web camera clip out of the draft (%s)', async (duration) => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockLaunchCamera.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///camera.mp4', duration }] });
    await render(<UploadVideoModal {...props} />);
    await fireEvent.press(screen.getByLabelText('Record a video'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(screen.queryByLabelText('Highlight caption')).toBeNull();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('shows only the active short page and reaches review with a caption, athlete optional', async () => {
    mockOwnPlayerId = null;
    await render(<UploadVideoModal {...props} />);
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.queryByLabelText('Highlight caption')).toBeNull();
    expect(screen.queryByLabelText(HIGHLIGHT_PUBLISH_LABEL)).toBeNull();
    await chooseClip();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.queryByLabelText('Choose a video from library')).toBeNull();
    expect(screen.queryByLabelText('This is me')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Friday game');
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.getByText('Tag later · ⚡ Game Day')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('Who’s in this clip?'));
    expect(screen.getByLabelText('Tag later')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search athletes'), 'nobody');
    expect(screen.getByText('No matching athletes.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search athletes'), 'Ana');
    await fireEvent.press(screen.getByLabelText('Choose Ana'));
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.queryByLabelText('Highlight caption')).toBeNull();
    expect(screen.getByText(/No game · No mentions/)).toBeTruthy();
  });

  it('offers This is me when the signed-in account is that athlete', async () => {
    await render(<UploadVideoModal {...props} />);
    await chooseClip();
    expect(screen.getByLabelText('This is me').props.accessibilityState.selected).toBe(true);
  });

  it('keeps draft on Back and picker cancellation, resets when closed, and clears rights for a replacement clip', async () => {
    const view = await render(<UploadVideoModal {...props} />);
    await details(); await confirmRights();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByLabelText('Highlight caption').props.value).toBe('Friday game');
    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('Choose a video from library'));
    await fireEvent.press(screen.getByText('Cancel picking'));
    expect(screen.getByText('Your Highlight ⚡')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText(shareConfirmationLabel(REEL_CATEGORY_GAME)).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText('Change video'));
    await chooseClip();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText(shareConfirmationLabel(REEL_CATEGORY_GAME)).props.accessibilityState.checked).toBe(false);
    await view.rerender(<UploadVideoModal {...props} visible={false} />);
    await view.rerender(<UploadVideoModal {...props} />);
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    await chooseClip();
    expect(screen.getByLabelText('Highlight caption').props.value).toBe('');
  });

  it('keeps optional settings out of details and retains them when returning to review', async () => {
    await render(<UploadVideoModal {...props} />); await details();
    expect(screen.queryByText('Choose Sina')).toBeNull();
    await fireEvent.press(screen.getByLabelText('More options'));
    await fireEvent.press(screen.getByText('Choose Sina'));
    await fireEvent.press(screen.getByLabelText('One-time Exclusive 🔒'));
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(screen.getByText('One-time Exclusive only')).toBeTruthy();
    expect(screen.getByText(/1 mentions/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.getByLabelText('One-time Exclusive 🔒').props.accessibilityState.checked).toBe(true);
  });

  it('requires every rights confirmation and blocks duplicate publish and exit during upload', async () => {
    let resolveUpload!: (value: { id: string }) => void;
    mockUpload.mockImplementation(() => new Promise((resolve) => { resolveUpload = resolve; }));
    const view = await render(<UploadVideoModal {...props} />); await details();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    expect(mockUpload).not.toHaveBeenCalled();
    await confirmRights();
    const publish = mockPublishPress!;
    await act(() => { publish(); publish(); });
    expect(mockUpload).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Close upload'));
    await fireEvent.press(screen.getByLabelText('Back'));
    await act(() => fireEvent(screen.getByTestId('upload-modal'), 'requestClose'));
    expect(props.onClose).not.toHaveBeenCalled();
    await act(() => resolveUpload({ id: 'r1' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('keeps the review draft after upload failure and allows a deliberate retry', async () => {
    mockUpload.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ id: 'retry-reel' });
    await render(<UploadVideoModal {...props} />); await details(); await confirmRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(screen.getByText('Connection lost')).toBeTruthy());
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.getByText('Friday game')).toBeTruthy();
    expect(props.onUploaded).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(props.onUploaded).toHaveBeenCalledWith({ id: 'retry-reel' });
  });

  it('treats Android Back as previous page and closes selectors before changing stages', async () => {
    const view = await render(<UploadVideoModal {...props} />); await details();
    await act(() => fireEvent(screen.getByTestId('upload-modal'), 'requestClose'));
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Who’s in this clip?'));
    await act(() => fireEvent(screen.getByTestId('upload-modal'), 'requestClose'));
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.queryByLabelText('Search athletes')).toBeNull();
    await act(() => fireEvent(screen.getByTestId('upload-modal'), 'requestClose'));
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('publishes once and accurately reports unsaved optional mentions after successful upload', async () => {
    const reel = { id: 'r1' }; mockUpload.mockResolvedValue(reel); mockAttach.mockRejectedValue(new Error('mention write failed'));
    await render(<UploadVideoModal {...props} />); await details();
    await fireEvent.press(screen.getByLabelText('More options'));
    await fireEvent.press(screen.getByText('Choose Sina'));
    await fireEvent.press(screen.getByLabelText('Done'));
    await confirmRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockAttach).toHaveBeenCalledWith('r1', ['mentioned-profile']);
    expect(props.onUploaded).toHaveBeenCalledWith(reel);
    expect(Alert.alert).toHaveBeenCalledWith('Highlight published', 'Your clip is published, but we could not save the account mentions.');
    expect(Alert.alert).not.toHaveBeenCalledWith('Upload failed', expect.anything());
  });
});

const asset = (name: string) => ({ uri: `file:///${name}.jpg`, type: 'image', width: 1200, height: 1600 });
const openPhotos = async () => {
  await waitFor(() => expect(screen.getByLabelText('Photos')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Photos'));
};
const pickThree = async () => {
  mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset('a'), asset('b'), asset('c')] });
  await fireEvent.press(screen.getByLabelText('Choose photos from library'));
  await waitFor(() => expect(screen.getByText('3 of 10 photos')).toBeTruthy());
};
const confirmPhotoRights = async () => {
  await fireEvent.press(screen.getByLabelText(shareConfirmationLabel(REEL_CATEGORY_GAME, 'photo_story')));
};

describe('photo story upload', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockCleanupStory.mockReset().mockResolvedValue('discarded'); mockRememberCleanup.mockReset().mockResolvedValue(undefined); mockQueuedCleanup.mockReset().mockResolvedValue([]); mockOwnerId = '11111111-1111-4111-8111-111111111111'; mockOwnPlayerId = 'p1'; mockPhotosAvailable = true;
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    for (const method of ['timing', 'spring', 'loop'] as const) {
      jest.spyOn(Animated, method).mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    }
  });
  afterEach(() => jest.restoreAllMocks());

  it('hides Photos until the photo-story SQL exists', async () => {
    mockPhotosAvailable = false;
    await render(<UploadVideoModal {...props} />);
    await act(async () => {});
    expect(screen.queryByLabelText('Photos')).toBeNull();
    expect(screen.getByLabelText('Choose a video from library')).toBeTruthy();
  });

  it('picks privately, reorders, describes, validates and publishes photos in the chosen order', async () => {
    let finish!: (reel: { id: string }) => void;
    mockCreateStory.mockImplementation((input: { onProgress: (done: number, total: number) => void }) => {
      input.onProgress(1, 3);
      return new Promise((resolve) => { finish = resolve; });
    });
    await render(<UploadVideoModal {...props} />);
    await openPhotos();
    expect(screen.getByText('Choose your photos')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Step 1 of 3')).toBeTruthy(); // at least one photo is required
    await pickThree();
    expect(mockLaunchLibrary).toHaveBeenCalledWith(expect.objectContaining({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, exif: false, quality: 0.85,
    }));
    expect(screen.getByLabelText('Move photo 1 earlier').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Move photo 3 later').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Move photo 3 earlier')); // a, c, b
    await fireEvent.press(screen.getByLabelText('Move photo 1 later')); // c, a, b
    await fireEvent.press(screen.getByLabelText('Remove photo 3')); // c, a
    expect(screen.getByText('2 of 10 photos')).toBeTruthy();
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset('d')] });
    await fireEvent.press(screen.getByLabelText('Add photos'));
    await waitFor(() => expect(screen.getByText('3 of 10 photos')).toBeTruthy()); // c, a, d
    expect(mockLaunchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ selectionLimit: 8 }));

    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Volunteer day');
    await fireEvent.changeText(screen.getByLabelText('Description for photo 2'), 'Team huddle');
    expect(screen.getByText('11/200')).toBeTruthy();
    expect(screen.getByLabelText('Description for photo 2').props.maxLength).toBe(200);
    await fireEvent.press(screen.getByLabelText('Next'));

    expect(screen.getByText('Public photo story')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('More options'));
    expect(screen.queryByLabelText('One-time Exclusive 🔒')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(screen.queryByLabelText(rightsChecksFor(REEL_CATEGORY_GAME)[1].label)).toBeNull(); // no sound line
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    expect(mockCreateStory).not.toHaveBeenCalled();
    await confirmPhotoRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    expect(mockCreateStory).toHaveBeenCalledTimes(1);
    expect(mockCreateStory).toHaveBeenCalledWith(expect.objectContaining({
      photos: [
        expect.objectContaining({ uri: 'file:///c.jpg' }),
        expect.objectContaining({ uri: 'file:///a.jpg', description: 'Team huddle' }),
        expect.objectContaining({ uri: 'file:///d.jpg' }),
      ],
      title: 'Volunteer day', playerId: 'p1', category: REEL_CATEGORY_GAME, rightsVersion: PHOTO_RIGHTS_VERSION,
    }));
    expect(screen.getByText(/Uploading photo 2 of 3/)).toBeTruthy();
    await act(() => finish({ id: 'story-1' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled(), { timeout: 2000 });
    expect(props.onUploaded).toHaveBeenCalledWith({ id: 'story-1' });
  });

  it('keeps the photo draft after a failed upload and retries on the same hidden reel', async () => {
    mockCreateStory.mockRejectedValueOnce(new StoryError('Photo 2 of 3 did not upload, so nothing was published. Try again.', 'story-hidden'))
      .mockResolvedValueOnce({ id: 'story-hidden' });
    await render(<UploadVideoModal {...props} />);
    await openPhotos(); await pickThree();
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Practice');
    await fireEvent.press(screen.getByLabelText('Next'));
    await confirmPhotoRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(screen.getByText('Photo 2 of 3 did not upload, so nothing was published. Try again.')).toBeTruthy());
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.getByText('Photo story · 3 photos')).toBeTruthy();
    expect(props.onUploaded).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockCreateStory).toHaveBeenCalledTimes(2);
    expect(mockCreateStory.mock.calls[0][0].existingReelId).toBeNull();
    expect(mockCreateStory.mock.calls[1][0].existingReelId).toBe('story-hidden');
  });

  it('starts a new story on retry when the athlete changed after the failure', async () => {
    const two = [...players, { id: 'p2', name: 'Mele', jersey_number: 7, school_name: 'Westlake' } as Player];
    mockCreateStory.mockRejectedValueOnce(new StoryError('Your photos uploaded but the story could not be saved, so nothing was published. Try again.', 'story-hidden'))
      .mockResolvedValueOnce({ id: 'story-new' });
    await render(<UploadVideoModal {...props} players={two} />);
    await openPhotos(); await pickThree();
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Practice');
    await fireEvent.press(screen.getByLabelText('Next'));
    await confirmPhotoRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(screen.getByText(/story could not be saved/)).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('Who’s in these photos?'));
    await fireEvent.press(screen.getAllByText('Ana')[1]); // playerTagLabel is mocked; rows sort by jersey, so [1] is Mele (#7)
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(mockCreateStory).toHaveBeenCalledTimes(2));
    expect(mockCreateStory.mock.calls[1][0]).toEqual(expect.objectContaining({ playerId: 'p2', existingReelId: 'story-hidden' }));
  });

  it('keeps both drafts when switching Video and Photos, and Back keeps the photos', async () => {
    await render(<UploadVideoModal {...props} />);
    await waitFor(() => expect(screen.getByLabelText('Photos')).toBeTruthy());
    await chooseClip();
    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('Photos'));
    await pickThree();
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByText('3 of 10 photos')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Video'));
    expect(screen.getByText('Your Highlight ⚡')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Photos'));
    expect(screen.getByText('3 of 10 photos')).toBeTruthy();
  });
  const failStory = async () => {
    mockCreateStory.mockRejectedValueOnce(new StoryError('Photo upload failed. Try again.', 'story-hidden'));
    await render(<UploadVideoModal {...props} />);
    await openPhotos(); await pickThree();
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'Practice');
    await fireEvent.press(screen.getByLabelText('Next')); await confirmPhotoRights();
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(screen.getByText('Photo upload failed. Try again.')).toBeTruthy());
  };

  it('saves removal intent before closing and blocks duplicate close taps while saving', async () => {
    let finish!: (result: string) => void;
    await failStory();
    mockRememberCleanup.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await fireEvent.press(screen.getByLabelText('Close upload'));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Close upload')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Close upload'));
    expect(mockCleanupStory).not.toHaveBeenCalled();
    await act(() => finish('saved'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps the local draft when saving cleanup intent fails, then retries Close', async () => {
    await failStory();
    mockRememberCleanup.mockRejectedValueOnce(new Error('Device storage full.')).mockResolvedValueOnce(undefined);
    await fireEvent.press(screen.getByLabelText('Close upload'));
    await waitFor(() => expect(screen.getByText(/Could not save unfinished-story removal/)).toBeTruthy());
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Photo story · 3 photos')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close upload'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(mockCleanupStory).toHaveBeenCalledWith('story-hidden', mockOwnerId);
  });

  it('closes offline after persisting intent and resumes only the active account on reopening', async () => {
    mockCleanupStory.mockRejectedValue(new Error('Offline.'));
    await failStory();
    await fireEvent.press(screen.getByLabelText('Close upload'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(mockRememberCleanup).toHaveBeenCalledWith('story-hidden', mockOwnerId);
    const owner = mockOwnerId;
    mockOwnerId = '33333333-3333-4333-8333-333333333333';
    mockQueuedCleanup.mockImplementation(async (id: string) => id === owner ? ['story-hidden'] : []);
    await screen.rerender(<UploadVideoModal {...props} />);
    await chooseClip();
    expect(screen.getByLabelText('Highlight caption').props.value).toBe('');
    await fireEvent.changeText(screen.getByLabelText('Highlight caption'), 'New account clip');
    await fireEvent.press(screen.getByLabelText('Next')); await confirmRights();
    mockUpload.mockResolvedValue({ id: 'new-owner-video' });
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect(mockCleanupStory.mock.calls.every((call) => call[1] === owner)).toBe(true);
    expect(mockQueuedCleanup).toHaveBeenLastCalledWith(mockOwnerId);
  });

  it('allows a fresh video after closing a failed story even when queued cleanup is unavailable', async () => {
    mockCleanupStory.mockRejectedValue(new Error('Cleanup database update missing.'));
    await failStory();
    await fireEvent.press(screen.getByLabelText('Close upload'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    await screen.rerender(<UploadVideoModal {...props} visible={false} />);
    mockQueuedCleanup.mockResolvedValue(['story-hidden']);
    await screen.rerender(<UploadVideoModal {...props} />);
    await details(); await confirmRights();
    mockUpload.mockResolvedValue({ id: 'fresh-video' });
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(props.onUploaded).toHaveBeenCalledWith({ id: 'fresh-video' }), { timeout: 2000 });
    expect(mockCreateStory).toHaveBeenCalledTimes(1);
    expect(mockRememberCleanup).toHaveBeenCalledWith('story-hidden', mockOwnerId);
  });

  it('keeps the active failed attempt for explicit retry when an earlier queue read resolves late', async () => {
    let hydrate!: (ids: string[]) => void;
    mockQueuedCleanup.mockImplementationOnce(() => new Promise((resolve) => { hydrate = resolve; }));
    await failStory();
    mockCleanupStory.mockResolvedValue('published');
    await act(() => hydrate(['story-hidden']));
    expect(mockCleanupStory).not.toHaveBeenCalled();
    const stored = { id: 'story-hidden', title: 'Original caption' };
    const { PhotoStoryAlreadyPublishedError } = jest.requireActual('@/lib/photoStories');
    mockCreateStory.mockRejectedValueOnce(new PhotoStoryAlreadyPublishedError(stored));
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(props.onUploaded).toHaveBeenCalledWith(stored));
    expect(mockCreateStory.mock.calls[1][0].existingReelId).toBe('story-hidden');
  });

  it('does not apply newly edited mentions to an already-published earlier story', async () => {
    await failStory();
    const stored = { id: 'story-hidden', title: 'Original caption', player_id: 'original-athlete', cover_path: 'original.jpg' };
    const { PhotoStoryAlreadyPublishedError } = jest.requireActual('@/lib/photoStories');
    mockCreateStory.mockRejectedValueOnce(new PhotoStoryAlreadyPublishedError(stored));
    await fireEvent.press(screen.getByLabelText('More options'));
    await fireEvent.press(screen.getByText('Choose Sina'));
    await fireEvent.press(screen.getByLabelText('Done'));
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_PUBLISH_LABEL));
    await waitFor(() => expect(props.onUploaded).toHaveBeenCalledWith(stored));
    expect(mockAttach).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Photo story · 3 photos')).toBeTruthy();
  });

});
