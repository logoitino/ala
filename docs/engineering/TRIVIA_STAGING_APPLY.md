# Trivia on staging: apply packet (QUIZ-01 to QUIZ-04)

Last updated: 2026-10-15. Written by `DATABASE_MIGRATIONS` with `POLLS`. The owner applies the SQL by hand
in the Supabase SQL Editor. Nothing here runs by itself. Cost: $0 (staging, Stripe test mode).

**Status:** nothing in this packet is applied anywhere yet. Staging (`ala-sports-staging`,
`tucioqipfejqqqtuakdi`) is recorded as having the September files from [STATE §0](../STATE.md) (applied
2026-09-30) and none of the October files ([STATE §5](../STATE.md)). This packet assumes nothing from October
is on staging; the "where am I" query in step 0 shows the real state.

Trivia needs privacy (PRIV-01) and minor accounts (MINOR-01) first, and those need a few earlier files. The
files must be pasted in this order (filename order, as the [migrations README](../../supabase/migrations/README.md)
requires). Three extra security fixes are included because the owner should apply them anyway.

## Before you start

1. **Backup.** Supabase dashboard → staging → Database → Backups. Staging is on the free plan, which has no
   daily backups and no point-in-time recovery ([ENVIRONMENTS_AND_HOSTING.md](ENVIRONMENTS_AND_HOSTING.md)).
   If no backup is listed, take a dump before step 1 with the staging connection string (Project Settings →
   Database), for example `pg_dump "<staging connection string>" --format=custom --file=staging-before-trivia.dump`.
   It contains tester data, so keep it in a private folder outside the repo and delete it once
   testing ends. If you cannot take a dump, say so in your report. Then the only way to undo a step is a reviewed
   forward fix ([RECOVERY_RUNBOOK.md](RECOVERY_RUNBOOK.md)).
2. **Right project.** The SQL Editor header must say `ala-sports-staging`. Never the development project
   (`ulfapgtabidorgwfjvwz`).
3. **Right build.** The phone build must point at staging (`npx eas-cli env:list --environment preview` shows
   `https://tucioqipfejqqqtuakdi.supabase.co`; [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md) §6). It also needs the
   2026-10-15 trivia app code. The 2026-10-11 preview builds in STATE §0 were made before trivia existed, so
   you need a new preview build (or the local app pointed at staging) before the in-app steps.
4. **Do not run `supabase db push`** against staging (STATE §0 item 10: not before the E1 baseline and
   `migration repair`). Paste each file into the SQL Editor instead.
5. **How to paste.** Open the file in a text editor, select all, copy, paste into a new SQL Editor tab, then
   Run. Then run that step's check in a new tab. If the result does not match **Expected**, stop and report it.
   The biggest file is about 190 KB (step 17). If the editor refuses it, report that. Do not split a file.
6. **Run each file once, in order.** Running the same file again straight away is safe; each header says
   so. Never re-run an *earlier* file after a later one:
   - QUIZ-01 or QUIZ-02 after a later quiz file would bring back older functions.
   - `20261014160000` after `20261014180000` stops on purpose with `quiz_rerun_after_quiz04`.
   - `20261014180000` after `20261015210000` stops on purpose with `quiz_rerun_after_quiz05`.
   - `20261014110000` (MINOR-01) after `20261015210000` stops on purpose with `minor01_rerun_after_quiz05`.
   - PRIV-01 after QUIZ-05 would drop the `fun_facts` audience default (re-apply step 17 after it).
   - MINOR-01 after QUIZ-03 would remove the trivia group count from the guardian summary.
   - Account tags or photo stories after PRIV-01 would replace the privacy-filtered functions.

   If a file stops with an error, copy the whole message and stop. Do not edit the SQL.
7. **Recording.** The README's optional `supabase_migrations.schema_migrations` record step applies only if
   `select to_regclass('supabase_migrations.schema_migrations');` returns a name. If it returns null (expected
   before the E1 baseline), skip recording. Instead, write down the time you ran each file.
8. The SQL Editor runs as `postgres`, so it counts as the database (admin). Guest / fan denials were proven in
   the Postgres replays, not on staging.

## Step 0: pre-flight (read-only)

