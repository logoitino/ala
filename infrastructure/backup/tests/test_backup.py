"""Synthetic recovery checks for omissions, corrupt archives and wrong-target writes.

External commands are mocked; these tests do not claim encryption interoperability,
live database compatibility or a hosted Supabase restore rehearsal.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import backup
import common
import publish
import restore
import verify


class StorageListingTests(unittest.TestCase):
    def test_pagination_captures_every_page_and_nested_private_file(self):
        client = common.Storage('http://127.0.0.1:8000', 'synthetic-key', page_size=2)
        calls = []
        def response(route, data=None, *args, **kwargs):
            query = json.loads(data)
            calls.append((query['prefix'], query['offset']))
            return {
                ('', 0): [{'name': 'a', 'id': '1'}, {'name': 'folder', 'id': None}],
                ('', 2): [{'name': 'z', 'id': '3'}],
                ('folder/', 0): [{'name': 'private.mp4', 'id': '2'}],
            }[(query['prefix'], query['offset'])]
        client.request = response
        self.assertEqual([o['name'] for o in client.objects('reel_vault')], ['a', 'folder/private.mp4', 'z'])
        self.assertEqual(calls, [('', 0), ('', 2), ('folder/', 0)])

    def test_repeated_page_fails_instead_of_truncating_or_looping(self):
        client = common.Storage('http://127.0.0.1:8000', 'synthetic-key', page_size=1)
        client.request = lambda *args, **kwargs: [{'name': 'a', 'id': '1'}]
        with self.assertRaisesRegex(ValueError, 'Repeated'):
            client.objects('reels')

    def test_db_inventory_detects_missing_orphan_and_wrong_project_objects(self):
        db = {'buckets': [{'id': 'reels'}], 'objects': [{'id': '1', 'bucket_id': 'reels', 'name': 'a'}]}
        backup.reconcile(db, [{'id': 'reels'}], [{'id': '1', 'bucket_id': 'reels', 'name': 'a'}])
        for objects in ([], [{'id': 'other-project', 'bucket_id': 'reels', 'name': 'a'}]):
            with self.assertRaisesRegex(ValueError, 'coverage'):
                backup.reconcile(db, [{'id': 'reels'}], objects)

    def test_redirects_cannot_forward_service_role_credentials(self):
        self.assertIsNone(common.NoRedirect().redirect_request(None, None, 302, 'redirect', {}, 'https://untrusted.example'))
        with self.assertRaises(ValueError):
            common.Storage('https://user:password@example.com', 'synthetic-key')


class ArchiveTests(unittest.TestCase):
    def test_links_traversal_duplicates_and_size_limits_rejected(self):
        variants = [('../escape', tarfile.REGTYPE, False), ('link', tarfile.SYMTYPE, False),
                    ('okay', tarfile.REGTYPE, True)]
        for name, kind, duplicate in variants:
            with self.subTest(name=name, duplicate=duplicate), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                archive = directory / 'input.tar'
                with tarfile.open(archive, 'w:') as handle:
                    for _ in range(2 if duplicate else 1):
                        member = tarfile.TarInfo(name)
                        member.type = kind
                        member.size = 3 if kind == tarfile.REGTYPE else 0
                        member.linkname = '/etc/passwd'
                        handle.addfile(member, io.BytesIO(b'abc'))
                stage = directory / 'stage'
                stage.mkdir()
                with self.assertRaisesRegex(ValueError, 'Unsafe'):
                    common.extract_tar(archive, stage, 100)
                self.assertFalse((directory / 'escape').exists())
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            archive = directory / 'input.tar'
            with tarfile.open(archive, 'w:') as handle:
                member = tarfile.TarInfo('large')
                member.size = 4
                handle.addfile(member, io.BytesIO(b'abcd'))
            with self.assertRaisesRegex(ValueError, 'limit'):
                common.extract_tar(archive, directory, 3)

    def fixture(self, directory):
        names = ['database.dump', 'database.toc', 'database-inventory.json', 'storage-inventory.json',
                 'source.tapuai.gz', 'source.metadata.json', 'objects/payload']
        for name in names:
            p = directory / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b'synthetic')
        (directory / 'storage-inventory.json').write_text(json.dumps({'buckets': [{'id': 'private'}],
            'objects': [{'bucket_id': 'private', 'name': 'nested/video.mp4', 'payload': 'objects/payload'}]}))
        manifest = {'format': 'tapuai-full-backup', 'version': 1, 'objectCount': 1, 'bucketCount': 1,
                    'files': [{'path': name, 'size': (directory / name).stat().st_size,
                               'sha256': common.digest(directory / name)} for name in names]}
        common.json_write(directory / 'manifest.json', manifest)
        return manifest

    def test_manifest_rejects_missing_corrupt_and_unlisted_files(self):
        for alteration in ('missing', 'corrupt', 'unlisted'):
            with self.subTest(alteration=alteration), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                self.fixture(directory)
                common.validate_manifest(directory)
                if alteration == 'missing':
                    (directory / 'objects/payload').unlink()
                elif alteration == 'corrupt':
                    (directory / 'database.dump').write_bytes(b'changed')
                else:
                    (directory / 'hidden.txt').write_text('unexpected')
                with self.assertRaises(ValueError):
                    common.validate_manifest(directory)

    def test_checksum_corruption_blocks_decryption(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            archive = directory / 'backup.tar.age'
            archive.write_bytes(b'encrypted-then-corrupted')
            Path(str(archive) + '.sha256').write_text('0' * 64 + '  backup.tar.age\n')
            identity = directory / 'age.key'
            identity.write_text('synthetic')
            identity.chmod(0o600)
            with patch.object(verify, 'require_tools'), patch.object(verify, 'run') as command:
                with self.assertRaisesRegex(ValueError, 'checksum'):
                    verify.verify_backup(archive, identity, directory / 'stage')
                command.assert_not_called()


class RestoreTests(unittest.TestCase):
    def test_storage_resume_requires_matching_commit_receipt_and_never_reapplies_sql(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            stage = directory / 'stage'
            stage.mkdir()
            (stage / 'manifest.json').write_text('{"synthetic":true}')
            (stage / 'storage-inventory.json').write_text('{"buckets":[],"objects":[]}')
            manifest = {'sourceUrl': 'https://source.example.com', 'sourceDatabase': {'PGHOST': 'source'}}
            env = {'PGHOST': '127.0.0.1', 'PGDATABASE': 'restore', 'PGUSER': 'postgres',
                   'SUPABASE_TARGET_URL': 'http://127.0.0.1:8000', 'SUPABASE_TARGET_SERVICE_ROLE_KEY': 'synthetic-only'}
            receipt = directory / 'database-receipt.json'
            prior = {'phase': 'database-committed', 'targetUrl': env['SUPABASE_TARGET_URL'],
                     'sourceManifestSha256': common.digest(stage / 'manifest.json'),
                     'selectedTocSha256': hashlib.sha256(b'entry\n').hexdigest(),
                     'targetDatabase': {'PGHOST': '127.0.0.1', 'PGPORT': '5432', 'PGDATABASE': 'restore'}}
            common.json_write(receipt, prior)
            args = argparse.Namespace(stage=str(stage), env_file=None, confirm_isolated_target=env['SUPABASE_TARGET_URL'],
                confirm_database_host=env['PGHOST'], use_list='reviewed', execute=True, storage=True,
                storage_only=True, database_receipt=str(receipt))
            with patch.object(restore, 'validate_manifest', return_value=manifest), patch.object(restore, 'load_env', return_value=env), \
                 patch.object(restore, 'reviewed_list', return_value=['entry']), patch.object(restore, 'require_tools'), \
                 patch.object(restore, 'Storage') as storage, patch.object(restore, 'run') as command:
                storage.return_value.buckets.return_value = []
                result = restore.restore(args)
                self.assertTrue(result['executed'])
                self.assertTrue(result['storageRestored'])
                self.assertTrue(all(call.args[0][0] != 'pg_restore' for call in command.call_args_list))
                prior['sourceManifestSha256'] = '0' * 64
                receipt.write_text(json.dumps(prior))
                with self.assertRaisesRegex(ValueError, 'does not match'):
                    restore.restore(args)

    def test_source_connection_and_source_origin_are_refused(self):
        manifest = {'sourceUrl': 'https://source.example.com',
                    'sourceDatabase': {'PGHOST': 'source-db.example.com', 'PGPORT': '5432', 'PGDATABASE': 'postgres'}}
        env = {'SUPABASE_TARGET_URL': 'https://target.example.com', 'PGHOST': 'source-db.example.com',
               'PGPORT': '5432', 'PGDATABASE': 'postgres'}
        with self.assertRaisesRegex(ValueError, 'source database'):
            restore.target_checks(manifest, env, 'https://target.example.com', env['PGHOST'])
        env['PGPORT'] = '5433'
        self.assertEqual(restore.target_checks(manifest, env, 'https://target.example.com', env['PGHOST']), env['SUPABASE_TARGET_URL'])
        env['SUPABASE_TARGET_URL'] = manifest['sourceUrl']
        with self.assertRaises(ValueError):
            restore.target_checks(manifest, env, manifest['sourceUrl'], env['PGHOST'])

    def test_operator_confirmation_must_match_both_targets(self):
        manifest = {'sourceUrl': 'https://source.example.com', 'sourceDatabase': {'PGHOST': 'source', 'PGPORT': '5432', 'PGDATABASE': 'postgres'}}
        env = {'SUPABASE_TARGET_URL': 'https://target.example.com', 'PGHOST': 'target', 'PGDATABASE': 'postgres'}
        for url, host in [('https://typo.example.com', 'target'), ('https://target.example.com', 'typo')]:
            with self.assertRaises(ValueError):
                restore.target_checks(manifest, env, url, host)

    def test_reviewed_toc_only_accepts_original_selected_entries(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            toc = '; header\n1; 1259 123 TABLE public profiles postgres\n2; 0 123 TABLE DATA public profiles postgres\n'
            (directory / 'database.toc').write_text(toc)
            reviewed = directory / 'reviewed.list'
            reviewed.write_text('; 1; 1259 123 TABLE public profiles postgres\n2; 0 123 TABLE DATA public profiles postgres\n')
            self.assertEqual(len(restore.reviewed_list(directory, reviewed)), 1)
            for changed in ('99; 0 1 TABLE DATA public profiles postgres\n', '2; 0 123 TABLE DATA auth users postgres\n',
                            '2; 0 123 TABLE DATA public profiles postgres\n' * 2, '; no selected records\n'):
                reviewed.write_text(changed)
                with self.assertRaises(ValueError):
                    restore.reviewed_list(directory, reviewed)

    def test_plan_mode_never_runs_database_or_storage_commands(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            manifest = {'sourceUrl': 'https://source.example.com', 'sourceDatabase': {'PGHOST': 'source'}}
            env = {'PGHOST': '127.0.0.1', 'PGDATABASE': 'restore', 'PGUSER': 'postgres',
                   'SUPABASE_TARGET_URL': 'http://127.0.0.1:8000'}
            args = argparse.Namespace(stage=str(directory), env_file=None, confirm_isolated_target=env['SUPABASE_TARGET_URL'],
                                     confirm_database_host=env['PGHOST'], use_list='reviewed', execute=False, storage=True)
            with patch.object(restore, 'validate_manifest', return_value=manifest), patch.object(restore, 'load_env', return_value=env), \
                 patch.object(restore, 'reviewed_list', return_value=['entry']), patch.object(restore, 'run') as command:
                plan = restore.restore(args)
                self.assertFalse(plan['executed'])
                command.assert_not_called()


class PrivateBoundaryTests(unittest.TestCase):
    def test_binary_age_framing_rejects_plaintext_and_incomplete_headers(self):
        self.assertFalse(common.age_envelope(b'clearly benign plaintext fixture'))
        self.assertFalse(common.age_envelope(b'age-encryption.org/v1\n'))
        self.assertTrue(common.age_envelope(b'age-encryption.org/v1\n-> X25519 synthetic\nsynthetic\n--- ' + b'A' * 43 + b'\n'))

    def test_libpq_connection_strings_and_alternate_host_cannot_bypass_target_guard(self):
        env = {'PGHOST': '127.0.0.1', 'PGDATABASE': 'restore', 'PGUSER': 'postgres'}
        common.postgres_env(env)
        for value in ('host=source.example dbname=postgres', 'postgresql://source.example/postgres', 'postgres://source.example/postgres'):
            with self.subTest(database=value), self.assertRaisesRegex(ValueError, 'plain database name'):
                common.postgres_env({**env, 'PGDATABASE': value})
        for field in ('PGHOSTADDR', 'PGSERVICE', 'PGOPTIONS'):
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'unsupported'):
                common.postgres_env({**env, field: 'source-routing-override'})

    def test_private_env_is_data_and_public_permissions_are_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            filename = Path(temporary) / 'backup.env'
            filename.write_text('PGPASSWORD=\'$(touch /should-not-exist)\'\n')
            filename.chmod(0o600)
            self.assertEqual(common.load_env(filename)['PGPASSWORD'], '$(touch /should-not-exist)')
            filename.chmod(0o644)
            with self.assertRaisesRegex(ValueError, 'mode 600'):
                common.load_env(filename)
        with self.assertRaises(ValueError):
            common.external_path(common.ROOT / 'private-data')

    def test_subprocess_failure_output_is_not_exposed(self):
        failure = subprocess.CalledProcessError(1, ['psql'], stderr=b'secret-token synthetic')
        with patch('subprocess.run', side_effect=failure):
            with self.assertRaises(RuntimeError) as caught:
                common.run(['psql'])
            self.assertNotIn('secret-token', str(caught.exception))

    def test_publisher_cannot_send_plaintext_or_corrupt_archive(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            plaintext = directory / 'database.dump'
            plaintext.write_bytes(b'private')
            with self.assertRaises(ValueError):
                publish.checked_artifacts(plaintext)
            archive = directory / 'tapuai-20261019T000000Z-1234abcd.tar.age'
            archive.write_bytes(b'changed')
            Path(str(archive) + '.sha256').write_text('0' * 64 + '  ' + archive.name + '\n')
            with self.assertRaises(ValueError):
                publish.checked_artifacts(archive)


class PipelineFailureTests(unittest.TestCase):
    def test_failed_download_cleans_staging_and_never_publishes_partial_success(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            recipients = directory / 'public-recipient.txt'
            recipients.write_text('synthetic-recipient-not-a-real-key\n')
            recipients.chmod(0o600)
            output = directory / 'output'
            env = {'PGHOST': '127.0.0.1', 'PGPORT': '5432', 'PGDATABASE': 'postgres', 'PGUSER': 'postgres',
                   'SUPABASE_SOURCE_URL': 'http://127.0.0.1:8000', 'SUPABASE_SOURCE_SERVICE_ROLE_KEY': 'synthetic-only'}
            db = {'buckets': [{'id': 'private'}], 'objects': [{'id': '1', 'bucket_id': 'private', 'name': 'clip'}]}
            commands = []
            def fake_run(command, env=None, stdout=None):
                commands.append(command)
                if command[0] == 'pg_dump':
                    Path(command[-1]).write_bytes(b'benign dump fixture')
                elif command[0] == 'pg_restore':
                    stdout.write(b'; benign TOC fixture\n')
                elif command[0] == 'node':
                    folder = Path(command[-1])
                    capsule, metadata = folder / 'fixture.gz', folder / 'fixture.metadata.json'
                    capsule.write_bytes(b'benign source fixture')
                    metadata.write_text('{}')
                    return subprocess.CompletedProcess(command, 0, json.dumps({'capsulePath': str(capsule),
                        'metadataPath': str(metadata), 'metadata': {'verification': 'not-run'}}).encode())
                return subprocess.CompletedProcess(command, 0, b'')
            args = argparse.Namespace(env_file=None, output_dir=str(output), recipients_file=str(recipients),
                                      consistency='online', quiescence_reference=None, custody_file=None)
            with patch.object(backup, 'require_tools'), patch.object(backup, 'load_env', return_value=env), \
                 patch.object(backup, 'inventory', return_value=db), patch.object(backup, 'run', side_effect=fake_run), \
                 patch.object(backup, 'Storage') as storage:
                storage.return_value.buckets.return_value = [{'id': 'private'}]
                storage.return_value.objects.return_value = db['objects']
                storage.return_value.download.side_effect = RuntimeError('synthetic download failure')
                with self.assertRaisesRegex(RuntimeError, 'download failure'):
                    backup.create_backup(args)
                self.assertEqual(list(output.iterdir()), [])
                self.assertFalse(any(command[0] == 'age' for command in commands))
                self.assertTrue(all('synthetic-only' not in str(command) for command in commands))


if __name__ == '__main__':
    unittest.main()
