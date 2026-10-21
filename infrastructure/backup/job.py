#!/usr/bin/env python3
"""Run one encrypted backup and all configured cloud publications with private atomic evidence.

Upload success records provider command completion only. It does not establish remote
integrity, a restore rehearsal, PITR, or a consistent database/Storage snapshot. Configuration
is private JSON data; source credentials and arbitrary command strings never enter receipts.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import urllib.parse
import uuid

import backup
import publish
from common import digest, external_path, private_file

CONFIG_LIMIT = 64 * 1024
ID_PATTERN = re.compile(r'[a-z][a-z0-9-]{0,62}')
ARCHIVE_PATTERN = re.compile(r'tapuai-(\d{8}T\d{6}Z)-[a-f0-9]{8}\.tar\.age')
RUN_PATTERN = re.compile(r'\d{8}T\d{6}Z-[a-f0-9]{32}')
REUSE_RECORD_LIMIT = 1000
SOURCE_FIELDS = ('SUPABASE_SOURCE_URL', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER')
ROUTING_OVERRIDES = ('PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGHOSTADDR')


class JobError(RuntimeError):
    """Fixed public error code; raw provider exceptions must never enter unattended logs."""
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def configuration_fingerprint(raw):
    """Hash canonical raw configuration before path normalization to detect destination changes."""
    canonical = json.dumps(raw, sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(canonical).hexdigest()


def _source_env(config):
    """Parse the active private file as data; never inherit missing source identity from a shell."""
    path = private_file(config['backup']['env_file'])
    if path.stat().st_size > CONFIG_LIMIT:
        raise ValueError('Source environment exceeds size limit')
    fields = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if not separator or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key) or key in fields:
            raise ValueError('Invalid or duplicate source environment field')
        if value[:1] in ('"', "'"):
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError('Invalid source environment quoting')
            value = value[1:-1]
        fields[key] = value
    if any(not fields.get(key) for key in SOURCE_FIELDS):
        raise ValueError('Source identity requires explicit nonempty API and PostgreSQL fields')
    # These effective libpq settings override the named endpoint. Explicit blank values clear inherited settings.
    if any(fields.get(key, os.environ.get(key)) for key in ROUTING_OVERRIDES):
        raise ValueError('Source identity rejects alternate PostgreSQL routing')
    return fields


def _source_name(value, host=False):
    if (not isinstance(value, str) or not value or len(value) > 253
            or not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*', value)
            or re.search(r'(?:^|[._-])(?:your|placeholder|changeme|replace|project_ref)(?:$|[._-])', value, re.I)):
        raise ValueError('Source identity requires plain non-placeholder names')
    if host and (not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*', value)
                 or '..' in value or any(not part or part.startswith('-') or part.endswith('-') for part in value.split('.'))):
        raise ValueError('Source identity requires one explicit PostgreSQL host')
    return value.lower() if host else value


def normalize_source_origin(value):
    """Canonical API origin only; credentials, path routing and template values are forbidden."""
    if not isinstance(value, str) or len(value) > 4096 or any(ord(char) < 33 for char in value):
        raise ValueError('Invalid source API origin')
    try:
        parsed = urllib.parse.urlsplit(value)
        host, port = parsed.hostname, parsed.port
        if (parsed.scheme not in ('https', 'http') or not host or parsed.username is not None
                or parsed.password is not None or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
            raise ValueError('Invalid source API origin')
        if host == '::1':
            host = '::1'
        else:
            host = _source_name(host, host=True)
        if (host in ('example.com', 'example.org', 'example.net') or host.endswith(('.invalid', '.example', '.test'))
                or host.split('.')[0] == 'project'):
            raise ValueError('Placeholder source API origin')
        if parsed.scheme == 'http' and host not in ('localhost', '127.0.0.1', '::1'):
            raise ValueError('Source API requires HTTPS except on loopback')
        if port is not None and not 1 <= port <= 65535:
            raise ValueError('Invalid source API port')
        authority = '[' + host + ']' if ':' in host else host
        if port is not None and port != (443 if parsed.scheme == 'https' else 80):
            authority += ':' + str(port)
        return parsed.scheme + '://' + authority
    except (ValueError, TypeError):
        raise ValueError('Invalid source API origin') from None


def validate_source_binding(binding):
    """Validate only the nonsecret identity contract; a receipt may never add credential fields."""
    _exact_keys(binding, {'supabaseUrl', 'databaseIdentity'})
    database = binding['databaseIdentity']
    _exact_keys(database, {'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER'})
    origin = normalize_source_origin(binding['supabaseUrl'])
    host = database['PGHOST']
    host = host if host == '::1' else _source_name(host, host=True)
    port = database['PGPORT']
    if not isinstance(port, str) or not re.fullmatch(r'[0-9]{1,5}', port) or not 0 < int(port) <= 65535:
        raise ValueError('Source identity requires one explicit PostgreSQL port')
    normalized = {'supabaseUrl': origin, 'databaseIdentity': {'PGHOST': host, 'PGPORT': str(int(port)),
                  'PGDATABASE': _source_name(database['PGDATABASE']), 'PGUSER': _source_name(database['PGUSER'])}}
    if normalized != binding:
        raise ValueError('Source receipt identity must be canonical')
    return binding


def source_identity_from_env(fields):
    """Describe the exact capture environment without exposing or hashing its credential payload."""
    if not isinstance(fields, dict) or any(not fields.get(key) for key in SOURCE_FIELDS):
        raise ValueError('Source identity requires explicit nonempty API and PostgreSQL fields')
    if any(fields.get(key) for key in ROUTING_OVERRIDES):
        raise ValueError('Source identity rejects alternate PostgreSQL routing')
    port = fields['PGPORT']
    if not re.fullmatch(r'[0-9]{1,5}', port) or not 0 < int(port) <= 65535:
        raise ValueError('Source identity requires one explicit PostgreSQL port')
    host = fields['PGHOST'] if fields['PGHOST'] == '::1' else _source_name(fields['PGHOST'], host=True)
    if host not in ('localhost', '127.0.0.1', '::1') and fields.get('PGSSLMODE', os.environ.get('PGSSLMODE')) != 'verify-full':
        raise ValueError('Source identity requires verified remote PostgreSQL TLS')
    binding = {'supabaseUrl': normalize_source_origin(fields['SUPABASE_SOURCE_URL']),
               'databaseIdentity': {'PGHOST': host, 'PGPORT': str(int(port)),
                                    'PGDATABASE': _source_name(fields['PGDATABASE']), 'PGUSER': _source_name(fields['PGUSER'])}}
    return validate_source_binding(binding)


def source_identity(config):
    """Read active private data explicitly; only nonsecret identity is returned to health adapters."""
    return source_identity_from_env(_source_env(config))


def source_binding_hash(binding):
    return configuration_fingerprint(validate_source_binding(binding))


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON configuration key')
        result[key] = value
    return result


def _exact_keys(value, required, optional=()):
    if not isinstance(value, dict) or not set(required) <= set(value) or set(value) - set(required) - set(optional):
        raise ValueError('Configuration has missing or unsupported fields')


def _text(value):
    if not isinstance(value, str) or not value or len(value) > 4096 or any(ord(char) < 32 for char in value):
        raise ValueError('Configuration requires bounded plain strings')
    return value


def _external(value):
    requested = Path(_text(value)).expanduser()
    if not requested.is_absolute() or requested.is_symlink():
        raise ValueError('Private configuration paths must be absolute and not final symlinks')
    return str(external_path(requested))


def load_config(config_file):
    """Return strict normalized job config plus fingerprint, without opening source credential files."""
    filename = private_file(config_file)
    if filename.stat().st_size > CONFIG_LIMIT:
        raise ValueError('Job configuration exceeds size limit')
    raw = json.loads(filename.read_text(), object_pairs_hook=_unique_object,
                     parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite JSON value')))
    _exact_keys(raw, {'version', 'state_dir', 'backup', 'destinations'}, {'_comment'})
    if '_comment' in raw and len(_text(raw['_comment'])) > 1024:
        raise ValueError('Configuration comment must be bounded')
    if type(raw['version']) is not int or raw['version'] != 1:
        raise ValueError('Unsupported job configuration version')
    _exact_keys(raw['backup'], {'env_file', 'output_dir', 'recipients_file', 'consistency'}, {'custody_file'})
    if raw['backup']['consistency'] != 'online':
        raise ValueError('Unattended jobs require online consistency; write freezes are operator-only')
    config = {'version': 1, 'state_dir': _external(raw['state_dir']), 'backup': {}, 'destinations': [],
              'configSha256': configuration_fingerprint(raw)}
    for key in ('env_file', 'output_dir', 'recipients_file'):
        config['backup'][key] = _external(raw['backup'][key])
    config['backup']['custody_file'] = (_external(raw['backup']['custody_file'])
                                        if raw['backup'].get('custody_file') is not None else None)
    config['backup']['consistency'] = 'online'
    if config['state_dir'] == config['backup']['output_dir']:
        raise ValueError('State and archive directories must be separate')
    entries = raw['destinations']
    if not isinstance(entries, list) or not 1 <= len(entries) <= 16:
        raise ValueError('Configure one to sixteen explicit backup destinations')
    ids, targets = set(), set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError('Invalid destination')
        provider = entry.get('provider')
        if provider == 'aws':
            _exact_keys(entry, {'id', 'provider', 'destination', 'kms_key_id'})
        elif provider == 'azure':
            _exact_keys(entry, {'id', 'provider', 'account_name', 'container'})
        else:
            raise ValueError('Unsupported backup destination provider')
        identity = _text(entry['id'])
        if not ID_PATTERN.fullmatch(identity) or identity in ids:
            raise ValueError('Destination IDs must be unique lowercase identifiers')
        ids.add(identity)
        normalized = {'id': identity, 'provider': provider}
        if provider == 'aws':
            parsed = urllib.parse.urlsplit(_text(entry['destination']))
            bucket = parsed.netloc
            prefix = parsed.path.strip('/')
            if (parsed.scheme != 's3' or not re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]', bucket)
                    or parsed.query or parsed.fragment or parsed.username or prefix.split('/')[0] != 'backups'
                    or any(part in ('', '.', '..') for part in prefix.split('/'))
                    or not re.fullmatch(r'[A-Za-z0-9_./-]+', prefix)):
                raise ValueError('AWS destination must be a private s3://bucket/backups[/prefix] location')
            key = _text(entry['kms_key_id'])
            if not re.fullmatch(r'arn:(?:aws|aws-us-gov|aws-cn):kms:[a-z0-9-]+:\d{12}:key/[a-zA-Z0-9-]+', key):
                raise ValueError('AWS publication requires the exact reviewed KMS key ARN')
            normalized.update(destination=f's3://{bucket}/{prefix}', kms_key_id=key)
            target = ('aws', normalized['destination'])
        else:
            account, container = _text(entry['account_name']), _text(entry['container'])
            if (not re.fullmatch(r'[a-z0-9]{3,24}', account)
                    or not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', container) or '--' in container):
                raise ValueError('Invalid Azure account/container names')
            normalized.update(account_name=account, container=container)
            target = ('azure', account, container)
        if target in targets:
            raise ValueError('Duplicate cloud targets do not create independent copies')
        targets.add(target)
        config['destinations'].append(normalized)
    return config


def _private_directory(value):
    directory = Path(_external(value))
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not directory.is_dir() or directory.stat().st_mode & 0o077:
        raise ValueError('Job directories must be private mode 700')
    return directory


def _atomic_json(target, value):
    """Durably replace a private receipt; readers observe either the previous or complete new JSON."""
    if target.is_symlink() or (target.exists() and (not target.is_file() or target.stat().st_mode & 0o077)):
        raise ValueError('Status output must remain a private regular file')
    descriptor, temporary = tempfile.mkstemp(prefix='.job-status-', dir=target.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
            json.dump(value, handle, sort_keys=True, indent=2)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
        directory_descriptor = os.open(target.parent, os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0))
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    finally:
        Path(temporary).unlink(missing_ok=True)


def _timestamp():
    return datetime.now(timezone.utc).isoformat()


def _captured_at(archive):
    match = ARCHIVE_PATTERN.fullmatch(archive.name)
    if not match:
        raise ValueError('Invalid checked archive filename')
    captured = datetime.strptime(match[1], '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
    return captured.isoformat()


def _publish_args(archive, destination):
    return argparse.Namespace(archive=str(archive), provider=destination['provider'],
                              destination=destination.get('destination'), kms_key_id=destination.get('kms_key_id'),
                              account_name=destination.get('account_name'), container=destination.get('container'))



def _target_fingerprint(destination):
    return configuration_fingerprint(destination)


def _aware_time(value):
    if not isinstance(value, str):
        raise ValueError('Receipt timestamp missing')
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError('Receipt timestamp must be timezone aware')
    return parsed


def _private_json(filename):
    path = private_file(filename)
    if path.stat().st_size > CONFIG_LIMIT:
        raise ValueError('Protected receipt exceeds size limit')
    value = json.loads(path.read_text(), object_pairs_hook=_unique_object)
    if not isinstance(value, dict):
        raise ValueError('Protected receipt must be an object')
    return path, value


def _publication_receipt(filename, archive, checksum, provider):
    """Require the publisher's exact private evidence; command conflicts are never treated as success."""
    path, value = _private_json(filename)
    expected_name = re.escape(archive.name) + r'\.' + re.escape(provider) + r'\.[a-f0-9]{12}\.receipt\.json'
    if path.parent != archive.parent or not re.fullmatch(expected_name, path.name):
        raise ValueError('Publisher receipt does not belong to the checked archive')
    if (value.get('archive') != archive.name or value.get('sha256') != checksum
            or value.get('provider') != provider or value.get('upload') != 'provider-command-succeeded'):
        raise ValueError('Publisher evidence does not match this archive/provider')
    published = _aware_time(value.get('publishedAt'))
    if published < _aware_time(_captured_at(archive)) or published > datetime.now(timezone.utc):
        raise ValueError('Publisher evidence has an invalid time')
    return path, digest(path), value['publishedAt']


