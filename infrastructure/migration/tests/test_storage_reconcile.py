"""Synthetic Storage restore phase checks: historical guards and physical backend IDs remain protected."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import storage_reconcile
import restore
import common


OWNER = '00000000-0000-4000-8000-000000000001'


def catalog(identifier, url, host, owner=OWNER):
    return {'format': 'tapuai-storage-catalog/1', 'targetUrl': url,
            'databaseIdentity': {'PGHOST': host, 'PGPORT': '5432', 'PGDATABASE': 'postgres'},
            'columns': [{'name': 'owner', 'type': 'uuid'}, {'name': 'owner_id', 'type': 'text'}],
            'triggers': [], 'foreignKeys': [],
            'objects': [{'id': identifier, 'bucket_id': 'beyond_game', 'name': "nested/a'b.mp4",
                         'owner': owner, 'owner_id': owner, 'version': 'physical-target-version',
                         'metadata': {'mimetype': 'video/mp4', 'size': 3}}]}


class StoragePlanTests(unittest.TestCase):
    def test_plan_restores_owners_only_and_preserves_target_backend_identifiers(self):
        source = catalog('source-id', 'https://source.example', 'source')
        target = catalog('target-id', 'https://target.example', 'target', None)
        sql, report = storage_reconcile.ownership_plan(source, target)
        self.assertIn('set owner=', sql)
        self.assertIn('owner_id=', sql)
        self.assertNotIn('set id=', sql)
        self.assertNotIn('set version=', sql)
        self.assertIn("a''b.mp4", sql)
        self.assertIn('target-id', sql)
        self.assertIn('not t.tgisinternal', sql)
        self.assertEqual(report['fields'], ['owner', 'owner_id'])
        self.assertFalse(report['sqlExecuted'])
        self.assertEqual(report['functionalAcceptance'], 'not-run')

    def test_app_guards_prevent_plan_instead_of_being_disabled(self):
        source = catalog('source-id', 'https://source.example', 'source')
        target = catalog('target-id', 'https://target.example', 'target')
        target['triggers'] = [{'name': 'beyond_storage_guard', 'functionSchema': 'public', 'enabled': 'O'}]
        with self.assertRaisesRegex(ValueError, 'before application guards'):
            storage_reconcile.ownership_plan(source, target)

    def test_version_columns_and_coverage_must_be_reviewed(self):
        source = catalog('source-id', 'https://source.example', 'source')
        target = catalog('target-id', 'https://target.example', 'target')
        target['columns'][0]['type'] = 'text'
        with self.assertRaisesRegex(ValueError, 'owner column'):
            storage_reconcile.ownership_plan(source, target)
        target = catalog('target-id', 'https://target.example', 'target')
        target['objects'].append(copy.deepcopy(target['objects'][0]))
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            storage_reconcile.ownership_plan(source, target)
        target['objects'] = []
        with self.assertRaisesRegex(ValueError, 'coverage'):
            storage_reconcile.ownership_plan(source, target)

    def test_same_source_url_or_database_is_refused(self):
        source = catalog('source-id', 'https://source.example', 'source')
        for target in [catalog('target-id', source['targetUrl'], 'target'), catalog('target-id', 'https://target.example', 'source')]:
            with self.assertRaisesRegex(ValueError, 'source'):
                storage_reconcile.ownership_plan(source, target)

    def test_foreign_key_owner_requires_auth_preload_and_script_retains_assertion(self):
        source = catalog('source-id', 'https://source.example', 'source')
        target = catalog('target-id', 'https://target.example', 'target')
        target['foreignKeys'] = [{'columns': ['owner'], 'targetSchema': 'auth', 'targetTable': 'users'}]
        sql, report = storage_reconcile.ownership_plan(source, target)
        self.assertTrue(report['authPreloadRequired'])
        self.assertIn('auth.users', sql)
        self.assertIn('Auth owners must be preloaded', sql)

    def test_target_content_metadata_must_match_reserved_source_file(self):
        source = catalog('source-id', 'https://source.example', 'source')
        target = catalog('target-id', 'https://target.example', 'target')
        target['objects'][0]['metadata']['mimetype'] = 'application/octet-stream'
        with self.assertRaisesRegex(ValueError, 'logical metadata'):
            storage_reconcile.ownership_plan(source,target)

    def test_dollar_delimiter_in_quoted_object_name_cannot_terminate_do_block(self):
        source = catalog('source-id','https://source.example','source')
        target = catalog('target-id','https://target.example','target')
        hostile="nested/a'$tapuai_storage$'; raise exception 'bad'; --.mp4"
        source['objects'][0]['name']=target['objects'][0]['name']=hostile
        sql,_=storage_reconcile.ownership_plan(source,target)
        opener=next(line for line in sql.splitlines() if line.startswith('do ')).split()[1]
        self.assertNotEqual(opener,'$tapuai_storage$')
        self.assertNotIn(opener,hostile)
        self.assertEqual(sql.count(opener),2)
        self.assertIn("a''$tapuai_storage$'';",sql)

    def test_auth_owner_id_fk_checks_owner_id_not_unrelated_owner(self):
        source=catalog('source-id','https://source.example','source')
        target=catalog('target-id','https://target.example','target')
        target['foreignKeys']=[{'columns':['owner_id'],'targetSchema':'auth','targetTable':'users'}]
        sql,report=storage_reconcile.ownership_plan(source,target)
        self.assertIn('u.id::text=x.owner_id::text',sql)
        self.assertNotIn('u.id::text=x.owner::text',sql)

    def test_logical_parity_accepts_new_backend_ids_but_blocks_owner_or_file_changes(self):
        source=catalog('source-id','https://source.example','source')
        target=catalog('target-id','https://target.example','target')
        result=storage_reconcile.logical_parity(source,target)
        self.assertTrue(result['passed'])
        self.assertEqual(result['physicalDifferences']['id'],1)
        target['objects'][0]['owner']=None
        self.assertFalse(storage_reconcile.logical_parity(source,target)['passed'])

    def test_two_sided_missing_values_never_produce_logical_parity_or_null_owner_plan(self):
        for missing in ('owner', 'owner_id', 'metadata'):
            source=catalog('source-id','https://source.example','source')
            target=catalog('target-id','https://target.example','target')
            source['objects'][0].pop(missing)
            target['objects'][0].pop(missing)
            self.assertFalse(storage_reconcile.logical_parity(source,target)['passed'])
            with self.assertRaises(ValueError):
                storage_reconcile.ownership_plan(source,target)

    def test_metadata_requires_known_mime_and_finite_nonnegative_size_and_normalizes_numbers(self):
        source=catalog('source-id','https://source.example','source')
        target=catalog('target-id','https://target.example','target')
        target['objects'][0]['metadata']['size']='3.0'
        self.assertTrue(storage_reconcile.logical_parity(source,target)['passed'])
        for value in (True, None, -1, float('inf'), 'NaN', ''):
            source['objects'][0]['metadata']['size']=value
            target['objects'][0]['metadata']['size']=value
            self.assertFalse(storage_reconcile.logical_parity(source,target)['passed'])
        target=catalog('target-id','https://target.example','target')
        target['objects'][0]['metadata']['size']=4
        self.assertFalse(storage_reconcile.logical_parity(source,target)['passed'])


class CatalogCaptureTests(unittest.TestCase):
    def test_readonly_capture_streams_private_jsonl_and_never_materializes_subprocess_stdout(self):
        with tempfile.TemporaryDirectory() as tmp:
            filename = Path(tmp) / 'catalog.jsonl'
            env = {'PGHOST': '127.0.0.1', 'PGDATABASE': 'target', 'PGUSER': 'postgres'}
            def fake_run(command, env=None, stdout=None):
                self.assertIn('read only', command[-1])
                self.assertIn('row_security=off', command[-1])
                self.assertIsNotNone(stdout)
                stdout.write(b'{"columns":[],"triggers":[],"foreignKeys":[]}\n')
                stdout.write(b'{"object":{"id":"1","bucket_id":"a","name":"b"}}\n')
            with patch.object(storage_reconcile, 'require_tools'), patch.object(storage_reconcile, 'run', side_effect=fake_run):
                result = storage_reconcile.capture_catalog(env, 'http://127.0.0.1:8000', filename)
            self.assertEqual(result['objects'][0]['id'], '1')
            self.assertEqual(filename.stat().st_mode & 0o777, 0o600)

    def test_failed_catalog_capture_leaves_no_accepted_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            filename = Path(tmp) / 'catalog.jsonl'
            with patch.object(storage_reconcile, 'require_tools'), patch.object(storage_reconcile, 'run', side_effect=RuntimeError('synthetic')):
                with self.assertRaises(RuntimeError):
                    storage_reconcile.capture_catalog({'PGHOST':'target'}, 'https://target.example', filename)
            self.assertFalse(filename.exists())


class PreloadTests(unittest.TestCase):
    def test_preload_executes_no_database_restore_and_returns_pending_ownership_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent = Path(tmp)
            stage = parent / 'stage'
            stage.mkdir()
            (stage / 'manifest.json').write_text('{}')
            (stage / 'storage-inventory.json').write_text('{"buckets":[],"objects":[]}')
            manifest = {'sourceUrl': 'https://source.example', 'sourceDatabase': {'PGHOST': 'source', 'PGPORT': '5432', 'PGDATABASE': 'postgres'}}
            env = {'PGHOST': '127.0.0.1', 'PGDATABASE': 'target', 'PGUSER': 'postgres',
                   'SUPABASE_TARGET_URL': 'http://127.0.0.1:8000', 'SUPABASE_TARGET_SERVICE_ROLE_KEY': 'synthetic'}
            args = argparse.Namespace(stage=str(stage), env_file=None, confirm_isolated_target=env['SUPABASE_TARGET_URL'],
                    confirm_database_host=env['PGHOST'], use_list='reviewed', execute=True, storage=True,
                    storage_before_database=True, storage_only=False, database_receipt=None)
            with patch.object(restore, 'validate_manifest', return_value=manifest), patch.object(restore, 'load_env', return_value=env), \
                 patch.object(restore, 'reviewed_list', return_value=['entry']), patch.object(restore, 'require_tools'), \
                 patch.object(restore, 'Storage') as storage, patch.object(restore, 'run') as run, \
                 patch.object(storage_reconcile, 'read_target_catalog', return_value=catalog('target', env['SUPABASE_TARGET_URL'], '127.0.0.1')), \
                 patch.object(storage_reconcile, 'read_catalog', return_value={**catalog('source', manifest['sourceUrl'], 'source'), 'objects': []}):
                storage.return_value.buckets.return_value = []
                result = restore.restore(args)
                self.assertFalse(result['databaseRestored'])
                self.assertTrue(result['storageRestored'])
                self.assertEqual(result['storageOwnership'], 'pending-reviewed-reconciliation')
                self.assertTrue(all(c.args[0][0] != 'pg_restore' for c in run.call_args_list))
                self.assertEqual(json.loads(Path(result['receipt']).read_text())['phase'], 'storage-bytes-preloaded')

    def test_database_continuation_requires_bound_preload_receipt_and_skips_upload(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent = Path(tmp)
            stage = parent / 'stage'
            stage.mkdir()
            (stage / 'manifest.json').write_text('{}')
            (stage / 'storage-inventory.json').write_text('{"buckets":[],"objects":[]}')
            manifest = {'sourceUrl': 'https://source.example', 'sourceDatabase': {'PGHOST': 'source'}}
            env = {'PGHOST':'127.0.0.1','PGDATABASE':'target','PGUSER':'postgres','SUPABASE_TARGET_URL':'http://127.0.0.1:8000'}
            receipt = parent / 'preload.json'
            value = {'phase':'storage-bytes-preloaded','targetUrl':env['SUPABASE_TARGET_URL'],
                     'sourceManifestSha256':common.digest(stage / 'manifest.json'),
                     'selectedTocSha256':hashlib.sha256(b'entry\n').hexdigest(),
                     'targetDatabase':{'PGHOST':'127.0.0.1','PGPORT':'5432','PGDATABASE':'target'}}
            common.json_write(receipt,value)
            args = argparse.Namespace(stage=str(stage),env_file=None,use_list='reviewed',execute=True,storage=False,
                    confirm_isolated_target=env['SUPABASE_TARGET_URL'],confirm_database_host=env['PGHOST'],
                    storage_preload_receipt=str(receipt),storage_before_database=False,storage_only=False)
            with patch.object(restore,'validate_manifest',return_value=manifest), patch.object(restore,'load_env',return_value=env), \
                 patch.object(restore,'reviewed_list',return_value=['entry']),patch.object(restore,'require_tools'), \
                 patch.object(restore,'run') as run,patch.object(restore,'Storage') as storage:
                result = restore.restore(args)
                self.assertTrue(result['databaseRestored'])
                self.assertEqual(result['storageOwnership'],'requires-independent-acceptance')
                storage.assert_not_called()
                self.assertEqual(json.loads(Path(result['databaseReceipt']).read_text())['metadataReconciliation'],'requires-independent-acceptance')
                run.reset_mock()
                value['targetUrl']='https://other.example'
                receipt.write_text(json.dumps(value))
                with self.assertRaisesRegex(ValueError,'Preload receipt does not match'):
                    restore.restore(args)
                self.assertTrue(all(c.args[0][0]!='pg_restore' for c in run.call_args_list))

    def test_default_db_then_upload_is_refused_for_historical_guarded_files_before_sql(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage=Path(tmp)
            (stage/'manifest.json').write_text('{}')
            (stage/'storage-inventory.json').write_text('{"buckets":[],"objects":[{"bucket_id":"beyond_game"}]}')
            manifest={'sourceUrl':'https://source.example','sourceDatabase':{'PGHOST':'source'}}
            env={'PGHOST':'127.0.0.1','PGDATABASE':'target','PGUSER':'postgres','SUPABASE_TARGET_URL':'http://127.0.0.1:8000'}
            args=argparse.Namespace(stage=str(stage),env_file=None,use_list='reviewed',execute=True,storage=True,
                confirm_isolated_target=env['SUPABASE_TARGET_URL'],confirm_database_host=env['PGHOST'])
            with patch.object(restore,'validate_manifest',return_value=manifest),patch.object(restore,'load_env',return_value=env), \
                 patch.object(restore,'reviewed_list',return_value=['entry']),patch.object(restore,'require_tools'), \
                 patch.object(restore,'run') as run,patch.object(restore,'Storage') as storage:
                with self.assertRaisesRegex(ValueError,'Historical guarded files require'):
                    restore.restore(args)
                storage.assert_not_called()
                self.assertTrue(all(c.args[0][0]!='pg_restore' for c in run.call_args_list))


if __name__ == '__main__':
    unittest.main()
