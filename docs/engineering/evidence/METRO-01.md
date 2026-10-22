<!-- Local SDK cancellation repair evidence; a source check does not establish device or hosted readiness. -->
# METRO-01 — disconnected request reported as a Metro error

Date: 2026-10-22. Ordinary development-tooling repair, no new feature/admin capability.
Routing: CTO → ENGINEERING → FULLSTACK, paired with SUPPORT/RELIABILITY; independent
source review and same-turn DOCUMENTATION evidence. Codex root owns patch, lockfile,
tests and docs; outside-session `metro_abort_trace` owns read-only SDK trace/review.
These executors do not claim to run the repository's pinned Grok specialists.

## Observation and root cause

The owner reported `This operation was aborted`, `http.js:105`, `controller.abort()`.
Installed Expo58.0.14 → CLI58.1.11 → expo-server58.0.5 converts an unfinished closed
HTTP response into an aborted Request. Router Server58.0.14 passes that signal to
React DOM19.3.0 `renderToReadableStream`. If the shell is still pending, React rejects
with the exact signal reason. Router's `onError` already skips cancellation logging,
but the outer promise rejects into CLI `evalMetroAndWrapFunctions` and its Metro logger,
then the HTML overlay handler. This is unrelated to PLAY-01 browser video play promises.

## Bounded experiment and decision

- Baseline: real local Node HTTP socket disconnected while real installed React's root
  suspended before a shell. Installed `convertRequest` produced the exact
  `expo-server/build/cjs/vendor/http.js:105` AbortError; 1 failing/8 passing tests.
  Original local output: `.smoke/metro-01/red.log` (ignored private evidence).
- Alternatives: cancellation guards at three CLI/HTTP reporting boundaries, or one
  Router Server render-promise catch. Choose the latter: complete that cancelled render
  with a closed empty stream that the already-destroyed response discards.
- Scope: only nonstatic streaming, an aborted request and the exact `signal.reason`
  object named AbortError. Preparation failures, unrelated AbortErrors, other transport
  failures, static exports and later stream behavior keep their existing contracts.
- Stop criterion: normal HTML/export changes, hidden genuine errors, changed public APIs
  or dependence on broad exception filtering. No global logger or routing change.
- Adopted locally: [versioned patch](../../../patches/@expo__router-server@58.0.14.patch),
  12 added lines/0 removed lines in one installed renderer file. No dependency version
  changes. Preserve MIT attribution; review/remove or port this patch on SDK upgrades.

## Verification and source binding

[Regression](../../../scripts/__tests__/metro-request-abort.test.mjs) loads the actual
installed renderer in a VM, substituting only Expo navigation/font/resources around real
React. The first case uses an actual ephemeral127.0.0.1 HTTP server and installed Expo
request conversion/response handling; it does not load application data or credentials.
Controlled renderer rejection cases exercise the actual SDK catch's error-identity contract.

- GREEN: 11/11. Disconnected and pre-aborted requests complete quietly, connected HTML
  streams, static export stays text, null/custom reasons and unrelated failures stay
  original rejections, and cancellation after the shell releases work. Connected real
  React component errors still reject/report. `.smoke/metro-01/green.log`.
- Tracked patch dry-run/application against installed baseline PASS; installed candidate
  equals the tracked patch result. Root manifest/lock use pnpm9's normalized MD5/base32
  patch hash `c4bmnqk2mmbfdrfcsmg5vxcsce`. Offline frozen lock-only validation PASS with
  an isolated `/tmp/ala-metro01-lock-only-modules` directory; no rebuild of unrelated modules.
- `pnpm metro:test` is in full `pnpm check` and the dedicated CI step. Engineering Support
  catalog declares this local sensor; no hosted monitor or raw-request telemetry added.
- Independent read-only review by `metro_abort_trace` found no concrete correctness issues
  in the actual patch/test/manifest/lock. The reviewer did not rerun tests or claim browser QA.
- Fresh owned Metro on localhost8091 with `EXPO_NO_DOTENV=1 CI=1`: status200; Home GET200,
  77,573 bytes, server2611/web2212 modules, no Metro abort in the retained log. This was
  HTTP/compile proof without browser interaction or app credentials. Owned process stopped;
  existing owner processes preserved. `.smoke/metro-01/metro-http.json` and `metro.log`.
- Full `pnpm check` exit0:266 mobile suites/2576 tests and11 Metro regressions; both app
  typechecks and all guards PASS. Full original log: `.smoke/metro-01/check.log`.
  Retained `pnpm detection:scan` exit0 at2026-10-22T21:41:05.113Z: quality gate and117/117
  portal tests PASS, none skipped. Run `2026-10-22T21-37-35-734Z-0da39f0c-final` in
  `.smoke/detection/latest.json`; bounded scan output cannot retain the full early Jest
  section, so the direct full-check log above carries original totals.30 declared sensors,
  25 existing partial/gap declarations and runtimeVerified=false remain explicit.
- Installed patched renderer SHA256
  `1a1b0e73f450748629c8aaca4d8b77733054d3a36a123880b09043212bff8266`;
  patch SHA256 `b038a61630b068ba93e0f0819b0355e86502410033f4ba99666c80d91c6d28f8`.

Exact SDK58 web-doc access uses the owner's earlier installed-source/local-doc exception.
No browser/device interaction, production deployment or complete clean dependency install
is inferred from these checks. The two pre-existing owner Metro processes on8081/8082
were left running; they retain loaded old modules until restarted.

## Restart and next owner

Stop each old Metro terminal with Ctrl+C. From the root on Node24, run `pnpm mobile`, then
reload the browser/Expo app. Clearing caches is not the repair; the fresh process loads
the patched dependency. If the same error recurs, SUPPORT requests the full redacted stack,
platform and whether a reload/navigation disconnected the request before changing scope.
Actual browser/device acceptance remains with QA and the owner.

Local implementation/review/documentation claims released after these checks. QA/owner
owns the restart/journey acceptance. The source patch and CI regression travel with the
next local commit on main; GitHub publication is performed separately by the owner.
