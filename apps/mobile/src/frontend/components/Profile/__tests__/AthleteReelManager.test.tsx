/**
 * `AthleteReelManager` (UX-05c): photo stories are public only, so a long-press never opens the Vault /
 * Flash Unlock sheet for one (the database would reject the change); a video still opens it.
 * UPLOAD-STUDIO-01: the uploader also gets Edit description from the same long-press, photo stories included;
 * tagged athletes who did not upload the post never see it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AthleteReelManager, PHOTO_STORY_PUBLIC_TOAST } from '@/components/Profile/AthleteReelManager';
import { VAULT_MOVE_TO_VAULT } from '@/data/exclusive';
import type { HighlightClip } from '@/data/highlights';

const mockToast = jest.fn();
const mockToggle = jest.fn();
const mockSaveCaption = jest.fn();
let mockAuth: unknown = null;

jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn() }));
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View, BlurTargetView: View };
});
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Medium: 'medium' } }));
jest.mock('@/hooks/useSheetFrame', () => ({ useSheetFrame: () => ({ dock: {}, card: {} }) }));
jest.mock('@/components/UI/MenuChrome', () => ({ MenuBackdrop: () => null }));
jest.mock('@/context/AppRuntimeContext', () => ({
  useAppRuntime: () => ({ live: { catalog: { exclusiveDollars: 5 }, buttons: { vault: true, flashUnlock: true } } }),
}));
jest.mock('@/context/CelebrationContext', () => ({ useOptionalCelebration: () => ({ showToast: mockToast }) }));
jest.mock('@/lib/crew', () => ({ setReelFlashUnlock: jest.fn() }));
jest.mock('@/lib/reels', () => ({
  toggleReelVaultStatus: (...args: unknown[]) => mockToggle(...args),
  isReelUuid: jest.requireActual('@/lib/reels').isReelUuid,
}));
jest.mock('@/context/AuthContext', () => ({ useOptionalAuth: () => mockAuth }));
jest.mock('@/lib/postCaptions', () => ({ saveReelDescription: (...args: unknown[]) => mockSaveCaption(...args) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { track: jest.fn() } }));
jest.mock('@/components/Profile/TaggedReelGrid', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    TaggedReelGrid: ({ clips, onLongPressClip }: { clips: HighlightClip[]; onLongPressClip: (clip: HighlightClip) => void }) =>
      clips.map((clip) => (
        <Pressable key={clip.id} accessibilityLabel={`hold ${clip.id}`} onLongPress={() => onLongPressClip(clip)}>
          <Text>{clip.tag}</Text>
        </Pressable>
      )),
  };
});

const base = { athleteName: 'Sione', school: 'ALA', videoUrl: '' };
const story: HighlightClip = { ...base, id: 's1', tag: 'Service day', mediaType: 'photo_story', photoCount: 3 };
const video: HighlightClip = { ...base, id: 'v1', tag: 'Pick six', videoUrl: 'https://x/v.mp4' };

beforeEach(() => {
  mockToast.mockReset();
  mockToggle.mockReset();
  mockSaveCaption.mockReset();
  mockAuth = null;
});

const REEL_ID = '0b8f7a52-6c1e-4d5a-9a3b-2f1c4e5d6a7b';
const STORY_ID = '1c9e8b63-7d2f-4e6b-8b4c-3a2d5f6e7b8c';
const owner = { user: { id: 'user-1' }, profile: { id: 'profile-1', user_id: 'user-1', age_blocked_at: null }, isSessionCurrent: () => true };
const ownVideo: HighlightClip = { ...video, id: REEL_ID, uploadedBy: 'profile-1', editCaptionSource: 'Pick six' };
const ownStory: HighlightClip = { ...story, id: STORY_ID, uploadedBy: 'profile-1', editCaptionSource: 'Service day' };

describe('AthleteReelManager Edit description', () => {
  it('lets the uploader edit a video caption from the long-press sheet', async () => {
    mockAuth = owner;
    mockSaveCaption.mockResolvedValue('Pick six!!');
    await render(<AthleteReelManager clips={[ownVideo]} />);
    await fireEvent(screen.getByLabelText(`hold ${REEL_ID}`), 'longPress');
    await fireEvent.press(screen.getByLabelText('Edit description'));
    expect(screen.queryByText('Content placement')).toBeNull();
    const input = screen.getByLabelText('Post description');
    await fireEvent.changeText(input, 'Pick six!!');
    await fireEvent.press(screen.getByLabelText('Save description'));
    await waitFor(() => expect(mockSaveCaption).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', profileId: 'profile-1' }), REEL_ID, 'Pick six', 'Pick six!!'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Description updated ⚡'));
  });

  it('opens a photo story for editing only, never offering Vault', async () => {
    mockAuth = owner;
    await render(<AthleteReelManager clips={[ownStory]} />);
    await fireEvent(screen.getByLabelText(`hold ${STORY_ID}`), 'longPress');
    expect(screen.getByText('Your post')).toBeTruthy();
    expect(screen.getByLabelText('Edit description')).toBeTruthy();
    expect(screen.queryByLabelText(VAULT_MOVE_TO_VAULT)).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('hides Edit description from a tagged athlete who did not upload the post', async () => {
    mockAuth = { ...owner, profile: { ...owner.profile, id: 'someone-else' } };
    await render(<AthleteReelManager clips={[ownVideo, ownStory]} />);
    await fireEvent(screen.getByLabelText(`hold ${STORY_ID}`), 'longPress');
    expect(mockToast).toHaveBeenCalledWith(PHOTO_STORY_PUBLIC_TOAST);
    await fireEvent(screen.getByLabelText(`hold ${REEL_ID}`), 'longPress');
    expect(screen.getByText('Content placement')).toBeTruthy();
    expect(screen.queryByLabelText('Edit description')).toBeNull();
  });
});

describe('AthleteReelManager Vault options', () => {
  it('does not offer Vault for a photo story and explains why', async () => {
    await render(<AthleteReelManager clips={[story, video]} />);
    await fireEvent(screen.getByLabelText('hold s1'), 'longPress');
    expect(screen.queryByText('Content placement')).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(PHOTO_STORY_PUBLIC_TOAST);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('does not announce a Vault change when the write was denied', async () => {
    const changed = jest.fn();
    mockToggle.mockRejectedValue(new Error('Denied'));
    await render(<AthleteReelManager clips={[video]} onVaultChange={changed} />);
    await fireEvent(screen.getByLabelText('hold v1'), 'longPress');
    await fireEvent.press(screen.getByLabelText(VAULT_MOVE_TO_VAULT));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Denied'));
    expect(changed).not.toHaveBeenCalled();
  });
  it('still opens the Vault sheet for a video', async () => {
    await render(<AthleteReelManager clips={[story, video]} />);
    await fireEvent(screen.getByLabelText('hold v1'), 'longPress');
    expect(screen.getByText('Content placement')).toBeTruthy();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
