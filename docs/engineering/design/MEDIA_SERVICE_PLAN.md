<!-- Media contracts and actual local evidence; proposed limits are distinct from configured services. -->
# Media service: uploads, playback and a future host move

Owner direction: 2026-10-20 America/Denver. Short Highlights are open to every otherwise eligible
user. Longer uploaded videos remain off until costs are measured; live streaming is deferred to a later
roadmap phase. Existing age, rights, consent and moderation rules still apply.

## 1. Current app and the local transport change

The app already has video uploads, JPEG photo stories and an Expo video player. This work extends
those flows; no streaming vendor, new SDK or new credentials are introduced.

| Responsibility | Source | Contract |
| --- | --- | --- |
| Storage transport | `apps/mobile/src/frontend/lib/mediaStorage.ts` | `MediaStorageAdapter`: public URL, upload, sign, list and remove. Default binds the existing Supabase client/session. Pure construction; no global mutable provider switch. |
| Upload orchestration | `apps/mobile/src/frontend/services/MediaUploadService.ts` | `createMediaUploadService(adapter)` preserves named exports, existing owner/rights/row writes and byte validation. Public video fallback remains `reels` then `game_highlights`; private upload uses only `reel_vault`, without requesting a public URL. |
| Stored media resolution | `apps/mobile/src/frontend/lib/media.ts`, `lib/reels.ts` | Legacy public URLs and `sb:` references follow the bound host. Public helpers allow `reels`, `game_highlights`, `avatars` only. `reelvault:` and `sb:reel_vault/` sign with current authorization for one hour. Malformed/unsafe/unsupported references fail closed. |
| Failed photo cleanup | `apps/mobile/src/frontend/lib/photoStoryCleanup.ts` | Optional third adapter binds list/remove only. Existing live owner checks, server claim, exact path validation, durable retry intent and confirmed finish stay authoritative. |
| Video rendering | `apps/mobile/src/frontend/components/Reels/ReelVideoLayer.tsx`, `reelPlayback.ts` | Existing Expo player, one active decoded Highlight, focus/mute/loading/error/retry behavior. No new player or autoplay expansion. |
| Private feature media | `lib/beyondGame.ts`, `lib/fanZone.ts` and their existing server handlers | Keep their separate audience/expiry/revocable proxy contracts. They are not routed through a generic public reader. |

Storage adapters return `{data, error}` with only an error message at the boundary. A URL builder
is not authorization. The target must enforce the same actor and feature access on its server.
The default Supabase adapter remains configured in one module. A future replacement binds its
adapter at the composition boundary and must preserve the contract below before rollout.

## 2. What limits actually exist

| Media | Source limits today | Remaining capacity gaps |
| --- | --- | --- |
| Short Highlight | Client 45 seconds and 8 MiB after compression; owner/age/rights rules | Canonical public buckets lack matching server byte/duration/daily limits. Client validation alone is bypassable. |
| Photo story | 1–10 JPEGs, sanitization, exact reserved paths, publish once and owner cleanup | No canonical daily story quota or public bucket byte cap. Hidden row retirement/physical object deletion must be verified on the target. |
| Beyond | Separate private 50 MiB bucket, 5 submissions per rolling 24 hours | Separate permissions and hosted verification; not the long-Highlight entitlement. |
| Fan Zone | Separate private 20 MiB bucket, server-verified 1–30 second MP4 and campaign limits | Separate authenticated byte proxy/removal; not general-purpose long-video storage. |

No follower/post threshold is enabled. No long-video bypass of the current Highlight limits is
enabled. `MEDIA_WRITE_REFERENCES` stays **false**; avatar/logo writes keep full URLs, video writers
remain unchanged, and reference backfill is not performed by this change.

## 3. Longer videos — deferred until costs are measured

