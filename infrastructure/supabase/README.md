# Reviewed upstream Supabase on our server

Supabase includes PostgreSQL, GoTrue/Auth, PostgREST, Realtime, Storage, Kong and Edge Runtime.
We integrate its **actual upstream compose**, rather than maintain guessed image versions.
The source lookup was blocked offline here. `upstream.lock.json` deliberately has no usable
commit/image default; launching requires independently reviewed exact source pins on an
internet-enabled operator machine. That review is an open dependency, not completed evidence.

1. Review official [Docker self-hosting](https://supabase.com/docs/guides/self-hosting/docker),
   [upstream Docker tree](https://github.com/supabase/supabase/tree/master/docker) and
   [Edge Functions self-hosting](https://supabase.com/docs/guides/self-hosting/functions).
   Select a full 40-character commit, review that compose/image inventory and independently
   obtain SHA-256 for `https://codeload.github.com/supabase/supabase/tar.gz/<commit>`.
2. Stage outside the repository:

```sh
python3 infrastructure/supabase/bootstrap.py \
  --destination /opt/tapuai/supabase \
  --upstream-commit "$REVIEWED_SUPABASE_COMMIT" \
  --archive-sha256 "$REVIEWED_SUPABASE_ARCHIVE_SHA256"
```

The bootstrap verifies the archive before extracting ordinary files under its Docker tree,
refuses unsafe archive paths/links and mutable or unresolved image references, and writes
an actual verified source/image lock to `/opt/tapuai/supabase/upstream.lock.json`. It starts
nothing. Resolve each source image reference to an independently reviewed registry digest. Create
an external JSON map at `/etc/tapuai/supabase-image-digests.json` with one service name per
key and its original repository plus `@sha256:<64hex>` value. The renderer requires exactly
one reviewed immutable digest per service; source tags alone cannot launch this kit.

3. Use upstream `.env.example` as a **private editing guide**, not working credentials. Store
   reviewed values in mode-0600 `/etc/tapuai/supabase.env`; generate fresh passwords/JWT keys,
   anon/service-role tokens, SMTP settings, OAuth provider secrets/redirects, external HTTPS
   origins, pooler and observability/encryption keys. Set production email confirmations and
   auth/MFA policies deliberately; this script does not guess hosted settings. Current
   payment adapters require a Stripe **test** secret; live-money release remains separate.
4. With Docker Compose installed, resolve privately and stage only the approved adapters:

```sh
python3 infrastructure/supabase/configure.py \
  --deployment-dir /opt/tapuai/supabase \
  --env-file /etc/tapuai/supabase.env \
  --functions-source "$PWD/supabase/functions" \
  --image-digests-file /etc/tapuai/supabase-image-digests.json \
  --output /etc/tapuai/supabase.compose.json
docker network create tapuai-backend
docker compose -p tapuai-supabase -f /etc/tapuai/supabase.compose.json up -d
```

`configure.py` checks all staged upstream source hashes, pins **every image** from the
reviewed digest map, refuses host networking, removes **every upstream host port**, retains bind-volume paths and the
upstream main Edge dispatcher, stages `create-payment-intent`, `create-stripe-account` and
`_shared`, and sets JWT verification on. `stripe-webhook` stays excluded until its approved
money release; automatic webhook crediting is not enabled. The rendered JSON contains
resolved service secrets and is mode 0600; never copy it into Git or a source capsule.
Future per-function JWT exceptions require a separately reviewed upstream dispatcher change.

All services remain accessible only inside Docker. Caddy exposes API prefixes over TLS via
Kong's `kong:8000` alias. For private SQL recovery, use a named operator tunnel/helper on this
network; no public Postgres/Studio port is supplied. Startup initializes upstream platform
schemas on an empty disk; it does **not** apply this app's historical SQL or restore data.
Follow the explicit backup/restore plan against an isolated target, reconcile platform-owned
schemas/roles/extensions and migration history, then rehearse before cutover. Persist and
back up upstream database/Storage volumes. Logical periodic dumps do not provide WAL/PITR.

Before launch: run Compose config validation privately, pin every image digest, pull/build,
verify health, auth/SMTP/OAuth/MFA and Realtime, restore approved data and every Storage file,
check object hashes/counts and private entitlements, test adapters and Stripe callbacks. No
actual upstream fetch, Docker launch, database restore or live cutover was run in this session.

## Repeatable local boundary checks

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s infrastructure/supabase/tests -p 'test_*.py'
```

The 14 synthetic tests cover approved pins/checksums, archive traversal, resolved private
paths/symlinks, source tampering, env permissions, image digest coverage, removed host ports,
function allowlists and the live-Stripe refusal. Docker/network are mocked; passing them
provides local boundary evidence, not verification of a real upstream release.
