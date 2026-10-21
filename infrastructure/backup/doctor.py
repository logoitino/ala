#!/usr/bin/env python3
"""Report operator prerequisites without reading credentials or contacting providers."""
import json
import shutil
import sys


def main():
    required = {name: bool(shutil.which(name)) for name in ('python3', 'node', 'pg_dump', 'pg_restore', 'psql', 'age')}
    optional = {name: bool(shutil.which(name)) for name in ('docker', 'terraform', 'aws', 'az')}
    print(json.dumps({'backupTools': required, 'deploymentAndUploadTools': optional,
                      'backupReady': all(required.values()), 'credentialsChecked': False,
                      'restoreRehearsal': 'not-run'}, indent=2, sort_keys=True))
    return 0 if all(required.values()) else 1


if __name__ == '__main__':
    sys.exit(main())
