/** Failed-photo cleanup must remove only claimed owner files and keep retry intent after errors. */
const UID = '11111111-1111-4111-8111-111111111111';
const REEL = '22222222-2222-4222-8222-222222222222';
const PREFIX = `${UID}/stories/${REEL}/`;
const mockKeys = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: {
    setItem: jest.fn(async (key: string, value: string) => { mockKeys.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { mockKeys.delete(key); }),
    getAllKeys: jest.fn(async () => [...mockKeys.keys()]),
  },
}));
const mockUser = jest.fn();
const mockRpc = jest.fn();
const mockList = jest.fn();
const mockRemove = jest.fn();
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockUser(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: { from: (bucket: string) => ({
      list: (...args: unknown[]) => mockList(bucket, ...args),
      remove: (...args: unknown[]) => mockRemove(bucket, ...args),
    }) },
  },
}));
import { cleanupFailedPhotoStory, rememberPhotoStoryCleanup, queuedPhotoStoryCleanups } from '@/lib/photoStoryCleanup';

const alternateStorage = () => ({
  publicUrl: jest.fn(() => ''),
  upload: jest.fn(async () => ({ data: null, error: null })),
  sign: jest.fn(async () => ({ data: null, error: null })),
  list: jest.fn(async () => ({ data: [{ name: '0-1700000000000.jpg', id: 'photo' }], error: null as { message: string } | null })),
  remove: jest.fn(async () => ({ data: null, error: null as { message: string } | null })),
});

beforeEach(() => {
  jest.clearAllMocks(); mockKeys.clear(); mockUser.mockReset(); mockRpc.mockReset(); mockList.mockReset(); mockRemove.mockReset();
  mockUser.mockResolvedValue({ data: { user: { id: UID } }, error: null });
  mockRpc.mockImplementation(async (fn: string) => ({
    data: fn.startsWith('begin_') ? { status: 'pending', prefix: PREFIX } : { status: 'discarded' }, error: null,
  }));
  mockList.mockResolvedValue({ data: [], error: null });
  mockRemove.mockResolvedValue({ data: [], error: null });
});

it('deletes all listed retry leftovers through Storage before finishing the hidden row', async () => {
  const names = ['0-1700000000000.jpg', '0-1700000000001.jpg', '1-1700000000002.jpg'];
  mockList.mockResolvedValueOnce({ data: names.map((name) => ({ name, id: name })), error: null });
  await expect(cleanupFailedPhotoStory(REEL)).resolves.toBe('discarded');
  expect(mockList).toHaveBeenCalledWith('reels', PREFIX.slice(0, -1), expect.objectContaining({ limit: 100, offset: 0 }));
  expect(mockRemove).toHaveBeenCalledWith('reels', names.map((name) => PREFIX + name));
  expect(mockRpc).toHaveBeenLastCalledWith('finish_failed_photo_story_cleanup', { p_reel_id: REEL });
  expect(mockRemove.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder.at(-1)!);
});

