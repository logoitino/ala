#!/usr/bin/env python3
"""Restore verified data ONLY with a reviewed pg_restore list and explicit target assertions.

Defaults to a plan. An operator must provision an isolated compatible Supabase stack,
disable outgoing payments/email and review service-owned schemas, triggers and ACLs.
Database restore is transactional; Storage restore is resumable and is not transactional.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
import uuid

from common import (ROOT, Storage, digest, external_path, json_write, load_env, origin,
                    postgres_env, require_tools, run, validate_manifest)


def reviewed_list(stage, filename):
    """TOC items must match the dump exactly; omission/commenting is the only accepted edit."""
    original = (stage / 'database.toc').read_text().splitlines()
    available = {line.rstrip() for line in original if re.match(r'^\d+;', line)}
    selected, seen = [], set()
    for line in Path(filename).read_text().splitlines():
        if not line.strip() or line.lstrip().startswith(';'):
            continue
        if line.rstrip() not in available or line in seen:
            raise ValueError('Reviewed restore list has modified, duplicate or unknown TOC entries')
        seen.add(line)
        selected.append(line)
    if not selected:
        raise ValueError('Reviewed restore list selects no entries')
    return selected


def target_checks(manifest, env, target_url, database_host):
    url = origin(env.get('SUPABASE_TARGET_URL'))
    if url != origin(target_url) or url == origin(manifest['sourceUrl']):
        raise ValueError('Restore URL must match the confirmed isolated target and differ from the backup source')
    if env['PGHOST'] != database_host:
        raise ValueError('PostgreSQL host differs from the confirmed target host')
    source = manifest.get('sourceDatabase')
    if not source:
        raise ValueError('Missing source database identity; cannot guard restore')
    target = {key: env.get(key, '5432' if key == 'PGPORT' else '') for key in ('PGHOST', 'PGPORT', 'PGDATABASE')}
    if source == target:
        raise ValueError('Refusing to restore onto the source database connection')
    return url


def restore(args):
    os.umask(0o077)
    stage = external_path(args.stage)
    manifest = validate_manifest(stage)
    env = postgres_env(load_env(args.env_file))
    url = target_checks(manifest, env, args.confirm_isolated_target, args.confirm_database_host)
    selected = reviewed_list(stage, args.use_list)
    plan = {'targetUrl': url, 'selectedTocEntries': len(selected), 'storageRequested': args.storage,
            'databaseRestored': False, 'executed': False, 'isolatedByOperatorAssertion': True,
            'automaticLiveCutover': False}
    storage_only = getattr(args, 'storage_only', False)
    before_database = getattr(args, 'storage_before_database', False)
    preload_receipt = getattr(args, 'storage_preload_receipt', None)
    if before_database and (not args.storage or storage_only or preload_receipt):
        raise ValueError('Pre-database bytes require --storage and cannot combine resume modes')
    if preload_receipt and (args.storage or storage_only):
        raise ValueError('Preloaded DB continuation must not upload bytes again')
    plan['storageBeforeDatabase'] = before_database
    if storage_only and not args.storage:
        raise ValueError('Storage-only resume requires --storage')
    if not args.execute:
        plan['storageOnlyResume'] = storage_only
        return plan
    require_tools('pg_restore', 'node')
    # A modified stage cannot bypass source capsule verification before database writes.
    run(['node', str(ROOT / 'infrastructure/backup/source_capture.mjs'), 'verify', str(stage / 'source.tapuai.gz')])
    storage_data = json.loads((stage / 'storage-inventory.json').read_text())
    if args.storage and not before_database and any(item.get('bucket_id') in ('beyond_game', 'fan_zone') for item in storage_data['objects']):
        raise ValueError('Historical guarded files require a fresh --storage-before-database phase; never disable guards or replay these after DB restore')
    storage = None
    if args.storage:
        storage = Storage(url, env.get('SUPABASE_TARGET_SERVICE_ROLE_KEY'))
        # Supabase API and PostgreSQL are independent env fields. Their common target must be
        # checked in the runbook; URL/host assertions alone cannot prove infrastructure isolation.
        actual_buckets = {b['id']: b for b in storage.buckets()}
        for bucket in storage_data['buckets']:
            if bucket['id'] in actual_buckets:
                actual = actual_buckets[bucket['id']]
                for field in ('public', 'file_size_limit', 'allowed_mime_types'):
                    if actual.get(field) != bucket.get(field):
                        raise ValueError('Target bucket visibility/upload rules differ from the backup')
    selection_hash = __import__('hashlib').sha256(('\n'.join(selected) + '\n').encode()).hexdigest()
    recovery_identity = {
        'targetUrl': url, 'sourceManifestSha256': digest(stage / 'manifest.json'),
        'selectedTocSha256': selection_hash,
        'targetDatabase': {key: env.get(key, '5432' if key == 'PGPORT' else '') for key in ('PGHOST', 'PGPORT', 'PGDATABASE')},
    }
    # Copy the approved selection privately so a concurrent edit cannot change execution.
    import tempfile
    if before_database:
        sys.path.insert(0, str(ROOT / 'infrastructure/migration'))
        import storage_reconcile
        source_catalog = storage_reconcile.read_catalog(stage / 'storage-catalog.jsonl')
        if source_catalog['targetUrl'] != manifest['sourceUrl'] or source_catalog['databaseIdentity'] != manifest['sourceDatabase']:
            raise ValueError('Source ownership catalog does not match this verified backup')
        if set(storage_reconcile.objects(source_catalog)) != {(i['bucket_id'], i['name']) for i in storage_data['objects']}:
            raise ValueError('Source ownership catalog and archived bytes have different coverage')
        storage_reconcile.assert_no_app_guards(storage_reconcile.read_target_catalog(env, url))
        database_receipt = None
    elif storage_only:
        from common import private_file
        if not getattr(args, 'database_receipt', None):
            raise ValueError('Storage-only resume requires the prior private --database-receipt')
        prior = json.loads(private_file(args.database_receipt).read_text())
        if prior.get('phase') != 'database-committed' or any(prior.get(key) != value for key, value in recovery_identity.items()):
            raise ValueError('Resume receipt does not match this backup, reviewed list and isolated target')
        database_receipt = Path(args.database_receipt)
    else:
        if preload_receipt:
            from common import private_file
            prior = json.loads(private_file(preload_receipt).read_text())
            if prior.get('phase') != 'storage-bytes-preloaded' or any(prior.get(key) != value for key, value in recovery_identity.items()):
                raise ValueError('Preload receipt does not match backup, reviewed list and isolated target')
        with tempfile.TemporaryDirectory(prefix='.tapuai-toc-', dir=stage.parent) as temporary:
            approved = Path(temporary) / 'approved.list'
            approved.write_text('\n'.join(selected) + '\n')
            run(['pg_restore', '--no-password', '--exit-on-error', '--single-transaction', '--no-owner',
                 '--use-list', str(approved), '--dbname', env['PGDATABASE'], str(stage / 'database.dump')], env=env)
        database_receipt = stage.parent / ('restore-database-' + uuid.uuid4().hex + '.json')
        json_write(database_receipt, {**recovery_identity, 'phase': 'database-committed',
                                     'committedAt': datetime.now(timezone.utc).isoformat(),
                                     'metadataReconciliation': 'requires-independent-acceptance',
                                     'storagePreloadReceipt': str(preload_receipt) if preload_receipt else None})
        print('Database committed; protected resume receipt: ' + str(database_receipt), file=sys.stderr)
    plan['databaseRestored'] = not before_database
    if storage:
        actual_buckets = {b['id']: b for b in storage.buckets()}
        for bucket in storage_data['buckets']:
            if bucket['id'] not in actual_buckets:
                body = {key: bucket[key] for key in ('id', 'name', 'public', 'file_size_limit', 'allowed_mime_types') if key in bucket}
                storage.request('bucket', json.dumps(body).encode(), 'POST', headers={'Content-Type': 'application/json'})
            else:
                for field in ('public', 'file_size_limit', 'allowed_mime_types'):
                    if actual_buckets[bucket['id']].get(field) != bucket.get(field):
                        raise ValueError('Restored database has bucket rules that differ from the backup')
        for item in storage_data['objects']:
            storage.upload(item, stage / item['payload'])
            # Verify bytes, including private buckets, instead of trusting an upload response.
            with tempfile.TemporaryDirectory(prefix='.tapuai-object-', dir=stage.parent) as temporary:
                downloaded = Path(temporary) / 'object'
                storage.download(item['bucket_id'], item['name'], downloaded)
                if digest(downloaded) != digest(stage / item['payload']):
                    raise ValueError('Restored Storage object hash differs from backup')
        actual_objects = [item for bucket in storage.buckets() for item in storage.objects(bucket['id'])]
        wanted = {(o['bucket_id'], o['name']) for o in storage_data['objects']}
        if {(o['bucket_id'], o['name']) for o in actual_objects} != wanted:
            raise ValueError('Target Storage contains missing or unexpected objects')
    if before_database:
        receipt = stage.parent / ('restore-storage-preload-' + uuid.uuid4().hex + '.json')
        plan.update({'executed': True, 'storageRestored': True,
                     'storageOwnership': 'pending-reviewed-reconciliation',
                     'phase': 'storage-bytes-preloaded', **recovery_identity,
                     'preloadedAt': datetime.now(timezone.utc).isoformat(),
                     'functionalAcceptance': 'not-run'})
        json_write(receipt, plan)
        plan['receipt'] = str(receipt)
        return plan
    plan.update({'executed': True, 'storageRestored': bool(storage) or bool(preload_receipt),
                 'storageOwnership': 'requires-independent-acceptance',
                 'restoredAt': datetime.now(timezone.utc).isoformat(), 'backupManifestSha256': digest(stage / 'manifest.json'),
                 'selectedTocSha256': selection_hash, 'databaseReceipt': str(database_receipt),
                 'storagePreloadReceipt': str(preload_receipt) if preload_receipt else None,
                 'qaSmokeTests': 'not-run', 'financialReconciliation': 'not-run'})
    receipt = stage.parent / ('restore-complete-' + uuid.uuid4().hex + '.json')
    json_write(receipt, plan)
    plan['receipt'] = str(receipt)
    return plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage')
    parser.add_argument('--env-file')
    parser.add_argument('--use-list', required=True)
    parser.add_argument('--confirm-isolated-target', required=True)
    parser.add_argument('--confirm-database-host', required=True)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--storage', action='store_true')
    parser.add_argument('--storage-before-database', action='store_true', help='Load bytes on a fresh isolated target before app guards; do not restore SQL in this phase')
    parser.add_argument('--storage-preload-receipt', help='Private pre-DB byte receipt for DB-only continuation after reviewed ownership reconciliation')
    parser.add_argument('--storage-only', action='store_true', help='Resume object uploads without reapplying committed SQL')
    parser.add_argument('--database-receipt', help='Private database-committed receipt required for storage-only resume')
    args = parser.parse_args()
    try:
        print(json.dumps(restore(args), sort_keys=True))
        return 0
    except Exception as error:
        print('Restore failed: ' + (str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__) +
              '; keep the target isolated; a Storage failure can follow a committed database restore', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
