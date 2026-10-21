#!/usr/bin/env python3
"""Prove a restored database matches its source: structure, security rules, sequences and every row.

Two steps, run by an operator on the private recovery host:

  parity.py fingerprint --env-file /etc/tapuai/source.env --out source.json
  parity.py fingerprint --env-file /etc/tapuai/target.env --out target.json
  parity.py compare source.json target.json --report parity.md
  parity.py grant-sync source.json target.json --out grants.sql   # when compare reports grant drift

`fingerprint` runs `catalog.sql` and the row query it generates inside ONE read-only repeatable-read
transaction, so counts, hashes and catalog describe the same instant. It writes nothing to the database.
Connection rules are the backup tools' rules (named PG* fields, verify-full TLS for remote hosts).

`compare` exits 1 when anything blocks a cutover: a missing table/function/policy, a changed or extra
policy, row level security switched off, a changed anon/authenticated grant, a security definer function
that lost its search_path or owner, a sequence behind the source (the next insert would collide), a
realtime table missing from the publication, different row counts or row hashes, or migration history
the target lacks, a table that shows a guest, signed-in user or admin different rows (access parity:
the app's own view through RLS), or a policy/trigger the app attached to a Supabase table (Storage access rules, the signup
trigger on auth.users, realtime policies) missing after the restore. Owners, extra indexes and version drift
are warnings for application objects. Exact service table shapes/owners/grants and service function
definitions/settings/security/grants must match the pinned stack; service version differences block.
All nonextension Auth tables are feature-detected and always row-hashed, including sessions and MFA.
A clean compare proves database
parity only; Storage bytes, Auth sign-in, provider settings and clients are checked separately.

Take the source fingerprint at the same quiesced moment as the backup (write freeze), otherwise row
differences are expected and the compare is evidence of drift, not of a faulty restore.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'backup'))

FORMAT = 'tapuai-parity/1'
AUTH_REQUIRED = {'auth.users', 'auth.identities', 'auth.mfa_factors'}
SERVICE_REQUIRED = {'auth', 'storage', 'realtime'}
EXACT_FUNCTION_FIELDS = ('definition', 'returns', 'language', 'bodyMd5', 'binary', 'strict', 'leakproof',
                         'parallel', 'securityDefiner', 'config', 'volatility', 'kind', 'owner', 'execute', 'grants')
EXACT_SERVICE_TABLE_FIELDS = ('kind', 'owner', 'rls', 'forceRls', 'columns', 'constraints', 'indexes',
                              'definition', 'grants', 'privilegeDetails')
AUTH_SEQUENCE_PREFIX = 'auth-sequence:'
AUTH_SEQUENCE_FIELDS = ('dataType', 'start', 'increment', 'min', 'max', 'cache', 'cycle', 'owner', 'ownedBy', 'grants', 'stateRowKey')
EXPOSED_ROLES = {'anon', 'authenticated', 'PUBLIC'}
IDENT = re.compile(r'[a-z_][a-z0-9_]*')

# Session settings that make row text (and so row hashes) identical across servers. An empty search_path makes
# policy/trigger/default expressions print fully schema-qualified, whatever the connecting role's own path is.
# row_security is pinned on: a session left with it off (pg_restore sets that) makes RLS reads fail instead of filter.
STABLE_TEXT = (
    "set local search_path = '';\n"
    "set local row_security = on;\n"
    "set local timezone = 'UTC';\n"
    "set local datestyle = 'ISO, YMD';\n"
    "set local intervalstyle = 'postgres';\n"
    "set local extra_float_digits = 3;\n"
    "set local bytea_output = 'hex';\n"
)


def catalog_query():
    """catalog.sql as one expression (no trailing semicolon) so it can be wrapped."""
    text = (HERE / 'catalog.sql').read_text().strip()
    return text[:-1] if text.endswith(';') else text


def psql_script(schemas, hash_rows, access=True):
    """One psql session: read-only snapshot (catalog + rows), then access parity in a rolled-back transaction."""
    scope = (f"set local tapuai.parity_schemas = '{','.join(schemas)}';\n"
             f"set local tapuai.parity_hash_rows = '{'on' if hash_rows else 'off'}';\n")
    access_part = ('begin transaction isolation level repeatable read;\n' + STABLE_TEXT + scope +
                   (HERE / 'access.sql').read_text() + '\nrollback;\n') if access else ''
    return (
        '\\set ON_ERROR_STOP on\n'
        'begin transaction isolation level repeatable read read only;\n'
        + STABLE_TEXT +
        f"set local tapuai.parity_schemas = '{','.join(schemas)}';\n"
        f"set local tapuai.parity_hash_rows = '{'on' if hash_rows else 'off'}';\n"
        "select (fingerprint - 'rows_sql')::text as catalog, fingerprint->>'rows_sql' as rows_sql\n"
        f'from ({catalog_query()}) f \\gset\n'
        "select (:'catalog'::jsonb || jsonb_build_object('rows', coalesce((select jsonb_object_agg(r.key, "
        "jsonb_build_object('count', r.row_count, 'digest', r.digest)) from (:rows_sql) r), '{}'::jsonb)))::text;\n"
        'commit;\n'
        + access_part
    )


def fingerprint(args):
    from common import load_env, postgres_env, private_file  # noqa: F401 — same connection rules as backup
    schemas = [s.strip() for s in args.schemas.split(',') if s.strip()]
    if not schemas or any(not IDENT.fullmatch(s) for s in schemas):
        raise ValueError("--schemas must be 'auto' or plain lower-case schema names")
    if not shutil.which('psql'):
        raise ValueError('Install psql (PostgreSQL client) on the operator host')
    env = postgres_env(load_env(args.env_file))
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as script:
        script.write(psql_script(schemas, not args.no_row_hash, not args.no_access))
        script_path = script.name
    try:
        result = subprocess.run(['psql', '--no-password', '--no-psqlrc', '--quiet', '--tuples-only', '--no-align',
                                 '--file', script_path], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    finally:
        os.unlink(script_path)
    if result.returncode != 0:
        # Server messages can quote identifiers, never data or secrets; still keep them short.
        raise RuntimeError('psql failed: ' + result.stderr.decode(errors='replace').strip().splitlines()[-1][:300])
    out = result.stdout.decode().splitlines()
    lines = [line for line in out if line.strip().startswith('{')]
    if len(lines) != 1:
        raise RuntimeError('Unexpected psql output; expected one fingerprint line')
    data = json.loads(lines[0])
    # Bind the evidence to the explicit verified libpq endpoint, without persisting a user/password or URI.
    data['connectionIdentity'] = {'PGHOST': env['PGHOST'], 'PGPORT': str(int(env.get('PGPORT', '5432'))),
                                  'PGDATABASE': env['PGDATABASE']}
    if not args.no_access:
        arrays = [line for line in out if line.strip().startswith('[')]
        if len(arrays) != 1:
            raise RuntimeError('Unexpected psql output; expected one access line')
        data['access'] = json.loads(arrays[0])
    write_private(args.out, json.dumps(data, indent=1, sort_keys=True) + '\n')
    print(json.dumps({'tables': len(data['tables']), 'functions': len(data['functions']), 'rowTargets': len(data['rows']),
                      'accessReads': len(data.get('access', [])), 'hashRows': data['meta']['hashRows']}))
    return 0


def write_private(path, text):
    """Fingerprints carry schema, row counts and migration history: owner-only, new file, outside the checkout."""
    from common import external_path
    path = external_path(path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(text)


TOKEN = re.compile(r"'(?:[^']|'')*'|\"(?:[^\"]|\"\")*\"|[A-Za-z_][A-Za-z0-9_$]*|\d+(?:\.\d+)?|::|[<>!=]=|<>|\S")


def _group(tokens, start=0):
    """Nest tokens on parentheses: returns (items, next index). A nested list is one parenthesised group."""
    items, i = [], start
    while i < len(tokens):
        tok = tokens[i]
        if tok == '(':
            inner, i = _group(tokens, i + 1)
            items.append(inner)
        elif tok == ')':
            return items, i + 1
        else:
            items.append(tok)
            i += 1
    return items, i


def _ops(items):
    return {t.upper() for t in items if isinstance(t, str) and t.upper() in ('AND', 'OR')}


def _flatten(items):
    """Inline a bracketed AND-chain inside an AND-chain (and OR inside OR). Same meaning; it is what a re-parse does."""
    items = [_flatten(t) if isinstance(t, list) else t for t in items]
    while len(items) == 1 and isinstance(items[0], list):   # ((x)) -> x
        items = items[0]
    out, outer = [], _ops(items)
    for i, tok in enumerate(items):
        prev = items[i - 1] if i else None
        # A group right after a word or ')' is a call/cast argument list (char_length(...), ANY (...)): keep it.
        standalone = isinstance(tok, list) and (prev is None or (isinstance(prev, str) and prev.upper() in ('AND', 'OR')))
        if standalone and len(outer) == 1 and _ops(tok) == outer:
            out.extend(tok)
        else:
            out.append(tok)
    return out


def _render(items):
    return ' '.join('(' + _render(t) + ')' if isinstance(t, list) else t for t in items)


def canonical_expr(text):
    """Expression text with same-operator AND/OR nesting flattened, for comparing a dump with its restore."""
    if not isinstance(text, str):
        return text
    return _render(_flatten(_group(TOKEN.findall(text))[0]))


def same_policy(a, b):
    if a is None or b is None:
        return a == b
    return all((canonical_expr(a.get(k)) if k in ('using', 'check') else a.get(k)) ==
               (canonical_expr(b.get(k)) if k in ('using', 'check') else b.get(k)) for k in set(a) | set(b))


class Findings:
    def __init__(self):
        self.items = []

    def add(self, severity, area, key, message):
        self.items.append({'severity': severity, 'area': area, 'key': key, 'message': message})

    def block(self, area, key, message):
        self.add('block', area, key, message)

    def warn(self, area, key, message):
        self.add('warn', area, key, message)


def role_of(grant):
    return grant.split(':', 1)[0]


def compare_grants(f, area, key, source, target):
    for grant in sorted(set(source) ^ set(target)):
        side = 'missing on target' if grant in source else 'only on target'
        if role_of(grant) in EXPOSED_ROLES:
            f.block(area, key, f'grant {grant} {side} (changes what guests or signed-in users can do)')
        else:
            f.warn(area, key, f'grant {grant} {side}')


def compare_tables(f, source, target, allow_extra):
    for key in sorted(source):
        s, t = source[key], target.get(key)
        if t is None:
            f.block('tables', key, 'missing on target')
            continue
        if s['columns'] != t['columns']:
            missing = [c for c in s['columns'] if c not in t['columns']]
            extra = [c for c in t['columns'] if c not in s['columns']]
            detail = '; '.join(filter(None, [missing and 'source-only: ' + ', '.join(missing), extra and 'target-only: ' + ', '.join(extra)])) or 'column order differs (row hashes will differ)'
            f.block('tables', key, 'columns differ — ' + detail)
        for flag, label in (('rls', 'row level security'), ('forceRls', 'forced row level security')):
            if s.get(flag) != t.get(flag):
                f.block('tables', key, f"{label} is {'on' if s.get(flag) else 'off'} on source but {'on' if t.get(flag) else 'off'} on target")
        if s.get('definition') != t.get('definition'):
            f.block('tables', key, 'view definition differs')
        for name, definition in sorted(s['constraints'].items()):
            if canonical_expr(t['constraints'].get(name)) != canonical_expr(definition):
                f.block('constraints', f'{key}.{name}', 'missing on target' if name not in t['constraints'] else 'definition differs')
        for name in sorted(set(t['constraints']) - set(s['constraints'])):
            f.warn('constraints', f'{key}.{name}', 'only on target')
        for name, definition in sorted(s['indexes'].items()):
            if t['indexes'].get(name) != definition:
                f.warn('indexes', f'{key}.{name}', 'missing on target' if name not in t['indexes'] else 'definition differs')
        for name, trig in sorted(s['triggers'].items()):
            other = t['triggers'].get(name)
            if other is None:
                f.block('triggers', f'{key}.{name}', 'missing on target')
            elif other['def'] != trig['def']:
                f.block('triggers', f'{key}.{name}', 'definition differs')
            elif other['enabled'] != trig['enabled']:
                f.block('triggers', f'{key}.{name}', f"enabled state {trig['enabled']} on source, {other['enabled']} on target")
        for name in sorted(set(t['triggers']) - set(s['triggers'])):
            f.warn('triggers', f'{key}.{name}', 'only on target')
        for name, policy in sorted(s['policies'].items()):
            other = t['policies'].get(name)
            if other is None:
                f.block('policies', f'{key}.{name}', 'missing on target')
            elif not same_policy(other, policy):
                f.block('policies', f'{key}.{name}', 'policy differs (command, roles or expression)')
        for name in sorted(set(t['policies']) - set(s['policies'])):
            # Permissive policies OR together, so an extra one can open access.
            f.block('policies', f'{key}.{name}', 'only on target (an extra policy can widen access)')
        compare_grants(f, 'grants', key, s['grants'], t['grants'])
        if s.get('owner') != t.get('owner'):
            f.warn('owners', key, f"owner {s.get('owner')} on source, {t.get('owner')} on target")
    for key in sorted(set(target) - set(source)):
        if not allow_extra:
            f.warn('tables', key, 'only on target')


def compare_functions(f, source, target, allow_extra):
    for key in sorted(source):
        s, t = source[key], target.get(key)
        if t is None:
            f.block('functions', key, 'missing on target')
            continue
        for field, label in (('returns', 'return type'), ('language', 'language'), ('bodyMd5', 'body'),
                             ('securityDefiner', 'security definer flag'), ('config', 'settings (search_path)'),
                             ('volatility', 'volatility'), ('kind', 'kind'), ('definition', 'exact definition/defaults'),
                             ('strict', 'strict flag'), ('leakproof', 'leakproof flag'), ('parallel', 'parallel safety'),
                             ('binary', 'binary/library'), ('grants', 'exact grants/grant options')):
            if s.get(field) != t.get(field):
                f.block('functions', key, f'{label} differs')
        if s.get('owner') != t.get('owner'):
            if s.get('securityDefiner'):
                f.block('functions', key, f"security definer runs as {t.get('owner')} on target instead of {s.get('owner')}")
            else:
                f.warn('owners', key, f"owner {s.get('owner')} on source, {t.get('owner')} on target")
        compare_grants(f, 'execute', key, [f'{r}:EXECUTE' for r in s['execute']], [f'{r}:EXECUTE' for r in t['execute']])
    for key in sorted(set(target) - set(source)):
        if not allow_extra:
            f.warn('functions', key, 'only on target')


def compare_service(f, source, target):
    """The app's policies and triggers on Supabase tables (Storage access rules, the signup trigger) must come back."""
    for table, s in sorted(source.get('attachments', {}).items()):
        t = target.get('attachments', {}).get(table)
        if t is None:
            f.block('service', table, 'Supabase service table missing on target')
            continue
        if s['rls'] and not t['rls']:
            f.block('service', table, 'row level security is off on target')
        for name, policy in sorted(s['policies'].items()):
            if name not in t['policies'] or not same_policy(t['policies'][name], policy):
                f.block('service', f'{table}.{name}', 'policy missing on target' if name not in t['policies'] else 'policy differs')
        for name in sorted(set(t['policies']) - set(s['policies'])):
            f.block('service', f'{table}.{name}', 'policy only on target (an extra policy can widen access)')
        for name, trig in sorted(s['triggers'].items()):
            other = t['triggers'].get(name)
            if other is None:
                f.block('service', f'{table}.{name}', 'trigger missing on target')
            elif other != trig:
                f.block('service', f'{table}.{name}', 'trigger differs or is disabled')
        for name in sorted(set(t['triggers']) - set(s['triggers'])):
            f.warn('service', f'{table}.{name}', 'trigger only on target (stack version difference?)')
    for fn in sorted(set(source.get('functions', [])) - set(target.get('functions', []))):
        f.block('service', fn, 'function in a Supabase schema missing on target (app-defined, or a stack version gap)')
    source_functions, target_functions = source.get('functions', []), target.get('functions', [])
    if isinstance(source_functions, dict) and isinstance(target_functions, dict):
        # Stack upgrades do not receive a blanket exception: exact Auth/Storage/RPC behavior is a cutover gate.
        for key in sorted(set(source_functions) & set(target_functions)):
            for field in EXACT_FUNCTION_FIELDS:
                if source_functions[key].get(field) != target_functions[key].get(field):
                    f.block('service-functions', key, f'{field} differs (pinned service compatibility required)')
        for key in sorted(set(target_functions) - set(source_functions)):
            f.block('service-functions', key, 'function only on target (pinned service compatibility required)')
    source_tables, target_tables = source.get('tables'), target.get('tables')
    if isinstance(source_tables, dict) and isinstance(target_tables, dict):
        for key in sorted(set(source_tables) - set(target_tables)):
            f.block('service-tables', key, 'service table/view missing on target')
        for key in sorted(set(source_tables) & set(target_tables)):
            for field in EXACT_SERVICE_TABLE_FIELDS:
                if source_tables[key].get(field) != target_tables[key].get(field):
                    f.block('service-tables', key, f'{field} differs (pinned service schema compatibility required)')
        for key in sorted(set(target_tables) - set(source_tables)):
            f.block('service-tables', key, 'service table/view only on target (pinned service schema compatibility required)')


