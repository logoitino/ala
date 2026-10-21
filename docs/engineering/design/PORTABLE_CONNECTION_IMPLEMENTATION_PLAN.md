<!-- Local-only portable connection configuration and compatibility execution plan; original service/data parity remains separately verified. -->
# Portable connection implementation plan — REDUNDANCY-06

**Goal:** keep the same app ready to connect to another compatible backend through one validated configuration contract, with generated matching target environments and locally executable SDK protocol checks.
**Architecture:** dependency-free shared connection resolver consumed by Expo and Next clients; profile tooling emits a fresh private external target setup; an actual Supabase SDK test runs only against synthetic loopback HTTP fixtures. Existing exact-source release/watch/CI mechanisms carry this code and its tests with every change.
**Tech stack:** Node24/Python3 already installed, TypeScript6, existing installed Supabase JS/SSR packages, current pnpm9.15 repository lock. No dependency install, provider calls or new cloud resources.
**Spec:** owner2026-10-20 requests continued work that does not rely on outside systems and an app ready to plug into other systems; same app/self-hosted compatibility direction already authorized in REDUNDANCY-01–05.

## Constraints and agreed interfaces

- Preserve current public Expo/Next env field names and direct static process.env accesses so builds inline correctly.
- No second app implementation; current Auth storage/cookies/MFA/live getUser and service privilege policies stay intact.
- `packages/shared-types/backendConnection.ts` exports `resolveBackendConnection(input:{url?:string;publicKey?:string})` returning `{status:'configured',connection:{url:string,publicKey:string},reason:null}` or `{status:'missing'|'invalid',connection:null,reason:string}`. Fixed reason codes never expose input values.
- HTTPS origin or HTTP literal loopback allowed; no URL credentials, query/fragment/path routing, ambiguous/control values. Public keys may be opaque publishable API keys or anon JWTs; known secret/service/session JWT keys must fail before SDK construction.
- Root adds `@tapuai/shared-types/backendConnection` package export and new file to shared typecheck inputs. No process/env/vendor imports in shared resolver.
- Profile schema: `{schemaVersion:1,backendUrl:ORIGIN,apiOrigin:ORIGIN,publicKey:PUBLIC_API_KEY}`. JSON input is private external600, duplicate/unknown fields rejected; direct credentials/keys in CLI argv unsupported.
- `pnpm portability:profile --config-file PRIVATE --output-dir NEW_PRIVATE` emits `mobile.env`, `admin.env`, `server.env`, `profile.json`, `manifest.json`, README.md. Matching EXPO_PUBLIC/NEXT_PUBLIC/SUPABASE_URL and anon key fields; API origin compiled into mobile; server file never invents privileged keys. Blank service-key placeholders are explicitly required external inputs.
- Profile output is outside checkout, no symlink ancestry or overwrite,700 directories/600 files, native exclusive atomic publication. Hash integrity is independent of live service compatibility. No source private env copies.
- `pnpm portability:test` uses existing dependency installation and loopback-only synthetic APIs; no public network. Output never claims live compatibility or cutover readiness.

## Tasks and ownership

### 1. Shared portable connection resolver

Owner `/root/cloud_deployment`: shared resolver and Node tests in `infrastructure/portability/tests/connection.test.mjs` only. Meaningful cases: two arbitrary compatible origins; missing/invalid inputs; HTTPS/loopback policy; unsafe secret/session public keys; fixed redacted failures; malformed JWT and control/routing inputs. Test with native Node TS stripping, no new dependency. Root owns package manifests.

### 2. Adopt the resolver at current app client boundaries

Owner `/root/recovery_review`: `apps/mobile/src/frontend/lib/supabase.ts`, `apps/admin-portal/lib/supabase.ts`, `supabase.server.ts`, `middleware.ts`, auth callback route and focused consumer tests. Public env reads remain direct compile-safe accesses; configured clients use normalized resolver values. Missing/invalid configuration follows existing unconfigured UI/guard paths. Preserve cookies, refresh, session checks, MFA and caller RLS. No app rendering changes or live calls. Review actual source options and test final behavior with local fakes/full typecheck.

### 3. Target profile and real-SDK local protocol test

Owner `/root`: `infrastructure/portability/profile.mjs`, `protocol.mjs`, scoped profile/protocol tests, package aliases/test gate, capsule JSON policy if needed, Data/Infrastructure/sensor registries and generated maps. Profile uses shared resolver via native TS stripping. Loopback fixture exercises REST query/RPC, Auth sign-in/getUser/refresh/sign-out, Storage upload/download/signed path/remove and functions invoke using actual installed SDK. All fixtures synthetic, no SQL/RLS/password/OAuth/MFA/WebSocket parity claims. Unexercised features remain explicit.

### 4. Documentation and execution evidence

Owner `/root/redundancy_documentation`: new `docs/engineering/PORTABLE_INTEGRATIONS.md`, existing PORTABILITY and EXIT_READY_RUNBOOK relevant sections. Root integrates REDUNDANCY-06 tracker/index/STATE/CHANGELOG, app/source notice acknowledgement and final private receipts. Document load order, compile-time client config/rebuild requirement, expected backend service contracts, offline install/runtime-image requirements and remaining live compatibility evidence.

## Verification and completion

1. Scoped resolver/profile/protocol tests and app typechecks/consumer tests must pass without provider access.
2. Independent review must verify public-key boundaries, actual SDK requests remain loopback-only and profiles cannot overwrite/copy secrets or imply readiness.
3. Regenerate Data/Infrastructure maps, refresh/acknowledge actual source changes, then execute full `pnpm check` through explicit verified source sync.
4. Restart existing source watcher; verify exact current source and original source scan clock. Store actual final test/health/external profile results outside source to avoid mutating a verified tree.
5. Existing backup setup stays separate and incomplete; no live data, provider activation, traffic switch, commit or push in this turn.
