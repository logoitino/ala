/**
 * Photo-story privacy and storage rules in MediaUploadService (PHOTO_STORIES_DESIGN.md "Privacy and safety"):
 * JPEG metadata (EXIF/GPS, XMP, Photoshop/IPTC, comments, trailers) is removed while image segments stay
 * byte-identical; EXIF Orientation survives as a minimal orientation-only APP1 (QA fix, UX-05b); non-JPEG or
 * broken files are never uploaded uncleaned; photos land in the caller's own `reels/{uid}/stories/{reelId}/…`
 * folder with the path shape `set_reel_photos` validates, without overwriting; and the shared reel insert never
 * silently drops `media_type`.
 */

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockInsert = jest.fn();
const mockGetUser = jest.fn();
const mockSignedUrl = jest.fn();
const mockProfileUpdate = jest.fn();
const mockStorageFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: () => mockGetUser() },
    storage: { from: (bucket: string) => {
      mockStorageFrom(bucket);
      return { upload: (...args: unknown[]) => mockUpload(...args), getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args), createSignedUrl: (...args: unknown[]) => mockSignedUrl(...args) };
    } },
    from: () => ({ insert: (row: unknown) => ({ select: () => ({ single: () => mockInsert(row) }) }), update: (row: unknown) => ({ eq: (column: string, id: string) => mockProfileUpdate(row, column, id) }) }),
  },
}));

import { assetDurationMs, createMediaUploadService, insertReelRow, isHighlightTooLong, stripJpegMetadata, uploadStoryPhoto } from '@/services/MediaUploadService';
import { HIGHLIGHT_TOO_LONG } from '@/data/media';

describe('explicit clip duration units', () => {
  it.each([500, 1000])('keeps a native %sms clip in milliseconds by default', (duration) => {
    expect(assetDurationMs(duration)).toBe(duration);
    expect(isHighlightTooLong(duration)).toBe(false);
  });
  it.each([
    [500, 'milliseconds', 500, false],
    [1000, 'milliseconds', 1000, false],
    [0.5, 'seconds', 500, false],
    [45, 'seconds', 45000, false],
    [45.001, 'seconds', 45001, true],
    [45000, 'milliseconds', 45000, false],
    [45001, 'milliseconds', 45001, true],
  ] as const)('normalizes %s %s explicitly and checks the 45s boundary', (raw, unit, expected, overlong) => {
    expect(assetDurationMs(raw, unit)).toBe(expected);
    expect(isHighlightTooLong(raw, unit)).toBe(overlong);
  });
});

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));
/** A marker segment: FF, marker, 2-byte big-endian length (which counts itself), payload. */
const segment = (marker: number, payload: number[]) => {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
};
const decode = (bytes: Uint8Array) => String.fromCharCode(...bytes);

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const APP0 = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const APP1_EXIF = segment(0xe1, [...ascii('Exif'), 0, 0, ...ascii('MM*'), 0, ...ascii('GPSLatitude 40.7608 GPSLongitude -111.8910 Make Apple Model iPhone')]);
const APP1_XMP = segment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii('<x:xmpmeta><exif:GPSLatitude>40</exif:GPSLatitude></x:xmpmeta>')]);
const APP2_ICC = segment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, ...ascii('appl-device-profile')]);
const APP13_IPTC = segment(0xed, [...ascii('Photoshop 3.0'), 0, ...ascii('8BIM'), 4, 4, ...ascii('Kaleo at Westlake High')]);
const APP14_ADOBE = segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1]);
const APP15 = segment(0xef, ascii('vendor-blob'));
const COM = segment(0xfe, ascii('secret comment: home address'));
const DQT = segment(0xdb, [0, ...Array.from({ length: 64 }, (_, index) => index + 1)]);
// 640 × 480 baseline frame, three components.
const SOF0 = segment(0xc0, [8, 0x01, 0xe0, 0x02, 0x80, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const DHT = segment(0xc4, [0, ...Array.from({ length: 16 }, () => 1), ...Array.from({ length: 16 }, (_, index) => index)]);
const SOS = segment(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]);
// Entropy-coded data with a stuffed 0xFF00 and a restart marker, which must not end the scan.
const SCAN = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a];
const TRAILER = ascii('MPF trailer with Exif GPS copy');

