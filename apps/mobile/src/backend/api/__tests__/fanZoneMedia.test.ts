/** API tests bind caller/service SDK methods and verify authorization, sanitized storage, ranges and removal outcomes. */
import { Blob } from 'node:buffer';
import { createHash } from 'node:crypto';
import { sanitizeFanZoneMp4 } from '../../services/fanZoneMp4';
import { fanZoneMediaHandler, fanZoneUploadHandler, fanZoneRemoveHandler } from '../fanZoneMedia';
import { sampleMp4 } from '../../services/__fixtures__/fanZoneMp4Fixture';

const mockCallerRpc = jest.fn(), mockServiceRpc = jest.fn(), mockGetUser = jest.fn();
const mockDownload = jest.fn(), mockUpload = jest.fn(), mockRemove = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: (_url: string, key: string) => key === 'server-test-key'
  ? { rpc: (...args: unknown[]) => mockServiceRpc(...args), storage: { from: () => ({ download: mockDownload, upload: mockUpload, remove: mockRemove }) } }
  : { rpc: (...args: unknown[]) => mockCallerRpc(...args), auth: { getUser: mockGetUser } } }));

const ENTRY = '11111111-1111-4111-8111-111111111111';
const request = (method = 'GET', body?: unknown, headers: Record<string, string> = {}) => new Request(`https://local.invalid/api/fan-zone-media?entry=${ENTRY}&revision=1`, {
  method, headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
beforeEach(() => {
  jest.clearAllMocks(); process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-test-key';
  mockGetUser.mockResolvedValue({ data: { user: { id: 'caller' } }, error: null });
  mockCallerRpc.mockResolvedValue({ data: { ok: true, bucket: 'fan_zone', path: 'reserved/1.mp4', revision: 1, digest: null }, error: null });
  mockDownload.mockResolvedValue({ data: new Blob([sampleMp4()]), error: null });
  mockUpload.mockResolvedValue({ error: null }); mockRemove.mockResolvedValue({ error: null });
  mockServiceRpc.mockResolvedValue({ data: { ok: true }, error: null });
});

describe('Fan Zone media API', () => {
  it('rejects an invalid bearer before private storage is read', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('bad token') });
    const response = await fanZoneMediaHandler(request());
    expect(response.status).toBe(401); expect(mockCallerRpc).not.toHaveBeenCalled(); expect(mockDownload).not.toHaveBeenCalled();
  });
  it('rejects SQL authorization and missing service configuration without public fallback', async () => {
    mockCallerRpc.mockResolvedValue({ data: null, error: { message: 'FUN_MEDIA_DENIED' } });
    expect((await fanZoneMediaHandler(request())).status).toBe(403); expect(mockDownload).not.toHaveBeenCalled();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await fanZoneUploadHandler(request('POST', { entry: ENTRY, revision: 1 }))).status).toBe(503);
    expect(mockUpload).not.toHaveBeenCalled();
  });
  it('stores only sanitized verified bytes and commits the actual digest, size and duration', async () => {
    const response = await fanZoneUploadHandler(request('POST', { entry: ENTRY, revision: 1 }));
    expect(response.status).toBe(200);
    expect(mockCallerRpc).toHaveBeenCalledWith('fun_media_access', { p_entry_id: ENTRY, p_revision: 1, p_intent: 'verify' });
    const uploaded = mockUpload.mock.calls[0][1] as Uint8Array;
    expect(Buffer.from(uploaded).includes(Buffer.from('GPS'))).toBe(false);
    expect(mockServiceRpc).toHaveBeenCalledWith('fun_verify_media', expect.objectContaining({ p_entry_id: ENTRY, p_revision: 1, p_digest: expect.stringMatching(/^[a-f0-9]{64}$/), p_bytes: uploaded.length, p_duration_ms: 10000 }));
    expect(JSON.stringify(await response.json())).not.toContain('test-session');
  });
  it('rejects corrupt media and permission revoked while verification was reading it', async () => {
    mockDownload.mockResolvedValue({ data: new Blob(['not MP4']), error: null });
    expect((await fanZoneUploadHandler(request('POST', { entry: ENTRY, revision: 1 }))).status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled(); expect(mockServiceRpc).not.toHaveBeenCalled();
    mockDownload.mockResolvedValue({ data: new Blob([sampleMp4()]), error: null });
    mockCallerRpc.mockResolvedValueOnce({ data: { ok: true, bucket: 'fan_zone', path: 'reserved/1.mp4', revision: 1 }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'FUN_MEDIA_DENIED' } });
    expect((await fanZoneUploadHandler(request('POST', { entry: ENTRY, revision: 1 }))).status).toBe(403);
    expect(mockUpload).not.toHaveBeenCalled();
  });
  it('returns the existing immutable receipt on a second verification without another upload or commit', async () => {
    const first = await fanZoneUploadHandler(request('POST', { entry: ENTRY, revision: 1 }));
    expect(first.status).toBe(200);
    const receipt = await first.json();
    const clean = sanitizeFanZoneMp4(sampleMp4()).bytes;
    mockDownload.mockResolvedValue({ data: new Blob([clean]), error: null });
    mockCallerRpc.mockResolvedValue({ data: { ok: true, bucket: 'fan_zone', path: 'reserved/1.mp4', revision: 1,
      digest: receipt.digest, bytes: receipt.bytes, duration_ms: receipt.duration_ms }, error: null });
    const again = await fanZoneUploadHandler(request('POST', { entry: ENTRY, revision: 1 }));
    expect(again.status).toBe(200); expect(await again.json()).toEqual(receipt);
    expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockServiceRpc).toHaveBeenCalledTimes(1);
  });
  it('refuses a downloaded digest mismatch instead of rewriting previously verified media', async () => {
    const clean = sanitizeFanZoneMp4(sampleMp4()).bytes;
    mockDownload.mockResolvedValue({ data: new Blob([clean]), error: null });
    mockCallerRpc.mockResolvedValue({ data: { ok: true, bucket: 'fan_zone', path: 'reserved/1.mp4', revision: 1,
      digest: 'b'.repeat(64), bytes: clean.length, duration_ms: 10000 }, error: null });
    expect((await fanZoneUploadHandler(request('POST', { entry: ENTRY, revision: 1 }))).status).toBe(503);
    expect(mockUpload).not.toHaveBeenCalled(); expect(mockServiceRpc).not.toHaveBeenCalled();
  });
  it('reuses a matching receipt if another verifier commits before the second caller gate', async () => {
    const clean = sanitizeFanZoneMp4(sampleMp4()).bytes;
    const digest = createHash('sha256').update(clean).digest('hex');
    mockCallerRpc.mockResolvedValueOnce({ data: { ok: true, bucket: 'fan_zone', path: 'reserved/1.mp4', revision: 1, digest: null }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, bucket: 'fan_zone', path: 'reserved/1.mp4', revision: 1, digest, bytes: clean.length, duration_ms: 10000 }, error: null });
    const response = await fanZoneUploadHandler(request('POST', { entry: ENTRY, revision: 1 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, revision: 1, digest, bytes: clean.length, duration_ms: 10000 });
    expect(mockUpload).not.toHaveBeenCalled(); expect(mockServiceRpc).not.toHaveBeenCalled();
  });
  it('serves a validated byte range with no-store and never exposes a storage URL', async () => {
    const clean = sanitizeFanZoneMp4(sampleMp4()).bytes;
    mockDownload.mockResolvedValue({ data: new Blob([clean]), error: null });
    mockCallerRpc.mockResolvedValue({ data: { ok: true, bucket: 'fan_zone', path: 'reserved/1.mp4', revision: 1, digest: createHash('sha256').update(clean).digest('hex') }, error: null });
    const response = await fanZoneMediaHandler(request('GET', undefined, { Range: 'bytes=0-3' }));
    expect(response.status).toBe(206); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Range')).toMatch(/^bytes 0-3\//);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0, 0, 0, 24]));
    expect((await fanZoneMediaHandler(request('GET', undefined, { Range: 'bytes=99999-' }))).status).toBe(416);
  });
  it('does not mark a deletion complete when storage removal fails; permits a successful retry', async () => {
    mockRemove.mockResolvedValueOnce({ error: new Error('storage down') });
    expect((await fanZoneRemoveHandler(request('POST', { entry: ENTRY, revision: 1 }))).status).toBe(503);
    expect(mockServiceRpc).not.toHaveBeenCalled();
    expect((await fanZoneRemoveHandler(request('POST', { entry: ENTRY, revision: 1 }))).status).toBe(200);
    expect(mockServiceRpc).toHaveBeenCalledWith('fun_complete_removal', { p_entry_id: ENTRY, p_revision: 1 });
  });
});
