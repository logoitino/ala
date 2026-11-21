/**
 * `AthleteReelManager` (UX-05c): photo stories are public only, so a long-press never opens the Vault /
 * Flash Unlock sheet for one (the database would reject the change); a video still opens it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AthleteReelManager, PHOTO_STORY_PUBLIC_TOAST } from '@/components/Profile/AthleteReelManager';
import { VAULT_MOVE_TO_VAULT } from '@/data/exclusive';
import type { HighlightClip } from '@/data/highlights';

const mockToast = jest.fn();
const mockToggle = jest.fn();

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
jest.mock('@/lib/reels', () => ({ toggleReelVaultStatus: (...args: unknown[]) => mockToggle(...args) }));
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
