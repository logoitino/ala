"""Shared backup boundaries: private files, bounded HTTP and verified archive contents.

Only operator tools import this module. Credentials never enter command arguments or logs.
Storage object names stay in the manifest; local payload names are hashes, not user paths.
"""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
MAX_MANIFEST_BYTES = 64 * 1024 * 1024


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def age_envelope(header):
    """Check binary age-v1 framing; authentication itself requires the separately held identity."""
    return (header.startswith(b'age-encryption.org/v1\n') and b'\n-> ' in header
            and re.search(rb'\n--- [A-Za-z0-9+/]{43}\n', header) is not None)


def external_path(path):
    resolved = Path(path).expanduser().resolve()
    if resolved == ROOT or ROOT in resolved.parents:
        raise ValueError('Database, credentials and backup artifacts must be outside the repository')
    return resolved


def private_file(path):
    original = Path(path).expanduser()
    if original.is_symlink():
        raise ValueError('Private input must not be a symlink')
    path = external_path(original)
    if not path.is_file() or path.stat().st_mode & 0o077:
        raise ValueError('Private input must be a regular file with mode 600 or stricter')
    return path


def load_env(path=None):
    """Read a dotenv file as data, with no shell evaluation or variable expansion."""
    env = dict(os.environ)
    if path:
        for line in private_file(path).read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            key, sep, value = line.partition('=')
            if not sep or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key):
                raise ValueError('Invalid environment file syntax')
            if len(value) >= 2 and value[0] == value[-1] and value[0] in '\"\'':
                value = value[1:-1]
            env[key] = value
    return env


def postgres_env(env):
    """Require named PostgreSQL connection fields so connection strings cannot leak."""
    for key in ('PGHOST', 'PGDATABASE', 'PGUSER'):
        if not env.get(key) or env[key].startswith('-'):
            raise ValueError(f'Missing or invalid {key}')
    # libpq accepts connection strings in --dbname and PGHOSTADDR overrides PGHOST routing.
    # Refuse both so the operator's confirmed target cannot silently resolve to the source.
    if not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*', env['PGDATABASE']):
        raise ValueError('PGDATABASE must be a plain database name, never libpq conninfo or a URI')
    if env['PGHOST'] != '::1' and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*', env['PGHOST']):
        raise ValueError('PGHOST must be one explicit DNS name or loopback/IP host')
    if not str(env.get('PGPORT', '5432')).isdigit() or not 0 < int(env.get('PGPORT', '5432')) <= 65535:
        raise ValueError('PGPORT must be one valid TCP port')
    if any(env.get(key) for key in ('PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGHOSTADDR')):
        raise ValueError('Use explicit PG fields; service, options and alternate host routing are unsupported')
    if env.get('PGPASSFILE'):
        private_file(env['PGPASSFILE'])
    if env['PGHOST'] not in ('localhost', '127.0.0.1', '::1') and env.get('PGSSLMODE') != 'verify-full':
        raise ValueError('Remote PostgreSQL requires PGSSLMODE=verify-full and trusted root certificates')
    return env


def run(command, env=None, stdout=None):
    """Subprocess output is withheld on failure because providers can echo secrets."""
    try:
        return subprocess.run(command, env=env, stdout=stdout or subprocess.PIPE,
                              stderr=subprocess.PIPE, check=True)
    except (subprocess.CalledProcessError, OSError):
        raise RuntimeError(f'{Path(command[0]).name} failed; inspect privately on the operator machine') from None


def require_tools(*names):
    missing = [name for name in names if not shutil.which(name)]
    if missing:
        raise ValueError('Install required tools: ' + ', '.join(missing))


def json_write(path, value):
    with Path(path).open('x', encoding='utf-8') as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write('\n')
    Path(path).chmod(0o600)


def origin(value):
    parsed = urllib.parse.urlsplit(value or '')
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('Supabase URL must be an origin without credentials, path or query')
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1')):
        raise ValueError('Supabase requires HTTPS, except loopback rehearsal origins')
    return urllib.parse.urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), '', '', '')).rstrip('/')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        # Service-role authorization must never follow a redirect to another host.
        return None


