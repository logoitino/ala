<!-- REDUNDANCY-06: one app, validated target configuration and bounded local protocol proof; hosted compatibility remains a separate gate. -->
# Connect the same app to a compatible backend

**Scope:** [REDUNDANCY-06](../agents/REDUNDANCY-06.md) local portability work. The shared connection resolver, target profile generator
and local SDK protocol checks prepare our current app for another compatible backend. Actual execution
receipts belong in the task record; no live service, database restore or traffic change follows from this guide.

Start with [PORTABILITY](PORTABILITY.md) for the architecture decision and
[EXIT_READY_RUNBOOK](exit/EXIT_READY_RUNBOOK.md) for the complete recovery and cutover procedure.

## 1. One app and one connection contract

[backendConnection.ts](../../packages/shared-types/backendConnection.ts) defines the dependency-free
`resolveBackendConnection({url, publicKey})` contract. Configured results contain a normalized origin and
public key. Missing/invalid results contain a fixed reason code and no connection; failures do not expose
input values. Expo and Next client boundaries use this shared contract while retaining their existing
authentication, cookies, session checks and caller permissions.

The resolver accepts a valid HTTPS origin, or HTTP on literal loopback for local work. Credentials in URLs,
path routing, query/fragment and ambiguous/control values are invalid. Known privileged keys and session
tokens are rejected at the public-client boundary. A locally accepted public key is not proof that a server
recognizes it or applies correct permissions.

Public env reads remain direct static references to `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
The shared resolver validates the supplied values; it does not discover or load private environment files.
Server-side privileged credentials remain separate external inputs.

## 2. What another backend must provide

| App dependency | Required compatible behavior |
| --- | --- |
| Database API | PostgREST-style REST query/filter/response and RPC contracts, including expected error shapes. |
| Auth | Compatible SDK Auth endpoints, token/session behavior, cookies/refresh and user identity. Actual signing keys, provider settings, MFA and redirects require independent review. |
| Database security | The same application SQL, roles, grants, RLS, Auth helpers, triggers, extensions and service schema compatibility. |
| Files | Storage bucket/object API, byte integrity, access policies and historical owner metadata; preserving files alone does not prove private access. |
| Realtime | Compatible channel/broadcast/WebSocket behavior, authorization and publications. |
| Functions | The allowlisted function routes and adapter contracts, with independently configured server secrets. |
| Outside services | Stripe, SMTP/OAuth, Expo updates and any chosen media provider still need their own configuration, custody and acceptance. |

Running the reviewed Supabase compatibility stack on AWS/Azure is exit A. An AWS/Azure PostgreSQL
database by itself cannot satisfy these client protocols. Another provider needs the same interfaces or
an independently built and tested replacement adapter; the resolver does not translate protocols or SQL.
Keep the existing app and shared domain logic as the source of truth.

## 3. Generate matching private target profiles

The [profile generator](../../infrastructure/portability/profile.mjs) prepares matching settings without
reading the source app's private environment or installing the target configuration.

Prepare a mode-600 JSON file in an owned private directory outside the checkout. Input schema:

```json
{
  "schemaVersion": 1,
  "backendUrl": "https://backend.your-owned-domain.com",
  "apiOrigin": "https://api.your-owned-domain.com",
  "publicKey": "REPLACE_WITH_REVIEWED_PUBLIC_API_KEY"
}
```

Replace every example value with the reviewed target settings before generating. The backend origin serves
the compatible backend APIs; the API origin serves our app's API routes. They need not be the same origin.
Only the public API key belongs in this input; passwords, service-role keys, signing identities and private
provider credentials do not. Do not pass key values directly as command arguments.

```sh
pnpm portability:profile --config-file /private/operator/target-profile.json \
  --output-dir /private/operator/new-target-profile
