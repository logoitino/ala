/** Exercise actual picker normalization so native milliseconds and web seconds cannot bypass the clip limit. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Animated, Platform } from 'react-native';
import { HighlightPickerModal } from '@/components/Reels/HighlightPickerModal';
import { HIGHLIGHT_LIBRARY_CTA } from '@/data/media';

const mockLibrary = jest.fn();
const mockCompress = jest.fn();
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Videos: 'Videos' },
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchImageLibraryAsync: (...args: unknown[]) => mockLibrary(...args),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
// Animation is outside the picker contract; leave the real picker and duration logic under test.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: jest.requireActual('react-native').View },
  FadeIn: { duration: () => ({}) },
}));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/services/MediaUploadService', () => ({
  ...jest.requireActual('@/services/MediaUploadService'),
  compressHighlight: (...args: unknown[]) => mockCompress(...args),
}));
jest.mock('@/components/Effects/CardShine', () => ({ CardShine: () => null }));
jest.mock('@/components/UI/MenuChrome', () => ({ MenuBackdrop: () => null }));
jest.mock('@/components/UI/SheetHandle', () => ({ SheetHandle: () => null }));
jest.mock('@/components/UI/AnimatedButton', () => ({ AnimatedButton: jest.requireActual('react-native').Pressable }));

describe('Highlight library duration boundary', () => {
  beforeEach(() => {
    mockLibrary.mockReset(); mockCompress.mockReset().mockResolvedValue('file:///compressed.mp4');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([['ios', 500, 500], ['android', 1000, 1000], ['web', 0.5, 500], ['web', 45, 45000]] as const)(
    'returns normalized milliseconds for an eligible %s library clip', async (platform, raw, expectedMs) => {
      jest.replaceProperty(Platform, 'OS', platform);
      mockLibrary.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///clip.mp4', duration: raw }] });
      const onPicked = jest.fn(); const onClose = jest.fn();
      await render(<HighlightPickerModal visible onPicked={onPicked} onClose={onClose} />);
      await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));
      await waitFor(() => expect(onPicked).toHaveBeenCalledWith(expect.objectContaining({ durationMs: expectedMs, uri: 'file:///compressed.mp4' })));
      expect(onClose).toHaveBeenCalledTimes(1);
    },
  );

  it.each([45.001, 46, null, 0, -1, NaN, Infinity])('rejects invalid web library duration %s before compression', async (duration) => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockLibrary.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///clip.mp4', duration }] });
    const onPicked = jest.fn();
    await render(<HighlightPickerModal visible onPicked={onPicked} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockCompress).not.toHaveBeenCalled();
    expect(onPicked).not.toHaveBeenCalled();
  });
});
