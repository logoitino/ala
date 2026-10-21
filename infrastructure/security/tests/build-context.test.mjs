/** Inspect Docker source policy and adversarial credential filenames; actual image/build-context execution remains separate. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));

test('credential exclusions follow every Docker source allowlist',()=>{
  const lines=fs.readFileSync(root+'.dockerignore','utf8').split(/\r?\n/).map(line=>line.trim());
  const lastAllow=Math.max(...lines.map((line,index)=>line.startsWith('!')?index:-1));
  for(const filename of ['.npmrc','.netrc','_netrc','.yarnrc','.yarnrc.yml']) {
    const deny=lines.lastIndexOf(`**/${filename}`);
    assert.ok(deny>lastAllow,`${filename} must be denied after source inclusion`);
  }
});

test('Docker uses the explicit reviewed pnpm settings instead of source credential configs',()=>{
  for(const app of ['admin','expo']) {
    const source=fs.readFileSync(root+`infrastructure/containers/Dockerfile.${app}`,'utf8');
    assert.ok(source.includes('COPY infrastructure/containers/pnpm.npmrc ./.npmrc'));
    assert.ok(!/^COPY\s+\.npmrc\b/m.test(source));
  }
  const config=fs.readFileSync(root+'infrastructure/containers/pnpm.npmrc','utf8');
  assert.ok(!/(?:_auth|token|password|username|registry\s*=|\$\{)/i.test(config));
});
