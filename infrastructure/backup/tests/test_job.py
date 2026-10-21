"""Synthetic job regressions: missing/partial copies never advance success and errors stay private.

Capture and provider commands are mocked. Binary age framing fixtures test file boundaries,
not encryption authentication, cloud delivery, remote integrity or a recovered database.
"""
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common
import job


class JobTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='tapuai-job-tests-')
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.state = self.directory / 'status'
        self.output = self.directory / 'archives'
        self.output.mkdir(mode=0o700)
        self.archive = self.output / 'tapuai-20260101T000000Z-1234abcd.tar.age'
        self.archive.write_bytes(b'age-encryption.org/v1\n-> X25519 synthetic\nsynthetic\n--- ' + b'A' * 43 + b'\nsynthetic-ciphertext-fixture')
        self.archive.chmod(0o600)
        checksum = Path(str(self.archive) + '.sha256')
        checksum.write_text(common.digest(self.archive) + '  ' + self.archive.name + '\n')
        checksum.chmod(0o600)
        self.raw = {'version': 1, 'state_dir': str(self.state), 'backup': {
            'env_file': str(self.directory / 'unused-source.env'), 'output_dir': str(self.output),
            'recipients_file': str(self.directory / 'unused-recipients.txt'), 'consistency': 'online'},
            'destinations': [
                {'id': 'aws-copy', 'provider': 'aws', 'destination': 's3://synthetic-backups/backups',
                 'kms_key_id': 'arn:aws:kms:us-west-2:123456789012:key/00000000-0000-0000-0000-000000000000'},
                {'id': 'azure-copy', 'provider': 'azure', 'account_name': 'syntheticbackupaccount', 'container': 'backups'}]}
        self.config_file = self.directory / 'job.json'
        self.write_config()
        self.env_file = Path(self.raw['backup']['env_file'])
        self.env_file.write_text('SUPABASE_SOURCE_URL=https://abcdefghijklmnopqrst.supabase.co\n'
                                 'PGHOST=db.abcdefghijklmnopqrst.supabase.co\nPGPORT=5432\n'
                                 'PGDATABASE=postgres\nPGUSER=postgres\nPGSSLMODE=verify-full\n')
        self.env_file.chmod(0o600)
        self.receipt_number = 0

    def write_config(self):
        self.config_file.write_text(json.dumps(self.raw))
        self.config_file.chmod(0o600)

    def capture(self, args):
        self.assertEqual(args.consistency, 'online')
        self.assertIsNone(args.quiescence_reference)
        binding = job.source_identity(job.load_config(self.config_file))
        return {'archive': str(self.archive), 'sha256': common.digest(self.archive),
                'sourceBinding': binding, 'sourceBindingSha256': job.source_binding_hash(binding)}

    def upload(self, args):
        self.receipt_number += 1
        receipt = self.output / (self.archive.name + '.' + args.provider + f'.{self.receipt_number:012x}.receipt.json')
        receipt.write_text(json.dumps({'archive': self.archive.name, 'sha256': common.digest(self.archive),
                                      'provider': args.provider, 'upload': 'provider-command-succeeded',
                                      'publishedAt': datetime.now(timezone.utc).isoformat(), 'remoteRestoreRehearsal': 'not-run'}))
        receipt.chmod(0o600)
        return {'receipt': str(receipt), 'provider': args.provider, 'upload': 'provider-command-succeeded'}

    def read_state(self, name='latest-attempt.json'):
        return json.loads((self.state / name).read_text())

    def test_all_destinations_are_required_before_latest_success(self):
        with patch.object(job.backup, 'create_backup', side_effect=self.capture) as capture, \
             patch.object(job.publish, 'publish', side_effect=self.upload) as upload:
            result = job.run_job(self.config_file)
        capture.assert_called_once()
        self.assertEqual(upload.call_count, 2)
        self.assertEqual(result['status'], 'succeeded')
        self.assertEqual([item['status'] for item in result['destinations']], ['uploaded', 'uploaded'])
        self.assertEqual(self.read_state('latest-success.json'), result)
        self.assertEqual(result['remoteIntegrity'], 'not-verified')
        self.assertEqual(result['restoreRehearsal'], 'not-run')
        self.assertEqual(result['configSha256'], job.configuration_fingerprint(self.raw))
        for path in [self.state / 'latest-attempt.json', self.state / 'latest-success.json',
                     self.state / 'runs' / (result['id'] + '.json'), self.state / 'job.lock']:
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_partial_failure_records_every_destination_and_preserves_previous_success(self):
        with patch.object(job.backup, 'create_backup', side_effect=self.capture), \
             patch.object(job.publish, 'publish', side_effect=self.upload):
            previous = job.run_job(self.config_file)
        published = []
        def partial(args):
            published.append(args.provider)
            if args.provider == 'aws':
                raise RuntimeError('SENSITIVE_PROVIDER_OUTPUT_must_never_escape')
            return self.upload(args)
        with patch.object(job.backup, 'create_backup', side_effect=self.capture), \
             patch.object(job.publish, 'publish', side_effect=partial), self.assertRaisesRegex(job.JobError, 'publication-incomplete'):
            job.run_job(self.config_file)
        attempted = self.read_state()
        self.assertEqual(published, ['aws', 'azure'])
        self.assertEqual(attempted['status'], 'failed')
        self.assertEqual([item['status'] for item in attempted['destinations']], ['failed', 'uploaded'])
        self.assertEqual(self.read_state('latest-success.json'), previous)
        self.assertNotIn('SENSITIVE_PROVIDER_OUTPUT', json.dumps(attempted))
        self.assertEqual(len(list((self.state / 'runs').glob('*.json'))), 2)

    def test_capture_failure_records_failed_attempt_without_cloud_calls(self):
        with patch.object(job.backup, 'create_backup', side_effect=ValueError('SENSITIVE_CAPTURE_FAILURE')), \
             patch.object(job.publish, 'publish') as upload, self.assertRaisesRegex(job.JobError, 'backup-failed'):
            job.run_job(self.config_file)
        upload.assert_not_called()
        attempted = self.read_state()
        self.assertEqual(attempted['status'], 'failed')
        self.assertIsNone(attempted['archive'])
        self.assertEqual(attempted['errorCode'], 'backup-failed')
        self.assertFalse((self.state / 'latest-success.json').exists())
        self.assertNotIn('SENSITIVE_CAPTURE_FAILURE', json.dumps(attempted))

    def test_retry_checks_existing_archive_without_recapture_and_keeps_snapshot_time(self):
        with patch.object(job.backup, 'create_backup', side_effect=self.capture), patch.object(job.publish, 'publish', side_effect=self.upload):
            job.run_job(self.config_file)
        with patch.object(job.backup, 'create_backup') as capture, patch.object(job.publish, 'publish', side_effect=self.upload):
            result = job.run_job(self.config_file, str(self.archive))
        capture.assert_not_called()
        self.assertEqual(result['archiveCapturedAt'], '2026-01-01T00:00:00+00:00')
        self.assertNotEqual(result['startedAt'], result['archiveCapturedAt'])
        self.assertEqual(result['archive'], str(self.archive.resolve()))

    def test_tampered_retry_cannot_publish_or_advance_success(self):
        self.archive.write_bytes(self.archive.read_bytes() + b'changed')
        with patch.object(job.backup, 'create_backup') as capture, patch.object(job.publish, 'publish') as upload, \
             self.assertRaisesRegex(job.JobError, 'archive-invalid'):
            job.run_job(self.config_file, str(self.archive))
        capture.assert_not_called()
        upload.assert_not_called()
        self.assertEqual(self.read_state()['status'], 'failed')
        self.assertFalse((self.state / 'latest-success.json').exists())

    def test_concurrent_lock_does_not_replace_running_attempt(self):
        self.state.mkdir(mode=0o700)
        previous = self.state / 'latest-attempt.json'
        previous.write_text('{"status":"running","id":"existing"}')
        previous.chmod(0o600)
        with (self.state / 'job.lock').open('w') as lock:
            (self.state / 'job.lock').chmod(0o600)
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(job.backup, 'create_backup') as capture, self.assertRaisesRegex(job.JobError, 'job-lock-busy'):
                job.run_job(self.config_file)
            capture.assert_not_called()
        self.assertEqual(json.loads(previous.read_text())['id'], 'existing')
        self.assertFalse((self.state / 'latest-success.json').exists())

    def test_stale_pid_text_does_not_prevent_new_run(self):
        self.state.mkdir(mode=0o700)
        lock = self.state / 'job.lock'
        lock.write_text('{"pid":999999999,"id":"stale"}')
        lock.chmod(0o600)
        with patch.object(job.backup, 'create_backup', side_effect=self.capture), \
             patch.object(job.publish, 'publish', side_effect=self.upload):
            result = job.run_job(self.config_file)
        self.assertEqual(result['status'], 'succeeded')

    def test_missing_or_duplicate_destinations_never_create_success(self):
        variants = [[], [self.raw['destinations'][0], self.raw['destinations'][0]],
                    [self.raw['destinations'][0], {**self.raw['destinations'][0], 'id': 'another-id'}]]
        for destinations in variants:
            with self.subTest(destinations=destinations):
                self.raw['destinations'] = destinations
                self.write_config()
                with patch.object(job.backup, 'create_backup') as capture, self.assertRaisesRegex(job.JobError, 'configuration-invalid'):
                    job.run_job(self.config_file)
                capture.assert_not_called()
                self.assertFalse((self.state / 'latest-success.json').exists())

    def test_config_permissions_and_unattended_write_freeze_are_refused(self):
        self.config_file.chmod(0o644)
        with self.assertRaises(ValueError):
            job.load_config(self.config_file)
        self.raw['backup']['consistency'] = 'quiesced'
        self.write_config()
        with self.assertRaises(ValueError):
            job.load_config(self.config_file)

    def test_unknown_command_fields_and_unsafe_cloud_targets_are_refused(self):
        self.raw['command'] = 'arbitrary shell command is forbidden'
        self.write_config()
        with self.assertRaises(ValueError):
            job.load_config(self.config_file)
        del self.raw['command']
        for destination in ['https://outside.example/backups', 's3://synthetic-backups/not-backups',
                            's3://synthetic-backups/backups/../escape', 's3://synthetic-backups/backups?token=private']:
            self.raw['destinations'][0]['destination'] = destination
            self.write_config()
            with self.assertRaises(ValueError):
                job.load_config(self.config_file)
        self.raw['destinations'][0]['destination'] = 's3://synthetic-backups/backups'
        self.raw['destinations'][0]['kms_key_id'] = 'unreviewed-alias'
        self.write_config()
        with self.assertRaises(ValueError):
            job.load_config(self.config_file)

    def test_duplicate_json_keys_and_in_repo_or_symlink_paths_are_refused(self):
        self.config_file.write_text('{"version":1,"version":1}')
        with self.assertRaises(ValueError):
            job.load_config(self.config_file)
        self.raw['state_dir'] = str(common.ROOT / 'must-not-create-status')
        self.write_config()
        with self.assertRaises(ValueError):
            job.load_config(self.config_file)
        link = self.directory / 'checkout-link'
        link.symlink_to(common.ROOT, target_is_directory=True)
        self.raw['state_dir'] = str(link / 'must-not-create-status')
        self.write_config()
        with self.assertRaises(ValueError):
            job.load_config(self.config_file)

    def test_config_fingerprint_detects_target_change_and_load_never_opens_source_credentials(self):
        self.env_file.unlink()
        original = job.load_config(self.config_file)
        self.assertFalse(Path(original['backup']['env_file']).exists())
        self.raw['destinations'][0]['destination'] = 's3://another-synthetic-bucket/backups'
        self.write_config()
        changed = job.load_config(self.config_file)
        self.assertNotEqual(original['configSha256'], changed['configSha256'])

    def test_lock_and_status_symlinks_are_refused(self):
        self.state.mkdir(mode=0o700)
        outside = self.directory / 'outside-state'
        outside.write_text('untouched')
        outside.chmod(0o600)
        lock = self.state / 'job.lock'
        lock.symlink_to(outside)
        with self.assertRaisesRegex(job.JobError, 'job-lock-invalid'):
            job.run_job(self.config_file)
        lock.unlink()
        (self.state / 'latest-attempt.json').symlink_to(outside)
        with patch.object(job.backup, 'create_backup') as capture, self.assertRaisesRegex(job.JobError, 'job-state-write-failed'):
            job.run_job(self.config_file)
        capture.assert_not_called()
        self.assertEqual(outside.read_text(), 'untouched')


    def partial_azure_success(self):
        def initial(args):
            if args.provider == 'aws':
                raise RuntimeError('synthetic initial AWS failure')
            return self.upload(args)
        with patch.object(job.backup, 'create_backup', side_effect=self.capture), \
             patch.object(job.publish, 'publish', side_effect=initial), self.assertRaises(job.JobError):
            job.run_job(self.config_file)
        return self.read_state()

    def test_same_archive_retry_reuses_protected_azure_success_and_only_attempts_missing_aws(self):
        previous = self.partial_azure_success()
        azure = previous['destinations'][1]
        def retry(args):
            self.assertEqual(args.provider, 'aws', 'Azure must never be overwritten or treated as a swallowed conflict')
            return self.upload(args)
        with patch.object(job.backup, 'create_backup') as capture, patch.object(job.publish, 'publish', side_effect=retry) as upload:
            result = job.run_job(self.config_file, str(self.archive))
        capture.assert_not_called()
        self.assertEqual(upload.call_count, 1)
        self.assertEqual(result['status'], 'succeeded')
        self.assertEqual(len(result['destinations']), 2)
        reused = result['destinations'][1]
        self.assertEqual(reused['receipt'], azure['receipt'])
        self.assertEqual(reused['receiptSha256'], azure['receiptSha256'])
        self.assertEqual(reused['publishedAt'], azure['publishedAt'])
        self.assertEqual(reused['publicationEvidence'], 'reused-provider-receipt')
        self.assertEqual(reused['originalRunId'], previous['id'])
        self.assertEqual(result['archiveCapturedAt'], previous['archiveCapturedAt'])
        self.assertEqual(result['remoteIntegrity'], 'not-verified')

    def test_sha_config_target_mismatch_never_reuses_azure_or_swallows_conflict(self):
        for alteration in ('sha', 'config', 'target'):
            with self.subTest(alteration=alteration):
                # Prior matching records are reset so each case tests one protected partial result.
                if self.state.exists():
                    import shutil
                    shutil.rmtree(self.state)
                previous = self.partial_azure_success()
                prior_path = self.state / 'runs' / (previous['id'] + '.json')
                if alteration == 'sha':
                    previous['sha256'] = '0' * 64
                elif alteration == 'config':
                    previous['configSha256'] = '0' * 64
                else:
                    previous['destinations'][1]['targetSha256'] = '0' * 64
                prior_path.write_text(json.dumps(previous))
                called = []
                def retry(args):
                    called.append(args.provider)
                    if args.provider == 'azure':
                        raise RuntimeError('synthetic BlobAlreadyExists; must stay failed')
                    return self.upload(args)
                expected_error = 'archive-source-unproven' if alteration == 'sha' else 'publication-incomplete'
                with patch.object(job.publish, 'publish', side_effect=retry), self.assertRaisesRegex(job.JobError, expected_error):
                    job.run_job(self.config_file, str(self.archive))
                self.assertEqual(called, [] if alteration == 'sha' else ['aws', 'azure'])
                if alteration != 'sha':
                    self.assertEqual(self.read_state()['destinations'][1]['status'], 'failed')
                self.assertFalse((self.state / 'latest-success.json').exists())

    def test_unprotected_corrupt_or_symlinked_original_receipt_is_not_reused(self):
        for alteration in ('mode', 'contents', 'symlink', 'record-mode', 'malformed-record'):
            with self.subTest(alteration=alteration):
                if self.state.exists():
                    import shutil
                    shutil.rmtree(self.state)
                previous = self.partial_azure_success()
                receipt = Path(previous['destinations'][1]['receipt'])
                prior_path = self.state / 'runs' / (previous['id'] + '.json')
                if alteration == 'mode':
                    receipt.chmod(0o644)
                elif alteration == 'contents':
                    receipt.write_text('{"unexpected":"changed"}')
                elif alteration == 'symlink':
                    source = self.output / 'symlink-source.json'
                    source.write_text(receipt.read_text())
                    source.chmod(0o600)
                    receipt.unlink()
                    receipt.symlink_to(source)
                elif alteration == 'record-mode':
                    prior_path.chmod(0o644)
                else:
                    prior_path.write_text('{malformed JSON')
                called = []
                def retry(args):
                    called.append(args.provider)
                    if args.provider == 'azure':
                        raise RuntimeError('synthetic existing blob conflict')
                    return self.upload(args)
                with patch.object(job.publish, 'publish', side_effect=retry), self.assertRaises(job.JobError):
                    job.run_job(self.config_file, str(self.archive))
                self.assertEqual(called, [] if alteration in ('record-mode', 'malformed-record') else ['aws', 'azure'])
                self.assertEqual(self.read_state()['status'], 'failed')

    def test_successful_retry_of_same_checked_archive_can_reuse_both_original_receipts(self):
        with patch.object(job.backup, 'create_backup', side_effect=self.capture), \
             patch.object(job.publish, 'publish', side_effect=self.upload):
            previous = job.run_job(self.config_file)
        with patch.object(job.publish, 'publish') as upload:
            result = job.run_job(self.config_file, str(self.archive))
        upload.assert_not_called()
        self.assertEqual(result['status'], 'succeeded')
        self.assertTrue(all(item['publicationEvidence'] == 'reused-provider-receipt' for item in result['destinations']))
        self.assertTrue(all(item['originalRunId'] == previous['id'] for item in result['destinations']))

    def test_optional_comment_is_bounded_and_part_of_raw_fingerprint(self):
        self.raw['_comment'] = 'Private job explanation with no credentials.'
        self.write_config()
        self.assertEqual(job.load_config(self.config_file)['configSha256'], job.configuration_fingerprint(self.raw))
        for value in ('', 'x' * 1025, {'unsafe': 'object'}):
            self.raw['_comment'] = value
            self.write_config()
            with self.assertRaises(ValueError):
                job.load_config(self.config_file)


if __name__ == '__main__':
    unittest.main()
