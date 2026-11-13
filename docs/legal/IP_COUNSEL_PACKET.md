<!-- Generated internal counsel intake evidence. Run pnpm ip:sync; edit the register, never this file. -->
# Tapua'i Sports — intellectual property counsel packet

**Handling:** internal, owner-approved recipients only. Access controls and legal privilege are not established by this label.

**Input record date:** 2026-10-22. **Preparation status:** intake draft; legal completeness and permission to present are not established.

This packet contains source fingerprints and supplied investigation notes. It is not a patent/copyright application, legal opinion or proof of company ownership.

[Process and presentation checklist](IP_PROTECTION_PLAN.md) · [Input register](ip-register.json) · [Actual work receipts](../agents/IP-01.md)

## 1. Current source and open work

- Inventory SHA-256: `7ca0a21d106531cadb10eddad03d2e02a20584069817e9014a95b65bbe9e241f`
- Register SHA-256: `86a11d86b776757dd362bc03cdfc5c8e88d1c7a862e65db85ba00dd7c6073a71`
- Safe source/manifest files monitored: 1122. Git-tracked and non-ignored untracked source; excluded files require separate human review.
- Investigation candidates: 3; missing engineering reviews: 3; stale engineering reviews: 0.
- Rights categories awaiting counsel review: 7.
- Supplied filing receipts: 0. Receipt entries require independent verification; no legal status is inferred.
- Jurisdiction assumption: US-first planning; intended markets and actual filing jurisdictions require owner and counsel decisions.

A changed inventory requires Documentation/feature-owner review for new capabilities, licenses and source scope. Byte currency alone does not validate technical descriptions, human contributions or legal conclusions.

| Monitored area | Files |
| --- | --- |
| apps/ | 957 |
| packages/ | 34 |
| supabase/ | 128 |

## 2. Technical investigation disclosures

These candidates are questions to investigate. None has an established novelty, patentability or freedom-to-operate finding from this generator.

### IP-C01 — Athlete-tagged Highlights and changing privacy permissions

**Feature owner:** HIGHLIGHTS with ACCOUNT\_TAGS / PRIVACY\_ENGINEERING

Candidate source SHA-256: `073c88421315c7e79e9bdb5bef4c80d3eacb836d1a659d7f2f4abec63f7023c3`

**Review state:** No engineering review supplied.

**Problem:** A Highlight can identify an athlete while audience, approval or block state changes. Review how displayed identity and access remain consistent across those changes.

**Baseline / prior approaches:** Tagged media and audience controls are established patterns. No prior-art search or measured comparative baseline has been completed for this candidate.

**Mechanism to trace:** Investigate the implemented request/approval and feed-reading sequence across the Highlights and privacy SDKs and canonical SQL. Engineering must trace exact states, denied actors and revocation behavior before proposing a technical distinction.

**Alternatives to compare:** Compare ordinary access checks, feed-time identity filtering and approval-based tagging. These are investigation options, not documented search results.

**Evidence limits:** Source references establish a reading scope only. Current hosted behavior, novelty, inventorship and claim scope are unverified.

**Human contributions / ownership:** Unknown: collect specific human conception/authorship, dates, AI involvement and assignment evidence from the owner and contributors.

| Source / reading reference | SHA-256 |
| --- | --- |
| [apps/mobile/src/frontend/lib/reels.ts](../../apps/mobile/src/frontend/lib/reels.ts) | `4da5c804dfec788fc750f8851b6be6f4907f6400662efd649b3956c487cf52bd` |
| [apps/mobile/src/frontend/lib/privacy.ts](../../apps/mobile/src/frontend/lib/privacy.ts) | `ae53d3bab4f2e9c458a1d9296a75692f8c2c049c8c549f81b26cea559c31fd02` |
| [apps/mobile/src/backend/db/schema.sql](../../apps/mobile/src/backend/db/schema.sql) | `9d964b7fe04c65af50aa75eebe6f5e84a2e387c405ed08ff58ac759e5f3771a6` |
| [docs/engineering/design/PROFILE\_PRIVACY\_DESIGN.md](../../docs/engineering/design/PROFILE_PRIVACY_DESIGN.md) | `2cd42389d6492030f1bf9ff40f47c1b085cdf01bc6ebc7f0cecdf17bdabe8168` |

