/** Content fingerprints and AST callsites support exit maintenance; dynamic targets require owner review. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const ROOTS = ['apps', 'packages', 'supabase', 'scripts', 'infrastructure', 'patches', '.github'];
const FILES = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'app.json', '.npmrc', '.dockerignore', 'docs/engineering/exit-map.json'];
const IGNORE = new Set(['node_modules', '.git', '.next', '.expo', '.smoke', '.tmp', '.temp', '.superpowers', 'dist', 'out', 'web-build', 'ios', 'android', 'coverage', '__pycache__', '.terraform', 'upstream', '.DS_Store']);
// Local Expo/tooling files that appear after `expo start` but never in CI install+typecheck; hashing them
// made security:infra / exit:map stale on GitHub while the same commit passed on a developer machine.
const IGNORE_FILES = new Set(['expo-env.d.ts']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.sql', '.py', '.tf', '.yml', '.yaml', '.toml', '.sh', '.patch', '.css', '.scss', '.html', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.wasm', '.ttf', '.otf', '.woff', '.woff2', '.md', '.service', '.timer', '.npmrc']);
const ADAPTER_METHODS = new Set(['publicUrl', 'upload', 'sign', 'list', 'remove']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
/** Binary path order so content hashes match across locales (localeCompare is not stable for CI). */
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const reviewers = kind => kind.startsWith('auth.') ? ['EXIT_SERVICES', 'AUTH', 'SESSION_SECURITY']
  : kind.startsWith('storage.') ? ['EXIT_SERVICES', 'STORAGE', 'RECOVERY']
  : kind.startsWith('realtime.') ? ['EXIT_SERVICES', 'REALTIME']
  : kind.startsWith('functions.') ? ['EXIT_SERVICES', 'API', 'SECURITY']
  : ['EXIT_DATABASE', 'DATABASE_MIGRATIONS', 'RLS_SECURITY'];

function safeScope(relative) {
  const parts = relative.split('/');
  const basename = parts[parts.length - 1] ?? '';
  return !IGNORE_FILES.has(basename)
    && !parts.some((part, index) => IGNORE.has(part) || part.startsWith('.env')
    || /^(?:credentials?|secrets?|runtime-cache|customer-data|backups?|exports?|logs?|cache)(?:[._-]|$)/i.test(part)
      && !(parts[0] === 'infrastructure' && parts[1] === 'backup' && (index === 1 || index === 2 && part === 'backup.py')))
    && !/\.(?:env|local|secret|credentials|tfstate|tfplan|age|pem|key|p8|p12|jks|sqlite|db|dump|log)(?:\.|$)/i.test(relative)
    && !relative.endsWith('.tfvars') && !relative.endsWith('/settings.local.json');
}

function area(file) {
  if (file === 'docs/engineering/exit-map.json') return 'mapping';
  if (file.includes('/db/') || file.startsWith('supabase/migrations/')) return 'database';
  if (file.startsWith('supabase/functions/')) return 'services';
  if (file.startsWith('infrastructure/')) return 'toolkit';
  if (file.startsWith('apps/') || file.startsWith('packages/')) return 'application';
  return 'build';
}

function unwrap(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
    || ts.isNonNullExpression(node) || ts.isAwaitExpression(node))) node = node.expression;
  return node;
}

