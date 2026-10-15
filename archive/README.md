# archive/

Code and files kept for reference that are **not part of the product**. Nothing here is built,
tested, linted or deployed, and nothing in `apps/`, `packages/` or `supabase/` may import from it.

| Path | What it is | Archived |
| --- | --- | --- |
| `superseded-2026-10-15/` | The QUIZ-04 Life Playbook review machinery, removed before it was ever applied when the owner chose normal one-admin trivia approval and simple facts only (Life design §8): the CPA sign-off and named finance / tax reviewer tables, their functions and admin controls, source URL / tax-year / re-review / January-withdrawal / age-band helpers (one SQL excerpt), the client wrappers, desk panels and their tests. 44 registry entries in 10 files. | 2026-10-15 (QUIZ-04 owner simplification, owner approved) |
| `superseded-2026-10-14/` | The PRIV-01 guardian lock, replaced before it was ever applied by MINOR-01 supervision (owner 2026-10-14): the Parent HQ Lock / Unlock card and five draft database functions (`privacy_lock_active`, `guardian_get_privacy`, `guardian_set_privacy`, `admin_release_privacy_lock`, `audience_rank`). 6 registry entries in 6 files. | 2026-10-14 (MINOR-01, owner approved) |
| `dead-code-2026-10-13/` | Code nothing used, found by the data map and the unused-locals check: 62 unused exports (five of them made up four whole files: the old admin overview, the old admin charts, TelemetryCards and the old portal column chart), 15 private helpers only they used, 2 unused locals, the test cases that covered them, and the database function `get_aura_tier`. 84 registry entries in 47 files. Every entry, with its reason and owner approval: `docs/engineering/data-ownership.json` → `archived`. | 2026-10-13 (DATA-01-F5/F6, owner approved) |
| `my-app/` | Expo playground from before the monorepo (create-expo-app starter plus experiments). Outside the pnpm workspace. | 2026-10-07 (Phase 1 cleanup) |

## Naming rule (every archive pass)

1. **One folder per pass:** `archive/<what>-<YYYY-MM-DD>/`, for example `dead-code-2026-10-13/`.
2. **Same path as the code's former home** inside that folder, so it is obvious where it goes back.
   Database objects go in `sql/`, one file per object, named after the object.
3. **`.archived` before the extension:** `lib/finance.ts` becomes `lib/finance.archived.ts`,
   `reports.test.ts` becomes `reports.test.archived.ts`. An archived file can never be mistaken for a
   live file of the same name, and no test runner, compiler or `*.test.ts` glob picks it up.
4. **A three-line header** says the date, the finding, owner approval, whether it is a *whole file* or
   an *excerpt* (and which names), and how to restore it.
5. **A registry entry for every archived name** in `data-ownership.json` → `archived`, with `kind`
   (`whole file`, `export`, `helper`, `unused local`, `tests`, `database function`, `database table`), `to` (the archive
   path) and `reason`. `pnpm data:map:check` fails when an archive file has no entry, an entry points at
   a missing file, a file breaks rule 3 or 4, or live code imports from `archive/`.

Before deleting anything here, check with the owner. To bring something back, move the code to its real
home, drop `.archived` from the name, add it to the workspace and remove its registry entry.
