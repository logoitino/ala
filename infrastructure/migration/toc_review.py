#!/usr/bin/env python3
"""Propose a reviewed pg_restore list for restoring a Supabase dump into a new compatible Supabase stack.

`restore.py` refuses to run without a reviewed list (`--use-list`) and accepts only two edits to the dump's
own TOC: dropping a line or commenting it out with `;`. This tool writes exactly that: every original line,
kept verbatim or commented with a reason. It is a proposal for DATABASE_MIGRATIONS / RLS_SECURITY review,
not an approval. Anything it does not recognise is commented out and reported (fail closed).

Why entries are left out by default:
- Supabase-managed schemas (auth, storage, realtime, extensions, vault, graphql, ...) are created by the
  target stack at its own pinned versions. What the app attaches to those tables (policies on storage.objects,
  the signup trigger on auth.users, realtime policies) IS restored: with `--target-fingerprint` (the bare target
  stack, fingerprinted before the restore) anything the stack lacks is kept; without it these entries need review. `supabase_migrations` is the exception: it is migration history
  the target does not create, so it is restored. Re-creating them from the source would fight the target's
  migrations and ownership.
- Storage bucket and object rows are recreated by `restore.py --storage` through the Storage API, which also
  copies the file bytes. Restoring the rows as well would duplicate or orphan them.
- Auth users / identities / MFA factors are opt-in (`--include-auth-data`): they carry credentials and need the
  same Auth version and signing keys on the target. Without them, any public foreign key that references
  `auth.users` fails, so this tool blocks that combination when given the source parity fingerprint.
- Full Auth state is a separate explicit opt-in (`--include-all-auth-data`), requiring complete source/bare-target
  fingerprints, matching detected tables/service functions and empty or exactly matching target Auth data. This includes
  sessions, tokens and flows; version/key/schema/session compatibility still needs independent review.

Exit status: 0 = proposal written with nothing left to review; 2 = written, but entries need a human decision;
1 = refused (a blocking problem, such as app tables missing from the dump).
"""
import argparse
import json
import os
from pathlib import Path
import re
import sys

MANAGED_SCHEMAS = {
    'auth', 'storage', 'realtime', '_realtime', 'extensions', 'graphql', 'graphql_public', 'vault',
    'pgsodium', 'pgsodium_masks', 'supabase_functions', 'net', 'pgbouncer', 'cron',
    'pgtle', '_analytics', 'topology', 'tiger', 'tiger_data',
}
# Narrow legacy opt-in; full Auth state has its own guarded proposal and independent compatibility review.
AUTH_DATA_TABLES = {'users', 'identities', 'mfa_factors'}

# Multi-word descriptors first so "TABLE DATA" is not read as "TABLE".
DESCRIPTORS = sorted([
    'TABLE DATA', 'FK CONSTRAINT', 'CHECK CONSTRAINT', 'SEQUENCE SET', 'SEQUENCE OWNED BY', 'DEFAULT ACL', 'ROW SECURITY',
    'MATERIALIZED VIEW DATA', 'MATERIALIZED VIEW', 'PUBLICATION TABLES IN SCHEMA', 'PUBLICATION TABLE',
    'EVENT TRIGGER', 'INDEX ATTACH', 'FOREIGN TABLE', 'USER MAPPING', 'LARGE OBJECT', 'BLOB METADATA',
    'TEXT SEARCH CONFIGURATION', 'TEXT SEARCH DICTIONARY', 'FOREIGN DATA WRAPPER', 'SERVER', 'STATISTICS',
    'TABLE', 'SEQUENCE', 'INDEX', 'CONSTRAINT', 'TRIGGER', 'POLICY', 'FUNCTION', 'PROCEDURE', 'AGGREGATE',
    'VIEW', 'TYPE', 'DOMAIN', 'DEFAULT', 'RULE', 'COMMENT', 'ACL', 'SCHEMA', 'EXTENSION', 'PUBLICATION',
    'SUBSCRIPTION', 'CAST', 'COLLATION', 'CONVERSION', 'OPERATOR', 'BLOB', 'DATABASE', 'ENCODING',
    'STDSTRINGS', 'SEARCHPATH',
], key=len, reverse=True)

