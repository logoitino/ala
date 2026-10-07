# Tooling — MCP servers for UI/UX, builds and data

AI coding assistants (Claude Code, Codex) reach outside tools through **MCP servers**. The repo's
shared list is [`.mcp.json`](../../.mcp.json) at the root; Claude Code loads it when a session
starts **inside this repo** and asks once to approve the project servers. It holds no secrets —
hosted servers ask you to sign in (OAuth) the first time. Owner: `DESIGN_TOOLING` (reports to
`DESIGN`). Added 2026-10-07.

| Server | What it is for | Who uses it | Safety limits |
| --- | --- | --- | --- |
| `playwright` | Drive Chrome against Expo web (`pnpm mobile:web` or a static export): screenshots, narrow-width and large-text checks, click-through of flows. Evidence goes to `.playwright-mcp/` (git-ignored) and summaries to `AUDIT_REPORT.md`. | `VISUAL_QA`, `DESIGN`, `ACCESSIBILITY` | Local browser only. Web rendering is not native iOS/Android — `DEVICE_QA` still signs off native behaviour. |
| `expo` | Expo's hosted MCP: SDK 57 docs, EAS build and submission status, build logs, config checks. Our route to iOS/Android builds, since this Mac's Xcode cannot drive a Simulator. | `RELEASE`, `ENGINEERING`, `DEVICE_QA` | Starting builds or submissions spends the free EAS quota and publishes to testers — owner approval first (STATE §0 spend rule). |
| `canva` | Canva's hosted MCP: create and edit marketing and in-app visuals (store screenshots, tagline art, social posts). | `DESIGN`, `BRAND`, `MARKETING` | Draft assets only; nothing is published from the repo. Store copy follows `docs/product/VOICE.md`. |
| `supabase-dev` | Supabase's hosted MCP pinned to the **development** project with `read_only=true`: inspect tables, policies, logs and docs; generate types. | `BACKEND`, `DATABASE_MIGRATIONS`, `SHARED_CONTRACTS` | Read-only, development project only. Never point it at staging or production; schema changes still go through `supabase/migrations/` and review. |
| `figma` | Design files, components, variables and screenshots. | `DESIGN`, `DESIGN_TOOLING` | Configured per user, not in `.mcp.json` (on the owner's Mac it comes from Meta's managed tooling, and a project entry would shadow it). Dev Mode features are limited by the Figma seat. |

## First run (Claude Code)

1. Start Claude Code with the repo as the working directory: `cd ~/Downloads/ala-sports && claude`.
2. Approve the project MCP servers when asked (or later with `/mcp`).
3. In `/mcp`, sign in to `canva`, `expo` and `supabase-dev` (each opens a browser OAuth page).
   `playwright` needs no sign-in.
4. Figma for other teammates: `claude mcp add --transport http figma https://mcp.figma.com/mcp`
   (user scope), then sign in from `/mcp`.

**Codex** already has Playwright, Figma and Canva in `~/.codex/config.toml`; to add the others,
copy the `expo` and `supabase-dev` URLs from `.mcp.json` into `[mcp_servers.<name>]` entries.

## Notes for the owner's Mac

- `playwright` runs `@playwright/mcp@0.0.83` from the local npx cache with `--prefer-offline`,
  because `registry.npmjs.org` is blocked here (STATE §3); it uses the installed Google Chrome. On a
  normal laptop the same command downloads the package. Keep the version pinned so the cache keeps
  working; bump it on a machine with registry access.
- Hosted servers (`expo`, `canva`, `supabase-dev`, `figma`) answer through the corporate proxy
  (checked 2026-10-07: all reachable, sign-in required).
- An iOS build/simulator MCP such as XcodeBuildMCP needs npm and a full Xcode with Simulator.app;
  neither is available here, so iOS work goes through Expo/EAS builds and real devices.

## Not added (and why)

- **Stripe MCP** — payments stay in test mode and money code changes need owner + LEGAL review;
  add a test-mode, read-only key only when a task needs it.
- **Supabase staging/production** — never from an assistant; use the runbooks.
- **GitHub MCP** — pushing and merging need owner approval (readiness R1-02); add when the repo is
  on `main` with branch protection.
