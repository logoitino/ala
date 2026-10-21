<!-- Dated scoped source findings and local regression evidence; this is neither a live infrastructure audit nor operational acceptance. -->
# Infrastructure security findings — 2026-10-20

**Task:** REDUNDANCY-07. **Reviewer:** the independent `recovery_review` task in this Codex session, reporting findings to SECURITY/CTO. Repository agent model declarations are unchanged; no execution by another model or external audit service is claimed.

This review covered the local recovery and deployment source identified below. It inspected configuration boundaries and ran synthetic regressions. It did not read private environment contents, contact a provider, execute Terraform/Docker/SQL, capture real customer data, deploy services, commit or push. It does not establish that the whole infrastructure is audited or secure.

Current source/ownership binding belongs in the generated [Infrastructure Security Report](INFRASTRUCTURE_SECURITY_REPORT.md). That report's structural `current` status describes registered coverage and source links. Its `securityStatus: not-established`, `operationalAcceptance: false` and `readyToCutOver: false` remain authoritative limits. See [security workflow](INFRASTRUCTURE_SECURITY.md) and [exit readiness](EXIT_READY_RUNBOOK.md).

## 1. Validated findings and disposition

Severity below describes the conditional impact if the affected path is used. No deployed exposure or credential leak was observed.

| ID | Severity / confidence | Validated source issue | Current disposition / owner |
| --- | --- | --- | --- |
| INFRA-SEC-01 | Medium / high | SSH wildcard checks rejected only the literal `0.0.0.0/0`. Host-bit spellings such as `10.0.0.1/0` still denote every IPv4 address. Azure's bare-address fallback also accepted IPv6 despite the IPv4 contract. | **Fixed locally.** Canonical nonzero IPv4 netmask checks replace string comparison; Azure bare addresses use IPv4 netmask validation. INFRA_SECURITY / INFRASTRUCTURE. Actual Terraform/provider behavior remains unverified. |
| INFRA-SEC-02 | High / high | Supabase configuration validated private file values, then invoked Compose with inherited process variables. Compose gives shell variables precedence over `--env-file`; weak JWT/password or another public URL could become the rendered settings. Resolved sensitive fields were not checked against the reviewed file. | **Fixed locally.** Literal bounded private parsing, reviewed values taking explicit subprocess precedence, and exact required core/present sensitive-alias validation now block mismatched rendering before function staging or output. INFRA_SECURITY / SESSION_SECURITY / EXIT_CLOUD. Actual pinned-upstream Compose interoperability remains unverified. |
| INFRA-SEC-03 | Medium / high | Docker source allowlists admitted nested npm/netrc/yarn authentication configuration into `COPY apps` / `COPY packages` build layers/cache. Copying a safe root pnpm configuration did not exclude those nested files. | **Fixed locally.** Final Docker context exclusions cover `.npmrc`, `.netrc`, `_netrc`, `.yarnrc` and `.yarnrc.yml` after source allowlists. SUPPLY_CHAIN_SECURITY / INFRASTRUCTURE. Source-policy regressions passed; no actual Docker build-context execution or leak was observed. |
| INFRA-SEC-04 | Medium / high | CI action references use movable major tags; host provisioning selects current Ubuntu images, and reviewed provider lock material is not supplied in this source. These inputs do not define an immutable approved build/deployment chain. | **Open source trust/reproducibility gap.** SUPPLY_CHAIN_SECURITY / RELEASE / INFRASTRUCTURE must record reviewed action commit SHAs, provider checksums/lock and exact host image identities before relying on that chain. No compromised action, image or package was observed. |

### INFRA-SEC-01 — network range checks

Original control points were `admin_ipv4_cidrs` in both [AWS variables](../../infrastructure/terraform/aws/variables.tf) and [Azure variables](../../infrastructure/terraform/azure/variables.tf), plus Azure `backup_ipv4_ranges`. The optional VM remains disabled by default and operator SSH lists remain empty by default.

The new guard uses `can(cidrnetmask(cidr))` and a nonzero normalized mask inside `try(..., false)`. Azure bare-IP acceptance appends `/32` through `cidrnetmask`, rather than an IPv6-capable `cidrhost` fallback. The [network regression](../../infrastructure/security/tests/network.test.mjs) verifies source predicates and independently checks canonical network cases using Python `ipaddress`, including host-bit `/0` spellings, valid IPv4 ranges/addresses, invalid prefixes and IPv6.

**Next evidence:** run actual Terraform formatting, validation and adversarial variable evaluation using the reviewed provider lock, then inspect the approved plan and resulting ingress. The reference cases are not a substitute for Terraform execution. Multiple broad ranges can also cover excessive access; named operator ranges still need human review.

### INFRA-SEC-02 — settings checked versus settings rendered

