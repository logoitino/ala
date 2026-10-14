/** Structured parser test fixture; no hosted footage and not device playback evidence. */
export const box = (kind: string, body: Buffer) => {
  const head = Buffer.alloc(8); head.writeUInt32BE(body.length + 8); head.write(kind, 4, 'ascii');
  return Buffer.concat([head, body]);
};

/** Minimal structured H264 MP4 for parsing tests; not a claim of device-decodable footage. */
export function sampleMp4(seconds = 10, metadata = true): Buffer {
  const mvhd = Buffer.alloc(24); mvhd.writeUInt32BE(9876, 4); mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(seconds * 1000, 16);
  const hdlr = Buffer.alloc(32); hdlr.write('vide', 8); hdlr.write('Private', 24);
  const avc = Buffer.alloc(78); avc.writeUInt16BE(1, 6); avc.writeUInt16BE(640, 24); avc.writeUInt16BE(480, 26);
  avc.write('Camera owner', 42);
  const desc = Buffer.alloc(8); desc.writeUInt32BE(1, 4);
  const stsd = box('stsd', Buffer.concat([desc, box('avc1', Buffer.concat([avc, box('avcC', Buffer.from([1, 66, 0, 30]))]))]));
  const trak = box('trak', box('mdia', Buffer.concat([box('hdlr', hdlr), box('minf', box('stbl', stsd))])));
  return Buffer.concat([box('ftyp', Buffer.from('isom\0\0\0\0isommp42', 'ascii')),
    box('moov', Buffer.concat([box('mvhd', mvhd), trak, ...(metadata ? [box('udta', Buffer.from('GPS and owner details'))] : [])])),
    box('mdat', Buffer.from([1, 2, 3, 4]))]);
}

