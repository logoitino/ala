import { prepareBeyondVideo, validateBeyondPhoto, stripBeyondMp4Metadata, uploadBeyondSubmission } from '@/services/BeyondGameMediaService';
import { TurboModuleRegistry } from 'react-native';
import * as api from '@/lib/beyondGame';
jest.mock('@/lib/beyondGame', () => ({ reserveBeyondPost: jest.fn(), uploadReservedBeyondMedia: jest.fn(), finalizeBeyondPost: jest.fn(), assertBeyondActor: jest.fn() }));
const jpeg = () => new Uint8Array([255, 216, 255, 192, 0, 11, 8, 0, 1, 0, 1, 1, 1, 17, 0, 255, 217]);
const box = (name: string, payload: number[]) => {
    const n = payload.length + 8;
    return [0, 0, 0, n, ...Array.from(name).map(c => c.charCodeAt(0)), ...payload];
};
it('rejects broken JPEG bytes and reads dimensions from actual encoded bytes', () => {
    expect(() => validateBeyondPhoto(new Uint8Array([1, 2]))).toThrow();
    const result = validateBeyondPhoto(jpeg());
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
});
it('removes MP4 metadata without shifting media offsets and refuses malformed containers', () => {
    const raw = new Uint8Array([...box('ftyp', [105, 115, 111, 109]), ...box('moov', box('udta', [71, 80, 83, 99])), ...box('mdat', [1, 2, 3, 4])]);
    const clean = stripBeyondMp4Metadata(raw);
    expect(clean.byteLength).toBe(raw.byteLength);
    expect(Array.from(clean.slice(28, 32))).toEqual([0, 0, 0, 0]);
    expect(Array.from(clean.slice(-4))).toEqual([1, 2, 3, 4]);
    expect(() => stripBeyondMp4Metadata(new Uint8Array([0, 0, 0, 50, 109, 111, 111, 118]))).toThrow();
});
it('refuses unsupported video compression instead of uploading an original', async () => {
    jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(null);
    await expect(prepareBeyondVideo({ id: 'm', uri: 'file:///picked.mp4', durationMs: 45000 })).rejects.toThrow(/development build/);
    expect(api.uploadReservedBeyondMedia).not.toHaveBeenCalled();
});
it('refuses HTTP picker files and overlong videos before preprocessing', async () => {
    await expect(prepareBeyondVideo({ id: 'm', uri: 'https://outside.invalid/v.mp4', durationMs: 1000 })).rejects.toThrow();
    await expect(prepareBeyondVideo({ id: 'm', uri: 'file:///v.mp4', durationMs: 45001 })).rejects.toThrow(/45/);
});
it('keeps the same reservation and never finalizes after a file failure', async () => {
    const post = { id: 'p', status: 'draft', media: [{ id: 'm' }] };
    (api.reserveBeyondPost as jest.Mock).mockResolvedValue(post);
    (api.uploadReservedBeyondMedia as jest.Mock).mockRejectedValue(new Error('try later'));
    await expect(uploadBeyondSubmission({ userId: 'u', profileId: 'a' }, { requestId: 'r', category: 'story', caption: 'story', audience: 'friends' }, [{ input: { id: 'm', kind: 'photo', bytes: 2, width: 1, height: 1 }, bytes: new ArrayBuffer(2) }])).rejects.toThrow();
    expect(api.reserveBeyondPost).toHaveBeenCalledWith('a', expect.objectContaining({ requestId: 'r' }));
    expect(api.finalizeBeyondPost).not.toHaveBeenCalled();
});
