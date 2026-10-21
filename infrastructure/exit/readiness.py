#!/usr/bin/env python3
"""Check current release, private artifacts and timed acceptance evidence before an owned-cloud move.

This reads evidence only. It never runs SQL, publishes resources or changes traffic.
Unsigned operator evidence needs independent acceptance; metadata cannot authenticate a real drill.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import stat
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'infrastructure/backup'))
sys.path.insert(0, str(ROOT / 'infrastructure/migration'))
from common import private_file, digest, origin
from publish import checked_artifacts
import parity
import storage_reconcile

GATES = ('target-ready', 'source-deployed', 'database-parity', 'storage-bytes-and-ownership',
         'auth-sessions-mfa', 'service-contracts', 'installed-clients', 'configuration-custody',
         'financial-writer-control', 'rollback', 'monitoring', 'timed-rehearsal')
STAGES = (
    ('freeze-final-capture', 30), ('transfer-and-restore', 55), ('reconcile-grants-ownership', 20),
    ('database-parity', 25), ('service-auth-smoke', 20), ('route-clients', 10),
    ('finance-and-reopen', 10), ('rollback-margin', 10),
)
SHA = re.compile(r'[a-f0-9]{64}')


def _time(value):
    if not isinstance(value, str):
        raise ValueError('Missing timestamp')
    instant = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError('Timezone required')
    return instant.astimezone(timezone.utc)


def _unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate evidence key')
        result[key] = value
    return result


def _constant(value):
    raise ValueError('Non-finite evidence value')


def read_json(filename):
    path = private_file(filename)
    if path.stat().st_size > 16 * 1024 * 1024:
        raise ValueError('Evidence exceeds limit')
    value = json.loads(path.read_text(), object_pairs_hook=_unique, parse_constant=_constant)
    if not isinstance(value, dict):
        raise ValueError('Evidence must be an object')
    return value


def private_directory(filename):
    path = Path(filename).expanduser()
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o077:
        raise ValueError('Evidence directory must be private and not a symlink')
    resolved = path.resolve()
    if resolved == ROOT or ROOT in resolved.parents:
        raise ValueError('Operational evidence belongs outside Git')
    return resolved


def load_config(filename):
    config = read_json(filename)
    required = {'schemaVersion', 'targetId', 'releaseDirectory', 'evidenceDirectory', 'runtimeReceipt', 'backup', 'source', 'target'}
    if set(config) - required - {'_comment', 'maxEvidenceAgeHours', 'maxBackupAgeHours', 'platform'} or not required <= set(config):
        raise ValueError('Unsupported readiness configuration')
    if type(config['schemaVersion']) is not int or config['schemaVersion'] != 1 or not re.fullmatch(r'[a-z][a-z0-9-]{1,63}', config['targetId']):
        raise ValueError('Invalid readiness target/version')
    for key, default in (('maxEvidenceAgeHours', 168), ('maxBackupAgeHours', 7)):
        value = config.setdefault(key, default)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise ValueError('Invalid evidence age threshold')
    backup = config['backup']
    if not isinstance(backup, dict) or set(backup) != {'archive', 'expectedSha256'} or not SHA.fullmatch(backup.get('expectedSha256', '')):
        raise ValueError('A separately protected original backup checksum is required')
    for name in ('releaseDirectory', 'evidenceDirectory', 'runtimeReceipt'):
        if not isinstance(config[name], str) or not Path(config[name]).is_absolute():
            raise ValueError('Evidence paths must be absolute')
    if not re.fullmatch(r'linux/(?:amd64|arm64(?:/v8)?)', config.setdefault('platform', 'linux/amd64')):
        raise ValueError('Unsupported target image platform')
    for name in ('source', 'target'):
        endpoint = config[name]
        if not isinstance(endpoint, dict) or set(endpoint) != {'supabaseUrl', 'databaseIdentity'}:
            raise ValueError('Explicit protected source/target identity required')
        endpoint['supabaseUrl'] = origin(endpoint['supabaseUrl'])
        identity = endpoint['databaseIdentity']
        if (not isinstance(identity, dict) or set(identity) != {'PGHOST', 'PGPORT', 'PGDATABASE'}
                or any(not isinstance(value, str) or not value or any(ord(c) < 32 for c in value) for value in identity.values())
                or not identity['PGPORT'].isdigit() or not 1 <= int(identity['PGPORT']) <= 65535):
            raise ValueError('Explicit database host/port/name required')
    if (config['source']['supabaseUrl'] == config['target']['supabaseUrl']
            or config['source']['databaseIdentity'] == config['target']['databaseIdentity']):
        raise ValueError('Source and isolated target must differ')
    return config


def _evidence(record, gate, release, now, max_age_hours):
    required = {'schemaVersion', 'gate', 'releaseVersion', 'targetId', 'checkedAt', 'result', 'acceptedBy', 'attachments', 'details'}
    if set(record) != required or type(record.get('schemaVersion')) is not int or record['schemaVersion'] != 1:
        raise ValueError('Invalid acceptance record')
    if (record['gate'] != gate or record['releaseVersion'] != release['releaseVersion']
            or record['targetId'] != release['targetId'] or record['result'] != 'passed'
            or not isinstance(record['acceptedBy'], str) or not record['acceptedBy'].strip()):
        raise ValueError('Evidence does not accept this release/target/gate')
    checked = _time(record['checkedAt'])
    if checked > now or (now - checked).total_seconds() > max_age_hours * 3600:
        raise ValueError('Stale or future evidence')
    attachments = record['attachments']
    if not isinstance(attachments, list) or not attachments or len(attachments) > 32 or not isinstance(record['details'], dict):
        raise ValueError('Acceptance requires bounded original evidence attachments')
    verified = {}
    for item in attachments:
        if not isinstance(item, dict) or set(item) != {'id', 'path', 'sha256'} or not isinstance(item['id'], str) or not item['id'] or item['id'] in verified:
            raise ValueError('Invalid attachment accounting')
        if not SHA.fullmatch(item.get('sha256', '')) or not isinstance(item['path'], str) or not Path(item['path']).is_absolute():
            raise ValueError('Invalid attachment hash/path')
        path = private_file(item['path'])
        if digest(path) != item['sha256']:
            raise ValueError('Evidence attachment changed')
        verified[item['id']] = path
    return record['details'], verified, checked


def _gate_details(gate, details, attachments, release, inventory, backup_sha, phase, now, checked, max_age_hours, config):
    def require_true(*keys):
        if any(details.get(key) is not True for key in keys):
            raise ValueError('Required acceptance detail absent')
    if gate == 'target-ready':
        require_true('preProvisioned', 'isolatedRehearsalTarget', 'imagesLoaded', 'durableVolumes', 'tlsTested')
    elif gate == 'source-deployed':
        require_true('builtFromThisRelease', 'targetBuildSmokePassed')
    elif gate == 'database-parity':
        if not {'source-fingerprint', 'target-fingerprint'} <= attachments.keys():
            raise ValueError('Original source/target fingerprints required')
        source = read_json(attachments['source-fingerprint'])
        target = read_json(attachments['target-fingerprint'])
        for snapshot, expected in ((source, config['source']), (target, config['target'])):
            if snapshot.get('connectionIdentity') != expected['databaseIdentity']:
                raise ValueError('Database fingerprint endpoint does not match protected configuration')
        result = parity.compare(source, target)
        if (not result['ok'] or not result['compared']['rowHashes'] or result['compared']['accessReads'] == 0
                or result['compared'].get('coverageComplete') is not True):
            raise ValueError('Database, row-hash or actor-access parity is incomplete')
        if result['warnings'] and details.get('warningsAccepted') is not True:
            raise ValueError('Database parity warnings require independent acceptance')
        if phase == 'cutover' and details.get('backupSha256') != backup_sha:
            raise ValueError('Final database parity is not bound to the cutover backup')
    elif gate == 'storage-bytes-and-ownership':
        require_true('allObjectHashesMatched', 'ownershipReconciled', 'historicalGuardsRestored', 'privateAccessDeniedToOtherUsers')
        if not {'source-storage-catalog', 'target-storage-catalog'} <= attachments.keys():
            raise ValueError('Original source/target Storage catalogs required')
        source = storage_reconcile.read_catalog(attachments['source-storage-catalog'])
        target = storage_reconcile.read_catalog(attachments['target-storage-catalog'])
        for snapshot, expected in ((source, config['source']), (target, config['target'])):
            if snapshot.get('targetUrl') != expected['supabaseUrl'] or snapshot.get('databaseIdentity') != expected['databaseIdentity']:
                raise ValueError('Storage catalog endpoint does not match protected configuration')
        if not storage_reconcile.logical_parity(source, target)['passed']:
            raise ValueError('Storage keys, ownership or logical metadata do not match')
        if phase == 'cutover' and details.get('backupSha256') != backup_sha:
            raise ValueError('Final Storage acceptance is not bound to the cutover backup')
    elif gate == 'auth-sessions-mfa':
        require_true('restoredUserSignIn', 'uuidIdentityPreserved', 'refreshPolicyTested', 'oauthRedirectsTested', 'mfaPolicyTested')
    elif gate == 'service-contracts':
        require_true('restRpcPassed', 'realtimePassed', 'storageApiPassed', 'allowlistedEdgeFunctionsPassed')
        if (type(details.get('reviewedCallsiteCount')) is not int or type(details.get('dynamicCallsiteReviewCount')) is not int
                or details.get('reviewedCallsiteCount') != len(inventory['calls'])
                or details.get('dynamicCallsiteReviewCount') != len(inventory['unresolvedCalls'])):
            raise ValueError('SDK callsite coverage/reviews do not match this source')
    elif gate == 'installed-clients':
        require_true('ownedStableOriginInstalled', 'supportedVersionsTested', 'sessionTransitionTested', 'legacyMediaTested', 'offlineQueueTested')
    elif gate == 'configuration-custody':
        require_true('currentCustodyReviewed', 'keysAvailableIndependently', 'smtpIsolatedDuringDrill', 'providerCallbacksReviewed')
    elif gate == 'financial-writer-control':
        require_true('oneAuthoritativeWriter', 'providerEventsReconciled', 'duplicateCreditsPrevented', 'payoutGatesPreserved')
    elif gate == 'rollback':
        require_true('rollbackRehearsed', 'writesAfterSwitchReconciled', 'oldClientPolicyTested')
    elif gate == 'monitoring':
        require_true('backupAgeAlertDelivered', 'jobFailureAlertDelivered', 'serviceAlertDelivered', 'responseOwnerAssigned')
    elif gate == 'timed-rehearsal':
        require_true('fullEndToEnd', 'warmTarget', 'rollbackIncluded')
        started, finished = _time(details.get('startedAt')), _time(details.get('finishedAt'))
        if started > finished or finished > checked or finished > now or (now - finished).total_seconds() > max_age_hours * 3600:
            raise ValueError('Invalid rehearsal clock')
        elapsed = (finished - started).total_seconds() / 60
        if elapsed <= 0 or elapsed > 180:
            raise ValueError('Observed complete cutover exceeds the180-minute target')
        stages = details.get('stageMinutes')
        if (not isinstance(stages, dict) or set(stages) != {key for key, _ in STAGES}
                or any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0 for value in stages.values())
                or abs(sum(stages.values()) - elapsed) > 0.01):
            raise ValueError('Measured stage accounting is incomplete')


def evaluate(config, release, inventory, records, now=None, phase='prepared', backup_captured_at=None):
    """Pure acceptance checks, used after artifact validation; never interpret a planning note as a passed drill."""
    now = now or datetime.now(timezone.utc)
    reasons, gates = [], {}
    if release.get('targetId') != config['targetId']:
        reasons.append('release-target-mismatch')
    if release.get('current') is not True:
        reasons.append('release-source-stale')
    if release.get('codeVerification') != 'passed':
        reasons.append('code-verification-not-passed')
    if backup_captured_at is None or backup_captured_at > now or (now - backup_captured_at).total_seconds() > config['maxBackupAgeHours'] * 3600:
        reasons.append('backup-missing-stale-or-future')
    for gate in GATES:
        try:
            record = records.get(gate)
            if not isinstance(record, dict):
                raise ValueError('No accepted evidence')
            details, attachments, checked = _evidence(record, gate, release, now, config['maxEvidenceAgeHours'])
            _gate_details(gate, details, attachments, release, inventory, config['backup']['expectedSha256'], phase, now, checked, config['maxEvidenceAgeHours'], config)
            if phase == 'cutover' and gate in ('database-parity', 'storage-bytes-and-ownership', 'financial-writer-control') and checked < backup_captured_at:
                raise ValueError('Final acceptance predates this backup')
            if phase == 'cutover' and gate == 'financial-writer-control':
                if details.get('backupSha256') != config['backup']['expectedSha256'] or details.get('writersQuiesced') is not True:
                    raise ValueError('Final writer freeze/backup binding unproven')
            gates[gate] = 'accepted'
        except (ValueError, TypeError, KeyError, OSError, AttributeError):
            gates[gate] = 'missing-or-invalid'
            reasons.append('evidence-' + gate)
    return {'schemaVersion': 1, 'ready': not reasons, 'phase': phase, 'targetId': config['targetId'],
            'sourceBinding': config['source'],
            'releaseVersion': release.get('releaseVersion'), 'checkedAt': now.isoformat(), 'reasons': reasons,
            'gates': gates, 'cutoverBudgetMinutes': 180, 'providerContacted': False, 'trafficChanged': False,
            'evidenceProvenance': 'unsigned-private-operator-records; independent acceptance required'}


def check(config_file, phase='prepared'):
    config = load_config(config_file)
    release_dir = private_directory(config['releaseDirectory'])
    evidence_dir = private_directory(config['evidenceDirectory'])
    command = ['node', str(ROOT / 'infrastructure/exit/release.mjs'), 'verify', str(release_dir), '--current']
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode not in (0, 2):
        raise ValueError('Portable release integrity verification failed')
    release = json.loads(result.stdout)
    inventory = read_json(release_dir / 'inventory.json')
    records = {}
    for gate in GATES:
        try:
            records[gate] = read_json(evidence_dir / (gate + '.json'))
        except (ValueError, OSError, TypeError):
            records[gate] = None
    try:
        archive, checksum = checked_artifacts(config['backup']['archive'])
        if checksum.read_text().split()[0] != config['backup']['expectedSha256']:
            raise ValueError('Original backup checksum mismatch')
        captured = datetime.strptime(archive.name.split('-')[1], '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
    except (ValueError, OSError, TypeError):
        captured = None
    answer = evaluate(config, release, inventory, records, phase=phase, backup_captured_at=captured)
    runtime = subprocess.run(['python3', str(ROOT / 'infrastructure/exit/runtime_images.py'), 'check', '--receipt', config['runtimeReceipt'],
                              '--release-version', release['releaseVersion'], '--target-id', config['targetId'], '--platform', config['platform']], capture_output=True, text=True)
    if runtime.returncode:
        answer['reasons'].append('runtime-image-evidence-invalid')
        answer['ready'] = False
    return answer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config-file', required=True)
    parser.add_argument('--phase', choices=('prepared', 'cutover'), default='prepared')
    args = parser.parse_args()
    try:
        answer = check(args.config_file, args.phase)
        print(json.dumps(answer, sort_keys=True))
        return 0 if answer['ready'] else 2
    except Exception:
        print(json.dumps({'ready': False, 'reasons': ['invalid-readiness-configuration-or-artifacts'], 'providerContacted': False, 'trafficChanged': False}))
        return 3


if __name__ == '__main__':
    sys.exit(main())