Staging was built from the standalone `supabase/*.sql` files and the September migrations. These checks prove
the pieces the packet relies on are there. **Expected: every column `true`.** If any column is `false`, stop and
report it. In particular, `require_admin_guard` lives only in the 2026-09 audit section of `schema.sql`, and no
saved record says it is on staging.

```sql
select
  to_regprocedure('public.current_user_role()') is not null as current_user_role,
  to_regprocedure('public.require_admin_guard()') is not null as require_admin_guard,
  to_regprocedure('public.hash_secret(text)') is not null as hash_secret,
  to_regprocedure('public.custodial_role(uuid)') is not null as custodial_role,
  to_regclass('public.custodial_accounts') is not null as custodial_accounts,
  to_regclass('public.athlete_vouches') is not null as sept_payout_gate,
  to_regclass('public.donation_thanks') is not null as sept_rally,
  exists(select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'award_filmer_aura') as sept_filmer_rewards,
  exists(select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'sync_live_spotlight_awards') as spotlight_auto,
  to_regclass('public.crew_follows') is not null as crew_follows,
  to_regclass('public.reel_views') is not null as reel_views,
  to_regclass('public.disbursements') is not null as disbursements,
  to_regclass('public.app_runtime_config') is not null as app_runtime_config,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reels' and column_name = 'tag_status') as reels_tag_status,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'athlete_sport') as profiles_athlete_sport,
  exists(select 1 from pg_extension where extname = 'pgcrypto') as pgcrypto,
  exists(select 1 from storage.buckets where id = 'reels') as reels_bucket;
```

**Where am I.** This shows which steps are already done. Expected on an untouched staging: all `false`.
`s1_content_rights` may already be `true`, because the README records that file on staging on 2026-10-01. If so,
skip step 1. Any other `true` means someone applied part of this already: report it before continuing.

```sql
select
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reels' and column_name = 'attested_at') as s1_content_rights,
  to_regclass('public.reel_account_tags') is not null as s2_account_tags,
  to_regclass('public.reel_photos') is not null as s3_photo_stories,
  to_regprocedure('public.is_trusted_server()') is not null as s5_hardening,
  to_regclass('public.friendships') is not null as s8_priv01,
  to_regclass('public.reel_tag_rejections') is not null as s9_tag_approval,
  to_regclass('public.guardian_links') is not null as s10_minor01,
  to_regclass('public.sport_quiz_settings') is not null as s11_quiz01,
  to_regclass('public.sport_quiz_preferences') is not null as s12_quiz02,
  to_regclass('public.sport_quiz_round_items') is not null as s13_quiz03,
  to_regclass('public.sport_quiz_life_chapters') is not null as s15_quiz04;
```

## The ordered list

All paths are under `supabase/migrations/`. **Kind:** *Trivia* = the feature; *Prerequisite* = trivia cannot
work without it; *Security fix* = not needed by trivia, but the owner should apply it anyway. The "Needed by"
column names the function or table that proves the dependency (found by grep in the later file).