# Object kinds that belong to the application and restore normally inside an application schema.
APP_KINDS = {
    'TABLE', 'TABLE DATA', 'SEQUENCE', 'SEQUENCE SET', 'SEQUENCE OWNED BY', 'INDEX', 'INDEX ATTACH',
    'CONSTRAINT', 'FK CONSTRAINT', 'CHECK CONSTRAINT', 'TRIGGER', 'POLICY', 'ROW SECURITY', 'FUNCTION', 'PROCEDURE', 'AGGREGATE',
    'VIEW', 'MATERIALIZED VIEW', 'MATERIALIZED VIEW DATA', 'TYPE', 'DOMAIN', 'DEFAULT', 'RULE', 'COMMENT',
    'ACL', 'PUBLICATION TABLE', 'STATISTICS',
}
# Header entries pg_restore emits for every archive; harmless to keep.
HEADER_KINDS = {'ENCODING', 'STDSTRINGS', 'SEARCHPATH'}

ENTRY = re.compile(r'^(\d+);\s+(\d+)\s+(\d+)\s+(.*)$')
IDENT = re.compile(r'[a-z_][a-z0-9_]*')


def parse(line):
    """Split one `pg_restore --list` line into id, descriptor, schema and the remaining tag/owner text."""
    match = ENTRY.match(line.rstrip())
    if not match:
        return None
    rest = match.group(4)
    for desc in DESCRIPTORS:
        if rest == desc or rest.startswith(desc + ' '):
            tail = rest[len(desc):].strip()
            schema, _, tag = tail.partition(' ')
            return {'id': int(match.group(1)), 'desc': desc, 'schema': schema, 'tag': tag.strip(), 'line': line.rstrip()}
    return {'id': int(match.group(1)), 'desc': None, 'schema': None, 'tag': rest, 'line': line.rstrip()}


def object_schema(entry):
    """The schema an entry really belongs to. COMMENT/ACL on a schema or extension carry '-' as namespace."""
    if entry['schema'] != '-':
        return entry['schema']
    words = entry['tag'].split()
    if entry['desc'] in ('COMMENT', 'ACL') and len(words) >= 2 and words[0] == 'SCHEMA':
        return words[1]
    if entry['desc'] == 'SCHEMA' and words:
        return words[0]
    return '-'


def table_name(entry):
    """First word of the tag is the table for TABLE / TABLE DATA entries."""
    return entry['tag'].split(' ')[0] if entry['tag'] else ''


def target_has_schema(schema, target):
    """public exists in every PostgreSQL; other application schemas exist only if the target fingerprint shows them."""
    if target is None:
        return schema == 'public'
    return schema in target.get('meta', {}).get('schemas', [])


def service_object(entry, target):
    """Policy/trigger/function inside a Supabase schema: stack-provided if the bare target already has it."""
    desc, schema = entry['desc'], entry['schema']
    if target is None:
        return 'review', (f'{desc} on a Supabase table: app-defined or stack-provided? '
                          'Pass --target-fingerprint (bare target stack) to decide automatically')
    service = target.get('service', {})
    if desc == 'FUNCTION':
        name = entry['tag'].split('(')[0]
        if any(f.startswith(f'{schema}.{name}(') for f in service.get('functions', [])):
            return 'exclude', 'the target stack already provides this function'
        return 'review', 'function in a Supabase schema that the target stack lacks (app-defined, or a stack version gap)'
    table, _, name = entry['tag'].partition(' ')
    name = name.rsplit(' ', 1)[0] if name.count(' ') else name
    attached = service.get('attachments', {}).get(f'{schema}.{table}')
    if attached is None:
        return 'review', f'{schema}.{table} does not exist on the target stack'
    existing = attached.get('policies' if desc == 'POLICY' else 'triggers', {})
    if name in existing:
        return 'exclude', 'the target stack already has it'
    return 'keep', 'app-defined on a Supabase table (Storage access rule, signup trigger, realtime policy)'