def _reusable_publications(runs, config, archive, checksum):
    """Find bounded protected prior outcomes bound to exact source/config/target and original evidence."""
    required = {d['id']: d for d in config['destinations']}
    expected_membership = {(d['id'], d['provider']) for d in config['destinations']}
    candidates = sorted((path for path in runs.iterdir() if RUN_PATTERN.fullmatch(path.stem)
                         and path.suffix == '.json'), key=lambda path: path.name, reverse=True)[:REUSE_RECORD_LIMIT]
    reusable = {}
    for candidate in candidates:
        try:
            path, prior = _private_json(candidate)
            if (path.parent != runs or type(prior.get('schemaVersion')) is not int or prior['schemaVersion'] != 1
                    or prior.get('id') != candidate.stem or prior.get('configSha256') != config['configSha256']
                    or prior.get('archive') != str(archive) or prior.get('archiveName') != archive.name
                    or prior.get('archiveCapturedAt') != _captured_at(archive) or prior.get('sha256') != checksum
                    or prior.get('sourceBinding') != config['sourceBinding']
                    or prior.get('sourceBindingSha256') != config['sourceBindingSha256']
                    or prior.get('status') not in ('running', 'failed', 'succeeded')):
                continue
            if source_binding_hash(prior['sourceBinding']) != prior['sourceBindingSha256']:
                continue
            _exact_keys(prior, {'schemaVersion', 'id', 'configSha256', 'startedAt', 'finishedAt', 'status',
                                'archive', 'archiveName', 'archiveCapturedAt', 'sha256', 'destinations',
                                'requiredDestinations', 'remoteIntegrity', 'restoreRehearsal',
                                'sourceBinding', 'sourceBindingSha256', 'captureKind'}, {'errorCode', 'originalCaptureRunId'})
            if prior['remoteIntegrity'] != 'not-verified' or prior['restoreRehearsal'] != 'not-run':
                continue
            if prior['status'] == 'failed':
                if prior.get('errorCode') not in ('publication-incomplete', 'backup-failed', 'archive-invalid',
                                                'job-state-write-failed', 'job-interrupted', 'source-binding-changed',
                                                'archive-source-unproven'):
                    continue
            elif 'errorCode' in prior:
                continue
            started = _aware_time(prior.get('startedAt'))
            finished = prior.get('finishedAt')
            if started > datetime.now(timezone.utc):
                continue
            if prior['status'] == 'running':
                if finished is not None:
                    continue
            elif _aware_time(finished) < started or _aware_time(finished) > datetime.now(timezone.utc):
                continue
            membership = prior.get('requiredDestinations')
            if (not isinstance(membership, list) or len(membership) != len(expected_membership)
                    or any(not isinstance(item, dict) for item in membership)
                    or {(item.get('id'), item.get('provider')) for item in membership} != expected_membership):
                continue
            outcomes = prior.get('destinations')
            if not isinstance(outcomes, list) or len(outcomes) > len(required):
                continue
            seen = set()
            valid = True
            for outcome in outcomes:
                if not isinstance(outcome, dict):
                    valid = False
                    break
                _exact_keys(outcome, {'id', 'provider', 'status', 'targetSha256'},
                            {'receipt', 'receiptSha256', 'publishedAt', 'publicationEvidence', 'originalRunId', 'errorCode'})
                identity = outcome.get('id')
                if (identity not in required or identity in seen or outcome.get('provider') != required[identity]['provider']
                        or outcome.get('status') not in ('uploaded', 'failed')
                        or outcome.get('targetSha256') != _target_fingerprint(required[identity])):
                    valid = False
                    break
                if ((outcome['status'] == 'failed' and outcome.get('errorCode') != 'upload-failed')
                        or (outcome['status'] == 'uploaded' and 'errorCode' in outcome)):
                    valid = False
                    break
                seen.add(identity)
            if not valid:
                continue
            if prior['status'] == 'succeeded' and (len(outcomes) != len(required)
                                                  or any(o['status'] != 'uploaded' for o in outcomes)):
                continue
            pending_reuse = {}
            for outcome in outcomes:
                if outcome['status'] != 'uploaded':
                    continue
                receipt_path, receipt_checksum, published_at = _publication_receipt(
                    outcome.get('receipt'), archive, checksum, outcome['provider'])
                if (outcome.get('receiptSha256') != receipt_checksum or outcome.get('publishedAt') != published_at
                        or outcome.get('publicationEvidence') not in ('provider-command-succeeded', 'reused-provider-receipt')):
                    valid = False
                    break
                published_time = _aware_time(published_at)
                if (published_time > (_aware_time(finished) if finished is not None else datetime.now(timezone.utc))
                        or (outcome['publicationEvidence'] == 'provider-command-succeeded' and published_time < started)
                        or (outcome['publicationEvidence'] == 'reused-provider-receipt'
                            and not RUN_PATTERN.fullmatch(str(outcome.get('originalRunId', ''))))):
                    valid = False
                    break
                pending_reuse[outcome['id']] = {'id': outcome['id'], 'provider': outcome['provider'],
                                               'status': 'uploaded', 'targetSha256': outcome['targetSha256'],
                                               'receipt': str(receipt_path), 'receiptSha256': receipt_checksum,
                                               'publishedAt': published_at, 'publicationEvidence': 'reused-provider-receipt',
                                               'originalRunId': outcome['originalRunId'] if outcome['publicationEvidence'] == 'reused-provider-receipt' else prior['id']}
            if valid:
                for identity, outcome in pending_reuse.items():
                    reusable.setdefault(identity, outcome)
        except (OSError, ValueError, TypeError, KeyError):
            # Missing/malformed/unprotected evidence cannot authorize skipping a provider command.
            continue
    return reusable


