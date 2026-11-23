/** Private media client boundary tests: authenticated web blobs/native headers, explicit unavailable, no bearer URL. */
import { Platform } from 'react-native';
import { loadFanZoneVideo, verifyFanZoneUpload, removeFanZoneMedia } from '../fanZoneMedia';

const mockFetch = jest.fn();
jest.mock('@/lib/sessionToken', () => ({ requireAccessToken: async () => 'private-session-token' }));
beforeEach(() => {
  mockFetch.mockReset(); global.fetch = mockFetch as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_ORIGIN = 'https://pilot.invalid';
});
describe('Fan Zone media client', () => {
  it('uses native headers and never puts the session token in a URL', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const video = await loadFanZoneVideo('entry', 2);
    expect(video.source).toEqual({ uri: 'https://pilot.invalid/api/fan-zone-media?entry=entry&revision=2', headers: { Authorization: 'Bearer private-session-token' }, contentType: 'progressive' });
    expect(mockFetch).not.toHaveBeenCalled(); video.release();
  });
  it('fetches web media with auth into a released object URL because web video ignores source headers', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const create = jest.fn(() => 'blob:private-media'), revoke = jest.fn();
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
    const blob = { size: 10 } as Blob;
    mockFetch.mockResolvedValue({ ok: true, headers: new Headers({ 'Content-Type': 'video/mp4', 'Content-Length': '10' }), blob: async () => blob });
    const video = await loadFanZoneVideo('entry', 1);
    expect(mockFetch).toHaveBeenCalledWith(expect.not.stringContaining('private-session-token'), expect.objectContaining({ headers: { Authorization: 'Bearer private-session-token' }, cache: 'no-store' }));
    expect(video.source).toEqual({ uri: 'blob:private-media', contentType: 'progressive' });
    video.release(); video.release(); expect(revoke).toHaveBeenCalledTimes(1);
  });
  it('fails without native origin or on unsupported/insecure origins before sending auth', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    delete process.env.EXPO_PUBLIC_API_ORIGIN;
    await expect(loadFanZoneVideo('entry', 1)).rejects.toThrow('not set up');
    process.env.EXPO_PUBLIC_API_ORIGIN = 'http://remote.invalid';
    await expect(loadFanZoneVideo('entry', 1)).rejects.toThrow('not set up');
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('rejects web oversized or non-video bodies without creating an object URL', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    URL.createObjectURL = jest.fn();
    mockFetch.mockResolvedValue({ ok: true, headers: new Headers({ 'Content-Type': 'text/html' }) });
    await expect(loadFanZoneVideo('entry', 1)).rejects.toThrow('unavailable');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('verifies/removes only identifiers and preserves partial removal status', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, completed: false, status: 'revision_removed' }) });
    await verifyFanZoneUpload('entry', 2); const result = await removeFanZoneMedia('entry', 2);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ entry: 'entry', revision: 2 });
    expect(result.completed).toBe(false);
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'FUN_MEDIA_DENIED' }) });
    await expect(verifyFanZoneUpload('entry', 2)).rejects.toThrow('permission');
  });
});
