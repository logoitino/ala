# QUIZ-02 local admin-ready evidence

Recorded 2026-10-14T16:53:17Z after owner-approved enrollment and before any timed participant source. Backend correction f785e695; SDK correction 9d34abd. [Approved design](../design/TIMED_TRIVIA_PROPOSAL.md) · [Plan](../design/TIMED_TRIVIA_IMPLEMENTATION_PLAN.md) · [Owner record](../../agents/QUIZ-02.md).

## Operational acceptance

Expo /admin/sport-quiz owns settings, reviewed content, Pause, correction and bounded retention writes; Next remains read-only. Four new private tables plus existing quiz extensions implement default-off invitations, account/week/family authority, original 30/90-second deadlines and hash-only Start capability. All participant mutations bind the expected canonical profile; all admin writes bind the initiating canonical admin. Ordinary reads exclude active prompts; own terminal learning is private. End needs no secret, and End before Start cancels late issuance. Pause permanently closes active rounds. Exact committed answers recover without duplicate rewards. Clear-history CAS advances with material learning, deletes learning/audit associations, retains disclosed preferences/notice/revision and minimal35-day quota; unknown erasure responses require Refresh/reconfirm.

Admin shows a complete <=100-version bank in50-row pages independently of audit, full authoritative totals, explicit unknown reads, mandatory editorial family/source review and removed-versus-retained retention facts. SDK privacy projections reject secret/hash fields, nested unauthorized active prompts and participant audit associations. Badges confer no money, Aura, voting or school advantage. Defaults remain paused/testing-only/empty cohort.

## Actual verification

Root ran all four current integration commands against cached PGlite/Postgres18.6; each exited0:

| Command | Result | Log SHA256 |
| --- | --- | --- |
| node scripts/replay/schema-replay.mjs .smoke/runtime/pglite-cache/package/dist |105/105, unchanged whole canonical twice;83tables368functions182policies|def5230b96bf3d257343a18d3e61bdb31d429463de407edf99d6e5467c4dd3e9|
| node scripts/replay/fan-zone-replay.mjs .smoke/runtime/pglite-cache/package/dist |154/154 unchanged Fan actors|898609c338dd8881bb0db7b7371cee975f654e43ccf402cb8d066db807582d8b|
| node scripts/replay/sport-quiz-replay.mjs .smoke/runtime/pglite-cache/package/dist |34/34 explicitly historical untimed actors|e8c12e23a2734e07ca686c83e09058f6cd1cf5c0ebc1739bf908066c3af80233|
| node scripts/replay/timed-trivia-replay.mjs .smoke/runtime/pglite-cache/package/dist |50/50 timed actors, material history CAS and full nondefault timed state preserved on canonical repeat|4c115c4016e03ac34957fb5b2a40bb322d9e3c192a251a4366bd9a91eb472a66|

Root logs: .smoke/support/quiz02-root-fixed-{canonical,fan,historical,timed}.log; exact command used the absolute cache path inside this worktree. Root canonical SHA25662ff4e50bea046045ad39d06a276605cdd38b6220b139b3325bc50dc5e2f7171 ends with exact migration af9bf48636160c0c8acb70df97352326eecf20762917f10b96fec2778ab2054b. The earlier failed canonical replay remains retained; the underlying repeat defect is independently addressed.

Worker focused SDK/admin3suites77tests and mobile TypeScript exit0 are attributed to Task2 fix report, not root execution. Root regenerated mastermap:86relations331functions31temporarily triaged exports, zero rules; temporary participant export entries must be removed after consumers/approved archive. Independent source/specification/quality and joint local Data/Privacy/Safety/SUPPORT acceptance PASS at16:52:05UTC, source/canonical/log hashes verified. Root fully read receipts:

- task1-fix1-review.md SHA2563e7adea1616165fd2b30ec2d399f6f9c82a99e2dbc3e84eea70e355ad2208a42: T1-I1/T1-I2 addressed.
- task2-fix1-review.md SHA2562231fb6b0b62f2fb6e74764c649411c7d5ba9624aadfcaebb4590cfea45e6477: T2-I1 addressed.

Receipts live in .superpowers/sdd/TIMED_TRIVIA_IMPLEMENTATION_PLAN/. Root actually ran pnpm feature-admin:check --feature QUIZ-02 --require admin-ready at03bc1b7: exit0, seven registered features validated. Participant Task3 dispatched only afterward.

## Remaining boundaries

Timed player/lifecycle/weekly invitation/history/erasure UX and current full pnpm check are still pending. This is local technical acceptance, not hosted execution, native/web/screen-reader certification, counsel approval or proof of hired teams/model runtime. Single-connection actor proof is bounded concurrency evidence. Hosted SQL, content staffing, age/region/notices/retention review and owner release remain required before launch; no push/merge/spending/deployment.

