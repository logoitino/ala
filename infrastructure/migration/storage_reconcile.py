#!/usr/bin/env python3
"""Plan reviewed Storage owner restoration before app guards; never execute generated write SQL.

Catalog capture is streamed through a read-only SQL transaction into private external JSONL.
Full source rows travel inside archive encryption; plans change ONLY owner/owner_id and keep
new API-created IDs, timestamps, metadata and physical/backend versions intact.
"""
import argparse
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backup'))
from common import digest, external_path, json_write, load_env, origin, postgres_env, private_file, require_tools, run

MAX_BYTES = 256 * 1024 * 1024
MAX_ROWS = 1_000_000
CATALOG_SQL = """
begin transaction isolation level repeatable read read only;
set local row_security=off;
select jsonb_build_object('columns',coalesce((select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) order by a.attnum) from pg_attribute a where a.attrelid='storage.objects'::regclass and a.attnum>0 and not a.attisdropped),'[]'),
 'triggers',coalesce((select jsonb_agg(jsonb_build_object('name',t.tgname,'functionSchema',n.nspname,'enabled',t.tgenabled)) from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace where t.tgrelid='storage.objects'::regclass and not t.tgisinternal),'[]'),
 'foreignKeys',coalesce((select jsonb_agg(jsonb_build_object('columns',(select jsonb_agg(a.attname order by x.n) from unnest(c.conkey) with ordinality x(attnum,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=x.attnum),'targetSchema',n.nspname,'targetTable',r.relname)) from pg_constraint c join pg_class r on r.oid=c.confrelid join pg_namespace n on n.oid=r.relnamespace where c.conrelid='storage.objects'::regclass and c.contype='f'),'[]'))::text;
select jsonb_build_object('object',to_jsonb(o))::text from storage.objects o order by o.bucket_id,o.name,o.id;
commit;
"""


def identity(env):
    return {key: env.get(key, '5432' if key == 'PGPORT' else '') for key in ('PGHOST', 'PGPORT', 'PGDATABASE')}


def read_catalog(filename):
    """Bounded JSONL read: no truncated/duplicate catalog or object records are admitted."""
    path = private_file(filename)
    if path.stat().st_size > MAX_BYTES:
        raise ValueError('Storage catalog exceeds reviewed size limit')
    with path.open() as stream:
        header = json.loads(next(stream))
        schema = json.loads(next(stream))
        objects = []
        for line in stream:
            if len(line) > 4 * 1024 * 1024 or len(objects) >= MAX_ROWS:
                raise ValueError('Storage catalog row/count exceeds reviewed limit')
            row = json.loads(line)
            if set(row) != {'object'} or not isinstance(row['object'], dict):
                raise ValueError('Invalid Storage catalog row')
            objects.append(row['object'])
    if header.get('format') != 'tapuai-storage-catalog/1' or set(schema) != {'columns', 'triggers', 'foreignKeys'}:
        raise ValueError('Unsupported Storage catalog format')
    return {**header, **schema, 'objects': objects}


def capture_catalog(env, url, filename):
    """Explicit read-only capture; operators invoke it against an independently inspected target."""
    os.umask(0o077)
    filename = external_path(filename)
    require_tools('psql')
    with filename.open('xb') as output:
        output.write((json.dumps({'format': 'tapuai-storage-catalog/1', 'targetUrl': origin(url),
                     'databaseIdentity': identity(env)}) + '\n').encode())
        try:
            run(['psql', '-X', '--quiet', '--no-password', '--tuples-only', '--no-align',
                 '--set=ON_ERROR_STOP=1', '--command', CATALOG_SQL], env=env, stdout=output)
        except BaseException:
            filename.unlink(missing_ok=True)
            raise
    filename.chmod(0o600)
    try:
        return read_catalog(filename)
    except BaseException:
        filename.unlink(missing_ok=True)
        raise


def read_target_catalog(env, url):
    import tempfile
    with tempfile.TemporaryDirectory(prefix='.tapuai-storage-catalog-') as directory:
        return capture_catalog(env, url, Path(directory) / 'target.jsonl')


def assert_no_app_guards(catalog):
    if any(t.get('functionSchema') != 'storage' for t in catalog['triggers']):
        raise ValueError('Historical bytes/ownership must be restored before application guards; never disable live guards')