References are source reading locations, not evidence that tests or counsel review ran.

**Counsel questions:**

- Is there a precise qualifying technical contribution beyond familiar tagged-media and privacy techniques?
- Which states/steps and evidence would support a useful claim or justify keeping know-how confidential?

**Recorded candidate decisions:**

No records supplied.

### IP-C02 — Private media entitlement and access revocation

**Feature owner:** VAULT / STORAGE with RLS\_SECURITY

Candidate source SHA-256: `7a50aedc556efc0d775ee787941cace33772dc32c5405976b7fc9dbb215e3e47`

**Review state:** No engineering review supplied.

**Problem:** Private media must remain restricted as entitlements and permissions change. Review the boundary between client references, trusted authorization and delivery.

**Baseline / prior approaches:** Entitlements, signed media access and revocation are established techniques. No novelty or freedom-to-operate study has been performed.

**Mechanism to trace:** Trace Vault SDK requests and canonical database permissions, then compare provider-neutral media references with private access enforcement. Identify actual denial/revocation behavior and legacy gaps rather than treating a UI lock as authorization.

**Alternatives to compare:** Compare short-lived signed URLs, trusted streaming authorization and entitlement checks; provider-specific behavior requires separate evidence.

**Evidence limits:** Legacy/public-byte and hosted authorization boundaries require current source and environment review. No patentability, rights or production-security conclusion is recorded.

**Human contributions / ownership:** Unknown: obtain human contribution dates, AI-assisted work history, employer/contract context and assignments.

| Source / reading reference | SHA-256 |
| --- | --- |
| [apps/mobile/src/frontend/lib/vault.ts](../../apps/mobile/src/frontend/lib/vault.ts) | `e037ac3f9d373c371bf55fcdae8f313267fb28e358fc7e13967c79207bebe35a` |
| [apps/mobile/src/frontend/lib/media.ts](../../apps/mobile/src/frontend/lib/media.ts) | `e187e7d37869ff21a9257b66f82651cd4d004d01151d676061b4cb50dd348d41` |
| [apps/mobile/src/backend/db/schema.sql](../../apps/mobile/src/backend/db/schema.sql) | `9d964b7fe04c65af50aa75eebe6f5e84a2e387c405ed08ff58ac759e5f3771a6` |
| [docs/engineering/design/MEDIA\_SERVICE\_PLAN.md](../../docs/engineering/design/MEDIA_SERVICE_PLAN.md) | `84f083e341edd1fccd10dcf9cc77e52b69800cc388d7cf8ac6ea4fa0a567789f` |

References are source reading locations, not evidence that tests or counsel review ran.

**Counsel questions:**

- Does any verified mechanism differ meaningfully from existing entitlement and private-media systems?
- What technical disclosure and commercially relevant claim scope would justify a filing?

**Recorded candidate decisions:**

No records supplied.

### IP-C03 — Live-score event reconciliation and reconnect behavior

**Feature owner:** OPERATOR / LIVE\_SCORES with BACKEND

Candidate source SHA-256: `eee2752a2796ac9fad6788378754a6592da80f60dfb21452a38445c38e03f3e5`

**Review state:** No engineering review supplied.

**Problem:** A sideline score display can receive delayed or conflicting events and reconnect after losing a connection. Review the merge/refetch decisions and resulting score consistency.

**Baseline / prior approaches:** Event ordering, duplicate handling and reconnect reconciliation are common distributed-system patterns. A comparative performance/correctness baseline and prior-art search are absent.

**Mechanism to trace:** Trace the per-game Broadcast merge/refetch helper into the live-score hook and canonical SQL. Document exact inputs, ordering assumptions, fallback requests and failure cases; identify which paths are behind a default-off switch.

**Alternatives to compare:** Compare refetch-only updates, sequence-based reconciliation and event replay. Test relevant duplicates, reorderings and reconnects before claiming improvements.

**Evidence limits:** Local source and disabled switches do not establish deployed behavior or technical novelty. Engineering must supply current test and hosted evidence where relevant.

