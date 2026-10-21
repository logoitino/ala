"""Operational health must reject stale process/data/evidence observations without writing state or exposing secrets."""
import copy
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

FILE = Path(__file__).resolve().parents[1] / 'health.py'
spec = importlib.util.spec_from_file_location('exit_health', FILE)
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)
NOW = datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc)


def source(age=30):
    return {'source': {'sourceCurrent': True, 'codeVerified': True, 'mapValid': True,
                       'configuredSourceMatchesExpected': True,
                       'lastCheckedAt': (NOW - timedelta(seconds=age)).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
                       'releaseVersion': 'a' * 64},
            'watcher': {'active': True, 'state': 'running', 'loginAutoStart': False}}


def configuration(base):
    return {'schemaVersion': 1, 'source': {'stateDir': str(base / 'source'), 'targetId': 'local-source',
            'maxScanAgeSeconds': 120, 'expectedSupabaseUrl': 'https://project.supabase.co'},
            'backup': {'jobConfigFile': str(base / 'job.json'), 'maxAgeHours': 7, 'maxRunHours': 2},
            'readiness': {'configFile': str(base / 'readiness.json')}}


class SourceHealthTests(unittest.TestCase):
    def test_fresh_manual_read_cannot_hide_old_sweep(self):
        observed = source(age=121)
        observed['source']['checkedAt'] = NOW.isoformat()
        result = health.assess_source(observed, 120, NOW)
        self.assertFalse(result['healthy'])
        self.assertIn('source-scan-stale-or-future', result['reasons'])

    def test_future_and_invalid_original_scan_fail(self):
        for value in (source(-1), {'source': {'lastCheckedAt': 'tomorrow'}, 'watcher': {'active': True}}):
            self.assertFalse(health.assess_source(value, 120, NOW)['healthy'])

    def test_process_content_code_and_map_are_independent_requirements(self):
        for parent, key in [('source', 'sourceCurrent'), ('source', 'codeVerified'), ('source', 'mapValid'), ('watcher', 'active')]:
            observed = source()
            observed[parent][key] = False
            self.assertFalse(health.assess_source(observed, 120, NOW)['healthy'])

    def test_configured_current_app_origin_must_match_backup_expectation(self):
        for value in (None, False):
            observed = source(); observed['source']['configuredSourceMatchesExpected'] = value
            self.assertIn('app-source-origin-missing-or-mismatched', health.assess_source(observed, 120, NOW, require_origin=True)['reasons'])


class ConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name).resolve()
        self.file = self.base / 'health.json'
        self.config = configuration(self.base)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, value=None):
        self.file.write_text(json.dumps(value if value is not None else self.config))
        self.file.chmod(0o600)

    def test_valid_load_changes_no_bytes_or_modes(self):
        self.write()
        info = self.file.stat()
        before = (info.st_mtime_ns, info.st_mode, self.file.read_bytes())
        self.assertEqual(health.load_config(self.file), self.config)
        info = self.file.stat()
        self.assertEqual(before, (info.st_mtime_ns, info.st_mode, self.file.read_bytes()))

    def test_private_external_config_and_paths_are_required(self):
        self.write()
        self.file.chmod(0o644)
        with self.assertRaises(ValueError): health.load_config(self.file)
        self.file.chmod(0o600)
        linked = self.base / 'link.json'
        linked.symlink_to(self.file)
        with self.assertRaises(ValueError): health.load_config(linked)
        self.config['source']['stateDir'] = str(health.ROOT / 'private')
        self.write()
        with self.assertRaises(ValueError): health.load_config(self.file)

    def test_ancestor_links_and_dotdot_are_rejected(self):
        linked = self.base / 'alias'
        linked.symlink_to(self.base, target_is_directory=True)
        for value in (str(linked / 'source'), str(self.base / 'unused' / '..' / 'source')):
            self.config['source']['stateDir'] = value
            self.write()
            with self.assertRaises(ValueError): health.load_config(self.file)

    def test_duplicate_unknown_boolean_nonfinite_and_bad_url_fail(self):
        values = []
        for field, value in [('schemaVersion', True), ('extra', 'ignored')]:
            item = copy.deepcopy(self.config); item[field] = value; values.append(item)
        for field, value in [('maxScanAgeSeconds', True), ('maxScanAgeSeconds', float('nan')),
                             ('expectedSupabaseUrl', 'https://user:password@source.example'), ('expectedSupabaseUrl', 'https://source.example/rest/v1')]:
            item = copy.deepcopy(self.config); item['source'][field] = value; values.append(item)
        for value in values:
            self.write(value)
            with self.assertRaises(ValueError): health.load_config(self.file)
        self.file.write_text('{"schemaVersion":1,"schemaVersion":1}')
        self.file.chmod(0o600)
        with self.assertRaises(ValueError): health.load_config(self.file)

    def test_cli_invalid_config_exit3_redacts_all_input(self):
        self.file.write_text('{"password":"SYNTHETIC_PRIVATE_MARKER"}')
        self.file.chmod(0o600)
        result = subprocess.run(['python3', str(FILE), '--config-file', str(self.file)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 3)
        self.assertNotIn('SYNTHETIC_PRIVATE_MARKER', result.stdout + result.stderr)
        self.assertFalse(json.loads(result.stdout)['readyToCutOver'])


class CombinedHealthTests(unittest.TestCase):
    def setUp(self):
        self.config = configuration(Path('/private/operator'))
        self.backup = {'healthy': True, 'sourceBinding': {'supabaseUrl': 'https://project.supabase.co',
                       'databaseIdentity': {'PGHOST': 'db.project.supabase.co', 'PGPORT': '5432', 'PGDATABASE': 'postgres', 'PGUSER': 'postgres'}},
                       'requiredProviders': ['aws', 'azure'], 'snapshotAgeHours': 1.5}
        self.readiness = {'ready': True, 'phase': 'prepared', 'releaseVersion': 'a' * 64, 'targetId': 'local-source'}
        self.readiness['sourceBinding'] = copy.deepcopy(self.backup['sourceBinding'])
        self.readiness['sourceBinding']['databaseIdentity'].pop('PGUSER')

    def run_health(self, config=True, tools=True):
        with patch.object(health, 'source_observation', return_value=source()), \
                patch.object(health, 'backup_observation', return_value=(0, self.backup)), \
                patch.object(health, 'readiness_observation', return_value=(0, self.readiness)), \
                patch.object(health.shutil, 'which', side_effect=lambda name: '/bin/' + name if tools else None):
            return health.check(self.config if config else None, NOW)

    def test_no_config_does_not_imply_backup_or_cutover(self):
        result = self.run_health(config=False)
        self.assertFalse(result['preparationHealthy'])
        self.assertEqual(result['backup']['state'], 'not-configured')
        self.assertFalse(result['readyToCutOver'])

    def test_all_prepared_observations_still_never_authorize_cutover(self):
        result = self.run_health()
        self.assertTrue(result['preparationHealthy'])
        self.assertEqual(result['backup']['captureAgeHours'], 1.5)
        for key in ('readyToCutOver', 'providerContacted', 'trafficChanged', 'stateWritten'):
            self.assertFalse(result[key])

    def test_current_backup_wrong_project_fails(self):
        self.backup['sourceBinding']['supabaseUrl'] = 'https://another.supabase.co'
        self.assertIn('backup-source-does-not-match-expected-project', self.run_health()['reasons'])

    def test_prepared_evidence_wrong_version_target_or_phase_fails(self):
        for key, value in [('releaseVersion', 'b' * 64), ('targetId', 'different'), ('phase', 'cutover')]:
            with self.subTest(key=key):
                saved = self.readiness[key]; self.readiness[key] = value
                self.assertFalse(self.run_health()['preparationHealthy'])
                self.readiness[key] = saved

    def test_same_code_and_target_prepared_for_different_source_is_rejected(self):
        original = copy.deepcopy(self.readiness['sourceBinding'])
        self.readiness['sourceBinding']['supabaseUrl'] = 'https://another.supabase.co'
        self.assertIn('prepared-evidence-backup-source-mismatch', self.run_health()['reasons'])
        self.readiness['sourceBinding'] = original
        self.readiness['sourceBinding']['databaseIdentity']['PGHOST'] = 'another-db.supabase.co'
        self.assertFalse(self.run_health()['preparedEvidence']['accepted'])

    def test_tools_are_visible_and_block_preparation(self):
        result = self.run_health(tools=False)
        self.assertIn('tool-missing-pg_dump', result['reasons'])
        self.assertIn('tool-missing-aws', result['reasons'])
        self.assertIn('tool-missing-az', result['reasons'])
        self.assertFalse(result['preparationHealthy'])

    def test_backup_failure_and_missing_source_binding_fail_closed(self):
        self.backup['healthy'] = False
        self.backup['sourceBinding'] = None
        self.assertFalse(self.run_health()['preparationHealthy'])

    def test_observation_exceptions_are_redacted_and_no_children_repair_state(self):
        with patch.object(health, 'source_observation', side_effect=ValueError('PRIVATE_MARKER')), \
                patch.object(health, 'backup_observation', side_effect=ValueError('PRIVATE_MARKER')), \
                patch.object(health, 'readiness_observation', side_effect=ValueError('PRIVATE_MARKER')):
            result = health.check(self.config, NOW)
        self.assertNotIn('PRIVATE_MARKER', json.dumps(result))
        self.assertFalse(result['preparationHealthy'])


if __name__ == '__main__':
    unittest.main()
