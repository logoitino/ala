#!/usr/bin/env node
/**
 * `pnpm data:map` — the master data map (DATA-01). Owned by DATA_GOVERNANCE, built by DATA_LINEAGE,
 * dead-code list kept by CODE_HYGIENE.
 *
 * Reads the canonical schema (`apps/mobile/src/backend/db/schema.sql`), every app / portal / Edge Function
 * source file and `docs/engineering/data-ownership.json`, then traces each table and view:
 * owner and purpose → who writes it → who reads it → which database functions touch it → which screens
 * (Expo routes and portal pages) reach it through the import graph. It also lists every database
 * function with its callers and every exported symbol nothing imports.
 *
 *   node scripts/data-map.mjs           regenerate docs/engineering/DATA_MAP.md
 *   node scripts/data-map.mjs --check   fail when the map is stale or a rule is broken (part of `pnpm check`)
 *
 * Rules (each failure says how to fix it):
 *   - every table and view has an owner that is a registered agent call, and a purpose
 *   - every table has at least one writer and one reader, or an `exceptions` entry with a reason
 *   - every database function has a caller (app, portal, Edge Function, trigger or other SQL), or a
 *     `functions` entry saying how it is used (for example the SQL Editor)
 *   - every exported symbol nothing imports is listed in `exportsTriage` with a decision, and no
 *     triage entry is stale
 *   - no ownership entry points at something that no longer exists
 *   - archived code follows the archive naming rule (archive/README.md) and nothing imports it
 * Pattern matching, not a compiler: dynamic table names are invisible to it, so the owner of anything
 * built that way records it under `exceptions`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqlFunctionBodies } from './lib/sql-functions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (file) => path.relative(root, file).split(path.sep).join('/');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const check = process.argv.includes('--check');
const OUT = 'docs/engineering/DATA_MAP.md';
// The main-admin Team flow reads the same computed lineage as the handbook, avoiding a second map.
const TOPOLOGY_OUT = 'packages/shared-types/admin/supportTopology.json';

const schema = read('apps/mobile/src/backend/db/schema.sql');
const ownership = JSON.parse(read('docs/engineering/data-ownership.json'));
const calls = new Set(JSON.parse(read('.claude/agents/registry.json')).agents.map((agent) => agent.call));

// ---------------------------------------------------------------- schema
const stripSqlComments = (sql) => sql.replace(/--[^\n]*/g, '');
const sql = stripSqlComments(schema);
const tables = [...new Set([...sql.matchAll(/create table if not exists (?:public\.)?(\w+)/gi)].map((m) => m[1]))].sort();
const views = [...new Set([...sql.matchAll(/create (?:or replace )?view (?:public\.)?(\w+)/gi)].map((m) => m[1]))].sort();
const relations = [...tables, ...views];
const relationSet = new Set(relations);

// Function bodies: per signature the last definition wins, like Postgres; overloads (same name,
// different argument types) all exist, so a name's lineage is the union of its live signatures.
const signatureBodies = new Map();
for (const m of sql.matchAll(/create or replace function public\.(\w+)\s*\(([\s\S]*?)\)\s*returns([\s\S]*?)\$\$([\s\S]*?)\$\$/gi)) {
  const types = m[2].split(',').map((param) => param.trim().split(/\s+/)[1] ?? '').join(',');
  signatureBodies.set(`${m[1]}(${types})`, { name: m[1], body: m[4] });
}
// Private schemas (fan_zone_private) are real functions. Keep the schema in the name so ownership can name them.
for (const m of sql.matchAll(/create or replace function (?!public\.)(\w+)\.(\w+)\s*\(([\s\S]*?)\)\s*returns([\s\S]*?)\$\$([\s\S]*?)\$\$/gi)) {
  const qualified = `${m[1]}.${m[2]}`;
  const types = m[3].split(',').map((param) => param.trim().split(/\s+/)[1] ?? '').join(',');
  signatureBodies.set(`${qualified}(${types})`, { name: qualified, body: m[5] });
}
// A function dropped after its last definition (archived by a migration) no longer exists.
const lastIndex = (pattern) => { let at = -1; for (const m of sql.matchAll(pattern)) at = m.index; return at; };
const functionBodies = new Map();
for (const { name, body } of signatureBodies.values()) functionBodies.set(name, `${functionBodies.get(name) ?? ''}\n${body}`);
for (const name of [...functionBodies.keys()]) {
  const needle = name.includes('.') ? name.replace(/\./g, '\\.') : `public\\.${name}`;
  const created = lastIndex(new RegExp(`create or replace function ${needle}\\s*\\(`, 'gi'));
  const dropped = lastIndex(new RegExp(`drop function if exists ${needle}\\s*\\(`, 'gi'));
  if (dropped > created) functionBodies.delete(name);
}
const functions = [...functionBodies.keys()].sort();
const functionSet = new Set(functions);

const triggers = [...sql.matchAll(/create trigger (\w+)[\s\S]*?\bon (?:public\.)?(\w+)[\s\S]*?execute (?:procedure|function) public\.(\w+)/gi)]
  .map((m) => ({ name: m[1], table: m[2], fn: m[3] }));
