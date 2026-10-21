/** Storage lineage regressions use synthetic source, including the dynamic public-reader gap found in review. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaStorageUses } from '../lib/media-storage-lineage.mjs';

const buckets = ['reels', 'game_highlights', 'avatars', 'reel_vault', 'fan_zone'];
const constants = new Map([['REELS_BUCKET', 'reels'], ['REEL_VAULT_BUCKET', 'reel_vault']]);

test('records dynamic public readers from the guarded canonical set without crediting private buckets', () => {
  const uses = mediaStorageUses(`const PUBLIC_BUCKETS = new Set(['reels','game_highlights','avatars']);
    storage.publicUrl(bucket, path); storage.sign('reel_vault', path, 3600);`, buckets, constants);
  assert.deepEqual(uses.filter(use => use.operation === 'publicUrl').map(use => use.bucket), ['reels', 'game_highlights', 'avatars']);
  assert.deepEqual(uses.filter(use => use.operation === 'sign').map(use => use.bucket), ['reel_vault']);
  assert.ok(uses.every(use => !use.writer));
});

test('tracks literal and constant writes and reads through the transport', () => {
  const uses = mediaStorageUses(`storage.upload(REELS_BUCKET, path, bytes, options);
    storage.remove('reel_vault', paths); storage.list('reels', prefix, options);`, buckets, constants);
  assert.deepEqual(uses.map(({ bucket, writer }) => ({ bucket, writer })), [
    { bucket: 'reels', writer: true }, { bucket: 'reel_vault', writer: true }, { bucket: 'reels', writer: false },
  ]);
});

test('keeps the existing file-constant approximation for dynamic bucket loops', () => {
  const uses = mediaStorageUses(`const choices = [REELS_BUCKET, REEL_VAULT_BUCKET]; storage.upload(bucket, path, bytes, options);`, buckets, constants);
  assert.deepEqual(uses.map(use => use.bucket), ['reels', 'reel_vault']);
  assert.ok(uses.every(use => use.writer));
});

test('does not invent buckets or operations for unresolved transport calls', () => {
  assert.deepEqual(mediaStorageUses(`const PUBLIC_BUCKETS = new Set(['unregistered']);
    storage.publicUrl(bucket, path); storage.upload('unknown', path, bytes); other.upload('reels', path, bytes);`, buckets, constants), []);
});
