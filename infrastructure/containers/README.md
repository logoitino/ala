# Web and API containers

`Dockerfile.expo` exports the existing Expo SDK 58 `web.output=server` app. Its Node host
uses locked `expo-server@58.0.5` via `expo-router`, matching the installed SDK adapter
`createRequestHandler({ build: <dist/server> })`. Static files come from `dist/client`; API
requests use the exported server. `Dockerfile.admin` builds Next's monorepo standalone tree,
including shared types and static assets. Both run as the unprivileged Node user.

The exact versioned Expo documentation could not be fetched in this session (internet
blocked); the installed SDK 58 CLI production host and adapter were inspected directly.
Docker build/runtime, TLS and hosted routing still require verification on a Docker machine.
Both Dockerfiles **require** the reviewed official Node 24 image digest through `NODE_IMAGE`.
Caddy **requires** its reviewed image digest through `CADDY_IMAGE` in `public.env`; neither
image has a mutable default. Resolve and approve both registry digests before any build. Keep the generated provider/dependency/image
inventory with the release evidence.

## Prepare

1. Create private `/etc/tapuai` and copy `public.env.example` there as `public.env`. Replace
   domain/public-key/release/image values. These public variables are compiled into client
   bundles; changing the Supabase host/key or MFA switch requires rebuilding both images.
2. Create mode-0600 `fan-runtime.env` from the runtime inventory. Keep server-only service-role
   and Stripe **test** secrets there. Create mode-0600 `admin-runtime.env` containing the
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and MFA value matching the build;
   this read-only portal requires no service-role or Stripe secret.
3. Stage/configure the private Supabase stack using [../supabase/README.md](../supabase/README.md).
   The shared Docker bridge is `tapuai-backend`. It must have outbound internet because SMTP,
   OAuth and Stripe need it; Docker containers have **no host-published service ports**.
4. Point the three DNS names at the host; expose only TCP 80/443 in its firewall. Caddy routes
   only `/auth/v1/*`, `/rest/v1/*`, `/realtime/v1/*`, `/storage/v1/*`, `/functions/v1/*` to Kong.
   Kong's root and Studio are never routed publicly. The admin app retains its own sign-in/MFA.

Run from the repository root:

```sh
docker compose --env-file /etc/tapuai/public.env -f infrastructure/containers/compose.yml build
docker compose --env-file /etc/tapuai/public.env -f infrastructure/containers/compose.yml up -d
```

`docker compose config` can print runtime credentials; redirect it only to a protected
operator review file. Containers have health checks, automatic restart and temporary writable
space. Application `/healthz` proves the web process responds, **not** database recovery.
Verify sign-in, read-only oversight, protected admin rejection, Realtime, uploaded and private
media, callback routes and test checkout separately. Keep real writes stopped until the
verified target has passed the migration/recovery plan.

Native iOS/Android builds, signing credentials, EAS channels and OTA are not moved by Docker.
The old app builds still contain the old public Supabase URL/key/API origin; release a tested
compatible update/build or preserve those origins during cutover. Rebuilds must retain
native runtime/version policy and store approvals.

## Repeatable local host checks

```sh
node infrastructure/containers/expo-server.test.mjs
```

Seven synthetic tests cover process health, exported asset MIME/HEAD, encoded traversal,
escaping symlinks, API POST fallback and malformed URLs. The HTTP listener and Expo adapter
are mocked; actual exported SDK routes and Docker/TLS require their own runtime smoke test.
The reviewed `pnpm.npmrc` carries only the two existing workspace layout settings required
by Metro; registry authentication from a developer's npm config never enters the images.

## Owned stable API gateway before a migration window

`Caddyfile.backend-switch` and `compose.gateway.yml` let an **already installed compatible
client** call our owned `API_DOMAIN` while an operator selects exactly one Supabase backend.
Managed mode accepts only a 20-character lowercase project reference under `.supabase.co`,
with that exact upstream Host and verified TLS/SNI. Owned mode targets only private
`kong:8000` on `tapuai-backend`. Caddy forwards WebSocket upgrades and authorization headers;
no request retry/fallback or dual writes occur. Invalid mode/reference returns 503. Studio,
SQL and the root gateway remain unavailable publicly. Expo API routes stay on `FAN_DOMAIN`,
which is the separate `EXPO_PUBLIC_API_ORIGIN` compiled into the client.