class Storage:
    def __init__(self, url, key, page_size=1000):
        self.url = origin(url)
        if not key:
            raise ValueError('Missing Supabase service-role key')
        self.headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
        self.page_size = page_size
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, route, data=None, method=None, destination=None, headers=None):
        request = urllib.request.Request(self.url + '/storage/v1/' + route, data=data,
                                         method=method, headers={**self.headers, **(headers or {})})
        for attempt in range(4):
            try:
                if hasattr(data, 'seek'):
                    data.seek(0)
                with self.opener.open(request, timeout=120) as response:
                    if destination:
                        with Path(destination).open('wb') as output:
                            shutil.copyfileobj(response, output, 1024 * 1024)
                        Path(destination).chmod(0o600)
                        return None
                    result = response.read(MAX_MANIFEST_BYTES + 1)
                    if len(result) > MAX_MANIFEST_BYTES:
                        raise ValueError('Storage API response exceeds manifest limit')
                    return json.loads(result)
            except urllib.error.HTTPError as error:
                if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                    raise RuntimeError(f'Storage request failed (HTTP {error.code}); no complete artifact produced') from None
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                if attempt == 3:
                    raise RuntimeError('Storage connection failed; no complete artifact produced') from None
            time.sleep(2 ** attempt)

    def buckets(self):
        result = self.request('bucket')
        if not isinstance(result, list) or any(not isinstance(b.get('id'), str) for b in result):
            raise ValueError('Invalid Storage bucket inventory')
        ids = [b['id'] for b in result]
        if len(ids) != len(set(ids)):
            raise ValueError('Duplicate bucket inventory')
        return sorted(result, key=lambda b: b['id'])

    def objects(self, bucket):
        pending, result, seen = [''], [], set()
        while pending:
            prefix = pending.pop()
            offset = 0
            while True:
                page = self.request('object/list/' + urllib.parse.quote(bucket, safe=''),
                                    json.dumps({'prefix': prefix, 'limit': self.page_size, 'offset': offset,
                                                'sortBy': {'column': 'name', 'order': 'asc'}}).encode(),
                                    'POST', headers={'Content-Type': 'application/json'})
                if not isinstance(page, list) or len(page) > self.page_size:
                    raise ValueError('Invalid Storage object page')
                for item in page:
                    name = item.get('name')
                    if not isinstance(name, str) or not name or '/' in name or name in ('.', '..'):
                        raise ValueError('Unexpected Storage object name')
                    full_name = prefix + name
                    if full_name in seen:
                        raise ValueError('Repeated Storage entry: pagination or concurrent-write failure')
                    seen.add(full_name)
                    if item.get('id') is None:
                        pending.append(full_name + '/')
                    else:
                        result.append({**item, 'bucket_id': bucket, 'name': full_name})
                if len(page) < self.page_size:
                    break
                offset += len(page)
        return sorted(result, key=lambda x: x['name'])

    def download(self, bucket, name, destination):
        self.request('object/' + urllib.parse.quote(bucket, safe='') + '/' + urllib.parse.quote(name, safe='/'),
                     destination=destination)

    def upload(self, item, payload):
        metadata = item.get('metadata') or {}
        content_type = metadata.get('mimetype') or 'application/octet-stream'
        # Upload is explicit restore-only and preserves the original object path.
        with Path(payload).open('rb') as body:
            self.request('object/' + urllib.parse.quote(item['bucket_id'], safe='') + '/' + urllib.parse.quote(item['name'], safe='/'),
                         body, 'POST', headers={'Content-Type': content_type, 'x-upsert': 'true',
                                              'Content-Length': str(Path(payload).stat().st_size),
                                              'cache-control': str(metadata.get('cacheControl', '3600'))})


def storage_signature(items):
    return sorted((i['bucket_id'], i['name'], i['id'], i.get('updated_at'),
                   json.dumps(i.get('metadata'), sort_keys=True)) for i in items)


def validate_manifest(directory):
    """Require exact payload coverage and hashes before any database or storage writes."""
    directory = Path(directory)
    manifest_path = directory / 'manifest.json'
    if manifest_path.stat().st_size > MAX_MANIFEST_BYTES:
        raise ValueError('Manifest size limit exceeded')
    manifest = json.loads(manifest_path.read_text())
    if manifest.get('format') != 'tapuai-full-backup' or manifest.get('version') != 1:
        raise ValueError('Unsupported backup manifest')
    records, seen = manifest.get('files'), set()
    if not isinstance(records, list) or not records:
        raise ValueError('Missing manifest files')
    for item in records:
        name = item.get('path', '')
        p = PurePosixPath(name)
        if not name or p.is_absolute() or '..' in p.parts or str(p) != name or '\\' in name or name in seen or name == 'manifest.json':
            raise ValueError('Unsafe or duplicate manifest path')
        seen.add(name)
        target = directory / name
        if target.is_symlink() or not target.is_file() or directory.resolve() not in target.resolve().parents:
            raise ValueError('Missing or unsafe backup payload')
        if target.stat().st_size != item.get('size') or digest(target) != item.get('sha256'):
            raise ValueError('Backup payload size/hash mismatch')
    actual = {str(p.relative_to(directory)) for p in directory.rglob('*') if p.is_file()}
    if actual != seen | {'manifest.json'}:
        raise ValueError('Backup contains unlisted files')
    required = {'database.dump', 'database.toc', 'database-inventory.json', 'storage-inventory.json', 'source.tapuai.gz', 'source.metadata.json'}
    if not required <= seen:
        raise ValueError('Backup is missing required recovery components')
    storage = json.loads((directory / 'storage-inventory.json').read_text())
    objects = storage.get('objects', [])
    expected = {i.get('payload') for i in objects}
    if len(expected) != len(objects) or None in expected or expected != {name for name in seen if name.startswith('objects/')}:
        raise ValueError('Storage payload coverage mismatch')
    if manifest.get('objectCount') != len(objects) or manifest.get('bucketCount') != len(storage.get('buckets', [])):
        raise ValueError('Storage count mismatch')
    return manifest


def extract_tar(archive, destination, max_bytes):
    """Reject links, traversal, duplicate paths, sparse files and oversized extraction."""
    destination = Path(destination)
    with tarfile.open(archive, 'r:') as handle:
        seen, total = set(), 0
        for member in handle:
            p = PurePosixPath(member.name)
            if (not member.isfile() or member.issparse() or p.is_absolute() or '..' in p.parts
                    or str(p) != member.name or '\\' in member.name or member.name in seen or len(seen) >= 1_000_000):
                raise ValueError('Unsafe backup archive entry')
            total += member.size
            if total > max_bytes:
                raise ValueError('Backup extraction limit exceeded')
            seen.add(member.name)
            target = destination / member.name
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with handle.extractfile(member) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output, 1024 * 1024)
            target.chmod(0o600)