// Views read the relations named in their definition.
const viewReads = new Map();
for (const m of sql.matchAll(/create (?:or replace )?view (?:public\.)?(\w+)[\s\S]*?\bas\b([\s\S]*?);/gi)) {
  viewReads.set(m[1], [...new Set([...m[2].matchAll(/\b(?:from|join)\s+(?:public\.)?(\w+)/gi)].map((x) => x[1]).filter((t) => relationSet.has(t)))]);
}

const sqlTouches = new Map(); // fn -> { reads:Set, writes:Set, calls:Set }
for (const [fn, body] of functionBodies) {
  // Writers create or change rows; a function that only deletes is a remover, not a writer.
  const writes = new Set([...body.matchAll(/\b(?:insert\s+into|update)\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]).filter((t) => relationSet.has(t)));
  const removes = new Set([...body.matchAll(/\bdelete\s+from\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]).filter((t) => relationSet.has(t)));
  const reads = new Set([...body.matchAll(/\b(?:from|join)\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]).filter((t) => relationSet.has(t) && !writes.has(t)));
  for (const m of body.matchAll(/%rowtype|\b(\w+)%rowtype/gi)) if (m[1] && relationSet.has(m[1])) reads.add(m[1]);
  const fnCalls = new Set([...body.matchAll(/(?<![\w.$])(?:public\.)?(\w+)\s*\(/g)].map((m) => m[1]).filter((name) => functionSet.has(name) && name !== fn));
  for (const t of removes) if (!writes.has(t)) reads.delete(t);
  sqlTouches.set(fn, { reads, writes, removes, calls: fnCalls });
}

// ---------------------------------------------------------------- code
const CODE_ROOTS = ['apps/mobile/app', 'apps/mobile/src', 'apps/admin-portal/app', 'apps/admin-portal/lib', 'apps/admin-portal/components', 'supabase/functions', 'packages/shared-types'];
const isTest = (file) => /__tests__|\.test\.|__mocks__/.test(file);
const walk = (dir) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const child = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : walk(child);
  return /\.(tsx?|mjs|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [child] : [];
}) : []);
const codeFiles = CODE_ROOTS.flatMap(walk).filter((file) => !isTest(file)).sort();
const source = new Map(codeFiles.map((file) => [file, read(file)]));

