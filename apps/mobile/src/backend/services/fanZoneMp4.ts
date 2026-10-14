/**
 * FUN-01 bounded MP4 validation and metadata removal. Supports ordinary unfragmented H264/AAC MP4;
 * unsupported containers are rejected. Metadata boxes become same-size free boxes so sample offsets stay valid.
 * This does not transcode, verify filming rights, redact depicted people, or erase already delivered copies.
 * @sideEffects None: copies input and returns sanitized bytes plus duration derived from the movie header.
 */
import { FAN_ZONE_MEDIA_LIMITS } from '@shared/fanZone';

export const FAN_ZONE_MAX_BYTES = FAN_ZONE_MEDIA_LIMITS.maxBytes;

const containers: Record<string, readonly string[]> = {
  root: ['ftyp', 'moov', 'mdat', 'free', 'skip', 'udta', 'meta'],
  moov: ['mvhd', 'trak', 'free', 'udta', 'meta'],
  trak: ['tkhd', 'edts', 'mdia', 'free', 'udta', 'meta'],
  edts: ['elst', 'free'], mdia: ['mdhd', 'hdlr', 'minf', 'free', 'udta', 'meta'],
  minf: ['vmhd', 'smhd', 'dinf', 'stbl', 'free'], dinf: ['dref', 'free'],
  stbl: ['stsd', 'stts', 'ctts', 'stsc', 'stsz', 'stz2', 'stco', 'co64', 'stss', 'sdtp', 'sgpd', 'sbgp', 'free'],
  avc1: ['avcC', 'pasp', 'btrt', 'colr', 'clap', 'free'], mp4a: ['esds', 'btrt', 'free'],
};
const formatError = () => { throw new Error('FUN_MEDIA_FORMAT'); };

/** @purpose Validate a bounded supported MP4 and remove known metadata while preserving container sizes. */
export function sanitizeFanZoneMp4(input: Uint8Array): { bytes: Uint8Array; durationMs: number } {
  if (input.byteLength > FAN_ZONE_MAX_BYTES) throw new Error('FUN_MEDIA_SIZE');
  if (input.byteLength < 24) return formatError();
  const bytes = Uint8Array.from(input);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, n: number) => String.fromCharCode(...bytes.subarray(at, at + n));
  let count = 0, durationMs = 0, movieHeaders = 0, videos = 0, ftyp = 0, movies = 0, media = 0;
  const stamp = (at: number, text: string) => { for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i); };

  const walk = (start: number, end: number, parent: string, depth: number): void => {
    if (depth > 12) return formatError();
    for (let at = start; at < end;) {
      if (++count > 4096 || at + 8 > end) return formatError();
      const size = view.getUint32(at), type = ascii(at + 4, 4), body = at + 8, stop = at + size;
      // Large/zero-size and fragmented boxes need an encoder-specific parser, so fail instead of guessing.
      if (size < 8 || stop > end || !containers[parent]?.includes(type)) return formatError();
      if (type === 'udta' || type === 'meta') {
        stamp(at + 4, 'free'); bytes.fill(0, body, stop);
      } else if (type === 'free' || type === 'skip') {
        bytes.fill(0, body, stop);
      } else if (containers[type]) {
        if (type === 'moov') movies++;
        walk(body, stop, type, depth + 1);
      } else if (type === 'ftyp') {
        if (++ftyp !== 1 || at !== 0 || size < 16 || size > 1024 || (size - 16) % 4 !== 0) return formatError();
        const brands = ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '];
        if (!brands.includes(ascii(body, 4))) return formatError();
      } else if (type === 'mdat') {
        if (size === 8) return formatError(); media++;
      } else if (type === 'mvhd' || type === 'mdhd') {
        const version = bytes[body];
        if (version > 1 || size < (version === 0 ? 28 : 40)) return formatError();
        const scaleAt = body + (version === 0 ? 12 : 20);
        if (type === 'mvhd') {
          movieHeaders++;
          const scale = view.getUint32(scaleAt);
          const ticks = version === 0 ? view.getUint32(scaleAt + 4) : Number(view.getBigUint64(scaleAt + 4));
          if (!scale || !Number.isSafeInteger(ticks)) return formatError();
          durationMs = Math.round(ticks * 1000 / scale);
          if (durationMs < FAN_ZONE_MEDIA_LIMITS.minDurationMs || durationMs > FAN_ZONE_MEDIA_LIMITS.maxDurationMs) throw new Error('FUN_MEDIA_DURATION');
        }
        bytes.fill(0, body + 4, scaleAt); // creation/modification timestamps are unnecessary for the fan clip.
      } else if (type === 'tkhd') {
        const version = bytes[body];
        if (version > 1 || size < (version === 0 ? 28 : 40)) return formatError();
        bytes.fill(0, body + 4, body + (version === 0 ? 12 : 20));
      } else if (type === 'hdlr') {
        if (size < 32) return formatError();
        const handler = ascii(body + 8, 4);
        if (handler === 'vide') videos++;
        else if (handler !== 'soun') return formatError();
        bytes.fill(0, body + 24, stop); // encoder-supplied track names can contain a person or device name.
      } else if (type === 'stsd') {
        if (size < 24 || view.getUint32(body + 4) !== 1) return formatError();
        const sample = body + 8, sampleSize = view.getUint32(sample), codec = ascii(sample + 4, 4);
        if (sampleSize < 8 || sample + sampleSize !== stop) return formatError();
        if (codec === 'avc1') {
          if (sampleSize < 86) return formatError();
          bytes.fill(0, sample + 8 + 42, sample + 8 + 74);
          walk(sample + 86, stop, 'avc1', depth + 1);
        } else if (codec === 'mp4a') {
          if (sampleSize < 36 || view.getUint16(sample + 16) !== 0) return formatError();
          walk(sample + 36, stop, 'mp4a', depth + 1);
        } else return formatError();
      } else if (type === 'dref') {
        if (size < 28 || view.getUint32(body + 4) !== 1) return formatError();
        const ref = body + 8;
        if (ascii(ref + 4, 4) !== 'url ' || view.getUint32(ref) !== 12 || ref + 12 !== stop || view.getUint32(ref + 8) !== 1) return formatError();
      }
      at = stop;
    }
  };
  walk(0, bytes.length, 'root', 0);
  if (ftyp !== 1 || movies !== 1 || movieHeaders !== 1 || videos !== 1 || media < 1) return formatError();
  return { bytes, durationMs };
}