def classify(entry, app_schemas, include_auth, target=None, all_auth_tables=None, preserved_auth_tables=None, auth_sequences=None):
    """Return (decision, reason). decision is keep, exclude or review."""
    desc = entry['desc']
    if desc is None:
        return 'review', 'unrecognised TOC descriptor'
    if desc in HEADER_KINDS:
        return 'keep', 'archive header'
    schema = object_schema(entry)
    words = entry['tag'].split()

    if desc == 'SCHEMA':
        if schema == 'supabase_migrations':
            return 'keep', 'migration history schema; self-hosted targets do not create it'
        if schema in app_schemas:
            if target_has_schema(schema, target):
                return 'exclude', 'target already has this schema; recreating it fails'
            return 'keep', 'application schema the target does not have yet'
        if schema in MANAGED_SCHEMAS:
            return 'exclude', 'Supabase-managed schema; the target stack creates it at its own version'
        return 'review', 'schema is neither an application schema nor a known Supabase schema'
    if desc in ('COMMENT', 'ACL') and words[:1] == ['SCHEMA'] and schema in app_schemas:
        if target_has_schema(schema, target):
            # The target stack owns and grants its own public schema; a restoring non-owner would fail here.
            return 'exclude', 'schema comment/privileges belong to the target stack; parity compares object grants'
        return 'keep', 'privileges on an application schema this restore creates'
    if desc == 'EXTENSION' or (desc == 'COMMENT' and words[:1] == ['EXTENSION']):
        return 'exclude', 'extensions are installed by the target stack; parity checks they exist'
    if desc == 'EVENT TRIGGER':
        return 'exclude', 'Supabase-managed event trigger'
    if desc == 'PUBLICATION':
        return 'exclude', 'the target stack creates supabase_realtime; table membership restores separately'
    if desc == 'DEFAULT ACL':
        return 'review', 'default privileges name roles that may differ on the target; compare and apply by hand'
    if desc in ('DATABASE', 'SUBSCRIPTION', 'USER MAPPING', 'SERVER', 'FOREIGN DATA WRAPPER'):
        return 'review', 'cluster-level or external object; not part of an application restore'
    if desc in ('BLOB', 'LARGE OBJECT', 'BLOB METADATA'):
        return 'review', 'large objects are not used by the app; confirm before restoring'

    if schema == 'supabase_migrations':
        # Migration history: self-hosted Supabase does not create it, and `migration repair` / the E1 baseline
        # depend on it. A target that already has the schema (another managed project) keeps only TABLE DATA.
        if desc in ('SCHEMA', 'TABLE', 'TABLE DATA', 'CONSTRAINT', 'INDEX', 'ACL', 'COMMENT'):
            return 'keep', 'migration history (if the target already has supabase_migrations, keep only TABLE DATA)'
        return 'review', f'{desc} in supabase_migrations is unexpected'
    if schema in MANAGED_SCHEMAS:
        if desc == 'SEQUENCE SET' and schema == 'auth' and auth_sequences is not None:
            sequence = auth_sequences.get('auth.' + table_name(entry))
            if sequence is None:
                return 'exclude', 'Auth sequence is not in the complete detected opt-in inventory'
            if sequence['action'] == 'preserve-target-state':
                return 'exclude', 'Auth sequence target is already ahead; preserve state without replaying a lower source SET'
            return 'keep', 'Detected Auth sequence state (explicit opt-in); target sequence DDL remains intact'
        if desc == 'TABLE DATA' and schema == 'auth' and all_auth_tables is not None:
            if 'auth.' + table_name(entry) in all_auth_tables:
                if 'auth.' + table_name(entry) in (preserved_auth_tables or set()):
                    return 'exclude', 'Auth rows already exact on target (count and row digest); preserve without duplicate import'
                return 'keep', 'All detected Auth rows (explicit opt-in): independent version/key/schema/session review required'
            return 'exclude', 'Auth table is not in the complete detected opt-in inventory'
        if desc == 'TABLE DATA' and schema == 'auth' and table_name(entry) in AUTH_DATA_TABLES:
            if include_auth:
                return 'keep', 'Auth rows (opt-in): needs the same Auth version, keys and an independent review'
            return 'exclude', 'Auth rows not requested (--include-auth-data)'
        if desc == 'TABLE DATA' and schema == 'storage' and table_name(entry) in ('buckets', 'objects'):
            return 'exclude', 'restore.py --storage recreates buckets and objects through the Storage API'
        if desc in ('POLICY', 'TRIGGER', 'FUNCTION'):
            return service_object(entry, target)
        return 'exclude', 'object inside a Supabase-managed schema'

    if schema in app_schemas:
        if desc in APP_KINDS:
            return 'keep', 'application object'
        return 'review', f'{desc} in an application schema is unusual'
    return 'review', f'schema {schema!r} is not in scope (--schemas) and not Supabase-managed'


