#!/usr/bin/env node
/**
 * `pnpm code:unused` — no unused imports, variables, private helpers or types (DATA-01, owned by
 * CODE_HYGIENE). Runs TypeScript with `--noUnusedLocals` on the mobile app and the admin portal and fails
 * on anything not in the named baseline in `docs/engineering/data-ownership.json` → `unusedLocalsBaseline`
 * (each entry has an owner and a reason). A baseline entry that is fixed must be removed, so the list only
 * shrinks. Dead exports are caught separately by `pnpm data:map:check`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(root, 'node_modules/.bin/tsc');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'docs/engineering/data-ownership.json'), 'utf8'));
const baseline = new Map((registry.unusedLocalsBaseline ?? []).map((row) => [`${row.file}#${row.name}`, row]));
const found = [];
for (const app of ['apps/mobile', 'apps/admin-portal']) {
  const run = spawnSync(tsc, ['--noEmit', '--noUnusedLocals', '--pretty', 'false'], { cwd: path.join(root, app), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // Fail closed: a compiler that crashed, was killed, never started or printed a format this parser cannot read
  // would otherwise look like "nothing unused". `--pretty false` matters: any FORCE_COLOR value (even 0, as the
  // detection scan sets) switches tsc to coloured output. tsc exits 0 when clean, 2 with diagnostics.
  const diagnostics = /error TS\d+/.test(`${run.stdout}${run.stderr}`);
  if (run.error || run.signal || !(run.status === 0 || (run.status === 2 && diagnostics))) {
    console.error(`code:unused: TypeScript did not finish for ${app} (${run.error?.message ?? (run.signal ? `signal ${run.signal}` : `exit ${run.status}`)}). Nothing was checked.`);
    process.exit(1);
  }
  for (const m of `${run.stdout}${run.stderr}`.matchAll(/^(.+?)\((\d+),\d+\): error TS(6133|6196|6192|6198): '?([^'\n]+?)'? (?:is|are|All)/gm)) {
    found.push({ key: `${app}/${m[1]}#${m[4]}`, line: `${app}/${m[1]}:${m[2]} ${m[4]}` });
  }
  const other = `${run.stdout}${run.stderr}`.split('\n').filter((line) => /error TS/.test(line) && !/TS(6133|6196|6192|6198)/.test(line));
  if (other.length) { console.error(`code:unused: ${app} has type errors; run typecheck first.\n${other.slice(0, 5).join('\n')}`); process.exit(1); }
}
const fresh = found.filter((row) => !baseline.has(row.key));
const stale = [...baseline.keys()].filter((key) => !found.some((row) => row.key === key));
if (fresh.length || stale.length) {
  if (fresh.length) console.error(`code:unused found ${fresh.length} unused item(s). Remove them (archive code that may come back):\n${fresh.map((row) => `- ${row.line}`).join('\n')}`);
  if (stale.length) console.error(`code:unused baseline entries now fixed; remove them from data-ownership.json unusedLocalsBaseline:\n${stale.map((key) => `- ${key}`).join('\n')}`);
  process.exit(1);
}
console.log(`code:unused ok (no unused locals outside ${baseline.size} named baseline item(s))`);