| # | File | What it does | Needed by (proof) | Kind | Reviewed / replayed |
| --- | --- | --- | --- | --- | --- |
| 1 | `20261001180000_content_rights_reports.sql` | Upload rights columns on clips and report reasons | Step 9 grants app inserts only on the `reels` columns that exist when it runs (`attested_at`, `rights_version`). If this came later, uploads would be refused | Prerequisite (skip if already on staging) | Recorded on staging 2026-10-01 (README, TEAMS). Inside the schema replay |
| 2 | `20261002160000_reel_account_tags.sql` | Mention up to three accounts on a Highlight | Step 8 calls `account_tag_label` in account search and replaces this file's `search_taggable_accounts`. Applying it after step 8 would undo the privacy filter | Prerequisite | Inside the schema replay only. WORK_QUEUE W0-08 two-user / concurrent-cap checks still pending |
| 3 | `20261007230000_photo_stories.sql` | Photo stories (`reels.media_type`, `photo_count`, `reel_photos`, `set_reel_photos`) | Step 8's `reels_feed` reads `media_type`, `photo_count` and `reel_photos`, so step 8 fails without it. Step 9 grants `media_type` | Prerequisite | UX-05a done locally (WORK_QUEUE). Inside the schema replay. The RLS_SECURITY + STORAGE review asked for in STATE §0 item 7 is not recorded as done |
| 4 | `20261007231000_reels_storage_owner_folder.sql` | `reels` uploads only into your own folder | Step 3 opens the bucket to photos. Without this, anyone signed in can overwrite another person's clip or photo (STATE §5, Wave 1 blocker) | **Security fix** | Writers audited 2026-10-07. Inside the schema replay. STORAGE + RLS_SECURITY review not recorded |
| 5 | `20261013210000_function_access_hardening.sql` | Guests can no longer write revenue rows, raise totals or Aura, or change admin settings. Adds `is_trusted_server()` | Steps 8, 9 and 10 call `is_trusted_server()` | Prerequisite and **security fix** | RLS_SECURITY approved; schema replay 35/35 ([DATA-01](../agents/DATA-01.md)) |
| 6 | `20261013220000_disbursements_guardian_scope.sql` | Only admins write payout rows; a paid payout is final | Not needed by trivia (needs step 5) | **Security fix** | RLS_SECURITY, CUSTODIAL, INTERNAL_CONTROLS approved; schema replay 35/35 ([DATA-01](../agents/DATA-01.md)) |
| 7 | `20261013230000_avatars_owner_folder.sql` | Profile photos only into your own folder; owners may delete their own | Not needed by trivia | **Security fix** | RLS_SECURITY approved after changes (README). Inside the schema replay |
| 8 | `20261014090000_profile_privacy.sql` | PRIV-01 stage 1: private accounts, friends, blocks, hide from search | Trivia calls `my_profile_id`, `are_friends`, `is_blocked_between`, `friendships`, `user_blocks`, `privacy_settings_json` | Prerequisite | RLS_SECURITY, PRIVACY_ENGINEERING, MINOR_SAFETY; schema replay 67/67 ([evidence](evidence/PRIV-01-admin.md)) |
| 9 | `20261014100000_tag_approval.sql` | PRIV-01 stage 2: tag approval and declines | Step 10's header needs it first. Step 10's "Closed accounts" policy covers only tables that exist when step 10 runs (`reel_tag_rejections`) | Prerequisite | Same reviews and evidence as step 8 |
| 10 | `20261014110000_minor_accounts.sql` | MINOR-01: birth month and year, guardian links, teen rules, "Closed accounts" on every RLS table | Trivia calls `profile_age_band`, `caller_not_age_blocked`, `is_minor_band`, `guardian_links`, `log_supervision_event`, `supervision_json`, `verified_player_of`, `first_name_of` | Prerequisite | MINOR_SAFETY, CUSTODIAL, PRIVACY_ENGINEERING, RLS_SECURITY; schema replay 100/100 ([evidence](evidence/MINOR-01-admin.md)). Consent form is a counsel draft (LEGAL row AA) |
| 11 | `20261014140000_sport_pop_quiz.sql` | QUIZ-01: quiz tables, settings (paused, no testers), admin review | — | Trivia | 34/34 actor replay ([QUIZ-01](../agents/QUIZ-01.md), [evidence](evidence/QUIZ-01-admin.md)) |
| 12 | `20261014150000_timed_sport_trivia.sql` | QUIZ-02: 30 / 90-second timed rounds, preferences, recovery, retention | Needs step 11 | Trivia | Timed replay 50/50 ([QUIZ-02](../agents/QUIZ-02.md), [evidence](evidence/QUIZ-02-admin.md)) |
| 13 | `20261014160000_trivia_play_together.sql` | QUIZ-03: rounds of up to five, question types, badges, family groups (off) | Needs steps 11 and 12. Uses `hash_secret` (September ladder) | Trivia | RLS_SECURITY + MINOR_SAFETY + PRIVACY approved; replay 59/59, timed + QUIZ-03 51/51 ([QUIZ-03](../agents/QUIZ-03.md), [evidence](evidence/QUIZ-03-admin.md)) |
| 14 | `20261014170000_trivia_starter_bank.sql` | 60 draft trivia questions | Needs `question_type` from step 13 | Trivia | Drafts only; an admin approves each one |
| 15 | `20261014180000_life_playbook.sql` | QUIZ-04: round kinds, Life Playbook (off), four closed chapters, levels | Needs steps 11 to 14 | Trivia | Approved (round 3); owner simplification 2026-10-15 re-recorded: Life replay 31/31 ([QUIZ-04](../agents/QUIZ-04.md), [evidence](evidence/QUIZ-04-admin.md)) |
| 16 | `20261014190000_life_playbook_bank.sql` | 40 draft Life questions (10 per chapter) | Needs the Life columns from step 15 | Trivia | Drafts only; `pnpm life:bank:check` |
| 17 | `20261015210000_trivia_fresh_questions.sql` | QUIZ-05: fun facts (`trivia.athlete_questions` off, share 0), answer shuffle, reports and auto-pause, quality flags, bulk import, Needs a look, refill forecast | Needs steps 8, 10 and 11 to 16 (`privacy_default_audience`, `guardian_approval_requests`, `quiz_life_normalize`, `quiz_admin_forecast`) | Trivia | RLS_SECURITY review 2026-10-15: changes needed, applied (probes now replay checks); fresh-questions replay 45/45; QUIZ-03 59/59, Life 39/39, schema 105/105 still pass. Re-review and MINOR_SAFETY, PRIVACY_ENGINEERING, VOICE, DATA_GOVERNANCE not yet recorded |

