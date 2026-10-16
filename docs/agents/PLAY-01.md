# PLAY-01 — browser playback errors

Last updated: 2026-10-13. Status: **investigation and implementation in progress**.

The owner supplied launch and browsing error screenshots: Lightning CSS native-module
loading, aborted media fetches and an unsuitable source at `ReelCard.tsx`'s play call.
This is an ordinary repair under the existing feature-admin workflow.
Functional routing: CTO → ENGINEERING → HIGHLIGHTS → PLAYBACK; independent QA and
dependency compatibility review, with DOCUMENTATION integrating evidence.
Owner-authorized Codex outside sessions do not replace the registry's model pins.

## Claims

| Session | Paths / responsibility | Status |
| --- | --- | --- |
| Codex root | Package patch integration, package.json/pnpm-lock.yaml, task/state/troubleshooting/audit/docs and final gate | Claimed 2026-10-13 |
| Codex profile_creative_design | ReelCard video lifecycle, scoped Reels helpers/tests; editable expo-video 57.0.5 web source/build under `/tmp/ala-play01-expo-video` | Claimed 2026-10-13; actual-library rejection reproduction and targeted fix |
| Codex profile_sport_stats | Read-only native CSS probe and dependency/native playback compatibility review | CSS direct/worker transforms pass; no reinstall or quarantine removal justified |
| Codex sports_accessibility_review | Read-only browser reproduction, existing playback events and controlled local media | Owns Browser Bridge serially; external media probe blocked by automatic review |

Preserve concurrent admin/Books/schema work. Root owns shared documentation and package
configuration. Check file modification times before every shared edit; release claims
with actual evidence. No hosted SQL, object repair, role grants or publication is part
of this repair.

## Plan and acceptance

1. Verify Lightning CSS from the current Expo Metro dependency context and worker.
2. Reproduce rejected browser play promises using the actual installed Expo web player.
3. Apply a versioned, reproducible web-only dependency patch. Handle every explicit
   browser play request; preserve the public void API and playback intent. Expected
   abort/autoplay refusal is nonfatal; genuine current-source failure remains visible.
4. Await and guard source replacement/readiness, focus, lock, mute and identity changes.
   Failed or loading clips must not accumulate playback views; retry remains bounded.
5. Run regressions, full repo checks, a fresh web bundle and valid/invalid local-media
   browser tests. Preserve photo-story behavior and record native/device limits.
6. Synchronize STATE, troubleshooting, tester instructions and this tracker.

## Initial evidence

- Baseline `pnpm check`: **96 suites / 611 mobile tests**, workflow tests and guards pass.
- Actual installed chain: Expo 57.0.27 → Metro 57.0.13 → Lightning CSS 1.33.0.
  Matching ARM64 binding, direct transform and fresh worker global/module CSS transforms
  pass. Signature valid; quarantine absent. Historical loader failure is not reproduced.
- Expo video 57.0.5 web `play()` returns void while discarding DOM play promises.
  Replacement and replay/follower paths do the same; caller try/catch cannot catch them.
- Automatic approval review rejected a separate hosted Supabase media metadata probe.
  Current hosted MIME/object contents remain unverified; local-media and existing browser
  event checks can continue. Historical ENV-02 observations remain in WORK_QUEUE.
- Actual browser reproduction with a valid local VP8 WebM: three calls to the installed
  SDK's `replaceAsync` followed by immediate `pause` produced three uncaught AbortErrors.
  The same valid file reaches ready state 4 and plays; the replacement promise resolves
  without handling the DOM play rejection. The existing hosted clip emits browser media
  error 4 (unsupported source), independently of the cancelled-play problem.
- Independent review caught a queued-event race in the first patch candidate: using the
  asynchronous `playing` property to preserve intent could resume after an immediate
  `pause`. The candidate is being corrected before integration. Native replacement
  preserves pause intent; awaiting replacement alone does not prove decode readiness.

