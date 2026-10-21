#!/usr/bin/env python3
"""Retrieve an encrypted AWS/Azure backup using a separate recovery reader identity.

Compare to the protected original checksum, not just the cloud's adjacent checksum.
Retrieval validates ciphertext; decrypting and restoring remain separate measured steps.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.parse

from common import external_path, json_write, require_tools, run
from publish import checked_artifacts

ARCHIVE_NAME = re.compile(r'tapuai-\d{8}T\d{6}Z-[a-f0-9]{8}\.tar\.age')


def download_commands(args, directory):
    """Build argv arrays only; cloud credentials stay in the configured CLI identity."""
    if not ARCHIVE_NAME.fullmatch(args.filename):
        raise ValueError('Use a generated backup archive filename')
    files = [args.filename, args.filename + '.sha256']
    if args.provider == 'aws':
        target = urllib.parse.urlsplit(args.destination or '')
        if target.scheme != 's3' or not target.netloc or target.username or target.query or target.fragment or '..' in target.path.split('/'):
            raise ValueError('AWS source must be s3://bucket/optional-prefix')
        prefix = args.destination.rstrip('/') + '/'
        return [['aws', 's3', 'cp', prefix + name, str(directory / name), '--only-show-errors'] for name in files]
    if not re.fullmatch(r'[a-z0-9]{3,24}', args.account_name or '') or not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', args.container or ''):
        raise ValueError('Azure source account/container names are required')
    return [['az', 'storage', 'blob', 'download', '--auth-mode', 'login', '--account-name', args.account_name,
             '--container-name', args.container, '--name', name, '--file', str(directory / name),
             '--only-show-errors'] for name in files]


def fetch(args):
    os.umask(0o077)
    if not re.fullmatch(r'[a-f0-9]{64}', args.expected_sha256 or ''):
        raise ValueError('Provide the protected original --expected-sha256')
    requested = Path(args.destination_dir).expanduser()
    if requested.is_symlink():
        raise ValueError('Recovery download destination must not be a symlink')
    destination = external_path(requested)
    if destination.exists():
        raise ValueError('Recovery download destination already exists')
    # Validate cloud arguments before any downloads or filesystem staging.
    download_commands(args, destination)
    require_tools('aws' if args.provider == 'aws' else 'az')
    destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.tapuai-fetch-', dir=destination.parent) as temporary:
        stage = Path(temporary)
        for command in download_commands(args, stage):
            run(command)
        for name in (args.filename, args.filename + '.sha256'):
            path = stage / name
            if not path.is_file() or path.is_symlink():
                raise ValueError('Provider download produced a missing or unsafe file')
            path.chmod(0o600)
        archive, checksum = checked_artifacts(stage / args.filename)
        actual = checksum.read_text().split()[0]
        if actual != args.expected_sha256:
            raise ValueError('Remote archive differs from the protected original checksum')
        receipt = {'schemaVersion': 1, 'filename': args.filename, 'sha256': actual, 'provider': args.provider,
                   'retrievedAt': datetime.now(timezone.utc).isoformat(), 'bytes': archive.stat().st_size,
                   'ciphertextIntegrity': 'passed', 'decryption': 'not-run', 'restoreRehearsal': 'not-run'}
        json_write(stage / 'fetch-receipt.json', receipt)
        stage.rename(destination)
    return {**receipt, 'destination': str(destination), 'archive': str(destination / args.filename)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--provider', choices=['aws', 'azure'], required=True)
    parser.add_argument('--filename', required=True)
    parser.add_argument('--expected-sha256', required=True)
    parser.add_argument('--destination-dir', required=True)
    parser.add_argument('--destination')
    parser.add_argument('--account-name')
    parser.add_argument('--container')
    args = parser.parse_args()
    try:
        print(json.dumps(fetch(args), sort_keys=True))
        return 0
    except Exception as error:
        print('Retrieval failed: ' + (str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