/** Syntactic provenance is deliberately bounded: unknown imports/clients remain explicit review candidates. */
export function sdkCallsites(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const aliases = new Map(), factories = new Set(['getSupabaseBrowserClient', 'getSupabaseServerClient']), wrappers = new Set(), adapters = new Set();
  const constants = new Map(), parameterNames = new Set(), aliasSchemas = new Map(), bindingCounts = new Map();
  const nodes = [];
  const visit = node => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const registerBinding = name => {
    if (ts.isIdentifier(name)) bindingCounts.set(name.text, (bindingCounts.get(name.text) ?? 0) + 1);
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) if (ts.isBindingElement(element)) registerBinding(element.name);
    }
  };
  for (const node of nodes) {
    if (ts.isVariableDeclaration(node)) registerBinding(node.name);
    if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) registerBinding(node.name);
    if (ts.isImportClause(node) && node.name) registerBinding(node.name);
  }
  // Duplicate lexical bindings need a scope/type checker to resolve exactly. Fail conservative, never inherit an outer value.
  const ambiguous = name => (bindingCounts.get(name) ?? 0) > 1;
  const parameterBinding = node => {
    if (!ts.isIdentifier(node)) return null;
    for (let scope = node.parent; scope; scope = scope.parent) {
      if (ts.isFunctionLike(scope)) for (const parameter of scope.parameters) {
        if (ts.isIdentifier(parameter.name) && parameter.name.text === node.text) return parameter;
      }
    }
    return null;
  };
  const isFactory = node => factories.has(node.getText(tree)) && !ambiguous(node.getText(tree)) && !parameterBinding(node);
  // The media adapter takes the bucket as its first argument; only the imported binding or a parameter typed as the adapter counts.
  const isAdapter = node => {
    if (!ts.isIdentifier(node) || ambiguous(node.text)) return false;
    const parameter = parameterBinding(node);
    return parameter ? Boolean(parameter.type && /\bMediaStorageAdapter\b/.test(parameter.type.getText(tree))) : adapters.has(node.text);
  };
  const literal = node => {
    node = unwrap(node);
    if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return node.text;
    if (node && ts.isIdentifier(node) && constants.has(node.text) && !parameterNames.has(node.text) && !ambiguous(node.text)) return constants.get(node.text);
    return null;
  };
  const chain = node => {
    node = unwrap(node);
    if (!node) return [];
    if (ts.isIdentifier(node)) {
      const parameter = parameterBinding(node);
      if (parameter) return parameter.type && /\bSupabaseClient\b/.test(parameter.type.getText(tree)) ? ['<supabase>'] : [node.text];
      if (ambiguous(node.text)) return [node.text];
      return aliases.get(node.text) ?? [node.text];
    }
    if (ts.isPropertyAccessExpression(node)) return [...chain(node.expression), node.name.text];
    if (ts.isElementAccessExpression(node)) return [...chain(node.expression), literal(node.argumentExpression) ?? '<dynamic-method>'];
    if (ts.isCallExpression(node)) {
      if (isFactory(node.expression)) return ['<supabase>'];
      const origin = chain(node.expression), method = origin.at(-1);
      // Auth/function responses are data. Only builders, buckets and channels carry client provenance onward.
      if (origin.includes('auth') || origin.includes('functions') || origin.includes('storage') && method !== 'from') return [];
      return origin;
    }
    return [];
  };
  const schemaContext = node => {
    node = unwrap(node);
    if (!node) return { schema: null, schemaResolution: 'not-applicable' };
    if (ts.isIdentifier(node)) return !parameterBinding(node) && aliasSchemas.has(node.text) ? aliasSchemas.get(node.text)
      : { schema: 'public', schemaResolution: 'default' };
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return schemaContext(node.expression);
    if (ts.isCallExpression(node)) {
      if (chain(node.expression).at(-1) === 'schema') {
        const schema = literal(node.arguments[0]);
        return { schema, schemaResolution: schema === null ? 'dynamic' : 'literal' };
      }
      return schemaContext(node.expression);
    }
    return { schema: null, schemaResolution: 'not-applicable' };
  };
  for (const node of nodes) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const module = node.moduleSpecifier.text;
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
        const exported = binding.propertyName?.text ?? binding.name.text;
        if (module.includes('supabase') && exported === 'createClient') factories.add(binding.name.text);
        if (exported === 'supabase' && /supabase/.test(module)) aliases.set(binding.name.text, ['<supabase>']);
        if (/^getSupabase.*Client$/.test(exported)) factories.add(binding.name.text);
        if (['callRpc', 'untypedRpc'].includes(exported) && /(?:^|\/)rpc$/.test(module)) wrappers.add(binding.name.text);
        if (exported === 'mediaStorage' && /(?:^|\/)mediaStorage$/.test(module)) adapters.add(binding.name.text);
      }
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      parameterNames.add(node.name.text);
    }
  }
  // A few local fixed-point passes cover client aliases and constants without pretending to resolve runtime values.
  for (let pass = 0; pass < 4; pass++) for (const node of nodes) {
    if (!ts.isVariableDeclaration(node) || !node.initializer) continue;
    const origin = chain(node.initializer);
    if (ts.isIdentifier(node.name)) {
      if (origin[0] === '<supabase>' || node.type && /\bSupabaseClient\b/.test(node.type.getText(tree))) {
        aliases.set(node.name.text, origin[0] === '<supabase>' ? origin : ['<supabase>']);
        aliasSchemas.set(node.name.text, schemaContext(node.initializer));
      }
      if (node.parent.flags & ts.NodeFlags.Const) {
        const value = literal(node.initializer);
        if (value !== null) constants.set(node.name.text, value);
      }
    } else if (ts.isObjectBindingPattern(node.name) && origin[0] === '<supabase>') {
      for (const entry of node.name.elements) if (ts.isIdentifier(entry.name)) aliases.set(entry.name.text, [...origin, entry.propertyName?.getText(tree) ?? entry.name.text]);
    }
  }
  const result = [];
  for (const node of nodes) {
    if (!ts.isCallExpression(node)) continue;
    const parts = chain(node.expression), method = parts.at(-1), resolved = parts[0] === '<supabase>';
    if (!parts.length || isFactory(node.expression)) continue;
    const wrapperCandidate = ts.isIdentifier(node.expression) && wrappers.has(node.expression.text);
    const isWrapper = wrapperCandidate && !ambiguous(node.expression.text) && !parameterBinding(node.expression);
    let kind, target = null, needsTarget = false, schema = null, schemaResolution = 'not-applicable', via = null;
    const callee = unwrap(node.expression);
    const adapterCall = ts.isPropertyAccessExpression(callee) && ADAPTER_METHODS.has(callee.name.text) && isAdapter(unwrap(callee.expression));
    if (adapterCall) {
      kind = 'storage.from'; needsTarget = true; via = `MediaStorageAdapter.${callee.name.text}`;
    } else if (wrapperCandidate) {
      kind = 'database.rpc'; needsTarget = true;
    } else if (parts.includes('auth')) kind = 'auth.' + parts.slice(parts.indexOf('auth') + 1).join('.');
    else if (parts.includes('storage')) { kind = 'storage.' + method; needsTarget = method === 'from'; }
    else if (parts.includes('functions')) { kind = 'functions.' + method; needsTarget = method === 'invoke'; }
    else if (parts.includes('channel') || method === 'channel') { kind = 'realtime.' + method; needsTarget = method === 'channel' || method === 'on'; }
    else if (['from', 'rpc', 'schema'].includes(method) && !['Array', 'Buffer', 'Object', 'Uint8Array'].includes(parts[0])) { kind = 'database.' + method; needsTarget = true; }
    else if (resolved) kind = 'database.' + method;
    else continue;
    if (needsTarget) target = literal(node.arguments[0]);
    if (kind.startsWith('database.')) ({ schema, schemaResolution } = schemaContext(node.expression));
    if (kind === 'realtime.on' && target === 'postgres_changes') {
      target = null;
      const options = unwrap(node.arguments[1]);
      if (options && ts.isObjectLiteralExpression(options)) for (const prop of options.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = ts.isIdentifier(prop.name) ? prop.name.text : literal(prop.name);
        if (key === 'table') target = literal(prop.initializer);
        if (key === 'schema') { schema = literal(prop.initializer); schemaResolution = schema === null ? 'dynamic' : 'literal'; }
      }
    }
    const clientResolution = resolved || isWrapper || adapterCall ? 'resolved' : 'unresolved';
    const targetResolution = needsTarget ? target === null ? 'dynamic' : 'literal' : 'not-applicable';
    const methodResolution = parts.includes('<dynamic-method>') ? 'dynamic' : 'literal';
    const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    result.push({ path: file, line: position.line + 1, column: position.character + 1, kind, target, schema, schemaResolution,
      clientResolution, targetResolution, methodResolution,
      reviewRequired: clientResolution === 'unresolved' || targetResolution === 'dynamic' || schemaResolution === 'dynamic' || methodResolution === 'dynamic', reviewers: reviewers(kind),
      ...(via ? { via } : {}) });
  }
  return result.sort((a, b) => a.line - b.line || a.column - b.column || a.kind.localeCompare(b.kind));
}