def cross_check(entries, decisions, fingerprint, include_auth):
    """Compare the proposal with the source parity fingerprint. Returns a list of blocking problems."""
    problems = []
    kept = {(e['desc'], e['schema'], table_name(e)) for e, (d, _) in zip(entries, decisions) if d == 'keep'}
    for key, body in sorted(fingerprint.get('tables', {}).items()):
        schema, _, name = key.partition('.')
        if body.get('kind') not in ('r', 'p'):
            continue
        if ('TABLE', schema, name) not in kept:
            problems.append(f'{key}: table definition missing from the dump or not selected')
        if ('TABLE DATA', schema, name) not in kept:
            problems.append(f'{key}: table rows missing from the dump or not selected')
        if not include_auth:
            for con, definition in sorted(body.get('constraints', {}).items()):
                if 'REFERENCES auth.' in definition:
                    problems.append(f'{key}.{con} references Auth ({definition}); add --include-auth-data or pre-load matching Auth users')
    return problems


def full_auth_scope(fingerprint, target):
    """Validate a local proposal only; never prepare/delete target data or execute SQL."""
    import parity
    problems = []
    for label, data in [('source', fingerprint), ('bare target', target)]:
        if (not isinstance(data, dict) or data.get('format') != parity.FORMAT
                or not parity.coverage_complete(data)):
            problems.append(f'All Auth opt-in requires a complete exact service/Auth fingerprint for {label}')
            continue
        meta = data.get('meta', {})
        if meta.get('bypassRls') is not True and meta.get('superuser') is not True:
            problems.append(f'All Auth opt-in requires unfiltered read coverage for {label}')
        connection = data.get('connectionIdentity')
        if (not isinstance(connection, dict) or set(connection) != {'PGHOST', 'PGPORT', 'PGDATABASE'}
                or any(not isinstance(value, str) or not value for value in connection.values())):
            problems.append(f'All Auth opt-in requires a recorded database connection identity for {label}')
    if problems:
        return set(), set(), {}, problems
    source_tables = set(fingerprint['coverage']['authData']['detectedAuthTables'])
    target_tables = set(target['coverage']['authData']['detectedAuthTables'])
    if source_tables != target_tables:
        problems.append('All Auth opt-in requires identical detected source/target Auth table sets')
    if any(not IDENT.fullmatch(table.removeprefix('auth.')) for table in source_tables | target_tables):
        problems.append('All Auth table identifiers require a separately reviewed quoted-identifier procedure')
    if fingerprint['connectionIdentity'] == target['connectionIdentity']:
        problems.append('All Auth opt-in requires a distinct isolated bare target connection')
    if fingerprint['service']['functions'] != target['service']['functions']:
        problems.append('All Auth opt-in requires identical service function definitions, security, owners and grants')
    if not parity.service_tables_compatible(fingerprint, target):
        problems.append('All Auth opt-in requires identical service table definitions, columns, constraints, owners and grants')
    sequence_plan = parity.auth_sequence_plan(fingerprint, target)
    if not sequence_plan['compatible']:
        problems.append('All Auth opt-in requires compatible complete detected Auth sequence definitions and captured state')
    sequences = {entry['key']: entry for entry in sequence_plan['sequences']}
    if any(not IDENT.fullmatch(key.removeprefix('auth.')) for key in sequences):
        problems.append('Auth sequence identifiers require a separately reviewed quoted-identifier procedure')
    preserved = {table for table in source_tables & target_tables if target['rows'][table]['count'] > 0
                 and all(target['rows'][table][key] == fingerprint['rows'][table][key] for key in ('count', 'digest'))}
    conflicting = sorted(table for table in target_tables if target['rows'][table]['count'] > 0 and table not in preserved)
    if conflicting:
        problems.append('Conflicting Auth target rows already exist: ' + ', '.join(conflicting)
                        + '; independently review isolated target preparation and recapture; no deletion is automatic')
    return (source_tables if not problems else set()), (preserved if not problems else set()), (sequences if not problems else {}), problems