The original failure was reproduced with synthetic deployment fixtures: a rendered weak database password and JWT were accepted while the source file contained strong values; the Compose subprocess had no explicit environment. No Docker or network request was performed.

[configure.py](../../infrastructure/supabase/configure.py) now requires a bounded owned private regular environment file, rejects duplicate fields, expansion and ambiguous syntax, and supplies its literal values explicitly to Compose. Required standard database/Auth/REST/Kong/Functions fields and every present known security alias must match those exact reviewed values. Mismatched, missing or malformed values fail before new function staging or rendered output. Existing pinned-source/image checks, removal of host ports, function allowlist and test-only Stripe requirement remain.

[Deployment regressions](../../infrastructure/supabase/tests/test_deployment.py) exercise inherited weak settings, tampered rendered values, missing/null/list-valued fields and private-input ambiguity. Root separately reviewed this implementation. The supported standard field map is deliberately strict: a different upstream schema or JWT/JWKS configuration requires a reviewed adapter change, rather than silently accepting omitted fields.

**Next evidence:** resolve an approved exact upstream deployment with actual Docker Compose; compare the effective private configuration, test Auth and negative authorization, and preserve safe acceptance records. No real secret quality, service startup or token-signing compatibility was established by these fixtures.

### INFRA-SEC-03 — registry credential files in image inputs

[.dockerignore](../../.dockerignore) now excludes the known registry-auth basenames after its app/package/container allowlists. Both Dockerfiles continue to copy only the explicit [pnpm settings](../../infrastructure/containers/pnpm.npmrc) at the workspace root. The [Docker context regressions](../../infrastructure/security/tests/build-context.test.mjs) check exclusion ordering and the explicit safe configuration copy.

**Next evidence:** inspect the actual Docker context/build layers and cache-export policy on the approved builder. These exclusions do not authorize storing credentials under another arbitrary source filename.

### INFRA-SEC-04 — immutable supply-chain inputs

The observed [exit CI workflow](../../.github/workflows/exit-release.yml) uses `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` and `actions/upload-artifact@v4`. Its read-only token permissions and disabled persisted checkout credentials reduce credential exposure, but do not make those action revisions immutable. The AWS AMI query uses `most_recent`; Azure selects image version `latest`; cloud-init installs the repository's current distribution packages.

The [Terraform guide](../../infrastructure/terraform/README.md) already requires a reviewed generated provider lock and frozen production image identities. The [upstream lock](../../infrastructure/supabase/upstream.lock.json) explicitly remains unverified, with no invented commit/digests. Bootstrap/configuration and the runtime-image kit require independently supplied exact archive/image evidence. The application pnpm lock is present; a lock is integrity input, not proof that dependencies or package install scripts are trustworthy.

**Next evidence:** review and pin actual action commits, provider lock/checksums, host image/version and package/image provenance; inspect build privileges and install scripts; stage verified offline materials. Do not fill this gap with fabricated SHAs or treat a placeholder lock as approval.

## 2. Observed source protections

| Boundary | Protection present in inspected source | Evidence still required |
| --- | --- | --- |
| Cloud/network | Private versioned backup stores; AWS public access block, TLS/SSE-KMS requirements, IMDSv2 and encrypted persistent disk; Azure OAuth/RBAC, storage firewall, explicit other-inbound denial and password-disabled SSH; only proxy HTTP/HTTPS ports published. | Actual IAM/network/TLS plan, deployed exposure and host access/patching. |
| Backup custody | Age envelope/hash/private-output checks, nonsecret capture identity from the exact used environment, same-path identity invalidation, protected original capture proof for retries and all configured destinations required for success. | Separate identities/key custody, real offsite retrieval/decryption and fresh complete data. |
| Restore/data | Original reviewed TOC selection, explicit distinct target assertions, bound continuation receipts, transaction boundaries, exact schema/function/security/Auth comparisons and owner-only Storage reconciliation before guards. | True endpoint isolation, live SQL/RLS/negative-identity tests, real historical owner/private-byte checks and measured rollback. |
| Source/watch | Safe source inventory/capsule hashes, external private state, kernel lock, journaled promotion/retention and exact watcher process identity; stale/unverified source cannot inherit passing verification. | Original settled-source receipt, runtime-image acceptance and actual scheduler/alert delivery. A process watcher is not permanent login startup. |
| Setup/health | New private external template output, no overwrite/adoption, incomplete flags; read-only combined health links current app origins, backup identity and prepared source/target/version evidence; cutover remains false. | Complete private inputs and independent prepared/final cutover evidence. Template integrity is not backup readiness. |
| Portable client/profile | Shared public connection validation rejects known secret/session keys and dotenv interpolation; static public env reads, cookies/storage/getUser/MFA preserved; profile output is private, matching and uninstalled. | Backend recognizes the keys, real signing/authorization/session behavior and deployed compatible services. |
| Security reporting | Versioned source/metadata hashes, explicit service/component reviewers, safe evidence paths, missing/stale/symlink failures and source-linked guard status with `executed: false`. All 13 operational reviews remain `not-verified`. | Actual independent review and command receipts; delivered alerts and trusted operational events. |