The owner chose **keep long videos off until costs are measured** (2026-10-21 UTC).
The suggested 3-minute, 50-MiB, 2-per-day pilot was not selected for implementation. Those numbers
are only an alternative for a future design; they are not affordable-capacity findings or enabled
limits. Short Highlights stay available; follower count does not grant admission or waive quota.

Before revisiting the pilot, Growth/Capacity and Finance need dated provider allowances/quotes,
actual stored/uploaded/downloaded bytes, processing and playback usage plus moderation time,
a bounded traffic forecast and an owner-approved budget. Compare equivalent quality and private
access/export/delete requirements. No new tracking, billing collector or purchase is added here.

The pilot needs its own admin-first implementation before participant access:

1. Admin grants/revokes access, sets finite global admission/queued-byte limits and pauses new
   uploads. Revocation/pause is checked on the server, including after asynchronous work.
2. A server reserves a private object and quota atomically before upload. Retries reuse an operation
   identifier; concurrent devices cannot double-spend daily/global allowance. Unfinished reservations
   expire with a tracked cleanup job and bounded retries.
3. The server verifies actual file size, supported codec/container and duration. Client filenames,
   MIME declarations and duration cannot establish approval. Processing output is immutable and
   tied to its original owner, rights version and operation.
4. Staff review before publish. Only verified-ready, currently permitted items can be played;
   late/duplicate provider events cannot restore a revoked or removed item. Existing child/subject
   rights and deletion decisions remain authoritative across originals, thumbnails and renditions.
5. The existing player consumes approved playback URLs. Adaptive delivery/transcoding requires a
   provider or a separately operated worker; the transport seam alone does not supply them.
6. Admin/Health surface pending/failed/denied/cleanup states, actual queued/stored bytes and useful
   capacity evidence without logging signed URLs, tokens or raw private file paths. New durable
   records require Data/Privacy review and ownership entries before implementation.

Before choosing a host, compare Mux, Bunny and Cloudflare on the same codec/quality/traffic,
authorized playback, export/delete and complete cost assumptions. No provider is selected here.
Live ingest/broadcast, viewer concurrency and livestream moderation are a separate later design.

## 4. Migration contract and failure cases

| Failure or risk | Required control and acceptance check |
| --- | --- |
| Stored full URLs point to the old host | Deploy compatible readers first, test old and `sb:` values, then separately approve writer switch/backfill and rollback. Keep unsupported host tokens unplayable. |
| A private upload requires a public URL | Private upload must complete without any public URL call. This defect was reproduced and repaired locally in this change. |
| Changed authorization or object ownership | Restore bucket/path/owner metadata, SQL functions/grants and Auth identity together; test owner, unrelated account, blocked user, expired subscriber and removed item. Cloud object storage alone does not recreate RLS. |
| Partial photo upload and stale retry | Preserve claimed cleanup, exact prefix/JPEG validation, removal before confirmed finish and owner-bound durable intent. Inject list/remove/finish failures; verify bytes are physically gone. |
| Signed URL survives revocation | Preserve current expiry behavior; test entitlement on issuance and after expiry. Existing one-hour Vault URLs and older public Vault bytes remain limitations until the separate access/removal work closes them. |
| Duplicate processing events publish removed video | Future processing operations require idempotency, revision checks and terminal removal tombstones; not implemented by this transport change. |
| Native decoder or web CORS mismatch | Test actual uploaded media on web/iOS/Android, range requests, MIME, codec, expiry/retry and target CORS. Synthetic URL tests do not decode media. |
| Cutover loses uploads or rollback points at missing bytes | Reconcile originals/renditions/catalog/ownership and in-flight operations; dual-host fixture reads, isolated restore and timed rollback must pass before any switch. |

Self-hosted Supabase uses the same API with changed compatible configuration. A different storage
API needs a `MediaStorageAdapter` implementation plus equivalent server authorization, SQL/catalog
cleanup behavior and private delivery. No S3/Azure adapter or hosted target is claimed to exist.
This local code does not prove a 2–3 hour migration; the timed drill remains a separate requirement
in [PORTABILITY](../PORTABILITY.md) and [CLOUD_MIGRATION_RUNBOOK](../CLOUD_MIGRATION_RUNBOOK.md).