## Paste and check, one file at a time

Paste the file, Run, then paste its check. Every check is a read-only `select`.

**1. `20261001180000_content_rights_reports.sql`.** Skip if `s1_content_rights` was already `true`.
Expected: `true, true, true, true`.

```sql
select to_regclass('public.reel_reports') is not null as reel_reports,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reels' and column_name = 'attested_at') as attested_at,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reels' and column_name = 'rights_version') as rights_version,
  to_regprocedure('public.report_reel(uuid,text)') is not null as report_reel;
```

**2. `20261002160000_reel_account_tags.sql`.** Expected: `true, true, true`.

```sql
select to_regclass('public.reel_account_tags') is not null as reel_account_tags,
  to_regprocedure('public.account_tag_label(public.profiles)') is not null as account_tag_label,
  to_regprocedure('public.tag_reel_accounts(uuid,uuid[])') is not null as tag_reel_accounts;
```

**3. `20261007230000_photo_stories.sql`.** Expected: five `true`. The app's Photos option appears once this
is on. Do step 4 straight away.

```sql
select to_regclass('public.reel_photos') is not null as reel_photos,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reels' and column_name = 'media_type') as media_type,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reels' and column_name = 'photo_count') as photo_count,
  to_regprocedure('public.set_reel_photos(uuid,jsonb)') is not null as set_reel_photos,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reels_feed' and column_name = 'cover_path') as feed_cover_path;
```

**4. `20261007231000_reels_storage_owner_folder.sql`** (security fix). Expected: `owner_folder_policies = 2`.

```sql
select count(*) as owner_folder_policies from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('Public upload reels bucket', 'Public update reels bucket') and with_check like '%foldername%';
```

**5. `20261013210000_function_access_hardening.sql`** (security fix). Notices about skipped functions are
normal. Expected: `is_trusted_server = true`, `anon_can_write_revenue = false`.

```sql
select to_regprocedure('public.is_trusted_server()') is not null as is_trusted_server,
  has_function_privilege('anon', 'public.record_company_revenue(text,text,integer,text,uuid,text,timestamptz)', 'execute') as anon_can_write_revenue;
```

**6. `20261013220000_disbursements_guardian_scope.sql`** (security fix). Expected: `paid_final_trigger = 1`,
`old_parent_write_policy = 0`.

```sql
select (select count(*) from pg_trigger where tgname = 'disbursements_paid_final') as paid_final_trigger,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'disbursements'
     and policyname = 'Admin write disbursements') as old_parent_write_policy;
```

**7. `20261013230000_avatars_owner_folder.sql`** (security fix). Expected: `avatar_policies = 3`.

```sql
select count(*) as avatar_policies from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('Public upload avatars', 'Public update avatars', 'Owner delete avatars');
```

**8. `20261014090000_profile_privacy.sql`.** This file stops on purpose if staging has extra hand-made read
policies on `profiles` or `crew_follows`. If it does, report the message. Expected: four `true`,
`profiles_not_backfilled = 0`.

```sql
select to_regclass('public.friendships') is not null as friendships,
  to_regclass('public.user_blocks') is not null as user_blocks,
  to_regprocedure('public.is_blocked_between(uuid,uuid)') is not null as is_blocked_between,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_private') as account_private,
  (select count(*) from public.profiles where account_private is null) as profiles_not_backfilled;
```