def _original_archive_capture(runs, config, archive, checksum, current_id):
    """A retry may retain original identity only from a protected actual job capture of these bytes."""
    candidates = sorted((path for path in runs.iterdir() if RUN_PATTERN.fullmatch(path.stem)
                         and path.suffix == '.json'), key=lambda path: path.name, reverse=True)[:REUSE_RECORD_LIMIT]
    for candidate in candidates:
        try:
            if candidate.stem == current_id:
                continue
            _, prior = _private_json(candidate)
            if (type(prior.get('schemaVersion')) is not int or prior['schemaVersion'] != 1
                    or prior.get('id') != candidate.stem or prior.get('captureKind') != 'new'
                    or prior.get('archive') != str(archive) or prior.get('archiveName') != archive.name
                    or prior.get('archiveCapturedAt') != _captured_at(archive) or prior.get('sha256') != checksum
                    or prior.get('sourceBinding') != config['sourceBinding']
                    or prior.get('sourceBindingSha256') != config['sourceBindingSha256']
                    or prior.get('status') not in ('running', 'failed', 'succeeded')):
                continue
            if source_binding_hash(prior['sourceBinding']) != prior['sourceBindingSha256']:
                continue
            started = _aware_time(prior.get('startedAt'))
            if started > datetime.now(timezone.utc):
                continue
            if prior['status'] != 'running':
                finished = _aware_time(prior.get('finishedAt'))
                if finished < started or finished > datetime.now(timezone.utc):
                    continue
            return prior['id']
        except (ValueError, OSError, TypeError, KeyError):
            continue
    raise JobError('archive-source-unproven')


