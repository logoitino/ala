/** Exercise actual picker normalization so native milliseconds and web seconds cannot bypass the clip limit. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Animated, Platform } from 'react-native';
import { HighlightPickerModal } from '@/components/Reels/HighlightPickerModal';
import { HIGHLIGHT_LIBRARY_CTA, HIGHLIGHT_OPTIMIZING } from '@/data/media';

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

/** Closing/reopening invalidates the departing picker result. */
function deferred<T>() { let resolve!: (v:T)=>void; const promise=new Promise<T>(r=>{resolve=r});return {resolve,promise}; }
it('does not return a pending library selection after hiding and reopening the picker', async () => {
 jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
 const pending=deferred<unknown>(); mockLibrary.mockReset().mockReturnValueOnce(pending.promise);
 mockCompress.mockResolvedValue('file:///compressed.mp4');
 const onPicked=jest.fn(),onClose=jest.fn();
 const view=await render(<HighlightPickerModal visible onPicked={onPicked} onClose={onClose}/>);
 let press!:Promise<unknown>;
 await act(async()=>{press=fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));});
 await waitFor(()=>expect(mockLibrary).toHaveBeenCalled());
 await view.rerender(<HighlightPickerModal visible={false} onPicked={onPicked} onClose={onClose}/>);
 await view.rerender(<HighlightPickerModal visible onPicked={onPicked} onClose={onClose}/>);
 await act(async()=>{pending.resolve({canceled:false,assets:[{uri:'file:///old-account.mp4',duration:1000}]});await press;});
 expect(onPicked).not.toHaveBeenCalled();
 expect(onClose).not.toHaveBeenCalled();
});

it('Cancel discards an in-flight library response before the visibility update commits', async()=>{
 jest.spyOn(Animated,'timing').mockReturnValue({start:jest.fn(),stop:jest.fn(),reset:jest.fn()});
 const pending=deferred<unknown>();mockLibrary.mockReset().mockReturnValueOnce(pending.promise);mockCompress.mockReset();
 const onPicked=jest.fn(),onClose=jest.fn();
 await render(<HighlightPickerModal visible onPicked={onPicked} onClose={onClose}/>);
 await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));
 await waitFor(()=>expect(mockLibrary).toHaveBeenCalledTimes(1));
 await fireEvent.press(screen.getByLabelText('Cancel'));
 await act(async()=>{pending.resolve({canceled:false,assets:[{uri:'file:///canceled.mp4',duration:1000}]});});
 expect(onPicked).not.toHaveBeenCalled();expect(mockCompress).not.toHaveBeenCalled();expect(onClose).toHaveBeenCalledTimes(1);
});
it('single-flights the open library and releases ordinary picker cancellation for a new choice',async()=>{
 jest.spyOn(Animated,'timing').mockReturnValue({start:jest.fn(),stop:jest.fn(),reset:jest.fn()});
 const pending=deferred<unknown>();mockLibrary.mockReset().mockReturnValueOnce(pending.promise);mockCompress.mockReset().mockResolvedValue('file:///fresh.mp4');
 const onPicked=jest.fn();
 await render(<HighlightPickerModal visible onPicked={onPicked} onClose={jest.fn()}/>);
 await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));
 await waitFor(()=>expect(mockLibrary).toHaveBeenCalledTimes(1));
 await act(async()=>{pending.resolve({canceled:true,assets:[]});});
 mockLibrary.mockResolvedValueOnce({canceled:false,assets:[{uri:'file:///fresh.mp4',duration:1000}]});
 await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));
 await waitFor(()=>expect(onPicked).toHaveBeenCalledWith(expect.objectContaining({uri:'file:///fresh.mp4'})));
});
it('an outgoing compression cannot accept media or clear the fresh draft operation',async()=>{
 jest.spyOn(Animated,'timing').mockReturnValue({start:jest.fn(),stop:jest.fn(),reset:jest.fn()});
 const old=deferred<string>(),fresh=deferred<string>();mockLibrary.mockReset().mockResolvedValue({canceled:false,assets:[{uri:'file:///clip.mp4',duration:1000}]});
 mockCompress.mockReset().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
 const onPicked=jest.fn(),onClose=jest.fn();const first={},second={};
 const view=await render(<HighlightPickerModal visible draftKey={first} onPicked={onPicked} onClose={onClose}/>);
 await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));await waitFor(()=>expect(mockCompress).toHaveBeenCalledTimes(1));
 await view.rerender(<HighlightPickerModal visible draftKey={second} onPicked={onPicked} onClose={onClose}/>);
 await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));await waitFor(()=>expect(mockCompress).toHaveBeenCalledTimes(2));
 await act(async()=>{old.resolve('file:///old.mp4');});
 expect(onPicked).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
 expect(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA)).toBeDisabled();
 await act(async()=>{fresh.resolve('file:///fresh.mp4');});
 expect(onPicked).toHaveBeenCalledTimes(1);expect(onPicked).toHaveBeenCalledWith(expect.objectContaining({uri:'file:///fresh.mp4'}));expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps an optimization failure open for an explicit successful retry',async()=>{
 jest.spyOn(Animated,'timing').mockReturnValue({start:jest.fn(),stop:jest.fn(),reset:jest.fn()});
 const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
 mockLibrary.mockReset().mockResolvedValue({canceled:false,assets:[{uri:'file:///clip.mp4',duration:1000}]});
 mockCompress.mockReset().mockRejectedValueOnce(Error('Could not prepare media.')).mockResolvedValueOnce('file:///retry.mp4');
 const onPicked=jest.fn(),onClose=jest.fn();
 await render(<HighlightPickerModal visible onPicked={onPicked} onClose={onClose}/>);
 await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));
 await waitFor(()=>expect(alert).toHaveBeenCalledWith('Could not optimize that clip','Could not prepare media.'));
 expect(onPicked).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA));
 await waitFor(()=>expect(onPicked).toHaveBeenCalledWith(expect.objectContaining({uri:'file:///retry.mp4'})));
 expect(onPicked).toHaveBeenCalledTimes(1);expect(onClose).toHaveBeenCalledTimes(1);
 jest.restoreAllMocks();
});

/** The content-sized panel still owns the optimizing flight; dismissal waits for that operation. */
it('keeps active optimization visible and blocks Cancel until its accepted completion', async () => {
  const compressed = deferred<string>();
  mockLibrary.mockReset().mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///clip.mp4', duration: 1000 }] });
  mockCompress.mockReset().mockReturnValueOnce(compressed.promise);
  const onPicked = jest.fn(), onClose = jest.fn();
  await render(<HighlightPickerModal visible onPicked={onPicked} onClose={onClose} />);
  let pick!: Promise<unknown>;
  await act(async () => { pick = fireEvent.press(screen.getByLabelText(HIGHLIGHT_LIBRARY_CTA)); });
  await waitFor(() => expect(screen.getByRole('progressbar', { name: HIGHLIGHT_OPTIMIZING })).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Cancel'));
  expect(onClose).not.toHaveBeenCalled();
  expect(onPicked).not.toHaveBeenCalled();
  await act(async () => { compressed.resolve('file:///compressed.mp4'); await pick; });
  expect(onPicked).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});