**9. `20261014100000_tag_approval.sql`.** Expected: `true, true, true`.

```sql
select to_regclass('public.reel_tag_rejections') is not null as reel_tag_rejections,
  has_column_privilege('authenticated', 'public.reels', 'media_type', 'INSERT') as app_can_insert_media_type,
  has_column_privilege('authenticated', 'public.reels', 'attested_at', 'INSERT') as app_can_insert_attested_at;
```

**10. `20261014110000_minor_accounts.sql`.** Expected: four `true`, `rls_tables_missing_closed_accounts = 0`.

```sql
select to_regclass('public.guardian_links') is not null as guardian_links,
  to_regclass('public.supervision_events') is not null as supervision_events,
  to_regprocedure('public.caller_not_age_blocked()') is not null as caller_not_age_blocked,
  to_regprocedure('public.profile_age_band(uuid)') is not null as profile_age_band,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
                     and p.policyname = 'Closed accounts')) as rls_tables_missing_closed_accounts;
```

**11. `20261014140000_sport_pop_quiz.sql`.** Expected: four `true`, `enabled = false`, `testing_only = true`,
`testers = 0`.

```sql
select to_regclass('public.sport_quiz_questions') is not null as questions,
  to_regclass('public.sport_quiz_attempts') is not null as attempts,
  to_regclass('public.sport_quiz_badges') is not null as badges,
  to_regclass('public.sport_quiz_audit') is not null as audit,
  (select enabled from public.sport_quiz_settings) as enabled,
  (select testing_only from public.sport_quiz_settings) as testing_only,
  (select cardinality(pilot_accounts) from public.sport_quiz_settings) as testers;
```

**12. `20261014150000_timed_sport_trivia.sql`.** Expected: five `true`, `enabled = false`.

```sql
select to_regclass('public.sport_quiz_preferences') is not null as preferences,
  to_regclass('public.sport_quiz_exposures') is not null as exposures,
  to_regclass('public.sport_quiz_week_guards') is not null as week_guards,
  to_regclass('public.sport_quiz_requests') is not null as requests,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sport_quiz_attempts' and column_name = 'mode') as attempts_mode,
  (select enabled from public.sport_quiz_settings) as enabled;
```

**13. `20261014160000_trivia_play_together.sql`.** Expected: three `true`, `round_size = 5`, `groups_on = false`,
`images_on = false`.

```sql
select to_regclass('public.sport_quiz_round_items') is not null as round_items,
  to_regclass('public.sport_quiz_groups') is not null as groups,
  to_regclass('public.sport_quiz_group_cases') is not null as group_cases,
  (select round_size from public.sport_quiz_settings) as round_size,
  (select groups_enabled from public.sport_quiz_settings) as groups_on,
  (select images_enabled from public.sport_quiz_settings) as images_on;
```

**14. `20261014170000_trivia_starter_bank.sql`.** Expected: `starter_drafts = 60`.

```sql
select count(*) as starter_drafts from public.sport_quiz_questions
where status = 'draft' and reason like 'Starter draft (QUIZ-03)%';
```

**15. `20261014180000_life_playbook.sql`.** Expected: `chapters = 4`, `chapters_open = 0`, `levels = true`,
`life_on = false`.

```sql
select (select count(*) from public.sport_quiz_life_chapters) as chapters,
  (select count(*) from public.sport_quiz_life_chapters where open) as chapters_open,
  to_regclass('public.sport_quiz_levels') is not null as levels,
  (select life_enabled from public.sport_quiz_settings) as life_on;
```

**16. `20261014190000_life_playbook_bank.sql`.** Expected: four rows, `money_huddle`, `savings_season`,
`scam_defense`, `smart_plays`, each `drafts = 10`.

```sql
select chapter, count(*) as drafts from public.sport_quiz_questions
where topic_category = 'life' and status = 'draft' and reason like 'Life Playbook draft (QUIZ-04)%'
group by chapter order by chapter;
```

**17. `20261015210000_trivia_fresh_questions.sql`.** Expected: four `true`, `facts_on = false`, `share = 0`,
`reports_paused = false`, `fun_facts_default = friends`, `facts = 0`.