const codeTable = new Map(); // relation -> { readers:Set, writers:Set, refs:Set('file::symbol') }
const codeRpc = new Map(); // fn -> Set(file)
const rpcRefs = new Map(); // fn -> Set('file::symbol')
/** The exported function or constant a call sits in, so screens are traced from that symbol, not the whole file. */
const enclosingExport = (text, index) => {
  let name = null;
  for (const m of text.slice(0, index).matchAll(/^export (?:default )?(?:async )?(?:function|const|class)\s+(\w+)/gm)) name = m[1];
  return name;
};
const addRef = (map, key, ref) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(ref); };
// Comments are blanked (same length, so positions still line up) before names are read from string
// literals: a header that lists RPC names is documentation, not a call.
const blankComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length));
for (const [file, rawText] of source) {
  const text = blankComments(rawText);
  // Lookahead, so two queries on neighbouring lines are both seen; a chain ends at the next query or statement.
  for (const m of text.matchAll(/(?<!storage\s*\.\s*)\.from\(\s*['"`](\w+)['"`]\s*\)(?=([\s\S]{0,400}))/g)) {
    if (!relationSet.has(m[1])) continue;
    const chain = m[2].split(/;\n|\n\s*\n|\.from\(/)[0];
    const entry = codeTable.get(m[1]) ?? { readers: new Set(), writers: new Set(), refs: new Set() };
    entry.refs.add(`${file}::${enclosingExport(text, m.index) ?? ''}`);
    if (/\.(insert|update|upsert)\s*\(/.test(chain)) entry.writers.add(file);
    else if (/\.delete\s*\(/.test(chain)) (entry.removers ??= new Set()).add(file);
    else entry.readers.add(file);
    if (/\.(insert|update|upsert)\s*\([\s\S]*\.select\s*\(/.test(chain)) entry.readers.add(file);
    codeTable.set(m[1], entry);
  }
  // A file that calls `.from(variable)` (a paged reader, for example) names its tables as string literals.
  if (/\.from\s*(?:as[^)]*\))?\)?\s*\(\s*[A-Za-z_]\w*\s*\)/.test(text) || /\(supabase\.from as/.test(text)) {
    for (const m of text.matchAll(/['"`](\w+)['"`]/g)) {
      if (!relationSet.has(m[1])) continue;
      const entry = codeTable.get(m[1]) ?? { readers: new Set(), writers: new Set(), refs: new Set() };
      entry.readers.add(file);
      entry.refs.add(`${file}::${enclosingExport(text, m.index) ?? ''}`);
      codeTable.set(m[1], entry);
    }
  }
  for (const m of text.matchAll(/\.rpc\(\s*['"`](\w+)['"`]/g)) {
    if (!codeRpc.has(m[1])) codeRpc.set(m[1], new Set());
    codeRpc.get(m[1]).add(file);
    addRef(rpcRefs, m[1], `${file}::${enclosingExport(text, m.index) ?? ''}`);
  }
  // A file that calls `.rpc(variable)` names its functions as string literals (a union type or a map).
  // Also a file that keeps `supabase.rpc` in a typed variable or helper (`const rpc = supabase.rpc as …`), and a file
  // that calls the shared `callRpc` helper from `lib/rpc` (the merged "not switched on" call path).
  if (/\.rpc\(\s*[A-Za-z_]/.test(text) || /supabase\.rpc\s+as\b/.test(text) || /from\s+['"]@\/lib\/rpc['"]/.test(text)) {
    for (const m of text.matchAll(/['"`](\w+)['"`]/g)) {
      if (!functionSet.has(m[1])) continue;
      if (!codeRpc.has(m[1])) codeRpc.set(m[1], new Set());
      codeRpc.get(m[1]).add(file);
      addRef(rpcRefs, m[1], `${file}::${enclosingExport(text, m.index) ?? ''}`);
    }
  }
}

// Import graph, to find which screens reach a data file.
const EXT = ['', '.ts', '.tsx', '.web.ts', '.web.tsx', '.native.ts', '.native.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];
function resolve(from, spec) {
  let base;
  if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(from), spec);
  else if (spec.startsWith('@/')) base = from.startsWith('apps/admin-portal/') ? `apps/admin-portal/${spec.slice(2)}` : `apps/mobile/src/frontend/${spec.slice(2)}`;
  else if (spec.startsWith('@backend/')) base = `apps/mobile/src/backend/${spec.slice(9)}`;
  else if (spec.startsWith('@shared/')) base = `packages/shared-types/${spec.slice(8)}`;
  else if (spec === '@tapuai/shared-types') base = 'packages/shared-types/index';
  else if (spec.startsWith('@tapuai/shared-types/')) base = `packages/shared-types/${spec.slice(21)}`;
  else return [];
  return EXT.map((ext) => base + ext).filter((candidate) => source.has(candidate));
}
const importers = new Map(); // file -> Set(files importing it)
for (const [file, text] of source) {
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*|^import\s+)['"]([^'"]+)['"]/gm)) {
    for (const target of resolve(file, m[1])) {
      if (!importers.has(target)) importers.set(target, new Set());
      importers.get(target).add(file);
    }
  }
}
const isScreen = (file) => (file.startsWith('apps/mobile/app/') && !/\/_layout\.tsx$|\+api\.ts$/.test(file)) || /^apps\/admin-portal\/app\/.*page\.tsx$/.test(file);
const isServer = (file) => file.startsWith('supabase/functions/') || /\+api\.ts$/.test(file);
const routeName = (file) => {
  if (file.startsWith('supabase/functions/')) return `edge:${file.split('/')[2]}`;
  if (file.startsWith('apps/admin-portal/')) return `portal:${file.replace(/^apps\/admin-portal\/app/, '').replace(/\/\([^)]+\)/g, '').replace(/\/page\.tsx$/, '') || '/'}`;
  return file.replace(/^apps\/mobile\/app/, '').replace(/\/\([^)]+\)/g, '').replace(/\.(tsx|ts)$/, '').replace(/\/index$/, '') || '/';
};
/**
 * @purpose Screens reached from one data call. The first hop follows only files that use the exported
 *   symbol holding the call; later hops follow whole files (hooks and components are usually one export).
 */
function exportBlocks(text) {
  const marks = [...text.matchAll(/^export (?:default )?(?:async )?(?:function|const|class)\s+(\w+)/gm)].map((m) => ({ name: m[1], start: m.index }));
  return marks.map((mark, i) => ({ name: mark.name, body: text.slice(mark.start, marks[i + 1]?.start ?? text.length) }));
}
function screensOfRef(ref) {
  const [file, symbol] = ref.split('::');
  if (!symbol || isScreen(file) || isServer(file)) return screensOf(file);
  // Exports in the same file that call the symbol (directly or through each other) carry the data too.
  const blocks = exportBlocks(source.get(file) ?? '');
  const symbols = new Set([symbol]);
  for (let grew = true; grew;) {
    grew = false;
    for (const block of blocks) if (!symbols.has(block.name) && [...symbols].some((name) => new RegExp(`\\b${name}\\b`).test(block.body.replace(/^export[^\n]*/, '')))) { symbols.add(block.name); grew = true; }
  }
  const screens = new Set();
  const pattern = new RegExp(`\\b(${[...symbols].join('|')})\\b`);
  for (const importer of importers.get(file) ?? []) if (pattern.test(source.get(importer) ?? '')) for (const s of screensOf(importer)) screens.add(s);
  return screens;
}
const screenCache = new Map();
function screensOf(file) {
  if (screenCache.has(file)) return screenCache.get(file);
  const seen = new Set([file]);
  const queue = [file];
  const screens = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (isScreen(current) || isServer(current)) screens.add(routeName(current));
    for (const parent of importers.get(current) ?? []) if (!seen.has(parent)) { seen.add(parent); queue.push(parent); }
  }
  screenCache.set(file, screens);
  return screens;
}

// ---------------------------------------------------------------- Storage buckets
// Buckets come from `insert into storage.buckets` and storage policies; code names them as literals or
// through constants (`export const REELS_BUCKET = 'reels'`).
const bucketNames = [...new Set([
  ...[...sql.matchAll(/insert into storage\.buckets[\s\S]*?values\s*\(\s*'(\w+)'/gi)].map((m) => m[1]),
  ...[...sql.matchAll(/bucket_id\s*=\s*'(\w+)'/gi)].map((m) => m[1]),
])].sort();
const bucketConstants = new Map(); // constant name -> bucket
for (const [, text] of source) for (const m of text.matchAll(/(?:export\s+)?const\s+([A-Z_]+)\s*=\s*['"`](\w+)['"`]/g)) if (bucketNames.includes(m[2])) bucketConstants.set(m[1], m[2]);
const bucketUse = new Map(bucketNames.map((name) => [name, { writers: new Set(), readers: new Set(), refs: new Set() }]));
for (const [file, rawText] of source) {
  const text = blankComments(rawText);
  for (const m of text.matchAll(/storage\s*\.\s*from\(\s*(?:['"`](\w+)['"`]|([A-Za-z_]\w*))\s*\)([\s\S]{0,120})/g)) {
    let bucket = m[1] ?? bucketConstants.get(m[2]);
    // `storage.from(bucket)` with a parameter: the file names its buckets through constants.
    const candidates = bucket ? [bucket] : [...bucketConstants.entries()].filter(([name]) => new RegExp(`\\b${name}\\b`).test(text)).map(([, b]) => b);
    for (const name of candidates) {
      const use = bucketUse.get(name);
      if (!use) continue;
      if (/\.(upload|update|remove|move|copy)\s*\(/.test(m[3])) use.writers.add(file);
      if (/\.(getPublicUrl|createSignedUrl|createSignedUrls|download|list)\s*\(/.test(m[3])) use.readers.add(file);
      use.refs.add(`${file}::${enclosingExport(text, m.index) ?? ''}`);
    }
  }
  // PORT-01: public URLs are built through lib/media.ts `publicMediaUrl(bucket, path)`; the caller reads that bucket.
  for (const m of text.matchAll(/\bpublicMediaUrl\(\s*(?:['"`](\w+)['"`]|([A-Za-z_]\w*))/g)) {
    const bucket = m[1] ?? bucketConstants.get(m[2]);
    const candidates = bucket ? [bucket] : [...bucketConstants.entries()].filter(([name]) => new RegExp(`\\b${name}\\b`).test(text)).map(([, b]) => b);
    for (const name of candidates) {
      const use = bucketUse.get(name);
      if (!use) continue;
      use.readers.add(file);
      use.refs.add(`${file}::${enclosingExport(text, m.index) ?? ''}`);
    }
  }
}

// ---------------------------------------------------------------- callers and lineage
const fnCallers = new Map(functions.map((fn) => [fn, new Set()]));
for (const [fn, files] of codeRpc) if (fnCallers.has(fn)) for (const file of files) fnCallers.get(fn).add(file);
for (const [fn, touch] of sqlTouches) for (const callee of touch.calls) fnCallers.get(callee)?.add(`sql:${fn}`);
for (const trigger of triggers) fnCallers.get(trigger.fn)?.add(`trigger:${trigger.name} on ${trigger.table}`);
for (const m of sql.matchAll(/check\s*\(([\s\S]*?)\)\s*[;,)]/gi)) for (const call of m[1].matchAll(/(?:public\.)?(\w+)\s*\(/g)) fnCallers.get(call[1])?.add('sql:check constraint');
for (const m of sql.matchAll(/create policy[\s\S]*?;/gi)) for (const call of m[0].matchAll(/(?:public\.)?(\w+)\s*\(/g)) fnCallers.get(call[1])?.add('sql:RLS policy');
for (const m of sql.matchAll(/create (?:or replace )?view[\s\S]*?;/gi)) for (const call of m[0].matchAll(/(?:public\.)?(\w+)\s*\(/g)) fnCallers.get(call[1])?.add('sql:view');

// Functions reachable from code (directly or through other functions), for screen lineage.
const fnScreens = new Map();
function screensOfFn(fn, seen = new Set()) {
  if (fnScreens.has(fn)) return fnScreens.get(fn);
  if (seen.has(fn)) return new Set();
  seen.add(fn);
  const screens = new Set();
  for (const caller of fnCallers.get(fn) ?? []) {
    if (caller.startsWith('sql:')) { const parent = caller.slice(4); if (functionSet.has(parent)) for (const s of screensOfFn(parent, seen)) screens.add(s); }
  }
  for (const ref of rpcRefs.get(fn) ?? []) for (const s of screensOfRef(ref)) screens.add(s);
  fnScreens.set(fn, screens);
  return screens;
}

const lineage = relations.map((name) => {
  const code = codeTable.get(name) ?? { readers: new Set(), writers: new Set(), refs: new Set() };
  const sqlWriters = functions.filter((fn) => sqlTouches.get(fn).writes.has(name));
  const removers = [...(code.removers ?? []), ...functions.filter((fn) => sqlTouches.get(fn).removes.has(name))];
  const sqlReaders = functions.filter((fn) => sqlTouches.get(fn).reads.has(name));
  const viewReaders = [...viewReads].filter(([, reads]) => reads.includes(name)).map(([view]) => `view:${view}`);
  const tableTriggers = triggers.filter((trigger) => trigger.table === name).map((trigger) => `${trigger.name} → ${trigger.fn}`);
  const screens = new Set();
  for (const ref of code.refs ?? []) for (const s of screensOfRef(ref)) screens.add(s);
  for (const fn of [...sqlWriters, ...sqlReaders]) for (const s of screensOfFn(fn)) screens.add(s);
  for (const view of viewReaders) { const v = view.slice(5); for (const ref of codeTable.get(v)?.refs ?? []) for (const s of screensOfRef(ref)) screens.add(s); }
  return {
    name,
    kind: views.includes(name) ? 'view' : 'table',
    owner: ownership.tables[name]?.owner ?? null,
    purpose: ownership.tables[name]?.purpose ?? null,
    writers: [...code.writers].sort(),
    readers: [...code.readers].sort(),
    sqlWriters,
    sqlReaders: [...sqlReaders, ...viewReaders],
    removers: [...new Set(removers)].sort(),
    triggers: tableTriggers,
    screens: [...screens].sort(),
  };
});

const tableOwnerOf = (name) => ownership.tables[name]?.owner;
const fnRows = functions.map((fn) => {
  const touch = sqlTouches.get(fn);
  const explicit = ownership.functions[fn];
  const counts = new Map();
  for (const t of [...touch.writes, ...touch.writes, ...touch.reads]) counts.set(t, (counts.get(t) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  return {
    name: fn,
    owner: explicit?.owner ?? (top ? tableOwnerOf(top) : null) ?? 'BACKEND',
    callers: [...fnCallers.get(fn)].sort(),
    manual: explicit?.use ?? null,
    writes: [...touch.writes].sort(),
    reads: [...touch.reads].sort(),
  };
});

// ---------------------------------------------------------------- feature switches
// Published app switches (`DEFAULT_APP_RUNTIME` in lib/runtime.ts). A switch an admin can flip must be
// read by a fan surface; a group read by key (`live.buttons[id]`) counts for every switch in it.
const runtimeFile = 'apps/mobile/src/frontend/lib/runtime.ts';
const runtimeText = source.get(runtimeFile) ?? '';
const defaultsAt = runtimeText.indexOf('export const DEFAULT_APP_RUNTIME');
const switchGroups = ['tabs', 'buttons', 'layouts', 'profile'];
const switches = defaultsAt < 0 ? [] : switchGroups.flatMap((group) => {
  const body = runtimeText.slice(defaultsAt).match(new RegExp(`\\b${group}:\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? '';
  return [...body.matchAll(/(\w+):/g)].map((m) => ({ group, key: m[1], path: `${group}.${m[1]}` }));
});
const isAdminSurface = (file) => file.includes('/components/Admin/') || file.includes('/(admin)/') || file.startsWith('apps/admin-portal/');
const fanFiles = [...source.entries()].filter(([file]) => file.startsWith('apps/mobile/') && !isAdminSurface(file) && file !== runtimeFile && !file.endsWith('lib/adminCoverage.ts') && !file.endsWith('lib/adminReports.ts'));
const switchRows = switches.map((sw) => {
  const literal = [`'${sw.path}'`, `"${sw.path}"`, `\`${sw.path}\``, `.${sw.group}.${sw.key}`, `${sw.group}?.${sw.key}`];
  const readers = fanFiles.filter(([, text]) => literal.some((needle) => text.includes(needle)) || new RegExp(`\\.${sw.group}\\[`).test(text)).map(([file]) => file);
  return { ...sw, readers: readers.sort() };
});

const bucketRows = bucketNames.map((name) => {
  const use = bucketUse.get(name);
  const screens = new Set();
  for (const ref of use.refs) for (const sc of screensOfRef(ref)) screens.add(sc);
  return { name, owner: ownership.buckets?.[name]?.owner ?? null, purpose: ownership.buckets?.[name]?.purpose ?? null, writers: [...use.writers].sort(), readers: [...use.readers].sort(), screens: [...screens].sort() };
});

// ---------------------------------------------------------------- dead exports
const prod = [...source.keys()].filter((file) => /\.(tsx?)$/.test(file) && !file.startsWith('supabase/functions/'));
const allText = [...source.entries()];
const routeFile = (file) => file.startsWith('apps/mobile/app/') || file.startsWith('apps/admin-portal/app/');
const blankStrings = (text) => text.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, (m) => `'${' '.repeat(Math.max(0, m.length - 2))}'`);
const codeOnly = allText.map(([file, body]) => [file, blankStrings(blankComments(body))]);
const codeOnlyByFile = new Map(codeOnly);
const deadExports = [];
for (const file of prod) {
  if (routeFile(file)) continue;
  const text = source.get(file);
  for (const m of text.matchAll(/^export (?:async )?(?:function|const|class|let) (\w+)/gm)) {
    const name = m[1];
    const pattern = new RegExp(`\\b${name}\\b`);
    // A use is code, not a comment or a quoted string (an import path such as './ExclusivePaywall' is not a use).
    const usedElsewhere = codeOnly.some(([other, body]) => other !== file && pattern.test(body));
    const usedInFile = (codeOnlyByFile.get(file).match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length > 1;
    if (!usedElsewhere && !usedInFile) deadExports.push({ file, name });
  }
}

// ---------------------------------------------------------------- rules
const problems = [];
for (const row of lineage) {
  if (!row.owner) problems.push(`${row.kind} ${row.name}: no owner. Add it to docs/engineering/data-ownership.json "tables" with an owner (agent call) and purpose.`);
  else if (!calls.has(row.owner)) problems.push(`${row.kind} ${row.name}: owner ${row.owner} is not a registered agent call.`);
  if (row.owner && !row.purpose) problems.push(`${row.kind} ${row.name}: no purpose.`);
  const exception = ownership.exceptions[row.name];
  if (row.kind === 'table' && !row.writers.length && !row.sqlWriters.length && !exception?.noWriter) problems.push(`table ${row.name}: nothing writes it. Remove it through a migration, or record "exceptions.${row.name}.noWriter" with the reason.`);
  if (!row.readers.length && !row.sqlReaders.length && !exception?.noReader) problems.push(`${row.kind} ${row.name}: nothing reads it (write-only data). Add a reader, or record "exceptions.${row.name}.noReader" with the reason.`);
}
for (const row of bucketRows) {
  if (!row.owner) problems.push(`Storage bucket ${row.name}: no owner. Add it to data-ownership.json "buckets" with an owner and purpose.`);
  else if (!calls.has(row.owner)) problems.push(`Storage bucket ${row.name}: owner ${row.owner} is not a registered agent call.`);
  const exception = ownership.exceptions[`bucket:${row.name}`];
  if (!row.writers.length && !exception?.noWriter) problems.push(`Storage bucket ${row.name}: nothing uploads to it. Record "exceptions.bucket:${row.name}.noWriter" with the reason, or archive the bucket.`);
  if (!row.readers.length && !exception?.noReader) problems.push(`Storage bucket ${row.name}: nothing reads from it. Record "exceptions.bucket:${row.name}.noReader" with the reason, or archive the bucket.`);
}
for (const row of switchRows) if (!row.readers.length && !ownership.exceptions[`switch:${row.path}`]) problems.push(`Feature switch ${row.path}: admins can flip it but no fan screen reads it. Wire it, archive it, or record "exceptions.switch:${row.path}" with the reason.`);
for (const name of Object.keys(ownership.buckets ?? {})) if (!bucketNames.includes(name)) problems.push(`data-ownership.json lists bucket ${name}, which no storage SQL defines. Remove the entry.`);
for (const name of Object.keys(ownership.tables)) if (!relationSet.has(name)) problems.push(`data-ownership.json lists ${name}, which is not in schema.sql. Remove the entry.`);
for (const name of Object.keys(ownership.exceptions)) if (!relationSet.has(name) && !(name.startsWith('bucket:') && bucketNames.includes(name.slice(7))) && !(name.startsWith('switch:') && switchRows.some((row) => row.path === name.slice(7)))) problems.push(`data-ownership.json exception ${name} is not in schema.sql. Remove it.`);
for (const row of fnRows) {
  if (!row.callers.length && !row.manual) problems.push(`function ${row.name}: nothing calls it. Archive it through a migration, or record "functions.${row.name}" with { owner, use } saying how it is used.`);
  if (!calls.has(row.owner)) problems.push(`function ${row.name}: owner ${row.owner} is not a registered agent call.`);
}
for (const name of Object.keys(ownership.functions)) if (!functionSet.has(name)) problems.push(`data-ownership.json lists function ${name}, which is not in schema.sql. Remove the entry.`);
const triageKey = (row) => `${row.file}#${row.name}`;
const triage = new Map(ownership.exportsTriage.map((row) => [triageKey(row), row]));
for (const row of deadExports) if (!triage.has(triageKey(row))) problems.push(`export ${row.name} in ${row.file}: nothing imports it. Use it, archive it, or add it to "exportsTriage" with a decision (keep | archive) and reason.`);
const deadKeys = new Set(deadExports.map(triageKey));
for (const row of ownership.exportsTriage) {
  if (!deadKeys.has(triageKey(row))) problems.push(`exportsTriage entry ${row.file}#${row.name} is stale (now used or gone). Remove it.`);
  if (!['keep', 'archive'].includes(row.decision) || !row.reason) problems.push(`exportsTriage entry ${row.file}#${row.name} needs decision keep | archive and a reason.`);
}

// Archive naming (archive/README.md): every file under a dated pass folder is `<stem>.archived.<ext>`, starts
// with an ARCHIVED header, and is covered by a registry entry; live code never imports from archive/.
const ARCHIVE_KINDS = ['whole file', 'export', 'helper', 'unused local', 'tests', 'database function', 'database table'];
const archiveFiles = fs.readdirSync(path.join(root, 'archive'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /-\d{4}-\d{2}-\d{2}$/.test(entry.name))
  .flatMap((entry) => fs.readdirSync(path.join(root, 'archive', entry.name), { recursive: true }).map((child) => `archive/${entry.name}/${String(child).split(path.sep).join('/')}`))
  .filter((file) => fs.statSync(path.join(root, file)).isFile());
const archivedTo = new Set((ownership.archived ?? []).map((row) => row.to));
for (const row of ownership.archived ?? []) {
  if (!fs.existsSync(path.join(root, row.to))) problems.push(`archived entry ${row.name} points at ${row.to}, which does not exist. Fix "to".`);
  if (!ARCHIVE_KINDS.includes(row.kind) || !row.reason || !row.approved) problems.push(`archived entry ${row.name} needs kind (${ARCHIVE_KINDS.join(' | ')}), a reason and who approved it.`);
}
for (const file of archiveFiles) {
  if (!/\.archived\.\w+$/.test(file)) problems.push(`${file}: archived files are named <name>.archived.<ext> (archive/README.md rule 3). Rename it and its registry "to".`);
  else if (!/^(\/\/|--) ARCHIVED \d{4}-\d{2}-\d{2} · /.test(read(file))) problems.push(`${file}: missing the ARCHIVED header (archive/README.md rule 4).`);
  if (!archivedTo.has(file)) problems.push(`${file}: no "archived" entry in data-ownership.json points at it. Add one per archived name.`);
}
for (const file of CODE_ROOTS.flatMap(walk)) if (/(?:from\s+|require\(|import\()\s*['"][^'"]*\barchive\//.test(read(file))) problems.push(`${file} imports from archive/. Archived code is reference only; restore it instead.`);

// ---------------------------------------------------------------- render
const list = (items, max = 6) => (items.length ? items.slice(0, max).map((item) => `\`${item}\``).join(', ') + (items.length > max ? ` +${items.length - max} more` : '') : '—');
const short = (file) => file.replace('apps/mobile/src/frontend/', '@/').replace('apps/admin-portal/', 'portal/').replace('packages/shared-types/', 'shared/');
const byOwner = new Map();
for (const row of lineage) { const key = row.owner ?? 'UNOWNED'; if (!byOwner.has(key)) byOwner.set(key, []); byOwner.get(key).push(row.name); }
const fnByOwner = new Map();
for (const row of fnRows) fnByOwner.set(row.owner, (fnByOwner.get(row.owner) ?? 0) + 1);
const archiveCount = ownership.exportsTriage.filter((row) => row.decision === 'archive').length;
const md = [
  '<!-- GENERATED by scripts/data-map.mjs from schema.sql, the source tree and docs/engineering/data-ownership.json. Do not edit by hand: change the registry or the code, then run `node scripts/data-map.mjs`. `pnpm check` fails when this file is stale. -->',
  '# Data map',
  '',
  'Owned by `DATA_GOVERNANCE` (lead) with `DATA_LINEAGE` (this map) and `CODE_HYGIENE` (dead code). How to use and change it: [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md).',
  '',
  '## Summary',
  '',
  '| Measure | Count |',
  '| --- | --- |',
  `| Tables | ${tables.length} |`,
  `| Views | ${views.length} |`,
  `| Storage buckets | ${bucketRows.length} |`,
  `| Feature switches read by the fan app | ${switchRows.filter((row) => row.readers.length).length} of ${switchRows.length} |`,
  `| Database functions | ${functions.length} (${fnRows.filter((row) => row.manual).length} used by hand, ${fnRows.filter((row) => row.callers.some((c) => c.startsWith('trigger:'))).length} trigger functions) |`,
  `| Tables reached by at least one screen or server route | ${lineage.filter((row) => row.screens.length).length} of ${relations.length} |`,
  `| Code files that read or write the database | ${new Set([...[...codeTable.values()].flatMap((e) => [...e.readers, ...e.writers]), ...[...codeRpc.values()].flatMap((s) => [...s])]).size} |`,
  `| Exported symbols nothing imports | ${deadExports.length} (${archiveCount} proposed for archive, ${deadExports.length - archiveCount} kept on purpose) |`,
  `| Rule failures | ${problems.length} |`,
  '',
  '## Owners',
  '',
  '| Owner | Tables and views | Functions |',
  '| --- | --- | --- |',
  ...[...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([owner, names]) => `| \`${owner}\` | ${names.map((n) => `\`${n}\``).join(', ')} | ${fnByOwner.get(owner) ?? 0} |`),
  '',
  '## Tables and views',
  '',
  'Writers and readers are app / portal / Edge Function files that call the table directly, then database functions that write or read it. Screens are Expo routes (`/…`), portal pages (`portal:/…`) and server routes (`edge:…`, `/api/…`) that reach those files through imports or call those functions.',
  '',
  ...lineage.flatMap((row) => [
    `### \`${row.name}\`${row.kind === 'view' ? ' (view)' : ''}`,
    '',
    `**Owner:** \`${row.owner ?? 'UNOWNED'}\` · ${row.purpose ?? 'no purpose recorded'}`,
    '',
    `- Written by: ${list(row.writers.map(short))}; database functions: ${list(row.sqlWriters)}`,
    `- Read by: ${list(row.readers.map(short))}; database functions: ${list(row.sqlReaders)}`,
    ...(row.removers.length ? [`- Removed by: ${list(row.removers.map(short))}`] : []),
    ...(row.triggers.length ? [`- Triggers: ${list(row.triggers)}`] : []),
    `- Screens: ${list(row.screens, 10)}`,
    ...(ownership.exceptions[row.name] ? [`- Exception: ${Object.entries(ownership.exceptions[row.name]).map(([k, v]) => `${k} — ${v}`).join('; ')}`] : []),
    '',
  ]),
  '## Storage buckets',
  '',
  '| Bucket | Owner | Purpose | Uploaded by | Read by | Screens |',
  '| --- | --- | --- | --- | --- | --- |',
  ...bucketRows.map((row) => `| \`${row.name}\` | \`${row.owner ?? 'UNOWNED'}\` | ${row.purpose ?? '—'} | ${list(row.writers.map(short))} | ${list(row.readers.map(short))} | ${list(row.screens, 6)} |`),
  '',
  '## Feature switches',
  '',
  'Published app switches an admin can flip (Features and Look desks). Each must be read by a fan surface.',
  '',
  '| Switch | Read by |',
  '| --- | --- |',
  ...switchRows.map((row) => `| \`${row.path}\` | ${list(row.readers.map(short), 4)} |`),
  '',
  '## Database functions',
  '',
  '| Function | Owner | Called by | Writes | Reads |',
  '| --- | --- | --- | --- | --- |',
  ...fnRows.map((row) => `| \`${row.name}\` | \`${row.owner}\` | ${row.manual ? `By hand: ${row.manual}` : list(row.callers.map(short), 3)} | ${list(row.writes, 3)} | ${list(row.reads, 3)} |`),
  '',
  '## Exported symbols nothing imports (CODE_HYGIENE triage)',
  '',
  'Nothing is deleted (owner rule): `archive` means the code moves to `archive/` after owner approval; `keep` means it stays on purpose.',
  '',
  '| File | Export | Decision | Reason |',
  '| --- | --- | --- | --- |',
  ...deadExports.map((row) => { const t = triage.get(triageKey(row)); return `| \`${short(row.file)}\` | \`${row.name}\` | ${t?.decision ?? '**untriaged**'} | ${t?.reason ?? ''} |`; }),
  '',
  '## Rule failures',
  '',
  ...(problems.length ? problems.map((problem) => `- ${problem}`) : ['None.']),
  '',
].join('\n');

const topology = `${JSON.stringify({
  version: 1,
  basis: 'Registered ownership and static code/SQL references; hosted delivery is not verified.',
  roles: JSON.parse(read('.claude/agents/registry.json')).agents.map((agent) => ({
    id: agent.call, department: agent.department, lead: agent.lead,
    paths: agent.owns.filter((file) => /^(apps|packages|supabase)\//.test(file)),
  })).sort((a, b) => a.id.localeCompare(b.id)),
  sources: lineage,
  functions: fnRows,
  buckets: bucketRows,
  switches: switchRows,
}, null, 2)}\n`;

if (check) {
  const current = fs.existsSync(path.join(root, OUT)) ? read(OUT) : '';
  if (problems.length) {
    console.error(`data:map found ${problems.length} problem(s):\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
    process.exit(1);
  }
  if (current !== md) {
    console.error(`data:map: ${OUT} is out of date. Run \`node scripts/data-map.mjs\` and commit the result.`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(root, TOPOLOGY_OUT)) || read(TOPOLOGY_OUT) !== topology) {
    console.error(`data:map: ${TOPOLOGY_OUT} is out of date. Run node scripts/data-map.mjs.`);
    process.exit(1);
  }
  console.log(`data:map ok (${tables.length} tables, ${views.length} views, ${bucketRows.length} buckets, ${switchRows.length} switches, ${functions.length} functions, ${deadExports.length} triaged exports; every item owned and connected)`);
} else {
  fs.writeFileSync(path.join(root, OUT), md);
  fs.writeFileSync(path.join(root, TOPOLOGY_OUT), topology);
  console.log(`Wrote ${OUT}: ${relations.length} tables/views, ${functions.length} functions, ${deadExports.length} unimported exports, ${problems.length} rule failure(s).`);
  if (problems.length) for (const problem of problems.slice(0, 80)) console.log(`- ${problem}`);
}
