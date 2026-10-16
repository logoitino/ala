/**
 * Drift guard between the hand-written database types (`types/database.ts`, which the app's typed client uses) and the
 * types generated from schema.sql (`types/database.generated.ts`, written by scripts/gen-db-types.mjs). PORTABILITY.md
 * §4 row 7: until the generated file replaces the hand-written one, every column the app's types claim must exist in
 * the schema, so a query typed against a missing column is caught here instead of failing at runtime.
 *
 * It asks the TypeScript checker for the property names of each `Database['public']['Tables'][t]['Row']` (and each
 * view's Row) in both files, so named row aliases, intersections and shared-package types resolve as tsc sees them.
 * KNOWN_DRIFT lists the mismatches that are deliberate or not yet safe to fix, each with a reason; an entry that stops
 * drifting must be removed, so the list only shrinks.
 */
import path from 'node:path';
import ts from 'typescript';

const typesDir = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(typesDir, '../../..');
const HAND = path.join(typesDir, 'database.ts');
const GENERATED = path.join(typesDir, 'database.generated.ts');

/**
 * `<Tables|Views>.<relation>.<column>` (or `<Tables|Views>.<relation>` for a whole relation) → why it is allowed.
 * Columns here are declared by the hand-written types but are not in schema.sql.
 */
const KNOWN_DRIFT: Record<string, string> = {
  // `Player.team_name` is a legacy fallback read after `school_name` and `team` (OperatorRosterModal, data/players,
  // lib/reels); no schema column, so it is always undefined. Removing it means editing those three readers.
  'Tables.players.team_name': 'legacy fallback field; readers outside database.ts still reference it',
  // `Profile.team` is the hydrated `schools_and_teams` row the client attaches for the trading card, not a column.
  'Tables.profiles.team': 'client-hydrated join, not a column',
  // One `Reel` type serves both the `reels` table and the `reels_feed` view. These three are computed by the view
  // (photo cover, uploader credit) and only ever selected from reels_feed.
  'Tables.reels.cover_path': 'reels_feed-only column in the shared Reel type',
  'Tables.reels.uploader_avatar_url': 'reels_feed-only column in the shared Reel type',
  'Tables.reels.uploader_name': 'reels_feed-only column in the shared Reel type',
  // ...and these two are written on insert to `reels` but not exposed by the view (no feed query selects them).
  'Views.reels_feed.attested_at': 'reels-only column in the shared Reel type (insert-time rights record)',
  'Views.reels_feed.rights_version': 'reels-only column in the shared Reel type (insert-time rights record)',
};

type Shape = Map<string, Set<string>>; // relation → Row column names

/** Reads `Database['public'][group]` from one file as relation → Row property names. */
function readGroup(checker: ts.TypeChecker, file: ts.SourceFile, group: 'Tables' | 'Views'): Shape {
  const moduleSymbol = checker.getSymbolAtLocation(file);
  const database = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === 'Database');
  if (!database) throw new Error(`${file.fileName} exports no Database type`);
  const member = (type: ts.Type, name: string): ts.Type => {
    const property = checker.getPropertyOfType(type, name);
    if (!property) throw new Error(`${file.fileName}: no "${name}" in ${checker.typeToString(type)}`);
    return checker.getTypeOfSymbolAtLocation(property, file);
  };
  const relations = member(member(checker.getDeclaredTypeOfSymbol(database), 'public'), group);
  const shape: Shape = new Map();
  for (const relation of checker.getPropertiesOfType(relations)) {
    const row = member(checker.getTypeOfSymbolAtLocation(relation, file), 'Row');
    const names = checker.getPropertiesOfType(row).map((column) => column.name);
    // A Row that failed to resolve (an `any` from a broken import) has no properties and would hide all drift.
    if (names.length === 0) throw new Error(`${file.fileName}: ${group}.${relation.name}.Row has no columns (did a type fail to resolve?)`);
    shape.set(relation.name, new Set(names));
  }
  return shape;
}

/** Everything the hand-written file declares that the generated file does not have. */
function drift(): string[] {
  const configPath = path.join(mobileRoot, 'tsconfig.json');
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, mobileRoot);
  const program = ts.createProgram([HAND, GENERATED], { ...config.options, noEmit: true });
  const checker = program.getTypeChecker();
  const hand = program.getSourceFile(HAND);
  const generated = program.getSourceFile(GENERATED);
  if (!hand || !generated) throw new Error('database.ts or database.generated.ts did not load');
  const found: string[] = [];
  for (const group of ['Tables', 'Views'] as const) {
    const schema = readGroup(checker, generated, group);
    for (const [relation, columns] of readGroup(checker, hand, group)) {
      const real = schema.get(relation);
      if (!real) { found.push(`${group}.${relation}`); continue; }
      for (const column of columns) if (!real.has(column)) found.push(`${group}.${relation}.${column}`);
    }
  }
  return found.sort();
}

describe('hand-written database types vs schema.sql', () => {
  let found: string[] = [];
  // Building a TypeScript program over both files takes a few seconds.
  beforeAll(() => { found = drift(); }, 120_000);

  it('declares no table, view or column the schema does not have (outside KNOWN_DRIFT)', () => {
    // Fix the type in database.ts, or add the column to the schema with a migration; allowlist only with a reason.
    expect(found.filter((entry) => !(entry in KNOWN_DRIFT))).toEqual([]);
  });

  it('keeps KNOWN_DRIFT current (remove entries that no longer drift)', () => {
    expect(Object.keys(KNOWN_DRIFT).filter((entry) => !found.includes(entry))).toEqual([]);
  });
});