```

The input must be private external JSON; duplicate/unknown fields and invalid connection values fail.
The output directory must be new, absolute and outside the checkout, with no symlink ancestry. Existing
targets are not replaced. The generator produces a mode-700 directory with mode-600 files:

| File | Purpose |
| --- | --- |
| `mobile.env` | Matching Expo public backend URL/key and app API origin. |
| `admin.env` | Matching Next public backend URL/key. |
| `server.env` | Matching server backend URL/public key fields; privileged credentials remain explicit external inputs. |
| `profile.json` | Normalized public target profile. |
| `manifest.json` | Generated file hashes, private modes and manifest hash; integrity is independent of service compatibility. |
| `README.md` | Installation instructions and missing external prerequisites. |

The profile generator prepares settings; it does not install them into either app, copy private source
environment files, generate privileged keys, run SQL, start services or contact a provider. Review its
instructions and reconcile all target declarations before supplying values through the existing framework's
build environment and the separately protected server runtime environment. Load generated files as dotenv
data. Keep actual credentials outside Git.

## 4. Run the local protocol check

```sh
pnpm portability:test
```

The [local runner](../../infrastructure/portability/protocol.mjs) uses the installed Supabase SDK against
synthetic loopback HTTP fixtures. Its checks exercise actual SDK request/response behavior for REST queries,
RPC, Auth sign-in/getUser/refresh/
sign-out, Storage upload/download/signed paths/remove and function invocation. No public endpoint is used.
Read the actual result and unexercised-feature list; a fixture success is bounded local protocol evidence.

Fixtures do not run the Supabase service stack or real PostgreSQL/RLS. They do not prove OAuth, MFA,
password/session migration, Realtime WebSockets, provider parity, historical media permissions or finance
reconciliation. Those require isolated compatible target tests and original independent acceptance evidence.
No dependency download or cloud purchase is required for this local experiment when locked dependencies
are already installed.

## 5. Rebuild and install the client before switching

Expo and Next inline public URL/key values into builds. Creating a profile or editing a server env file does
not redirect an existing installed native app. Rebuild the affected app artifacts and install the preparatory
stable-origin version on supported clients before starting the migration clock. Test callbacks, persisted
sessions, old versions, offline queues, public media URLs and private access. Keep privileged keys off clients.

Profile settings do not establish a running gateway, DNS/TLS ownership or a deployed target. The optional
stable gateway and runtime kit have their own deployment and acceptance procedure. No automatic writer split
or traffic switch is introduced by this resolver.

## 6. Keep source and offline runtime materials current

The existing `exit:release` and automatic source cache carry the resolver, client integrations, profile/protocol
tools, tests and documentation with each accepted source update. There is one app implementation.
An ordinary raw watcher capture retains actual code-verification status; it cannot inherit an earlier passing
check. Follow [EXIT_READY_RUNBOOK](exit/EXIT_READY_RUNBOOK.md) for verified releases and health observations.

Source includes the lockfile and build inputs, not installed dependencies or container images. For an offline
installation, pre-stage the matching pnpm dependency cache/build tools and reviewed app/service image archives
for the target architecture. Prove an offline build/load/start before relying on it. Runtime env/custody and
current encrypted database/Storage backups remain independent materials. Downloading dependencies, building
images or provisioning a cold target is not part of a proven two-to-three-hour warm switch.

## 7. Evidence before a real move

### Observed local execution — 2026-10-20

`pnpm portability:test` passed **24 checks**: 11 resolver, five client-consumer, five profile and three
protocol tests. The actual installed SDK exercised ten gates through 11 synthetic loopback HTTP requests.
Both app typechecks passed; independent scoped source review accepted the profile/protocol and client boundaries.

The private sample profile was created at
`/Users/seiuliian/Downloads/ala-sports-portable-profile-20261020`, with manifest SHA256
`2c37bc5d37a0608468d8d3fc86f852f1b30ef14c7a5a59a2b45ee7618c3aa24c`. It uses synthetic loopback origins
and a fixture public key; the service-role key remains blank. Its result retained
`configurationInstalled: false`, `providerContacted: false` and `readyToCutOver: false`.

The Next production build passed in 26 seconds and the Expo web/server export in ten seconds on this macOS
machine, using explicit synthetic public values and disabled CLI telemetry; Expo did not load source dotenv.
Artifacts are outside the checkout at `/Users/seiuliian/Downloads/ala-sports-portable-build-20261020`, with
private `redundancy-06-admin-build.log` / `redundancy-06-expo-build.log` execution records. These are local
build receipts using prepared dependencies, not Linux image, offline-install or real service/data parity proof.
They precede the final whole-repository check; consult the task's final receipt for that separate result.

### Required operational evidence

- Record the exact source version, target profile hash and actual local resolver/profile/SDK test results.
- Verify compatible service versions/schema/roles and restore current data, Auth and Storage through the
  existing isolated workflow, including owner reconciliation, exact security parity and private access.
- Test real Auth/callback/MFA/session, Realtime, function and payment behavior using approved test accounts
  and test-mode providers; reconcile finance and maintain one writer.
- Verify independently held secrets/keys, offsite backup retrieval, offline runtime material and installed
  stable-origin clients. Refresh evidence when any bound source/configuration/data changes.
- Complete the measured warm-target rehearsal and strict final cutover gate. Neither a generated profile
  nor synthetic SDK checks grant readiness or guarantee the 180-minute target.
