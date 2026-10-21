/** No-overwrite/outside-repository boundaries and legitimate MP4 padding are tested without pretending native encoding works. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareOutputPath, makeFreeBox } from '../media-test-assets.mjs';

test('rejects existing output and repository paths, including symlinked parents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'media-fixture-boundaries-'));
  try {
    const repo = join(dir, 'repo'); mkdirSync(repo);
    const existing = join(dir, 'existing'); mkdirSync(existing); writeFileSync(join(existing, 'keep'), 'original');
    assert.throws(() => prepareOutputPath(existing, repo), /already exists/);
    assert.throws(() => prepareOutputPath(join(repo, 'fixtures'), repo), /outside/);
    symlinkSync(repo, join(dir, 'alias'));
    assert.throws(() => prepareOutputPath(join(dir, 'alias', 'fixtures'), repo), /outside/);
    symlinkSync(join(dir, 'missing'), join(dir, 'dangling'));
    assert.throws(() => prepareOutputPath(join(dir, 'dangling'), repo), /already exists/);
    const target = prepareOutputPath(join(dir, 'new-fixtures'), repo);
    assert.equal(target, join(realpathSync(dir), 'new-fixtures'));
    assert.equal(existsSync(target), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('free box has a valid ISO size/type and bounded zero-filled payload', () => {
  const box = makeFreeBox(32);
  assert.equal(box.readUInt32BE(0), 40);
  assert.equal(box.subarray(4, 8).toString('ascii'), 'free');
  assert.deepEqual(box.subarray(8), Buffer.alloc(32));
  for (const bad of [-1, 0.5, NaN, 65 * 1024 * 1024]) assert.throws(() => makeFreeBox(bad), /Invalid/);
});
