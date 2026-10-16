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
  return [...source.matchAll(/\bsupabase\s*\.\s*(?:from|rpc|storage|channel|removeChannel|auth|functions)\b/g)].length;
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

// Vendor boundary for the rest of the app (portability, docs/engineering/PORTABILITY.md): hooks, components, context
// and services should reach Supabase through src/frontend/lib (and the admin portal through apps/admin-portal/lib), so a
// host change rewrites lib/ and not the screens.
// Today's direct calls (database, auth, storage, realtime) are a recorded debt that may only shrink.
const frontendRoot = path.join(root, 'apps/mobile/src/frontend');
const portalRoots = ['app', 'components', 'middleware.ts'].map((name) => path.join(root, 'apps/admin-portal', name));
const vendorBaselinePath = path.join(root, 'scripts/vendor-boundary-baseline.json');
const skipped = new Set(['lib', '__tests__', 'types']);
function walkFrontend(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return sourceExtensions.has(path.extname(target)) ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(target, entry.name);
    if (entry.isDirectory()) return skipped.has(entry.name) || entry.name === 'node_modules' || entry.name === '.next' ? [] : walkFrontend(absolute);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}
// Counts direct client calls (database, auth, storage, realtime, server functions) and direct @supabase/* imports.
const vendorUses = (source) => [...source.matchAll(/\bsupabase\s*\.\s*(?:from|rpc|storage|channel|removeChannel|auth|functions)\b/g)].length
  + [...source.matchAll(/from\s+['"]@supabase\//g)].length;
const vendorCurrent = Object.fromEntries(
  [...walkFrontend(frontendRoot), ...portalRoots.flatMap(walkFrontend)]
    .map((file) => [path.relative(root, file).split(path.sep).join('/'), vendorUses(fs.readFileSync(file, 'utf8'))])
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right)),
);
const vendorBaseline = JSON.parse(fs.readFileSync(vendorBaselinePath, 'utf8'));
const vendorGrew = Object.entries(vendorCurrent).filter(([file, count]) => count > (vendorBaseline[file] ?? 0));
const vendorShrank = Object.entries(vendorBaseline).filter(([file, count]) => (vendorCurrent[file] ?? 0) < count);
if (vendorGrew.length > 0) {
  console.error('app:data-boundaries found new direct Supabase calls outside src/frontend/lib:');
  for (const [file, count] of vendorGrew) console.error(`- ${file}: ${count} (baseline ${vendorBaseline[file] ?? 0})`);
  console.error('Put the call in a lib/ module and call that. Do not increase scripts/vendor-boundary-baseline.json.');
  process.exit(1);
}
if (vendorShrank.length > 0) {
  console.error('app:data-boundaries vendor baseline can be reduced:');
  for (const [file, count] of vendorShrank) console.error(`- ${file}: ${vendorCurrent[file] ?? 0} direct calls remain (baseline ${count})`);
  console.error('Update scripts/vendor-boundary-baseline.json in the same change.');
  process.exit(1);
}

const vendorTotal = Object.values(vendorCurrent).reduce((sum, count) => sum + count, 0);
console.log(`app:data-boundaries ok (${Object.keys(current).length} known route files; ${vendorTotal} recorded direct calls outside lib/ in ${Object.keys(vendorCurrent).length} files, may only shrink)`);
