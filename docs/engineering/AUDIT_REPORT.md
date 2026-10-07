# Tapua'i interaction audit

**Role:** Lead QA & Mobile Systems  
**Dates:** 2026-09-12 (fan hub haptics) · **2026-09-14 (pnpm monorepo audit)**  
**Verdict:** Fan hub UI remains **ready** for Expo Go smoke. Monorepo layout is **shipped locally** (`apps/mobile`, `apps/admin-portal` stub, `packages/shared-types`). No missing product `onPress` handlers. Every real tap fires `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` unless noted.

**Method (2026-09-14):** Static pass over `apps/mobile/app/` + `apps/mobile/src/frontend/`; `pnpm typecheck` (mobile + admin); `pnpm docs:check`; shared-types import smoke; `sk_test_` / `sk_live_` grep under `apps/mobile/src/frontend/` (clean); stale path sweep of docs / troubleshooting / CI. Not re-run on a physical device here.

> **Sections 1-7 below are the 2026-09-14 snapshot and have not been re-run in full.** They predate Vault playback, ShareQR, Varsity, the avatar picker, the current auth sheet, the 2026-09-25 compliance copy, the motion pass, and the Mālo ledger. Treat them as history. The section immediately below is current.

---

## Round 2026-09-25 / 2026-09-28 — button & dead-code pass

**Method (2026-09-25, static):** every pressable-family element in `apps/mobile/app/` + `apps/mobile/src/frontend/` checked for a handler; async press handlers checked for a re-entry guard; every `router` target and `ADMIN_NAV_GROUPS` href resolved against a real route; whole-repo import sweep for unreferenced components.
**Verified and fixed 2026-09-28** with `tsc --noEmit` (mobile + admin) clean, `docs:check` ok, and Jest 45/45.

Clean on the mechanical sweeps: 361 pressable-family elements all have a handler; no unguarded async press handlers; all `router` targets and `ADMIN_NAV_GROUPS` hrefs resolve.

| # | Defect | Severity | Status |
| --- | --- | --- | --- |
| 1 | `app/(tabs)/index.tsx` — Highlights search → tap a clip did nothing when the **All** pill was already active. `jumpToClip` wrote a `pendingClipId` *ref* then called `setFeedFilter('all')`; the resolving effect keyed off `[feed, pageHeight]`, so an unchanged filter left `feed` identical and the effect never re-ran. | Medium | **Fixed** — the pending jump is state, not a ref, and is in the effect's deps. Tapping a feed pill clears a pending jump. |
| 2 | `app/(tabs)/index.tsx` — Spotlight **Watch Full Highlight** silently no-opped from the Highlights tab when the award's clip fell outside the active filter (`jumpToSpotlightClip` ended `if (index < 0) return;`). The Spotlight tab's own `onWatch` already had a fallback chain. | Medium | **Fixed** — falls back to widening the filter to All (via the same pending-jump path), then to the athlete's profile. |
| 3 | `components/Auth/SoftWallModal.tsx` — `canPassword` required the 13+ checkbox, so it gated **Sign in** as well as Create account, retroactively blocking returning email accounts. Contradicted the deliberate design elsewhere: Apple/Google/Demo skip it, new OAuth accounts get `AgeConfirmModal`, and `signInWithEmailPassword` takes the flag as optional. | High (compliance-adjacent) | **Fixed** — the rule moved to `softWallEmailGates` in `lib/auth.ts` and is unit-tested. Sign in is ungated; Create account and magic link keep the gate, because `signUpWithEmailPassword` and `signInWithOtp` can both mint a new row. |
| 4 | Seven components never imported anywhere: `ScoreboardBanner`, `GameEventCard`, `ScoreHeader`, `ReactionButtons`, `HighlightClipCard` (an unused alias re-export of `Reels/ReelCard`), `ScorerHeaderButton`, `Profile/AuraCard`. | Low | **Fixed** — deleted. `Profile/ShareQrModal.web.tsx` was checked and kept: it is a legitimate Metro platform file. |

