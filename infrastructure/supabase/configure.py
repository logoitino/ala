#!/usr/bin/env python3
"""Privately render pinned upstream Supabase, remove host ports and stage reviewed Edge adapters."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlsplit

ALLOWLIST = ("create-payment-intent", "create-stripe-account")
REQUIRED_SERVICES = {"db", "auth", "rest", "realtime", "storage", "kong", "functions"}
SECURITY_FIELDS = {
    "POSTGRES_PASSWORD": "POSTGRES_PASSWORD", "JWT_SECRET": "JWT_SECRET",
    "GOTRUE_JWT_SECRET": "JWT_SECRET", "PGRST_JWT_SECRET": "JWT_SECRET", "AUTH_JWT_SECRET": "JWT_SECRET",
    "DASHBOARD_PASSWORD": "DASHBOARD_PASSWORD", "ANON_KEY": "ANON_KEY", "SUPABASE_ANON_KEY": "ANON_KEY",
    "SERVICE_ROLE_KEY": "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY": "SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY": "SERVICE_ROLE_KEY", "API_EXTERNAL_URL": "API_EXTERNAL_URL",
    "SUPABASE_PUBLIC_URL": "SUPABASE_PUBLIC_URL", "SITE_URL": "SITE_URL", "GOTRUE_SITE_URL": "SITE_URL",
}
CORE_FIELDS = {
    "db": ("POSTGRES_PASSWORD",),
    "auth": ("GOTRUE_JWT_SECRET", "API_EXTERNAL_URL", "GOTRUE_SITE_URL"),
    "rest": ("PGRST_JWT_SECRET",),
    "kong": ("SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", "DASHBOARD_PASSWORD"),
    "functions": ("JWT_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
}


def reviewed_environment(filename):
    """Read private deployment settings as literal data so Compose cannot reinterpret a reviewed value."""
    if not filename.is_file() or filename.stat().st_uid != os.getuid() or filename.stat().st_mode & 0o077 or filename.stat().st_size > 65_536:
        raise ValueError("Private environment must be a bounded owned regular file with mode 0600 or stricter")
    result = {}
    for line in filename.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or key in result:
            raise ValueError("Invalid or duplicate private environment field")
        quoted = value.startswith(('"', "'"))
        if quoted:
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError("Ambiguous private environment quoting")
            value = value[1:-1]
        if (any(char in value for char in ("$", "`", "\\")) or any(ord(char) < 32 or ord(char) == 127 for char in value)
                or not quoted and any(char in value for char in ('"', "'", "#"))):
            raise ValueError("Private environment expansion or ambiguous syntax is unsupported")
        result[key] = value
    return result


def validate_rendered_security(services, expected):
    """Bind standard core and every present sensitive alias to the exact values approved before Compose."""
    for name, service in services.items():
        environment = service.get("environment", {})
        if not isinstance(environment, dict):
            raise ValueError("Rendered connection/security configuration differs from reviewed inputs")
        if any(key not in environment for key in CORE_FIELDS.get(name, ())):
            raise ValueError("Rendered connection/security configuration is missing required core fields")
        for key, value in environment.items():
            original = SECURITY_FIELDS.get(key)
            if original is not None and (not isinstance(value, str) or value != expected[original]):
                raise ValueError("Rendered connection/security configuration differs from reviewed inputs")


def configure(deployment, env_file, functions_source, image_digests_file, output):
    """Resolve the upstream compose on the operator host, keeping service secrets off stdout."""
    os.umask(0o077)
    deployment = Path(deployment).resolve(strict=True)
    env_file = Path(env_file).expanduser()
    if env_file.is_symlink():
        raise ValueError("Private environment cannot be a symlink")
    env_file = env_file.resolve(strict=True)
    output = Path(output).expanduser()
    if output.is_symlink():
        raise ValueError("Rendered output cannot be a symlink")
    output = output.resolve()
    source = Path(functions_source).resolve(strict=True)
    image_digests_file = Path(image_digests_file).resolve(strict=True)
    repo = Path(__file__).resolve().parents[2]
    for private in [deployment, env_file, image_digests_file, output]:
        if private == repo or repo in private.parents:
            raise ValueError("Deployment, env and rendered configuration must stay outside Git")
    if output.exists():
        raise ValueError("Rendered output already exists; review a new file before replacement")
    lock = json.loads((deployment / "upstream.lock.json").read_text())
    if lock.get("status") != "archive_verified_not_runtime_tested":
        raise ValueError("Only bootstrap-verified source can be configured")
    for relative, expected in lock.get("source_files", {}).items():
        candidate = deployment / relative
        if candidate.is_symlink() or not candidate.is_file() or hashlib.sha256(candidate.read_bytes()).hexdigest() != expected:
            raise ValueError("Pinned upstream source changed after bootstrap")
    if not lock.get("source_files"):
        raise ValueError("Upstream source integrity inventory missing")
    image_digests = json.loads(image_digests_file.read_text())
    env = reviewed_environment(env_file)
    for name in ["POSTGRES_PASSWORD", "JWT_SECRET", "ANON_KEY", "SERVICE_ROLE_KEY", "DASHBOARD_PASSWORD", "API_EXTERNAL_URL", "SUPABASE_PUBLIC_URL", "SITE_URL"]:
        value = env.get(name, "")
        if not value or any(marker in value.lower() for marker in ["your-", "your_", "replace", "thisismy", "super-secret", "example.com"]):
            raise ValueError(f"Private configuration requires reviewed non-placeholder {name}")
    if len(env["JWT_SECRET"]) < 32 or len(env["POSTGRES_PASSWORD"]) < 24 or len(env["DASHBOARD_PASSWORD"]) < 24:
        raise ValueError("JWT secret must be 32+ characters and SQL/dashboard passwords 24+ characters")
    for name in ["API_EXTERNAL_URL", "SUPABASE_PUBLIC_URL", "SITE_URL"]:
        try:
            parsed = urlsplit(env[name])
            valid = (parsed.scheme == "https" and bool(parsed.hostname) and parsed.username is None
                     and parsed.password is None and parsed.path in ("", "/") and not parsed.query and not parsed.fragment
                     and (parsed.port is None or 1 <= parsed.port <= 65535) and not any(char.isspace() for char in env[name]))
        except ValueError:
            valid = False
        if not valid:
            raise ValueError(f"{name} must use the reviewed HTTPS public origin")
    command = ["docker", "compose", "--env-file", str(env_file), "--project-directory", str(deployment), "-f", str(deployment / "docker-compose.yml"), "config", "--format", "json"]
    # Compose gives process variables priority over --env-file. Supply the already reviewed file values
    # explicitly, so inherited weak secrets or another public endpoint cannot win that precedence rule.
    compose_environment = dict(os.environ)
    compose_environment.update(env)
    result = subprocess.run(command, env=compose_environment, capture_output=True, text=True)
    if result.returncode:
        # Compose diagnostics may interpolate credentials, so do not echo them.
        raise ValueError("Upstream compose did not resolve; inspect privately on the operator host")
    config = json.loads(result.stdout)
    services = config.get("services", {})
    if not REQUIRED_SERVICES <= services.keys():
        raise ValueError("Approved upstream is missing required Supabase services")
    validate_rendered_security(services, env)
    if set(image_digests) != set(services):
        raise ValueError("Reviewed image digest map must cover every upstream service exactly")
    for name, service in services.items():
        service.pop("ports", None)
        image = service.get("image", "")
        if not image or image.endswith(":latest") or (":" not in image and "@sha256:" not in image):
            raise ValueError("Every upstream service must have a reviewed versioned image")
        pinned = image_digests[name]
        repository = image.split("@", 1)[0].rsplit(":", 1)[0] if "@" not in image else image.split("@", 1)[0]
        if not isinstance(pinned, str) or not re.fullmatch(re.escape(repository) + r"@sha256:[a-f0-9]{64}", pinned):
            raise ValueError(f"Reviewed image digest required for original upstream repository: {name}")
        service["image"] = pinned
        if service.get("network_mode") == "host":
            raise ValueError("Host networking is refused because it bypasses private service ports")
        service["restart"] = "unless-stopped"
        # Preserve service-specific networks; replace the default with our shared private bridge.
        networks = service.setdefault("networks", {"default": None})
        if "default" not in networks:
            networks["default"] = None
    config.setdefault("networks", {})["default"] = {"external": True, "name": "tapuai-backend"}
    mounts = services["functions"].get("volumes", [])
    functions_mount = next((mount for mount in mounts if mount.get("target") == "/home/deno/functions"), None)
    if not functions_mount or functions_mount.get("type") != "bind":
        raise ValueError("Approved upstream must have the standard Edge Functions bind mount")
    target = deployment / "tapuai-functions"
    if target.exists():
        raise ValueError("Functions staging already exists; use a clean reviewed deployment")
    upstream_main = Path(functions_mount["source"]) / "main"
    if not (upstream_main / "index.ts").is_file():
        raise ValueError("Upstream main Edge dispatcher is missing")
    for name in [*ALLOWLIST, "_shared"]:
        candidate = source / name
        if candidate.is_symlink() or not candidate.is_dir() or any(path.is_symlink() for path in candidate.rglob("*")):
            raise ValueError(f"Reviewed function folder missing or contains links: {name}")
    if env.get("STRIPE_SECRET_KEY"):
        if not env["STRIPE_SECRET_KEY"].startswith("sk_test_"):
            raise ValueError("Current payment release permits Stripe test secrets only")
    else:
        raise ValueError("Reviewed payment adapters require STRIPE_SECRET_KEY in the private env file")
    target.mkdir(mode=0o700)
    shutil.copytree(upstream_main, target / "main")
    for name in [*ALLOWLIST, "_shared"]:
        # Only runtime source travels; dotenv, test data and fixtures never become public functions.
        shutil.copytree(source / name, target / name, ignore=shutil.ignore_patterns(".env*", "*.test.*", "__tests__", "__fixtures__", "node_modules"))
    functions_mount["source"] = str(target)
    functions_mount["read_only"] = True
    functions_env = services["functions"].setdefault("environment", {})
    functions_env["VERIFY_JWT"] = "true"
    functions_env["STRIPE_SECRET_KEY"] = env["STRIPE_SECRET_KEY"]
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        json.dump(config, stream, indent=2)
        stream.write("\n")
    inventory = {"purpose": "Private deployment review inventory; no configuration values", "upstream_commit": lock["commit"], "images": {name: service["image"] for name, service in services.items()}, "rendered_sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "enabled_functions": list(ALLOWLIST), "published_host_ports": [], "runtime_tested": False}
    (deployment / "deployment.inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
    print(f"Wrote private configuration {output}; all upstream host ports removed; webhook excluded")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deployment-dir", required=True)
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--functions-source", required=True)
    parser.add_argument("--image-digests-file", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        configure(args.deployment_dir, args.env_file, args.functions_source, args.image_digests_file, args.output)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"Configuration failed: {error}\n")


if __name__ == "__main__":
    main()