def propose(toc_text, app_schemas, include_auth, fingerprint=None, target=None, include_all_auth_data=False):
    full_tables, preserved_tables, auth_sequences, full_problems = full_auth_scope(fingerprint, target) if include_all_auth_data else (None, set(), None, [])
    if include_all_auth_data and include_auth:
        full_problems.append('Choose narrow --include-auth-data or full --include-all-auth-data, not both')
    lines = toc_text.splitlines()
    entries, decisions, output = [], [], []
    for line in lines:
        entry = parse(line)
        if entry is None:
            # Comments and blank lines from pg_restore stay as they were.
            output.append(line.rstrip())
            continue
        decision = classify(entry, app_schemas, include_auth, target, full_tables, preserved_tables, auth_sequences)
        entries.append(entry)
        decisions.append(decision)
        if decision[0] == 'keep':
            output.append(entry['line'])
        else:
            output.append(f';{decision[0].upper()} ({decision[1]}) {entry["line"]}')
    problems = full_problems + (cross_check(entries, decisions, fingerprint, include_auth or include_all_auth_data) if fingerprint else [])
    if include_all_auth_data and not full_problems:
        data_entries = [entry for entry in entries if entry['schema'] == 'auth' and entry['desc'] == 'TABLE DATA']
        for table in sorted(full_tables):
            count = sum('auth.' + table_name(entry) == table for entry in data_entries)
            if count != 1:
                problems.append(f'{table}: full Auth TABLE DATA entry must appear exactly once in the original TOC (found {count})')
        for entry in data_entries:
            if 'auth.' + table_name(entry) not in full_tables:
                problems.append('Undetected Auth TABLE DATA requires independent review: ' + entry['line'])
        sequence_entries = [entry for entry in entries if entry['schema'] == 'auth' and entry['desc'] == 'SEQUENCE SET']
        for key in sorted(auth_sequences):
            count = sum('auth.' + table_name(entry) == key for entry in sequence_entries)
            if count != 1:
                problems.append(f'{key}: detected Auth SEQUENCE SET must appear exactly once in original TOC (found {count})')
        for entry in sequence_entries:
            if 'auth.' + table_name(entry) not in auth_sequences:
                problems.append('Undetected Auth SEQUENCE SET requires independent review: ' + entry['line'])
        # Pre-import stack compatibility excludes only source-restored migration history.
        # That exception cannot silently omit the original schema/table/data records.
        missing_history = {key for key, body in fingerprint['service']['tables'].items()
                           if key.startswith('supabase_migrations.') and body['kind'] in ('r', 'p')
                           and key not in target['service']['tables']}
        for key in sorted(missing_history):
            schema, name = key.split('.', 1)
            for descriptor in ('TABLE', 'TABLE DATA'):
                count = sum(entry['schema'] == schema and table_name(entry) == name and entry['desc'] == descriptor
                            for entry in entries)
                if count != 1:
                    problems.append(f'{key}: missing target history requires exactly one original {descriptor} entry (found {count})')
        if missing_history and not any(key.startswith('supabase_migrations.') for key in target['service']['tables']):
            count = sum(entry['desc'] == 'SCHEMA' and object_schema(entry) == 'supabase_migrations' for entry in entries)
            if count != 1:
                problems.append('Missing target migration history requires exactly one original supabase_migrations SCHEMA entry')
    summary = {'keep': 0, 'exclude': 0, 'review': 0}
    for decision, _ in decisions:
        summary[decision] += 1
    review = [{'line': e['line'], 'reason': r} for e, (d, r) in zip(entries, decisions) if d == 'review']
    extensions = sorted({e['tag'].split(' ')[0] for e in entries if e['desc'] == 'EXTENSION'})
    return {
        'list': '\n'.join(output) + '\n',
        'summary': summary,
        'review': review,
        'blocking': problems,
        'extensionsRequiredOnTarget': extensions,
        'authDataIncluded': include_auth or include_all_auth_data,
        'allAuthDataIncluded': include_all_auth_data and not problems,
        'allAuthTables': sorted(full_tables or []),
        'preservedAuthTables': sorted(preserved_tables),
        'allAuthSequences': sorted(auth_sequences or {}),
        'preservedAuthSequences': sorted(key for key, entry in (auth_sequences or {}).items()
                                         if entry['action'] == 'preserve-target-state'),
        'authSequencePlan': [entry for _, entry in sorted((auth_sequences or {}).items())],
        'crossChecked': bool(fingerprint),
        'targetChecked': bool(target),
        'schemas': sorted(app_schemas),
    }


