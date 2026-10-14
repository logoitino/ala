/** Bounded MP4 validation tests use structured container bytes; no hosted media or native encoder. */
import { sanitizeFanZoneMp4, FAN_ZONE_MAX_BYTES } from '../fanZoneMp4';

import { sampleMp4, box } from '../__fixtures__/fanZoneMp4Fixture';

describe('Fan Zone MP4 sanitization', () => {
  it('derives duration and removes supported metadata without shifting media offsets or mutating input', () => {
    const input = sampleMp4(); const before = Buffer.from(input);
    const result = sanitizeFanZoneMp4(input);
    expect(result.durationMs).toBe(10000); expect(result.bytes.length).toBe(input.length);
    expect(input.equals(before)).toBe(true);
    expect(Buffer.from(result.bytes).includes(Buffer.from('GPS'))).toBe(false);
    expect(Buffer.from(result.bytes).includes(Buffer.from('Private'))).toBe(false);
    expect(Buffer.from(result.bytes).includes(Buffer.from('Camera owner'))).toBe(false);
    expect(result.bytes.slice(-4)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
  it.each([0, 31])('rejects unsupported duration %s', seconds => {
    expect(() => sanitizeFanZoneMp4(sampleMp4(seconds))).toThrow('FUN_MEDIA_DURATION');
  });
  it('rejects corrupt box boundaries and unknown containers instead of using the original', () => {
    const malformed = sampleMp4(); malformed.writeUInt32BE(0xffffffff, 0);
    expect(() => sanitizeFanZoneMp4(malformed)).toThrow('FUN_MEDIA_FORMAT');
    expect(() => sanitizeFanZoneMp4(Buffer.concat([sampleMp4(), box('uuid', Buffer.from('secret'))]))).toThrow('FUN_MEDIA_FORMAT');
  });
  it('rejects oversized and non-MP4 media and missing video tracks', () => {
    expect(() => sanitizeFanZoneMp4(new Uint8Array(FAN_ZONE_MAX_BYTES + 1))).toThrow('FUN_MEDIA_SIZE');
    expect(() => sanitizeFanZoneMp4(Buffer.from('not a video'))).toThrow('FUN_MEDIA_FORMAT');
    const audio = sampleMp4(); audio.write('text', audio.indexOf(Buffer.from('vide')));
    expect(() => sanitizeFanZoneMp4(audio)).toThrow('FUN_MEDIA_FORMAT');
  });
  it('is stable on sanitized retry bytes', () => {
    const first = sanitizeFanZoneMp4(sampleMp4());
    expect(sanitizeFanZoneMp4(first.bytes)).toEqual(first);
  });
});
