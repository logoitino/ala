"""Exercise immutable runtime evidence and offline load boundaries with synthetic Docker responses.

No Docker daemon, registry, service startup, provider or actual application data is used.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / 'runtime_images.py'
SPEC = importlib.util.spec_from_file_location('runtime_images', MODULE)
runtime = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runtime)


class RuntimeImagesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.release = 'a' * 64
        self.commit = 'b' * 40
        # Include an optional upstream service so exact coverage cannot silently drop it.
        names = sorted(runtime.REQUIRED - runtime.LOCAL_ALLOWED - {'proxy'} | {'analytics'})
        self.upstream = {name: 'supabase/' + name + '@sha256:' + format(i + 1, '064x')
                         for i, name in enumerate(names)}
        self.images = {**self.upstream, 'proxy': 'caddy@sha256:' + 'c' * 64,
                       'fan-web': 'sha256:' + 'd' * 64,
                       'admin-portal': 'sha256:' + 'e' * 64}
        self.metadata = {}
        for i, (service, reference) in enumerate(sorted(self.images.items())):
            self.metadata[reference] = {'Id': reference if service in runtime.LOCAL_ALLOWED
                                       else 'sha256:' + format(i + 101, '064x'),
                                       'RepoDigests': [] if service in runtime.LOCAL_ALLOWED else [reference],
                                       'Os': 'linux', 'Architecture': 'amd64', 'Variant': ''}
        self.lock = {'status': 'archive_verified_not_runtime_tested', 'commit': self.commit,
                     'archive_sha256': 'f' * 64, 'source_files': {'docker-compose.yml': '1' * 64}}
        self.inventory = {'upstream_commit': self.commit, 'images': self.upstream}
        self.args = argparse.Namespace(images_file=str(self.base / 'images.json'),
                    upstream_lock=str(self.base / 'upstream.lock.json'),
                    deployment_inventory=str(self.base / 'inventory.json'),
                    output_dir=str(self.base / 'prepared'), release_version=self.release,
                    target_id='recovery-aws', platform='linux/amd64')
        self.sync_inputs()

    def write(self, path, value):
        path = Path(path)
        path.write_text(json.dumps(value))
        path.chmod(0o600)

    def sync_inputs(self):
        self.write(self.args.images_file, self.images)
        self.write(self.args.upstream_lock, self.lock)
        self.write(self.args.deployment_inventory, self.inventory)

    def docker_prepare(self, command):
        if command[0] == 'inspect':
            return json.dumps(self.metadata[command[-1]]).encode()
        if command[0] == 'save':
            # Synthetic bytes validate the tool's hashing boundary, not Docker archive validity.
            Path(command[2]).write_bytes(('synthetic archive for ' + command[-1]).encode())
            return b''
        self.fail('Unexpected Docker command: ' + repr(command))

    def prepared(self):
        with patch.object(runtime, '_docker', side_effect=self.docker_prepare):
            result = runtime.prepare(self.args)
        self.check_args = argparse.Namespace(receipt=result['receipt'], release_version=self.release,
                            target_id=self.args.target_id, platform=self.args.platform,
                            release_tag='reviewed-release-123', execute=False,
                            overrides_dir=str(self.base / 'loaded'))
        return Path(result['receipt'])

    def invalid_prepare(self):
        self.sync_inputs()
        with patch.object(runtime, '_docker', side_effect=self.docker_prepare) as docker:
            with self.assertRaises(ValueError):
                runtime.prepare(self.args)
        self.assertFalse(Path(self.args.output_dir).exists())
        self.assertFalse(any(call.args[0][0] == 'save' for call in docker.call_args_list))

    def test_complete_prepare_and_check_are_private_and_offline(self):
        receipt = self.prepared()
        with patch.object(runtime, '_docker') as docker:
            result = runtime.check(self.check_args)
        docker.assert_not_called()
        self.assertEqual(result['serviceCount'], len(self.images))
        self.assertTrue(result['archivesVerified'])
        evidence = json.loads(receipt.read_text())
        self.assertEqual(evidence['archiveFormat'], 'docker-image-save')
        self.assertEqual(evidence['runtimeSmokeTests'], 'not-run')
        self.assertTrue(evidence['services']['fan-web']['retagRequired'])
        self.assertEqual(evidence['services']['proxy']['pinKind'], 'registry-digest')
        for path in receipt.parent.iterdir():
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(receipt.parent.stat().st_mode & 0o777, 0o700)

    def test_mutable_proxy_pin_is_rejected(self):
        self.images['proxy'] = 'caddy:latest'
        self.invalid_prepare()

    def test_local_platform_image_is_rejected(self):
        self.images['auth'] = 'sha256:' + '3' * 64
        self.invalid_prepare()

    def test_missing_optional_upstream_service_is_rejected(self):
        del self.images['analytics']
        self.invalid_prepare()

    def test_missing_required_upstream_service_is_rejected(self):
        del self.upstream['storage']
        del self.images['storage']
        self.invalid_prepare()

    def test_inventory_pin_difference_is_rejected(self):
        self.images['auth'] = 'supabase/auth@sha256:' + '4' * 64
        self.invalid_prepare()

    def test_unverified_upstream_is_rejected(self):
        self.lock['status'] = 'unverified_offline'
        self.invalid_prepare()

    def test_commit_mismatch_is_rejected(self):
        self.inventory['upstream_commit'] = '9' * 40
        self.invalid_prepare()

    def test_platform_difference_is_rejected_before_saving(self):
        self.metadata[self.images['storage']]['Architecture'] = 'arm64'
        self.invalid_prepare()

    def test_requested_registry_digest_must_be_inspected(self):
        self.metadata[self.images['auth']]['RepoDigests'] = []
        self.invalid_prepare()

    def test_requested_local_id_must_match_inspected_content(self):
        self.metadata[self.images['fan-web']]['Id'] = 'sha256:' + '5' * 64
        self.invalid_prepare()

    def test_private_inputs_and_external_destination_are_required(self):
        Path(self.args.images_file).chmod(0o644)
        with patch.object(runtime, '_docker') as docker:
            with self.assertRaises(ValueError):
                runtime.prepare(self.args)
        docker.assert_not_called()
        Path(self.args.images_file).chmod(0o600)
        self.args.output_dir = str(runtime.ROOT / 'private-runtime-images')
        with self.assertRaises(ValueError):
            runtime.prepare(self.args)

    def test_symlink_parent_into_checkout_is_rejected(self):
        link = self.base / 'checkout-link'
        link.symlink_to(runtime.ROOT, target_is_directory=True)
        self.args.output_dir = str(link / 'private-runtime-images')
        with patch.object(runtime, '_docker') as docker:
            with self.assertRaises(ValueError):
                runtime.prepare(self.args)
        docker.assert_not_called()

    def test_corrupt_or_missing_archive_blocks_check(self):
        receipt = self.prepared()
        archive = receipt.parent / 'auth.docker.tar'
        archive.write_bytes(b'corrupt')
        with self.assertRaises(ValueError):
            runtime.check(self.check_args)
        archive.unlink()
        with self.assertRaises(ValueError):
            runtime.check(self.check_args)

    def test_archive_symlink_and_public_receipt_are_rejected(self):
        receipt = self.prepared()
        archive = receipt.parent / 'auth.docker.tar'
        replacement = self.base / 'replacement'
        archive.rename(replacement)
        archive.symlink_to(replacement)
        with self.assertRaises(ValueError):
            runtime.check(self.check_args)
        archive.unlink()
        replacement.rename(archive)
        receipt.chmod(0o644)
        with self.assertRaises(ValueError):
            runtime.check(self.check_args)

    def test_wrong_release_target_and_missing_receipt_service_are_rejected(self):
        receipt = self.prepared()
        self.check_args.target_id = 'another-target'
        with self.assertRaises(ValueError):
            runtime.check(self.check_args)
        self.check_args.target_id = self.args.target_id
        evidence = json.loads(receipt.read_text())
        del evidence['services']['storage']
        self.write(receipt, evidence)
        with self.assertRaises(ValueError):
            runtime.check(self.check_args)

    def test_malformed_receipt_cannot_be_checked_as_valid(self):
        receipt = self.prepared()
        original = json.loads(receipt.read_text())
        for field, value in [('schemaVersion', True), ('upstreamCommit', None),
                             ('requiredServiceIds', [{}]), ('startedAt', '2026-01-01T00:00:00')]:
            with self.subTest(field=field):
                evidence = json.loads(json.dumps(original))
                evidence[field] = value
                self.write(receipt, evidence)
                with self.assertRaises(ValueError):
                    runtime.check(self.check_args)
        evidence = json.loads(json.dumps(original))
        evidence['services']['auth']['contentId'] = None
        self.write(receipt, evidence)
        with self.assertRaises(ValueError):
            runtime.check(self.check_args)

    def test_duplicate_image_mapping_is_rejected_before_docker(self):
        Path(self.args.images_file).write_text('{"proxy":"caddy:latest","proxy":"caddy:stable"}')
        with patch.object(runtime, '_docker') as docker:
            with self.assertRaises(ValueError):
                runtime.prepare(self.args)
        docker.assert_not_called()

    def test_dry_run_load_has_no_docker_or_filesystem_mutation(self):
        self.prepared()
        with patch.object(runtime, '_docker') as docker:
            result = runtime.load(self.check_args)
        docker.assert_not_called()
        self.assertFalse(result['executed'])
        self.assertIsNone(result['offlineComposeOverrideRequired'])
        self.assertFalse(Path(self.check_args.overrides_dir).exists())
        self.assertEqual(set(result['appImageOverride']['services']), runtime.LOCAL_ALLOWED | {'proxy'})
        self.assertEqual(set(result['supabaseImageOverride']['services']), set(self.upstream))

    def test_execute_validates_all_archives_before_any_docker_mutation(self):
        receipt = self.prepared()
        (receipt.parent / 'storage.docker.tar').write_bytes(b'corrupt')
        self.check_args.execute = True
        with patch.object(runtime, '_docker') as docker:
            with self.assertRaises(ValueError):
                runtime.load(self.check_args)
        docker.assert_not_called()

    def docker_load(self, command):
        if command[0] == 'load':
            return b''
        if command[0] == 'tag':
            self.tags[command[2]] = command[1]
            return b''
        if command[0] == 'inspect':
            reference = command[-1]
            if reference in self.tags:
                reference = self.tags[reference]
            if reference in self.metadata:
                if self.drop_registry and '@sha256:' in reference:
                    raise RuntimeError('synthetic digest lookup missing after load')
                return json.dumps(self.metadata[reference]).encode()
            item = next((value for value in self.metadata.values() if value['Id'] == reference), None)
            if item:
                return json.dumps(item).encode()
            raise RuntimeError('synthetic image missing')
        self.fail('Unexpected Docker command: ' + repr(command))

    def executed(self, drop_registry=False):
        self.prepared()
        self.check_args.execute = True
        self.tags = {}
        self.drop_registry = drop_registry
        with patch.object(runtime, '_docker', side_effect=self.docker_load):
            return runtime.load(self.check_args)

    def test_execute_load_retags_apps_and_writes_separate_offline_overrides(self):
        result = self.executed(drop_registry=True)
        self.assertTrue(result['offlineComposeOverrideRequired'])
        self.assertFalse(result['startsServices'])
        app = json.loads(Path(result['appOverrideFile']).read_text())
        supabase = json.loads(Path(result['supabaseOverrideFile']).read_text())
        self.assertEqual(set(app['services']), runtime.LOCAL_ALLOWED | {'proxy'})
        self.assertEqual(set(supabase['services']), set(self.upstream))
        for service, item in {**app['services'], **supabase['services']}.items():
            self.assertEqual(item, {'image': self.metadata[self.images[service]]['Id'], 'pull_policy': 'never'})
        self.assertEqual(self.tags['tapuai/fan-web:reviewed-release-123'], self.images['fan-web'])
        evidence = json.loads(Path(result['loadReceipt']).read_text())
        self.assertTrue(evidence['postLoadContentIdsVerified'])
        self.assertEqual(evidence['runtimeSmokeTests'], 'not-run')
        self.assertEqual(evidence['imageReceiptSha256'], runtime._digest(self.check_args.receipt))
        for path in Path(self.check_args.overrides_dir).iterdir():
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_preserved_digest_lookup_reports_no_override_requirement(self):
        result = self.executed()
        self.assertFalse(result['offlineComposeOverrideRequired'])

    def test_loaded_platform_difference_blocks_evidence(self):
        self.prepared()
        self.check_args.execute = True
        self.tags, self.drop_registry = {}, False
        self.metadata[self.images['storage']]['Architecture'] = 'arm64'
        with patch.object(runtime, '_docker', side_effect=self.docker_load):
            with self.assertRaises(ValueError):
                runtime.load(self.check_args)
        self.assertFalse(Path(self.check_args.overrides_dir).exists())

    def test_release_tag_collision_is_not_overwritten(self):
        self.prepared()
        self.check_args.execute = True
        self.tags = {'tapuai/admin-portal:reviewed-release-123': self.metadata[self.images['auth']]['Id']}
        self.drop_registry = False
        with patch.object(runtime, '_docker', side_effect=self.docker_load) as docker:
            with self.assertRaises(ValueError):
                runtime.load(self.check_args)
        self.assertFalse(any(call.args[0][0] == 'tag' for call in docker.call_args_list))
        self.assertFalse(Path(self.check_args.overrides_dir).exists())

    def test_execute_requires_fresh_external_override_destination(self):
        self.prepared()
        self.check_args.execute = True
        self.check_args.overrides_dir = str(runtime.ROOT / 'unsafe-runtime-load')
        with patch.object(runtime, '_docker') as docker:
            with self.assertRaises(ValueError):
                runtime.load(self.check_args)
        docker.assert_not_called()


if __name__ == '__main__':
    unittest.main()
