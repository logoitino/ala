/** The storage boundary carries existing paths/options and authority through without leaking SDK response types. */
import { createSupabaseMediaStorage, mediaStorage } from '@/lib/mediaStorage';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { storage: { from: (bucket: string) => mockFrom(bucket) } } }));

function fixture() {
  const bucket = {
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://media.example/photo.jpg' } })),
    upload: jest.fn(async () => ({ data: { path: 'ignored' }, error: null as { message: string } | null })),
    createSignedUrl: jest.fn(async () => ({ data: { signedUrl: 'https://media.example/private?token=one' }, error: null as { message: string } | null })),
    list: jest.fn(async () => ({ data: [{ id: 'file', name: 'photo.jpg', metadata: { size: 10 } }], error: null as { message: string } | null })),
    remove: jest.fn(async () => ({ data: [], error: null as { message: string } | null })),
  };
  const client = { storage: { from: jest.fn(() => bucket) } };
  const adapter = createSupabaseMediaStorage(client as unknown as Parameters<typeof createSupabaseMediaStorage>[0]);
  return { adapter, client, bucket };
}

beforeEach(() => jest.clearAllMocks());

it('binds the configured default once without constructing another client', () => {
  const { bucket } = fixture(); mockFrom.mockReturnValue(bucket);
  expect(mediaStorage.publicUrl('avatars', 'owner/photo.jpg')).toBe('https://media.example/photo.jpg');
  expect(mockFrom).toHaveBeenCalledWith('avatars');
  expect(bucket.getPublicUrl).toHaveBeenCalledWith('owner/photo.jpg');
});

it('preserves bytes, MIME, overwrite and bucket/path on upload', async () => {
  const { adapter, client, bucket } = fixture();
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const options = { contentType: 'image/jpeg', upsert: false };
  await expect(adapter.upload('reels', 'owner/stories/reel/0-1700000000000.jpg', bytes, options)).resolves.toEqual({ data: null, error: null });
  expect(client.storage.from).toHaveBeenCalledWith('reels');
  expect(bucket.upload).toHaveBeenCalledWith('owner/stories/reel/0-1700000000000.jpg', bytes, options);
});

it('maps signed playback to a URL without changing the private bucket or expiry', async () => {
  const { adapter, client, bucket } = fixture();
  await expect(adapter.sign('reel_vault', 'owner/clip.mp4', 3600)).resolves.toEqual({ data: 'https://media.example/private?token=one', error: null });
  expect(client.storage.from).toHaveBeenCalledWith('reel_vault');
  expect(bucket.createSignedUrl).toHaveBeenCalledWith('owner/clip.mp4', 3600);
});

it('keeps missing object IDs visible to cleanup validation and omits provider metadata', async () => {
  const { adapter, bucket } = fixture();
  bucket.list.mockResolvedValue({ data: [{ id: null, name: 'folder', metadata: {} }] as unknown as { id: string; name: string; metadata: { size: number } }[], error: null });
  const options = { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' as const } };
  await expect(adapter.list('reels', 'owner/stories/reel', options)).resolves.toEqual({ data: [{ id: null, name: 'folder' }], error: null });
  expect(bucket.list).toHaveBeenCalledWith('owner/stories/reel', options);
});

it('removes only the exact requested paths', async () => {
  const { adapter, client, bucket } = fixture(); const paths = ['owner/stories/reel/0-1700000000000.jpg'];
  await expect(adapter.remove('reels', paths)).resolves.toEqual({ data: null, error: null });
  expect(client.storage.from).toHaveBeenCalledWith('reels'); expect(bucket.remove).toHaveBeenCalledWith(paths);
});

it('maps provider refusal without declaring successful upload, signing, listing or deletion', async () => {
  const { adapter, bucket } = fixture(); const error = { message: 'denied', internalCode: 'provider-only' };
  bucket.upload.mockResolvedValue({ data: { path: 'ignored' }, error });
  bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'ignored' }, error });
  bucket.list.mockResolvedValue({ data: [], error }); bucket.remove.mockResolvedValue({ data: [], error });
  const expected = { data: null, error: { message: 'denied' } };
  await expect(adapter.upload('reels', 'path', new ArrayBuffer(0), { contentType: 'image/jpeg', upsert: false })).resolves.toEqual(expected);
  await expect(adapter.sign('reel_vault', 'path', 3600)).resolves.toEqual(expected);
  await expect(adapter.list('reels', 'path', { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } })).resolves.toEqual(expected);
  await expect(adapter.remove('reels', ['path'])).resolves.toEqual(expected);
});

it('returns an empty public URL on unavailable URL construction and preserves rejected transport operations', async () => {
  const { adapter, bucket } = fixture(); bucket.getPublicUrl.mockImplementation(() => { throw new Error('not configured'); });
  expect(adapter.publicUrl('avatars', 'path')).toBe('');
  bucket.remove.mockRejectedValue(new Error('offline'));
  await expect(adapter.remove('reels', ['path'])).rejects.toThrow('offline');
});
