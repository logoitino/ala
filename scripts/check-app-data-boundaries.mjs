import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(root, 'apps/mobile/app');
const baselinePath = path.join(root, 'scripts/app-data-boundary-baseline.json');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function directSupabaseCalls(file) {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/\bsupabase\s*\.\s*(?:from|rpc)\s*\(/g)].length;
}

const current = Object.fromEntries(
  walk(appRoot)
    .map((file) => [path.relative(root, file).split(path.sep).join('/'), directSupabaseCalls(file)])
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right)),
);
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const regressions = Object.entries(current).filter(([file, count]) => count > (baseline[file] ?? 0));
const stale = Object.entries(baseline).filter(([file, count]) => (current[file] ?? 0) < count);

if (regressions.length > 0) {
  console.error('app:data-boundaries found new direct Supabase calls in Expo routes:');
  for (const [file, count] of regressions) {
    console.error(`- ${file}: ${count} (baseline ${baseline[file] ?? 0})`);
  }
  console.error('Move the query into src/frontend/lib or a hook. Do not increase the baseline.');
  process.exit(1);
}

if (stale.length > 0) {
  console.error('app:data-boundaries baseline can be reduced:');
  for (const [file, count] of stale) {
    console.error(`- ${file}: ${current[file] ?? 0} direct calls remain (baseline ${count})`);
  }
  console.error('Update scripts/app-data-boundary-baseline.json in the same change.');
  process.exit(1);
}

console.log(`app:data-boundaries ok (${Object.keys(current).length} known route files)`);
