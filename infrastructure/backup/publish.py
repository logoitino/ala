#!/usr/bin/env python3
"""Publish ONLY encrypted archives and checksums to a private AWS or Azure backup store.

Use a dedicated writer identity; keep age decryption keys on a separate recovery machine.
Provider versioning/retention and readback rehearsal remain operator responsibilities.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
import urllib.parse
import uuid

from common import age_envelope, digest, external_path, json_write, private_file, require_tools, run


def checked_artifacts(archive):
    archive = private_file(archive)
    if not re.fullmatch(r'tapuai-\d{8}T\d{6}Z-[a-f0-9]{8}\.tar\.age', archive.name) or not archive.is_file():
        raise ValueError('Publisher accepts only timestamped encrypted backup archives')
    checksum = private_file(str(archive) + '.sha256')
    with archive.open('rb') as handle:
        if not age_envelope(handle.read(64 * 1024)):
            raise ValueError('Publisher requires a binary age-v1 encrypted envelope, not a renamed plaintext file')
    fields = checksum.read_text().strip().split()
    if len(fields) != 2 or fields[1] != archive.name or digest(archive) != fields[0]:
        raise ValueError('Archive checksum/name mismatch')
    return archive, checksum


def publish(args):
    archive, checksum = checked_artifacts(args.archive)
    if args.provider == 'aws':
        require_tools('aws')
        target = urllib.parse.urlsplit(args.destination or '')
        if target.scheme != 's3' or not target.netloc or target.query or target.fragment or target.username:
            raise ValueError('AWS destination must be s3://bucket/optional-prefix')
        if '..' in target.path.split('/'):
            raise ValueError('Invalid backup destination prefix')
        prefix = target.path.strip('/')
        for artifact in (archive, checksum):
            url = 's3://' + target.netloc + '/' + (prefix + '/' if prefix else '') + artifact.name
            command = ['aws', 's3', 'cp', str(artifact), url, '--only-show-errors', '--sse', 'AES256']
            if args.kms_key_id:
                command[-1] = 'aws:kms'
                command += ['--sse-kms-key-id', args.kms_key_id]
            run(command)
    else:
        require_tools('az')
        if not re.fullmatch(r'[a-z0-9]{3,24}', args.account_name or '') or not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', args.container or ''):
            raise ValueError('Azure account/container names are required')
        for artifact in (archive, checksum):
            run(['az', 'storage', 'blob', 'upload', '--auth-mode', 'login', '--account-name', args.account_name,
                 '--container-name', args.container, '--name', artifact.name, '--file', str(artifact),
                 '--overwrite', 'false', '--validate-content', '--only-show-errors'])
    receipt = {'archive': archive.name, 'sha256': digest(archive), 'provider': args.provider,
               'publishedAt': datetime.now(timezone.utc).isoformat(), 'upload': 'provider-command-succeeded',
               'remoteRestoreRehearsal': 'not-run'}
    # Retry may upload the same archive to several destinations. Never overwrite prior evidence.
    filename = Path(str(archive) + '.' + args.provider + '.' + uuid.uuid4().hex[:12] + '.receipt.json')
    json_write(filename, receipt)
    return {**receipt, 'receipt': str(filename)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('--provider', choices=['aws', 'azure'], required=True)
    parser.add_argument('--destination')
    parser.add_argument('--kms-key-id')
    parser.add_argument('--account-name')
    parser.add_argument('--container')
    args = parser.parse_args()
    try:
        print(json.dumps(publish(args), sort_keys=True))
        return 0
    except Exception as error:
        print('Publish failed: ' + (str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
