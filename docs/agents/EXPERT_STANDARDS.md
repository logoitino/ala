# Expert standards

**Date:** 2026-10-09. **Trained:** 2026-10-09, each department lead on its connected model. **Kept by:** `VP_OPERATIONS`. **Assigned by:** `CTO`.

Each agent reads the standard for its department before it edits. The connected model is in that agent's file (`model` and `force-default-model: true`). Cursor's subagent docs are the mechanism: [Subagents](https://cursor.com/docs/subagents). `.claude/agents/` is a supported project location. A parent Task call does not override the file when `force-default-model` is set. If the plan blocks the model, Cursor falls back; the agent says which model actually ran.

These standards are operating bars. They are not a launch approval, a security sign-off, or legal advice. Counsel still writes Terms, the Privacy Policy, and parental consent.

Running an agent spends Cursor usage, not the app's Wave 0 vendor budget. Grok and Composer draw from the Cursor Models pool. Claude, GPT, and Gemini draw from the Other Models pool at the rates on [Models & Pricing](https://cursor.com/docs/models-and-pricing). Published cost-per-task figures below are from [Cursor's cost page](https://cursor.com/cost-savings) (2026-10-09). They are not a bill for this repo.

## Operating model

Every agent is pinned to `grok-4.7-medium` with `force-default-model: true`. That model is in Cursor's included Cursor Models pool ([Models & Pricing](https://cursor.com/docs/models-and-pricing)). Claude, GPT, and Gemini draw the Other Models pool and are not pinned. A run stops when that included pool is used up if on-demand usage is off. Do not turn on-demand on to keep going. Fast variants are not pinned, because they spend the same pool faster.

The 2026-10-09 research pass used other models. Those pins were removed the same night so later work stays in the included pool. The department bars below still stand.

## Dev

Lead: `ENGINEERING` on `grok-4.7-medium`. Read the [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) before a new API. SDK 57.0.0 is React Native 0.86. Routes stay file-based under `apps/mobile/app` ([Expo Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/)).

Reel playback is [expo-video](https://docs.expo.dev/versions/v57.0.0/sdk/video/): `useVideoPlayer` and `VideoView`. The hook disposes the player on unmount. `createVideoPlayer` does not; call `release()`. Change the source with `replaceAsync`. Do not wire `expo-av` for the reel player. Do not set `useCaching: true`.

Prefetch only the immediate previous and next photo story. A missing photo column means the feed treats the row as video. October photo-story SQL is written and not applied.

## Database

Lead: `BACKEND` on `claude-fable-5-1-thinking-high`. Migrations are append-only. Canonical SQL is `apps/mobile/src/backend/db/schema.sql`. A written file is not applied SQL. Do not apply SQL unless the owner asks. Development is `ulfapgtabidorgwfjvwz` (the CLI stays linked here). Staging is `tucioqipfejqqqtuakdi`.

[Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations): one change per timestamped file, applied in filename order. `supabase_migrations.schema_migrations` is what each database has applied, and that table is separate from git. Mark a file that was applied by hand with `supabase migration repair --status applied <timestamp>`.

[Postgres row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html): RLS with no policy is default-deny. Table owners and `BYPASSRLS` roles skip RLS unless the table is `FORCE ROW LEVEL SECURITY`. [Supabase functions](https://supabase.com/docs/guides/database/functions): prefer `security invoker`. A changed return type needs `drop function` first.

## Security

Lead: `SECURITY` on `claude-fable-5-1-thinking-high`. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): enable RLS on exposed tables. Adding a policy does not remove existing grants; revoke, then grant back only what the app uses. Name `anon` or `authenticated` on the policy. Do not read `user_metadata` for a role.

A `SECURITY DEFINER` function on Supabase runs as `postgres`, which bypasses RLS ([database functions](https://supabase.com/docs/guides/database/functions)). New or replaced functions use `set search_path = ''` and schema-qualified names. The canonical schema still pins many functions to `public`; that is fixed, and it is not the form the docs recommend. `revoke execute` from `public` and `anon`, then grant only the role that should call it. This repo has no `private` schema, so a helper in `public` is reachable through the Data API. A local reading of SQL is not a hosted denial test.

Storage policies live on `storage.objects` and name `bucket_id` ([storage access control](https://supabase.com/docs/guides/storage/security/access-control)). The client insert of `tips` stays the only credit path until webhook crediting replaces it in the same change. No service-role key in the app.

## IT infrastructure

Lead: `OPERATIONS` on `grok-4.7-medium`. [EAS Build](https://docs.expo.dev/build/introduction/) makes the installable binary. Do not start a new iOS preview until a second device is registered. The 2026-10-01 preview binaries do not contain later JavaScript. [EAS Update](https://docs.expo.dev/eas-update/introduction/) can ship JavaScript and images only when `expo-updates` is already in the binary and the runtime version matches.

A Wave 0 preview build, applying SQL, and a `4242` donation are $0 until Expo's free build quota runs out or a free Supabase project pauses (then Pro is about $25/mo). Apple Developer $99/yr is already enrolled. Do not start Wave 1. Staging commands need both `--linked` and project ref `tucioqipfejqqqtuakdi`. Do not link the CLI away from development.

## Design

Lead: `DESIGN` on `composer-2.5-fast`. Native hit targets are at least 44×44 pt. That number is Apple's Buttons guidance and `MENU_METRICS.touchTarget` in `apps/mobile/src/frontend/constants/theme.ts`. [WCAG 2.2 success criterion 2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum) is 24×24 CSS pixels. The 44×44 CSS pixel bar is success criterion 2.5.5, Level AAA. Do not cite 2.5.8 as 44.

Daylight color and springs live in `apps/mobile/src/frontend/theme/motion.ts`. Honor Reduce Motion. Every screen has a loading, empty, and error state. Set `accessibilityLabel` and `accessibilityRole`. `ACCESSIBILITY` audits. `MOTION` changes tokens.

## Finance

Lead: `COMMERCE` on `claude-opus-5-5-medium`. Stripe test mode only. The server creates the PaymentIntent. The app receives a client secret, never a secret key.

Checked 2026-10-09: the donation PaymentIntent in this repo has no `transfer_data`, `application_fee_amount`, or `on_behalf_of`. It is a charge on the platform account. [Destination charges](https://docs.stripe.com/connect/destination-charges?platform=react-native) are the planned shape, not the code that runs. Under that shape, Stripe fees, refunds, and chargebacks come from the platform balance. Stripe calls the platform the business of record when `on_behalf_of` is omitted.

Fulfill from the webhook, not from the client callback alone. Verify the signature. Make the handler idempotent ([webhooks](https://docs.stripe.com/webhooks)). Do not turn webhook crediting on while `useTipCheckout` still inserts `tips`. The donate sheet says Donate / donation, shows 90 / 10, and starts the optional tip for Tapua'i at No tip. Payouts stay blocked.

## Legal and Compliance

Leads: `LEGAL` on `claude-fable-5-1-thinking-high`, `COMPLIANCE` on `claude-opus-5-5-medium`. This team does not draft legal text and does not pick which store rule applies.

**In the product:** 13+ confirmation, Terms / NIL acknowledgement, the 90 / 10 line on the donate review, Stripe test mode, payouts blocked. **Counsel still produces:** Terms, a Privacy Policy, parental consent, and the athlete agreement. Export and deletion are not built. Whether a store or a statute requires them is counsel's call. Apple's account-deletion page is the checklist item to track, not a conclusion written here: [offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

Pages opened, not applied: [FTC children's privacy](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy) and [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). Numbers seen on Apple's page: 1.2 and 1.2.1 (user-generated content), 1.3 and 5.1.4 (kids), 3.1.1 and 3.1.3 (payments), 3.2.1(vi), 3.2.1(vii), and 3.2.2(iv). The owner and counsel decide which number fits a donation to an athlete. No SOC 2 claim. No uptime claim. No tracker before consent. Exclusive is a one-time PaymentIntent, so auto-renewal disclosure waits until it is a subscription.

## Brand

Lead: `VOICE` on `claude-sonnet-5-thinking-high`. The owner-approved lines, exact, are "Donate. Elevate. Celebrate." and "Support their journey. Elevate their opportunities. Celebrate their story." Use the constants in `data/malo.ts`. Placements are the four rows in [VOICE.md](../product/VOICE.md): first open, donate sheet Amount page, athlete profile when that athlete can be donated to, and public docs plus the draft store listing.

Money words are Donate / donation. "Mālo!" is only a thank-you. The optional tip line names Tapua'i. "Elevate" is support, never recruiting, a scholarship, or a roster spot. Code names stay `tips`, `useTipCheckout`, and `malo*`. VOICE.md is the source. If this section disagrees, fix VOICE.md first.

## Trust and Safety

Lead: `TRUST_SAFETY` on `claude-sonnet-5-thinking-high`. Reports exist. A human review queue, strikes, and appeals do not. Age confirmation is 13+. Upload confirmations and photo-story rights rows stay. Do not contact a family or a school.

Apple's guideline 1.2, read 2026-10-09 on the [Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) page, lists a filter, a report path, a way to block an abusive user, and published contact information. This app has reports. A block control and a published contact are not in the product. Naming that gap is not a decision that 1.2 binds this app. Counsel and the owner decide that.

## Partnerships

Lead: `PARTNERSHIPS` on `gpt-5.6-sol-medium`. Portals in the app are not outreach and not proof of a partnership. No school, booster, sponsor, athlete, or family is contacted. School confirmation tokens and roster CSV imports stay inside the written rules. School names and marks do not imply permission. Association or district permission is an owner and counsel decision. This team does not sign, activate ads, or move money.

## Quality

Lead: `QA` on `claude-opus-5-5-medium`. A Jest pass is not a device pass and not a browser pass. Name the command, the counts, and the date.

2026-10-09, from `apps/mobile`: `jest --watchman=false photoStories reelsPhotoStories useStoryPhotos ReelCard.photoStory PhotoStoryMedia ReelOwnerPeek`. Result: 6 suites, 60 tests, all passed. That replaces the earlier 5 suites / 55 tests, which did not name the sixth file.

Playwright evidence goes in `docs/engineering/AUDIT_REPORT.md`. [Playwright emulation](https://playwright.dev/docs/emulation) sets a viewport in a desktop browser. It is not a native device, and it is not Dynamic Type. Photo stories on a live development feed stay unverified until `20261007230000_photo_stories.sql` is applied. `QA` can reject.

## Product

Lead: `PRODUCT` on `gpt-5.6-sol-medium`. Scope is the CTO's assignment. An acceptance line names the starting state, the action, the result, and the evidence: local test, browser, device, hosted SQL, or counsel. One does not stand in for another.

Wave 0 is the test wave. Public release is not started. The owner decision list is STATE §6, copied into [DEPARTMENT_PLANS.md](DEPARTMENT_PLANS.md): telemetry identity, video host, one credit path, parent as payee, scorer fee, 1-on-1 later, pathway savings, how money reaches families, the App Store fee question, the held-gift cap, and the fan signature later.

## Marketing

Lead: `MARKETING` on `gpt-5.6-sol-medium`. No external campaign. The line is "Donate. Elevate. Celebrate." Family stories need written consent. The store listing is a draft and needs `LEGAL` before anyone submits it. Apple's product-page guidance, opened 2026-10-09: [product page](https://developer.apple.com/app-store/product-page/) and [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Support

Lead: `SUPPORT` on `claude-sonnet-5-thinking-high`. Intake is `docs/engineering/TESTER_SCRIPT.md` and the in-app suggestion. No one outside the test is contacted. A report that touches a charge, a payout, or a sign-in goes to Finance and Security. Severity language can follow [Google's incident chapter](https://sre.google/sre-book/managing-incidents/). No help-desk vendor is assumed.

## Connected models

<!-- model-assignments -->
| Agent | Model | Department |
| --- | --- | --- |
| `ACCESSIBILITY` | `grok-4.7-medium` | Design |
| `ACCOUNT_TAGS` | `grok-4.7-medium` | Engineering |
| `ACTIVITY` | `grok-4.7-medium` | Engineering |
| `ADMIN` | `grok-4.7-medium` | Engineering |
| `ANALYST` | `grok-4.7-medium` | Engineering |
| `API` | `grok-4.7-medium` | Engineering |
| `ATHLETE_STATS` | `grok-4.7-medium` | Engineering |
| `ATHLETE_VERIFICATION` | `grok-4.7-medium` | Trust and Safety |
| `AURA` | `grok-4.7-medium` | Engineering |
| `AUTH` | `grok-4.7-medium` | Engineering |
| `BACKEND` | `grok-4.7-medium` | Database |
| `BILLING` | `grok-4.7-medium` | Finance |
| `BRAND` | `grok-4.7-medium` | Marketing |
| `CATALOGS` | `grok-4.7-medium` | Engineering |
| `CHECKOUT` | `grok-4.7-medium` | Finance |
| `CI` | `grok-4.7-medium` | IT infrastructure |
| `COMMERCE` | `grok-4.7-medium` | Finance |
| `COMPLIANCE` | `grok-4.7-medium` | Legal and Compliance |
| `CONNECT` | `grok-4.7-medium` | Finance |
| `CONTENT_RIGHTS` | `grok-4.7-medium` | Legal and Compliance |
| `COST_OPERATIONS` | `grok-4.7-medium` | IT infrastructure |
| `CREW` | `grok-4.7-medium` | Engineering |
| `CTO` | `grok-4.7-medium` | Office of the CTO |
| `CUSTODIAL` | `grok-4.7-medium` | Finance |
| `DATABASE_MIGRATIONS` | `grok-4.7-medium` | Database |
| `DESIGN_TOOLING` | `grok-4.7-medium` | Design |
| `DESIGN` | `grok-4.7-medium` | Design |
| `DEVICE_QA` | `grok-4.7-medium` | Quality |
| `DISCOVERY` | `grok-4.7-medium` | Engineering |
| `DOCUMENTATION` | `grok-4.7-medium` | Engineering |
| `DONATION_THANKS` | `grok-4.7-medium` | Finance |
| `DRIP` | `grok-4.7-medium` | Finance |
| `ENGINEERING` | `grok-4.7-medium` | Engineering |
| `FILMER_REWARDS` | `grok-4.7-medium` | Engineering |
| `FULLSTACK` | `grok-4.7-medium` | Engineering |
| `GROWTH_ANALYTICS` | `grok-4.7-medium` | Marketing |
| `HIGHLIGHTS` | `grok-4.7-medium` | Engineering |
| `INCIDENT_TRIAGE` | `grok-4.7-medium` | Support |
| `LEADERBOARDS` | `grok-4.7-medium` | Engineering |
| `LEDGER` | `grok-4.7-medium` | Finance |
| `LEGAL` | `grok-4.7-medium` | Legal and Compliance |
| `LOCAL` | `grok-4.7-medium` | Engineering |
| `MARKETING` | `grok-4.7-medium` | Marketing |
| `MINOR_SAFETY` | `grok-4.7-medium` | Trust and Safety |
| `MOBILE_PERFORMANCE` | `grok-4.7-medium` | Engineering |
| `MODERATION` | `grok-4.7-medium` | Trust and Safety |
| `MOTION` | `grok-4.7-medium` | Design |
| `NOTIFICATIONS` | `grok-4.7-medium` | Engineering |
| `OFFLINE` | `grok-4.7-medium` | Engineering |
| `ONBOARDING` | `grok-4.7-medium` | Engineering |
| `OPERATIONS` | `grok-4.7-medium` | IT infrastructure |
| `OPERATOR` | `grok-4.7-medium` | IT infrastructure |
| `PARTNERSHIPS` | `grok-4.7-medium` | Partnerships |
| `PHOTO_STORIES` | `grok-4.7-medium` | Engineering |
| `PLAYBACK` | `grok-4.7-medium` | Engineering |
| `POLLS` | `grok-4.7-medium` | Engineering |
| `PORTAL` | `grok-4.7-medium` | Engineering |
| `PRIVACY_ENGINEERING` | `grok-4.7-medium` | Legal and Compliance |
| `PRODUCT` | `grok-4.7-medium` | Product |
| `PROFILE` | `grok-4.7-medium` | Engineering |
| `QA` | `grok-4.7-medium` | Quality |
| `RALLY` | `grok-4.7-medium` | Finance |
| `REALTIME` | `grok-4.7-medium` | Engineering |
| `RECEIPTS` | `grok-4.7-medium` | Finance |
| `RECONCILIATION` | `grok-4.7-medium` | Finance |
| `RECOVERY` | `grok-4.7-medium` | IT infrastructure |
| `REFUNDS` | `grok-4.7-medium` | Finance |
| `RELEASE` | `grok-4.7-medium` | IT infrastructure |
| `RELIABILITY` | `grok-4.7-medium` | IT infrastructure |
| `RESEARCH` | `grok-4.7-medium` | Product |
| `RLS_SECURITY` | `grok-4.7-medium` | Security |
| `ROLE_HQ` | `grok-4.7-medium` | Partnerships |
| `ROSTERS` | `grok-4.7-medium` | Engineering |
| `RUNTIME_CONFIG` | `grok-4.7-medium` | Engineering |
| `SCHOOL_PARTNERS` | `grok-4.7-medium` | Partnerships |
| `SECURITY` | `grok-4.7-medium` | Security |
| `SESSION_SECURITY` | `grok-4.7-medium` | Security |
| `SHARED_CONTRACTS` | `grok-4.7-medium` | Engineering |
| `SHARING` | `grok-4.7-medium` | Engineering |
| `SPONSOR_ADS` | `grok-4.7-medium` | Partnerships |
| `SPOTLIGHT` | `grok-4.7-medium` | Engineering |
| `STORAGE` | `grok-4.7-medium` | Database |
| `SUPPORT` | `grok-4.7-medium` | Support |
| `TELEMETRY` | `grok-4.7-medium` | IT infrastructure |
| `TEST_AUTOMATION` | `grok-4.7-medium` | Quality |
| `TRUST_SAFETY` | `grok-4.7-medium` | Trust and Safety |
| `UPLOAD` | `grok-4.7-medium` | Engineering |
| `VAULT` | `grok-4.7-medium` | Engineering |
| `VISUAL_QA` | `grok-4.7-medium` | Quality |
| `VOICE` | `grok-4.7-medium` | Brand |
| `VP_OPERATIONS` | `grok-4.7-medium` | Office of the CTO |
| `WISHLIST` | `grok-4.7-medium` | Finance |
<!-- /model-assignments -->