## 5. Verification and handoff

Root owns media reference/playback integration and shared documentation/maps. Actual Codex worker
`/root/connect_client_flow` owns the transport/upload/cleanup slice. Independent Security/Data/QA
review is assigned to `/root/connect_kyc_review`; Documentation/Data review is assigned separately.
Repository role names do not imply a different model or unattended monitoring ran.

Final executed local evidence (2026-10-21 UTC, actual Codex executors):

- Root combined focused media: **6 suites / 102 tests PASS**, `/tmp/media-final-focused.log`.
  Root full mobile: **225 suites / 2,154 tests PASS** (129.383s), `/tmp/media-mobile-final.log`.
  Both app TypeScript checks PASS. Fourteen scoped app/source guards PASS; this is not a full
  `pnpm check`, hosted release certification or a target migration drill.
- Independent Security/Data/QA executor `/root/connect_kyc_review` accepted at **02:45:56 UTC**;
  independently ran the same six suites / 102 tests in two bounded runs. No remaining findings
  in that source scope. Accepted fixes remove private upload's public URL dependency, preserve
  legacy video query/fragments and retain encoded literal-percent filenames.
- Data lineage now recognizes adapter operations and the guarded canonical public bucket set.
  Four synthetic regression tests run automatically inside `data:map:check`; regenerated map has
  **0 rule failures**. No no-reader/no-writer exemption was added to hide moved operations.
- Meaningful failure receipts: ignored injection and unsupported/unsafe references; private
  upload dependency **2 failed / 22 passed**; review suffix/percent regression **2 failed / 39 passed**.
  Logs retained under `/tmp/media-storage-*.log` and `/tmp/media-reference-*.log`.
- Relevant migration/register maps are regenerated as source awareness. Compatible target Auth,
  SQL, Storage owner/catalog policies and physical byte restore are not executed by regeneration.
- Independent read-only Documentation/Data and priority reconciliation completed at **02:50:27 UTC**
  by actual Codex executor `/root/photo_cleanup_review`. Reviewed this media plan, current app/backlog
  policy, source hashes and generated maps. Four lineage tests, data-map, 289 local documentation
  destinations, copy and scoped whitespace checks PASS. The reviewer read root Jest logs and did
  not rerun Jest. Short Highlights remain open; longer videos remain off until measured costs;
  live streaming stays deferred. No hosted, device, physical-byte or cloud restore test was run.

