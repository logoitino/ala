#!/usr/bin/env python3
"""Create an encrypted portable Supabase backup, failing if any source component is missing.

Writes only to private external staging and an external archive directory. Captures all
database schemas, all Storage buckets/bytes, allowed source and optional operator custody.
Online runs are time-window copies; only a recorded write freeze can make a cutover backup.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile
import uuid

from common import (ROOT, Storage, age_envelope, digest, external_path, json_write, load_env,
                    postgres_env, private_file, require_tools, run, storage_signature)

INVENTORY_SQL = """
select json_build_object(
 'serverVersion', current_setting('server_version'),
 'database', current_database(),
 'extensions', (select coalesce(json_agg(json_build_object('name',extname,'version',extversion)), '[]'::json) from pg_extension),
 'roles', (select coalesce(json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'canLogin',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls)), '[]'::json) from pg_roles),
 'memberships', (select coalesce(json_agg(json_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'adminOption',admin_option)), '[]'::json) from pg_auth_members),
 'tables', (select coalesce(json_agg(json_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity)), '[]'::json) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%'),
 'buckets', (select coalesce(json_agg(json_build_object('id',id)), '[]'::json) from storage.buckets),
 'objects', (select coalesce(json_agg(json_build_object('id',id,'bucket_id',bucket_id,'name',name,'owner',to_jsonb(o)->'owner','owner_id',to_jsonb(o)->'owner_id')), '[]'::json) from storage.objects o)
);
"""


def inventory(env):
    # No raw pg_authid/password export; credentials live only in optional encrypted custody.
    result = run(['psql', '-X', '--no-password', '--tuples-only', '--no-align',
                  '--set=ON_ERROR_STOP=1', '--command', INVENTORY_SQL], env=env)
    return json.loads(result.stdout)


def reconcile(database, buckets, objects):
    if {b['id'] for b in database['buckets']} != {b['id'] for b in buckets}:
        raise ValueError('Database and Storage API disagree on bucket coverage')
    db_objects = {(str(o['id']), o['bucket_id'], o['name']) for o in database['objects']}
    api_objects = {(str(o['id']), o['bucket_id'], o['name']) for o in objects}
    if len(api_objects) != len(objects) or db_objects != api_objects:
        raise ValueError('Database and Storage API disagree on object coverage; retry during a write freeze')


def create_backup(args):
    os.umask(0o077)
    env = postgres_env(load_env(args.env_file))
    # Import at call time: the job owns this identity contract and imports this capture module itself.
    from job import source_binding_hash, source_identity_from_env
    source_binding = source_identity_from_env(env)
    source_binding_sha256 = source_binding_hash(source_binding)
    require_tools('age', 'pg_dump', 'pg_restore', 'psql', 'node')
    if args.consistency == 'quiesced' and not args.quiescence_reference:
        raise ValueError('Quiesced backup requires an operator write-freeze evidence reference')
    recipients = private_file(args.recipients_file)
    if not recipients.read_text().strip():
        raise ValueError('Empty age recipient file')
    output_dir = external_path(args.output_dir)
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    if output_dir.stat().st_mode & 0o077:
        raise ValueError('Backup output directory must have mode 700')
    started = datetime.now(timezone.utc).isoformat()
    archive_name = 'tapuai-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8] + '.tar.age'
    final = output_dir / archive_name
    partial = output_dir / (archive_name + '.partial')
    try:
        with tempfile.TemporaryDirectory(prefix='.tapuai-stage-', dir=output_dir) as temporary:
            work = Path(temporary)
            db = inventory(env)
            json_write(work / 'database-inventory.json', db)
            run(['pg_dump', '--no-password', '--format=custom', '--file', str(work / 'database.dump')], env=env)
            with (work / 'database.toc').open('xb') as toc:
                run(['pg_restore', '--list', str(work / 'database.dump')], env=env, stdout=toc)
            (work / 'source').mkdir(mode=0o700)
            source_result = json.loads(run(['node', str(ROOT / 'infrastructure/backup/source_capture.mjs'),
                                           'capture', str(work / 'source')], env=env).stdout)
            shutil.move(source_result['capsulePath'], work / 'source.tapuai.gz')
            shutil.move(source_result['metadataPath'], work / 'source.metadata.json')
            (work / 'source').rmdir()
            storage = Storage(env.get('SUPABASE_SOURCE_URL'), env.get('SUPABASE_SOURCE_SERVICE_ROLE_KEY'))
            buckets = storage.buckets()
            objects = [item for bucket in buckets for item in storage.objects(bucket['id'])]
            reconcile(db, buckets, objects)
            (work / 'objects').mkdir(mode=0o700)
            for item in objects:
                identity = json.dumps([item['bucket_id'], item['name']], separators=(',', ':')).encode()
                import hashlib
                item['payload'] = 'objects/' + hashlib.sha256(identity).hexdigest()
                payload = work / item['payload']
                storage.download(item['bucket_id'], item['name'], payload)
                size = (item.get('metadata') or {}).get('size')
                if size is not None and int(size) != payload.stat().st_size:
                    raise ValueError('Downloaded Storage file size differs from inventory')
            after_buckets = storage.buckets()
            after_objects = [item for bucket in after_buckets for item in storage.objects(bucket['id'])]
            if buckets != after_buckets or storage_signature(objects) != storage_signature(after_objects):
                raise ValueError('Storage changed during backup; retry during a write freeze')
            reconcile(inventory(env), after_buckets, after_objects)
            # Full source catalog is diagnostic encrypted evidence. Only logical ownership can
            # be reconciled later; copying source IDs/backend versions breaks API-restored bytes.
            import sys
            sys.path.insert(0, str(ROOT / 'infrastructure/migration'))
            from storage_reconcile import capture_catalog, objects as catalog_objects
            source_catalog = capture_catalog(env, storage.url, work / 'storage-catalog.jsonl')
            if {(row['bucket_id'], row['name']) for row in source_catalog['objects']} != {(row['bucket_id'], row['name']) for row in after_objects}:
                raise ValueError('Storage catalog and byte coverage changed; retry during a write freeze')
            catalog_objects(source_catalog)  # Duplicate/malformed identities fail before encryption.
            def ownership(rows):
                return sorted((str(row['id']), row['bucket_id'], row['name'], row.get('owner'), row.get('owner_id')) for row in rows)
            if ownership(db['objects']) != ownership(source_catalog['objects']):
                raise ValueError('Storage ownership changed since DB inventory; retry during a write freeze')
            json_write(work / 'storage-inventory.json', {'buckets': buckets, 'objects': objects})
            if args.custody_file:
                custody = private_file(args.custody_file)
                # Operator-owned config/keys can be arbitrary JSON but remain inside encryption.
                json.loads(custody.read_text())
                shutil.copyfile(custody, work / 'custody.json')
            files = [{'path': str(p.relative_to(work)), 'size': p.stat().st_size, 'sha256': digest(p)}
                     for p in sorted(work.rglob('*')) if p.is_file()]
            manifest = {
                'format': 'tapuai-full-backup', 'version': 1, 'startedAt': started,
                'finishedAt': datetime.now(timezone.utc).isoformat(), 'sourceUrl': storage.url,
                'sourceBinding': source_binding, 'sourceBindingSha256': source_binding_sha256,
                'sourceDatabase': {key: env.get(key, '5432' if key == 'PGPORT' else '') for key in ('PGHOST', 'PGPORT', 'PGDATABASE')},
                'consistency': args.consistency, 'quiescenceReference': args.quiescence_reference,
                'bucketCount': len(buckets), 'objectCount': len(objects), 'files': files,
                'codeVerification': source_result['metadata']['verification'],
                'configurationCustody': 'operator-supplied' if args.custody_file else 'not-included',
                'restoreRehearsal': 'not-run', 'databaseClusterPasswords': 'not-exported',
                'crossStoreAtomicSnapshot': False, 'storageCatalog': 'encrypted-full-source-rows',
            }
            json_write(work / 'manifest.json', manifest)
            tar_path = work / 'payload.tar'
            with tarfile.open(tar_path, 'w:') as archive:
                for name in ['manifest.json'] + [item['path'] for item in files]:
                    archive.add(work / name, arcname=name, recursive=False)
            run(['age', '--encrypt', '--recipients-file', str(recipients), '--output', str(partial), str(tar_path)], env=env)
            if partial.stat().st_size == 0:
                raise ValueError('Encryption produced an empty artifact')
            with partial.open('rb') as handle:
                if not age_envelope(handle.read(64 * 1024)):
                    raise ValueError('Encryption produced an invalid binary age-v1 envelope')
            with partial.open('rb') as handle:
                os.fsync(handle.fileno())
            partial.rename(final)
            checksum = digest(final)
            with (output_dir / (archive_name + '.sha256')).open('x') as handle:
                handle.write(checksum + '  ' + archive_name + '\n')
            return {'archive': str(final), 'sha256': checksum, 'bucketCount': len(buckets),
                    'sourceBinding': source_binding, 'sourceBindingSha256': source_binding_sha256,
                    'objectCount': len(objects), 'consistency': args.consistency,
                    'configurationCustody': manifest['configurationCustody'], 'restoreRehearsal': 'not-run'}
    except BaseException:
        partial.unlink(missing_ok=True)
        # Final exists only after every payload was captured and encryption succeeded.
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file')
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--recipients-file', required=True)
    parser.add_argument('--consistency', choices=['online', 'quiesced'], default='online')
    parser.add_argument('--quiescence-reference')
    parser.add_argument('--custody-file')
    args = parser.parse_args()
    try:
        print(json.dumps(create_backup(args), sort_keys=True))
    except Exception as error:
        # Avoid provider text and credentials in unattended job logs.
        print('Backup failed: ' + (str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
