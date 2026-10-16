/**
 * PORT-01 / SCALE-02: stored media values (references and legacy Supabase URLs) resolve through one place, and the
 * writer switch stays off. Synthetic data.
 */
const mockConfig = { configured: true };
jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockConfig.configured;
  },
  supabase: { storage: { from: (bucket: string) => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://new-host.example/${bucket}/${path}` } }) }) } },
}));

import {
  MEDIA_WRITE_REFERENCES,
  mediaUri,
  mediaValueToStore,
  parseMediaRef,
  publicMediaUrl,
  resolveMediaUrl,
  toMediaRef,
} from '@/lib/media';

afterEach(() => {
  mockConfig.configured = true;
});

it('writes and reads Storage references', () => {
  expect(toMediaRef('avatars', '/u1/me.jpg')).toBe('sb:avatars/u1/me.jpg');
  expect(parseMediaRef('sb:reels/u1/clip.mp4')).toEqual({ host: 'supabase', bucket: 'reels', path: 'u1/clip.mp4' });
  expect(parseMediaRef('sb:reels')).toBeNull();
  expect(parseMediaRef('reelvault:u1/v.mp4')).toEqual({ host: 'reelvault', path: 'u1/v.mp4' });
  expect(parseMediaRef('  ')).toBeNull();
});

it('recognises legacy full Supabase URLs, so old rows follow a host move', () => {
  const legacy = 'https://abc123.supabase.co/storage/v1/object/public/reels/u1/clip%20one.mp4?t=1';
  expect(parseMediaRef(legacy)).toEqual({ host: 'supabase', bucket: 'reels', path: 'u1/clip one.mp4' });
  expect(resolveMediaUrl(legacy)).toBe('https://new-host.example/reels/u1/clip one.mp4');
});

it('passes other URLs through, and never resolves a Vault clip to a public URL', () => {
  expect(resolveMediaUrl('https://stream.example/v/1.m3u8')).toBe('https://stream.example/v/1.m3u8');
  expect(resolveMediaUrl('reelvault:u1/v.mp4')).toBeNull();
  expect(resolveMediaUrl('sb:avatars/u1/me.jpg')).toBe('https://new-host.example/avatars/u1/me.jpg');
  expect(publicMediaUrl('avatars', 'x.jpg')).toBe('https://new-host.example/avatars/x.jpg');
});

describe('mediaUri (display readers)', () => {
  it('shows sb: references and legacy URLs, keeping the stored query on a legacy URL', () => {
    expect(mediaUri('sb:avatars/u1/me.jpg')).toBe('https://new-host.example/avatars/u1/me.jpg');
    expect(mediaUri(' https://abc123.supabase.co/storage/v1/object/public/avatars/u1/me.jpg?t=1 ')).toBe(
      'https://new-host.example/avatars/u1/me.jpg?t=1',
    );
    expect(mediaUri('https://cdn.example/logo.png')).toBe('https://cdn.example/logo.png');
  });

  it('keeps a legacy URL exactly as stored when no storage host is configured', () => {
    mockConfig.configured = false;
    const legacy = 'https://abc123.supabase.co/storage/v1/object/public/avatars/u1/me.jpg';
    expect(mediaUri(legacy)).toBe(legacy);
  });

  it('passes a just-picked device photo through unchanged', () => {
    expect(mediaUri('file:///var/mobile/pick.jpg')).toBe('file:///var/mobile/pick.jpg');
    expect(mediaUri('content://media/external/images/1')).toBe('content://media/external/images/1');
  });

  it('returns undefined for blank, unreadable and Vault values so the placeholder shows', () => {
    expect(mediaUri(null)).toBeUndefined();
    expect(mediaUri(undefined)).toBeUndefined();
    expect(mediaUri('   ')).toBeUndefined();
    expect(mediaUri('sb:avatars')).toBeUndefined();
    expect(mediaUri('not a link')).toBeUndefined();
    expect(mediaUri('reelvault:u1/v.mp4')).toBeUndefined();
  });
});

describe('MEDIA_WRITE_REFERENCES (writer switch)', () => {
  it('is off, so uploads still store the full public URL', () => {
    expect(MEDIA_WRITE_REFERENCES).toBe(false);
    expect(mediaValueToStore('avatars', 'u1/1.jpg', 'https://host/avatars/u1/1.jpg')).toBe('https://host/avatars/u1/1.jpg');
  });

  it('stores an sb: reference once flipped', () => {
    expect(mediaValueToStore('avatars', 'u1/1.jpg', 'https://host/avatars/u1/1.jpg', true)).toBe('sb:avatars/u1/1.jpg');
  });
});