These checks do not prove real upload, decoder playback, hosted policies, physical removal or
cloud restore parity. Current real Google/Stripe bank walkthrough and new cleanup/Connect SQL
execution remain unverified as recorded in [payee plan §10](PAYEE_VERIFICATION_PLAN.md#10-google-account-to-stripe-test-bank-preparation--2026-10-21-in-progress).

Accepted source SHA256 bindings (frontend paths relative to `apps/mobile/src/frontend/`):

| File | SHA256 |
| --- | --- |
| `lib/mediaStorage.ts` | `5e55616918423c5e05994a85db5ef3f905af707dd11301db69d18e66d00918ba` |
| `services/MediaUploadService.ts` | `792ea26c16d921798325c524b7ea94ece2311d25ca569dbe7651a540aaa388ec` |
| `lib/photoStoryCleanup.ts` | `4e5d96cc6bb6f9f8dcd7020f2d54dbaef0c8ba59d1999f195840d8266d752abd` |
| `lib/media.ts` | `e187e7d37869ff21a9257b66f82651cd4d004d01151d676061b4cb50dd348d41` |
| `lib/reels.ts` | `aa1e6e666e50625a4617758d915abefb703b750cefa3813681c20e2a089afebb` |
| `lib/__tests__/mediaStorage.test.ts` | `ad819177bd562e2a9c68f0590a92ca75af3609327f4f45e0b88fff4a930bddf0` |
| `services/__tests__/MediaUploadService.test.ts` | `680e4ac267fbbd5f0ae70ebd080e2ce327cfede7fa2e5a640b12778130981ed2` |
| `lib/__tests__/photoStoryCleanup.test.ts` | `b4c44d28b66620514347451d1f7ec0e6eb25937b07a9a2e79b04c353fa793350` |
| `lib/__tests__/media.test.ts` | `8e4137b2ff091c899346ea01f04293f21d75ab6c50e9118b92722d0ba307ed15` |
| `lib/__tests__/reelsMediaReferences.test.ts` | `55be26e36c198fbe931c56f2d43f2bd3bc0a5eb1808be454c86b462c25e0f87e` |

Manual test matrix for the existing development environment:

- Upload a short public video; verify playback in Home, athlete profile and Spotlight.
- Upload 1 and 10 JPEGs; verify caption/credit/story paging and sanitized output.
- Fail/close a story midway; retry as the same owner and verify cleanup; switch accounts and
  verify another account cannot remove that intent's files.
- Upload a private Vault clip; unrelated/expired accounts cannot issue playback; permitted users
  obtain a signed URL with no public fallback.
- Exercise old full public URLs and `sb:` references using a synthetic bound adapter, including
  malformed values and absent private permissions.
- Re-run those cases on the isolated target with restored Auth/SQL/catalog/objects and compare
  actual access/removal before approving any writer or cloud change.

Hosted configuration, remaining SQL application and device tests remain separate prerequisites.

## 6. Current-app testing preparation — 2026-10-21 UTC

The existing Highlight flow now normalizes duration once at each picker boundary: Expo 58 web
returns seconds; native ImagePicker returns milliseconds. It retains that value through the
library/camera draft and `uploadSekiPlay` submission. Missing, nonfinite, zero or negative duration
is rejected before optimization; the upload service independently rejects invalid or over-45-second
metadata before progress, compression, authentication, file reads or Storage writes. Exactly
45 seconds is permitted. This is client metadata validation, not server verification of media.
Compression may reduce oversized files below the byte cap; picker trimming can produce an
eligible short clip from a longer original. Neither changes the long-video policy.

Root owns the picker/modal/DTO integration and its tests. Actual Codex worker
`/root/connect_client_flow` repaired service units/validation; `/root/auth_profile_freshness`
created the offline fixtures. Independent `/root/connect_kyc_review` Security/Data/QA accepted
the current source at **03:06:27 UTC**, running exact seven Jest suites / **153 tests PASS** and
two Node fixture boundary/padding tests. Root combined focused run passed **10 suites / 177 tests**
(14.977s), `/tmp/media-testing-focused.log`. Final root full mobile **226 suites / 2,193 tests PASS**
(138.861s), `/tmp/app-testing-mobile-final.log`. Meaningful failing tests preceded implementation:
picker/payload **16 failed / 21 passed**, `/tmp/media-picker-red.log`; service duration **13 failed /
32 passed**, `/tmp/media-duration-red.log`. Both app typechecks and 13 scoped app/source checks pass.
These runs do not execute a hosted upload, server replay, restored host or native app.

`pnpm app:test:media --out NEW_DIRECTORY_OUTSIDE_REPO` creates labelled synthetic assets offline
on macOS with Xcode Command Line Tools. Existing output and repository/symlink destinations are
refused. `pnpm app:test:assets` runs the two safety/format regressions and is included in the
existing full-check command for future CI runs. The actual complete output
is `/Users/seiuliian/Downloads/ala-sports-test-media-20261020-002`, created at **03:00:16.329Z** in
**14.957s**: ten 1080×1350 JPEGs, an 8s H.264 MP4 (96 decoded frames,118,185 bytes), a 46s MP4
(552 frames,683,984 bytes), and a valid free-box-padded 8s MP4 (96 frames,8,388,609 bytes).
The generator verified native types, decoding, durations, codecs and frame counts before its
complete manifest. Both independent reviewers recomputed all 13 file lengths/hashes; they did
not independently decode the videos. The first output `-001` records an explicit failed compiler
run and is not the test set. No real people, account data or provider calls are used by generation.
Manifest SHA-256: `e8986fb909e9748b1b4acae1680768c4df16b739b03271fd85733b6ca2b70a70`.

Current source accepted by the independent Security reviewer:

| Source | SHA-256 |
| --- | --- |
| `data/media.ts` | `d06ac2fb3232668d50b83967b5feca2193abb855fe7461ebf1b91b9172e0d165` |
| `services/MediaUploadService.ts` | `018c8c4177d369cda2e513d3fe4a4e425ff9a8756e7c0802c8e76d4a4892a6db` |
| `services/__tests__/MediaUploadService.test.ts` | `8a0588ef5d43f905cd703b2871b0a766ca5c61214ad6cd9bf67e31e2a03fbbb5` |
| `components/Reels/HighlightPickerModal.tsx` | `4c6c002ab7853d3c18d44cb87d421b199aa70ffcab250eaca8e3f33a7e701aeb` |
| `components/Reels/__tests__/HighlightPickerModal.test.tsx` | `b8d0bc2b2ae1e5087b87fbc8c99e75fd0c2f9b6edea17e067fa49727a60a95c8` |
| `components/Reels/UploadVideoModal.tsx` | `86bfc5373447e5fbb96d3634216da8efa1cf81c44180c286dc1c1c47cb84b59e` |
| `components/Reels/__tests__/UploadVideoModal.test.tsx` | `2c3e27aa58385801385cf7748e4212321666b46fb8eab9a7a221e3a21665b288` |
| `lib/reels.ts` | `91a00ff90fe94608161f97ddb53f263fdbf7c15e7955d3d47d509b921617e9a2` |
| `scripts/media-test-assets.mjs` | `b48f4882a79540f0e6fbb3abddb1e10accbf494ea2720f715dfdd0805e117412` |
| `scripts/__tests__/media-test-assets.test.mjs` | `6269cda1929abe1479ccc417326a75a93011ce24b3d4cdd4c100b3e4357d719b` |

App source paths above are relative to `apps/mobile/src/frontend`; script paths are repository
relative. [Tester script](../TESTER_SCRIPT.md) covers the manual matrix and
[onboarding](../../ONBOARDING.md#prepare-google-sign-in-for-development--2026-10-21) contains the
requested Google setup instructions. A read-only development Auth settings request returned
HTTP200 around03:00UTC with Google disabled, Email enabled and signup not disabled; Google
credentials were not provided and redirect allowlists were not verified in this work. The separate
local Stripe test bank server still lacks its service-role key. Longer videos remain off and
live streaming stays deferred.

Final independent Documentation/Data and priority review by actual Codex
`/root/photo_cleanup_review` accepted at **03:09:54 UTC**: all ten source hashes match,
all13fixture sizes/hashes match, and the provider/manual gates stay explicit. It inspected the
original full-suite log and the existing-check asset-test wiring; it did not run native encoding,
Jest, browser or provider tests itself. Accepted plan before this receipt:
`cd14d2d7eb95c899e3662b199f40af3189b9ffcf0a4fe7eaf5515243ae04145f`;
onboarding `28aea2ba5315837cb443ede3fa160b485c577feeaea8072789a395542b0cece0`;
tester `aeeff9d78d0bba3de337a3992d64ddb1baefe7bc2f7ec25801f70e511a2d984a`.
Local documentation links, copy and scoped whitespace checks pass; no full `pnpm check`,
CI run or hosted/device acceptance is inferred from these scoped commands.