def report_markdown(result):
    s = result['summary']
    out = ['# Proposed restore list — review before use', '',
           f"Kept {s['keep']}, excluded {s['exclude']}, needs review {s['review']}. "
           f"Auth rows included: {'yes' if result['authDataIncluded'] else 'no'}. "
           f"Cross-checked with source fingerprint: {'yes' if result['crossChecked'] else 'no'}; "
           f"with bare target stack: {'yes' if result['targetChecked'] else 'no'}. "
           f"Application schemas: {', '.join(result['schemas'])}.", '']
    if result['blocking']:
        out += ['## Blocking', ''] + [f'- {p}' for p in result['blocking']] + ['']
    if result.get('allAuthDataIncluded'):
        out += ['## Explicit full Auth data proposal', '',
                'Includes all detected Auth table data, including sessions/tokens/flows and service migration rows. '
                'No Auth service DDL is replaced. Independently review target table columns/constraints, GoTrue '
                'version, keys, session semantics and restore order; matching function fingerprints alone do not prove login compatibility.', '']
        if result['preservedAuthTables']:
            out += ['Existing target Auth rows preserved by exact count/hash match: '
                    + ', '.join(result['preservedAuthTables']) + '.', '']
        if result['allAuthSequences']:
            out += ['Detected Auth sequence state reviewed: ' + ', '.join(result['allAuthSequences']) + '.',
                    'Already-ahead target sequences preserved: ' + (', '.join(result['preservedAuthSequences']) or 'none') + '.', '']
    if result['review']:
        out += ['## Needs a decision (commented out until a reviewer uncomments it)', '']
        out += [f"- `{r['line']}` — {r['reason']}" for r in result['review']] + ['']
    if result['extensionsRequiredOnTarget']:
        out += ['## Extensions the target must already have', '',
                ', '.join(result['extensionsRequiredOnTarget']), '']
    out += ['This is a proposal. DATABASE_MIGRATIONS and RLS_SECURITY accept it; the parity check after the restore proves it.', '']
    return '\n'.join(out)


def write_private(path, text):
    """Lists and reports describe the source schema; keep them owner-only like other restore artifacts."""
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'backup'))
    from common import external_path
    path = external_path(path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(text)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--toc', required=True, help='database.toc from the verified restore stage')
    parser.add_argument('--out', required=True, help='new file for the proposed list (must not exist)')
    parser.add_argument('--report', help='new Markdown report file (must not exist)')
    parser.add_argument('--schemas', help='comma list of application schemas (default: the source fingerprint\'s, else public)')
    auth = parser.add_mutually_exclusive_group()
    auth.add_argument('--include-auth-data', action='store_true', help='keep only auth.users / identities / mfa_factors rows (legacy narrow mode)')
    auth.add_argument('--include-all-auth-data', action='store_true', help='propose every detected Auth TABLE DATA entry; complete compatible source/bare-target fingerprints required')
    parser.add_argument('--source-fingerprint', help='parity fingerprint of the source; checks every app table is in the list')
    parser.add_argument('--target-fingerprint', help='parity fingerprint of the bare target stack, taken before the restore')
    args = parser.parse_args(argv)

    fingerprint = json.loads(Path(args.source_fingerprint).read_text()) if args.source_fingerprint else None
    target = json.loads(Path(args.target_fingerprint).read_text()) if args.target_fingerprint else None
    default = ','.join(fingerprint['meta']['schemas']) if fingerprint and fingerprint.get('meta') else 'public'
    schemas = {s.strip() for s in (args.schemas or default).split(',') if s.strip()}
    if fingerprint and fingerprint.get('meta') and schemas != set(fingerprint['meta']['schemas']):
        parser.error('--schemas differs from the source fingerprint: ' + ', '.join(fingerprint['meta']['schemas']))
    if not schemas or any(not IDENT.fullmatch(s) for s in schemas):
        parser.error('--schemas must be plain lower-case schema names')
    if schemas & MANAGED_SCHEMAS:
        parser.error('Supabase-managed schemas cannot be application schemas: ' + ', '.join(sorted(schemas & MANAGED_SCHEMAS)))
    result = propose(Path(args.toc).read_text(), schemas, args.include_auth_data, fingerprint, target, args.include_all_auth_data)
    if result['blocking']:
        print(report_markdown(result), file=sys.stderr)
        print('Refused: fix the blocking items; no list written.', file=sys.stderr)
        return 1
    write_private(args.out, result['list'])
    if args.report:
        write_private(args.report, report_markdown(result))
    print(json.dumps({k: result[k] for k in ('summary', 'schemas', 'extensionsRequiredOnTarget', 'authDataIncluded', 'allAuthDataIncluded', 'allAuthTables', 'preservedAuthTables', 'allAuthSequences', 'preservedAuthSequences', 'crossChecked', 'targetChecked')}))
    return 2 if result['review'] else 0


if __name__ == '__main__':
    sys.exit(main())
