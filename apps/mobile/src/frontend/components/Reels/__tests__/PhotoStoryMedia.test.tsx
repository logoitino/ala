/**
 * `PhotoStoryMedia` (UX-05 feed): counter chip and dots for a multi-photo story (hidden for one photo),
 * the current description handed to the card, screen-reader labels and increment / decrement actions,
 * and the cover fallback while photos load or after a failure.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { PhotoStoryMedia, storyPhotoLabel } from '@/components/Reels/PhotoStoryMedia';
import type { HighlightClip, StoryPhoto } from '@/data/highlights';

const mockState: { photos: StoryPhoto[]; loading: boolean; error: boolean } = { photos: [], loading: false, error: false };
const mockHook = jest.fn();
jest.mock('@/hooks/useStoryPhotos', () => ({
  useStoryPhotos: (...args: unknown[]) => {
    mockHook(...args);
    return mockState;
  },
}));
jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn() }));

const clip: HighlightClip = {
  id: 's1',
  athleteName: 'Sione',
  school: 'ALA',
  tag: 'Service day',
  videoUrl: '',
  mediaType: 'photo_story',
  photoCount: 3,
  coverUrl: 'https://x/cover.jpg',
};
const photo = (id: string, position: number, description: string | null = null): StoryPhoto => ({
  id,
  position,
  imageUrl: `https://x/${id}.jpg`,
  description,
});

function setPhotos(photos: StoryPhoto[], extra: Partial<typeof mockState> = {}) {
  mockState.photos = photos;
  mockState.loading = extra.loading ?? false;
  mockState.error = extra.error ?? false;
}

beforeEach(() => {
  mockHook.mockReset();
  setPhotos([]);
});

describe('PhotoStoryMedia', () => {
  it('shows a 1 / 3 counter and dots, and hands the first description to the card', async () => {
    setPhotos([photo('a', 0, 'Packing food boxes'), photo('b', 1), photo('c', 2)]);
    const onPhotoChange = jest.fn();
    await render(<PhotoStoryMedia clip={clip} active onPhotoChange={onPhotoChange} />);
    expect(screen.getByText('1 / 3', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('photo-story-dots', { includeHiddenElements: true })).toBeTruthy();
    expect(onPhotoChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a', description: 'Packing food boxes' }), 0, 3);
    expect(mockHook).toHaveBeenCalledWith(clip, true);
  });

  it('labels each photo with its description, else its place in the story', async () => {
    setPhotos([photo('a', 0, 'Packing food boxes'), photo('b', 1), photo('c', 2)]);
    await render(<PhotoStoryMedia clip={clip} active />);
    expect(screen.getByLabelText('Packing food boxes', { includeHiddenElements: true })).toBeTruthy();
    expect(storyPhotoLabel(null, 1, 5)).toBe('Photo 2 of 5');
    expect(storyPhotoLabel({ description: '  ' }, 0, 2)).toBe('Photo 1 of 2');
  });

  it('moves between photos with the adjustable increment / decrement actions', async () => {
    setPhotos([photo('a', 0), photo('b', 1, 'Team huddle'), photo('c', 2)]);
    const onPhotoChange = jest.fn();
    await render(<PhotoStoryMedia clip={clip} active onPhotoChange={onPhotoChange} />);
    const story = screen.getByLabelText('Photo story, 3 photos');
    expect(story.props.accessibilityRole).toBe('adjustable');
    expect(story.props.accessibilityValue).toEqual({ text: 'Photo 1 of 3' });

    await act(async () => {
      fireEvent(story, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    });
    expect(screen.getByText('2 / 3', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Photo story, 3 photos').props.accessibilityValue).toEqual({ text: 'Team huddle, photo 2 of 3' });
    expect(onPhotoChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), 1, 3);

    await act(async () => {
      fireEvent(story, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    });
    await act(async () => {
      fireEvent(story, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    });
    expect(screen.getByText('3 / 3', { includeHiddenElements: true })).toBeTruthy();

    await act(async () => {
      fireEvent(story, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    });
    expect(screen.getByText('2 / 3', { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps the counter in step from scroll events alone (react-native-web skips momentum end)', async () => {
    setPhotos([photo('a', 0), photo('b', 1), photo('c', 2)]);
    const onPhotoChange = jest.fn();
    await render(<PhotoStoryMedia clip={clip} active onPhotoChange={onPhotoChange} />);
    await fireEvent(screen.getByTestId('photo-story'), 'layout', { nativeEvent: { layout: { width: 400, height: 800 } } });
    const scrollTo = async (x: number) =>
      act(async () => {
        fireEvent.scroll(screen.getByTestId('photo-story-pager'), {
          nativeEvent: { contentOffset: { x, y: 0 }, contentSize: { width: 1200, height: 800 }, layoutMeasurement: { width: 400, height: 800 } },
        });
      });
    await scrollTo(790);
    expect(screen.getByText('3 / 3', { includeHiddenElements: true })).toBeTruthy();
    expect(onPhotoChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c' }), 2, 3);
    await scrollTo(420);
    expect(screen.getByText('2 / 3', { includeHiddenElements: true })).toBeTruthy();
    // Overscroll past either end clamps to a real photo.
    await scrollTo(-60);
    expect(screen.getByText('1 / 3', { includeHiddenElements: true })).toBeTruthy();
  });

  it('reports content ready only when a photo or the cover actually loads', async () => {
    setPhotos([photo('a', 0), photo('b', 1)]);
    const onContentReady = jest.fn();
    const view = await render(<PhotoStoryMedia clip={clip} active onContentReady={onContentReady} />);
    expect(onContentReady).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Photo 1 of 2', { includeHiddenElements: true }), 'load');
    expect(onContentReady).toHaveBeenCalledTimes(1);

    onContentReady.mockReset();
    setPhotos([], { loading: true });
    await view.rerender(<PhotoStoryMedia clip={clip} active onContentReady={onContentReady} />);
    await fireEvent(screen.getByLabelText('Photo story cover, Service day'), 'error');
    expect(onContentReady).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Photo story cover, Service day'), 'load');
    expect(onContentReady).toHaveBeenCalledTimes(1);
  });

  it('hides the counter, dots and adjustable role for a single photo', async () => {
    setPhotos([photo('a', 0)]);
    await render(<PhotoStoryMedia clip={{ ...clip, photoCount: 1 }} active />);
    expect(screen.queryByText('1 / 1', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('photo-story-dots', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByLabelText(/Photo story, \d+ photos/)).toBeNull();
    expect(screen.getAllByLabelText('Photo 1 of 1').length).toBeGreaterThan(0);
  });

  it('shows the cover while loading and after an error', async () => {
    setPhotos([], { loading: true });
    const view = await render(<PhotoStoryMedia clip={clip} active />);
    expect(screen.getByLabelText('Photo story cover, Service day')).toBeTruthy();
    expect(screen.getByLabelText('Loading photos')).toBeTruthy();

    setPhotos([], { error: true });
    await view.rerender(<PhotoStoryMedia clip={clip} active />);
    expect(screen.getByLabelText('Photo story cover, Service day')).toBeTruthy();
    expect(screen.getByText('Showing the cover photo')).toBeTruthy();
    expect(screen.queryByLabelText('Loading photos')).toBeNull();
  });

  it('says photos are unavailable when there is no cover and nothing loaded', async () => {
    setPhotos([]);
    await render(<PhotoStoryMedia clip={{ ...clip, coverUrl: null }} active={false} />);
    expect(screen.getByText("Photos aren't available right now")).toBeTruthy();
  });
});