## Implementation and regression evidence

Source is frozen: current-source replacement/readiness/focus controller, genuine
playback-event view counting, bounded deliberate mute retry, and accessible failure
recovery above the existing gesture layer. The failure uses the fixed
`video.playback.failed` issue code; raw media URLs/errors are not added to telemetry.
Native stale-error checks retain source binding; a completed web replacement can
report failure even when invalid media never reaches metadata/source events.

Actual-library RED/GREEN tests cover every explicit play path, genuine/expected/stale
rejections, paused/pending intent and queued follower events. Controller/rendered
ReelCard tests cover native readiness orderings, stale completion/error/focus/disposal,
actual view time, delayed invalid web media and reachable Retry. Final focused run:
**3 suites / 38 tests**. Full `pnpm check` passed **98 suites / 646 tests**, 13 workflow
tests, both typechecks and every guard. `git diff --check` passed.

Fresh main Metro on :8081 served web (1946 modules) and server (2312 modules) bundles.
Final iOS and Android exports pass against unchanged final-source hashes: 2827/2909
modules, Hermes v98, 8,687,500/8,876,689-byte HBC. Commands, raw tool-returned output
and checksums are in `/tmp/ala-play01-native-final-validation.txt`; preliminary iOS
output was replaced by the final-source run. Android recovered automatically from
a disk-cache deserialize warning. No simulator/device playback was claimed.

Final browser interaction remains pending; source/compile completion does not certify
a hosted media repair or device behavior.

## Dependency integration (2026-10-13)

The frozen SDK source/build candidate passed independent immediate pause, pending
play and stale queued follower-event probes. `pnpm patch-commit` generated
`patches/expo-video@57.0.5.patch` and root manifest registration, then asked to rebuild
all modules because `.modules.yaml` retains the former `/Users/ian` store path. That
owned command was interrupted before confirmation; installed modules were preserved.

Offline lock resolution also lacks cached registry metadata. Root synchronized only
the patch hash and the Expo Video importer/snapshot key, using pnpm 9's actual
normalized-file MD5/base32 algorithm. No dependency version changed. Frozen metadata
validation passed with:

```bash
pnpm install --offline --ignore-scripts --frozen-lockfile --lockfile-only \
  --modules-dir /tmp/ala-play01-lock-only-modules
```

The tracked patch dry-run and application succeeded against the installed SDK. TS
matches the frozen candidate; JS matches except an unchanged source-map EOF newline
that pnpm's diff omitted. A complete clean install was not run; it still needs a
working registry or complete package store. This is a reproducible manifest/lock/patch
change, with the current installed files updated without rebuilding unrelated modules.

## Hand-off from PRIV-01 (Claude, 2026-10-14) — not a claim on ReelCard

When the PLAY-01 claim on `components/Reels/ReelCard.tsx` is released, PLAYBACK (or whoever holds ReelCard next) adds
one prop to its `<ReelActionOverlay …>`: `tagState={clip.tagStatus === 'pending' ? 'pending' : clip.playerId && clip.tagStatus !== 'rejected' ? 'approved' : undefined}`.
The overlay already renders the approved (solid ✓) vs pending (dashed) chip and is tested; nothing shows until the prop is
passed. Design: docs/engineering/design/PROFILE_PRIVACY_DESIGN.md §3.

## Coordinated edit from Claude Code (owner-approved, 2026-10-16) — not a claim on ReelCard

Owner approved fixing the category badge (TRAIN LIKE ME / SERVE LIKE ME) hidden behind Home's Rivalry Week banner. One line in `ReelCard.tsx`: the meta row's top padding is now `Math.max(insets.top + LIVE_BANNER_RESERVE, overlayInsetTop)`, so badges sit below the chrome height Home already passes in. File was last modified 2026-10-13 12:41; existing PLAY-01 edits untouched. PLAY-01 claim stands; verification evidence is in STATE §4 (2026-10-16 Beyond follow-up).

