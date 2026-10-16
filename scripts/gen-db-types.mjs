#!/usr/bin/env node
/**
 * Generate TypeScript database types from the canonical schema, locally (PORTABILITY.md §4 row 7). Builds
 * `apps/mobile/src/backend/db/schema.sql` into an empty PGlite (Postgres compiled to WebAssembly, loaded from outside
 * the repo like scripts/replay/schema-replay.mjs, on the same Supabase stubs), reads the `public` schema back from the
 * catalogue and writes `apps/mobile/src/frontend/types/database.generated.ts` in the shape `supabase gen types
 * typescript` produces. No Supabase CLI, no hosted database. Output is sorted and carries no timestamp, so it only
 * changes when the schema does.
 *
 *   node scripts/gen-db-types.mjs <pglite dist dir>           write the file
 *   node scripts/gen-db-types.mjs <pglite dist dir> --check   exit 1 when the file is out of date
 *
 * The hand-written `types/database.ts` stays the app's typed-client source for now; the drift test
 * (`types/__tests__/databaseDrift.test.ts`) compares it against this file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './replay/supabase-stubs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const dist = args.find((arg) => !arg.startsWith('--'));
if (!dist) { console.error('usage: node scripts/gen-db-types.mjs <pglite dist dir> [--check]'); process.exit(2); }
const SCHEMA = 'apps/mobile/src/backend/db/schema.sql';
const OUT = 'apps/mobile/src/frontend/types/database.generated.ts';

const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib', 'pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
try { await db.exec(fs.readFileSync(path.join(root, SCHEMA), 'utf8')); }
catch (e) { console.error(`gen-db-types: schema.sql did not build — ${e.message}`); process.exit(1); }
const rows = async (sql) => (await db.query(sql)).rows;

// ---------------------------------------------------------------- catalogue
// Every type in the database, so a column, argument or return type resolves without another query.
const types = new Map((await rows(`
  select t.oid::int as oid, t.typname as name, n.nspname as schema, t.typtype as kind, t.typcategory as category,
         t.typelem::int as elem, t.typbasetype::int as base, t.typrelid::int as relid,
         coalesce((select array_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid), '{}') as labels
  from pg_type t join pg_namespace n on n.oid = t.typnamespace`)).map((t) => [t.oid, t]));

const relations = await rows(`
  select c.oid::int as oid, c.relname as name, c.relkind as kind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  order by c.relname`);
const relationKind = new Map(relations.map((r) => [r.oid, r.kind]));
const relationName = new Map(relations.map((r) => [r.oid, r.name]));

const columns = await rows(`
  select a.attrelid::int as rel, a.attname as name, a.atttypid::int as type, a.attnotnull as notnull,
         (a.atthasdef or a.attidentity <> '') as has_default, a.attgenerated <> '' as generated
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm') and a.attnum > 0 and not a.attisdropped`);

// Functions the project wrote (extension functions such as pgcrypto's live in `extensions` on Supabase); triggers are
// not callable over the API, so they are left out like the Supabase generator does.
const functions = await rows(`
  select p.proname as name, p.prorettype::int as ret, p.proretset as setof, p.pronargs::int as nargs,
         p.pronargdefaults::int as ndefaults, p.proargtypes::int[] as in_types,
         p.proallargtypes::int[] as all_types, p.proargmodes::text[] as modes, p.proargnames as names,
         pg_get_function_identity_arguments(p.oid) as identity
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  order by p.proname, identity`);

// ---------------------------------------------------------------- type mapping
const STRING = new Set(['text', 'varchar', 'bpchar', 'char', 'name', 'citext', 'uuid', 'date', 'time', 'timetz', 'timestamp',
  'timestamptz', 'interval', 'bytea', 'inet', 'cidr', 'macaddr', 'macaddr8']);
const NUMBER = new Set(['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'oid', 'money']);
const key = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));

/** The TypeScript type for a Postgres type oid. */
function tsType(oid) {
  const t = types.get(oid);
  if (!t) return 'unknown';
  if (t.kind === 'd') return tsType(t.base); // domain → its base type
  if (t.category === 'A' && t.elem) { const inner = tsType(t.elem); return /^[\w"[\]]+$/.test(inner) ? `${inner}[]` : `(${inner})[]`; }
  if (t.kind === 'e') return t.labels.map((label) => JSON.stringify(label)).join(' | ') || 'string';
  if (t.kind === 'c' && relationKind.has(t.relid)) {
    const group = ['v', 'm'].includes(relationKind.get(t.relid)) ? 'Views' : 'Tables';
    return `Database["public"]["${group}"]["${relationName.get(t.relid)}"]["Row"]`;
  }
  if (t.name === 'bool') return 'boolean';
  if (t.name === 'json' || t.name === 'jsonb') return 'Json';
  if (t.name === 'void') return 'undefined';
  if (NUMBER.has(t.name)) return 'number';
  if (STRING.has(t.name)) return 'string';
  return 'unknown';
}
const orNull = (type) => (type === 'unknown' ? type : `${type} | null`);

// ---------------------------------------------------------------- render
const byRel = new Map();
for (const c of columns) (byRel.get(c.rel) ?? byRel.set(c.rel, []).get(c.rel)).push(c);
for (const list of byRel.values()) list.sort((a, b) => (a.name < b.name ? -1 : 1));
const block = (indent, lines) => (lines.length ? `{\n${lines.map((line) => `${' '.repeat(indent + 2)}${line}`).join('\n')}\n${' '.repeat(indent)}}` : '{}');

const tableLines = [];
const viewLines = [];
for (const rel of relations) {
  const cols = byRel.get(rel.oid) ?? [];
  if (['v', 'm'].includes(rel.kind)) {
    // Postgres does not track nullability through a view, so every view column may be null (as Supabase's output).
    viewLines.push(`${key(rel.name)}: ${block(6, [`Row: ${block(8, cols.map((c) => `${key(c.name)}: ${orNull(tsType(c.type))}`))}`])}`);
    continue;
  }
  const row = cols.map((c) => `${key(c.name)}: ${c.notnull ? tsType(c.type) : orNull(tsType(c.type))}`);
  const insert = cols.map((c) => {
    if (c.generated) return `${key(c.name)}?: never`;
    const type = c.notnull ? tsType(c.type) : orNull(tsType(c.type));
    return `${key(c.name)}${!c.notnull || c.has_default ? '?' : ''}: ${type}`;
  });
  const update = cols.map((c) => (c.generated ? `${key(c.name)}?: never` : `${key(c.name)}?: ${c.notnull ? tsType(c.type) : orNull(tsType(c.type))}`));
  tableLines.push(`${key(rel.name)}: ${block(6, [`Row: ${block(8, row)}`, `Insert: ${block(8, insert)}`, `Update: ${block(8, update)}`, 'Relationships: []'])}`);
}

/** `{ Args; Returns }` for one function signature, its closing brace at `indent` spaces. */
function signature(fn, indent) {
  const all = fn.all_types ?? fn.in_types;
  const modes = fn.modes ?? all.map(() => 'i');
  const names = fn.names ?? [];
  const inputs = [];
  const outputs = [];
  all.forEach((oid, i) => {
    const mode = modes[i];
    if (['i', 'b', 'v'].includes(mode)) inputs.push({ name: names[i] || '', oid });
    if (['o', 'b', 't'].includes(mode)) outputs.push({ name: names[i] || `column${i + 1}`, oid });
  });
  const firstDefault = inputs.length - fn.ndefaults;
  const argLines = inputs.map((arg, i) => `${key(arg.name)}${i >= firstDefault ? '?' : ''}: ${tsType(arg.oid)}`);
  const argsType = argLines.length ? block(indent + 2, argLines) : 'Record<PropertyKey, never>';
  let returns;
  if (outputs.length) {
    const shape = block(indent + 2, outputs.map((o) => `${key(o.name)}: ${tsType(o.oid)}`));
    returns = fn.setof ? `${shape}[]` : shape;
  } else {
    const inner = tsType(fn.ret);
    returns = fn.setof ? (/^[\w"[\]]+$/.test(inner) ? `${inner}[]` : `(${inner})[]`) : inner;
  }
  return block(indent, [`Args: ${argsType}`, `Returns: ${returns}`]);
}
const fnGroups = new Map();
for (const fn of functions) (fnGroups.get(fn.name) ?? fnGroups.set(fn.name, []).get(fn.name)).push(fn);
const functionLines = [...fnGroups.entries()].map(([name, overloads]) => {
  // Overloads become a union of signatures, as in Supabase's output.
  if (overloads.length === 1) return `${key(name)}: ${signature(overloads[0], 6)}`;
  return `${key(name)}:\n${overloads.map((fn) => `        | ${signature(fn, 10)}`).join('\n')}`;
});

const output = `/**
 * GENERATED by scripts/gen-db-types.mjs from apps/mobile/src/backend/db/schema.sql — do not edit by hand.
 * Regenerate: node scripts/gen-db-types.mjs <pglite dist dir>. Same shape as \`supabase gen types typescript\`, built
 * locally on PGlite. The app still types its client from the hand-written ./database.ts; the drift test in
 * ./__tests__/databaseDrift.test.ts checks that file against this one.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: ${block(4, tableLines)}
    Views: ${block(4, viewLines)}
    Functions: ${block(4, functionLines)}
    Enums: {}
    CompositeTypes: {}
  }
}
`;
await db.close();

const outPath = path.join(root, OUT);
const counts = `${tableLines.length} tables, ${viewLines.length} views, ${fnGroups.size} functions (${functions.length} signatures)`;
if (check) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current !== output) {
    console.error(`gen-db-types: ${OUT} is out of date with schema.sql. Run: node scripts/gen-db-types.mjs <pglite dist dir>`);
    process.exit(1);
  }
  console.log(`gen-db-types ok (${counts})`);
} else {
  fs.writeFileSync(outPath, output);
  console.log(`Wrote ${OUT}: ${counts}`);
}
