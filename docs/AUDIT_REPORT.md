# Tapua'i interaction audit

**Role:** Lead QA & Mobile Systems  
**Date:** 2026-09-12  
**Verdict:** Fan hub UI is **ready** for Expo Go smoke. No missing product `onPress` handlers. Every real tap fires `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.

**Method:** Full static pass over `app/` and `src/frontend/`. RPC and PaymentSheet paths traced in source (`bumpReelHype`, `useTipCheckout`, Realtime `removeChannel`). Not run on a physical device here (Stripe test mode is native-only).

---

## 1. Button inventory

| Primitive | Count / rule | Result |
| --- | --- | --- |
| `TouchableOpacity` / `TouchableHighlight` / `TouchableWithoutFeedback` | Search of `app/` + `src/frontend/` | **0** |
| Product `Pressable` | Aliased to `HapticPressable as Pressable` | Pass — Light impact, `disabled` short-circuits `onPress` |
| Raw RN `Pressable` | Only inside `HapticPressable`, `AnimatedButton`, and `AnimatedPressable` | Pass — those are the haptic engines |
| `AnimatedButton` | Tabs, Upload FAB, FilterPills, ExclusivePaywall, Profile Mālo, Local retry | Pass — default haptic Light (`medium`/`selection` aliases) |
| `AnimatedPressable` | Reel Seki / Aura / Flex chips; Drip `GearCard`; cheer options; booster cards | Pass — Light impact except cheer (`haptic="none"` + Medium); chips 0.88 → 1.15 → 1.0; GearCard / boosters 0.96, no overshoot |
| Reel double-tap | `ReelCard` Aura burst | Medium `impactAsync` (explicit exception to Light) |
| Cheer poll vote | `Local/CheerPollCard` option tap | Medium `impactAsync` (`haptic="none"` on `AnimatedPressable` so Light does not double-fire) |
| Profile card flip | `AuraTradingCard` **Flip Card 🔄** / double-tap | Medium `impactAsync` at 90° (`haptic="none"` on the button so Light does not double-fire) |
| Operator callout | `app/operator/[gameId].tsx` **⚡ Big Play** / TD / Big Hit / Turnover | `notificationAsync(Success)` (`haptic="none"` on `AnimatedPressable`) |
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
| `app/(tabs)/_layout.tsx` | Hosts `UploadVideoModal` | Upload Close blocked while uploading | `freezeOnBlur` + `detachInactiveScreens={false}` |
| `app/(tabs)/index.tsx` | Overlay react / Mālo | `reacting` / `tipping` | UUID reels hit Supabase |
| `app/(tabs)/local/index.tsx` | Hub pills, GameCard, cheer vote, booster peek, retry | Same-side cheer no-ops | Live Matches / School Polls / Top Boosters; game tap stays in-tab |
| `app/(tabs)/drip.tsx` | Filter pills, GearCard → ProductSheet, Buy Now | PaymentSheet `busy` | `/shop` redirects here. Stripe native-only. |
| `app/(tabs)/profile.tsx` | Drop $5 Mālo, Subscribe stub, hub filters, Flip Card | Mālo `busy` | Subscribe is local AsyncStorage, not Stripe. Flip haptic is Medium at 90° |

### Reels, Mālo, upload

| File | Callbacks | Pending disable |
| --- | --- | --- |
| `ReelActionOverlay.tsx` | `@Athlete`, Seki/Aura/Flex, Mālo | Reactions off if `reacting` or no `onReact`; Mālo off if `tipping` / no player |
| `HighlightClipCard.tsx` | `commitHype` → `bumpReelHype` | `reacting` |
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
| `app/operator/index.tsx` | Game row opens PIN sheet; GPS `checkingIn` | Claim `claiming` | `PINClaimModal` Light impact per digit |
| `app/operator/[gameId].tsx` | +1/+3/+6, clock, callouts, roster | `sending` | RPC `update_game_score`; `/operator/console/[gameId]` redirects here |
| `app/operator/scorer.tsx` | Macros | `sending` | |
| `OperatorRosterModal.tsx` | Close + rows `busy` |
| `app/(admin)/admin/index.tsx` | Verify / Pay `busyId` |
| `app/(booster)/booster/index.tsx` | Upload / Verify `busy` |
| `app/(sponsor)/sponsor/index.tsx` | Place / Publish / Pause `busy` |
| `app/(parent)/parent/index.tsx` | Consent + payout `busy` |
| `app/athlete/[id].tsx` | Exclusive CTA `busy`; retry `load` |
| `app/(guest)/game/[id].tsx` | Retry; `TabSwitcher` / prefs have `onChange` |
| `app/(guest)/player/[id].tsx` | Retry; HypeBoard `onBump`; TipCheckout `busy` |
| `GameCard.tsx` | Single card `onPress` (no nested CTA) |
| `PlayCard.tsx` | Seki/Aura/Flex + compact Mālo; `reacting` on player hype |
| `ScoreHeader.tsx` | Pressable **only** when `onPress` is passed (else `View`) |

`ReactionButtons.tsx` is Alert-only and **not imported** anywhere.

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
HighlightClipCard / TaggedReelGrid
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
  → emitProfileAura + refreshProfile → AuraTradingCard / AuraCard border
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
| `ScoreHeader` | `removeChannel` |
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
4. `ReactionButtons.tsx` unused.
5. Haptics no-op on web / some simulators.

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
- [ ] Mālo $5 signed-in: PaymentSheet, +50 Aura, AuraTradingCard / AuraCard border; Close disabled while sheet is open.
- [ ] Upload FAB: Close inert during upload; reopen is a clean form.
- [ ] Reel → Local → Drip → Profile; no Realtime errors in Metro.
- [ ] `/athlete/[id]` exclusive CTA unlocks tiles after pay.
- [ ] Drip Buy Now (Expo Go): PaymentSheet, `add_user_aura` dollars×10, success haptic, **Drip secured ⚡** toast.
- [ ] Local hub: Live Matches / School Polls / Top Boosters pills; cheer vote springs the bar, **+1 Vote ⚡**, `cast_cheer_vote`; booster card peek.
- [ ] Operator: PIN `1234` claims a game; +1/+3/+6 and Start Clock hit `update_game_score`; **⚡ Big Play** Broadcasts to the focused Reel (`⚡ BIG PLAY: Westlake Thunder!`).
