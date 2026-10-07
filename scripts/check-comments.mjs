/**
 * `pnpm comments:check` — every source file in the mobile app must explain itself.
 *
 * Rule (docs/engineering/CONVENTIONS.md §5): a file needs a comment before its first exported function or class
 * (or before its first export of any kind, for files that only export data), or within its first
 * 60 lines. That comment says what the file is for in product language, so an outside reviewer can
 * tell where they are without reading the code. A top-of-file header is preferred; a doc comment on
 * the main component or function also satisfies the check. Tests, type declarations and generated
 * files are exempt.
 *
 * Run from the repo root. Exits 1 and lists the files that have no header.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanRoots = ['apps/mobile/app', 'apps/mobile/src'].map((dir) => path.join(root, dir));
const sourceExtensions = new Set(['.ts', '.tsx']);

/** Files that are generated, declarations, or tests — nobody hand-writes a header for these. */
function isExempt(relative) {
  return (
    relative.endsWith('.d.ts') ||
    /\.test\.tsx?$/.test(relative) ||
    relative.includes('/__tests__/') ||
    relative.includes('/__mocks__/') ||
    relative.endsWith('/types/database.ts') // generated from the schema
  );
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(absolute);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

/** True when a comment appears before the first exported function / class, or in the first 60 lines. */
function hasHeader(source) {
  const lines = source.split(/\r?\n/);
  let anchor = lines.findIndex((line) => /^export\s+(default\s+)?(async\s+)?(function|class)\b/.test(line));
  if (anchor === -1) anchor = lines.findIndex((line) => /^export\s/.test(line));
  const limit = anchor === -1 ? 60 : Math.max(anchor, 60);
  return lines.slice(0, limit).some((line) => /^\s*(\/\*|\/\/|\*)/.test(line));
}

const missing = scanRoots
  .filter((dir) => fs.existsSync(dir))
  .flatMap(walk)
  .map((file) => path.relative(root, file).split(path.sep).join('/'))
  .filter((relative) => !isExempt(relative))
  .filter((relative) => !hasHeader(fs.readFileSync(path.join(root, relative), 'utf8')))
  .sort();

if (missing.length > 0) {
  console.error('Files with no header comment (add one — see docs/engineering/CONVENTIONS.md §5):');
  for (const file of missing) console.error(`  ${file}`);
  process.exit(1);
}
console.log('comments:check ok — every source file has a header comment.');
