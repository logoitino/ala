#!/usr/bin/env python3
"""Stage exact reviewed upstream Supabase source outside Git; never start services or apply SQL."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tarfile
import tempfile
import urllib.request
from datetime import datetime, timezone


def bootstrap(destination, commit, checksum):
    """Fetch a reviewed archive and extract only its Docker deployment tree without unsafe links."""
    if not re.fullmatch(r"[a-f0-9]{40}", commit) or not re.fullmatch(r"[a-f0-9]{64}", checksum):
        raise ValueError("Provide the independently reviewed full commit and archive SHA-256")
    destination = Path(destination).expanduser()
    if destination.is_symlink():
        raise ValueError("Deployment destination cannot be a symlink")
    destination = destination.resolve()
    repo = Path(__file__).resolve().parents[2]
    if destination == repo or repo in destination.parents:
        raise ValueError("Deployment must live outside the source checkout")
    if destination.exists():
        raise ValueError("Destination already exists; choose a fresh directory")
    os.umask(0o077)
    url = f"https://codeload.github.com/supabase/supabase/tar.gz/{commit}"
    with tempfile.TemporaryDirectory(prefix="tapuai-supabase-") as scratch:
        archive = Path(scratch) / "upstream.tar.gz"
        request = urllib.request.Request(url, headers={"User-Agent": "tapuai-recovery-bootstrap"})
        with urllib.request.urlopen(request, timeout=60) as response, archive.open("wb") as output:
            shutil.copyfileobj(response, output)
        with archive.open("rb") as stream:
            hasher = hashlib.sha256()
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                hasher.update(chunk)
            digest = hasher.hexdigest()
        if digest != checksum:
            raise ValueError("Upstream archive checksum differs from approved checksum")
        staged = Path(scratch) / "staged"
        staged.mkdir()
        with tarfile.open(archive, "r:gz") as source:
            for member in source.getmembers():
                parts = Path(member.name).parts
                if len(parts) < 3 or parts[1] != "docker":
                    continue
                relative = Path(*parts[2:])
                if ".." in relative.parts or relative.is_absolute():
                    raise ValueError("Unsafe upstream archive path")
                target = staged / relative
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                elif member.isfile():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with source.extractfile(member) as input_file, target.open("wb") as output:
                        shutil.copyfileobj(input_file, output)
                    target.chmod(member.mode & 0o755)
                else:
                    raise ValueError("Upstream Docker tree has unsupported links or special files")
        for required in ["docker-compose.yml", ".env.example", "volumes/functions/main/index.ts"]:
            if not (staged / required).is_file():
                raise ValueError(f"Approved upstream lacks required deployment file: {required}")
        images = re.findall(r"^\s+image:\s*([^\s#]+)", (staged / "docker-compose.yml").read_text(), re.M)
        if not images or any("${" in image or image.endswith(":latest") or (":" not in image and "@sha256:" not in image) for image in images):
            raise ValueError("Upstream image inventory must contain explicit version tags/digests, never latest or unresolved variables")
        source_files = {str(path.relative_to(staged)): hashlib.sha256(path.read_bytes()).hexdigest() for path in staged.rglob("*") if path.is_file()}
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(staged), str(destination))
        lock = {"purpose": "Verified reviewed upstream Supabase source archive", "status": "archive_verified_not_runtime_tested", "repository": "https://github.com/supabase/supabase", "commit": commit, "archive_sha256": digest, "checked_at": datetime.now(timezone.utc).isoformat(), "images": images, "source_files": source_files}
        (destination / "upstream.lock.json").write_text(json.dumps(lock, indent=2) + "\n")
        # An upstream example commonly ships insecure defaults: keep it an inert template.
        if (destination / ".env").exists():
            (destination / ".env").unlink()
    print(f"Staged verified source at {destination}; create reviewed private configuration before configure.py")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", required=True)
    parser.add_argument("--upstream-commit", required=True)
    parser.add_argument("--archive-sha256", required=True)
    args = parser.parse_args()
    try:
        bootstrap(args.destination, args.upstream_commit, args.archive_sha256)
    except (OSError, ValueError, tarfile.TarError) as error:
        parser.exit(1, f"Bootstrap failed: {error}\n")


if __name__ == "__main__":
    main()