def run_job(config_file, archive=None):
    """Capture or retry a checked archive, attempt every destination, and retain the last complete success."""
    os.umask(0o077)
    try:
        config = load_config(config_file)
        config['sourceBinding'] = source_identity(config)
        config['sourceBindingSha256'] = source_binding_hash(config['sourceBinding'])
        state = _private_directory(config['state_dir'])
        _private_directory(config['backup']['output_dir'])
        runs = _private_directory(str(state / 'runs'))
    except (OSError, ValueError, TypeError):
        raise JobError('configuration-invalid') from None
    lock_path = state / 'job.lock'
    try:
        lock_descriptor = os.open(lock_path, os.O_RDWR | os.O_CREAT | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    except OSError:
        raise JobError('job-lock-invalid') from None
    try:
        mode = os.fstat(lock_descriptor)
        if not stat.S_ISREG(mode.st_mode) or mode.st_mode & 0o077:
            raise JobError('job-lock-invalid')
        try:
            fcntl.flock(lock_descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            # flock releases after process death, so stale path/PID text never blocks recovery.
            raise JobError('job-lock-busy') from None
        except OSError:
            raise JobError('job-lock-invalid') from None
        identity = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex
        os.ftruncate(lock_descriptor, 0)
        os.write(lock_descriptor, json.dumps({'pid': os.getpid(), 'id': identity}).encode())
        os.fsync(lock_descriptor)
        record = {'schemaVersion': 1, 'id': identity, 'configSha256': config['configSha256'],
                  'sourceBinding': config['sourceBinding'], 'sourceBindingSha256': config['sourceBindingSha256'],
                  'captureKind': 'retry' if archive else 'new',
                  'startedAt': _timestamp(), 'finishedAt': None, 'status': 'running',
                  'archive': None, 'archiveName': None, 'archiveCapturedAt': None, 'sha256': None,
                  'destinations': [], 'requiredDestinations': [{'id': d['id'], 'provider': d['provider']} for d in config['destinations']],
                  'remoteIntegrity': 'not-verified', 'restoreRehearsal': 'not-run'}

        def persist():
            _atomic_json(runs / (identity + '.json'), record)
            _atomic_json(state / 'latest-attempt.json', record)

        phase = 'job-state-write-failed'
        try:
            persist()
            phase = 'archive-invalid' if archive else 'backup-failed'
            if source_identity(config) != config['sourceBinding']:
                phase = 'source-binding-changed'
                raise ValueError('Source changed before capture')
            if archive:
                checked, _ = publish.checked_artifacts(_external(archive))
                record['originalCaptureRunId'] = _original_archive_capture(runs, config, checked, digest(checked), identity)
            else:
                result = backup.create_backup(argparse.Namespace(**config['backup'], quiescence_reference=None))
                # Capture reports its exact used environment, so transient file A→B→A changes cannot relabel B.
                phase = 'source-binding-changed'
                if (result.get('sourceBinding') != config['sourceBinding']
                        or result.get('sourceBindingSha256') != config['sourceBindingSha256']
                        or source_binding_hash(result.get('sourceBinding')) != config['sourceBindingSha256']):
                    raise ValueError('Actual capture source does not match configured source')
                phase = 'backup-failed'
                checked, _ = publish.checked_artifacts(result['archive'])
                if result.get('sha256') != digest(checked):
                    raise ValueError('Created archive hash does not match backup result')
            if source_identity(config) != config['sourceBinding']:
                phase = 'source-binding-changed'
                raise ValueError('Source changed during capture')
            record.update(archive=str(checked), archiveName=checked.name, archiveCapturedAt=_captured_at(checked), sha256=digest(checked))
            phase = 'job-state-write-failed'
            persist()
            reusable = _reusable_publications(runs, config, checked, record['sha256']) if archive else {}
            for destination in config['destinations']:
                outcome = {'id': destination['id'], 'provider': destination['provider'],
                           'targetSha256': _target_fingerprint(destination)}
                if destination['id'] in reusable:
                    outcome = reusable[destination['id']]
                else:
                    try:
                        result = publish.publish(_publish_args(checked, destination))
                        if not isinstance(result, dict) or not result.get('receipt'):
                            raise ValueError('Publisher evidence missing')
                        receipt_path, receipt_checksum, published_at = _publication_receipt(
                            result['receipt'], checked, record['sha256'], destination['provider'])
                        outcome.update(status='uploaded', receipt=str(receipt_path), receiptSha256=receipt_checksum,
                                       publishedAt=published_at, publicationEvidence='provider-command-succeeded')
                    except Exception:
                        outcome.update(status='failed', errorCode='upload-failed')
                record['destinations'].append(outcome)
                persist()
            record['finishedAt'] = _timestamp()
            if source_identity(config) != config['sourceBinding']:
                phase = 'source-binding-changed'
                raise ValueError('Source changed during publication')
            if any(destination['status'] != 'uploaded' for destination in record['destinations']):
                record.update(status='failed', errorCode='publication-incomplete')
                persist()
                raise JobError('publication-incomplete')
            record['status'] = 'succeeded'
            persist()
            _atomic_json(state / 'latest-success.json', record)
            return record
        except JobError as error:
            if record['status'] != 'failed':
                record.update(status='failed', finishedAt=_timestamp(), errorCode=error.code)
                try:
                    persist()
                except Exception:
                    pass
            raise
        except BaseException as error:
            record.update(status='failed', finishedAt=_timestamp(),
                          errorCode='job-interrupted' if isinstance(error, (KeyboardInterrupt, SystemExit)) else phase)
            try:
                persist()
            except Exception:
                pass
            raise JobError(record['errorCode']) from None
    finally:
        # Closing the descriptor releases flock even when backup or status persistence fails.
        os.close(lock_descriptor)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config-file', required=True)
    parser.add_argument('--archive', help='Retry all destinations with an existing checked encrypted archive')
    args = parser.parse_args()
    try:
        record = run_job(args.config_file, args.archive)
        print(json.dumps({'schemaVersion': 1, 'id': record['id'], 'status': record['status']}, sort_keys=True))
        return 0
    except JobError as error:
        print(json.dumps({'schemaVersion': 1, 'status': 'failed', 'errorCode': error.code}, sort_keys=True), file=sys.stderr)
        return 1
    except Exception:
        print(json.dumps({'schemaVersion': 1, 'status': 'failed', 'errorCode': 'job-failed'}, sort_keys=True), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
