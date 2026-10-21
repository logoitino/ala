#!/usr/bin/env python3
"""Prepare/check Docker-loadable runtime archives bound to an exact release and isolated target.

Only immutable registry digests are accepted for platform services/proxy. Locally built app
images may use exact content IDs and need explicit retagging after load. This tool captures
images, not external secrets, databases, function bind mounts, or functional service proof.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

REQUIRED = {'fan-web', 'admin-portal', 'proxy', 'db', 'auth', 'rest', 'realtime', 'storage', 'kong', 'functions'}
LOCAL_ALLOWED = {'fan-web', 'admin-portal'}
DIGEST = re.compile(r'sha256:[a-f0-9]{64}')
REGISTRY_PIN = re.compile(r'[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}')
SERVICE_ID = re.compile(r'[a-z][a-z0-9-]{0,62}')
ROOT = Path(__file__).resolve().parents[2]
INSPECT_FORMAT = '{"Id":{{json .Id}},"RepoDigests":{{json .RepoDigests}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"Variant":{{json .Variant}}}'


def _digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def _external(value):
    requested = Path(value).expanduser()
    if not requested.is_absolute() or requested.is_symlink():
        raise ValueError('Runtime paths must be absolute and not final symlinks')
    path = requested.resolve()
    if path == ROOT or ROOT in path.parents:
        raise ValueError('Runtime artifacts and configuration must stay outside the checkout')
    return path


def _private_file(value):
    path = _external(value)
    if not path.is_file() or path.stat().st_mode & 0o077:
        raise ValueError('Runtime input must be a private regular file mode 600 or stricter')
    return path


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate runtime metadata key')
        result[key] = value
    return result


def _invalid_constant(value):
    raise ValueError('Non-finite runtime metadata value')


def _hex(value, length):
    return isinstance(value, str) and bool(re.fullmatch(r'[a-f0-9]{' + str(length) + '}', value))


def _write_private(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())


def _json(value):
    path = _private_file(value)
    if path.stat().st_size > 1024 * 1024:
        raise ValueError('Runtime metadata exceeds size limit')
    result = json.loads(path.read_text(), object_pairs_hook=_unique_object, parse_constant=_invalid_constant)
    if not isinstance(result, dict):
        raise ValueError('Runtime metadata must be an object')
    return path, result


def _identity(release, target, platform):
    if not re.fullmatch(r'[a-f0-9]{64}', release or '') or not SERVICE_ID.fullmatch(target or ''):
        raise ValueError('Release SHA-256 and reviewed target ID are required')
    if not re.fullmatch(r'linux/(?:amd64|arm64(?:/v8)?)', platform or ''):
        raise ValueError('Reviewed Linux amd64/arm64 platform required')
    return platform.split('/')


def _pin(service, reference):
    if not isinstance(service, str) or not SERVICE_ID.fullmatch(service) or not isinstance(reference, str):
        raise ValueError('Invalid runtime service/image mapping')
    if REGISTRY_PIN.fullmatch(reference):
        return 'registry-digest'
    if service in LOCAL_ALLOWED and DIGEST.fullmatch(reference):
        return 'local-image-id'
    raise ValueError('Every image must have an immutable digest; local IDs are app-only')


def _docker(command):
    try:
        return subprocess.run(['docker', 'image', *command], stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        raise RuntimeError('Docker command failed; inspect protected operator diagnostics') from None


def _image_metadata(service, reference, metadata, platform):
    kind = _pin(service, reference)
    parts = platform.split('/')
    if (not isinstance(metadata, dict) or not isinstance(metadata.get('Id'), str)
            or not DIGEST.fullmatch(metadata['Id'])):
        raise ValueError('Docker inspect did not return a content image ID')
    if metadata.get('Os') != parts[0] or metadata.get('Architecture') != parts[1]:
        raise ValueError('Runtime image OS/architecture differs from the reviewed target')
    if len(parts) == 3 and metadata.get('Variant') != parts[2]:
        raise ValueError('Runtime image variant differs from the reviewed target')
    if metadata.get('Variant') is not None and not isinstance(metadata.get('Variant'), str):
        raise ValueError('Runtime image variant evidence invalid')
    repo_digests = metadata.get('RepoDigests') or []
    if not isinstance(repo_digests, list) or any(not isinstance(item, str) for item in repo_digests):
        raise ValueError('Docker repo digest evidence invalid')
    if kind == 'registry-digest' and reference not in repo_digests:
        raise ValueError('Requested registry digest is missing from Docker inspect evidence')
    if kind == 'local-image-id' and reference != metadata['Id']:
        raise ValueError('Requested local image ID differs from Docker content')
    return {'reference': reference, 'pinKind': kind, 'contentId': metadata['Id'],
            'repoDigests': repo_digests, 'os': metadata['Os'], 'architecture': metadata['Architecture'],
            'variant': metadata.get('Variant') or '', 'retagRequired': kind == 'local-image-id'}


def prepare(args):
    """Inspect/save all required app/proxy/upstream images without pulling, publishing or starting them."""
    os.umask(0o077)
    _identity(args.release_version, args.target_id, args.platform)
    images_path, images = _json(args.images_file)
    lock_path, lock = _json(args.upstream_lock)
    inventory_path, inventory = _json(args.deployment_inventory)
    commit = lock.get('commit', '')
    archive_hash = lock.get('archive_sha256', '')
    if (lock.get('status') != 'archive_verified_not_runtime_tested' or not _hex(commit, 40)
            or not _hex(archive_hash, 64) or not lock.get('source_files')
            or inventory.get('upstream_commit') != commit):
        raise ValueError('Known verified upstream archive/source inventory required')
    upstream = inventory.get('images')
    if not isinstance(upstream, dict) or not REQUIRED - LOCAL_ALLOWED - {'proxy'} <= set(upstream):
        raise ValueError('Deployment inventory lacks required Supabase services')
    expected = set(upstream) | LOCAL_ALLOWED | {'proxy'}
    if set(images) != expected or not REQUIRED <= expected:
        raise ValueError('Image map must cover every deployed upstream service plus both apps/proxy exactly')
    for service, reference in images.items():
        _pin(service, reference)
        if service in upstream and (reference != upstream[service] or not REGISTRY_PIN.fullmatch(reference)):
            raise ValueError('Supabase images must equal the reviewed immutable deployment inventory')
    output = _external(args.output_dir)
    if output.exists():
        raise ValueError('Choose a fresh runtime artifact directory; existing evidence is never overwritten')
    started = datetime.now(timezone.utc).isoformat()
    inspected = {}
    # Complete all metadata checks before producing any large archive.
    for service, reference in sorted(images.items()):
        metadata = json.loads(_docker(['inspect', '--format', INSPECT_FORMAT, reference]))
        inspected[service] = _image_metadata(service, reference, metadata, args.platform)
    output.mkdir(mode=0o700, parents=True)
    services = {}
    for service, reference in sorted(images.items()):
        destination = output / (service + '.docker.tar')
        partial = output / (service + '.docker.tar.partial')
        _docker(['save', '--output', str(partial), reference])
        if not partial.is_file() or partial.is_symlink() or partial.stat().st_size == 0:
            raise ValueError('Docker save did not produce a nonempty regular archive')
        partial.chmod(0o600)
        with partial.open('rb') as handle:
            os.fsync(handle.fileno())
        partial.rename(destination)
        services[service] = {**inspected[service], 'archive': destination.name,
                             'size': destination.stat().st_size, 'sha256': _digest(destination)}
    receipt = {'schemaVersion': 1, 'kind': 'tapuai-runtime-images', 'releaseVersion': args.release_version,
               'targetId': args.target_id, 'platform': args.platform, 'upstreamCommit': commit,
               'upstreamArchiveSha256': archive_hash, 'imageMapSha256': _digest(images_path),
               'sourceInventorySha256': _digest(inventory_path), 'upstreamLockSha256': _digest(lock_path),
               'requiredServiceIds': sorted(expected), 'services': services, 'startedAt': started,
               'finishedAt': datetime.now(timezone.utc).isoformat(), 'archiveFormat': 'docker-image-save',
               'preparation': 'docker-image-inspect-and-save', 'runtimeSmokeTests': 'not-run',
               'externalRuntimeConfigurationRequired': True, 'edgeFunctionOverlayRequired': True}
    path = output / 'runtime-images.receipt.json'
    _write_private(path, receipt)
    return {'receipt': str(path), 'releaseVersion': args.release_version, 'targetId': args.target_id,
            'serviceCount': len(services), 'runtimeSmokeTests': 'not-run'}


def check(args):
    """Validate protected identity/metadata/archive hashes offline before a load plan or readiness decision."""
    _identity(args.release_version, args.target_id, args.platform)
    path, receipt = _json(args.receipt)
    if (type(receipt.get('schemaVersion')) is not int or receipt.get('schemaVersion') != 1 or receipt.get('kind') != 'tapuai-runtime-images'
            or receipt.get('releaseVersion') != args.release_version or receipt.get('targetId') != args.target_id
            or receipt.get('platform') != args.platform or receipt.get('archiveFormat') != 'docker-image-save'
            or receipt.get('preparation') != 'docker-image-inspect-and-save'):
        raise ValueError('Runtime receipt does not match this release/target/platform')
    for field, length in [('upstreamCommit', 40), ('upstreamArchiveSha256', 64), ('imageMapSha256', 64),
                          ('sourceInventorySha256', 64), ('upstreamLockSha256', 64)]:
        if not _hex(receipt.get(field), length):
            raise ValueError('Runtime receipt missing exact upstream/input integrity evidence')
    try:
        started = datetime.fromisoformat(receipt['startedAt'])
        finished = datetime.fromisoformat(receipt['finishedAt'])
        if started.utcoffset() is None or finished.utcoffset() is None or finished < started:
            raise ValueError('Runtime preparation timestamps must be timezone-aware and ordered')
    except (KeyError, TypeError, ValueError):
        raise ValueError('Runtime preparation timestamps invalid') from None
    services, required = receipt.get('services'), receipt.get('requiredServiceIds')
    if (not isinstance(services, dict) or not isinstance(required, list)
            or any(not isinstance(service, str) for service in required) or len(required) != len(set(required))
            or set(required) != set(services) or not REQUIRED <= set(services)):
        raise ValueError('Runtime receipt lacks a required service/archive')
    for service, item in services.items():
        if not isinstance(item, dict):
            raise ValueError('Malformed image metadata')
        image = _image_metadata(service, item.get('reference'), {'Id': item.get('contentId'),
            'RepoDigests': item.get('repoDigests'), 'Os': item.get('os'), 'Architecture': item.get('architecture'),
            'Variant': item.get('variant')}, args.platform)
        if (image['pinKind'] != item.get('pinKind') or type(item.get('retagRequired')) is not bool
                or image['retagRequired'] != item.get('retagRequired')):
            raise ValueError('Runtime pin/retag evidence inconsistent')
        if item.get('archive') != service + '.docker.tar':
            raise ValueError('Runtime archive path must be its exact service basename')
        archive = _private_file(str(path.parent / item['archive']))
        if (type(item.get('size')) is not int or item['size'] <= 0 or archive.stat().st_size != item['size']
                or not _hex(item.get('sha256'), 64) or _digest(archive) != item['sha256']):
            raise ValueError('Runtime archive size/hash changed')
    return {'receipt': str(path), 'releaseVersion': args.release_version, 'targetId': args.target_id,
            'serviceCount': len(services), 'archivesVerified': True, 'runtimeSmokeTests': 'not-run'}


def load(args):
    """Plan loading checked archives; execute writes separate protected offline overrides without starting services."""
    verified = check(args)
    path, receipt = _json(args.receipt)
    if not re.fullmatch(r'[a-z0-9][a-z0-9_.-]{0,127}', args.release_tag or ''):
        raise ValueError('Explicit reviewed lowercase release tag required for app retagging')
    app_override, supabase_override = {'services': {}}, {'services': {}}
    steps = []
    for service, item in sorted(receipt['services'].items()):
        steps.append({'action': 'load', 'archive': str(path.parent / item['archive']), 'service': service})
        override = app_override if service in LOCAL_ALLOWED | {'proxy'} else supabase_override
        override['services'][service] = {'image': item['contentId'], 'pull_policy': 'never'}
        if item['retagRequired']:
            steps.append({'action': 'tag', 'source': item['contentId'],
                          'target': 'tapuai/' + service + ':' + args.release_tag, 'service': service})
    result = {**verified, 'executed': args.execute, 'steps': steps, 'startsServices': False,
              'offlineComposeOverrideRequired': None, 'appImageOverride': app_override,
              'supabaseImageOverride': supabase_override, 'releaseTag': args.release_tag}
    if not args.execute:
        return result
    if not getattr(args, 'overrides_dir', None):
        raise ValueError('Explicit fresh private overrides directory required before loading')
    output = _external(args.overrides_dir)
    if output.exists():
        raise ValueError('Existing runtime load evidence/overrides must never be overwritten')
    # Every archive was checked above before the first Docker mutation.
    for step in steps:
        if step['action'] == 'load':
            _docker(['load', '--input', step['archive']])
    registry_lookup_missing = False
    for service, item in receipt['services'].items():
        metadata = json.loads(_docker(['inspect', '--format', INSPECT_FORMAT, item['contentId']]))
        if (metadata.get('Id') != item['contentId'] or metadata.get('Os') != item['os']
                or metadata.get('Architecture') != item['architecture']
                or (item.get('variant') and metadata.get('Variant') != item['variant'])):
            raise ValueError('Loaded content/platform differs from the prepared image')
        if item['pinKind'] == 'registry-digest':
            try:
                resolved = json.loads(_docker(['inspect', '--format', INSPECT_FORMAT, item['reference']]))
                registry_lookup_missing |= resolved.get('Id') != item['contentId']
            except RuntimeError:
                registry_lookup_missing = True
    for step in steps:
        if step['action'] != 'tag':
            continue
        try:
            existing = json.loads(_docker(['inspect', '--format', INSPECT_FORMAT, step['target']]))
        except RuntimeError:
            existing = None
        if existing and existing.get('Id') != step['source']:
            raise ValueError('Reviewed release tag already identifies a different app image')
        if not existing:
            _docker(['tag', step['source'], step['target']])
        tagged = json.loads(_docker(['inspect', '--format', INSPECT_FORMAT, step['target']]))
        if tagged.get('Id') != step['source']:
            raise ValueError('Retagged app image does not identify the prepared content')
    os.umask(0o077)
    output.mkdir(mode=0o700, parents=True)
    app_path, supabase_path = output / 'app-images.override.json', output / 'supabase-images.override.json'
    _write_private(app_path, app_override)
    _write_private(supabase_path, supabase_override)
    load_receipt = {'schemaVersion': 1, 'kind': 'tapuai-runtime-load', 'releaseVersion': args.release_version,
                    'targetId': args.target_id, 'platform': args.platform, 'releaseTag': args.release_tag,
                    'imageReceiptSha256': _digest(path), 'loadedAt': datetime.now(timezone.utc).isoformat(),
                    'postLoadContentIdsVerified': True, 'offlineComposeOverrideRequired': registry_lookup_missing,
                    'appOverride': {'path': str(app_path), 'sha256': _digest(app_path)},
                    'supabaseOverride': {'path': str(supabase_path), 'sha256': _digest(supabase_path)},
                    'startsServices': False, 'runtimeSmokeTests': 'not-run'}
    load_path = output / 'runtime-load.receipt.json'
    _write_private(load_path, load_receipt)
    result.update(offlineComposeOverrideRequired=registry_lookup_missing, loadReceipt=str(load_path),
                  appOverrideFile=str(app_path), supabaseOverrideFile=str(supabase_path))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ('prepare', 'check', 'load'):
        command = commands.add_parser(name)
        command.add_argument('--release-version', required=True)
        command.add_argument('--target-id', required=True)
        command.add_argument('--platform', default='linux/amd64')
        if name == 'prepare':
            command.add_argument('--images-file', required=True)
            command.add_argument('--upstream-lock', required=True)
            command.add_argument('--deployment-inventory', required=True)
            command.add_argument('--output-dir', required=True)
        else:
            command.add_argument('--receipt', required=True)
        if name == 'load':
            command.add_argument('--release-tag', required=True)
            command.add_argument('--execute', action='store_true')
            command.add_argument('--overrides-dir', help='Fresh private output directory required with execute')
    args = parser.parse_args()
    try:
        result = {'prepare': prepare, 'check': check, 'load': load}[args.command](args)
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception:
        print('Runtime images failed; input, platform, Docker or archive evidence invalid. Inspect privately.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
