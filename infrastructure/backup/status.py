#!/usr/bin/env python3
"""Monitor backup/upload freshness from private job records without provider contact.

Use capture time: re-uploading an old snapshot must not reset its recovery age.
Missing, stale, malformed and failed records cannot produce a healthy result.
"""
import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import stat
import sys

from common import private_file


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Missing timestamp')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError('Timestamp requires timezone')
    return result.astimezone(timezone.utc)


def read_record(path):
    path = private_file(path)
    if path.stat().st_size > 1024 * 1024:
        raise ValueError('Status record exceeds size limit')
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('Duplicate record key')
            result[key] = value
        return result
    def reject_constant(value):
        raise ValueError('Non-finite record value')
    result = json.loads(path.read_text(), object_pairs_hook=unique_object, parse_constant=reject_constant)
    if not isinstance(result, dict) or type(result.get('schemaVersion')) is not int or result['schemaVersion'] != 1:
        raise ValueError('Unsupported status record')
    return result


def assess(config, success, attempt, now, max_age_hours=7, max_run_hours=2):
    """Return health evidence; a completed upload is not a restore rehearsal."""
    if not all(math.isfinite(v) and v > 0 for v in (max_age_hours, max_run_hours)):
        raise ValueError('Monitoring thresholds must be positive')
    wanted = {(d['id'], d['provider']) for d in config['destinations']}
    result = {'schemaVersion': 1, 'healthy': False, 'checkedAt': now.isoformat(), 'reasons': [],
              'requiredDestinationIds': sorted(i for i, _ in wanted), 'requiredProviders': sorted({provider for _, provider in wanted}),
              'snapshotAgeHours': None,
              'latestAttemptStatus': attempt.get('status') if attempt else None,
              'providerContacted': False, 'remoteRetrieval': 'not-proven-by-job-state', 'restoreRehearsal': 'not-proven-by-job-state'}
    from job import source_binding_hash, validate_source_binding
    try:
        active_binding = validate_source_binding(config.get('sourceBinding'))
        active_hash = source_binding_hash(active_binding)
        if config.get('sourceBindingSha256') != active_hash:
            raise ValueError('Active source hash mismatch')
        result.update(sourceBinding=active_binding, sourceBindingSha256=active_hash)
    except (ValueError, TypeError, KeyError, AttributeError):
        active_binding = None
        result.update(sourceBinding=None, sourceBindingSha256=None)
        result['reasons'].append('invalid-active-source-binding')
    # Missing legacy identities require a new actual capture. Never infer them from today's environment.
    for record in (success, attempt):
        if not record:
            continue
        try:
            binding = validate_source_binding(record.get('sourceBinding'))
            if record.get('sourceBindingSha256') != source_binding_hash(binding):
                raise ValueError('Original source hash mismatch')
        except (ValueError, TypeError, KeyError, AttributeError):
            if 'invalid-source-binding' not in result['reasons']:
                result['reasons'].append('invalid-source-binding')
            continue
        if active_binding is not None and binding != active_binding and 'source-binding-mismatch' not in result['reasons']:
            result['reasons'].append('source-binding-mismatch')
    if not success:
        result['reasons'].append('no-successful-upload-record')
    else:
        try:
            if success.get('status') != 'succeeded' or success.get('configSha256') != config['configSha256']:
                raise ValueError('Success does not match active configuration')
            if not isinstance(success.get('id'), str) or not success['id']:
                raise ValueError('Success lacks run identity')
            if not isinstance(success.get('archive'), str) or not re.fullmatch(r'[a-f0-9]{64}', success.get('sha256', '')):
                raise ValueError('Success lacks archive/hash evidence')
            archive_name = re.fullmatch(r'tapuai-(\d{8}T\d{6}Z)-[a-f0-9]{8}\.tar\.age', Path(success['archive']).name)
            if not archive_name:
                raise ValueError('Success lacks generated archive name')
            actual = [(d.get('id'), d.get('provider')) for d in success.get('destinations', []) if d.get('status') == 'uploaded']
            if set(actual) != wanted or len(actual) != len(wanted) or len(success.get('destinations', [])) != len(wanted):
                raise ValueError('Upload destination accounting mismatch')
            captured = timestamp(success.get('archiveCapturedAt'))
            named_capture = datetime.strptime(archive_name.group(1), '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
            if captured != named_capture:
                raise ValueError('Capture time differs from archive filename')
            finished = timestamp(success.get('finishedAt'))
            started = timestamp(success.get('startedAt'))
            if captured > finished or started > finished or finished > now:
                raise ValueError('Impossible capture/upload time')
            age = (now - captured).total_seconds() / 3600
            result['snapshotAgeHours'] = round(age, 3)
            if age > max_age_hours:
                result['reasons'].append('snapshot-stale')
        except (ValueError, TypeError, KeyError, AttributeError):
            result['reasons'].append('invalid-success-record')
    if not attempt:
        result['reasons'].append('no-attempt-record')
    else:
        try:
            if attempt.get('configSha256') != config['configSha256']:
                raise ValueError('Attempt does not match active configuration')
            state = attempt.get('status')
            started = timestamp(attempt.get('startedAt'))
            if started > now or state not in ('running', 'succeeded', 'failed'):
                raise ValueError('Invalid latest attempt')
            if state in ('succeeded', 'failed'):
                finished = timestamp(attempt.get('finishedAt'))
                if started > finished or finished > now:
                    raise ValueError('Invalid terminal attempt time')
            if state == 'failed':
                result['reasons'].append('latest-attempt-failed')
            elif state == 'running' and (now - started).total_seconds() > max_run_hours * 3600:
                result['reasons'].append('latest-attempt-overdue')
            elif state == 'succeeded':
                # Atomic files describe the same completed run; partial or edited accounting is unhealthy.
                fields = ('id', 'configSha256', 'sourceBinding', 'sourceBindingSha256', 'archive', 'archiveCapturedAt', 'sha256',
                          'startedAt', 'finishedAt', 'destinations')
                if not success or any(attempt.get(key) != success.get(key) for key in fields):
                    result['reasons'].append('latest-success-accounting-mismatch')
        except (ValueError, TypeError, KeyError, AttributeError):
            result['reasons'].append('invalid-attempt-record')
    result['healthy'] = not result['reasons']
    return result


def check_status(config_file, max_age_hours=7, max_run_hours=2):
    from job import load_config, source_binding_hash, source_identity
    config = load_config(config_file)
    config['sourceBinding'] = source_identity(config)
    config['sourceBindingSha256'] = source_binding_hash(config['sourceBinding'])
    state = Path(config['state_dir'])
    records, errors = [], []
    if state.exists() or state.is_symlink():
        info = state.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o077:
            result = assess(config, None, None, datetime.now(timezone.utc), max_age_hours, max_run_hours)
            result['reasons'].append('insecure-status-directory')
            return result
    for name in ('latest-success.json', 'latest-attempt.json'):
        try:
            records.append(read_record(state / name))
        except FileNotFoundError:
            records.append(None)
        except (ValueError, OSError, TypeError):
            records.append(None)
            errors.append('invalid-' + name.removesuffix('.json'))
    result = assess(config, records[0], records[1], datetime.now(timezone.utc), max_age_hours, max_run_hours)
    result['reasons'].extend(errors)
    result['healthy'] = not result['reasons']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config-file', required=True)
    parser.add_argument('--max-age-hours', type=float, default=7)
    parser.add_argument('--max-run-hours', type=float, default=2)
    args = parser.parse_args()
    try:
        result = check_status(args.config_file, args.max_age_hours, args.max_run_hours)
        print(json.dumps(result, sort_keys=True))
        return 0 if result['healthy'] else 2
    except Exception:
        print(json.dumps({'healthy': False, 'reasons': ['invalid-monitor-configuration'], 'providerContacted': False}))
        return 3


if __name__ == '__main__':
    sys.exit(main())