it.each(['published', 'discarded'] as const)('leaves Storage untouched when begin reports %s', async (status) => {
  mockRpc.mockResolvedValue({ data: { status }, error: null });
  await expect(cleanupFailedPhotoStory(REEL)).resolves.toBe(status);
  expect(mockList).not.toHaveBeenCalled();
  expect(mockRemove).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('does not finish when Storage deletion fails, so the server claim can be retried', async () => {
  mockList.mockResolvedValueOnce({ data: [{ name: '0-1700000000000.jpg', id: 'photo' }], error: null });
  mockRemove.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await expect(cleanupFailedPhotoStory(REEL)).rejects.toThrow(/remove/i);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it.each(['other-user/stories/other/', `${UID}/stories/${REEL}/../`, `${PREFIX}nested/`])('rejects an unexpected prefix: %s', async (prefix) => {
  mockRpc.mockResolvedValue({ data: { status: 'pending', prefix }, error: null });
  await expect(cleanupFailedPhotoStory(REEL)).rejects.toThrow(/confirm/i);
  expect(mockRemove).not.toHaveBeenCalled();
});

it.each(['../other.jpg', 'folder/photo.jpg', '%2e%2e.jpg', 'folder'])('never removes an unexpected listed path: %s', async (name) => {
  mockList.mockResolvedValue({ data: [{ name, id: 'object' }], error: null });
  await expect(cleanupFailedPhotoStory(REEL)).rejects.toThrow(/confirm/i);
  expect(mockRemove).not.toHaveBeenCalled();
});

it('stops stale cleanup before removal when the account changes', async () => {
  mockList.mockResolvedValueOnce({ data: [{ name: '0-1700000000000.jpg', id: 'photo' }], error: null });
  mockUser.mockResolvedValueOnce({ data: { user: { id: UID } }, error: null })
    .mockResolvedValue({ data: { user: { id: '33333333-3333-4333-8333-333333333333' } }, error: null });
  await expect(cleanupFailedPhotoStory(REEL)).rejects.toThrow(/account/i);
  expect(mockRemove).not.toHaveBeenCalled();
});

it('reports a missing migration without a Storage fallback', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
  await expect(cleanupFailedPhotoStory(REEL)).rejects.toThrow(/database update/i);
  expect(mockRemove).not.toHaveBeenCalled();
});

it('rejects invalid ids before any request', async () => {
  await expect(cleanupFailedPhotoStory('../other-story')).rejects.toThrow(/story/i);
  expect(mockUser).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('uses zero offset after a full batch so deleting earlier files cannot skip the next batch', async () => {
  const objects = Array.from({ length: 100 }, (_, index) => ({ name: `${index % 10}-${1700000000000 + index}.jpg`, id: `${index}` }));
  mockList.mockResolvedValueOnce({ data: objects, error: null })
    .mockResolvedValueOnce({ data: [{ name: '0-1700000000200.jpg', id: 'last' }], error: null });
  await expect(cleanupFailedPhotoStory(REEL)).resolves.toBe('discarded');
  expect(mockList.mock.calls.every((call) => call[2].offset === 0)).toBe(true);
  expect(mockRemove).toHaveBeenCalledTimes(2);
});

it('persists cleanup across restart and only resumes the originating account keys', async () => {
  const other = '33333333-3333-4333-8333-333333333333';
  await rememberPhotoStoryCleanup(REEL, UID);
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([REEL]);
  await expect(queuedPhotoStoryCleanups(other)).resolves.toEqual([]);
  expect([...mockKeys.values()]).toEqual(['1']);
});

it('retains durable intent after deletion fails and clears it only after confirmed removal', async () => {
  mockRemove.mockRejectedValueOnce(new Error('offline'));
  mockList.mockResolvedValueOnce({ data: [{ name: '0-1700000000000.jpg', id: 'photo' }], error: null });
  await expect(cleanupFailedPhotoStory(REEL, UID)).rejects.toThrow('offline');
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([REEL]);
  await cleanupFailedPhotoStory(REEL, UID);
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([]);
});

it('preserves a published story while clearing its stale removal intent', async () => {
  await rememberPhotoStoryCleanup(REEL, UID);
  mockRpc.mockResolvedValue({ data: { status: 'published' }, error: null });
  await cleanupFailedPhotoStory(REEL, UID);
  expect(mockRemove).not.toHaveBeenCalled();
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([]);
});

it('ignores corrupt keys and refuses to queue invalid owner or story identifiers', async () => {
  mockKeys.set(`@tapuai/photo-cleanup/${UID}/../outside`, '1');
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([]);
  await expect(rememberPhotoStoryCleanup(REEL, '../owner')).rejects.toThrow(/account/i);
  await expect(rememberPhotoStoryCleanup('../story', UID)).rejects.toThrow(/story/i);
  expect(mockKeys.size).toBe(1);
});

it('retains intent if the account changes during the finish reply', async () => {
  mockRpc.mockImplementation(async (fn: string) => {
    if (fn.startsWith('finish_')) mockUser.mockResolvedValue({ data: { user: { id: '33333333-3333-4333-8333-333333333333' } }, error: null });
    return { data: fn.startsWith('begin_') ? { status: 'pending', prefix: PREFIX } : { status: 'discarded' }, error: null };
  });
  await expect(cleanupFailedPhotoStory(REEL, UID)).rejects.toThrow(/account/i);
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([REEL]);
});

it('does not erase renewed intent when an older completion arrives after a completed newer cleanup', async () => {
  let release!: (reply: unknown) => void;
  let began!: () => void;
  const started = new Promise<void>((resolve) => { began = resolve; });
  mockRpc.mockImplementationOnce(() => { began(); return new Promise((resolve) => { release = resolve; }); });
  const older = cleanupFailedPhotoStory(REEL, UID);
  await started;
  await cleanupFailedPhotoStory(REEL, UID);
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([]);
  await rememberPhotoStoryCleanup(REEL, UID);
  release({ data: { status: 'discarded' }, error: null });
  await older;
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([REEL]);
});

it('uses injected storage only for the server-claimed owner files and keeps server finish ordering', async () => {
  const storage = alternateStorage();
  await expect(cleanupFailedPhotoStory(REEL, UID, storage)).resolves.toBe('discarded');
  expect(storage.list).toHaveBeenCalledWith('reels', PREFIX.slice(0, -1), { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });
  expect(storage.remove).toHaveBeenCalledWith('reels', [`${PREFIX}0-1700000000000.jpg`]);
  expect(storage.remove.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder.at(-1)!);
  expect(mockList).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([]);
});

it('does not finish or lose queued intent when the injected provider cannot remove a photo', async () => {
  const storage = alternateStorage(); storage.remove.mockResolvedValue({ data: null, error: { message: 'provider diagnostic' } });
  await expect(cleanupFailedPhotoStory(REEL, UID, storage)).rejects.toThrow('Some unfinished photos could not be removed. Try again; removal remains queued.');
  expect(mockRpc).toHaveBeenCalledTimes(1);
  await expect(queuedPhotoStoryCleanups(UID)).resolves.toEqual([REEL]);
});

it('does not remove an unexpected path from an injected provider', async () => {
  const storage = alternateStorage(); storage.list.mockResolvedValue({ data: [{ name: '../private.jpg', id: 'photo' }], error: null });
  await expect(cleanupFailedPhotoStory(REEL, UID, storage)).rejects.toThrow(/confirm/i);
  expect(storage.remove).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('keeps account checks outside the injected provider and stops when the account changes during listing', async () => {
  const storage = alternateStorage(); storage.list.mockImplementation(async () => {
    mockUser.mockResolvedValue({ data: { user: { id: '33333333-3333-4333-8333-333333333333' } }, error: null });
    return { data: [{ name: '0-1700000000000.jpg', id: 'photo' }], error: null };
  });
  await expect(cleanupFailedPhotoStory(REEL, UID, storage)).rejects.toThrow(/account/i);
  expect(storage.remove).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
});
