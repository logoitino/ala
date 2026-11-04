<!-- Owner-only Wave 0 leftovers: artifact prune, staging smoke, Android EAS, counsel/SQL, R1-02/R1-03. -->
# Owner actions 1–5 — Wave 0 leftovers (2026-11-03)

Agent tokens cannot complete these alone (artifact DELETE / branch protection → 403; no
staging `.env.local` or Supabase access token in this environment). This page is the exact
checklist. Prices: prune / protection / counsel review routing are not Wave 0 product spend;
Android preview and `4242` gifts are **$0** on free Expo/Stripe test quotas.

**Agent progress (2026-11-03 America/Denver):**

| # | Item | Status |
| --- | --- | --- |
| 1 | Prune exit-source artifacts | Workflow on `main` + **weekly Sunday schedule** (keep 3). ~30 left. Immediate prune still needs owner **Run workflow** (agent dispatch/DELETE → 403). |
| 2 | Staging smoke | Still blocked here (no `apps/mobile/.env.local`). Owner runs [TESTER_SCRIPT](TESTER_SCRIPT.md). |
| 3 | Android EAS preview | Build `03e28f4e` **FINISHED** (~3:59 PM America/Denver, **$0** Free). APK: https://expo.dev/artifacts/eas/gHK7JkOq4LnlNN_lcUmMBZxmY6-CqFpszt8cTbxATzA.apk |
| 4 | Counsel + SQL apply | Packet ready; **owner engages counsel** and applies SQL. Agent will not invent conclusions or `db push`. |
| 5 | R1-02 / R1-03 | Protection GET/PUT → 403. Owner sets branch protection; private legal/company move when destination named. |

## 1. Prune exit-source Actions artifacts

**Why:** Portable Exit CI fails with `Artifact storage quota has been hit` (~108 artifacts).

**Do one of:**

1. **Immediate — run the workflow** (already on `main`; also scheduled Sundays 06:17 UTC keep 3):  
   GitHub → Actions → **Prune Exit Source Artifacts** → Run workflow → keep `3`.  
   Needs `actions: write` on the default `GITHUB_TOKEN` (workflow already requests it). Agent
   tokens cannot `workflow_dispatch` this (403).
2. **Dashboard:** Settings → Actions → Artifacts → delete old `exit-source-*` rows; keep newest 3.
3. **CLI (owner PAT with `actions: write`):**

```bash
# Keep newest 3 exit-source artifacts; delete the rest
gh api repos/logoitino/ala/actions/artifacts --paginate \
  --jq '[.artifacts[] | select(.name|test("^exit-source-"))] | sort_by(.created_at) | .[:-3][].id' \
| while read -r id; do gh api -X DELETE "repos/logoitino/ala/actions/artifacts/$id"; done
```

Also: exit-source artifact **retention** is shortened to **7 days** in
`.github/workflows/exit-release.yml` so free quota recovers faster.

## 2. Staging smoke (sign-in → upload → `4242` gift)

**Spend:** $0 (Stripe test). Script: [TESTER_SCRIPT.md](TESTER_SCRIPT.md) · [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md).

1. Confirm the installed preview / Expo web points at **`ala-sports-staging`** (not development).
2. Sign in with email / Demo Fan (`demo@tapuai.app` until production env).
3. Upload a short Highlight (≤45s / 8 MiB) or use a fixture from the tester script.
4. Give with card `4242 4242 4242 4242`; any future expiry / CVC.
5. Record build id, project ref, and result in STATE §4.

**Do not** enable webhook tip crediting while the client still inserts `tips`.

## 3. Android EAS preview (quota reset after 2026-11-01)

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile preview --non-interactive
```

Agent resubmitted after Free quota reset: `03e28f4e` **FINISHED** (~3:59 PM America/Denver,
**$0** Free). APK:
https://expo.dev/artifacts/eas/gHK7JkOq4LnlNN_lcUmMBZxmY6-CqFpszt8cTbxATzA.apk
Prior finished Android was `42e81674` (pre–Profile/age UX). iOS preview `09de0497` already
FINISHED. If Expo Free Android quota is exhausted again, stop — do not buy a paid plan without
an explicit owner spend decision (Wave 0 budget).

## 4. Counsel packet + SQL apply

**Counsel (owner engages):** [GIFT_RELEASE_COUNSEL_PACKET.md](../legal/GIFT_RELEASE_COUNSEL_PACKET.md)
+ guardian draft + store draft. No agent may invent legal conclusions or send the packet without
owner approval of recipients.

**SQL apply (owner only):** use staging/development dashboards or an authorized CLI. Never
`db push` from CI or an agent session without that approval. Reading order:

1. [GIFT_TIP_ROLLOUT.md](GIFT_TIP_ROLLOUT.md) / COORD-02 — tip / no-cut migration status  
2. [DEV_DATABASE_CATCHUP.md](DEV_DATABASE_CATCHUP.md) — what already landed where  
3. New unapplied migrations under `supabase/migrations/` — apply in filename order on the
   intended project only after counsel/COORD-02 rows that require them are decided  

Payouts stay **503**. Webhook tip crediting stays **off** until the client `tips` insert is retired.

## 5. R1-02 branch protection + R1-03 private legal/company docs

From [CODE_ORGANIZATION_PLAN.md](CODE_ORGANIZATION_PLAN.md) R1 checklist.

### R1-02 — protect `main`

Owner (admin) in GitHub → Settings → Branches → Add rule for `main`:

- Require a pull request before merging  
- Require status checks to pass: **Tapuai Team Quality Checks** / `build-and-check`  
- (Optional) Require conversation resolution; restrict who can push  

Example API (owner PAT with admin):

```bash
gh api -X PUT repos/logoitino/ala/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["build-and-check"]}' \
  -F enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":0}' \
  -F restrictions=null \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

(Adjust contexts to match the exact check name shown on a green `main` run.)

### R1-03 — private `docs/legal/` + `docs/company/`

**Before** granting anyone outside the company repo access: move those trees to a private repo
or shared drive and leave pointers in-repo (stubs that link to the private home). Do **not**
delete history without a backup. Agent will not relocate counsel packets until the owner names
the destination.

Until then, the repo stays **private** (`visibility: private`); R1-03 is the extra step for
external reviewers.