```sql
select to_regclass('public.quiz_athlete_facts') is not null as facts_table,
  to_regclass('public.sport_quiz_reports') is not null as reports_table,
  to_regprocedure('public.quiz_admin_import(jsonb,boolean,text,uuid)') is not null as import_rpc,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sport_quiz_round_items' and column_name = 'shown_order') as shown_order,
  (select athlete_questions_enabled from public.sport_quiz_settings) as facts_on,
  (select athlete_share_pct from public.sport_quiz_settings) as share,
  (select reports_paused from public.sport_quiz_settings) as reports_paused,
  public.privacy_default_audience() ->> 'fun_facts' as fun_facts_default,
  (select count(*) from public.quiz_athlete_facts) as facts;
```

**Final check (after step 17).** Expected:
- `rls_tables_without_closed_accounts` is empty (null). QUIZ-02's four tables (`sport_quiz_exposures`,
  `sport_quiz_preferences`, `sport_quiz_requests`, `sport_quiz_week_guards`) did not get the "Closed accounts" policy
  when this packet was first dry-run. Step 15 (`20261014180000_life_playbook.sql` §21) now adds it to every RLS-enabled
  `sport_quiz_*` table that lacks it, and the Life replay checks this. Any other table listed here was created after
  MINOR-01 by a file outside this packet; report it to `RLS_SECURITY`.
- `quiz_functions_guests_can_call = 0` and `quiz_table_grants_to_clients = 0`.

```sql
select
  (select string_agg(c.relname, ', ' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
                     and p.policyname = 'Closed accounts')) as rls_tables_without_closed_accounts,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'quiz\_%'
     and has_function_privilege('anon', oid, 'execute')) as quiz_functions_guests_can_call,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and (table_name like 'sport\_quiz\_%' or table_name = 'quiz_athlete_facts') and grantee in ('anon', 'authenticated')) as quiz_table_grants_to_clients;
```

## Rollback

There are no drop scripts in this packet, and none should be written on the spot.

- **Steps 1, 2, 4 and 7** carry exact rollback SQL in their file headers. For step 4 and step 7, that rollback
  reopens the overwrite hole.
- **Step 6:** the header says how, and advises against it, because it reopens every family's payout rows.
- **Step 3:** the header lists an ordered rollback. It rebuilds `reels_feed`, so it only fits before step 8.
  After step 8 it would undo the privacy feed.
- **Steps 5, 8, 9 and 10:** the headers describe the rollback as restoring earlier definitions and grants from
  `schema.sql` history. That needs `DATABASE_MIGRATIONS`, so ask rather than improvise. Step 5's rollback
  reopens the revenue-write hole.
- **Trivia, steps 11 to 16:** the headers say pause first. Settings stay off (`enabled`, groups, Life, images).
  Keep the records and fix forward. Steps 14 and 16 header lines delete only their own untouched drafts.
- If a step breaks staging and the header note does not cover it, restore from the backup taken before step 1.

## Skipped on purpose

None of these are needed by trivia (grep: no trivia file uses their tables or functions). They stay unapplied
unless their owners ask for them.

| File | Why skipped | If applied later |
| --- | --- | --- |
| `20261002120000_operator_checkins_role_check.sql` | Operator check-ins only | Independent; any time |
| `20261007211500_public_profile_sport.sql` | Step 8 rebuilds `profiles_public` and already includes `athlete_sport` | **Never apply it after step 8.** It would replace the privacy view |
| `20261012180000_admin_reports_bigint_and_donation_bands.sql` | Admin reports only | Independent |
| `20261012210000_bookkeeping_ledger.sql` | Books has its own packet ([BOOKS01_STAGING_REHEARSAL.md](BOOKS01_STAGING_REHEARSAL.md)) | Its five tables would miss the "Closed accounts" policy, because step 10 adds it only to tables that already exist. To rehearse Books in the same session, paste it between steps 7 and 8 (after step 5, as its packet says). Otherwise ask `DATABASE_MIGRATIONS` for a forward fix first |
| `20261013120000_data_governance_closures.sql` | Admin desks only | Independent |
| `20261013190000_engineering_support.sql` | Needs Books; support desk only | Same "Closed accounts" gap as Books; paste it right after Books, before step 8 |
| `20261013231000_family_share_in_received.sql` | Family money display only | Independent |
| `20261014120000_payee_verification.sql` | Payouts only | Adds its own "Closed accounts" policy; after step 10 any time |
| `20261014130000_fan_zone.sql` | Fan Zone pilot. QUIZ-01's header says "ordered after FUN-01", but no quiz file uses a Fan Zone table or function | After step 10 any time. The Fan Zone desk shows "not switched on" until then |
| `20261015200000_admin_report_range.sql` | Admin reports only | Independent |