---

## 0. Monorepo audit (2026-09-14)

| Check | Result |
| --- | --- |
| Layout | Pass — Expo under `apps/mobile/` (`@tapuai/mobile`); Next stub `apps/admin-portal/`; `@tapuai/shared-types`; root `supabase/` + `scripts/` |
| Package manager | Pass — `pnpm-workspace.yaml`, `pnpm-lock.yaml`; root `package-lock.json` removed |
| Typecheck | Pass — `pnpm typecheck` (mobile `tsc` + admin `tsc`) |
| Docs sync | Pass — `pnpm docs:check` |
| Shared types | Pass — mobile `database.ts` re-exports; admin stub page imports `UserRole` / `SpotlightAward` |
| Metro monorepo | Pass — `apps/mobile/metro.config.js` watchFolders + dual `nodeModulesPaths` |
| Secrets in client | Pass — no `sk_test_` / `sk_live_` under `apps/mobile/src/frontend/` |
| Env convention | Pass — `apps/mobile/.env.local` (`EXPO_PUBLIC_*`); `apps/admin-portal/.env.example` (`NEXT_PUBLIC_*`); root `.env.local` gitignored |
| Expo `/admin` | Pass — desks remain in mobile; Next portal is scaffold only (by design) |
| Stale root paths | Fixed this pass — `docs/engineering/TROUBLESHOOTING.md`, `docs/engineering/SCHEMA.md` body refs, `docs/company/INVESTOR.md` / `LEGAL_BRIEFING.md` (`pnpm docs:sync`), `docs/engineering/SYSTEM_OVERVIEW.md` clear command |
| Touchables | Pass — **0** `TouchableOpacity` / `TouchableHighlight` / `TouchableWithoutFeedback` under `apps/mobile/app` + `apps/mobile/src/frontend` |
| Push to origin | **Blocked in agent** — HTTPS remote needs interactive GitHub auth (`gh auth login` or IDE Source Control push). Local `main` stays ahead until pushed |

Day-to-day:

```bash
pnpm install
pnpm mobile          # Expo fan app + Expo /admin
pnpm admin           # Next stub :3001
pnpm typecheck
pnpm docs:check
```

---

## 1. Button inventory

| Primitive | Count / rule | Result |
| --- | --- | --- |
| `TouchableOpacity` / `TouchableHighlight` / `TouchableWithoutFeedback` | Search of `apps/mobile/app/` + `apps/mobile/src/frontend/` | **0** |
| Product `Pressable` | Aliased to `HapticPressable as Pressable` | Pass — Light impact, `disabled` short-circuits `onPress` |
| Raw RN `Pressable` | Only inside `HapticPressable`, `AnimatedButton`, and `AnimatedPressable` | Pass — those are the haptic engines |
| `AnimatedButton` | Tabs, Upload FAB, FilterPills, ExclusivePaywall, Profile Mālo, Local retry | Pass — default haptic Light (`medium`/`selection` aliases) |
| `AnimatedPressable` | Reel Seki / Aura / Flex chips; Drip `GearCard`; cheer options; booster cards | Pass — Light impact except cheer (`haptic="none"` + Medium); chips 0.88 → 1.15 → 1.0; GearCard / boosters 0.96, no overshoot |
| Reel double-tap | `ReelCard` Aura burst | Medium `impactAsync` (explicit exception to Light) |
| Cheer poll vote | `Local/CheerPollCard` option tap | Medium `impactAsync` (`haptic="none"` on `AnimatedPressable` so Light does not double-fire) |
| Profile card flip | `AuraTradingCard` **Flip Card 🔄** / double-tap | Medium `impactAsync` at 90° (`haptic="none"` on the button so Light does not double-fire) |
| Operator callout | `apps/mobile/app/operator/[gameId].tsx` **⚡ Big Play** / TD / Big Hit / Turnover | `notificationAsync(Success)` (`haptic="none"` on `AnimatedPressable`) |
| Live play toast | `Reels/LiveMatchBanner` on `game_events` INSERT (`/game/[id]`) | `notificationAsync(Success)` (not a button; no Light impact) |
| Reel broadcast banner | `ReelCard` on Broadcast `play` | Light `impactAsync` (subtle fan burst) |
| Non-buttons | Tip-sheet backdrop/body | No CTA by design; body uses `haptic="none"` + swallow `onPress` so the sheet does not dismiss when tapping checkout |

