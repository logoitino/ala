#!/usr/bin/env python3
"""Combine read-only source, backup and original prepared-evidence observations; never authorize a cutover."""
import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_STATE = Path.home() / 'Library/Application Support/Tapuai/exit-source'


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError('Duplicate configuration key')
        result[key] = value
    return result


def _json(raw):
    return json.loads(raw, object_pairs_hook=_pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite value')))


def _keys(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError('Unexpected configuration fields')


def _number(value, low, high):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError('Invalid age threshold')
    return value


def _external(value):
    if not isinstance(value, str) or not value or '\x00' in value:
        raise ValueError('Invalid external path')
    candidate = Path(value)
    if not candidate.is_absolute() or '..' in candidate.parts or candidate == ROOT or ROOT in candidate.parents or candidate in ROOT.parents:
        raise ValueError('Path must be absolute and outside the repository')
    for part in (candidate, *candidate.parents):
        if part.is_symlink():
            raise ValueError('Linked paths are ambiguous')
    return str(candidate)


def _private_json(filename):
    filename = _external(str(filename))
    info = os.lstat(filename)
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.getuid() or info.st_size > 65_536:
        raise ValueError('Configuration must be a bounded private owned regular file')
    # Refuse final link replacement between inspection and opening.
    fd = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'r', encoding='utf8') as stream:
        opened = os.fstat(stream.fileno())
        if (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino):
            raise ValueError('Configuration changed while opening')
        return _json(stream.read(65_537))


def _origin(value):
    if not isinstance(value, str) or not value or any(c.isspace() for c in value):
        raise ValueError('Invalid public source origin')
    parsed = urlsplit(value)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        raise ValueError('Expected an HTTPS source origin')
    port = parsed.port
    host = parsed.hostname.lower()
    if ':' in host:
        host = '[' + host + ']'
    return 'https://' + host + (':' + str(port) if port and port != 443 else '')


def load_config(filename):
    value = _private_json(filename)
    _keys(value, ('schemaVersion', 'source', 'backup', 'readiness'))
    if type(value['schemaVersion']) is not int or value['schemaVersion'] != 1:
        raise ValueError('Invalid configuration version')
    source = value['source']
    _keys(source, ('stateDir', 'targetId', 'maxScanAgeSeconds', 'expectedSupabaseUrl'))
    source['stateDir'] = _external(source['stateDir'])
    if not isinstance(source['targetId'], str) or not re.fullmatch(r'[a-z][a-z0-9-]{1,63}', source['targetId']):
        raise ValueError('Invalid target ID')
    _number(source['maxScanAgeSeconds'], 1, 3600)
    source['expectedSupabaseUrl'] = _origin(source['expectedSupabaseUrl'])
    if value['backup'] is not None:
        backup = value['backup']
        _keys(backup, ('jobConfigFile', 'maxAgeHours', 'maxRunHours'))
        backup['jobConfigFile'] = _external(backup['jobConfigFile'])
        _number(backup['maxAgeHours'], 0.01, 168)
        _number(backup['maxRunHours'], 0.01, 24)
    if value['readiness'] is not None:
        _keys(value['readiness'], ('configFile',))
        value['readiness']['configFile'] = _external(value['readiness']['configFile'])
    return value


def _command(args):
    # Child scripts suppress credentials/provider stderr. Never include raw child output in a failed report.
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=180)
    if result.returncode not in (0, 2, 3) or len(result.stdout) > 262_144:
        raise ValueError('Observation command failed')
    answer = _json(result.stdout)
    if not isinstance(answer, dict):
        raise ValueError('Observation command did not return an object')
    return result.returncode, answer


def source_observation(config):
    args = ['node', str(ROOT / 'infrastructure/exit/health_source.mjs'), '--state-dir', config['stateDir'], '--target-id', config['targetId']]
    if config.get('expectedSupabaseUrl'):
        args += ['--expected-source-url', config['expectedSupabaseUrl']]
    return _command(args)[1]


