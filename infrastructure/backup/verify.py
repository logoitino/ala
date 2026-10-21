#!/usr/bin/env python3
"""Decrypt and verify a backup into a NEW private directory, without database writes.

The archive/checksum must come from protected custody; SHA-256 is not a trusted signature.
The resulting plaintext contains personal data and must be kept isolated and removed after use.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile

from common import ROOT, digest, external_path, extract_tar, private_file, require_tools, run, validate_manifest


def verify_backup(archive, identity_file, destination, max_bytes=100 * 1024 ** 3):
    os.umask(0o077)
    require_tools('age', 'node')
    archive = external_path(archive)
    identity = private_file(identity_file)
    if archive.is_symlink() or not archive.is_file():
        raise ValueError('Backup archive must be a regular external file')
    checksum_path = Path(str(archive) + '.sha256')
    expected = checksum_path.read_text().split()[0]
    if not re.fullmatch('[a-f0-9]{64}', expected) or digest(archive) != expected:
        raise ValueError('Encrypted archive checksum mismatch')
    destination = external_path(destination)
    if destination.exists():
        raise ValueError('Restore staging destination already exists')
    destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix='.tapuai-verify-', dir=destination.parent) as temporary:
            work = Path(temporary)
            plaintext = work / 'payload.tar'
            run(['age', '--decrypt', '--identity', str(identity), '--output', str(plaintext), str(archive)])
            stage = work / 'stage'
            stage.mkdir(mode=0o700)
            extract_tar(plaintext, stage, max_bytes)
            manifest = validate_manifest(stage)
            run(['node', str(ROOT / 'infrastructure/backup/source_capture.mjs'), 'verify', str(stage / 'source.tapuai.gz')])
            # Rename only a fully verified stage. Prior stages and source are untouched.
            stage.rename(destination)
        return {'destination': str(destination), 'integrity': 'passed', 'bucketCount': manifest['bucketCount'],
                'objectCount': manifest['objectCount'], 'consistency': manifest['consistency'],
                'databaseRestored': False, 'configurationCustody': manifest['configurationCustody']}
    except BaseException:
        # Only temporary staging is removed automatically, never an operator-owned destination.
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('--identity-file', required=True)
    parser.add_argument('--destination', required=True)
    parser.add_argument('--max-bytes', type=int, default=100 * 1024 ** 3)
    args = parser.parse_args()
    try:
        print(json.dumps(verify_backup(args.archive, args.identity_file, args.destination, args.max_bytes), sort_keys=True))
        return 0
    except Exception as error:
        print('Verification failed: ' + (str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