Engine:

```
HapticPressable / AnimatedButton / AnimatedPressable
  → impactPress() → Haptics.impactAsync(ImpactFeedbackStyle.Light)
  → onPress (skipped when disabled)
ReelCard double-tap Aura → Haptics.impactAsync(Medium)
CheerPollCard vote → Haptics.impactAsync(Medium)
AuraTradingCard flip midpoint → Haptics.impactAsync(Medium)
Operator callout Broadcast → Haptics.notificationAsync(Success)
LiveMatchBanner play toast → Haptics.notificationAsync(Success)
ReelCard Broadcast banner → Haptics.impactAsync(Light)
```

---

## 2. Audited components

### Fan hub & chrome

| File | Callbacks | Pending disable | Notes |
| --- | --- | --- | --- |
| `FanTabBar.tsx` | Reel / Local / Drip / Profile `navigate`; FAB `openUpload` | N/A (local nav) | FAB is **not** a tab route |
| `apps/mobile/app/(tabs)/_layout.tsx` | Hosts `UploadVideoModal` | Upload Close blocked while uploading | `freezeOnBlur` + `detachInactiveScreens={false}` |
| `apps/mobile/app/(tabs)/index.tsx` | Overlay react / Mālo | `reacting` / `tipping` | UUID reels hit Supabase |
| `apps/mobile/app/(tabs)/local/index.tsx` | Hub pills, GameCard, cheer vote, booster peek, retry | Same-side cheer no-ops | Live Matches / School Polls / Top Boosters; game tap stays in-tab |
| `apps/mobile/app/(tabs)/drip.tsx` | Filter pills, GearCard → ProductSheet, Buy Now | PaymentSheet `busy` | `/shop` redirects here. Stripe native-only. |
| `apps/mobile/app/(tabs)/profile.tsx` | Drop $5 Mālo, Subscribe stub, hub filters, Flip Card | Mālo `busy` | Subscribe is local AsyncStorage, not Stripe. Flip haptic is Medium at 90° |

### Reels, Mālo, upload

| File | Callbacks | Pending disable |
| --- | --- | --- |
| `ReelActionOverlay.tsx` | `@Athlete`, Seki/Aura/Flex, Mālo | Reactions off if `reacting` or no `onReact`; Mālo off if `tipping` / no player |
| `TaggedReelGrid.tsx` | Tile open / lock paywall / modal react | Modal `reacting` during RPC |
| `ReelViewModal.tsx` | Close, paging `ReelCard`s, nested Mālo | Close clears tip sheet; only the focused page plays |
| `UploadVideoModal.tsx` | Close, library/record, tags, submit | Close + iOS swipe ignored while `uploading`; form reset on hide |
| `TipSheetModal` / `MaloTipModal` | Backdrop, Close/Done | Locked while PaymentSheet `busy`; unmount resets checkout; blur backdrop |
| `TipCheckout.tsx` / `TipButton.tsx` | $5 / $10 / $25 / Custom | `disabled={busy}` |
| `ExclusivePaywall.tsx` | Unlock $4.99/mo | `disabled={busy}` |
| `FeeCheckbox.tsx` | Cover fees | Single row handler |
| `BackedCelebration.tsx` | Dismiss | — |

### Operator, roles, guest

