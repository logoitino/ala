import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/beyondGame';
import * as prepare from '@/services/BeyondGameMediaService';
import * as picker from 'expo-image-picker';
import { exportCsv } from '@/lib/csvExport';
import { BeyondGameScreen } from '../BeyondGameScreen';
import { BeyondGameComposer, normalizePickedJpeg } from '../BeyondGameComposer';
import { BeyondGameMedia } from '../BeyondGameMedia';
import type { BeyondPost } from '@tapuai/shared-types/beyondGame';

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn() }));
jest.mock('@/lib/csvExport', () => ({ exportCsv: jest.fn() }));
jest.mock('@/lib/beyondGame', () => ({ fetchBeyondStatus: jest.fn(), fetchBeyondPosts: jest.fn(), fetchMyBeyondPosts: jest.fn(), reserveBeyondPost: jest.fn(), uploadReservedBeyondMedia: jest.fn(), finalizeBeyondPost: jest.fn(), removeBeyondPost: jest.fn(), reportBeyondPost: jest.fn(), exportMyBeyondData: jest.fn(), signBeyondMedia: jest.fn() }));
jest.mock('@/services/BeyondGameMediaService', () => ({ prepareBeyondPhoto: jest.fn(), prepareBeyondVideo: jest.fn() }));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ pause: jest.fn(), addListener: () => ({ remove: jest.fn() }) }), VideoView: 'VideoView' }));
const mocked = jest.mocked(api);
const A = { user: { id: '11111111-1111-4111-8111-111111111111' }, profile: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: '11111111-1111-4111-8111-111111111111' }, loading: false };
const B = { user: { id: '22222222-2222-4222-8222-222222222222' }, profile: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: '22222222-2222-4222-8222-222222222222' }, loading: false };
const post = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', creatorId: A.profile.id, category: 'story', caption: 'Good sport', audience: 'friends', status: 'pending', revision: 1, createdAt: '2026-10-16T01:00:00Z', submittedAt: null, attestedAt: '2026-10-16T01:00:00Z', rightsVersion: 'beyond-rights-1', safetyVersion: 'beyond-safety-1', cleanup: 'not_requested', media: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', position: 0, kind: 'photo', path: 'file', mime: 'image/jpeg', bytes: 8, width: 1, height: 1, durationMs: null }], reviewReason: null, reviewedAt: null, reportCount: null } as BeyondPost;
function auth(v: typeof A) { jest.mocked(useAuth).mockReturnValue(v as ReturnType<typeof useAuth>); }
beforeEach(() => {
  jest.clearAllMocks(); auth(A); Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  mocked.fetchBeyondStatus.mockResolvedValue({ enabled: true, missing: [], actorId: A.profile.id, canSubmit: true, friendsOnly: true });
  mocked.fetchBeyondPosts.mockResolvedValue({ posts: [], nextId: null, enabled: true });
  mocked.fetchMyBeyondPosts.mockResolvedValue({ posts: [post], nextId: null, enabled: true });
  mocked.reserveBeyondPost.mockResolvedValue({ ...post, status: 'draft' });
  mocked.finalizeBeyondPost.mockResolvedValue(post);
  mocked.removeBeyondPost.mockResolvedValue({ ...post, status: 'removed', cleanup: 'pending' });
  mocked.exportMyBeyondData.mockResolvedValue({ items: [], nextId: null });
  jest.mocked(exportCsv).mockResolvedValue('downloaded');
  jest.mocked(picker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(picker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:local', type: 'image' }] } as never);
  jest.mocked(prepare.prepareBeyondPhoto).mockResolvedValue({ input: { id: post.media[0].id, kind: 'photo', bytes: 8, width: 1, height: 1 }, bytes: new ArrayBuffer(8) });
});
it('keeps four categories and permitted legacy discovery while paused, with own removal/export', async () => {
  mocked.fetchBeyondStatus.mockResolvedValue({ enabled: false, missing: [], actorId: A.profile.id, canSubmit: false, friendsOnly: true });
  mocked.fetchBeyondPosts.mockResolvedValue({ posts: [], nextId: null, enabled: false });
  await render(<BeyondGameScreen renderLegacy={category => <Text>{`Legacy ${category}`}</Text>} />);
  for (const name of ['Workouts', 'Service', 'Learning & STEM', 'Stories']) expect(screen.getByLabelText(name)).toBeTruthy();
  await screen.findByText('Good sport'); expect(screen.getByText('Legacy workout')).toBeTruthy();
  expect(screen.queryByLabelText('Share a moment')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Remove my post'));
  expect(mocked.removeBeyondPost).toHaveBeenCalledWith(A.profile.id, post.id);
  await screen.findByLabelText('Export my Beyond data');
  await fireEvent.press(screen.getByLabelText('Export my Beyond data')); await waitFor(() => expect(exportCsv).toHaveBeenCalled());
});
it('source failure hides stale history without claiming empty and closure masks all protected content', async () => {
  const view = await render(<BeyondGameScreen />); await screen.findByText('Good sport');
  mocked.fetchMyBeyondPosts.mockRejectedValueOnce(Error('Source unavailable'));
  await fireEvent.press(screen.getByLabelText('Refresh Beyond the Game'));
  await screen.findByText('Source unavailable'); expect(screen.queryByText('Good sport')).toBeNull(); expect(screen.queryByText('No posts in your current history page.')).toBeNull();
  auth({ ...A, profile: { ...A.profile, age_blocked_at: 'now' } } as typeof A); await view.rerender(<BeyondGameScreen />);
  expect(screen.queryByLabelText('Export my Beyond data')).toBeNull();
});
it('requires both consents and preserves a friends-only draft when composer Back closes', async () => {
  const back = jest.fn(); const view = await render(<BeyondGameComposer visible category="service" onBack={back} onSubmitted={jest.fn()} />);
  await screen.findByLabelText('Choose JPEG photos');
  await fireEvent.changeText(screen.getByLabelText('Caption'), 'Helping together');
  await fireEvent.press(screen.getByLabelText('Choose JPEG photos'));
  expect(mocked.reserveBeyondPost).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Everyone')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Back to Beyond the Game')); expect(back).toHaveBeenCalled();
  await view.rerender(<BeyondGameComposer visible={false} category="service" onBack={back} onSubmitted={jest.fn()} />);
  await view.rerender(<BeyondGameComposer visible category="service" onBack={back} onSubmitted={jest.fn()} />);
  await screen.findByLabelText('Caption'); expect(screen.getByLabelText('Caption').props.value).toBe('Helping together');
});
it('freezes exact files/details/request on uncertain upload and retries rather than creating another submission', async () => {
  mocked.uploadReservedBeyondMedia.mockRejectedValueOnce(Error('Upload reply lost'));
  await render(<BeyondGameComposer visible category="story" onBack={jest.fn()} onSubmitted={jest.fn()} />);
  await fireEvent.press(await screen.findByLabelText('Choose JPEG photos'));
  await fireEvent.changeText(screen.getByLabelText('Caption'), 'Same story');
  await fireEvent.press(screen.getByLabelText('I have permission for the people, filming, music and marks in this post.'));
  await fireEvent.press(screen.getByLabelText('This post is safe to share and reveals no private locations or vulnerable people.'));
  await fireEvent.press(screen.getByLabelText('Submit for review'));
  await screen.findByText(/Upload reply lost/); expect(mocked.finalizeBeyondPost).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Refresh contribution access'));
  await screen.findByLabelText('Retry same submission'); await fireEvent.press(screen.getByLabelText('Retry same submission'));
  await waitFor(() => expect(mocked.finalizeBeyondPost).toHaveBeenCalled());
  expect(mocked.reserveBeyondPost.mock.calls[1]).toEqual(mocked.reserveBeyondPost.mock.calls[0]);
});
it('discards outgoing picker work on account switch before any reservation', async () => {
  let resolve!: (v: unknown) => void; jest.mocked(picker.launchImageLibraryAsync).mockReturnValueOnce(new Promise(r => { resolve = r; }) as never);
  const view = await render(<BeyondGameComposer visible category="story" onBack={jest.fn()} onSubmitted={jest.fn()} />);
  await fireEvent.press(await screen.findByLabelText('Choose JPEG photos'));
  auth(B); await view.rerender(<BeyondGameComposer visible category="story" onBack={jest.fn()} onSubmitted={jest.fn()} />);
  await act(async () => resolve({ canceled: false, assets: [{ uri: 'blob:private-A' }] }));
  expect(prepare.prepareBeyondPhoto).not.toHaveBeenCalled(); expect(mocked.reserveBeyondPost).not.toHaveBeenCalled();
});
it('loads private media only on intent, expires URLs and discards a late outgoing signature', async () => {
  jest.useFakeTimers(); mocked.signBeyondMedia.mockResolvedValue({ url: 'https://private.invalid/one', expiresAt: Date.now() + 60000 });
  const view = await render(<BeyondGameMedia post={post} actor={{ userId: A.user.id, profileId: A.profile.id }} active scopeKey="one" />);
  expect(mocked.signBeyondMedia).not.toHaveBeenCalled(); await fireEvent.press(screen.getByLabelText('Load post media'));
  expect(screen.getByLabelText('Post photo 1')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(60000); }); expect(screen.queryByLabelText('Post photo 1')).toBeNull();
  let resolve!: (v: { url: string; expiresAt: number }) => void; mocked.signBeyondMedia.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  await fireEvent.press(screen.getByLabelText('Load post media')); await view.rerender(<BeyondGameMedia post={post} actor={{ userId: B.user.id, profileId: B.profile.id }} active scopeKey="two" />);
  await act(async () => resolve({ url: 'https://private.invalid/old', expiresAt: Date.now() + 60000 })); expect(screen.queryByLabelText('Post photo 1')).toBeNull();
  jest.useRealTimers();
});
it('allows a fresh private load after scope change while rejecting the old load callback', async () => {
  mocked.signBeyondMedia.mockResolvedValue({ url: 'https://private.invalid/new', expiresAt: Date.now() + 60000 });
  const view = await render(<BeyondGameMedia post={post} actor={{ userId: A.user.id, profileId: A.profile.id }} active scopeKey="one" />);
  await view.rerender(<BeyondGameMedia post={post} actor={{ userId: B.user.id, profileId: B.profile.id }} active scopeKey="two" />);
  await fireEvent.press(screen.getByLabelText('Load post media'));
  expect(mocked.signBeyondMedia).toHaveBeenCalledWith({ userId: B.user.id, profileId: B.profile.id }, post, post.media[0].id);
  expect(screen.getByLabelText('Post photo 1')).toBeTruthy();
});
it('dismissed export retries the same pages instead of skipping undelivered records', async () => {
  mocked.exportMyBeyondData.mockResolvedValue({ items: [{ id: 'page1' }], nextId: 'next' });
  jest.mocked(exportCsv).mockResolvedValueOnce('dismissed');
  await render(<BeyondGameScreen />); await screen.findByLabelText('Export my Beyond data');
  await fireEvent.press(screen.getByLabelText('Export my Beyond data')); await screen.findByText('Export sharing dismissed.');
  const button = screen.queryByLabelText('Export next data pages') ?? screen.getByLabelText('Export my Beyond data');
  await fireEvent.press(button); await waitFor(() => expect(exportCsv).toHaveBeenCalledTimes(2));
  expect(mocked.exportMyBeyondData.mock.calls.slice(3).map(call => call[2])).toEqual([null, null, null]);
});
it('completed export can be requested again without inventing an empty-history download', async () => {
  await render(<BeyondGameScreen />); await screen.findByLabelText('Export my Beyond data');
  await fireEvent.press(screen.getByLabelText('Export my Beyond data')); await screen.findByText(/Current data pages exported/);
  await fireEvent.press(screen.getByLabelText('Export my Beyond data')); await waitFor(() => expect(exportCsv).toHaveBeenCalledTimes(2));
  expect(mocked.exportMyBeyondData).toHaveBeenCalledTimes(6);
});
it('rejects external and oversized fake local JPEG picker data', async () => {
  await expect(normalizePickedJpeg('https://outside.invalid/a.jpg')).rejects.toThrow(/local/);
  await expect(normalizePickedJpeg('data:image/png;base64,AA==')).rejects.toThrow(/JPEG/);
  await expect(normalizePickedJpeg('data:image/jpeg;base64,' + 'A'.repeat(71000000))).rejects.toThrow(/large/);
});
function retainedPress(node: { unstable_fiber: unknown }): () => void {
  type Fiber = { memoizedProps?: { onPress?: () => void }; return?: Fiber | null };
  let fiber = node.unstable_fiber as Fiber | null;
  for (let depth = 0; fiber && depth < 30; depth++, fiber = fiber.return ?? null) {
    if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress;
  }
  throw Error('Actual press callback missing');
}
it('rejects retained composer submission after closure/reopen and masks outgoing draft synchronously', async () => {
  const props = { visible: true, category: 'story' as const, onBack: jest.fn(), onSubmitted: jest.fn() };
  const view = await render(<BeyondGameComposer {...props} />);
  await fireEvent.press(await screen.findByLabelText('Choose JPEG photos'));
  await fireEvent.changeText(screen.getByLabelText('Caption'), 'Private draft A');
  await fireEvent.press(screen.getByLabelText('I have permission for the people, filming, music and marks in this post.'));
  await fireEvent.press(screen.getByLabelText('This post is safe to share and reveals no private locations or vulnerable people.'));
  const oldSubmit = retainedPress(screen.getByLabelText('Submit for review'));
  const oldBack = retainedPress(screen.getByLabelText('Back to Beyond the Game'));
  auth({ ...A, profile: { ...A.profile, age_blocked_at: 'now' } } as typeof A); await view.rerender(<BeyondGameComposer {...props} />);
  expect(screen.queryByLabelText('Caption')).toBeNull();
  auth(A); await view.rerender(<BeyondGameComposer {...props} />); await screen.findByLabelText('Caption');
  expect(screen.getByLabelText('Caption').props.value).toBe('');
  await act(async () => { oldSubmit(); oldBack(); });
  expect(mocked.reserveBeyondPost).not.toHaveBeenCalled(); expect(props.onBack).not.toHaveBeenCalled();
});
it('refuses late prepared media in the same background event and keeps a fresh foreground choice usable', async () => {
  let change!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { change = callback; return { remove: jest.fn() }; });
  let resolve!: (value: prepare.PreparedBeyondMedia) => void;
  jest.mocked(prepare.prepareBeyondPhoto).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  await render(<BeyondGameComposer visible category="story" onBack={jest.fn()} onSubmitted={jest.fn()} />);
  await fireEvent.press(await screen.findByLabelText('Choose JPEG photos'));
  await act(async () => { change('background'); resolve({ input: { id: post.media[0].id, kind: 'photo', bytes: 8, width: 1, height: 1 }, bytes: new ArrayBuffer(8) }); });
  expect(screen.getByText('No files prepared.')).toBeTruthy(); expect(mocked.reserveBeyondPost).not.toHaveBeenCalled();
  await act(async () => change('active')); await fireEvent.press(await screen.findByLabelText('Choose JPEG photos'));
  expect(await screen.findByText('1 prepared photo(s)')).toBeTruthy(); jest.restoreAllMocks();
});
it('allows explicit reserved cancellation while new contributions become paused', async () => {
  mocked.uploadReservedBeyondMedia.mockRejectedValueOnce(Error('Upload reply lost'));
  await render(<BeyondGameComposer visible category="story" onBack={jest.fn()} onSubmitted={jest.fn()} />);
  await fireEvent.press(await screen.findByLabelText('Choose JPEG photos'));
  await fireEvent.press(screen.getByLabelText('I have permission for the people, filming, music and marks in this post.'));
  await fireEvent.press(screen.getByLabelText('This post is safe to share and reveals no private locations or vulnerable people.'));
  await fireEvent.press(screen.getByLabelText('Submit for review')); await screen.findByText('Upload reply lost');
  mocked.fetchBeyondStatus.mockResolvedValue({ enabled: false, missing: [], actorId: A.profile.id, canSubmit: false, friendsOnly: true });
  await fireEvent.press(screen.getByLabelText('Refresh contribution access')); await screen.findByLabelText('Cancel reserved submission');
  await fireEvent.press(screen.getByLabelText('Cancel reserved submission')); expect(mocked.removeBeyondPost).toHaveBeenCalledWith(A.profile.id, post.id);
  expect(await screen.findByText(/Reserved submission removed/)).toBeTruthy();
});
it('unsupported video shows a useful error, then a JPEG choice works after access refresh', async () => {
  jest.mocked(picker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///v.mp4', duration: 1000 }] } as never);
  jest.mocked(prepare.prepareBeyondVideo).mockRejectedValueOnce(Error('Video preparation unavailable. Choose JPEG photos instead.'));
  await render(<BeyondGameComposer visible category="workout" onBack={jest.fn()} onSubmitted={jest.fn()} />);
  await fireEvent.press(await screen.findByLabelText('Choose one video (45 seconds max)')); await screen.findByText(/Video preparation unavailable/);
  expect(mocked.reserveBeyondPost).not.toHaveBeenCalled(); await fireEvent.press(screen.getByLabelText('Refresh contribution access'));
  await fireEvent.press(await screen.findByLabelText('Choose JPEG photos')); expect(await screen.findByText('1 prepared photo(s)')).toBeTruthy();
});
it('guest reads use explicit null actor and never request private own records or export', async () => {
  jest.mocked(useAuth).mockReturnValue({ user: null, profile: null, loading: false } as ReturnType<typeof useAuth>);
  mocked.fetchBeyondStatus.mockResolvedValue({ enabled: true, missing: [], actorId: null, canSubmit: false, friendsOnly: true });
  await render(<BeyondGameScreen />); await screen.findByText('No approved shared posts in this category page.');
  expect(mocked.fetchBeyondPosts).toHaveBeenCalledWith(null, 'workout', 30, null); expect(mocked.fetchMyBeyondPosts).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Export my Beyond data')).toBeNull(); expect(screen.queryByLabelText('Share a moment')).toBeNull();
});
it('incoming account starts on its latest own page instead of inheriting the outgoing opaque cursor', async () => {
  const cursor = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  mocked.fetchMyBeyondPosts.mockResolvedValue({ posts: [post], nextId: cursor, enabled: true });
  const view = await render(<BeyondGameScreen />); await fireEvent.press(await screen.findByLabelText('Older my posts'));
  await waitFor(() => expect(mocked.fetchMyBeyondPosts).toHaveBeenLastCalledWith(A.profile.id, 30, cursor));
  auth(B); mocked.fetchBeyondStatus.mockResolvedValue({ enabled: true, missing: [], actorId: B.profile.id, canSubmit: true, friendsOnly: true });
  mocked.fetchMyBeyondPosts.mockResolvedValue({ posts: [], nextId: null, enabled: true });
  await view.rerender(<BeyondGameScreen />);
  await waitFor(() => expect(mocked.fetchMyBeyondPosts).toHaveBeenLastCalledWith(B.profile.id, 30, null));
});
it('Upload ＋ → Beyond moment opens the composer only after the server allows submitting', async () => {
  const started = jest.fn();
  await render(<BeyondGameScreen startComposing onComposeStarted={started} />);
  await screen.findByLabelText('Back to Beyond the Game');
  expect(started).toHaveBeenCalledTimes(1);
});
it('Upload ＋ → Beyond moment keeps the page (no composer) while contributions are paused', async () => {
  mocked.fetchBeyondStatus.mockResolvedValue({ enabled: false, missing: [], actorId: A.profile.id, canSubmit: false, friendsOnly: true });
  mocked.fetchBeyondPosts.mockResolvedValue({ posts: [], nextId: null, enabled: false });
  const started = jest.fn();
  await render(<BeyondGameScreen startComposing onComposeStarted={started} />);
  await screen.findByText('Good sport');
  expect(screen.queryByLabelText('Back to Beyond the Game')).toBeNull();
  expect(started).not.toHaveBeenCalled();
});
