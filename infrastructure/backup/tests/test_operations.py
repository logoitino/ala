"""Synthetic operator checks: stale snapshots, partial uploads and retrieved corruption.

Cloud downloads are mocked; these tests prove local control flow, not provider availability.
"""
import argparse
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fetch
import status
import job


class FreshnessTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 19, 12, tzinfo=timezone.utc)
        self.config = {'configSha256': 'config', 'destinations': [{'id': 'aws-copy', 'provider': 'aws'}, {'id': 'azure-copy', 'provider': 'azure'}]}
        binding = {'supabaseUrl': 'https://abcdefghijklmnopqrst.supabase.co', 'databaseIdentity': {
            'PGHOST': 'db.abcdefghijklmnopqrst.supabase.co', 'PGPORT': '5432', 'PGDATABASE': 'postgres', 'PGUSER': 'postgres'}}
        self.config.update(sourceBinding=binding, sourceBindingSha256=job.source_binding_hash(binding))
        self.success = {'schemaVersion': 1, 'id': 'run1', 'configSha256': 'config', 'status': 'succeeded',
                        'sourceBinding': binding, 'sourceBindingSha256': self.config['sourceBindingSha256'],
                        'archive': '/external/tapuai-20261019T110000Z-1234abcd.tar.age', 'sha256': 'a' * 64,
                        'archiveCapturedAt': (self.now - timedelta(hours=1)).isoformat(),
                        'finishedAt': (self.now - timedelta(minutes=30)).isoformat(),
                        'startedAt': (self.now - timedelta(hours=1)).isoformat(),
                        'destinations': [{'id': 'aws-copy', 'provider': 'aws', 'status': 'uploaded'},
                                         {'id': 'azure-copy', 'provider': 'azure', 'status': 'uploaded'}]}

    def test_complete_fresh_upload_is_healthy_without_claiming_remote_restore(self):
        result = status.assess(self.config, self.success, self.success, self.now)
        self.assertTrue(result['healthy'])
        self.assertFalse(result['providerContacted'])
        self.assertEqual(result['restoreRehearsal'], 'not-proven-by-job-state')

    def test_reupload_of_old_snapshot_does_not_reset_recovery_age(self):
        captured = self.now - timedelta(days=2)
        old = {**self.success, 'archive': '/external/tapuai-' + captured.strftime('%Y%m%dT%H%M%SZ') + '-1234abcd.tar.age',
               'archiveCapturedAt': captured.isoformat(), 'finishedAt': self.now.isoformat()}
        result = status.assess(self.config, old, old, self.now)
        self.assertFalse(result['healthy'])
        self.assertIn('snapshot-stale', result['reasons'])

    def test_missing_partial_duplicate_or_changed_destination_is_unhealthy(self):
        for destinations in ([], self.success['destinations'][:1], self.success['destinations'] * 2,
                             [{'id': 'changed', 'provider': 'aws', 'status': 'uploaded'}]):
            with self.subTest(destinations=destinations):
                item = {**self.success, 'destinations': destinations}
                self.assertFalse(status.assess(self.config, item, item, self.now)['healthy'])

    def test_new_failed_attempt_cannot_hide_behind_recent_success(self):
        attempt = {**self.success, 'id': 'run2', 'status': 'failed'}
        result = status.assess(self.config, self.success, attempt, self.now)
        self.assertFalse(result['healthy'])
        self.assertIn('latest-attempt-failed', result['reasons'])

    def test_running_job_requires_recent_success_and_bounded_duration(self):
        running = {**self.success, 'id': 'run2', 'status': 'running', 'startedAt': self.now.isoformat()}
        self.assertTrue(status.assess(self.config, self.success, running, self.now)['healthy'])
        self.assertFalse(status.assess(self.config, None, running, self.now)['healthy'])
        running['startedAt'] = (self.now - timedelta(hours=3)).isoformat()
        self.assertIn('latest-attempt-overdue', status.assess(self.config, self.success, running, self.now)['reasons'])

    def test_changed_config_invalid_timestamps_and_future_clock_fail_closed(self):
        for replacement in ({'configSha256': 'other'}, {'archiveCapturedAt': 'bad'},
                            {'archiveCapturedAt': '2026-10-19T11:00:00'},
                            {'finishedAt': (self.now + timedelta(hours=1)).isoformat()},
                            {'id': None}, {'archive': ''},
                            {'archiveCapturedAt': (self.now - timedelta(minutes=15)).isoformat()},
                            {'destinations': ['not-a-record']}):
            with self.subTest(replacement=replacement):
                item = {**self.success, **replacement}
                self.assertFalse(status.assess(self.config, item, item, self.now)['healthy'])

    def test_missing_records_and_non_finite_thresholds_cannot_be_healthy(self):
        self.assertFalse(status.assess(self.config, None, None, self.now)['healthy'])
        for number in (float('nan'), float('inf'), -1, 0):
            with self.assertRaises(ValueError):
                status.assess(self.config, self.success, self.success, self.now, number)

    def test_terminal_attempt_cannot_disagree_with_success_or_clock(self):
        for change in ({'finishedAt': 'bad'}, {'finishedAt': None},
                       {'finishedAt': (self.now + timedelta(hours=1)).isoformat()},
                       {'startedAt': self.now.isoformat()}, {'sha256': 'b' * 64},
                       {'archiveCapturedAt': self.now.isoformat()}, {'destinations': []}):
            with self.subTest(change=change):
                attempt = {**self.success, **change}
                self.assertFalse(status.assess(self.config, self.success, attempt, self.now)['healthy'])
        failed = {**self.success, 'status': 'failed', 'finishedAt': 'bad'}
        self.assertIn('invalid-attempt-record', status.assess(self.config, self.success, failed, self.now)['reasons'])

    def test_monitor_rejects_public_state_directory_before_trusting_private_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            state_dir = Path(temporary) / 'status'
            state_dir.mkdir(mode=0o755)
            state_dir.chmod(0o755)
            config = {**self.config, 'state_dir': str(state_dir)}
            with patch('job.load_config', return_value=config), patch('job.source_identity', return_value=self.config['sourceBinding']), patch.object(status, 'read_record') as read:
                result = status.check_status('/external/private-config.json')
            self.assertFalse(result['healthy'])
            self.assertIn('insecure-status-directory', result['reasons'])
            read.assert_not_called()

    def test_duplicate_keys_and_non_finite_values_are_malformed_records(self):
        with tempfile.TemporaryDirectory() as temporary:
            record = Path(temporary) / 'record.json'
            for content in ('{"schemaVersion":1,"status":"failed","status":"succeeded"}',
                            '{"schemaVersion":1,"snapshotAgeHours":NaN}', '{"schemaVersion":true}'):
                record.write_text(content)
                record.chmod(0o600)
                with self.assertRaises(ValueError):
                    status.read_record(record)