/** Hash current safe source bytes; output contains identifiers/hashes/callsites, never file contents or env values. */
export function collectExitInventory(root) {
  root = fs.realpathSync(root);
  const sourceFiles = [], callsites = [], sourceText = new Map();
  function walk(relative) {
    if (!safeScope(relative)) return;
    // Explicit nested mapping inputs must receive the same ancestor checks as recursive source roots.
    const ancestors = relative.split('/');
    for (let count = 1; count < ancestors.length; count++) {
      const ancestor = ancestors.slice(0, count).join('/');
      const entry = fs.lstatSync(path.join(root, ancestor), { throwIfNoEntry: false });
      if (!entry) return;
      if (entry.isSymbolicLink()) throw new Error(`Source ancestor symlink is forbidden: ${ancestor}`);
      if (!entry.isDirectory()) throw new Error(`Unsupported source ancestor: ${ancestor}`);
    }
    const absolute = path.join(root, relative);
    const info = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!info) return;
    if (info.isSymbolicLink()) throw new Error(`Source symlink is forbidden: ${relative}`);
    if (info.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) walk(`${relative}/${name}`);
      return;
    }
    if (!info.isFile()) throw new Error(`Unsupported source entry: ${relative}`);
    const basename = path.basename(relative);
    if (!FILES.includes(relative) && !EXTENSIONS.has(path.extname(relative)) && !/^(?:Dockerfile(?:\.[a-z]+)?|Caddyfile(?:\.[a-z-]+)?|CODEOWNERS|\.terraform\.lock\.hcl)$/.test(basename)) return;
    if (info.size > 32 * 1024 * 1024 || sourceFiles.length >= 20_000) throw new Error('Exit source inventory size/file limit exceeded');
    const bytes = fs.readFileSync(absolute), after = fs.statSync(absolute);
    if (info.size !== bytes.length || info.mtimeMs !== after.mtimeMs) throw new Error('Source changed during exit inventory; retry after edits settle');
    sourceFiles.push({ path: relative, size: bytes.length, sha256: sha(bytes), area: area(relative) });
    if (/\.(?:tsx?|[cm]?js|sql)$/.test(relative)) sourceText.set(relative, bytes.toString('utf8'));
    if (/\.(?:tsx?|[cm]?js)$/.test(relative) && /^(?:apps|packages|supabase\/functions)\//.test(relative)
      && !relative.includes('/__tests__/') && !/\.test\.[^.]+$/.test(relative)) callsites.push(...sdkCallsites(bytes.toString('utf8'), relative));
  }
  for (const relative of [...ROOTS, ...FILES]) walk(relative);
  sourceFiles.sort(byPath);
  callsites.sort((a, b) => byPath(a, b) || a.line - b.line || a.column - b.column || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  const inventory = staticInventory(sourceFiles, sourceText, callsites);
  const contentHash = sha(JSON.stringify(sourceFiles));
  const unresolvedCalls = callsites.filter(site => site.reviewRequired);
  return { schemaVersion: 1, format: 'tapuai-exit-source/1', planVersion: contentHash.slice(0, 12), contentHash,
    sourceFiles, sourceHash: contentHash, calls: callsites, callsites, inventory,
    unresolvedCalls, reviewRequiredCallsites: unresolvedCalls,
    limitations: ['Syntax-based callsites are candidates, not a proof of runtime coverage.', 'Dynamic targets and unresolved client origins need owner review.', 'Live catalog, provider configuration and installed-client compatibility remain separate evidence.'] };
}

