/** BEYOND-01 local preprocessing and reservation/upload orchestration. Supabase is used only through lib/beyondGame. */
import { Platform, TurboModuleRegistry } from 'react-native';
import { stripJpegMetadata } from '@/services/MediaUploadService';
import { assertBeyondActor, reserveBeyondPost, uploadReservedBeyondMedia, finalizeBeyondPost } from '@/lib/beyondGame';
import type { BeyondActor, BeyondMediaInput, BeyondReserveInput } from '@tapuai/shared-types/beyondGame';
export type PreparedBeyondMedia = {
    input: BeyondMediaInput;
    bytes: ArrayBuffer;
};
const local = (uri: string) => {
    if (!/^(file:|content:|ph:|blob:)/.test(uri)) {
        throw Error('Choose a local file. Remote URLs are not accepted.');
    }
};
async function readLocal(uri: string) {
    local(uri);
    const response = await fetch(uri);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 52428800) {
        throw Error('This file is empty or too large.');
    }
    return new Uint8Array(bytes);
}
/** Actual JPEG structure, metadata removal and encoded SOF dimensions; never trusts picker dimensions. */
export function validateBeyondPhoto(raw: Uint8Array) {
    const clean = stripJpegMetadata(raw);
    if (clean === raw || clean.byteLength > 5242880) {
        throw Error('This JPEG could not be safely prepared.');
    }
    let at = 2, width = 0, height = 0;
    while (at + 4 <= clean.length) {
        const marker = clean[at + 1];
        if (marker === 0xda || marker === 0xd9) {
            break;
        }
        const size = clean[at + 2] * 256 + clean[at + 3];
        if (size < 2 || at + size + 2 > clean.length) {
            throw Error('This JPEG could not be safely prepared.');
        }
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
            height = clean[at + 5] * 256 + clean[at + 6];
            width = clean[at + 7] * 256 + clean[at + 8];
        }
        at += size + 2;
    }
    if (!width || !height || width > 4096 || height > 4096) {
        throw Error('This photo needs to be resized.');
    }
    return { bytes: clean.slice().buffer as ArrayBuffer, width, height };
}
/** Metadata boxes become same-size free boxes, preserving stco/co64 media offsets. Unsupported containers fail closed. */
export function stripBeyondMp4Metadata(raw: Uint8Array) {
    const bytes = raw.slice();
    const view = new DataView(bytes.buffer);
    let ftyp = false, moov = false, mdat = false;
    const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex', 'moof', 'traf']);
    const walk = (start: number, end: number, depth: number) => {
        if (depth > 10) {
            throw Error('This video container is unsupported.');
        }
        let at = start;
        while (at < end) {
            if (end - at < 8) {
                throw Error('This video container is unsupported.');
            }
            let size = view.getUint32(at), header = 8;
            const type = String.fromCharCode(...bytes.slice(at + 4, at + 8));
            if (size === 1) {
                if (end - at < 16) {
                    throw Error('This video container is unsupported.');
                }
                const wide = view.getBigUint64(at + 8);
                if (wide > BigInt(Number.MAX_SAFE_INTEGER)) {
                    throw Error('This video container is unsupported.');
                }
                size = Number(wide);
                header = 16;
            }
            else if (size === 0) {
                size = end - at;
            }
            if (size < header || at + size > end) {
                throw Error('This video container is unsupported.');
            }
            if (depth === 0) {
                ftyp ||= type === 'ftyp';
                moov ||= type === 'moov';
                mdat ||= type === 'mdat';
            }
            if (['udta', 'meta', 'uuid'].includes(type)) {
                bytes.set([102, 114, 101, 101], at + 4);
                bytes.fill(0, at + header, at + size);
            }
            else if (containers.has(type)) {
                walk(at + header, at + size, depth + 1);
            }
            at += size;
        }
    };
    walk(0, bytes.length, 0);
    if (!ftyp || !moov || !mdat) {
        throw Error('Choose a supported MP4 video.');
    }
    return bytes;
}
export async function prepareBeyondPhoto(id: string, uri: string): Promise<PreparedBeyondMedia> {
    local(uri);
    let next = uri;
    if (Platform.OS !== 'web' && TurboModuleRegistry.get('NitroModules')) {
        const { Image } = await import('react-native-compressor');
        next = await Image.compress(uri, { compressionMethod: 'manual', maxWidth: 1600, maxHeight: 1600, quality: .85, output: 'jpg', returnableOutputType: 'uri' });
        local(next);
    } // Unsupported encoders still require an actual cleanable JPEG, never PNG/HEIC passthrough.
    const photo = validateBeyondPhoto(await readLocal(next));
    return { input: { id, kind: 'photo', bytes: photo.bytes.byteLength, width: photo.width, height: photo.height }, bytes: photo.bytes };
}
export async function prepareBeyondVideo(picked: {
    id: string;
    uri: string;
    durationMs: number;
}, onProgress?: (ratio: number) => void): Promise<PreparedBeyondMedia> {
    local(picked.uri);
    if (!Number.isFinite(picked.durationMs) || picked.durationMs <= 0 || picked.durationMs > 45000) {
        throw Error('Choose a video of at most 45 seconds.');
    }
    if (Platform.OS === 'web' || !TurboModuleRegistry.get('NitroModules')) {
        throw Error('Video preparation needs a development build with the installed compressor. Choose JPEG photos instead.');
    }
    const { Video, getVideoMetaData } = await import('react-native-compressor');
    const uri = await Video.compress(picked.uri, { compressionMethod: 'manual', maxSize: 1080, bitrate: 2500000, minimumFileSizeForCompress: 0 }, onProgress);
    if (!uri || uri === picked.uri) {
        throw Error('This video could not be safely prepared.');
    }
    local(uri);
    const meta = await getVideoMetaData(uri);
    const durationMs = Math.ceil(meta.duration * 1000);
    if (!Number.isInteger(durationMs) || durationMs <= 0 || durationMs > 45000 || !Number.isInteger(meta.width) || !Number.isInteger(meta.height) || meta.width < 1 || meta.height < 1 || meta.width > 4096 || meta.height > 4096) {
        throw Error('The prepared video is outside the allowed limits.');
    }
    const bytes = stripBeyondMp4Metadata(await readLocal(uri)).buffer as ArrayBuffer;
    return { input: { id: picked.id, kind: 'video', bytes: bytes.byteLength, width: meta.width, height: meta.height, duration_ms: durationMs }, bytes };
}
/** Keep requestId and prepared files for uncertain retries. A failed upload never submits a partial post. */
export async function uploadBeyondSubmission(actor: BeyondActor, details: Omit<BeyondReserveInput, 'media'>, prepared: PreparedBeyondMedia[]) {
    await assertBeyondActor(actor);
    const post = await reserveBeyondPost(actor.profileId, { ...details, media: prepared.map(m => m.input) });
    if (post.status !== 'draft') {
        return post;
    }
    for (const file of prepared) {
        await assertBeyondActor(actor);
        await uploadReservedBeyondMedia(actor, post, file.input.id, file.bytes);
    }
    await assertBeyondActor(actor);
    return finalizeBeyondPost(actor.profileId, post.id);
}
