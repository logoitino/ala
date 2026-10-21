<!-- Portable integration implementation and actual local test handoff; external interoperability must be independently verified. -->
# REDUNDANCY-06 — locally ready portable integrations

**Request/date:** owner2026-10-20: keep building code/app readiness to plug into other systems without reliance on outside systems.
**Executor:** Codex `/root` with EXIT_CLOUD, RECOVERY and DOCUMENTATION sessions; repository role model pins unchanged.
**Status:** implemented locally; actual final external receipts govern full-check/source/runtime claims.
**Plan:** [PORTABLE_CONNECTION_IMPLEMENTATION_PLAN](../engineering/design/PORTABLE_CONNECTION_IMPLEMENTATION_PLAN.md).

Existing source export/watcher/CI and private backup setup are established. This step adds shared public connection validation, matching target profiles and actual installed-SDK protocol checks over synthetic loopback only. Current source also includes concurrent Reels work; preserve those edits and refresh/announce final app version before verification.

Actual owned tasks and interfaces are recorded in the plan. Final commands/reviews, privacy boundaries, unexercised runtime/data contracts and original verification custody are recorded here after the concrete work is reviewable. No live provider, SQL, hosted service or customer-data operation is performed by this local preparation.

## Actual execution and independent review

- EXIT_CLOUD implemented the pure shared resolver and11tests; actual native package subpath and shared typecheck pass. Browser/native decoding uses no Node/Buffer/global env dependencies.
- RECOVERY adopted all five current Expo/Next client boundaries and added5consumer tests. Preserved native/browser/SSR persistence, cookie reads/refresh, live getUser, redirects and MFA cookie forwarding. Missing/invalid mobile config has a device-loopback placeholder. Both app typechecks pass.
- Root profile5tests and protocol3tests pass; integrated portability24tests PASS. Actual Next dotenv and existing Python dotenv data loader preserve matching URL/key values; service key stays blank.
- Two independent reviewers reproduced build-time key/origin interpolation into public values; shared resolver now rejects unsafe dotenv syntax, secret/session keys, ambiguous/numeric authority spelling, malformed tokens and routing. Fixed errors never reflect inputs. Profile ownership/atomic no-overwrite/privacy and exact loopback/manual redirect guard reviews accepted.
- Actual installed SDK10scoped gates/11requests PASS over synthetic loopback; real Auth user-token flow and Storage byte roundtrip shape are tested. No SQL/RLS/password/OAuth/MFA/socket/Edge/Stripe/hosted parity is inferred.
- DOCUMENTATION executed the new guide and two scoped runbook updates, accepted actual interfaces/receipts and passed278-document link checks.

Actual sample profile:
`/Users/seiuliian/Downloads/ala-sports-portable-profile-20261020`
Original manifest `2c37bc5d37a0608468d8d3fc86f852f1b30ef14c7a5a59a2b45ee7618c3aa24c`.
Synthetic127.0.0.1 origins and public fixture key; configurationInstalled/providerContacted/readyToCutOver allfalse. These are reviewable local example settings, not a deployed backend.

Next production build PASS26s; Expo web/server export PASS10s, both with explicit synthetic
public connection values and CLI telemetry disabled; Expo source dotenv loading disabled.
Local macOS HTTP smoke PASS: standalone admin login/CSS200; Expo health/Home200 and unsigned
payment request401. Expo smoke adapter binds local loopback and resolves installed dependencies
from the mobile workspace; production request handler/output are actual. No browser/device, Linux
image or hosted service/data acceptance is inferred. Expo output:
`/Users/seiuliian/Downloads/ala-sports-portable-build-20261020` (private outer custody).
Next standalone output remains generated `.next` state; native dependencies require target-platform
build/images before a Linux deployment. Source exports remain platform-independent code, not an
offline dependency installation promise.

## Final integrated source verification custody

Full command `pnpm exit:sync sync --verify-code` runs complete `pnpm check`, now including
`pnpm portability:test`, under the owned source lock and scoped macOS idle-sleep inhibition.
Existing watcher is paused for this promotion and restarted immediately afterward.
Final receipt custody:
`/Users/seiuliian/Downloads/ala-sports-exit-verification-20261019/redundancy-06-final-verification.json`
plus `redundancy-06-full-check.log`, build logs and `redundancy-06-http-smoke.json`.
Only executed current original receipts support full-check/source/runtime claims; missing/failed
receipts do not accept readiness. Final receipts remain outside source so recording the result
does not mutate a just-verified application tree.

## Ready-to-connect workflow and remaining scope

Current exact-source release/watch/CI carries resolver/profile/protocol/test/docs changes and
locked dependencies after every source update. Full project gate reruns protocol/consumer/profile
regressions. Operator supplies one reviewed public target profile, merges its matching settings
into build/runtime config, rebuilds/installs supported clients, and uses existing containers/source
release to load the app onto a compatible host. No second app implementation is maintained.

A target must implement the current database/Auth/REST/RPC/Storage/Realtime/Functions and service
security contracts. Other native database/service APIs need explicitly implemented adapters;
profile generation does not translate them. Backup setup stays separate/incomplete. Real data,
key custody, installed-client/session transition, target-platform images, independently accepted
service/finance/rollback evidence and a measured2–3hour migration remain future operational work.
No outside providers, cloud resources, live SQL/data, commit or push performed in this local turn.