class RetrievalTests(unittest.TestCase):
    def args(self, directory):
        return argparse.Namespace(provider='aws', filename='tapuai-20261019T110000Z-1234abcd.tar.age',
            expected_sha256='a' * 64, destination_dir=str(directory), destination='s3://private-copy/backups/',
            account_name='recoveryaccount', container='backups')

    def test_argv_downloads_only_archive_and_checksum_with_reader_identity(self):
        args = self.args(Path('/external/new'))
        commands = fetch.download_commands(args, Path('/external/new'))
        self.assertEqual(len(commands), 2)
        self.assertEqual(commands[0][:4], ['aws', 's3', 'cp', 's3://private-copy/backups/' + args.filename])
        args.provider = 'azure'
        self.assertTrue(all('download' in c and 'login' in c for c in fetch.download_commands(args, Path('/external/new'))))

    def test_traversal_credentials_and_invalid_source_rejected_before_download(self):
        for change in ({'filename': '../escape'}, {'destination': 's3://user:password@bucket'},
                       {'destination': 'https://unexpected.example'}, {'destination': 's3://bucket/../outside'}):
            with self.subTest(change=change):
                args = self.args(Path('/external/new'))
                for key, value in change.items():
                    setattr(args, key, value)
                with self.assertRaises(ValueError):
                    fetch.download_commands(args, Path('/external/new'))

    def test_missing_protected_checksum_or_existing_destination_cannot_download(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(fetch, 'run') as run:
            args = self.args(Path(temporary))
            with self.assertRaisesRegex(ValueError, 'already exists'):
                fetch.fetch(args)
            args.expected_sha256 = ''
            with self.assertRaisesRegex(ValueError, 'protected original'):
                fetch.fetch(args)
            run.assert_not_called()

    def test_provider_failure_cleans_temporary_files_and_never_publishes_download(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / 'new-download'
            args = self.args(destination)
            with patch.object(fetch, 'require_tools'), patch.object(fetch, 'run', side_effect=RuntimeError('synthetic provider failure')):
                with self.assertRaises(RuntimeError):
                    fetch.fetch(args)
            self.assertFalse(destination.exists())
            self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_remote_self_consistent_hash_cannot_override_protected_original(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / 'new-download'
            args = self.args(destination)
            def pretend_download(command):
                target = Path(command[4])
                target.write_text('benign mock download; encrypted-framing check is mocked')
            def pretend_checked(archive):
                checksum = Path(str(archive) + '.sha256')
                checksum.write_text('b' * 64 + '  ' + archive.name)
                return archive, checksum
            with patch.object(fetch, 'require_tools'), patch.object(fetch, 'run', side_effect=pretend_download), \
                 patch.object(fetch, 'checked_artifacts', side_effect=pretend_checked):
                with self.assertRaisesRegex(ValueError, 'protected original checksum'):
                    fetch.fetch(args)
            self.assertFalse(destination.exists())

    def test_matching_download_records_ciphertext_validation_not_restore(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / 'new-download'
            args = self.args(destination)
            def pretend_download(command):
                Path(command[4]).write_text('benign mock download; framing and hashing mocked')
            def pretend_checked(archive):
                checksum = Path(str(archive) + '.sha256')
                checksum.write_text(args.expected_sha256 + '  ' + archive.name)
                return archive, checksum
            with patch.object(fetch, 'require_tools'), patch.object(fetch, 'run', side_effect=pretend_download), \
                 patch.object(fetch, 'checked_artifacts', side_effect=pretend_checked):
                result = fetch.fetch(args)
                self.assertEqual(result['ciphertextIntegrity'], 'passed')
                self.assertEqual(result['decryption'], 'not-run')
                self.assertEqual(result['restoreRehearsal'], 'not-run')
                self.assertTrue((destination / 'fetch-receipt.json').is_file())


if __name__ == '__main__':
    unittest.main()