def _exact_function(body):
    """Catalog metadata must contain real typed evidence, not merely named fields with null placeholders."""
    if not isinstance(body, dict) or any(field not in body for field in EXACT_FUNCTION_FIELDS):
        return False
    for field in ('definition', 'language', 'owner'):
        if not isinstance(body[field], str) or not body[field].strip():
            return False
    if not ((body['kind'] == 'p' and body['returns'] is None)
            or (isinstance(body['returns'], str) and body['returns'].strip())):
        return False
    if (body['kind'] not in ('f', 'p', 'w') or body['volatility'] not in ('i', 's', 'v')
            or body['parallel'] not in ('s', 'r', 'u')
            or not isinstance(body['bodyMd5'], str) or not re.fullmatch(r'[a-f0-9]{32}', body['bodyMd5'])
            or any(type(body[field]) is not bool for field in ('securityDefiner', 'strict', 'leakproof'))
            or (body['binary'] is not None and not isinstance(body['binary'], str))):
        return False
    for field in ('config', 'execute'):
        if not isinstance(body[field], list) or any(not isinstance(v, str) or not v for v in body[field]):
            return False
    if not isinstance(body['grants'], list):
        return False
    for grant in body['grants']:
        if (not isinstance(grant, dict) or any(not isinstance(grant.get(k), str) or not grant[k]
                for k in ('grantee', 'grantor', 'privilege')) or grant['privilege'] != 'EXECUTE'
                or type(grant.get('grantOption')) is not bool):
            return False
    return {grant['grantee'] for grant in body['grants']} == set(body['execute'])


