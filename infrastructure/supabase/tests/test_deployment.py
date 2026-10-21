"""Synthetic deployment boundary regressions: source integrity, private paths/ports and Edge allowlist.

Network requests and Docker resolution are mocked. No credentials, SQL or cloud services are used.
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "infrastructure/supabase" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bootstrap = load("bootstrap")
configure = load("configure")


def archive(files):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as bundle:
        for name, data in files.items():
            member = tarfile.TarInfo("supabase-synthetic/docker/" + name)
            member.size = len(data)
            bundle.addfile(member, io.BytesIO(data))
    return output.getvalue()


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.work = tempfile.TemporaryDirectory(prefix="tapuai-deployment-tests-")
        self.base = Path(self.work.name)
        self.addCleanup(self.work.cleanup)
        self.valid = archive({"docker-compose.yml": b"services:\n  db:\n    image: supabase/postgres:synthetic\n", ".env.example": b"# synthetic template only\n", "volumes/functions/main/index.ts": b"// synthetic dispatcher\n"})

    def stage(self):
        with patch.object(bootstrap.urllib.request, "urlopen", return_value=io.BytesIO(self.valid)), contextlib.redirect_stdout(io.StringIO()):
            bootstrap.bootstrap(self.base / "upstream", "a" * 40, hashlib.sha256(self.valid).hexdigest())

    def configured_fixture(self):
        self.stage()
        source = self.base / "functions"
        source.mkdir()
        for name in [*configure.ALLOWLIST, "_shared", "stripe-webhook"]:
            (source / name).mkdir()
            (source / name / "index.ts").write_text("// synthetic runtime\n")
            (source / name / ".env.local").write_text("synthetic fixture; must never be staged")
        private = self.base / "supabase.env"
        values = {"POSTGRES_PASSWORD": "p" * 24, "JWT_SECRET": "j" * 32, "ANON_KEY": "a" * 80, "SERVICE_ROLE_KEY": "s" * 80, "DASHBOARD_PASSWORD": "d" * 24, "API_EXTERNAL_URL": "https://api.test.invalid", "SUPABASE_PUBLIC_URL": "https://api.test.invalid", "SITE_URL": "https://fan.test.invalid", "STRIPE_SECRET_KEY": "sk_test_syntheticfixture"}
        private.write_text("\n".join(f"{key}={value}" for key, value in values.items()))
        private.chmod(0o600)
        services = {name: {"image": "supabase/" + name + ":synthetic", "ports": [{"published": "9999", "target": 9999}], "networks": {"default": None}} for name in configure.REQUIRED_SERVICES}
        services["db"]["environment"] = {"POSTGRES_PASSWORD": values["POSTGRES_PASSWORD"]}
        services["auth"]["environment"] = {"GOTRUE_JWT_SECRET": values["JWT_SECRET"], "API_EXTERNAL_URL": values["API_EXTERNAL_URL"], "GOTRUE_SITE_URL": values["SITE_URL"]}
        services["rest"]["environment"] = {"PGRST_JWT_SECRET": values["JWT_SECRET"]}
        services["kong"]["environment"] = {"SUPABASE_ANON_KEY": values["ANON_KEY"], "SUPABASE_SERVICE_KEY": values["SERVICE_ROLE_KEY"], "DASHBOARD_PASSWORD": values["DASHBOARD_PASSWORD"]}
        services["functions"]["environment"] = {"JWT_SECRET": values["JWT_SECRET"], "SUPABASE_ANON_KEY": values["ANON_KEY"], "SUPABASE_SERVICE_ROLE_KEY": values["SERVICE_ROLE_KEY"]}
        services["functions"]["volumes"] = [{"type": "bind", "target": "/home/deno/functions", "source": str(self.base / "upstream/volumes/functions")}]
        digests = self.base / "digests.json"
        digests.write_text(json.dumps({name: "supabase/" + name + "@sha256:" + "c" * 64 for name in services}))
        return private, source, digests, services

    def render(self, private, source, digests, services, output=None):
        result = type("Result", (), {"returncode": 0, "stdout": json.dumps({"services": services, "networks": {"default": {}}})})()
        with patch.object(configure.subprocess, "run", return_value=result), contextlib.redirect_stdout(io.StringIO()):
            configure.configure(self.base / "upstream", private, source, digests, output or self.base / "rendered.json")

    def test_rejects_non_full_source_revision(self):
        with self.assertRaises(ValueError):
            bootstrap.bootstrap(self.base / "invalid", "latest", "f" * 64)

    def test_rejects_checksum_mismatch_before_destination(self):
        with patch.object(bootstrap.urllib.request, "urlopen", return_value=io.BytesIO(self.valid)), self.assertRaises(ValueError):
            bootstrap.bootstrap(self.base / "invalid", "a" * 40, "b" * 64)
        self.assertFalse((self.base / "invalid").exists())

    def test_generates_exact_archive_source_inventory(self):
        self.stage()
        lock = json.loads((self.base / "upstream/upstream.lock.json").read_text())
        self.assertEqual(lock["commit"], "a" * 40)
        self.assertEqual(lock["archive_sha256"], hashlib.sha256(self.valid).hexdigest())
        self.assertIn("docker-compose.yml", lock["source_files"])

    def test_rejects_archive_path_traversal(self):
        payload = archive({"../../escape": b"unsafe"})
        with patch.object(bootstrap.urllib.request, "urlopen", return_value=io.BytesIO(payload)), self.assertRaises(ValueError):
            bootstrap.bootstrap(self.base / "invalid", "a" * 40, hashlib.sha256(payload).hexdigest())

    def test_rejects_symlink_parent_pointing_into_checkout(self):
        link = self.base / "checkout-link"
        link.symlink_to(ROOT, target_is_directory=True)
        with self.assertRaises(ValueError):
            bootstrap.bootstrap(link / "must-never-create", "a" * 40, "b" * 64)
        private, source, digests, services = self.configured_fixture()
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services, link / "must-never-create.json")

    def test_rejects_dotdot_path_into_checkout(self):
        with self.assertRaises(ValueError):
            bootstrap.bootstrap(ROOT / "infrastructure/../must-never-create", "a" * 40, "b" * 64)
        private, source, digests, services = self.configured_fixture()
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services, ROOT / "infrastructure/../must-never-create.json")

    def test_rejects_final_output_symlink(self):
        private, source, digests, services = self.configured_fixture()
        link = self.base / "output-link"
        link.symlink_to(self.base / "uncreated-private-output")
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services, link)
        with self.assertRaises(ValueError):
            bootstrap.bootstrap(link, "a" * 40, "b" * 64)

    def test_strips_every_host_port_and_freezes_all_images(self):
        self.render(*self.configured_fixture())
        config = json.loads((self.base / "rendered.json").read_text())
        self.assertTrue(all("ports" not in service for service in config["services"].values()))
        self.assertTrue(all("@sha256:" in service["image"] for service in config["services"].values()))
        self.assertEqual(config["networks"]["default"]["name"], "tapuai-backend")
        self.assertEqual((self.base / "rendered.json").stat().st_mode & 0o777, 0o600)

    def test_stages_only_allowlist_and_never_dotenv(self):
        self.render(*self.configured_fixture())
        target = self.base / "upstream/tapuai-functions"
        self.assertEqual(sorted(path.name for path in target.iterdir()), sorted(["main", *configure.ALLOWLIST, "_shared"]))
        self.assertFalse(list(target.rglob(".env*")))

    def test_rejects_source_tampering_before_docker(self):
        private, source, digests, services = self.configured_fixture()
        (self.base / "upstream/docker-compose.yml").write_text("# tampered")
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services)

    def test_rejects_world_readable_credentials(self):
        private, source, digests, services = self.configured_fixture()
        private.chmod(0o644)
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services)

    def test_rejects_host_network_and_incomplete_image_map(self):
        private, source, digests, services = self.configured_fixture()
        services["db"]["network_mode"] = "host"
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services)
        del services["db"]["network_mode"]
        digests.write_text("{}")
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services)

    def test_rejects_symlink_function_root(self):
        private, source, digests, services = self.configured_fixture()
        name = configure.ALLOWLIST[0]
        original = source / name
        original.rename(source / "original-function")
        original.symlink_to(source / "original-function", target_is_directory=True)
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services)

    def test_rejects_live_stripe_before_staging(self):
        private, source, digests, services = self.configured_fixture()
        private.write_text(private.read_text().replace("sk_test_", "sk_live_"))
        with self.assertRaises(ValueError):
            self.render(private, source, digests, services)
        self.assertFalse((self.base / "upstream/tapuai-functions").exists())

    def test_reviewed_file_values_override_inherited_weak_compose_settings(self):
        private, source, digests, services = self.configured_fixture()
        observed = {}
        def resolve(command, **options):
            environment = options.get("env", dict(os.environ))
            observed.update(environment)
            services["db"]["environment"]["POSTGRES_PASSWORD"] = environment["POSTGRES_PASSWORD"]
            services["auth"]["environment"]["GOTRUE_JWT_SECRET"] = environment["JWT_SECRET"]
            services["auth"]["environment"]["API_EXTERNAL_URL"] = environment["API_EXTERNAL_URL"]
            return type("Result", (), {"returncode": 0, "stdout": json.dumps({"services": services})})()
        with patch.dict(os.environ, {"POSTGRES_PASSWORD": "weak", "JWT_SECRET": "short", "API_EXTERNAL_URL": "http://unreviewed.invalid"}), patch.object(configure.subprocess, "run", side_effect=resolve), contextlib.redirect_stdout(io.StringIO()):
            configure.configure(self.base / "upstream", private, source, digests, self.base / "rendered.json")
        self.assertEqual(observed["POSTGRES_PASSWORD"], "p" * 24)
        self.assertEqual(observed["JWT_SECRET"], "j" * 32)
        self.assertEqual(observed["API_EXTERNAL_URL"], "https://api.test.invalid")

    def test_changed_missing_or_malformed_rendered_sensitive_fields_block_before_staging(self):
        for name, key, value in [("db", "POSTGRES_PASSWORD", "weak"), ("auth", "GOTRUE_JWT_SECRET", "short"), ("auth", "API_EXTERNAL_URL", "http://unreviewed.invalid"), ("kong", "SUPABASE_SERVICE_KEY", "unreviewed"), ("functions", "SUPABASE_ANON_KEY", None), ("rest", "PGRST_JWT_SECRET", ["unreviewed"]), ("auth", "GOTRUE_SITE_URL", "__missing__")]:
            with self.subTest(service=name, field=key):
                private, source, digests, services = self.configured_fixture()
                if value == "__missing__":
                    del services[name]["environment"][key]
                else:
                    services[name]["environment"][key] = value
                with self.assertRaisesRegex(ValueError, "Rendered connection/security configuration"):
                    self.render(private, source, digests, services)
                self.assertFalse((self.base / "upstream/tapuai-functions").exists())
                self.assertFalse((self.base / "rendered.json").exists())
                # Give the next subtest a fresh bootstrap/fixture without deleting unrelated paths.
                import shutil
                shutil.rmtree(self.base / "upstream")
                shutil.rmtree(source)

    def test_ambiguous_duplicate_and_interpolated_private_inputs_never_run_compose(self):
        private, source, digests, services = self.configured_fixture()
        original = private.read_text()
        for suffix in ["\nJWT_SECRET=" + "j" * 32, "\nUNREVIEWED=${PRIVATE_MARKER}", "\nUNREVIEWED=`PRIVATE_MARKER`", "\nUNREVIEWED=ambiguous\\value", '\nUNREVIEWED="unmatched']:
            with self.subTest(input=suffix.split("=", 1)[0]):
                private.write_text(original + suffix)
                with patch.object(configure.subprocess, "run") as command, self.assertRaises(ValueError) as error:
                    configure.configure(self.base / "upstream", private, source, digests, self.base / "rendered.json")
                self.assertNotIn("PRIVATE_MARKER", str(error.exception))
                command.assert_not_called()


if __name__ == "__main__":
    unittest.main()
