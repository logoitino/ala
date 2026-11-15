# WEB-DESKTOP-01 — finish receipt

**Date:** 2026-11-15 (America/Denver)  
**Branch:** `cursor/web-desktop-layout-9a86`  
**PR:** https://github.com/logoitino/ala/pull/54  
**Spend:** Lovable **3 credits** (price not in ROADMAP Wave 0 table). Repo checks/docs **$0**. Wave 0 budget unchanged.

## Done

| Phase | Result |
| --- | --- |
| 0 Audit | [WEB-DESKTOP-AUDIT.md](../../agents/WEB-DESKTOP-AUDIT.md) — before waste 67–78% at desktop |
| 1 Design | [WEB-DESKTOP-01.md](../../agents/WEB-DESKTOP-01.md) — W1–W4 approved (owner continue) |
| 2 Lovable | [Tapua'i Web Desktop](https://lovable.dev/projects/55b66713-1e11-484e-a8a9-7520ad55b7eb) — reference only (W4) |
| 3 Repo | `WebAppShell` three-panel / tablet drawer / phone unchanged |

## Verification

| Check | Result |
| --- | --- |
| `pnpm copy:check` | PASS |
| `pnpm comments:check` | PASS |
| Jest `WebAppShell` + `useAppViewport` | 10/10 PASS |
| `pnpm ip:sync` / `ip:check` | PASS (CI fix) |
| `pnpm exit:map` + acknowledge | PASS |
| `pnpm security:infra:check` | PASS |
| Playwright 1920 guest | Shell + Main + Extras; bottom dock **hidden**; live games on right rail |
| Playwright Local via left rail | Navigated to `/local` |
| Playwright 390 phone | Shell/rails **absent**; Home + Activity + Upload dock **present** |
| Width after (audit) | 1920: 25% waste (was 78%); 1280/820: 0% |

## Hard stops held

- Native phone tabs / density untouched below 820 and on iOS/Android.
- Stripe.js / gift / Vault / tip model not changed.
- No invented Vault clip counts; Aura copy says never from giving.
- Program donations labeled web-checkout only.

## Owner only

Merge PR #54 when CI is green. Optional: visual pass on your Mac at 1920 / 1280 / 820.
