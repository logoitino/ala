"""Source changes at an unchanged private path cannot inherit another source's successful backup."""
from copy import deepcopy
import argparse
import json
import os
from pathlib import Path
import sys
import subprocess
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import job
import backup
import status
import test_job as fixture_module


class SourceIdentityTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixture_module.JobTests('test_all_destinations_are_required_before_latest_success')
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.env = self.fixture.env_file
        self.original = self.env.read_text()

    def write_env(self, text):
        self.env.write_text(text)
        self.env.chmod(0o600)

    def capture(self):
        with patch.object(job.backup, 'create_backup', side_effect=self.fixture.capture), \
             patch.object(job.publish, 'publish', side_effect=self.fixture.upload):
            return job.run_job(self.fixture.config_file)

    def test_safe_binding_is_normalized_and_secret_rotation_does_not_change_it(self):
        config = job.load_config(self.fixture.config_file)
        binding = job.source_identity(config)
        self.assertEqual(binding, {'supabaseUrl': 'https://abcdefghijklmnopqrst.supabase.co',
                                  'databaseIdentity': {'PGHOST': 'db.abcdefghijklmnopqrst.supabase.co',
                                      'PGPORT': '5432', 'PGDATABASE': 'postgres', 'PGUSER': 'postgres'}})
        self.write_env(self.original.replace('PGPORT=5432', 'PGPORT=05432')
                       + 'PGPASSWORD=PRIVATE_PASSWORD\nSUPABASE_SOURCE_SERVICE_ROLE_KEY=PRIVATE_SERVICE_KEY\n')
        self.assertEqual(job.source_identity(config), binding)
        self.assertEqual(job.source_binding_hash(job.source_identity(config)), job.source_binding_hash(binding))
        self.assertNotIn('PRIVATE_', json.dumps(binding))
        record = self.capture()
        result = status.check_status(self.fixture.config_file, max_age_hours=10000)
        self.assertEqual(result['requiredProviders'], ['aws', 'azure'])
        self.assertTrue(result['healthy'])
        self.assertNotIn('PRIVATE_', json.dumps(record) + json.dumps(result))

    def test_each_source_field_change_invalidates_same_path_and_same_configuration_success(self):
        record = self.capture()
        config_hash = job.load_config(self.fixture.config_file)['configSha256']
        for before, after in [('abcdefghijklmnopqrst.supabase.co', 'zyxwvutsrqponmlkjihg.supabase.co'),
                              ('PGHOST=db.', 'PGHOST=pooler.'), ('PGPORT=5432', 'PGPORT=6543'),
                              ('PGDATABASE=postgres', 'PGDATABASE=app'), ('PGUSER=postgres', 'PGUSER=postgres.otherproject')]:
            with self.subTest(field=before):
                self.write_env(self.original.replace(before, after, 1))
                self.assertEqual(job.load_config(self.fixture.config_file)['configSha256'], config_hash)
                result = status.check_status(self.fixture.config_file, max_age_hours=10000)
                self.assertFalse(result['healthy'])
                self.assertIn('source-binding-mismatch', result['reasons'])
                self.assertEqual(self.fixture.read_state('latest-success.json'), record)

    def test_legacy_records_and_forged_binding_hash_fail_closed(self):
        record = self.capture()
        for mutate in (lambda value: value.pop('sourceBinding'),
                       lambda value: value.pop('sourceBindingSha256'),
                       lambda value: value.update(sourceBindingSha256='0' * 64),
                       lambda value: value['sourceBinding'].update(secret='PRIVATE_SECRET')):
            altered = deepcopy(record)
            mutate(altered)
            for name in ['latest-success.json', 'latest-attempt.json']:
                (self.fixture.state / name).write_text(json.dumps(altered))
            result = status.check_status(self.fixture.config_file, max_age_hours=10000)
            self.assertFalse(result['healthy'])
            self.assertIn('invalid-source-binding', result['reasons'])
            self.assertNotIn('PRIVATE_SECRET', json.dumps(result))

    def test_missing_duplicate_placeholder_and_routing_overrides_are_invalid_without_secret_output(self):
        config = job.load_config(self.fixture.config_file)
        invalid = [self.original.replace('PGPORT=5432\n', ''), self.original.replace('PGUSER=postgres', 'PGUSER='),
                   self.original + 'PGHOST=other.example\n', self.original.replace('PGDATABASE=postgres', 'PGDATABASE=${PRIVATE_SECRET}'),
                   self.original.replace('abcdefghijklmnopqrst.supabase.co', 'YOUR_PROJECT.supabase.co'),
                   self.original.replace('PGHOST=db.abcdefghijklmnopqrst.supabase.co', 'PGHOST=host1,host2')]
        for key in ('PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS'):
            invalid.append(self.original + key + '=PRIVATE_SECRET\n')
        for text in invalid:
            with self.subTest(text=text.splitlines()[0]):
                self.write_env(text)
                with self.assertRaises(ValueError) as caught:
                    job.source_identity(config)
                self.assertNotIn('PRIVATE_SECRET', str(caught.exception))
        self.write_env(self.original)
        with patch.dict(os.environ, {'PGHOSTADDR': 'PRIVATE_SECRET'}), self.assertRaises(ValueError):
            job.source_identity(config)

    def test_retry_cannot_bind_a_legacy_archive_or_another_sources_original_capture(self):
        record = self.capture()
        original_run = self.fixture.state / 'runs' / (record['id'] + '.json')
        legacy = deepcopy(record)
        legacy.pop('sourceBinding')
        original_run.write_text(json.dumps(legacy))
        with patch.object(job.publish, 'publish') as upload, self.assertRaisesRegex(job.JobError, 'archive-source-unproven'):
            job.run_job(self.fixture.config_file, str(self.fixture.archive))
        upload.assert_not_called()
        original_run.write_text(json.dumps(record))
        self.write_env(self.original.replace('PGUSER=postgres', 'PGUSER=postgres.otherproject'))
        with patch.object(job.publish, 'publish') as upload, self.assertRaisesRegex(job.JobError, 'archive-source-unproven'):
            job.run_job(self.fixture.config_file, str(self.fixture.archive))
        upload.assert_not_called()

    def test_source_mutation_during_capture_is_failed_and_never_published(self):
        def capture_and_change(args):
            result = self.fixture.capture(args)
            self.write_env(self.original.replace('PGUSER=postgres', 'PGUSER=postgres.otherproject'))
            return result
        with patch.object(job.backup, 'create_backup', side_effect=capture_and_change), \
             patch.object(job.publish, 'publish') as upload, self.assertRaisesRegex(job.JobError, 'source-binding-changed'):
            job.run_job(self.fixture.config_file)
        upload.assert_not_called()
        self.assertFalse((self.fixture.state / 'latest-success.json').exists())

    def test_capture_reports_another_loaded_source_despite_unchanged_active_file_is_rejected(self):
        def different_actual_capture(args):
            result = self.fixture.capture(args)
            binding = deepcopy(result['sourceBinding'])
            binding['databaseIdentity']['PGUSER'] = 'postgres.otherproject'
            result.update(sourceBinding=binding, sourceBindingSha256=job.source_binding_hash(binding))
            return result
        with patch.object(job.backup, 'create_backup', side_effect=different_actual_capture), \
             patch.object(job.publish, 'publish') as upload, self.assertRaisesRegex(job.JobError, 'source-binding-changed'):
            job.run_job(self.fixture.config_file)
        upload.assert_not_called()
        self.assertEqual(self.env.read_text(), self.original)
        self.assertFalse((self.fixture.state / 'latest-success.json').exists())

    def test_capture_result_and_encrypted_manifest_bind_exact_loaded_environment(self):
        # Every external command is synthetic; the real capture orchestration derives identity from its one loaded env.
        loaded = {'SUPABASE_SOURCE_URL': 'https://zyxwvutsrqponmlkjihg.supabase.co',
                  'SUPABASE_SOURCE_SERVICE_ROLE_KEY': 'PRIVATE_SERVICE_KEY', 'PGPASSWORD': 'PRIVATE_PASSWORD',
                  'PGHOST': 'db.zyxwvutsrqponmlkjihg.supabase.co', 'PGPORT': '5432', 'PGDATABASE': 'postgres',
                  'PGUSER': 'postgres.actualproject', 'PGSSLMODE': 'verify-full'}
        expected = job.source_identity_from_env(loaded)
        recipients = self.fixture.directory / 'synthetic-recipients.txt'
        recipients.write_text('synthetic-public-recipient\n')
        recipients.chmod(0o600)
        captured_manifest = {}
        def run(command, env=None, stdout=None):
            if command[0] == 'pg_dump':
                Path(command[-1]).write_bytes(b'synthetic database')
            elif command[0] == 'pg_restore':
                stdout.write(b'; synthetic original TOC\n')
            elif command[0] == 'node':
                directory = Path(command[-1])
                capsule, metadata = directory / 'source.gz', directory / 'source.metadata.json'
                capsule.write_bytes(b'synthetic source capsule'); metadata.write_text('{}')
                return subprocess.CompletedProcess(command, 0, json.dumps({'capsulePath': str(capsule),
                    'metadataPath': str(metadata), 'metadata': {'verification': 'not-run'}}).encode())
            elif command[0] == 'age':
                captured_manifest.update(json.loads((Path(command[-1]).parent / 'manifest.json').read_text()))
                Path(command[command.index('--output') + 1]).write_bytes(self.fixture.archive.read_bytes())
            return subprocess.CompletedProcess(command, 0, b'')
        sys.path.insert(0, str(Path(job.__file__).resolve().parents[1] / 'migration'))
        import storage_reconcile
        args = argparse.Namespace(env_file=str(self.env), output_dir=str(self.fixture.output), recipients_file=str(recipients),
                                  consistency='online', quiescence_reference=None, custody_file=None)
        with patch.object(backup, 'load_env', return_value=loaded) as load, patch.object(backup, 'require_tools'), \
             patch.object(backup, 'inventory', return_value={'buckets': [], 'objects': []}), \
             patch.object(backup, 'run', side_effect=run), patch.object(backup, 'Storage') as storage, \
             patch.object(storage_reconcile, 'capture_catalog', return_value={'objects': []}), \
             patch.object(storage_reconcile, 'objects', return_value=[]):
            storage.return_value.url = expected['supabaseUrl']
            storage.return_value.buckets.return_value = []
            result = backup.create_backup(args)
        load.assert_called_once()
        self.assertEqual(result['sourceBinding'], expected)
        self.assertEqual(captured_manifest['sourceBinding'], expected)
        self.assertEqual(result['sourceBindingSha256'], job.source_binding_hash(expected))
        self.assertNotIn('PRIVATE_', json.dumps(result) + json.dumps(captured_manifest))
        self.assertNotEqual(result['sourceBinding'], job.source_identity(job.load_config(self.fixture.config_file)))


if __name__ == '__main__':
    unittest.main()