Provider versioning/lifecycle and Terraform `prevent_destroy` are not WORM retention against a privileged account administrator. Current recovery records are private unsigned operator evidence, not cryptographically authenticated third-party acceptance. DNS/host aliases and shared pooler identity require independently confirmed isolation; current prepared database fingerprints record host/port/database, whereas the backup binding also records the database user.

## 3. Actual local commands and results

| Command / observation | Result in this review | Limit |
| --- | --- | --- |
| `node --test infrastructure/security/tests/network.test.mjs` before the fix | Two source assertions failed; canonical-network reference passed. | Confirms the original missing normalized mask controls. |
| `node --test infrastructure/security/tests/*.test.mjs` after fixes | **17 tests passed.** | Synthetic/source coverage, privacy, routing, no-overwrite, currentness and boundary regressions; no Terraform/Docker/provider execution. |
| `python3 -m unittest discover -s infrastructure/supabase/tests -v` | **17 tests passed.** | Compose/network are mocked; tests use temporary synthetic settings/source. |
| Read-only `inspectSecurity()` invocation | `current`; 10 services, 24 components, 9 guards; no structural issues. All guards unexecuted, all 13 operations unverified. | `securityStatus: not-established`; provider/operational/cutover acceptance remain false. |

The full project gate and final source-cache receipt belong to the root task's execution record. This reviewer did not run a concurrent full `pnpm check` or infer its result.

## 4. Exact reviewed source scope

This is targeted source inspection of the listed boundaries, including retained findings from earlier reviewed recovery increments in this session. It is not exhaustive review of every application line or every possible deployment configuration.

- **Terraform:** `infrastructure/terraform/aws/{compute,main,variables,versions}.tf`; `infrastructure/terraform/azure/{compute,main,variables}.tf`; `infrastructure/terraform/cloud-init.yml`; `infrastructure/terraform/README.md`.
- **Container inputs/gateway:** `.dockerignore`; `infrastructure/containers/{Dockerfile.admin,Dockerfile.expo,Caddyfile,Caddyfile.backend-switch,compose.yml,compose.gateway.yml,pnpm.npmrc}`; `.github/workflows/exit-release.yml`.
- **Supabase deployment:** `infrastructure/supabase/{bootstrap.py,configure.py,upstream.lock.json}`; `infrastructure/supabase/tests/test_deployment.py`.
- **Backup boundaries:** `infrastructure/backup/{backup.py,common.py,job.py,status.py,fetch.py,publish.py,restore.py,source_capture.mjs,verify.py}`; `scripts/recovery-capsule.mjs` and its safe-source policy.
- **Migration/data controls:** `infrastructure/migration/{parity.py,toc_review.py,storage_reconcile.py,catalog.sql}`; original TOC/Auth/sequence and Storage logical-parity regression boundaries.
- **Exit source/runtime:** `infrastructure/exit/{release.mjs,sync.mjs,sync_lock.py,watcher.mjs,setup.mjs,health.py,health_source.mjs,readiness.py,runtime_images.py}`; `scripts/{exit-map.mjs,exit-inventory.mjs,exit-map-output.mjs}`.
- **Portable connection:** `packages/shared-types/backendConnection.ts`; `infrastructure/portability/{profile.mjs,protocol.mjs}` and their connection/profile/protocol/consumer tests; the five current Expo/Next client boundaries adopted in REDUNDANCY-06.
- **New Security governance:** `infrastructure/security/{report.mjs,routing.mjs,controls.json}` and current Security test files; source refresh/notice routing integration in `sync.mjs` and `exit-map.mjs`.

## 5. Next reviewers and release evidence

1. **SUPPLY_CHAIN_SECURITY:** close INFRA-SEC-04 with reviewed immutable inputs and builder/offline-image evidence.
2. **INFRA_SECURITY:** validate the CIDR/configuration fixes with real tools, then review actual ingress, IAM/TLS, host access and patching.
3. **RECOVERY_SECURITY:** confirm independent custody and reader/writer identities, retrieve/decrypt an actual protected-checksum copy and verify isolated restore/rollback.
4. **RLS_SECURITY / SESSION_SECURITY:** independently accept live SQL grants/RLS/RPC, Auth/MFA/callback/session migration and Storage negative access cases on the compatible isolated target.
5. **THREAT_DETECTION:** review trusted event provenance, tamper handling and actual alert delivery. A generated report or synthetic detector result does not establish a running response service.

SECURITY reports the original evidence and remaining limits to CTO and REDUNDANCY_LEAD. Auth/data/privacy/finance acceptance and owner deployment decisions remain separate gates; refreshing source reports cannot automatically accept them.