/** EXIF APP1 with IFD0 = [Make, Orientation, GPS IFD pointer] plus a GPS IFD, in either byte order. */
const exifWithOrientation = (orientation: number, little = false) => {
  const u16 = (v: number) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (little ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const ifd0 = [
    ...u16(3),
    ...u16(0x010f), ...u16(2), ...u32(4), ...ascii('Sony'), // Make, ASCII ×4 inline
    ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, // Orientation SHORT ×1
    ...u16(0x8825), ...u16(4), ...u32(1), ...u32(8 + 2 + 36 + 4), // GPS IFD pointer
    ...u32(0),
  ];
  const gps = [...u16(1), ...u16(0x0002), ...u16(2), ...u32(12), ...u32(0), ...u32(0), ...ascii('GPSLatitude!')];
  return segment(0xe1, [...ascii('Exif'), 0, 0, ...(little ? ascii('II') : ascii('MM')), ...u16(42), ...u32(8), ...ifd0, ...gps]);
};
const ORIENTATION_ONLY = (orientation: number) => [
  0xff, 0xe1, 0x00, 0x22, ...ascii('Exif'), 0, 0, ...ascii('MM'), 0x00, 0x2a, 0, 0, 0, 8,
  0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0,
];

const dirtyJpeg = () => new Uint8Array([
  ...SOI, ...APP0, ...APP1_EXIF, ...APP1_XMP, ...APP2_ICC, ...APP13_IPTC, ...APP14_ADOBE, ...APP15, ...COM,
  ...DQT, ...SOF0, ...DHT, ...SOS, ...SCAN, ...EOI, ...TRAILER,
]);
const cleanJpeg = () => new Uint8Array([...SOI, ...APP0, ...APP14_ADOBE, ...DQT, ...SOF0, ...DHT, ...SOS, ...SCAN, ...EOI]);

describe('replaceable upload storage', () => {
  const realFetch = global.fetch;
  const storage = () => ({
    publicUrl: jest.fn((bucket: string, path: string) => `https://media.example/${bucket}/${path}`),
    upload: jest.fn(async (_bucket: string, _path: string, _body: ArrayBuffer, _options: { contentType: string; upsert: boolean }) => ({ data: null, error: null as { message: string } | null })),
    sign: jest.fn(async () => ({ data: 'https://media.example/private/playback', error: null })),
    list: jest.fn(async () => ({ data: [], error: null })),
    remove: jest.fn(async () => ({ data: null, error: null })),
  });
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsert.mockImplementation(async (row: unknown) => ({ data: { id: 'r1', ...(row as object) }, error: null }));
    mockProfileUpdate.mockResolvedValue({ error: null });
    global.fetch = jest.fn(async () => ({ arrayBuffer: async () => dirtyJpeg().buffer })) as unknown as typeof fetch;
  });
  afterEach(() => { global.fetch = realFetch; jest.restoreAllMocks(); });
  const service = (adapter: ReturnType<typeof storage>) => {
    expect(createMediaUploadService).toEqual(expect.any(Function));
    return createMediaUploadService(adapter);
  };

  it('keeps public video fallback order, overwrite options, rights and row fields with another backend', async () => {
    const adapter = storage();
    adapter.upload.mockResolvedValueOnce({ data: null, error: { message: 'Bucket not found' } });
    const result = await service(adapter).uploadHighlight({ uri: 'file:///clip.mp4', title: '  A great play  ', durationMs: 1000, compressed: true, playerId: 'p1', gameId: 'g1' });
    const path = 'reels/user-1/1700000000000.mp4';
    expect(adapter.upload.mock.calls).toEqual([
      ['reels', path, expect.any(ArrayBuffer), { contentType: 'video/mp4', upsert: true }],
      ['game_highlights', path, expect.any(ArrayBuffer), { contentType: 'video/mp4', upsert: true }],
    ]);
    expect(result.video_url).toBe(`https://media.example/game_highlights/${path}`);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ title: 'A great play', player_id: 'p1', game_id: 'g1', is_exclusive: false, is_vault_only: false, rights_version: expect.any(String), attested_at: expect.any(String) }));
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it('keeps Vault storage private, stores its token and signs for exactly one hour', async () => {
    const adapter = storage();
    const result = await service(adapter).uploadHighlight({ uri: 'file:///clip.mp4', title: 'Private play', durationMs: 1000, playerId: 'p1', isExclusive: true, compressed: true });
    const path = 'user-1/1700000000000.mp4';
    expect(adapter.upload).toHaveBeenCalledWith('reel_vault', path, expect.any(ArrayBuffer), { contentType: 'video/mp4', upsert: true });
    expect(adapter.upload).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ video_url: `reelvault:${path}`, is_exclusive: true, is_vault_only: true }));
    expect(adapter.sign).toHaveBeenCalledWith('reel_vault', path, 3600);
    expect(result.video_url).toBe('https://media.example/private/playback');
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it('does not broaden Vault failure to a public bucket', async () => {
    const adapter = storage(); adapter.upload.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(service(adapter).uploadHighlight({ uri: 'file:///clip.mp4', title: 'Private play', durationMs: 1000, playerId: 'p1', isExclusive: true, compressed: true })).rejects.toThrow('denied');
    expect(adapter.upload).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled(); expect(adapter.sign).not.toHaveBeenCalled();
  });

  it.each(['empty', 'throws'] as const)('never constructs a public URL for private upload even when that URL builder %s', async (behavior) => {
    const adapter = storage(); adapter.publicUrl.mockImplementation(() => {
      if (behavior === 'throws') throw new Error('Private media has no public URL.');
      return '';
    });
    const result = await service(adapter).uploadHighlight({ uri: 'file:///clip.mp4', title: 'Private play', durationMs: 1000, playerId: 'p1', isExclusive: true, compressed: true });
    const path = 'user-1/1700000000000.mp4';
    expect(adapter.publicUrl).not.toHaveBeenCalled();
    expect(adapter.upload).toHaveBeenCalledTimes(1);
    expect(adapter.upload).toHaveBeenCalledWith('reel_vault', path, expect.any(ArrayBuffer), { contentType: 'video/mp4', upsert: true });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ video_url: `reelvault:${path}`, is_exclusive: true, is_vault_only: true }));
    expect(adapter.sign).toHaveBeenCalledWith('reel_vault', path, 3600);
    expect(result.video_url).toBe('https://media.example/private/playback');
  });

  it('still removes metadata before sending a story photo to another backend without overwrite', async () => {
    const adapter = storage();
    const result = await service(adapter).uploadStoryPhoto('file:///photo.jpg', 'reel-9', 2);
    const path = 'user-1/stories/reel-9/2-1700000000000.jpg';
    expect(adapter.upload).toHaveBeenCalledWith('reels', path, cleanJpeg().buffer, { contentType: 'image/jpeg', upsert: false });
    expect(result).toEqual({ imagePath: path, imageUrl: `https://media.example/reels/${path}`, width: 640, height: 480 });
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it('keeps avatar MIME, overwrite and profile ownership and leaves reference writes off', async () => {
    const adapter = storage();
    const result = await service(adapter).uploadAvatar('file:///avatar.png');
    expect(adapter.upload).toHaveBeenCalledWith('avatars', 'user-1/1700000000000.jpg', expect.any(ArrayBuffer), { contentType: 'image/png', upsert: true });
    expect(result).toBe('https://media.example/avatars/user-1/1700000000000.jpg');
    expect(mockProfileUpdate).toHaveBeenCalledWith({ avatar_url: result }, 'user_id', 'user-1');
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it('binds two independent backends without a mutable process-wide override', async () => {
    const first = storage(), second = storage();
    const a = service(first), b = service(second);
    await a.uploadStoryPhoto('file:///a.jpg', 'reel-9', 0);
    await b.uploadStoryPhoto('file:///b.jpg', 'reel-9', 1);
    expect(first.upload).toHaveBeenCalledTimes(1); expect(second.upload).toHaveBeenCalledTimes(1);
    expect(first.upload.mock.calls[0][1]).toContain('/0-');
    expect(second.upload.mock.calls[0][1]).toContain('/1-');
  });

  it.each([undefined, null, NaN, Infinity, -Infinity, -1, 0])('rejects unreadable normalized duration %s before compression, file, auth or storage work', async (durationMs) => {
    const adapter = storage(); const onStatus = jest.fn(), onProgress = jest.fn();
    await expect(service(adapter).uploadHighlight({ uri: 'file:///clip.mp4', title: 'Short play', durationMs, onStatus, onProgress })).rejects.toThrow('Could not read this clip’s length. Pick it again.');
    expect(onStatus).not.toHaveBeenCalled(); expect(onProgress).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled(); expect(mockGetUser).not.toHaveBeenCalled();
    expect(adapter.upload).not.toHaveBeenCalled(); expect(mockInsert).not.toHaveBeenCalled();
  });

  it.each([false, true])('rejects a normalized overlong clip before side effects (already compressed: %s)', async (compressed) => {
    const adapter = storage(); const onStatus = jest.fn();
    await expect(service(adapter).uploadHighlight({ uri: 'file:///clip.mp4', title: 'Long play', durationMs: 45001, compressed, onStatus })).rejects.toThrow(HIGHLIGHT_TOO_LONG);
    expect(onStatus).not.toHaveBeenCalled(); expect(global.fetch).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled(); expect(adapter.upload).not.toHaveBeenCalled(); expect(mockInsert).not.toHaveBeenCalled();
  });

  it.each([500, 1000, 45000])('accepts validated %sms directly, including the exact 45s boundary when compressed', async (durationMs) => {
    const adapter = storage();
    await expect(service(adapter).uploadHighlight({ uri: 'file:///clip.mp4', title: 'Short play', durationMs, compressed: true })).resolves.toEqual(expect.objectContaining({ id: 'r1' }));
    expect(adapter.upload).toHaveBeenCalledTimes(1); expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

describe('stripJpegMetadata', () => {
  it('removes EXIF/GPS, XMP, ICC, Photoshop/IPTC, APP15, comments and trailing bytes, keeping image segments intact', () => {
    const out = stripJpegMetadata(dirtyJpeg());
    expect(Array.from(out)).toEqual(Array.from(cleanJpeg()));
    const text = decode(out);
    for (const leak of ['Exif', 'GPS', 'xmpmeta', 'ICC_PROFILE', '8BIM', 'Westlake', 'vendor-blob', 'secret', 'MPF']) {
      expect(text).not.toContain(leak);
    }
    expect(text).toContain('JFIF');
    expect(text).toContain('Adobe');
  });

  it('is idempotent on an already clean file', () => {
    expect(Array.from(stripJpegMetadata(cleanJpeg()))).toEqual(Array.from(cleanJpeg()));
  });

  it('skips fill bytes and keeps every scan of a progressive file, dropping metadata between scans', () => {
    const progressive = new Uint8Array([
      ...SOI, 0xff, ...APP1_EXIF, ...DQT, ...SOF0, ...DHT, ...SOS, ...SCAN, ...COM, ...DHT, ...SOS, 0x01, 0x02, ...EOI,
    ]);
    const out = stripJpegMetadata(progressive);
    expect(Array.from(out)).toEqual([...SOI, ...DQT, ...SOF0, ...DHT, ...SOS, ...SCAN, ...DHT, ...SOS, 0x01, 0x02, ...EOI]);
  });

  it.each([false, true])('keeps a rotated photo upright with an orientation-only APP1 and drops GPS (little-endian: %s)', (little) => {
    const input = new Uint8Array([...SOI, ...APP0, ...exifWithOrientation(6, little), ...DQT, ...SOF0, ...DHT, ...SOS, ...SCAN, ...EOI]);
    const out = stripJpegMetadata(input);
    expect(Array.from(out)).toEqual([...SOI, ...APP0, ...ORIENTATION_ONLY(6), ...DQT, ...SOF0, ...DHT, ...SOS, ...SCAN, ...EOI]);
    const text = decode(out);
    expect(text).not.toContain('GPS');
    expect(text).not.toContain('Sony');
  });

  it('writes the orientation APP1 straight after SOI when there is no APP0', () => {
    const input = new Uint8Array([...SOI, ...exifWithOrientation(8), ...DQT, ...SOF0, ...SOS, ...SCAN, ...EOI]);
    expect(Array.from(stripJpegMetadata(input))).toEqual([...SOI, ...ORIENTATION_ONLY(8), ...DQT, ...SOF0, ...SOS, ...SCAN, ...EOI]);
  });

  it('writes no APP1 when the photo is already upright or has no orientation', () => {
    const upright = new Uint8Array([...SOI, ...APP0, ...exifWithOrientation(1), ...DQT, ...SOF0, ...SOS, ...SCAN, ...EOI]);
    expect(Array.from(stripJpegMetadata(upright))).toEqual([...SOI, ...APP0, ...DQT, ...SOF0, ...SOS, ...SCAN, ...EOI]);
    const absent = new Uint8Array([...SOI, ...APP0, ...DQT, ...SOF0, ...SOS, ...SCAN, ...EOI]);
    expect(Array.from(stripJpegMetadata(absent))).toEqual(Array.from(absent));
    expect(Array.from(stripJpegMetadata(absent)).includes(0xe1)).toBe(false);
  });

  it('returns the same object for non-JPEG or truncated input', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(stripJpegMetadata(png)).toBe(png);
    const truncated = new Uint8Array([...SOI, ...APP1_EXIF.slice(0, 8)]);
    expect(stripJpegMetadata(truncated)).toBe(truncated);
    const noEnd = new Uint8Array([...SOI, ...DQT, ...SOF0, ...SOS, ...SCAN]);
    expect(stripJpegMetadata(noEnd)).toBe(noEnd);
  });
});

describe('uploadStoryPhoto', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/reels/${path}` } }));
  });
  afterEach(() => { global.fetch = realFetch; });

  const serve = (bytes: Uint8Array) => {
    global.fetch = jest.fn(async () => ({ arrayBuffer: async () => bytes.buffer.slice(0) })) as unknown as typeof fetch;
  };

  it('uploads only cleaned JPEG bytes to the caller’s story folder, without overwrite, and returns the path', async () => {
    serve(dirtyJpeg());
    const result = await uploadStoryPhoto('file:///photo.jpg', 'reel-9', 2);
    const [path, body, options] = mockUpload.mock.calls[0];
    // Same shape the database validates: ^<uid>/stories/<reel_id>/[0-9]{1,2}-[0-9]{10,16}\.jpg$
    expect(path).toMatch(/^user-1\/stories\/reel-9\/[0-9]{1,2}-[0-9]{10,16}\.jpg$/);
    expect(path.startsWith('user-1/stories/reel-9/2-')).toBe(true);
    expect(options).toEqual({ contentType: 'image/jpeg', upsert: false });
    expect(Array.from(new Uint8Array(body as ArrayBuffer))).toEqual(Array.from(cleanJpeg()));
    expect(result).toEqual({ imagePath: path, imageUrl: `https://x.supabase.co/storage/v1/object/public/reels/${path}`, width: 640, height: 480 });
  });

  it('reports displayed size for a quarter-turn orientation', async () => {
    serve(new Uint8Array([...SOI, ...APP0, ...exifWithOrientation(6), ...DQT, ...SOF0, ...SOS, ...SCAN, ...EOI]));
    const result = await uploadStoryPhoto('file:///photo.jpg', 'reel-9', 0);
    expect(result).toEqual(expect.objectContaining({ width: 480, height: 640 }));
  });

  it('rejects positions outside 0–9 before uploading', async () => {
    serve(cleanJpeg());
    await expect(uploadStoryPhoto('file:///photo.jpg', 'reel-9', 10)).rejects.toThrow('up to 10');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('refuses to upload a file it cannot clean', async () => {
    serve(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]));
    await expect(uploadStoryPhoto('file:///shot.png', 'reel-9', 0)).rejects.toThrow('could not be prepared');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('requires a signed-in uploader', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(uploadStoryPhoto('file:///photo.jpg', 'reel-9', 0)).rejects.toThrow('Sign in');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('insertReelRow', () => {
  const base = { video_url: '', title: 'Volunteer day', player_id: 'p1', game_id: null, is_exclusive: false, is_vault_only: false, category: 'serve_like_me' as const };
  beforeEach(() => mockInsert.mockReset());

  it('inserts photo stories with media_type and returns photo_count 0 until photos are stored', async () => {
    mockInsert.mockResolvedValue({ data: { id: 'r1', video_url: '', title: 'Volunteer day' }, error: null });
    const reel = await insertReelRow({ ...base, media_type: 'photo_story', rights_version: '2026-10-07' });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ media_type: 'photo_story', video_url: '', rights_version: '2026-10-07' }));
    expect(reel).toEqual(expect.objectContaining({ id: 'r1', media_type: 'photo_story', photo_count: 0 }));
  });

  it('leaves media_type off video rows so older databases keep working', async () => {
    mockInsert.mockResolvedValue({ data: { id: 'r2' }, error: null });
    await insertReelRow({ ...base, video_url: 'https://x/v.mp4' });
    expect(mockInsert.mock.calls[0][0]).not.toHaveProperty('media_type');
  });

  it('never retries a photo story as a video when the column is missing', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: "Could not find the 'media_type' column of 'reels'" } });
    await expect(insertReelRow({ ...base, media_type: 'photo_story' })).rejects.toThrow('Photo stories need the latest database update');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