| File | Pending disable |
| --- | --- |
| `apps/mobile/app/operator/index.tsx` | Game row opens PIN sheet; GPS `checkingIn` | Claim `claiming` | `PINClaimModal` Light impact per digit |
| `apps/mobile/app/operator/[gameId].tsx` | +1/+3/+6, clock, callouts, roster | `sending` | RPC `update_game_score`; `/operator/console/[gameId]` redirects here |
| `apps/mobile/app/operator/scorer.tsx` | Macros | `sending` | |
| `OperatorRosterModal.tsx` | Close + rows `busy` |
| `apps/mobile/app/(admin)/admin/index.tsx` | Verify / Pay `busyId` |
| `app/(booster)/booster/index.tsx` | Upload / Verify `busy` |
| `app/(sponsor)/sponsor/index.tsx` | Place / Publish / Pause `busy` |
| `app/(parent)/parent/index.tsx` | Consent + payout `busy` |
| `app/athlete/[id].tsx` | Exclusive CTA `busy`; retry `load` |
| `app/(guest)/game/[id].tsx` | Retry; `TabSwitcher` / prefs have `onChange` |
| `app/(guest)/player/[id].tsx` | Retry; HypeBoard `onBump`; TipCheckout `busy` |
| `GameCard.tsx` | Single card `onPress` (no nested CTA) |
| `PlayCard.tsx` | Seki/Aura/Flex + compact Mālo; `reacting` on player hype |

---

## 3. Fixes recorded (this audit)

| Issue | Severity | Fix |
| --- | --- | --- |
| Athlete profile `FilterPills` `onChange={() => undefined}` | Low | Replaced with a static **Tagged Clips** label |
| Overlay reaction chips still tappable when `onReact` missing | Medium | `disabled={!onReact}` |
| Play-card hype could stack RPCs | Low | `reacting` lock around `bumpPlayerHype` |
| Stale HapticPressable JSDoc (“selection”) | Docs | Now documents Light-only engine |

Earlier landings still in tree: `HapticPressable` + Light `impactPress`; PaymentSheet Close lock; upload form reset; GameCard double-press; fee double-toggle; feed/modal reaction locks; operator GPS disable; role-dashboard `busy` gates; reel pause on unmount.

---

## 4. Media & Mālo

### Seki 🤙 / Aura ⚡ / Flex 💪 (video overlays)

```
Reels/ReelCard / TaggedReelGrid
  → bumpReelHype(reelId, kind)
  → rpc increment_reel_hype({ target_reel_id, hype_kind })
  → overlay counts update immediately
```

| Check | Status |
| --- | --- |
| Overlay `onPress` | Pass |
| Light haptic | Pass |
| Instant local +1; `reels` increment in background | Pass (chips no longer wait on RPC) |
| Writes `reels` | Pass for **UUID** ids; fallback `reels.update` if RPC missing |
| Seeded `HIGHLIGHT_CLIPS` (`hl-1`, …) | Known: non-UUID → optimistic UI only |

Guest player `HypeBoard` / `PlayCard` increment **`players`** hype, not `reels` (correct for those routes).

### Mālo $5 / $10 / $25

```
TipButton → useTipCheckout
  → PaymentSheet
  → add_user_aura({ target_user_id, points_to_add: tipAmount * 10 })
  → emitProfileAura + refreshProfile → AuraTradingCard border
```

| Check | Status |
| --- | --- |
| Shortcuts `disabled={busy}` | Pass |
| RPC after successful pay | Pass when signed-in `user.id` |
| Live profile points / 7-tier border | Pass |
| Success extra haptic | `notificationAsync(Success)` after pay; tap itself is Light |
| Web | Alert stub |
| Profile Subscribe ($4.99) | Local stub; paid exclusive is `/athlete/[id]` |

---

## 5. Modals, tabs, sockets

| Surface | State reset | Pending lock |
| --- | --- | --- |
| `UploadVideoModal` | Clip, caption, game, player, errors, progress | Close / swipe ignored while uploading |
| `TipSheetModal` / `MaloTipModal` | Unmounts `TipCheckout`; `delivered`/`busy` reset | Close/backdrop no-op while PaymentSheet open |
| `ReelViewModal` | Nested tip closed; pager unmounts `expo-video` | — |