def objects(catalog):
    result = {}
    for item in catalog['objects']:
        key = (item.get('bucket_id'), item.get('name'))
        if any(not isinstance(value, str) or not value or '\x00' in value for value in key) or key in result:
            raise ValueError('Storage object keys are invalid or duplicate')
        if not isinstance(item.get('id'), str) or not item['id']:
            raise ValueError('Storage catalog lacks physical object identity')
        result[key] = item
    return result


def sql_string(value):
    return "'" + value.replace("'", "''") + "'"


def owner_fields(catalog):
    columns = {column['name']: column['type'] for column in catalog['columns']}
    fields = [name for name in ('owner', 'owner_id') if name in columns]
    if not fields or any(columns[name] != ('uuid' if name == 'owner' else 'text') for name in fields):
        raise ValueError('Storage owner column types require independent review')
    return fields


def normalized_size(value):
    """Known finite nonnegative size; boolean/missing values are never numeric evidence."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError('Storage logical metadata lacks numeric size')
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        raise ValueError('Storage logical metadata has invalid size') from None
    if not number.is_finite() or number < 0:
        raise ValueError('Storage logical metadata size must be finite and nonnegative')
    return number


def logical_objects(catalog):
    """Validate every declared owner value and known MIME/size before comparison/planning."""
    fields = owner_fields(catalog)
    result = objects(catalog)
    for item in result.values():
        for name in fields:
            if name not in item:
                raise ValueError('Storage declared owner value is missing; absence is not NULL')
            value = item[name]
            if value is not None:
                if not isinstance(value, str) or '\x00' in value or len(value) > 256:
                    raise ValueError('Storage owner must be nullable UUID/text')
                if name == 'owner':
                    try:
                        uuid.UUID(value)
                    except ValueError:
                        raise ValueError('Storage owner UUID is invalid') from None
        metadata = item.get('metadata')
        if not isinstance(metadata, dict):
            raise ValueError('Storage logical metadata is missing')
        mime = metadata.get('mimetype')
        if not isinstance(mime, str) or not mime.strip() or '\x00' in mime:
            raise ValueError('Storage logical metadata lacks MIME string')
        normalized_size(metadata.get('size'))
    return result


def ownership_plan(source, target):
    """Generate only named owner updates with exact catalog/target/guard assertions; no execution."""
    if source['targetUrl'] == target['targetUrl'] or source['databaseIdentity'] == target['databaseIdentity']:
        raise ValueError('Refusing source target for Storage reconciliation')
    assert_no_app_guards(target)
    before, after = logical_objects(source), logical_objects(target)
    if before.keys() != after.keys():
        raise ValueError('Source and target Storage object coverage differs')
    source_columns = {c['name']: c['type'] for c in source['columns']}
    target_columns = {c['name']: c['type'] for c in target['columns']}
    fields = [name for name in ('owner', 'owner_id') if name in source_columns or name in target_columns]
    if not fields or any(source_columns.get(name) != target_columns.get(name) or source_columns[name] != ('uuid' if name == 'owner' else 'text') for name in fields):
        raise ValueError('Storage owner column compatibility requires independent review')
    rows = []
    for key in sorted(before):
        source_meta, target_meta = before[key].get('metadata') or {}, after[key].get('metadata') or {}
        if source_meta['mimetype'] != target_meta['mimetype'] or normalized_size(source_meta['size']) != normalized_size(target_meta['size']):
            raise ValueError('Source/target logical metadata differs; preserve reserved file MIME and byte size')
        item = {'bucket_id': key[0], 'name': key[1], 'target_id': after[key]['id']}
        for name in fields:
            value = before[key].get(name)
            if value is not None and (not isinstance(value, str) or '\x00' in value or len(value) > 256):
                raise ValueError('Invalid Storage owner value')
            if name == 'owner' and value is not None:
                uuid.UUID(value)
            item[name] = value
        rows.append(item)
    auth_preload = any(set(fk.get('columns', [])) & set(fields) and fk.get('targetSchema') == 'auth' and fk.get('targetTable') == 'users' for fk in target['foreignKeys'])
    unsupported_fk = any(set(fk.get('columns', [])) & set(fields) and (fk.get('targetSchema'), fk.get('targetTable')) != ('auth', 'users') for fk in target['foreignKeys'])
    if unsupported_fk:
        raise ValueError('Storage ownership foreign key requires a separate reviewed migration')
    payload = sql_string(json.dumps(rows, ensure_ascii=False, separators=(',', ':')))
    definitions = ','.join(['bucket_id text', 'name text', 'target_id text'] + [f'{name} {target_columns[name]}' for name in fields])
    expression = f'jsonb_to_recordset({payload}::jsonb) as x({definitions})'
    # Object names can contain SQL dollar delimiters. Choose a tag absent from every
    # embedded string so even a quoted name cannot terminate this unexecuted DO plan.
    embedded = payload + sql_string(target['targetUrl']) + sql_string(target['databaseIdentity']['PGDATABASE'])
    tag_index = 0
    tag_base = uuid.uuid4().hex
    tag = f'$tapuai_storage_{tag_base}_{tag_index}$'
    while tag in embedded:
        tag_index += 1
        tag = f'$tapuai_storage_{tag_base}_{tag_index}$'
    lines = ['-- Generated private ownership PLAN; review target identity/versions, then apply only BEFORE app guards.',
             '-- No backend ID, version, metadata, timestamp or byte location is replaced.',
             'begin;', 'set local standard_conforming_strings=on;',
             'lock table storage.objects in share row exclusive mode;',
             f'do {tag} begin',
             f" if current_setting('tapuai.restore_target',true) is distinct from {sql_string(target['targetUrl'])} or current_database() <> {sql_string(target['databaseIdentity']['PGDATABASE'])} then raise exception 'Confirm isolated target outside this script'; end if;",
             " if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace where t.tgrelid='storage.objects'::regclass and not t.tgisinternal and n.nspname<>'storage') then raise exception 'Apply ownership before application guards'; end if;",
             f" if (select count(*) from storage.objects) <> {len(rows)} or exists(select 1 from {expression} where not exists(select 1 from storage.objects o where o.bucket_id=x.bucket_id and o.name=x.name and o.id::text=x.target_id)) then raise exception 'Target Storage identity/coverage changed'; end if;"]
    if auth_preload:
        fk_fields = sorted({name for fk in target['foreignKeys'] if fk.get('targetSchema') == 'auth' and fk.get('targetTable') == 'users' for name in fk.get('columns', []) if name in fields})
        for name in fk_fields:
            owner_expr = f'x.{name}::text'
            lines.append(f" if exists(select 1 from {expression} where {owner_expr} is not null and not exists(select 1 from auth.users u where u.id::text={owner_expr})) then raise exception 'Auth owners must be preloaded through reviewed Auth TOC'; end if;")
    lines += [f'end {tag};', 'update storage.objects o set ' + ','.join(f'{name}=x.{name}' for name in fields) + f' from {expression} where o.bucket_id=x.bucket_id and o.name=x.name and o.id::text=x.target_id;', 'commit;']
    report = {'format': 'tapuai-storage-owner-plan/1', 'fields': fields, 'objectCount': len(rows),
              'targetUrl': target['targetUrl'], 'targetDatabase': target['databaseIdentity'],
              'authPreloadRequired': auth_preload, 'physicalIdsPreserved': True, 'appGuardsDisabled': False,
              'sqlExecuted': False, 'functionalAcceptance': 'not-run'}
    return '\n'.join(lines) + '\n', report


def logical_parity(source, target):
    """Validate keys, owners, MIME and size without SQL or network operations.

    API-created physical IDs remain target-owned. Byte readback and application
    policy/function/Auth acceptance are independent gates after this comparison.
    """
    result = {'format': 'tapuai-storage-logical-parity/1', 'passed': False, 'blockers': [],
              'physicalDifferences': {}, 'physicalIdsIntentionallyRetained': True,
              'byteHashesVerified': False, 'appGuardAcceptance': 'separate-database-parity',
              'functionalAcceptance': 'not-run'}
    if source['targetUrl'] == target['targetUrl'] or source['databaseIdentity'] == target['databaseIdentity']:
        result['blockers'].append('source-and-target-identity-not-distinct')
    try:
        before, after = logical_objects(source), logical_objects(target)
    except ValueError as error:
        result['blockers'].append(str(error))
        return result
    result['objectCount'] = len(before)
    if before.keys() != after.keys():
        result['blockers'].append('storage-key-coverage-mismatch')
    source_columns = {c['name']: c['type'] for c in source['columns']}
    target_columns = {c['name']: c['type'] for c in target['columns']}
    fields = [name for name in ('owner', 'owner_id') if name in source_columns or name in target_columns]
    result['ownerFields'] = fields
    if not fields or any(source_columns.get(name) != target_columns.get(name) for name in fields):
        result['blockers'].append('storage-owner-column-incompatible')
    owner_mismatch = metadata_mismatch = 0
    for key in before.keys() & after.keys():
        first, second = before[key], after[key]
        if any(first.get(name) != second.get(name) for name in fields):
            owner_mismatch += 1
        original, actual = first.get('metadata') or {}, second.get('metadata') or {}
        if original['mimetype'] != actual['mimetype'] or normalized_size(original['size']) != normalized_size(actual['size']):
            metadata_mismatch += 1
        for name in ('id', 'version', 'created_at', 'updated_at', 'last_accessed_at'):
            if first.get(name) != second.get(name):
                result['physicalDifferences'][name] = result['physicalDifferences'].get(name, 0) + 1
    if owner_mismatch:
        result['blockers'].append('storage-owner-mismatch')
    if metadata_mismatch:
        result['blockers'].append('storage-mime-or-size-mismatch')
    result.update(ownerMismatchCount=owner_mismatch, metadataMismatchCount=metadata_mismatch)
    result['passed'] = not result['blockers']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    snap = commands.add_parser('snapshot', help='Read-only Storage catalog from an explicitly confirmed isolated target')
    snap.add_argument('--env-file', required=True)
    snap.add_argument('--confirm-isolated-target', required=True)
    snap.add_argument('--confirm-database-host', required=True)
    snap.add_argument('--out', required=True)
    plan = commands.add_parser('plan', help='Generate reviewed ownership SQL; never execute it')
    plan.add_argument('--stage', required=True)
    plan.add_argument('--target-catalog', required=True)
    plan.add_argument('--out', required=True)
    plan.add_argument('--report', required=True)
    compare = commands.add_parser('compare', help='Local logical parity; target backend IDs are retained')
    compare.add_argument('--source', required=True)
    compare.add_argument('--target', required=True)
    compare.add_argument('--report', required=True)
    args = parser.parse_args()
    try:
        os.umask(0o077)
        if args.command == 'snapshot':
            env = postgres_env(load_env(args.env_file))
            url = origin(env['SUPABASE_TARGET_URL'])
            if url != origin(args.confirm_isolated_target) or env['PGHOST'] != args.confirm_database_host:
                raise ValueError('Target confirmations differ from supplied connection')
            capture_catalog(env, url, args.out)
            print('Private read-only target Storage catalog captured; no ownership writes')
        elif args.command == 'compare':
            result = logical_parity(read_catalog(args.source), read_catalog(args.target))
            result.update(sourceCatalogSha256=digest(args.source), targetCatalogSha256=digest(args.target))
            json_write(external_path(args.report), result)
            print(json.dumps({'passed': result['passed'], 'blockers': result['blockers']}, sort_keys=True))
            return 0 if result['passed'] else 2
        else:
            from common import validate_manifest
            stage = external_path(args.stage)
            manifest = validate_manifest(stage)
            source = read_catalog(stage / 'storage-catalog.jsonl')
            target = read_catalog(args.target_catalog)
            if source['targetUrl'] != manifest['sourceUrl'] or source['databaseIdentity'] != manifest['sourceDatabase']:
                raise ValueError('Source Storage catalog does not match verified backup identity')
            inventory = json.loads((stage / 'storage-inventory.json').read_text())
            if set(objects(source)) != {(i['bucket_id'], i['name']) for i in inventory['objects']}:
                raise ValueError('Source Storage catalog/byte coverage differs')
            sql, report = ownership_plan(source, target)
            output = external_path(args.out)
            with output.open('x') as handle:
                handle.write(sql)
            output.chmod(0o600)
            report.update(sourceManifestSha256=digest(stage / 'manifest.json'), targetCatalogSha256=digest(args.target_catalog),
                          sqlSha256=digest(output))
            json_write(external_path(args.report), report)
            print('Private ownership SQL plan written; apply only after independent review and before app guards')
        return 0
    except Exception as error:
        print('Storage reconciliation refused: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
