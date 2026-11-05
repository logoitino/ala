<!-- Owner decision 2026-11-04: the Lovable "Friday Night Lights" design is the UI/UX standard for the whole app. -->
# Lovable UI/UX plan — the whole-app design standard

**Status:** adopted 2026-11-04 by the owner ("my wish is that the whole app follows that now").
**Reference prototype:** Lovable project *Friday Night Lights*
(<https://lovable.dev/projects/99b55089-c2b2-4609-a647-bd877e62ffa4>). It is a front-end-only web
mockup with sample data; it is a **design reference, not source**. Real screens keep their own data,
copy, flows and safety rules.
**Supersedes for presentation:** the 2026-10-12 admin-portal report format (top underline tabs, open
panels) and the UX-10 per-tab accent scheme where they conflict with this plan. Calm Island colours,
owner-approved copy (BRAND-01, VOICE) and every legal/payment notice stay authoritative.

## 1. Principles

1. **Daylight surfaces, night for moments that matter.** Pages stay on the warm Daylight canvas.
   Video, live games, the #1 award, the locked Vault, hero totals and the admin sidebar use the
   obsidian night surface so they read as special.
2. **One jade primary, gold only for awards, ember only for LIVE and danger.** Neon jade is a glow on
   dark surfaces, never text on light.
3. **Hierarchy before decoration.** Big bold titles (30–34pt, weight 900), scoreboard numerals for
   money, scores and Aura, one primary action per area. No stacks of equal-weight bold links.
4. **Consistent controls.** Every action uses the shared button family; chips for filters and choices;
   44pt minimum targets; 14pt control radius, 16 cards, 24 sheets and hero cards.
5. **Content is never lost in a restyle.** Every existing label, link, notice, number and route carries
   over. Lovable sample copy and invented features are not imported (see §6).

## 2. Tokens

| Role | Mobile (`constants/theme.ts`, `theme/motion.ts`) | Admin portal (`app/globals.css`) |
| --- | --- | --- |
| Canvas | `colors.background` `#F7F6F2` | `--canvas` `#f7f6f2` |
| Surface / border | `colors.surface` `#FFFFFF` / `colors.border` `#E3E1D9` | `--surface` / `--border` `#e3e1d9` |
| Ink / muted | `colors.text` `#14191B` / `colors.textMuted` | `--ink` / `--ink-soft` / `--text-muted` |
| Primary (jade ink) | `colors.primary` | `--jade` |
| Glow (dark only) | `colors.glow` / `FOCAL.neonJade` `#2EE59D` | `--sidebar-accent` |
| Award gold | `colors.electricGold` fill, `colors.gold` text | `--gold` text |
| LIVE / danger | `FOCAL.ember` fill, `colors.danger` text | `--ember` |
| Warning ("Check", test mode) | `KIT.warnSoft` / `KIT.warnInk` | `--gold-soft` / `--gold` |
| Night surface | `colors.videoSurface` `#0E1315`, raised `KIT.obsidianRaised` | `--sidebar-bg`, `--sidebar-active` |
| On night | `colors.onVideo` / `colors.onVideoMuted`, lines `KIT.onVideoLine` | `--sidebar-ink` / `--sidebar-ink-muted` / `--sidebar-line` |
| Radii | `KIT.controlRadius` 14, `KIT.cardRadius` 16, `KIT.sheetRadius` / `heroRadius` 24, `radii.pill` | `rounded-xl` controls, `rounded-2xl` cards |
| Elevation | `cardShadow` cards, `KIT.shadowSoft` primary actions | `--shadow-card` |
| Numbers | `SCOREBOARD_DIGITS` (tabular, 900) | `tabular-nums font-black` |

Contrast: all text pairs clear WCAG AA (4.5:1); neon/gold fills are never used for body text on light.

## 3. Components

| Need | Use | Notes |
| --- | --- | --- |
| Any button | `UI/Kit` → `KitButton` | Variants: `primary`, `secondary`, `tint`, `ghost`, `destructive`, `gold` (award/unlock), `glass` and `light` (over video). Sizes `sm` / `md` / `lg`. Keeps spring, haptics, Reduce Motion. |
| Filters / choices | `KitChip` or existing `UI/FilterPills` | Active = ink fill; `dark` over video. |
| Status | `KitBadge`, `LivePill` | Tones jade / gold / ember / danger / warn / neutral / dark. |
| Progress | `KitProgress` | Only for measured progress; never show invented values. |
| Section cards | `DashboardPanel`, `cardShadow` cards | No gold left edge. |
| Screen titles | `ScreenHeading` | Fan titles 30pt/900. |
| Sheets | existing sheet frames (`useSheetFrame`) | 24pt top radius, 52pt primary actions, reassurance strips in mist jade. |
| Admin portal | `PortalShell`, `StatCard`, `Panel`, `Badge` | Dark sidebar (top bar below `lg`), card panels. |

New screens must use these instead of hand-rolled Pressable styles. Existing screens migrate as they
are touched (§5).

## 4. Surface patterns

- **Welcome:** full-screen night hero, decorative sport tiles, light primary "Watch highlights".
- **Sign-in / age:** large title, provider buttons 52pt, lock reassurance strip, icon tile on the age card.
- **Gift sheet:** scoreboard amount tiles, ink-filled selected tip chip, 44pt review total, solid Next.
- **Highlights reel:** full-bleed night media (already matches); keep the overlay logic untouched.
- **Local:** live games = night scoreboard card with solid LIVE pill; upcoming = light card.
- **Spotlight:** #1 = night award card with gold rank; ranks 2–3 gold-ink podium; ink filter chips.
- **Profile / Vault:** locked Vault = night card, lock tile, gold one-time unlock (catalog price).
- **Activity / receipts:** 44pt filled icon circles, scoreboard amounts.
- **Athlete HQ:** night hero with the recorded gift total; gift rows; badge tiles (no fake progress).
- **Admin portal:** dark left sidebar with every section, Product desks nested, Analytics,
  Departments, Sign out; Daylight canvas; stat cards and card panels.

## 5. Rollout status

| Area | Status | Commit / note |
| --- | --- | --- |
| Tokens + `UI/Kit` | Done | phase 1 `a6234f1` |
| Welcome, Athlete HQ, role dashboard panels | Done | phase 1 |
| Sign-in, age card, gift sheet, fan headings, Activity | Done | phase 2 `4b2e5b6` |
| Admin portal shell, Local live cards, Spotlight, Vault, receipts | Done | phase 3 `a1b2e3e`, merged `77b1b26` |
| Highlights reel overlay (`ReelActionOverlay`) | Done | 48pt glass rail buttons, light Give button (neon after giving), pill athlete chip; logic untouched. |
| Profile (`AthleteProfileView`, hero details, stat row, menu) | Done | Segmented section control, ink sport chips, neutral cards and nav; violet accent retired on Profile. |
| Aura trading card, Crew strip | Done | Aura card kept (already the tiered collectible card); Join Crew is a jade tint action, not gold. |
| Drip, Beyond, Fan Zone, Sport Quiz | Done | Drip white cards (ember retired); Beyond shared styles; Fan Zone night hero, light cards, ink selection; Quiz buttons 48pt with soft lift. |
| Per-screen violet/cyan accents (settings sheets, stats, polls, inbox, friends, guardian forms, Rally, Filmer, owner peek, sponsor rail, live banner) | Done | Accents → jade primary, selected → ink, tints → mist jade. |
| Parent / Booster / Sponsor / Operator HQs | Done | 52pt primary actions, ink chips, jade tint secondary, 14pt controls (panels via `DashboardPanel`). |
| Expo `/admin` desks (shared `AdminControls`) | Done | Portal canvas/border tokens, card panels, 14pt-radius buttons and fields; desk logic unchanged. |
| Individual `/admin` desk layouts | Next | Spot-fix desks with their own styles. |
| Remaining modals in `MENU_STYLE_MAP` | Done (shared frame) | `useSheetFrame` / `MENU_METRICS` already give every sheet its radius and frame; individual primaries move as their sheets are touched. |

Owner of the rollout: DESIGN with ACCESSIBILITY review; each change follows the presentation-only
exemption in FEATURE_ADMIN_WORKFLOW unless it adds a capability.

## 5a. Intentional colour exceptions

These keep their own colours because the colour carries meaning, not decoration:

- **Sport Quiz gameplay** (`SportQuizRound`, `QuizFx`, `FunFactMoment`, `LearnSportCard`, trivia notice/preview): the owner-approved gold/violet game palette (QUIZ-04 fun presentation). Quiz *buttons* follow the plan.
- **Reaction identities**: Seki (cyan) and Riding (gold) counts and hype story pills.
- **Aura tiers, sponsor/booster tiers and hype effects** (`lib/aura.ts`, `data/sponsorships.ts`, `theme/hypeFx.ts`, glow borders).
- **Accent plumbing** (`UI/MenuChrome`, `UI/EmptyState`, `theme/motion.ts`) keeps the palette definitions so the exceptions above still work.

## 6. What is not imported from the prototype

These appear in the Lovable mockup but are not true in the app; do not ship them without their own
design, admin-first work and counsel review where noted:

- Invented metrics (badge progress bars, "+46 Crew this week", "verified by coach").
- "Your gift is on its way" (test-mode allocation is not a transfer; keep "recorded" wording).
- Texting a parent/guardian to approve gifts (guardian consent is counsel-gated).
- Vault "Unlock" opening the gift sheet (Vault uses the one-time Exclusive purchase).
- Any Lovable sample names, schools, prices or numbers.

## 7. Checklist for every screen change

1. Uses tokens and Kit components; no new hex values outside theme files.
2. All existing copy, notices, routes, accessibility labels and test IDs preserved.
3. 44pt targets, AA contrast, Reduce Motion respected; text scales without clipping at 320pt.
4. `pnpm check` under Node 24; view at 320 and 390 wide (and 1280 for the portal).
5. Record the change in `docs/STATE.md` §4 and `CHANGELOG.md`; update this table.