Tab bar: Reel → Local → Drip → Profile. Already-focused tab does not re-push. Center ⚡ FAB only `openUpload()`.

Realtime teardown:

| Owner | Unmount |
| --- | --- |
| `useLiveScores` | `removeChannel` |
| `useLiveGame` | `removeChannel` |
| `useGameEventBroadcast` | `removeChannel` |
| Operator `game_events_${gameId}` Broadcast | `removeChannel` |
| `useCheerPoll` | `removeChannel` |
| Guest `game/[id]` | `removeChannel` |
| Operator index / console / scorer | `removeChannel` |
| `AuthContext` | `unsubscribe` |

---

## 6. UI readiness

**Ready:** Fan 5-item bar, Reel reactions + Mālo, Upload FAB, exclusive paywall CTA, operator claim/GPS, role-dashboard writes.

**Accepted gaps (not fan-loop blockers):**

1. Seeded demo clips do not write `increment_reel_hype`.
2. Checkout does not insert `public.tips` rows (backer count, reel cents, Drip, and Aura still update).
3. Profile Subscribe ($4.99) is local-only.
4. Haptics no-op on web / some simulators.

---

## 7. Reel feed button audit (2026-09-12 follow-up)

| Surface | Result |
| --- | --- |
| `Gesture.Exclusive(doubleTap, singleTap)` | Pass — single also `requireExternalGestureToFail(doubleTap)`; `maxDistance` / `maxDeltaY` 28 so vertical paging is not a tap |
| Double-tap Aura ⚡ | Pass — floating particle, `Haptics.impactAsync(Medium)`, optimistic `aura_count`, background `increment_reel_hype`, `add_user_aura(+1)` when signed in |
| Seki / Aura / Flex chips | Pass — `AnimatedPressable` `scaleTo={0.88}` `overshoot` (0.88 → 1.15 → 1.0); local +1 then RPC |
| Mālo ⚡ | Pass — opens `MaloTipModal` (`TipSheetModal` alias) with `expo-blur` backdrop |
| Share | Pass — Expo `Share.share` + `formatReelDeepLink` (`alasports://athlete/{id}?reel=`) |
| Bookmark | Pass — `useSavedReel` → `saved_reels` for uuid clips; AsyncStorage for guests / seeded ids |
| Live score banner | Pass — pan activates on swipe-up only (`failOffsetY` down); ✕ / swipe-up set `isDismissed` + Light haptic |

### Device smoke (Expo Go, not web)

- [ ] Uploaded reel: Seki / Aura / Flex persist after pull-to-refresh.
- [ ] Double-tap Aura ⚡: particle + Medium haptic; signed-in fan Aura +1; single tap still mutes (no burst).
- [ ] Mālo ⚡ opens blurred `MaloTipModal`; Share sheet shows `alasports://…` deep link; Save fills bookmark and survives refresh (`saved_reels`).
- [ ] Live score banner: swipe up or ✕ hides it (Light haptic); vertical Reel paging still works from the video.
- [ ] Mālo $5 signed-in: PaymentSheet, +50 Aura, AuraTradingCard border; Close disabled while sheet is open.
- [ ] Upload FAB: Close inert during upload; reopen is a clean form.
- [ ] Reel → Local → Drip → Profile; no Realtime errors in Metro.
- [ ] `/athlete/[id]` exclusive CTA unlocks tiles after pay.
- [ ] Drip Buy Now (Expo Go): PaymentSheet, `add_user_aura` dollars×10, success haptic, **Drip secured ⚡** toast.
- [ ] Local hub: Live Matches / School Polls / Top Boosters pills; cheer vote springs the bar, **+1 Vote ⚡**, `cast_cheer_vote`; booster card peek.
- [ ] Operator: PIN `1234` claims a game; +1/+3/+6 and Start Clock hit `update_game_score`; **⚡ Big Play** Broadcasts to the focused Reel (`⚡ BIG PLAY: Westlake Thunder!`).