def _function_inventory(coverage, prefix, functions, required=False):
    keys, count = coverage.get(prefix + 'FunctionKeys'), coverage.get(prefix + 'FunctionCount')
    return (coverage.get(prefix + 'FunctionDefinitions') is True and isinstance(functions, dict)
            and (not required or bool(functions)) and isinstance(keys, list)
            and all(isinstance(key, str) for key in keys) and len(keys) == len(set(keys))
            and set(keys) == set(functions) and type(count) is int and count == len(functions)
            and all(_exact_function(body) for body in functions.values()))


def _exact_service_table(body):
    if not isinstance(body, dict) or any(field not in body for field in EXACT_SERVICE_TABLE_FIELDS):
        return False
    if (body['kind'] not in ('r', 'p', 'v', 'm') or not isinstance(body['owner'], str) or not body['owner']
            or type(body['rls']) is not bool or type(body['forceRls']) is not bool
            or not isinstance(body['columns'], list) or any(not isinstance(c, str) or not c for c in body['columns'])
            or not isinstance(body['grants'], list) or any(not isinstance(g, str) or not g for g in body['grants'])):
        return False
    for field in ('constraints', 'indexes'):
        if (not isinstance(body[field], dict) or any(not isinstance(k, str) or not isinstance(v, str) or not v
                                                   for k, v in body[field].items())):
            return False
    if body['kind'] in ('v', 'm'):
        if not isinstance(body['definition'], str) or not re.fullmatch(r'[a-f0-9]{32}', body['definition']):
            return False
    elif body['definition'] is not None:
        return False
    if not isinstance(body['privilegeDetails'], list):
        return False
    for grant in body['privilegeDetails']:
        if (not isinstance(grant, dict) or any(not isinstance(grant.get(k), str) or not grant[k]
                for k in ('grantee', 'grantor', 'privilege')) or type(grant.get('grantOption')) is not bool
                or grant['privilege'] not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')):
            return False
    return True


def _service_table_inventory(data):
    coverage, service = data.get('coverage', {}), data.get('service', {})
    if not isinstance(coverage, dict) or not isinstance(service, dict):
        return False
    tables = service.get('tables')
    keys, count = coverage.get('serviceTableKeys'), coverage.get('serviceTableCount')
    return (coverage.get('serviceTableDefinitions') is True and isinstance(tables, dict) and bool(tables)
            and isinstance(keys, list) and all(isinstance(k, str) for k in keys)
            and len(keys) == len(set(keys)) and set(keys) == set(tables)
            and type(count) is int and count == len(tables) and AUTH_REQUIRED <= set(tables)
            and all(_exact_service_table(body) for body in tables.values()))


def service_tables_compatible(source, target):
    """Exact stack shape before loading Auth rows; app attachments/history are restored separately.

    Only supabase_migrations is omitted here because the reviewed restore installs its history. Final parity
    still compares that namespace's tables and migration rows exactly through the normal service checks.
    """
    if not _service_table_inventory(source) or not _service_table_inventory(target):
        return False
    tables = {key: body for key, body in source['service']['tables'].items() if not key.startswith('supabase_migrations.')}
    other = {key: body for key, body in target['service']['tables'].items() if not key.startswith('supabase_migrations.')}
    return set(tables) == set(other) and all(
        tables[key][field] == other[key][field]
        for key in tables for field in EXACT_SERVICE_TABLE_FIELDS)


def _auth_sequence_inventory(data):
    coverage, service, rows = data.get('coverage', {}), data.get('service', {}), data.get('rows', {})
    if not isinstance(coverage, dict) or not isinstance(service, dict) or not isinstance(rows, dict):
        return False
    sequences, keys, count = service.get('authSequences'), coverage.get('authSequenceKeys'), coverage.get('authSequenceCount')
    if (coverage.get('authSequenceDefinitions') is not True or not isinstance(sequences, dict)
            or not isinstance(keys, list) or any(not isinstance(k, str) or not k.startswith('auth.') for k in keys)
            or len(keys) != len(set(keys)) or set(keys) != set(sequences)
            or type(count) is not int or count != len(sequences)):
        return False
    for key, body in sequences.items():
        if not isinstance(body, dict) or any(field not in body for field in AUTH_SEQUENCE_FIELDS):
            return False
        if (body['dataType'] not in ('smallint', 'integer', 'bigint') or not isinstance(body['owner'], str) or not body['owner']
                or type(body['cycle']) is not bool or any(type(body[field]) is not int
                    for field in ('start', 'increment', 'min', 'max', 'cache'))
                or body['increment'] == 0 or body['min'] > body['max'] or not body['min'] <= body['start'] <= body['max']
                or body['cache'] < 1 or body['stateRowKey'] != AUTH_SEQUENCE_PREFIX + key
                or not isinstance(body['ownedBy'], list) or any(not isinstance(v, str) or not v for v in body['ownedBy'])
                or not isinstance(body['grants'], list)):
            return False
        for grant in body['grants']:
            if (not isinstance(grant, dict) or any(not isinstance(grant.get(field), str) or not grant[field]
                    for field in ('grantee', 'grantor', 'privilege')) or type(grant.get('grantOption')) is not bool
                    or grant['privilege'] not in ('USAGE', 'SELECT', 'UPDATE')):
                return False
        state = rows.get(body['stateRowKey'])
        if (not isinstance(state, dict) or type(state.get('count')) is not int
                or not body['min'] <= state['count'] <= body['max'] or state.get('digest') not in ('true', 'false')):
            return False
    return {key for key in rows if key.startswith(AUTH_SEQUENCE_PREFIX)} == {AUTH_SEQUENCE_PREFIX + key for key in keys}


def auth_sequence_state(data, key):
    """Return captured last_value/is_called/next value without advancing the database sequence."""
    if not _auth_sequence_inventory(data) or key not in data['service']['authSequences']:
        raise ValueError('Complete captured Auth sequence inventory/state required')
    body = data['service']['authSequences'][key]
    row = data['rows'][body['stateRowKey']]
    called = row['digest'] == 'true'
    next_value = row['count'] + body['increment'] if called else row['count']
    if body['cycle'] and not body['min'] <= next_value <= body['max']:
        next_value = body['min'] if body['increment'] > 0 else body['max']
    return {'lastValue': row['count'], 'isCalled': called, 'nextValue': next_value}


def auth_sequence_plan(source, target):
    """Pre-import plan: restore source SET, or preserve an already-ahead target to avoid regressing it."""
    if not _auth_sequence_inventory(source) or not _auth_sequence_inventory(target):
        return {'compatible': False, 'sequences': []}
    a, b = source['service']['authSequences'], target['service']['authSequences']
    if set(a) != set(b) or any(a[key][field] != b[key][field] for key in a for field in AUTH_SEQUENCE_FIELDS):
        return {'compatible': False, 'sequences': []}
    plan = []
    for key, body in sorted(a.items()):
        source_state, target_state = auth_sequence_state(source, key), auth_sequence_state(target, key)
        if any(not body['min'] <= state['nextValue'] <= body['max'] for state in (source_state, target_state)):
            return {'compatible': False, 'sequences': []}
        if body['cycle'] and source_state != target_state:
            return {'compatible': False, 'sequences': []}
        ahead = ((target_state['nextValue'] - source_state['nextValue']) * body['increment']) > 0
        plan.append({'key': key, 'source': source_state, 'target': target_state,
                     'action': 'preserve-target-state' if ahead else 'restore-source-state'})
    return {'compatible': True, 'sequences': plan}


def compare_auth_sequences(f, source, target):
    if not _auth_sequence_inventory(source) or not _auth_sequence_inventory(target):
        return  # explicit incomplete coverage warning/strict gate handles legacy snapshots
    a, b = source['service']['authSequences'], target['service']['authSequences']
    for key in sorted(set(a) ^ set(b)):
        f.block('auth-sequences', key, 'Auth sequence present on one side only')
    for key in sorted(set(a) & set(b)):
        for field in AUTH_SEQUENCE_FIELDS:
            if a[key][field] != b[key][field]:
                f.block('auth-sequences', key, f'{field} differs (pinned Auth sequence compatibility required)')
        source_state, target_state = auth_sequence_state(source, key), auth_sequence_state(target, key)
        for side, state, body in (('source', source_state, a[key]), ('target', target_state, b[key])):
            if not body['min'] <= state['nextValue'] <= body['max']:
                f.block('auth-sequences', key, f'{side} Auth sequence is exhausted; next insert cannot allocate an ID')
        if a[key]['cycle']:
            if source_state != target_state:
                f.block('auth-sequences', key, 'cycling Auth sequence state differs')
        elif ((target_state['nextValue'] - source_state['nextValue']) * a[key]['increment']) < 0:
            f.block('auth-sequences', key, 'target next value is behind source; future Auth inserts can reuse existing IDs')
        elif ((target_state['nextValue'] - source_state['nextValue']) * a[key]['increment']) > 0:
            f.warn('auth-sequences', key, 'target sequence is already ahead; preserve its state instead of replaying a lower source SET')
        elif source_state != target_state:
            f.warn('auth-sequences', key, 'next value matches but last_value/is_called differ; source SET restores the captured representation')


def coverage_complete(data):
    """New exact service/Auth evidence only; legacy counts or absent MFA catalogs never become ready evidence."""
    coverage = data.get('coverage', {})
    if not isinstance(coverage, dict):
        return False
    auth = coverage.get('authData', {})
    service = data.get('service', {})
    if not isinstance(auth, dict) or not isinstance(service, dict):
        return False
    functions = service.get('functions')
    schemas = coverage.get('serviceFunctionSchemas')
    hashed, detected = auth.get('hashedTables'), auth.get('detectedMfaTables')
    auth_tables = auth.get('detectedAuthTables')
    if (type(coverage.get('version')) is not int or coverage.get('version') != 2
            or coverage.get('extensionOwnedFunctionsExcluded') is not True
            or coverage.get('serviceFunctionDefinitions') is not True
            or coverage.get('unsupportedServiceFunctionKinds') != []
            or not isinstance(schemas, list) or any(not isinstance(s, str) for s in schemas)
            or not SERVICE_REQUIRED <= set(schemas)
            or not _function_inventory(coverage, 'service', functions, required=True)
            or not _function_inventory(coverage, 'application', data.get('functions'))
            or not _service_table_inventory(data)
            or not _auth_sequence_inventory(data)
            or auth.get('mode') != 'exact-row-hash'
            or not isinstance(auth.get('requiredTables'), list)
            or any(not isinstance(t, str) for t in auth['requiredTables'])
            or set(auth['requiredTables']) != AUTH_REQUIRED or auth.get('missingRequiredTables') != []
            or not isinstance(hashed, list) or any(not isinstance(t, str) for t in hashed)
            or len(hashed) != len(set(hashed)) or not AUTH_REQUIRED <= set(hashed)
            or any(not t.startswith('auth.') for t in hashed)
            or not isinstance(auth_tables, list) or any(not isinstance(t, str) for t in auth_tables)
            or len(auth_tables) != len(set(auth_tables)) or set(auth_tables) != set(hashed)
            or not isinstance(detected, list) or any(not isinstance(t, str) for t in detected)
            or set(detected) != {t for t in hashed if t.startswith('auth.mfa_')}
            or 'auth.mfa_factors' not in detected):
        return False
    if not isinstance(data.get('rows'), dict):
        return False
    for table in hashed:
        row = data.get('rows', {}).get(table)
        if (not isinstance(row, dict) or type(row.get('count')) is not int or row['count'] < 0
                or not isinstance(row.get('digest'), str)
                or not (re.fullmatch(r'[a-f0-9]{32}', row['digest']) or (row['count'] == 0 and row['digest'] == ''))):
            return False
    # Detect partial inventories where an existing Auth row target was omitted from the claimed scope.
    if {t for t in data.get('rows', {}) if t.startswith('auth.')} != set(auth_tables):
        return False
    if {key for key, body in service['tables'].items() if key.startswith('auth.') and body['kind'] in ('r', 'p')} != set(auth_tables):
        return False
    if any(key.split('.', 1)[0] not in schemas for key in service['tables'] | functions):
        return False
    return True


def compare_coverage(f, source, target):
    complete = coverage_complete(source) and coverage_complete(target)
    for side, data in (('source', source), ('target', target)):
        if not coverage_complete(data):
            f.warn('coverage', side, 'exact service definitions/grants and Auth users/identities/MFA coverage incomplete; strict readiness must reject this snapshot')
    a, b = source.get('coverage', {}), target.get('coverage', {})
    if a.get('version') == 2 and b.get('version') == 2:
        if a.get('serviceFunctionSchemas') != b.get('serviceFunctionSchemas'):
            f.block('coverage', 'service schemas', 'detected service schemas differ (pinned service compatibility required)')
        if a.get('authData', {}).get('hashedTables') != b.get('authData', {}).get('hashedTables'):
            f.block('coverage', 'Auth data', 'detected Auth/MFA row targets differ; missing tables are not covered')
    return complete


def compare_access(f, source, target, digests):
    """Same rows visible to the same identity on both sides: guests, signed-in users, an admin."""
    if source is None and target is None:
        f.warn('access', 'access', 'access parity was not taken (--no-access); the app\'s view through RLS is unproven')
        return
    if source is None or target is None:
        f.block('access', 'access', 'access parity taken on one side only')
        return
    index = lambda rows: {(r['who'], r['key']): r for r in rows}
    s, t = index(source), index(target)
    for who in sorted({w for w, _ in s} - {w for w, _ in t}):
        f.block('access', who, 'identity missing on target (Auth users or admin flag differ)')
    for key in sorted(s):
        a, b = s[key], t.get(key)
        label = f'{key[0]} → {key[1]}'
        if b is None:
            if key[0] in {w for w, _ in t}:
                f.block('access', label, 'readable on source, not readable on target (grant or table missing)')
            continue
        if a.get('error') != b.get('error'):
            f.block('access', label, f"read result differs: source {a.get('error') or 'ok'}, target {b.get('error') or 'ok'}")
        elif a.get('count') != b.get('count'):
            f.block('access', label, f"sees {a.get('count')} rows on source, {b.get('count')} on target")
        elif digests and a.get('digest') is not None and b.get('digest') is not None and a['digest'] != b['digest']:
            f.block('access', label, 'sees different row contents')
    for key in sorted(set(t) - set(s)):
        if key[0] in {w for w, _ in s}:
            f.block('access', f'{key[0]} → {key[1]}', 'readable on target, not on source (wider access)')


def compare_rows(f, source, target, digests):
    for key in sorted(source):
        if key.startswith(AUTH_SEQUENCE_PREFIX):
            continue  # sequence state has separate monotonic/is_called checks, never row-count semantics
        s, t = source[key], target.get(key)
        if t is None:
            f.block('rows', key, 'not counted on target (table or service table missing)')
            continue
        if key == 'supabase_migrations.schema_migrations':
            src = set(filter(None, (s.get('digest') or '').split(',')))
            tgt = set(filter(None, (t.get('digest') or '').split(',')))
            if src - tgt:
                f.block('migrations', key, 'target lacks applied versions: ' + ', '.join(sorted(src - tgt)))
            if tgt - src:
                f.warn('migrations', key, 'target has extra versions: ' + ', '.join(sorted(tgt - src)))
            continue
        if s['count'] != t['count']:
            f.block('rows', key, f"{s['count']} rows on source, {t['count']} on target")
        elif (digests or key.startswith('auth.')) and s.get('digest') is not None and t.get('digest') is not None and s['digest'] != t['digest']:
            f.block('rows', key, 'same row count but row contents differ')
    for key in sorted(set(target) - set(source)):
        if key.startswith(AUTH_SEQUENCE_PREFIX):
            continue
        if target[key]['count']:
            f.warn('rows', key, f"{target[key]['count']} rows only counted on target")


def compare(source, target, allow_extra=False):
    f = Findings()
    for side, data in (('source', source), ('target', target)):
        if data.get('format') != FORMAT:
            raise ValueError(f'{side} is not a {FORMAT} fingerprint')
        meta = data['meta']
        if not (meta.get('superuser') or meta.get('bypassRls')):
            f.block('meta', side, f"taken as {meta.get('currentUser')} without BYPASSRLS: row counts may be filtered by row level security")
        if meta.get('missingSchemas'):
            f.block('meta', side, 'schemas not found: ' + ', '.join(meta['missingSchemas']))
    if source['meta']['schemas'] != target['meta']['schemas']:
        f.block('meta', 'schemas', 'fingerprints cover different schemas')
    if source['meta']['serverVersionNum'] // 10000 != target['meta']['serverVersionNum'] // 10000:
        f.warn('meta', 'server', f"PostgreSQL {source['meta']['serverVersionNum'] // 10000} on source, {target['meta']['serverVersionNum'] // 10000} on target")
    digests = source['meta']['hashRows'] and target['meta']['hashRows']
    if not digests:
        f.warn('meta', 'hashRows', 'row hashes were not taken on both sides; only counts compared')

    for name, ext in sorted(source['extensions'].items()):
        other = target['extensions'].get(name)
        if other is None:
            f.block('extensions', name, 'missing on target')
        elif other['version'] != ext['version']:
            f.warn('extensions', name, f"version {ext['version']} on source, {other['version']} on target")
        elif other['schema'] != ext['schema']:
            f.warn('extensions', name, f"installed in {ext['schema']} on source, {other['schema']} on target")

    compare_tables(f, source['tables'], target['tables'], allow_extra)
    compare_functions(f, source['functions'], target['functions'], allow_extra)

    for key, value in sorted(source['sequences'].items()):
        if key not in target['sequences']:
            f.block('sequences', key, 'missing on target')
        elif value is not None and (target['sequences'][key] is None or target['sequences'][key] < value):
            f.block('sequences', key, f"at {target['sequences'][key]} on target, behind source {value}: the next insert would collide")
    for key, grants in sorted(source.get('sequenceGrants', {}).items()):
        if key in target.get('sequenceGrants', {}):
            compare_grants(f, 'grants', key, grants, target['sequenceGrants'][key])
    for key, labels in sorted(source['enums'].items()):
        if target['enums'].get(key) != labels:
            f.block('enums', key, 'labels differ or type missing')
    for pub, tables in sorted(source['publications'].items()):
        missing = sorted(set(tables) - set(target['publications'].get(pub, [])))
        if missing:
            f.block('publications', pub, 'tables not published on target (live updates would stop): ' + ', '.join(missing))
        extra = sorted(set(target['publications'].get(pub, [])) - set(tables))
        if extra:
            f.warn('publications', pub, 'extra published tables on target: ' + ', '.join(extra))

    compare_service(f, source.get('service', {}), target.get('service', {}))
    compare_auth_sequences(f, source, target)
    complete = compare_coverage(f, source, target)
    compare_rows(f, source['rows'], target['rows'], digests)
    compare_access(f, source.get('access'), target.get('access'), digests)
    blocking = [i for i in f.items if i['severity'] == 'block']
    return {'ok': not blocking, 'blocking': len(blocking), 'warnings': len(f.items) - len(blocking), 'findings': f.items,
            'compared': {'tables': len(source['tables']), 'functions': len(source['functions']),
                         'serviceFunctions': len(source.get('service', {}).get('functions', {})),
                         'serviceTables': len(source.get('service', {}).get('tables', {})),
                         'coverageComplete': complete,
                         'rowTargets': len(source['rows']), 'accessReads': len(source.get('access') or []), 'rowHashes': bool(digests)}}


def report_markdown(result):
    c = result['compared']
    out = ['# Database parity: source vs restored target', '',
           f"**{'PASS' if result['ok'] else 'BLOCKED'}** — {result['blocking']} blocking, {result['warnings']} warnings. "
           f"Compared {c['tables']} app tables/views, {c['serviceTables']} service tables/views, {c['functions']} app functions, {c['serviceFunctions']} service functions, {c['accessReads']} reads as app identities, {c['rowTargets']} row counts"
           f"{' with row hashes' if c['rowHashes'] else ' (counts only)'}.", '']
    out += [f"Exact service/Auth/MFA coverage: **{'complete' if c['coverageComplete'] else 'incomplete — strict readiness blocked'}**. "
            'Auth rows are always hashed even when application row hashes are disabled.', '']
    for severity, title in (('block', 'Blocking'), ('warn', 'Warnings')):
        items = [i for i in result['findings'] if i['severity'] == severity]
        if items:
            out += [f'## {title}', '', '| Area | Object | Finding |', '| --- | --- | --- |']
            out += ['| {} | `{}` | {} |'.format(i['area'], i['key'], i['message'].replace('|', r'\|')) for i in items] + ['']
    out += ['Database parity only. Storage bytes (restore.py verifies), Auth sign-in, provider settings, RLS denial '
            'smoke tests and installed clients are separate cutover gates.', '']
    return '\n'.join(out)


PRIVILEGES = {'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN', 'USAGE', 'EXECUTE'}
ROLE = re.compile(r'[A-Za-z_][A-Za-z0-9_]*')


def quote_ident(name):
    return '"' + name.replace('"', '""') + '"'


def quote_grantee(role):
    if role == 'PUBLIC':
        return 'PUBLIC'
    if not ROLE.fullmatch(role):
        raise ValueError(f'Refusing unusual role name {role!r}; reconcile it by hand')
    return quote_ident(role)


def qualified(key):
    """'schema.name' or 'schema.name(args)' from a fingerprint key, with schema and name quoted."""
    head, paren, args = key.partition('(')
    schema, _, name = head.partition('.')
    return f'{quote_ident(schema)}.{quote_ident(name)}' + (paren + args if paren else '')


def grant_sync(source, target):
    """SQL that makes the target's table, sequence and function privileges exactly the source's.

    Why it is needed: pg_dump records privileges as changes from PostgreSQL's built-in default, but a Supabase
    stack grants anon/authenticated/service_role everything on new objects by default. After pg_restore the
    target therefore holds rights the source had revoked (for example anon on athlete birth dates or admin
    functions). Objects missing on either side are left to the parity report.
    """
    statements = []

    def diff(kind, key, wanted, actual):
        for grant in sorted(set(actual) - set(wanted)):
            role, privilege = grant.split(':', 1)
            if privilege in PRIVILEGES:
                statements.append(f'revoke {privilege.lower()} on {kind} {qualified(key)} from {quote_grantee(role)};')
        for grant in sorted(set(wanted) - set(actual)):
            role, privilege = grant.split(':', 1)
            if privilege in PRIVILEGES:
                statements.append(f'grant {privilege.lower()} on {kind} {qualified(key)} to {quote_grantee(role)};')

    for key, body in sorted(source['tables'].items()):
        if key in target['tables']:
            diff('table', key, body['grants'], target['tables'][key]['grants'])
    for key, grants in sorted(source.get('sequenceGrants', {}).items()):
        if key in target.get('sequenceGrants', {}):
            diff('sequence', key, grants, target['sequenceGrants'][key])
    for key, body in sorted(source['functions'].items()):
        if key in target['functions']:
            kind = 'procedure' if body.get('kind') == 'p' else 'function'
            diff(kind, key, [f'{r}:EXECUTE' for r in body['execute']], [f'{r}:EXECUTE' for r in target['functions'][key]['execute']])
    header = ('-- Generated by infrastructure/migration/parity.py grant-sync (REDUNDANCY-01). Review before applying.\n'
              '-- Makes privileges on the restored target equal to the source. Changes privileges only, never data.\n')
    return header + 'begin;\n' + ''.join(line + '\n' for line in statements) + 'commit;\n', len(statements)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    fp = sub.add_parser('fingerprint', help='read-only fingerprint of one database')
    fp.add_argument('--env-file', required=True, help='private dotenv with PGHOST/PGDATABASE/PGUSER (+PGPASSFILE, PGSSLMODE)')
    fp.add_argument('--out', required=True, help='new private JSON file (must not exist)')
    fp.add_argument('--schemas', default='auto', help="application schemas; 'auto' = every non-system, non-Supabase schema")
    fp.add_argument('--no-row-hash', action='store_true', help='count app rows only; all nonextension Auth data still hashed')
    fp.add_argument('--no-access', action='store_true', help='skip access parity (reads as anon / users / admin)')
    cmp = sub.add_parser('compare', help='compare two fingerprints; exit 1 when anything blocks')
    cmp.add_argument('source')
    cmp.add_argument('target')
    cmp.add_argument('--report', help='new Markdown report file (must not exist)')
    cmp.add_argument('--json', action='store_true', help='print the full result as JSON')
    cmp.add_argument('--allow-extra', action='store_true', help='do not warn about tables/functions only on the target')
    sync = sub.add_parser('grant-sync', help='write SQL that makes target privileges equal the source (review, then apply)')
    sync.add_argument('source')
    sync.add_argument('target')
    sync.add_argument('--out', required=True, help='new private SQL file (must not exist)')
    args = parser.parse_args(argv)
    try:
        if args.command == 'fingerprint':
            return fingerprint(args)
        if args.command == 'grant-sync':
            sql, count = grant_sync(json.loads(Path(args.source).read_text()), json.loads(Path(args.target).read_text()))
            write_private(args.out, sql)
            print(json.dumps({'statements': count, 'out': str(args.out)}))
            return 0
        result = compare(json.loads(Path(args.source).read_text()), json.loads(Path(args.target).read_text()), args.allow_extra)
    except (ValueError, RuntimeError, OSError) as error:
        print(f'parity: {error}', file=sys.stderr)
        return 1
    if args.report:
        write_private(args.report, report_markdown(result))
    print(json.dumps(result, indent=1) if args.json else report_markdown(result))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