**Human contributions / ownership:** Unknown: collect human conception and implementation contributions, dates, AI usage and ownership records.

| Source / reading reference | SHA-256 |
| --- | --- |
| [apps/mobile/src/frontend/lib/liveScoreSync.ts](../../apps/mobile/src/frontend/lib/liveScoreSync.ts) | `97952a2ab2ad2d0d48c909ab94fc0bc4bde26051478b6f3e3e4780ed88431b63` |
| [apps/mobile/src/frontend/hooks/useLiveScores.ts](../../apps/mobile/src/frontend/hooks/useLiveScores.ts) | `eb41d5a58fbd01000263ce3a434a5dbb37bc97f1fc72509dd004d3a03bd266ec` |
| [apps/mobile/src/backend/db/schema.sql](../../apps/mobile/src/backend/db/schema.sql) | `9d964b7fe04c65af50aa75eebe6f5e84a2e387c405ed08ff58ac759e5f3771a6` |
| [docs/agents/SCALE-03.md](../../docs/agents/SCALE-03.md) | `87325c3233d93ccb84701a6c182377a1cf89e80b77309ffcd7cda450333f0745` |

References are source reading locations, not evidence that tests or counsel review ran.

**Counsel questions:**

- Is any demonstrated reconciliation method eligible, new and non-obvious relative to prior event-sync systems?
- What actual evidence distinguishes technical benefit from ordinary use of the provider SDK?

**Recorded candidate decisions:**

No records supplied.

## 3. Copyright, ownership and other protection checklist

| ID / material | Supplied status | Required evidence / next work |
| --- | --- | --- |
| R01 — Original source code and documentation | pending | Human authorship, creation/publication dates, work versions, claimant and signed assignment/employment records; counsel selects registration and deposits. |
| R02 — AI-assisted code and assets | pending | Specific human/AI contributions and tool terms; counsel evaluates eligible authorship, inventorship and any excluded material. |
| R03 — Direct/transitive dependencies and patches | pending | License/notice audit against the exact lockfile, upstream patches, examples and provider terms; manifests alone do not prove compliance. |
| R04 — GUI, logo, fonts, icons, art and sound | pending | Creator/license evidence, stable originals and design history; counsel assesses copyright/design-patent scope and trademark clearance. |
| R05 — Contributors, employees and contractors | pending | Contributor roles, specific human contributions and counsel-reviewed signed assignments or licenses; Git names are not inventorship proof. |
| R06 — School marks and uploaded/sample media | pending | Actual permissions/licenses for footage, photos, music and school/provider marks; user content is not automatically company IP. |
| R07 — Confidential know-how and source access | pending | Owner-approved private storage, actual repository/provider access review, confidentiality agreements and disclosure/patent-publication choices. |

Company possession is not ownership. Identify human-authored material and AI assistance; verify assignments, exclusions, licensed components, notices and school/user media rights with counsel.

### Manifest and dependency reading inventory

Names/versions are source observations, not a license audit. Transitive dependencies and notices must be reviewed against the lockfile; URLs/non-semver references are withheld from this summary.

