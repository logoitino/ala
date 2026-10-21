"""Synthetic original-evidence tests: a plan note, stale release or incomplete drill cannot permit cutover."""
from copy import deepcopy
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'migration/tests'))
import readiness
from test_migration import base_fingerprint


class ReadinessTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.now = datetime(2026, 10, 19, 12, tzinfo=timezone.utc)
        self.release = {'targetId': 'aws-test', 'releaseVersion': 'a' * 64, 'current': True, 'codeVerification': 'passed'}
        self.config = {'targetId': 'aws-test', 'maxEvidenceAgeHours': 168, 'maxBackupAgeHours': 7,
                       'backup': {'expectedSha256': 'b' * 64}}
        for role in ('source', 'target'):
            identity = role + '-storage-catalog'
            self.config[role] = {'supabaseUrl': 'https://' + identity + '.example',
                                 'databaseIdentity': {'PGHOST': identity, 'PGPORT': '5432', 'PGDATABASE': 'postgres'}}
        self.inventory = {'calls': [{}, {}], 'unresolvedCalls': [{}]}
        self.captured = self.now - timedelta(hours=1)
        self.records = {}
        generic = self.attachment('observed-proof', {'synthetic': True})
        details = {
            'target-ready': dict.fromkeys(('preProvisioned', 'isolatedRehearsalTarget', 'imagesLoaded', 'durableVolumes', 'tlsTested'), True),
            'source-deployed': {'builtFromThisRelease': True, 'targetBuildSmokePassed': True},
            'database-parity': {'backupSha256': 'b' * 64},
            'storage-bytes-and-ownership': dict.fromkeys(('allObjectHashesMatched', 'ownershipReconciled', 'historicalGuardsRestored', 'privateAccessDeniedToOtherUsers'), True),
            'auth-sessions-mfa': dict.fromkeys(('restoredUserSignIn', 'uuidIdentityPreserved', 'refreshPolicyTested', 'oauthRedirectsTested', 'mfaPolicyTested'), True),
            'service-contracts': dict.fromkeys(('restRpcPassed', 'realtimePassed', 'storageApiPassed', 'allowlistedEdgeFunctionsPassed'), True),
            'installed-clients': dict.fromkeys(('ownedStableOriginInstalled', 'supportedVersionsTested', 'sessionTransitionTested', 'legacyMediaTested', 'offlineQueueTested'), True),
            'configuration-custody': dict.fromkeys(('currentCustodyReviewed', 'keysAvailableIndependently', 'smtpIsolatedDuringDrill', 'providerCallbacksReviewed'), True),
            'financial-writer-control': dict.fromkeys(('oneAuthoritativeWriter', 'providerEventsReconciled', 'duplicateCreditsPrevented', 'payoutGatesPreserved', 'writersQuiesced'), True),
            'rollback': dict.fromkeys(('rollbackRehearsed', 'writesAfterSwitchReconciled', 'oldClientPolicyTested'), True),
            'monitoring': dict.fromkeys(('backupAgeAlertDelivered', 'jobFailureAlertDelivered', 'serviceAlertDelivered', 'responseOwnerAssigned'), True),
            'timed-rehearsal': {'fullEndToEnd': True, 'warmTarget': True, 'rollbackIncluded': True,
                                'startedAt': (self.now - timedelta(hours=3)).isoformat(),
                                'finishedAt': (self.now - timedelta(hours=1)).isoformat(),
                                'stageMinutes': {key: 15 for key, _ in readiness.STAGES}},
        }
        details['service-contracts'].update(reviewedCallsiteCount=2, dynamicCallsiteReviewCount=1)
        details['storage-bytes-and-ownership']['backupSha256'] = 'b' * 64
        details['financial-writer-control']['backupSha256'] = 'b' * 64
        for gate in readiness.GATES:
            attachments = [generic]
            if gate == 'database-parity':
                attachments = [self.attachment(role + '-fingerprint', self.fingerprint(role)) for role in ('source', 'target')]
            if gate == 'storage-bytes-and-ownership':
                attachments = [self.storage_attachment('source-storage-catalog'), self.storage_attachment('target-storage-catalog')]
            self.records[gate] = {'schemaVersion': 1, 'gate': gate, 'releaseVersion': 'a' * 64, 'targetId': 'aws-test',
                                  'checkedAt': self.now.isoformat(), 'result': 'passed', 'acceptedBy': 'synthetic-independent-reviewer',
                                  'attachments': attachments, 'details': details[gate]}

    def tearDown(self):
        self.temporary.cleanup()

    def attachment(self, identity, content):
        filename = self.root / (identity + '.json')
        filename.write_text(json.dumps(content)); filename.chmod(0o600)
        return {'id': identity, 'path': str(filename), 'sha256': readiness.digest(filename)}

    def assess(self, records=None, release=None, phase='prepared', captured=None):
        return readiness.evaluate(self.config, release or self.release, self.inventory,
                                  self.records if records is None else records, self.now, phase,
                                  self.captured if captured is None else captured)

    def fingerprint(self, role):
        value = base_fingerprint()
        value['connectionIdentity'] = deepcopy(self.config[role]['databaseIdentity'])
        return value

    def test_original_reports_from_unrelated_endpoints_cannot_pass_using_copied_target_label(self):
        records = deepcopy(self.records)
        target = self.fingerprint('target'); target['connectionIdentity']['PGHOST'] = 'unrelated-database'
        records['database-parity']['attachments'][1] = self.attachment('target-fingerprint', target)
        self.assertIn('evidence-database-parity', self.assess(records)['reasons'])
        records = deepcopy(self.records)
        path = Path(records['storage-bytes-and-ownership']['attachments'][1]['path'])
        lines = path.read_text().splitlines(); header = json.loads(lines[0]); header['targetUrl'] = 'https://unrelated.example'
        lines[0] = json.dumps(header); path.write_text('\n'.join(lines) + '\n')
        records['storage-bytes-and-ownership']['attachments'][1]['sha256'] = readiness.digest(path)
        self.assertIn('evidence-storage-bytes-and-ownership', self.assess(records)['reasons'])

    def storage_attachment(self, identity, change=None):
        row = {'id': 'physical-' + identity, 'bucket_id': 'private', 'name': 'old-approved.mp4',
               'owner': '00000000-0000-0000-0000-000000000001', 'owner_id': None,
               'metadata': {'mimetype': 'video/mp4', 'size': 12}}
        if change: change(row)
        lines = [{'format': 'tapuai-storage-catalog/1', 'targetUrl': 'https://' + identity + '.example',
                  'databaseIdentity': {'PGHOST': identity, 'PGPORT': '5432', 'PGDATABASE': 'postgres'}},
                 {'columns': [{'name': 'owner', 'type': 'uuid'}, {'name': 'owner_id', 'type': 'text'}], 'triggers': [], 'foreignKeys': []},
                 {'object': row}]
        filename = self.root / (identity + '.jsonl')
        filename.write_text('\n'.join(json.dumps(line) for line in lines) + '\n'); filename.chmod(0o600)
        return {'id': identity, 'path': str(filename), 'sha256': readiness.digest(filename)}

    def test_original_storage_owners_and_known_metadata_required_despite_passed_summary(self):
        for change in (lambda row: row.update(owner=None), lambda row: row.pop('owner'),
                       lambda row: row.pop('metadata'), lambda row: row['metadata'].update(size=True)):
            records = deepcopy(self.records)
            records['storage-bytes-and-ownership']['attachments'][1] = self.storage_attachment('target-storage-catalog', change)
            self.assertIn('evidence-storage-bytes-and-ownership', self.assess(records)['reasons'])

    def test_complete_synthetic_original_evidence_is_accepted_without_provider_contact(self):
        result = self.assess()
        self.assertTrue(result['ready'])
        self.assertEqual(result['sourceBinding'], self.config['source'])
        self.assertFalse(result['providerContacted'])
        self.assertFalse(result['trafficChanged'])

    def test_a_plan_note_without_original_evidence_cannot_make_ready(self):
        records = {gate: {'result': 'passed', 'evidence': 'trust this note'} for gate in readiness.GATES}
        result = self.assess(records)
        self.assertFalse(result['ready'])
        self.assertEqual(len(result['reasons']), len(readiness.GATES))

    def test_old_source_unverified_code_or_other_target_block(self):
        for replacement in ({'current': False}, {'codeVerification': 'not-run'}, {'targetId': 'azure-other'}):
            with self.subTest(replacement=replacement):
                self.assertFalse(self.assess(release={**self.release, **replacement})['ready'])

    def test_missing_partial_changed_release_future_and_stale_evidence_block(self):
        for change in ({'result': 'partial'}, {'releaseVersion': 'c' * 64}, {'targetId': 'other-test'},
                       {'checkedAt': (self.now + timedelta(minutes=1)).isoformat()},
                       {'checkedAt': (self.now - timedelta(days=8)).isoformat()}, {'attachments': []}):
            records = deepcopy(self.records); records['auth-sessions-mfa'].update(change)
            with self.subTest(change=change):
                self.assertFalse(self.assess(records)['ready'])
        records = deepcopy(self.records); del records['rollback']
        self.assertFalse(self.assess(records)['ready'])

    def test_changed_original_fingerprint_blocks_even_when_summary_claims_pass(self):
        target = deepcopy(base_fingerprint())
        target['tables']['public.players']['grants'].append('anon:INSERT')
        records = deepcopy(self.records)
        records['database-parity']['attachments'][1] = self.attachment('changed-target', target)
        records['database-parity']['attachments'][1]['id'] = 'target-fingerprint'
        self.assertIn('evidence-database-parity', self.assess(records)['reasons'])

    def test_counts_only_or_missing_actor_access_are_not_full_parity(self):
        for update in ('counts', 'access'):
            target = deepcopy(base_fingerprint())
            if update == 'counts': target['meta']['hashRows'] = False
            else: target['access'] = None
            records = deepcopy(self.records)
            item = self.attachment('bad-target', target); item['id'] = 'target-fingerprint'
            records['database-parity']['attachments'][1] = item
            self.assertFalse(self.assess(records)['ready'])

    def test_legacy_or_incomplete_auth_and_function_coverage_cannot_authorize_cutover(self):
        for change in (lambda value: value.pop('coverage'),
                       lambda value: value['coverage'].pop('authSequenceDefinitions'),
                       lambda value: value['service'].update(functions={}),
                       lambda value: value['rows']['auth.users'].update(digest=None)):
            records = deepcopy(self.records)
            for index, role in enumerate(('source', 'target')):
                value = self.fingerprint(role); change(value)
                records['database-parity']['attachments'][index] = self.attachment(role + '-fingerprint', value)
            self.assertIn('evidence-database-parity', self.assess(records)['reasons'])

    def test_tampered_or_public_original_report_cannot_authorize_acceptance(self):
        filename = Path(self.records['monitoring']['attachments'][0]['path'])
        filename.write_text('{}')
        self.assertFalse(self.assess()['ready'])
        original = self.attachment('observed-proof', {'synthetic': True})
        filename.chmod(0o644)
        self.assertFalse(self.assess()['ready'])

    def test_old_backup_recent_reupload_does_not_refresh_recovery_age(self):
        self.assertIn('backup-missing-stale-or-future', self.assess(captured=self.now - timedelta(days=2))['reasons'])
        self.assertFalse(self.assess(captured=self.now + timedelta(minutes=1))['ready'])

    def test_cutover_requires_final_backup_binding_and_writer_freeze(self):
        self.assertTrue(self.assess(phase='cutover')['ready'])
        for gate in ('database-parity', 'storage-bytes-and-ownership', 'financial-writer-control'):
            records = deepcopy(self.records); records[gate]['details']['backupSha256'] = 'c' * 64
            self.assertFalse(self.assess(records, phase='cutover')['ready'])
        records = deepcopy(self.records); records['financial-writer-control']['details']['writersQuiesced'] = False
        self.assertFalse(self.assess(records, phase='cutover')['ready'])

    def test_callsite_review_counts_must_match_the_exact_current_inventory(self):
        records = deepcopy(self.records); records['service-contracts']['details']['dynamicCallsiteReviewCount'] = 0
        self.assertFalse(self.assess(records)['ready'])
        records['service-contracts']['details']['dynamicCallsiteReviewCount'] = True
        self.assertFalse(self.assess(records)['ready'])

    def test_rehearsal_over_budget_future_incomplete_or_nonfinite_cannot_pass(self):
        changes = ({'startedAt': (self.now - timedelta(hours=5)).isoformat()},
                   {'finishedAt': (self.now + timedelta(minutes=1)).isoformat()},
                   {'stageMinutes': {}}, {'warmTarget': False},
                   {'startedAt': (self.now - timedelta(days=400, hours=2)).isoformat(),
                    'finishedAt': (self.now - timedelta(days=400)).isoformat()},
                   {'stageMinutes': {key: 0 for key, _ in readiness.STAGES}},
                   {'stageMinutes': {key: 10 for key, _ in readiness.STAGES}},
                   {'stageMinutes': {key: float('nan') for key, _ in readiness.STAGES}})
        for change in changes:
            records = deepcopy(self.records); records['timed-rehearsal']['details'].update(change)
            self.assertFalse(self.assess(records)['ready'])

    def test_duplicate_keys_nonfinite_values_and_public_configuration_rejected(self):
        filename = self.root / 'config.json'
        for text in ('{"a":1,"a":2}', '{"a":NaN}'):
            filename.write_text(text); filename.chmod(0o600)
            with self.assertRaises(ValueError): readiness.read_json(filename)
        filename.write_text('{}'); filename.chmod(0o644)
        with self.assertRaises(ValueError): readiness.read_json(filename)


if __name__ == '__main__':
    unittest.main()
