/**
 * Portable Highlights playback: current public paths follow a bound storage host, Vault remains
 * authorized signing, and private feature buckets never become public playback. Synthetic objects only.
 */
const mockConfig = { configured: true };
jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() { return mockConfig.configured; },
  supabase: { storage: { from: () => ({ createSignedUrl: jest.fn() }) } },
}));

import { resolvePlaybackUrl } from '@/lib/reels';
import type { MediaStorageAdapter } from '@/lib/mediaStorage';

const publicUrl = jest.fn((bucket: string, path: string) => `https://replacement.example/${bucket}/${path}`);
const sign = jest.fn(async (_bucket: string, _path: string, _expiresIn: number) => ({
  data: 'https://replacement.example/authorized.mp4?token=synthetic', error: null,
}));
const storage = { publicUrl, sign } as unknown as MediaStorageAdapter;

beforeEach(() => {
  mockConfig.configured = true;
  jest.clearAllMocks();
  sign.mockResolvedValue({ data: 'https://replacement.example/authorized.mp4?token=synthetic', error: null });
});

it.each([
  'sb:reels/u1/clip.mp4',
  'https://old.example/storage/v1/object/public/reels/u1/clip.mp4',
])('plays current public media on the selected host: %s', async (value) => {
  expect(await resolvePlaybackUrl(value, storage)).toBe('https://replacement.example/reels/u1/clip.mp4');
  expect(publicUrl).toHaveBeenCalledWith('reels', 'u1/clip.mp4');
  expect(sign).not.toHaveBeenCalled();
});

it.each(['reelvault:u1/clip.mp4', 'sb:reel_vault/u1/clip.mp4'])('signs Vault through the same authorized transport: %s', async (value) => {
  expect(await resolvePlaybackUrl(value, storage)).toBe('https://replacement.example/authorized.mp4?token=synthetic');
  expect(sign).toHaveBeenCalledWith('reel_vault', 'u1/clip.mp4', 3600);
  expect(publicUrl).not.toHaveBeenCalled();
});

it.each(['sb:beyond_game/u1/private.mp4', 'sb:fan_zone/u1/private.mp4', 'sb:unknown_private/u1/private.mp4',
  'https://old.example/storage/v1/object/public/reel_vault/u1/clip.mp4',
  'sb:reels/u1/../clip.mp4', 'reelvault:', 'mux:asset', 'not a URL', null])('fails closed for unsupported or unsafe playback: %s', async (value) => {
  expect(await resolvePlaybackUrl(value, storage)).toBe('');
  expect(publicUrl).not.toHaveBeenCalled();
  expect(sign).not.toHaveBeenCalled();
});

it('preserves other video URLs including query and fragment', async () => {
  const value = 'https://cdn.example/clip.m3u8?token=synthetic#start';
  expect(await resolvePlaybackUrl(value, storage)).toBe(value);
  expect(publicUrl).not.toHaveBeenCalled();
  expect(sign).not.toHaveBeenCalled();
});

it('preserves the legacy video query and fragment when moving its public host', async () => {
  expect(await resolvePlaybackUrl('https://old.example/storage/v1/object/public/reels/u1/clip.mp4?t=1#start', storage))
    .toBe('https://replacement.example/reels/u1/clip.mp4?t=1#start');
});

it('does not turn a denied or rejected Vault signature into public access', async () => {
  sign.mockResolvedValueOnce({ data: null, error: { message: 'denied' } } as never);
  expect(await resolvePlaybackUrl('reelvault:u1/clip.mp4', storage)).toBe('');
  sign.mockRejectedValueOnce(new Error('offline'));
  expect(await resolvePlaybackUrl('reelvault:u1/clip.mp4', storage)).toBe('');
  expect(publicUrl).not.toHaveBeenCalled();
});

it('keeps unconfigured legacy public URLs but makes no default Vault request', async () => {
  mockConfig.configured = false;
  const value = 'https://old.example/storage/v1/object/public/reels/u1/clip.mp4';
  expect(await resolvePlaybackUrl(value)).toBe(value);
  expect(await resolvePlaybackUrl('reelvault:u1/clip.mp4')).toBe('');
});

it('can bind a replacement transport independently of the current Supabase configuration', async () => {
  mockConfig.configured = false;
  expect(await resolvePlaybackUrl('sb:reels/u1/clip.mp4', storage)).toBe('https://replacement.example/reels/u1/clip.mp4');
  expect(await resolvePlaybackUrl('reelvault:u1/clip.mp4', storage)).toContain('authorized.mp4');
});