def backup_observation(config):
    return _command(['python3', str(ROOT / 'infrastructure/backup/status.py'), '--config-file', config['jobConfigFile'],
                     '--max-age-hours', str(config['maxAgeHours']), '--max-run-hours', str(config['maxRunHours'])])


def readiness_observation(config):
    return _command(['python3', str(ROOT / 'infrastructure/exit/readiness.py'), '--config-file', config['configFile'], '--phase', 'prepared'])


def assess_source(observation, max_scan_age, now, require_origin=False):
    source = observation.get('source', {})
    watcher = observation.get('watcher', {})
    if not isinstance(source, dict) or not isinstance(watcher, dict):
        raise ValueError('Invalid source observation')
    reasons, age = [], None
    if source.get('sourceCurrent') is not True:
        reasons.append('source-content-not-current')
    if source.get('codeVerified') is not True:
        reasons.append('source-code-not-verified')
    if source.get('mapValid') is not True:
        reasons.append('source-map-not-valid')
    if watcher.get('active') is not True:
        reasons.append('source-watcher-not-running')
    if require_origin and source.get('configuredSourceMatchesExpected') is not True:
        reasons.append('app-source-origin-missing-or-mismatched')
    try:
        raw = source['lastCheckedAt']
        if not isinstance(raw, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', raw):
            raise ValueError('Missing sweep clock')
        age = (now - datetime.fromisoformat(raw.replace('Z', '+00:00'))).total_seconds()
        if age < 0 or age > max_scan_age:
            reasons.append('source-scan-stale-or-future')
    except (KeyError, ValueError, TypeError, OverflowError):
        reasons.append('source-scan-time-invalid')
    safe = {key: source.get(key) for key in ('sourceCurrent', 'codeVerified', 'releaseVersion', 'sourceTreeHash', 'capturedAt', 'lastCheckedAt', 'configuredSourceMatchesExpected')}
    safe.update({'healthy': not reasons, 'scanAgeSeconds': age, 'reasons': reasons,
                 'watcher': {key: watcher.get(key) for key in ('active', 'state', 'pid', 'intervalMs', 'loginAutoStart')}})
    return safe


def check(config=None, now=None):
    supplied_clock = now is not None
    now = now or datetime.now(timezone.utc)
    source_config = config['source'] if config else {'stateDir': str(DEFAULT_STATE), 'targetId': 'local-source', 'maxScanAgeSeconds': 120}
    tools = {name: bool(shutil.which(name)) for name in ('node', 'python3', 'pg_dump', 'pg_restore', 'psql', 'age', 'docker', 'terraform', 'aws', 'az')}
    try:
        observed_source = source_observation(source_config)
        # A live sweep may finish during this read. Compare its clock to the completed observation time.
        if not supplied_clock:
            now = datetime.now(timezone.utc)
        source = assess_source(observed_source, source_config['maxScanAgeSeconds'], now, require_origin=config is not None)
    except Exception:
        source = {'healthy': False, 'reasons': ['source-observation-unavailable']}
    backup = {'healthy': False, 'state': 'not-configured', 'reasons': ['backup-not-configured']}
    active_backup_binding = None
    backup_config = config.get('backup') if config else None
    providers = set()
    if backup_config:
        try:
            code, observed = backup_observation(backup_config)
            # Accept only the existing monitor's success; it validates capture clocks, destinations and current source identity.
            reasons = []
            accepted = code == 0 and observed.get('healthy') is True
            if not accepted:
                reasons.append('backup-missing-stale-failed-or-incomplete')
            binding = observed.get('sourceBinding', {})
            if isinstance(binding, dict):
                active_backup_binding = binding
            matched = None
            if not isinstance(binding, dict) or not binding.get('supabaseUrl'):
                reasons.append('backup-source-not-established')
            elif binding.get('supabaseUrl') != config['source']['expectedSupabaseUrl']:
                matched = False
                reasons.append('backup-source-does-not-match-expected-project')
            else:
                matched = True
            required_providers = observed.get('requiredProviders', [])
            if isinstance(required_providers, list):
                providers = {p for p in required_providers if isinstance(p, str)} & {'aws', 'azure'}
            backup = {'healthy': accepted and not reasons, 'state': 'observed' if code != 3 else 'incomplete-or-invalid', 'reasons': reasons,
                      'captureAgeHours': observed.get('snapshotAgeHours'), 'sourceMatchesExpected': matched}
        except Exception:
            backup = {'healthy': False, 'state': 'unavailable', 'reasons': ['backup-observation-unavailable']}
    readiness = {'accepted': False, 'state': 'not-configured', 'reasons': ['prepared-evidence-not-configured']}
    readiness_config = config.get('readiness') if config else None
    if readiness_config:
        try:
            code, observed = readiness_observation(readiness_config)
            accepted = code == 0 and observed.get('ready') is True and observed.get('phase') == 'prepared'
            # Require independently observed prepared evidence to describe this exact current source/target.
            bound = bool(source.get('releaseVersion')) and observed.get('releaseVersion') == source.get('releaseVersion') and observed.get('targetId') == source_config['targetId']
            prepared_binding = observed.get('sourceBinding')
            # Prepared evidence must describe this backup's original API/database endpoint, not just identical app code.
            database = active_backup_binding.get('databaseIdentity', {}) if isinstance(active_backup_binding, dict) else {}
            wanted_binding = {'supabaseUrl': source_config.get('expectedSupabaseUrl'),
                              'databaseIdentity': {key: database.get(key) for key in ('PGHOST', 'PGPORT', 'PGDATABASE')}}
            same_source = (all(wanted_binding['databaseIdentity'].values()) and bool(wanted_binding['supabaseUrl'])
                           and prepared_binding == wanted_binding)
            readiness = {'accepted': accepted and bound, 'state': 'observed' if code != 3 else 'incomplete-or-invalid',
                         'reasons': ([] if accepted else ['prepared-evidence-missing-stale-or-invalid']) + ([] if bound else ['prepared-evidence-source-or-target-mismatch'])
                         + ([] if same_source else ['prepared-evidence-backup-source-mismatch'])}
            readiness['accepted'] = accepted and bound and bool(same_source)
        except Exception:
            readiness = {'accepted': False, 'state': 'unavailable', 'reasons': ['prepared-evidence-observation-unavailable']}
    required = ['node', 'python3', 'pg_dump', 'pg_restore', 'psql', 'age', 'docker']
    required += ['aws' if p == 'aws' else 'az' for p in sorted(providers)]
    missing = [name for name in required if not tools[name]]
    reasons = source['reasons'] + backup['reasons'] + readiness['reasons'] + ['tool-missing-' + name for name in missing]
    return {'schemaVersion': 1, 'checkedAt': now.isoformat(), 'preparationHealthy': not reasons,
            'readyToCutOver': False, 'status': 'PREPARATION-HEALTHY' if not reasons else 'NO-GO', 'reasons': reasons,
            'source': source, 'backup': backup, 'preparedEvidence': readiness, 'tools': tools,
            'providerContacted': False, 'trafficChanged': False, 'stateWritten': False,
            'nextOwners': {'source': 'EXIT_SYNC', 'backup': 'EXIT_DATABASE', 'preparedEvidence': 'EXIT_CLOUD with QA/Auth/Data/Finance'}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config-file')
    args = parser.parse_args()
    try:
        config = load_config(args.config_file) if args.config_file else None
    except Exception:
        print(json.dumps({'preparationHealthy': False, 'readyToCutOver': False, 'status': 'NO-GO',
                          'reasons': ['invalid-private-health-configuration'], 'providerContacted': False, 'trafficChanged': False, 'stateWritten': False}))
        return 3
    answer = check(config)
    print(json.dumps(answer, sort_keys=True, indent=2))
    return 0 if answer['preparationHealthy'] else 2


if __name__ == '__main__':
    sys.exit(main())