/** Names remain a planning aid; contentHash, live catalogs and unresolved-call review provide separate evidence. */
function staticInventory(files, sources, calls) {
  const schema = (sources.get('apps/mobile/src/backend/db/schema.sql') ?? '').split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  const code = [...sources].filter(([file]) => /^(?:apps|packages|supabase\/functions)\//.test(file)
    && !file.includes('/__tests__/') && !/\.test\./.test(file) && !file.endsWith('.sql')).map(([, text]) => text).join('\n');
  const uniq = values => [...new Set(values)].sort();
  const managed = new Set(['auth', 'storage', 'realtime']);
  const qualified = (scope, name) => `${scope ?? 'public'}.${name}`;
  const names = (regex, filter = () => true) => uniq([...schema.matchAll(regex)].map(match => qualified(match[1]?.toLowerCase(), match[2].toLowerCase()))).filter(filter);
  const app = name => !managed.has(name.split('.')[0]);
  const policyRefs = [...schema.matchAll(/create policy\s+("(?:[^"]|"")+"|[a-z_0-9]+)\s+on\s+(?:"?([a-z_]+)"?\.)?"?([a-z_]+)"?/gi)]
    .map(m => `${qualified(m[2]?.toLowerCase(), m[3].toLowerCase())}: ${m[1].replace(/^"|"$/g, '')}`);
  const triggerRefs = [...schema.matchAll(/create (?:or replace )?(?:constraint )?trigger\s+"?([a-z_0-9]+)"?[\s\S]{0,400}?\bon\s+(?:"?([a-z_]+)"?\.)?"?([a-z_]+)"?/gi)]
    .map(m => `${qualified(m[2]?.toLowerCase(), m[3].toLowerCase())}: ${m[1].toLowerCase()}`);
  const targets = kind => uniq(calls.filter(c => c.kind === kind && c.targetResolution === 'literal' && c.clientResolution === 'resolved').map(c => c.target));
  return {
    schemas: uniq([...schema.matchAll(/create schema (?:if not exists )?"?([a-z_]+)"?/gi)].map(m => m[1].toLowerCase())).filter(s => !managed.has(s) && s !== 'extensions'),
    tables: names(/create table (?:if not exists )?(?:"?([a-z_]+)"?\.)?"?([a-z_]+)"?/gi, app),
    views: names(/create (?:or replace )?(?:materialized )?view (?:if not exists )?(?:"?([a-z_]+)"?\.)?"?([a-z_]+)"?/gi),
    functions: names(/create (?:or replace )?function (?:"?([a-z_]+)"?\.)?"?([a-z_0-9]+)"?\s*\(/gi, app),
    policies: uniq(policyRefs.filter(app)), triggers: uniq(triggerRefs.filter(app)),
    attachments: uniq([...policyRefs.filter(p => !app(p)).map(p => `policy ${p}`), ...triggerRefs.filter(p => !app(p)).map(p => `trigger ${p}`)]),
    extensions: uniq([...schema.matchAll(/create extension (?:if not exists )?"?([a-z_]+)"?/gi)].map(m => m[1].toLowerCase())),
    realtimeTables: names(/alter publication supabase_realtime add table (?:"?([a-z_]+)"?\.)?"?([a-z_]+)"?/gi),
    buckets: uniq([...schema.matchAll(/bucket_id\s*=\s*'([a-z_]+)'/g), ...schema.matchAll(/insert into storage\.buckets[^;]*?values\s*\(\s*'([a-z_]+)'/gi)].map(m => m[1])),
    migrations: files.filter(f => /^supabase\/migrations\/\d{14}_.+\.sql$/.test(f.path)).map(f => path.basename(f.path)).sort(),
    edgeFunctions: uniq(files.filter(f => /^supabase\/functions\/[^_][^/]*\//.test(f.path)).map(f => f.path.split('/')[2])),
    apiRoutes: uniq(files.filter(f => /^apps\/mobile\/app\/api\/.+\+api\.ts$/.test(f.path)).map(f => f.path.replace(/^apps\/mobile\/app\/api\//, '').replace(/\+api\.ts$/, ''))),
    authMethods: uniq(calls.filter(c => c.kind.startsWith('auth.') && c.methodResolution === 'literal').map(c => c.kind.slice(5))),
    rpcCalls: targets('database.rpc'), tableCalls: targets('database.from'), storageBuckets: targets('storage.from'),
    channelNames: targets('realtime.channel'), functionInvokes: targets('functions.invoke'),
    oauthProviders: uniq([...code.matchAll(/provider:\s*'([a-z]+)'/g)].map(m => m[1])),
    realtimeUse: uniq([/postgres_changes/.test(code) && 'postgres_changes', /['"]broadcast['"]/.test(code) && 'broadcast', /private:\s*true/.test(code) && 'private channels', /['"]presence['"]/.test(code) && 'presence'].filter(Boolean)),
    publicEnv: uniq([...code.matchAll(/process\.env\.((?:EXPO_PUBLIC|NEXT_PUBLIC)_[A-Z0-9_]+)/g)].map(m => m[1])),
    serverEnv: uniq([...code.matchAll(/(?:process\.env\.|Deno\.env\.get\(\s*['"])([A-Z][A-Z0-9_]+)/g)].map(m => m[1])).filter(name => !/^(EXPO_PUBLIC|NEXT_PUBLIC)_/.test(name) && name !== 'NODE_ENV'),
    toolkit: files.filter(f => f.path.startsWith('infrastructure/') && !f.path.includes('/tests/')).map(f => f.path),
    sourceFingerprints: files.map(f => `${f.path} ${f.sha256}`),
    sdkCallsites: calls.map(c => JSON.stringify(c)),
  };
}