| Manifest | SHA-256 | Direct dependency observations |
| --- | --- | --- |
| [apps/admin-portal/package.json](../../apps/admin-portal/package.json) | `3f19f62e557398519cabdcbe5f29466c741e0bf5c0a468addecb0c53c979c2b3` | @supabase/ssr (^0.12.7); @supabase/supabase-js (^2.116.0); @tailwindcss/postcss (^4.1.12); @tapuai/shared-types (workspace:\*); @types/node (^22.15.29); @types/react (^19.2.2); @types/react-dom (^19.2.2); next (^15.5.2); react (^19.2.3); react-dom (^19.2.3); tailwindcss (^4.1.12); typescript (~6.0.3) |
| [apps/mobile/package.json](../../apps/mobile/package.json) | `6650182b648802b995c9c8280b2f5d602ae97972993e51acb2af04369e52d5f0` | @expo/dom-webview (^58.0.2); @expo/metro-runtime (~58.0.14); @expo/vector-icons (^15.0.2); @react-native-async-storage/async-storage (2.2.0); @react-native-community/netinfo (12.0.1); @react-native-picker/picker (2.11.4); @react-native/jest-preset (0.88.0); @react-native/metro-config (0.88.0); @shopify/react-native-skia (2.14.0); @stripe/stripe-react-native (0.83.0); @supabase/supabase-js (^2.116.0); @tapuai/shared-types (workspace:\*); @testing-library/react-native (^14.0.1); @types/jest (^30.0.0); @types/react (~19.3.0); babel-preset-expo (~58.0.17); expo (~58.0.14); expo-apple-authentication (^58.0.2); expo-auth-session (^58.0.13); expo-blur (~58.0.4); expo-build-properties (~58.0.11); expo-checkbox (~58.0.2); expo-clipboard (~58.0.3); expo-constants (~58.0.12); expo-crypto (^58.0.7); expo-file-system (~58.0.9); expo-font (~58.0.8); expo-haptics (~58.0.7); expo-image-picker (~58.0.10); expo-linking (~58.0.13); expo-location (~58.0.17); expo-media-library (~58.0.10); expo-router (~58.0.23); expo-sqlite (~58.0.13); expo-status-bar (~58.0.3); expo-updates (~58.0.17); expo-video (~58.0.11); expo-web-browser (~58.0.6); jest (^30.5.2); jest-expo (~58.0.11); react (19.3.0); react-dom (19.3.0); react-native (0.88.0); react-native-canvas (^0.1.40); react-native-compressor (^2.0.3); react-native-confetti-cannon (^1.5.2); react-native-gesture-handler (~3.3.0); react-native-nitro-modules (0.37.1); react-native-qrcode-svg (^6.3.24); react-native-reanimated (4.7.1); react-native-safe-area-context (~5.10.1); react-native-screens (~4.30.0); react-native-svg (15.16.0); react-native-url-polyfill (^4.0.0); react-native-web (^0.21.4); react-native-webview (14.0.1); react-native-worklets (0.13.0); stripe (^22.6.2); typescript (~6.0.3) |
| [package.json](../../package.json) | `5bd8b95532ba1b9641917ed8e6f12ea22f04aa07a9b8bd85faf3e818639f5c0b` | None declared |
| [packages/shared-types/package.json](../../packages/shared-types/package.json) | `92ece91b4e72e2cb2b2270f786b84e6c3d6866e5df0e146b4086cbe107dce89d` | typescript (~6.0.3) |

## 4. Disclosure history

- 2026-10-22 · Owner / FACILITATOR · owner-statement: Owner reports nothing has been made public. This is not an independently verified audit; counsel must check earlier sharing, sales/offers and intended launch dates. Evidence: Owner reply in the current IP planning conversation, 2026-10-22; actual repository visibility and historical events unverified.

Owner statements require factual confirmation. Preserve earlier events and corrections; counsel evaluates public/private disclosure, offers/sales and jurisdiction-specific effects.

## 5. Recorded protection decisions

No records supplied.

## 6. Filing receipts and counsel docket

No filing receipts supplied. No filed, patent-pending, granted or registered status is established.

Counsel controls actual deadlines and verifies receipts; this file is not a legal docket or an automatic filing service.

## 7. Questions for counsel

- Which jurisdictions, deadlines and searches should be prioritized before public disclosure?
- Which human authors/inventors and assignment documents are required for this AI-assisted project?
- Which works, exclusions, registration groups and safe deposits fit copyright protection?
- Which candidates warrant a patent search, provisional/full filing, trade-secret treatment or a documented decision to decline?
- What trademark clearance, original GUI design review and separate freedom-to-operate scope are justified?
- What engagement fees, filing/response costs, actual docket ownership and approved sharing controls are required?

## 8. Presentation gate

Before presenting: verify authorized recipients/private storage; refresh and freeze source; obtain feature-owner semantic and contribution/rights reviews; check disclosure history; record actual counsel and owner decisions. Use the full checklist in the process plan. Unknowns remain visible.

Copyright/design/trademark deposits, patent claims/forms and signed assignments are prepared and approved separately with qualified counsel. No source, credentials, customer/minor data or private legal correspondence is automatically exported by this tool.