## After the SQL: in the app

Use a build that has the trivia code and points at staging (Before you start, item 3).

1. **Open the main admin → Trivia** (sidebar: Operations → Trivia). The "Trivia status" panel should say
   paused, with 60 sports drafts and 40 Life drafts waiting. Type a short **Review or correction reason** at
   the top, for example "Staging test". Settings changes are refused without one.
2. **Add yourself as a tester in Settings.** Your profile ID (read-only lookup in the SQL Editor):
   `select p.id from public.profiles p join auth.users u on u.id = p.user_id where u.email = '<your email>';`
   Paste it into **Tester profile IDs**, then press **Enable for listed testers**. It stays "testing only";
   that cannot be turned off. Up to 100 testers.
3. **Review drafts in "Drafts to review".** Check each fact and approve the good ones. For every Life chapter
   you want open, approve at least 5 of its questions. The chapter then shows ready: press **Open <chapter>**
   in the Life Playbook panel.
4. **Switches, if wanted.** In Settings, **Groups (trivia.groups)** On and **Life Playbook (trivia.life)** on.
   Images stay off (locked; image delivery is not built).
5. **Play a round on a phone.** Sign in as a tester and open Sport Pop Quiz (Home or `/sport-quiz`). Accept the
   notice, choose 30 or 90 seconds, and play a round of five. If Life is on, try a Life round. If groups are
   on, try a family group with a second test account.

## What to report back

- The step 0 results and each step's check output (a screenshot or pasted text is fine). Mark any that did
  not match **Expected**.
- Any error message, copied whole, with the step number. Say whether you could take the backup.
- From the app: screenshots of Trivia status, Drafts to review after approving, Settings with you as a
  tester, and the phone round (question, result, badge). Note anything that looked wrong or slow.
- Record the results in [QUIZ-04](../agents/QUIZ-04.md) (or hand them to `POLLS` to record).

## Known limits

- **Native sound is not built.** Phones get haptics only. Sound waits for `expo-audio`, which cannot be
  installed while the package registry is blocked ([QUIZ-04](../agents/QUIZ-04.md)).
- **Hosted state is unverified.** Every result above comes from Postgres replays on PGlite. Nobody has queried
  staging for this packet, and the step 0 checks are the first real look. Supabase-only behaviour (Storage,
  default grants, the gateway) was imitated by the replay stubs, not proven.
- Steps 2, 3 and 4 still have open owner-side checks (W0-08 two-user tests; RLS_SECURITY + STORAGE review of
  photo stories and the owner-folder policy). Applying them on staging is how those checks get run. The consent
  form behind MINOR-01 is a counsel draft: do not show it to real families.
- Group notices, retention and the counsel review of trivia for minors remain open (QUIZ-02 / QUIZ-03).

## How this order was checked

- The order follows the [migrations README](../../supabase/migrations/README.md) (filename order) and each
  file's header (`Needs:` / `Requires:` / `Apply after`). It is the same order `schema.sql` uses, with the
  skipped files left out.
- `node scripts/replay/schema-replay.mjs /tmp/books01-pg/pkg/package/dist` (whole `schema.sql`): **105/105**
  on 2026-10-15 (PGlite, Postgres 18.6). Trivia replays the same day: QUIZ-01 34/34, timed 50/50, timed + QUIZ-03
  51/51, QUIZ-03 59/59, Life 38/38. All of these build the whole `schema.sql`.
- **Packet dry run** (2026-10-15, scratch script outside the repo). The base was `schema.sql` up to the first
  October block (standalone files plus September). The 16 files were then applied as pasted here, in this
  order, with each check run after its step. Every file applied, and every check returned the **Expected**
  value above. Re-running `20261014160000` alone at the end stopped with `quiz_rerun_after_quiz04` as designed.