Create external mode-0600 `/etc/tapuai/gateway.env` containing `BACKEND_MODE=managed` and
`MANAGED_PROJECT_REF=<reviewed-20-character-project-ref>`. Configure
`GATEWAY_ENV_FILE=/etc/tapuai/gateway.env` in external `public.env`. Keep the three owned domain
names and public client keys identical to the installed release. Compose the overlay:

```sh
docker compose --env-file /etc/tapuai/public.env \
  -f infrastructure/containers/compose.yml -f infrastructure/containers/compose.gateway.yml config
docker compose --env-file /etc/tapuai/public.env \
  -f infrastructure/containers/compose.yml -f infrastructure/containers/compose.gateway.yml up -d
```

Review `config` privately because runtime env values can appear. Before an approved switch,
validate the Caddy configuration on the pinned Caddy image, prepare the owned stack, verify
service/auth/media/Realtime behavior and stop source writes under the migration runbook.
The operator changes the external mode to `owned` and recreates/reloads the reviewed proxy;
this repository installs no automatic switch. Recreating the proxy can interrupt current
WebSocket connections; clients must reconnect and pass the functional smoke checks.

The existing app uses compiled Supabase URL/key values. This gateway **cannot** redirect
already installed binaries pointing at a project-owned `.supabase.co` hostname. A preparatory
release must put our stable owned API domain into installed clients first. Their compiled
anonymous/publishable key must also be accepted by the target gateway/Auth stack. Restored
user UUIDs, password hashes, identities, MFA and compatible token/issuer settings require
review; otherwise sessions must sign in again or a prepared compatible update is needed.
DNS ownership and a gateway config alone do not establish a two-to-three-hour switch time.

The new gateway configuration has source coverage only in this session: no Caddy binary,
Docker launch, managed proxy, TLS certificate or authenticated WebSocket flow was executed.
Portable runtime images are prepared separately with `infrastructure/exit/runtime_images.py`;
its archives contain images, while private environment files and staged Edge Function bind
mounts remain separate reviewed deployment inputs.

## Carry reviewed images to an offline recovery host

Prepare this on a Docker host where all reviewed images are already present. The external
mode-0600 image map is a JSON object from every upstream service ID to its exact
`repository@sha256:...` reference, plus `proxy`, `fan-web` and `admin-portal`. Proxy and
Supabase services require registry digests; the two locally built app images may instead use
their exact `sha256:...` content IDs. Use the lock and inventory produced by Supabase
bootstrap/configure, the release manifest's SHA-256 identity, and its reviewed target ID.

```sh
python3 infrastructure/exit/runtime_images.py prepare \
  --images-file /etc/tapuai/runtime-images.json \
  --upstream-lock /srv/tapuai/supabase/upstream.lock.json \
  --deployment-inventory /srv/tapuai/supabase/deployment.inventory.json \
  --release-version "$RELEASE_VERSION" --target-id "$TARGET_ID" --platform linux/amd64 \
  --output-dir /var/lib/tapuai/runtime-artifacts/reviewed-release
python3 infrastructure/exit/runtime_images.py check \
  --receipt /var/lib/tapuai/runtime-artifacts/reviewed-release/runtime-images.receipt.json \
  --release-version "$RELEASE_VERSION" --target-id "$TARGET_ID" --platform linux/amd64
python3 infrastructure/exit/runtime_images.py load \
  --receipt /var/lib/tapuai/runtime-artifacts/reviewed-release/runtime-images.receipt.json \
  --release-version "$RELEASE_VERSION" --target-id "$TARGET_ID" --platform linux/amd64 \
  --release-tag "$RELEASE_TAG"
```

`load` prints a plan. After reviewing it on the recovery host, `--execute --overrides-dir
/var/lib/tapuai/runtime-artifacts/reviewed-load` imports the checked archives, verifies every
loaded content ID/platform and retags the app IDs under the reviewed release tag. It writes
separate mode-0600 `app-images.override.json` and `supabase-images.override.json` files plus a
load receipt. Apply the app override only to the app compose project; apply the Supabase
override only to the private rendered Supabase project. Keep `--no-build --pull never` on
later operator startup commands. Both overrides use exact inspected content IDs and
`pull_policy: never`; original registry digest provenance remains in the image receipt.
Docker save/load may discard registry digest lookup, so the load receipt reports whether
these overrides are required on this host. Files are Docker image-save archives, not an OCI
layout. Checking/importing them proves no application startup, token compatibility, storage
parity or successful restore. The tool never pulls, publishes or starts services.
