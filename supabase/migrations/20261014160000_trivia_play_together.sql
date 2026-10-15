-- QUIZ-03: trivia play together — rounds of up to five with Next recovery, question types, badges, season recap
-- and family groups. Local source only; not applied anywhere. Requires QUIZ-01, QUIZ-02, MINOR-01 and PRIV-01.
-- Design: docs/engineering/design/TRIVIA_PLAY_TOGETHER_DESIGN.md (§9 overrides §1–§7).
-- Owner: POLLS (with BACKEND, DATABASE_MIGRATIONS, AURA for badges, ADMIN); reviews MINOR_SAFETY, PRIVACY_ENGINEERING,
--   RLS_SECURITY, CONTENT_RIGHTS, SUPPORT, QA, DATA_GOVERNANCE.
-- What it adds:
--   1. sport_quiz_round_items: the attempt stays the weekly round; each item has its own server deadline. Round state
--      'between' (round_state column, attempt status stays 'issued') carries next_by = item close + 2 minutes.
--   2. quiz_next: exact recovery by request UUID + expected position + the round's session secret; a replay returns
--      the same item only before its deadline. Start and Next refuse a round that cannot finish before the UTC week.
--   3. Per-item void; a completed round = at least one committed, non-void answer. Badges are unique per
--      (profile, label, period): Trivia Explorer (week), "<Sport> Explorer" (5 facts, lifetime), Family Challenger
--      (week played while in a group), Season Learner (10 rounds in a calendar quarter). Opt-in group visibility.
--   4. question_type choice4 | true_false | image_choice; 2–4 options; answer bound by the option count; image rights
--      fields (≤ 300 KB, no person). image_choice approval refused while trivia.images is off; images are never drawn
--      (no bucket, no delivery in this build). Bank cap 300 counting draft + approved only; per-sport forecast.
--   5. Groups: preset names, members, hashed 8-character codes (7 days), join attempts, group-week shared sets drawn
--      without reading exposures (private replacements), audited case/report log, admin case view and removal,
--      switch trivia.groups. MINOR-01 teen rules both ways and PRIV-01 blocks on every join; a block removes the
--      blocked party. Guardian supervision gains "trivia_groups" and joined / left events (counts only).
--   6. Erasure covers group participation, sets of dissolved groups and every badge (join attempts stay for their
--      35 days so limits and refusal evidence survive); retention purges codes, sets, join attempts and closed groups;
--      a deleted creator hands the group to the oldest member or it dissolves.
--   Security review (RLS_SECURITY + MINOR_SAFETY + PRIVACY, 2026-10-14) applied: teen rules are re-checked after an
--   age correction, a setting change, an unfriend, an ended guardian link and lazily on group reads/starts (birthdays);
--   a closed (under-13) account leaves every group and never shows; erasure keeps join attempts; group fact totals are
--   hidden below 3 players and rounded; member_ref is an opaque per-group reference; admin-closed groups show no
--   members; codes use pgcrypto random bytes; image rights need a second admin's review plus marks/EXIF attestations.
-- Access: RPC-only (no table grants), "Closed accounts" restrictive policy on every new table, explicit revokes on every
--   function, pinned search_path. Lock order: settings → group → account → attempt; advisory lock per group for sets.
-- Re-run: idempotent on its own before QUIZ-04 (add column if not exists; create table if not exists; drop/add named
--   constraints; create or replace; widened checks NOT VALID). After QUIZ-04 (20261014180000) it must NOT be re-run alone:
--   it would replace QUIZ-04 functions and grants, so it stops with quiz_rerun_after_quiz04. schema.sql re-applies it
--   together with QUIZ-04 (it sets quiz.full_schema around the QUIZ blocks).
-- Rollback: pause (enabled=false, groups off); retain records; reviewed forward migration. Never drop history blindly.

-- 0. Stop a lone re-run after QUIZ-04 (see header) ---------------------------------------------------------------------
do $$ begin
  if to_regclass('public.sport_quiz_life_chapters') is not null and coalesce(current_setting('quiz.full_schema',true),'') <> 'on' then
    raise exception 'quiz_rerun_after_quiz04: 20261014160000_trivia_play_together.sql must not be re-run alone after QUIZ-04; re-apply schema.sql or write a reviewed forward migration';
  end if;
end $$;

-- 1. Settings: round size and the two switches -------------------------------------------------------------------
alter table public.sport_quiz_settings add column if not exists round_size integer not null default 5;
alter table public.sport_quiz_settings drop constraint if exists quiz_round_size_range;
alter table public.sport_quiz_settings add constraint quiz_round_size_range check (round_size between 1 and 5);
alter table public.sport_quiz_settings add column if not exists groups_enabled boolean not null default false;
alter table public.sport_quiz_settings add column if not exists images_enabled boolean not null default false;

-- 2. Question types and image rights fields --------------------------------------------------------------------------
alter table public.sport_quiz_questions add column if not exists question_type text not null default 'choice4';
alter table public.sport_quiz_questions add column if not exists media_path text;
alter table public.sport_quiz_questions add column if not exists media_licence text;
alter table public.sport_quiz_questions add column if not exists media_source text;
alter table public.sport_quiz_questions add column if not exists media_attribution text;
alter table public.sport_quiz_questions add column if not exists media_alt_text text;
alter table public.sport_quiz_questions add column if not exists media_size_bytes integer;
alter table public.sport_quiz_questions add column if not exists media_has_person boolean;
alter table public.sport_quiz_questions add column if not exists media_reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.sport_quiz_questions add column if not exists media_reviewed_at timestamptz;
alter table public.sport_quiz_questions add column if not exists media_no_marks boolean;
alter table public.sport_quiz_questions add column if not exists media_exif_stripped boolean;
alter table public.sport_quiz_questions drop constraint if exists sport_quiz_questions_options_check;
alter table public.sport_quiz_questions drop constraint if exists quiz_question_type_check;
alter table public.sport_quiz_questions add constraint quiz_question_type_check check (question_type in ('choice4','true_false','image_choice'));
alter table public.sport_quiz_questions drop constraint if exists quiz_options_shape;
alter table public.sport_quiz_questions add constraint quiz_options_shape check (jsonb_typeof(options) = 'array'
  and jsonb_array_length(options) between 2 and 4 and correct_option < jsonb_array_length(options));
alter table public.sport_quiz_questions drop constraint if exists quiz_question_type_shape;
alter table public.sport_quiz_questions add constraint quiz_question_type_shape check (case question_type
  when 'choice4' then jsonb_array_length(options) = 4
  when 'true_false' then options = '["True","False"]'::jsonb
  else jsonb_array_length(options) between 2 and 4 end);
alter table public.sport_quiz_questions drop constraint if exists quiz_media_fields;
alter table public.sport_quiz_questions add constraint quiz_media_fields check (
  (question_type <> 'image_choice' and media_path is null and media_licence is null and media_source is null and media_attribution is null
    and media_alt_text is null and media_size_bytes is null and media_has_person is null and media_no_marks is null and media_exif_stripped is null)
  or (question_type = 'image_choice' and media_path ~ '^[a-z0-9][a-z0-9_/-]{0,150}\.(jpg|jpeg|png|webp)$'
    and media_licence in ('owned','cc0','cc_by','licensed','public_domain')
    and char_length(btrim(media_source)) between 3 and 300 and char_length(btrim(media_attribution)) between 2 and 200
    and char_length(btrim(media_alt_text)) between 10 and 250 and media_size_bytes between 1 and 307200 and media_has_person = false
    and media_no_marks = true and media_exif_stripped = true));

-- 3. Groups ------------------------------------------------------------------------------------------------------------
create table if not exists public.sport_quiz_groups (
  id uuid primary key default gen_random_uuid(),
  name_key text not null check (name_key in ('family','friends','team_fans','cousins','game_day_crew','home_team')),
  theme_sport text check (theme_sport is null or char_length(btrim(theme_sport)) between 2 and 80),
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  create_request_id uuid,
  created_at timestamptz not null,
  status text not null default 'active' check (status in ('active','closed')),
  closed_at timestamptz,
  close_reason text check (close_reason in ('dissolved','admin_removed')),
  codes_issued integer not null default 0 check (codes_issued >= 0),
  -- Private per-group salt for opaque member references; never returned by any RPC.
  ref_salt text not null default replace(gen_random_uuid()::text,'-',''),
  check ((status = 'closed') = (closed_at is not null and close_reason is not null))
);
create unique index if not exists quiz_group_create_request on public.sport_quiz_groups(create_request_id) where create_request_id is not null;
create index if not exists quiz_group_owner on public.sport_quiz_groups(owner_id, status);

create table if not exists public.sport_quiz_group_members (
  group_id uuid not null references public.sport_quiz_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','removed')),
  joined_at timestamptz not null,
  removed_at timestamptz,
  -- creator / blocked / admin bar rejoining; teen_rule (rules changed) and closed (under-13 closure) do not.
  removed_reason text check (removed_reason in ('creator','blocked','admin','teen_rule','closed')),
  primary key (group_id, profile_id),
  check ((status = 'removed') = (removed_at is not null and removed_reason is not null))
);
create index if not exists quiz_group_member_profile on public.sport_quiz_group_members(profile_id, status);

create table if not exists public.sport_quiz_group_codes (
  group_id uuid primary key references public.sport_quiz_groups(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);
create index if not exists quiz_group_code_expiry on public.sport_quiz_group_codes(expires_at);

create table if not exists public.sport_quiz_group_join_attempts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.sport_quiz_groups(id) on delete set null,
  outcome text not null check (outcome in ('joined','wrong_code','refused')),
  refusal_reason text check (refusal_reason in ('teen_rule','blocked','full','removed','closed')),
  created_at timestamptz not null,
  prune_after timestamptz not null,
  check ((outcome = 'refused') = (refusal_reason is not null)),
  check (prune_after = created_at + interval '35 days')
);
create index if not exists quiz_group_join_recent on public.sport_quiz_group_join_attempts(profile_id, created_at desc);
create index if not exists quiz_group_join_prune on public.sport_quiz_group_join_attempts(prune_after);

create table if not exists public.sport_quiz_group_sets (
  group_id uuid not null references public.sport_quiz_groups(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  position smallint not null check (position between 1 and 5),
  question_key uuid not null,
  question_id uuid not null references public.sport_quiz_questions(id),
  created_at timestamptz not null,
  prune_after timestamptz not null,
  primary key (group_id, week_start, position),
  check (prune_after > created_at)
);
create index if not exists quiz_group_sets_prune on public.sport_quiz_group_sets(prune_after);

-- Audited safety record. No foreign key on group_id: the record survives the group's retention purge.
create table if not exists public.sport_quiz_group_cases (
  id bigint generated always as identity primary key,
  group_id uuid not null,
  kind text not null check (kind in ('report','admin_view','admin_removal','admin_close','member_removed','blocked_removed','rule_removed','account_closed','handover','dissolved')),
  actor_id uuid references public.profiles(id) on delete set null,
  subject_id uuid references public.profiles(id) on delete set null,
  reason_code text check (reason_code is null or reason_code in ('safety','unwanted_contact','name_or_theme','other','creator','blocked','admin','teen_rule','closed')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null
);
create index if not exists quiz_group_cases_group on public.sport_quiz_group_cases(group_id, id desc);
create index if not exists quiz_group_cases_kind on public.sport_quiz_group_cases(kind, created_at desc);

-- 4. Rounds: the attempt is the round; items carry per-question deadlines -------------------------------------------
alter table public.sport_quiz_attempts drop constraint if exists sport_quiz_attempts_mode_check;
alter table public.sport_quiz_attempts add constraint sport_quiz_attempts_mode_check check (mode in ('legacy','timed','round'));
alter table public.sport_quiz_attempts add column if not exists round_state text check (round_state in ('item','between'));
alter table public.sport_quiz_attempts add column if not exists position smallint;
alter table public.sport_quiz_attempts add column if not exists planned_items smallint;
alter table public.sport_quiz_attempts add column if not exists round_size smallint;
alter table public.sport_quiz_attempts add column if not exists next_by timestamptz;
alter table public.sport_quiz_attempts add column if not exists topic_category text;
alter table public.sport_quiz_attempts add column if not exists sport_filter text;
alter table public.sport_quiz_attempts add column if not exists group_id uuid references public.sport_quiz_groups(id) on delete set null;
-- QUIZ-01's unnamed single-question shape checks are rescoped to the legacy/timed modes.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.sport_quiz_attempts'::regclass and contype = 'c'
    and conname not like 'quiz\_%' and pg_get_constraintdef(oid) like '%question_id IS NOT NULL%' loop
    execute format('alter table public.sport_quiz_attempts drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.sport_quiz_attempts drop constraint if exists quiz_completed_shape;
alter table public.sport_quiz_attempts add constraint quiz_completed_shape check (mode = 'round' or status <> 'completed'
  or (question_id is not null and answered_option is not null and request_id is not null and completed_at is not null));
alter table public.sport_quiz_attempts drop constraint if exists quiz_issued_shape;
alter table public.sport_quiz_attempts add constraint quiz_issued_shape check (mode = 'round' or status <> 'issued' or question_id is not null);
alter table public.sport_quiz_attempts drop constraint if exists quiz_round_shape;
alter table public.sport_quiz_attempts add constraint quiz_round_shape check (mode <> 'round' or (
  question_id is null and duration_seconds is not null and started_at is not null and expires_at is not null
  and topic_category in ('sport','science','geography','general')
  and round_size between 1 and 5 and planned_items between 1 and round_size and position between 1 and planned_items
  and status in ('issued','completed','ended','expired','void')
  and (status = 'issued') = (round_state is not null)
  and (round_state is distinct from 'between' or next_by is not null)
  and (status <> 'issued' or session_hash is not null))) not valid;
alter table public.sport_quiz_attempts drop constraint if exists quiz_round_only_columns;
alter table public.sport_quiz_attempts add constraint quiz_round_only_columns check (mode = 'round'
  or (round_state is null and position is null and planned_items is null and next_by is null and group_id is null));
create index if not exists quiz_attempt_group on public.sport_quiz_attempts(group_id, week_start) where group_id is not null;

create table if not exists public.sport_quiz_round_items (
  attempt_id uuid not null references public.sport_quiz_attempts(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  question_id uuid not null references public.sport_quiz_questions(id),
  question_key uuid not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  answered_option smallint check (answered_option between 0 and 3),
  answered_at timestamptz,
  answer_request_id uuid,
  next_request_id uuid,
  status text not null check (status in ('issued','answered','expired','ended','void')),
  closed_at timestamptz,
  voided_at timestamptz,
  correction_reason text,
  primary key (attempt_id, position),
  check (expires_at > issued_at),
  check (status <> 'answered' or (answered_option is not null and answered_at is not null and answered_at <= expires_at)),
  check ((status = 'void') = (voided_at is not null)),
  check (status = 'issued' or closed_at is not null)
);
create index if not exists quiz_round_items_question on public.sport_quiz_round_items(question_id);

-- 5. Badges: unique per (profile, label, period) ----------------------------------------------------------------------
alter table public.sport_quiz_badges add column if not exists period text;
alter table public.sport_quiz_badges add column if not exists kind text;
alter table public.sport_quiz_badges add column if not exists sport text;
update public.sport_quiz_badges set period = week_start::text where period is null;
update public.sport_quiz_badges set kind = 'weekly' where kind is null;
alter table public.sport_quiz_badges alter column period set not null;
alter table public.sport_quiz_badges alter column kind set not null;
alter table public.sport_quiz_badges alter column attempt_id drop not null;
alter table public.sport_quiz_badges alter column week_start drop not null;
alter table public.sport_quiz_badges drop constraint if exists sport_quiz_badges_attempt_id_key;
alter table public.sport_quiz_badges drop constraint if exists sport_quiz_badges_profile_id_week_start_key;
create unique index if not exists quiz_badge_unique on public.sport_quiz_badges(profile_id, label, period);
create index if not exists quiz_badge_attempt on public.sport_quiz_badges(attempt_id);
alter table public.sport_quiz_badges drop constraint if exists sport_quiz_badges_label_check;
alter table public.sport_quiz_badges drop constraint if exists quiz_badge_label;
alter table public.sport_quiz_badges add constraint quiz_badge_label check (
  (kind = 'weekly' and label in ('Sport Learner','Trivia Explorer') and attempt_id is not null and sport is null)
  or (kind = 'family' and label = 'Family Challenger' and attempt_id is null and sport is null)
  or (kind = 'season' and label = 'Season Learner' and attempt_id is null and sport is null and period ~ '^[0-9]{4}-Q[1-4]$')
  or (kind = 'sport' and sport is not null and label = sport || ' Explorer' and attempt_id is null and period = 'lifetime')) not valid;
alter table public.sport_quiz_badges drop constraint if exists sport_quiz_badges_visibility_check;
alter table public.sport_quiz_badges drop constraint if exists quiz_badge_visibility;
alter table public.sport_quiz_badges add constraint quiz_badge_visibility check (visibility in ('private','groups'));

-- QUIZ-02 inserts name only (profile, attempt, week, label); fill the new columns for those rows.
create or replace function public.quiz_badge_defaults()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.kind := coalesce(new.kind, case when new.label in ('Sport Learner','Trivia Explorer') then 'weekly' end);
  new.period := coalesce(new.period, new.week_start::text);
  return new;
end $$;
drop trigger if exists quiz_badge_defaults on public.sport_quiz_badges;
create trigger quiz_badge_defaults before insert on public.sport_quiz_badges for each row execute function public.quiz_badge_defaults();

-- 6. Requests and supervision vocabulary ------------------------------------------------------------------------------
alter table public.sport_quiz_requests drop constraint if exists sport_quiz_requests_operation_check;
alter table public.sport_quiz_requests add constraint sport_quiz_requests_operation_check
  check (operation in ('preferences','invitation','start','answer','end','skip','next'));
alter table public.sport_quiz_audit drop constraint if exists sport_quiz_audit_action_check;
alter table public.sport_quiz_audit add constraint sport_quiz_audit_action_check check (action in
  ('settings','question_create','question_edit','question_approve','question_archive','question_void','question_review_media','start','answer','skip','end','retention')) not valid;
alter table public.supervision_events drop constraint if exists supervision_events_kind_check;
alter table public.supervision_events add constraint supervision_events_kind_check check (kind in (
  'age_recorded', 'age_corrected', 'invite_created', 'guardian_linked', 'guardian_unlinked', 'consent_signed',
  'consent_withdrawn', 'settings_changed', 'made_private', 'approval_requested', 'approval_decided', 'approval_cancelled',
  'trivia_group_joined', 'trivia_group_left'));

-- 7. Content helpers -----------------------------------------------------------------------------------------------------
create or replace function public.quiz_round_gap()
returns interval language sql immutable set search_path = '' as $$ select interval '120 seconds' $$;
create or replace function public.quiz_week_end(p_week date)
returns timestamptz language sql immutable set search_path = '' as $$ select (p_week + 7)::timestamp at time zone 'UTC' $$;
create or replace function public.quiz_quarter_of(p_day date)
returns text language sql immutable set search_path = '' as $$ select to_char(p_day, 'YYYY') || '-Q' || extract(quarter from p_day)::int $$;

-- Two to four options, Unicode-trimmed and distinct (the type rule lives in the table checks).
create or replace function public.quiz_normalize_options(p_options jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare item jsonb; normalized jsonb := '[]'; option_text text; n integer;
begin
  if jsonb_typeof(p_options) is distinct from 'array' then return null; end if;
  n := jsonb_array_length(p_options);
  if n not between 2 and 4 then return null; end if;
  for item in select value from jsonb_array_elements(p_options) loop
    if jsonb_typeof(item) <> 'string' then return null; end if;
    option_text := btrim(item #>> '{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
    if char_length(option_text) not between 1 and 100 then return null; end if;
    normalized := normalized || jsonb_build_array(option_text);
  end loop;
  if (select count(distinct value) from jsonb_array_elements(normalized)) <> n then return null; end if;
  return normalized;
end $$;

create or replace function public.quiz_guard_question()
returns trigger language plpgsql set search_path = '' as $$
declare normalized jsonb;
begin
  if tg_op = 'UPDATE' and (new.question_key,new.version,new.sport,new.prompt,new.options,new.correct_option,new.explanation,new.created_at,
      new.topic_category,new.source_notes,new.question_type,new.media_path,new.media_licence,new.media_source,new.media_attribution,
      new.media_alt_text,new.media_size_bytes,new.media_has_person,new.media_no_marks,new.media_exif_stripped)
    is distinct from (old.question_key,old.version,old.sport,old.prompt,old.options,old.correct_option,old.explanation,old.created_at,
      old.topic_category,old.source_notes,old.question_type,old.media_path,old.media_licence,old.media_source,old.media_attribution,
      old.media_alt_text,old.media_size_bytes,old.media_has_person,old.media_no_marks,old.media_exif_stripped) then raise exception 'quiz_immutable'; end if;
  if tg_op = 'UPDATE' and old.status = 'void' and new.status <> 'void' then raise exception 'quiz_void_final'; end if;
  normalized := public.quiz_normalize_options(new.options);
  if normalized is null and tg_op = 'UPDATE' and new.status in ('archived','void') then return new; end if;
  if normalized is null then raise exception 'quiz_options_invalid'; end if;
  if new.status = 'approved' and char_length(btrim(new.source_notes)) not between 10 and 1000 then raise exception 'quiz_sources_required'; end if;
  -- Images stay off until Content Rights and Minor Safety approve; nothing can be approved behind the switch.
  if new.status = 'approved' and new.question_type = 'image_choice' and (tg_op = 'INSERT' or old.status <> 'approved')
     and not coalesce((select s.images_enabled from public.sport_quiz_settings s where s.singleton), false) then raise exception 'quiz_images_off'; end if;
  if new.status = 'approved' and new.question_type = 'image_choice' and (tg_op = 'INSERT' or old.status <> 'approved')
     and (new.media_reviewed_by is null or new.media_reviewed_by is not distinct from new.created_by) then raise exception 'quiz_media_review_required'; end if;
  if new.question_type = 'image_choice' and new.correct_option < jsonb_array_length(normalized)
     and position(lower(normalized ->> new.correct_option) in lower(coalesce(new.media_alt_text,''))) > 0 then raise exception 'quiz_media_alt_reveals_answer'; end if;
  if tg_op = 'INSERT' then new.options := normalized; end if;
  return new;
end $$;

create or replace function public.quiz_question_dto(p_question uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',id,'question_key',question_key,'version',version,'topic_category',topic_category,'sport',sport,
    'prompt',prompt,'options',options,'question_type',question_type)
  from public.sport_quiz_questions where id = p_question
$$;

create or replace function public.quiz_fun_available(p_me uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_questions q where status = 'approved' and topic_category <> 'sport' and question_type <> 'image_choice'
    and char_length(btrim(source_notes)) >= 10 and public.quiz_normalize_options(options) is not null
    and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key))
$$;

-- Unseen deliverable families for one account in a topic/sport filter.
create or replace function public.quiz_unseen_count(p_me uuid,p_topic text,p_sport text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.sport_quiz_questions q
  where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = p_topic and (p_sport is null or q.sport = p_sport)
    and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10
    and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
$$;

-- Facts learned: committed non-void round answers plus completed single-question attempts, by week range.
create or replace function public.quiz_facts(p_me uuid,p_from date,p_to date)
returns integer language sql stable security definer set search_path = '' as $$
  select ((select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
            where a.profile_id = p_me and i.status = 'answered' and a.week_start >= p_from and a.week_start < p_to)
        + (select count(*) from public.sport_quiz_attempts a where a.profile_id = p_me and a.mode <> 'round' and a.status = 'completed'
            and a.week_start >= p_from and a.week_start < p_to))::int
$$;
create or replace function public.quiz_played(p_me uuid,p_week date)
returns boolean language sql stable security definer set search_path = '' as $$ select public.quiz_facts(p_me,p_week,p_week + 7) > 0 $$;

-- 8. Round lifecycle -----------------------------------------------------------------------------------------------------
-- Read-only effective state: the snapshot never writes, so an expired item or a missed Next is computed here.
create or replace function public.quiz_round_view(p_attempt uuid,p_asof timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; it public.sport_quiz_round_items%rowtype; answered integer; voided integer;
  st text; rs text; nb timestamptz; closed timestamptz; why text; item_expired boolean := false;
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt;
  if a.id is null or a.mode <> 'round' then return null; end if;
  select count(*) filter (where status = 'answered'), count(*) filter (where status = 'void' and answered_option is not null)
    into answered, voided from public.sport_quiz_round_items where attempt_id = a.id;
  st := a.status; rs := a.round_state; nb := a.next_by; closed := a.closed_at; why := a.close_reason;
  select * into it from public.sport_quiz_round_items where attempt_id = a.id and position = a.position;
  if st = 'issued' and rs = 'item' and it.status = 'issued' and it.expires_at <= p_asof then
    item_expired := true;
    if a.position >= a.planned_items then
      st := case when answered > 0 then 'completed' when voided > 0 then 'void' else 'expired' end; rs := null; nb := null; closed := it.expires_at; why := 'deadline';
    else rs := 'between'; nb := it.expires_at + public.quiz_round_gap(); end if;
  end if;
  if st = 'issued' and rs = 'between' and nb <= p_asof then
    st := case when answered > 0 then 'completed' when voided > 0 then 'void' else 'expired' end; rs := null; closed := nb; nb := null; why := 'next_timeout';
  end if;
  return jsonb_build_object('status',st,'round_state',rs,'next_by',case when rs = 'between' then nb end,'closed_at',closed,'close_reason',why,
    'item_expired',item_expired,'answered_count',answered,'effective_expired',a.status = 'issued' and (st <> 'issued' or item_expired));
end $$;

create or replace function public.quiz_summary(p_attempt uuid,p_asof timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when a.mode = 'round' then
    jsonb_build_object('id',a.id,'week_start',a.week_start,'mode',a.mode,'status',v ->> 'status','started_at',a.started_at,'expires_at',a.expires_at,
      'duration_seconds',a.duration_seconds,'closed_at',v -> 'closed_at','close_reason',v ->> 'close_reason','effective_expired',(v ->> 'effective_expired')::boolean,
      'correction_reason',a.correction_reason,'round_state',v ->> 'round_state','position',a.position,'planned_items',a.planned_items,
      'round_size',a.round_size,'next_by',v -> 'next_by','answered_count',(v ->> 'answered_count')::int,'short_round',a.planned_items < a.round_size,
      'group_id',a.group_id)
  else
    jsonb_build_object('id',a.id,'week_start',a.week_start,'mode',a.mode,
      'status',case when a.status = 'issued' and a.expires_at <= p_asof then 'expired' else a.status end,
      'started_at',a.started_at,'expires_at',a.expires_at,'duration_seconds',a.duration_seconds,'closed_at',a.closed_at,'close_reason',a.close_reason,
      'effective_expired',a.status = 'issued' and a.expires_at <= p_asof,'correction_reason',a.correction_reason,
      'round_state',null,'position',null,'planned_items',null,'round_size',null,'next_by',null,'answered_count',
      case when a.status = 'completed' then 1 else 0 end,'short_round',false,'group_id',null)
  end
  from public.sport_quiz_attempts a cross join lateral (select public.quiz_round_view(a.id,p_asof) v) x where a.id = p_attempt
$$;

-- The latest closed item's result while the round waits for Next or is over; never the open item's answer.
create or replace function public.quiz_result_dto(p_attempt uuid,p_asof timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; it public.sport_quiz_round_items%rowtype; q public.sport_quiz_questions%rowtype; v jsonb;
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt;
  if a.id is null then return null; end if;
  if a.mode <> 'round' then
    return (select jsonb_build_object('answered_option',a.answered_option,'correct_option',q2.correct_option,
      'was_correct',case when a.answered_option is null then null else a.answered_option = q2.correct_option end,
      'explanation',q2.explanation,'completed_at',a.completed_at,'position',null,'item_status',null)
      from public.sport_quiz_questions q2 where q2.id = a.question_id and (a.status <> 'issued' or a.expires_at <= p_asof));
  end if;
  v := public.quiz_round_view(a.id,p_asof);
  if v ->> 'status' = 'issued' and v ->> 'round_state' = 'item' then return null; end if;
  select * into it from public.sport_quiz_round_items where attempt_id = a.id and (status <> 'issued' or expires_at <= p_asof) order by position desc limit 1;
  if it.attempt_id is null then return null; end if;
  select * into q from public.sport_quiz_questions where id = it.question_id;
  return jsonb_build_object('answered_option',it.answered_option,'correct_option',q.correct_option,
    'was_correct',case when it.answered_option is null then null else it.answered_option = q.correct_option end,
    'explanation',q.explanation,'completed_at',it.answered_at,'position',it.position,
    'item_status',case when it.status = 'issued' then 'expired' else it.status end);
end $$;

create or replace function public.quiz_round_items_dto(p_attempt uuid,p_asof timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('position',i.position,
    'status',case when i.status = 'issued' then 'expired' else i.status end,'question',public.quiz_question_dto(i.question_id),
    'result',jsonb_build_object('answered_option',i.answered_option,'correct_option',q.correct_option,
      'was_correct',case when i.answered_option is null then null else i.answered_option = q.correct_option end,
      'explanation',q.explanation,'completed_at',i.answered_at),
    'correction_reason',i.correction_reason) order by i.position),'[]'::jsonb)
  from public.sport_quiz_round_items i join public.sport_quiz_questions q on q.id = i.question_id
  where i.attempt_id = p_attempt and (i.status <> 'issued' or i.expires_at <= p_asof)
$$;

-- Close a round: open items end (or expire), the status follows the committed answers.
create or replace function public.quiz_round_close(p_attempt uuid,p_at timestamptz,p_reason text,p_closed_at timestamptz default null)
returns text language plpgsql security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; n integer; nv integer; st text; t timestamptz := coalesce(p_closed_at,p_at);
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt for update;
  if a.id is null or a.mode <> 'round' or a.status <> 'issued' then return a.status; end if;
  update public.sport_quiz_round_items set status = case when expires_at <= t then 'expired' else 'ended' end,closed_at = least(expires_at,t)
    where attempt_id = a.id and status = 'issued';
  select count(*) filter (where status = 'answered'),count(*) filter (where status = 'void' and answered_option is not null) into n,nv
    from public.sport_quiz_round_items where attempt_id = a.id;
  st := case when n > 0 then 'completed' when nv > 0 then 'void' when p_reason in ('deadline','next_timeout') then 'expired' else 'ended' end;
  update public.sport_quiz_attempts set status = st,round_state = null,next_by = null,closed_at = t,close_reason = p_reason,session_hash = null,
    completed_at = case when n > 0 then t end,voided_at = case when st = 'void' then coalesce(voided_at,t) end where id = a.id;
  perform public.quiz_bump_history(a.profile_id);
  return st;
end $$;

-- Persist expiry chains under the lifecycle lock: item deadline → between → Next window → closed.
create or replace function public.quiz_round_settle(p_attempt uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; it public.sport_quiz_round_items%rowtype; closed timestamptz;
begin
  loop
    select * into a from public.sport_quiz_attempts where id = p_attempt for update;
    if a.id is null or a.mode <> 'round' or a.status <> 'issued' then return; end if;
    if a.round_state = 'item' then
      select * into it from public.sport_quiz_round_items where attempt_id = a.id and position = a.position for update;
      if it.status = 'issued' and it.expires_at > p_at then return; end if;
      closed := case when it.status = 'issued' then it.expires_at else coalesce(it.closed_at,p_at) end;
      if it.status = 'issued' then
        update public.sport_quiz_round_items set status = 'expired',closed_at = it.expires_at where attempt_id = a.id and position = a.position;
      end if;
      if a.position >= a.planned_items then perform public.quiz_round_close(a.id,p_at,'deadline',closed); return; end if;
      update public.sport_quiz_attempts set round_state = 'between',next_by = closed + public.quiz_round_gap() where id = a.id;
      perform public.quiz_bump_history(a.profile_id);
    else
      if a.next_by > p_at then return; end if;
      perform public.quiz_round_close(a.id,p_at,'next_timeout',a.next_by); return;
    end if;
  end loop;
end $$;

create or replace function public.quiz_expire(p_me uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare changed bigint; rid uuid;
begin
  update public.sport_quiz_attempts set status = 'expired',closed_at = expires_at,close_reason = 'deadline',session_hash = null
    where profile_id = p_me and mode <> 'round' and status = 'issued' and expires_at <= p_at;
  get diagnostics changed = row_count;
  if changed > 0 then perform public.quiz_bump_history(p_me); end if;
  for rid in select id from public.sport_quiz_attempts where profile_id = p_me and mode = 'round' and status = 'issued' order by id loop
    perform public.quiz_round_settle(rid,p_at);
  end loop;
end $$;

-- Draw for one position. Group rounds use the shared set unless this account has seen that family; then a private
-- replacement (unseen, preferring families not reserved by later shared positions). Personal rounds draw at random.
create or replace function public.quiz_round_pick(p_me uuid,p_attempt uuid,p_position integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; qid uuid;
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt;
  if a.group_id is not null then
    select q.id into qid from public.sport_quiz_group_sets gs join public.sport_quiz_questions q on q.id = gs.question_id
      where gs.group_id = a.group_id and gs.week_start = a.week_start and gs.position = p_position
        and q.status = 'approved' and q.question_type <> 'image_choice' and public.quiz_normalize_options(q.options) is not null
        and char_length(btrim(q.source_notes)) >= 10
        and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = gs.question_key)
      for share of q;
    if qid is not null then return qid; end if;
    select q.id into qid from public.sport_quiz_questions q
      where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = 'sport' and (a.sport_filter is null or q.sport = a.sport_filter)
        and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10
        and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
      order by exists(select 1 from public.sport_quiz_group_sets gs where gs.group_id = a.group_id and gs.week_start = a.week_start
                        and gs.position > p_position and gs.question_key = q.question_key), random()
      limit 1 for share of q;
    return qid;
  end if;
  select q.id into qid from public.sport_quiz_questions q
    where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = a.topic_category and (a.sport_filter is null or q.sport = a.sport_filter)
      and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10
      and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
    order by random() limit 1 for share of q;
  return qid;
end $$;

create or replace function public.quiz_round_issue(p_me uuid,p_attempt uuid,p_position integer,p_question uuid,p_at timestamptz,p_duration integer,p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare k uuid;
begin
  select question_key into k from public.sport_quiz_questions where id = p_question;
  insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,status,next_request_id)
    values(p_attempt,p_position,p_question,k,p_at,p_at + p_duration * interval '1 second','issued',p_request);
  insert into public.sport_quiz_exposures(profile_id,question_key,question_id,first_issued_at) values(p_me,k,p_question,p_at);
end $$;

create or replace function public.quiz_active_item(p_attempt uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('position',i.position,'planned_items',a.planned_items,'expires_at',i.expires_at)
  from public.sport_quiz_attempts a join public.sport_quiz_round_items i on i.attempt_id = a.id and i.position = a.position where a.id = p_attempt
$$;

-- 9. Badges -----------------------------------------------------------------------------------------------------------
-- Derived from live rows on every answer, join and correction, so a void can withdraw what it no longer supports.
create or replace function public.quiz_sync_badges(p_me uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare earned text[]; seasons text[]; w date := public.quiz_week_at(p_at);
begin
  insert into public.sport_quiz_badges(profile_id,attempt_id,week_start,label,kind,period,issued_at)
    select p_me,a.id,a.week_start,'Trivia Explorer','weekly',a.week_start::text,p_at from public.sport_quiz_attempts a
    where a.profile_id = p_me and a.mode = 'round' and exists(select 1 from public.sport_quiz_round_items i where i.attempt_id = a.id and i.status = 'answered')
    on conflict (profile_id,label,period) do update set voided_at = null where public.sport_quiz_badges.voided_at is not null;
  update public.sport_quiz_badges b set voided_at = p_at where b.profile_id = p_me and b.kind = 'weekly' and b.voided_at is null
    and b.attempt_id in (select a.id from public.sport_quiz_attempts a where a.profile_id = p_me and a.mode = 'round'
      and not exists(select 1 from public.sport_quiz_round_items i where i.attempt_id = a.id and i.status = 'answered'));
  select coalesce(array_agg(sport),'{}') into earned from (
    select sport from (
      select q.sport from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
        join public.sport_quiz_questions q on q.id = i.question_id
        where a.profile_id = p_me and i.status = 'answered' and q.topic_category = 'sport'
      union all
      select q.sport from public.sport_quiz_attempts a join public.sport_quiz_questions q on q.id = a.question_id
        where a.profile_id = p_me and a.mode <> 'round' and a.status = 'completed' and q.topic_category = 'sport') f
    group by sport having count(*) >= 5) x;
  insert into public.sport_quiz_badges(profile_id,label,kind,sport,period,issued_at)
    select p_me,s || ' Explorer','sport',s,'lifetime',p_at from unnest(earned) s
    on conflict (profile_id,label,period) do update set voided_at = null where public.sport_quiz_badges.voided_at is not null;
  update public.sport_quiz_badges set voided_at = p_at where profile_id = p_me and kind = 'sport' and voided_at is null and not (sport = any(earned));
  select coalesce(array_agg(quarter),'{}') into seasons from (
    select public.quiz_quarter_of(a.week_start) quarter from public.sport_quiz_attempts a
    where a.profile_id = p_me and ((a.mode = 'round' and exists(select 1 from public.sport_quiz_round_items i where i.attempt_id = a.id and i.status = 'answered'))
      or (a.mode <> 'round' and a.status = 'completed'))
    group by 1 having count(*) >= 10) x;
  insert into public.sport_quiz_badges(profile_id,label,kind,period,issued_at)
    select p_me,'Season Learner','season',s,p_at from unnest(seasons) s
    on conflict (profile_id,label,period) do update set voided_at = null where public.sport_quiz_badges.voided_at is not null;
  update public.sport_quiz_badges set voided_at = p_at where profile_id = p_me and kind = 'season' and voided_at is null and not (period = any(seasons));
  if public.quiz_played(p_me,w) and exists(select 1 from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id
      where m.profile_id = p_me and m.status = 'active' and g.status = 'active') then
    insert into public.sport_quiz_badges(profile_id,label,kind,period,issued_at) values(p_me,'Family Challenger','family',w::text,p_at)
      on conflict (profile_id,label,period) do update set voided_at = null where public.sport_quiz_badges.voided_at is not null;
  end if;
  update public.sport_quiz_badges set voided_at = p_at where profile_id = p_me and kind = 'family' and voided_at is null
    and not public.quiz_played(p_me,period::date);
end $$;

-- 10. Group building blocks ---------------------------------------------------------------------------------------------
create or replace function public.quiz_group_code_new()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; code text := ''; b bytea; i integer; v integer;
begin
  -- 8 characters from 31 (no 0/O, 1/I/L). pgcrypto random bytes with rejection sampling (0–247 map evenly onto
  -- the 31 characters), so every position uses the full alphabet; UUID hex has fixed version/variant digits.
  while char_length(code) < 8 loop
    b := gen_random_bytes(16);
    for i in 0..15 loop
      v := get_byte(b,i);
      if v < 248 and char_length(code) < 8 then code := code || substr(alphabet,1 + v % 31,1); end if;
    end loop;
  end loop;
  return code;
end $$;

create or replace function public.quiz_group_active_count(p_group uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.sport_quiz_group_members where group_id = p_group and status = 'active'
$$;

-- A new code replaces the old hash (rotation). A full group gets no code: the code dies when the group is full.
create or replace function public.quiz_group_issue_code(p_group uuid,p_actor uuid,p_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare code text; tries integer := 0; expires timestamptz := p_at + interval '7 days';
begin
  delete from public.sport_quiz_group_codes where group_id = p_group;
  if public.quiz_group_active_count(p_group) >= 12 then return null; end if;
  loop
    code := public.quiz_group_code_new(); tries := tries + 1;
    begin
      insert into public.sport_quiz_group_codes(group_id,code_hash,created_at,expires_at,created_by) values(p_group,public.hash_secret(code),p_at,expires,p_actor);
      exit;
    exception when unique_violation then if tries >= 5 then raise; end if;
    end;
  end loop;
  update public.sport_quiz_groups set codes_issued = codes_issued + 1 where id = p_group;
  return jsonb_build_object('code',code,'expires_at',expires);
end $$;

-- MINOR-01 friend-request setting decides whom a teen can share a group with (adults always pass this side).
create or replace function public.quiz_teen_accepts(p_teen uuid,p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when not public.is_minor_band(public.profile_age_band(p_teen)) then true
    else coalesce((select case p.friend_requests_from
        when 'everyone' then true
        when 'teens' then public.is_minor_band(public.profile_age_band(p_other)) or public.are_friends(p_teen,p_other)
          or exists(select 1 from public.guardian_links l where l.minor_id = p_teen and l.guardian_id = p_other and l.ended_at is null and l.confirmed_at is not null)
        else public.are_friends(p_teen,p_other)
          or exists(select 1 from public.guardian_links l where l.minor_id = p_teen and l.guardian_id = p_other and l.ended_at is null and l.confirmed_at is not null) end
      from public.profiles p where p.id = p_teen),false) end
$$;

-- Why a join would be refused (null = allowed). Every reason gets the same "That code didn't work" for the joiner.
create or replace function public.quiz_group_refusal(p_group uuid,p_joiner uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare g public.sport_quiz_groups%rowtype; m uuid;
begin
  select * into g from public.sport_quiz_groups where id = p_group;
  if g.id is null or g.status <> 'active' then return 'closed'; end if;
  if exists(select 1 from public.sport_quiz_group_members where group_id = p_group and profile_id = p_joiner and status = 'removed'
      and removed_reason in ('creator','blocked','admin')) then return 'removed'; end if;
  if public.quiz_group_active_count(p_group) >= 12 then return 'full'; end if;
  for m in select profile_id from public.sport_quiz_group_members where group_id = p_group and status = 'active' and profile_id <> p_joiner loop
    if public.is_blocked_between(p_joiner,m) then return 'blocked'; end if;
  end loop;
  for m in select profile_id from public.sport_quiz_group_members where group_id = p_group and status = 'active' and profile_id <> p_joiner loop
    if not public.quiz_teen_accepts(p_joiner,m) or not public.quiz_teen_accepts(m,p_joiner) then return 'teen_rule'; end if;
  end loop;
  return null;
end $$;

create or replace function public.quiz_group_case(p_group uuid,p_kind text,p_actor uuid,p_subject uuid,p_code text,p_reason text,p_at timestamptz)
returns void language sql security definer set search_path = '' as $$
  insert into public.sport_quiz_group_cases(group_id,kind,actor_id,subject_id,reason_code,reason,created_at) values(p_group,p_kind,p_actor,p_subject,p_code,p_reason,p_at)
$$;

-- Hand the group to the oldest remaining member, or dissolve it. The old owner's code dies either way.
create or replace function public.quiz_group_handover(p_group uuid,p_leaving uuid,p_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare nxt uuid;
begin
  select profile_id into nxt from public.sport_quiz_group_members where group_id = p_group and status = 'active' and profile_id <> p_leaving
    order by joined_at, profile_id limit 1;
  delete from public.sport_quiz_group_codes where group_id = p_group;
  if nxt is null then
    update public.sport_quiz_groups set status = 'closed',closed_at = p_at,close_reason = 'dissolved' where id = p_group and status = 'active';
    perform public.quiz_group_case(p_group,'dissolved',null,p_leaving,null,null,p_at);
  else
    update public.sport_quiz_groups set owner_id = nxt where id = p_group;
    perform public.quiz_group_case(p_group,'handover',null,nxt,null,null,p_at);
  end if;
  return nxt;
end $$;

-- Remove (creator, block, admin, teen rule or closed account): creator/block/admin bar rejoining; the code rotates;
-- supervision logs "left".
create or replace function public.quiz_group_mark_removed(p_group uuid,p_member uuid,p_reason text,p_actor uuid,p_note text,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  update public.sport_quiz_group_members set status = 'removed',removed_at = p_at,removed_reason = p_reason
    where group_id = p_group and profile_id = p_member and status = 'active';
  if not found then return; end if;
  perform public.log_supervision_event(p_member,'trivia_group_left','{}'::jsonb);
  perform public.quiz_group_case(p_group,case p_reason when 'creator' then 'member_removed' when 'blocked' then 'blocked_removed' when 'teen_rule' then 'rule_removed'
    when 'closed' then 'account_closed' else 'admin_removal' end,
    p_actor,p_member,p_reason,p_note,p_at);
  delete from public.sport_quiz_group_codes where group_id = p_group;
  select owner_id into owner from public.sport_quiz_groups where id = p_group;
  if owner = p_member then perform public.quiz_group_handover(p_group,p_member,p_at); end if;
  if public.quiz_group_active_count(p_group) = 0 then
    update public.sport_quiz_groups set status = 'closed',closed_at = p_at,close_reason = 'dissolved' where id = p_group and status = 'active';
  end if;
end $$;

-- Rules drift after a join (age correction, setting change, unfriend, ended guardian link, a birthday). These re-run
-- the both-ways teen rule and remove the failing member with reason teen_rule (no rejoin bar; the join check decides).
create or replace function public.quiz_pair_ok(p_a uuid,p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.quiz_teen_accepts(p_a,p_b) and public.quiz_teen_accepts(p_b,p_a)
$$;
create or replace function public.quiz_profile_closed(p_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.age_blocked_at is not null from public.profiles p where p.id = p_profile),true)
$$;

-- p_remove_self: the profile itself changed (birth month/year), so it is the one removed from a failing pair.
-- Otherwise (its friend-request setting changed) the party its teen rule now refuses is removed.
create or replace function public.quiz_group_recheck(p_profile uuid,p_remove_self boolean default true)
returns integer language plpgsql security definer set search_path = '' as $$
declare gid uuid; m uuid; at timestamptz := clock_timestamp(); removed integer := 0;
begin
  perform 1 from public.sport_quiz_settings where singleton for share;
  for gid in select x.group_id from public.sport_quiz_group_members x join public.sport_quiz_groups g on g.id = x.group_id
      where x.profile_id = p_profile and x.status = 'active' and g.status = 'active' order by x.group_id loop
    perform 1 from public.sport_quiz_groups where id = gid for update;
    if public.quiz_profile_closed(p_profile) then
      perform public.quiz_group_mark_removed(gid,p_profile,'closed',null,null,at); removed := removed + 1; continue;
    end if;
    for m in select profile_id from public.sport_quiz_group_members where group_id = gid and status = 'active' and profile_id <> p_profile order by joined_at,profile_id loop
      exit when not exists(select 1 from public.sport_quiz_group_members where group_id = gid and profile_id = p_profile and status = 'active');
      if not public.quiz_pair_ok(p_profile,m) then
        if p_remove_self or public.quiz_teen_accepts(p_profile,m) then perform public.quiz_group_mark_removed(gid,p_profile,'teen_rule',null,null,at);
        else perform public.quiz_group_mark_removed(gid,m,'teen_rule',null,null,at); end if;
        removed := removed + 1;
      end if;
    end loop;
  end loop;
  return removed;
end $$;

-- A relationship between two accounts ended (unfriend, guardian link ended): in every shared group, remove the party
-- the teen's rule now refuses.
create or replace function public.quiz_group_recheck_pair(p_a uuid,p_b uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare gid uuid; at timestamptz := clock_timestamp(); removed integer := 0;
begin
  if public.quiz_pair_ok(p_a,p_b) then return 0; end if;
  perform 1 from public.sport_quiz_settings where singleton for share;
  for gid in select a.group_id from public.sport_quiz_group_members a join public.sport_quiz_group_members b on b.group_id = a.group_id
      join public.sport_quiz_groups g on g.id = a.group_id
      where a.profile_id = p_a and b.profile_id = p_b and a.status = 'active' and b.status = 'active' and g.status = 'active' order by a.group_id loop
    perform 1 from public.sport_quiz_groups where id = gid for update;
    perform public.quiz_group_mark_removed(gid,case when not public.quiz_teen_accepts(p_a,p_b) then p_b else p_a end,'teen_rule',null,null,at);
    removed := removed + 1;
  end loop;
  return removed;
end $$;

-- Lazy check for drift without a trigger (a birthday moves an account into another band): closed accounts and every
-- failing pair, oldest pairs first; the refused party is removed. Caller holds settings share and the group row lock.
create or replace function public.quiz_group_needs_recheck(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_group_members m where m.group_id = p_group and m.status = 'active' and public.quiz_profile_closed(m.profile_id))
    or exists(select 1 from public.sport_quiz_group_members a join public.sport_quiz_group_members b on b.group_id = a.group_id and a.profile_id < b.profile_id
      where a.group_id = p_group and a.status = 'active' and b.status = 'active' and not public.quiz_pair_ok(a.profile_id,b.profile_id))
$$;
create or replace function public.quiz_group_recheck_group(p_group uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; at timestamptz := clock_timestamp(); removed integer := 0;
begin
  for r in select profile_id from public.sport_quiz_group_members where group_id = p_group and status = 'active' and public.quiz_profile_closed(profile_id) order by profile_id loop
    perform public.quiz_group_mark_removed(p_group,r.profile_id,'closed',null,null,at); removed := removed + 1;
  end loop;
  for r in select a.profile_id x,b.profile_id y from public.sport_quiz_group_members a join public.sport_quiz_group_members b on b.group_id = a.group_id
      and (a.joined_at,a.profile_id) < (b.joined_at,b.profile_id)
      where a.group_id = p_group and a.status = 'active' and b.status = 'active' order by a.joined_at,a.profile_id,b.joined_at,b.profile_id loop
    if exists(select 1 from public.sport_quiz_group_members where group_id = p_group and profile_id = r.x and status = 'active')
       and exists(select 1 from public.sport_quiz_group_members where group_id = p_group and profile_id = r.y and status = 'active')
       and not public.quiz_pair_ok(r.x,r.y) then
      perform public.quiz_group_mark_removed(p_group,case when not public.quiz_teen_accepts(r.x,r.y) then r.y else r.x end,'teen_rule',null,null,at);
      removed := removed + 1;
    end if;
  end loop;
  return removed;
end $$;

-- Opaque per-group member reference: the creator never sees profile ids.
create or replace function public.quiz_member_ref(p_group uuid,p_member uuid)
returns text language sql stable security definer set search_path = '' as $$
  select left(public.hash_secret(g.ref_salt || ':' || g.id::text || ':' || p_member::text),32) from public.sport_quiz_groups g where g.id = p_group
$$;

-- First name for everyone; a teen never shows more than a first name.
create or replace function public.quiz_group_display_name(p_member uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when public.is_minor_band(public.profile_age_band(p_member))
    then coalesce(nullif(split_part(btrim(coalesce(p.full_name,'')),' ',1),''),'Teammate')
    else public.first_name_of(p_member) end
  from public.profiles p where p.id = p_member
$$;

-- Live group page: a played-this-week mark per member, group totals only, opt-in visible badges. No answers,
-- correctness, times, per-member counts or ranking. Members blocked with the viewer and closed accounts are left out;
-- a closed group shows no members. Fact totals appear only once 3 members played this week, rounded down to 5s, so
-- polling cannot isolate one member's count. member_ref is opaque and only for the creator.
create or replace function public.quiz_group_page_dto(p_group uuid,p_me uuid,p_at timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with g as (select * from public.sport_quiz_groups where id = p_group),
  w as (select public.quiz_week_at(p_at) w, date_trunc('quarter',p_at at time zone 'UTC')::date qs),
  mem as (select m.profile_id,m.joined_at,public.quiz_played(m.profile_id,(select w from w)) played
          from public.sport_quiz_group_members m where m.group_id = p_group and m.status = 'active'
            and (select status from public.sport_quiz_groups where id = p_group) = 'active' and not public.quiz_profile_closed(m.profile_id)
            and (m.profile_id = p_me or not public.is_blocked_between(p_me,m.profile_id))),
  shown as (select count(*) filter (where played) >= 3 ok from mem)
  select jsonb_build_object('contract_version',3,'group_id',g.id,'name_key',g.name_key,'theme_sport',g.theme_sport,'status',g.status,
    'is_owner',g.owner_id = p_me,'week_start',(select w from w),
    'members',coalesce((select jsonb_agg(jsonb_build_object('member_ref',case when g.owner_id = p_me then public.quiz_member_ref(g.id,m.profile_id) end,
        'display_name',public.quiz_group_display_name(m.profile_id),'is_owner',m.profile_id = g.owner_id,'is_me',m.profile_id = p_me,
        'played_this_week',m.played,
        'badges',(select coalesce(jsonb_agg(b.label order by b.label),'[]'::jsonb) from public.sport_quiz_badges b
                  where b.profile_id = m.profile_id and b.visibility = 'groups' and b.voided_at is null)) order by m.joined_at,m.profile_id) from mem m),'[]'::jsonb),
    'totals',jsonb_build_object('members',(select count(*) from mem),'played_this_week',(select count(*) from mem where played),
      'facts_this_week',case when (select ok from shown) then (select (coalesce(sum(public.quiz_facts(m.profile_id,(select w from w),(select w from w) + 7)),0) / 5) * 5 from mem m) end,
      'facts_this_season',case when (select ok from shown) then (select (coalesce(sum(public.quiz_facts(m.profile_id,(select qs from w),((select qs from w) + interval '3 months')::date)),0) / 5) * 5 from mem m) end),
    'everyone_played',(select count(*) > 0 and bool_and(played) from mem),
    'code_active',exists(select 1 from public.sport_quiz_group_codes c where c.group_id = g.id and c.expires_at > p_at),
    'code_expires_at',case when g.owner_id = p_me then (select c.expires_at from public.sport_quiz_group_codes c where c.group_id = g.id and c.expires_at > p_at) end,
    'can_invite',g.owner_id = p_me and g.status = 'active' and (select count(*) from mem) < 12)
  from g
$$;

-- The shared set for a group-week, drawn at random from the theme without reading any member's exposures.
create or replace function public.quiz_group_ensure_set(p_group uuid,p_week date,p_size integer,p_at timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare theme text; n integer;
begin
  select count(*) into n from public.sport_quiz_group_sets where group_id = p_group and week_start = p_week;
  if n > 0 then return n; end if;
  select theme_sport into theme from public.sport_quiz_groups where id = p_group;
  insert into public.sport_quiz_group_sets(group_id,week_start,position,question_key,question_id,created_at,prune_after)
    select p_group,p_week,row_number() over (order by r),x.question_key,x.id,p_at,public.quiz_week_end(p_week) + interval '35 days'
    from (select q.id,q.question_key,random() r from public.sport_quiz_questions q
          where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = 'sport' and (theme is null or q.sport = theme)
            and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10
          order by r limit p_size) x;
  get diagnostics n = row_count;
  return n;
end $$;

-- 11. Rounds: Start, group Start, Next, answer, End -------------------------------------------------------------------
create or replace function public.quiz_round_begin(p_me uuid,p_topic text,p_sport text,p_duration integer,p_expected_week date,p_notice text,
  p_request uuid,p_secret text,p_group uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare at timestamptz; w date; d text; r public.sport_quiz_requests%rowtype; a public.sport_quiz_attempts%rowtype; it public.sport_quiz_round_items%rowtype;
  q public.sport_quiz_questions%rowtype; p public.sport_quiz_preferences%rowtype; s public.sport_quiz_settings%rowtype;
  receipt jsonb; active jsonb; item jsonb; planned integer; setn integer; qid uuid; filter text := case when p_sport is null then null else btrim(p_sport) end;
begin
  -- Lock order: settings → group (row + set advisory lock) → account.
  select * into s from public.sport_quiz_settings where singleton for share;
  if not found then raise exception 'quiz_unavailable'; end if;
  if p_group is not null then
    if public.quiz_group_needs_recheck(p_group) then
      perform 1 from public.sport_quiz_groups where id = p_group for update;
      perform public.quiz_group_recheck_group(p_group);
    else
      perform 1 from public.sport_quiz_groups where id = p_group for share;
    end if;
    perform pg_advisory_xact_lock(hashtextextended('sport-quiz-group:' || p_group,0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz:' || p_me,0));
  at := clock_timestamp(); w := public.quiz_week_at(at);
  if p_expected_week is distinct from w then raise exception 'quiz_week_changed'; end if;
  d := public.quiz_digest(case when p_group is null then jsonb_build_array(p_topic,filter,p_duration,p_expected_week,p_notice,p_secret)
    else jsonb_build_array(p_topic,filter,p_duration,p_expected_week,p_notice,p_secret,p_group) end);
  select * into r from public.sport_quiz_requests where profile_id = p_me and request_id = p_request;
  if found then
    if r.operation <> 'start' or (r.payload_digest is not null and r.payload_digest is distinct from d) then raise exception 'quiz_request_conflict'; end if;
    perform public.quiz_expire(p_me,at);
    select * into a from public.sport_quiz_attempts where id = r.attempt_id for update;
    if a.status = 'issued' and a.session_hash = public.hash_secret(p_secret) and s.enabled and p_me = any(s.pilot_accounts) then
      if a.mode = 'round' then
        select * into it from public.sport_quiz_round_items where attempt_id = a.id and position = 1;
        if a.round_state = 'item' and a.position = 1 and it.status = 'issued' and it.expires_at > at then
          active := public.quiz_question_dto(it.question_id); item := public.quiz_active_item(a.id);
        end if;
      elsif a.expires_at > at then
        select * into q from public.sport_quiz_questions where id = a.question_id for share;
        if q.status <> 'void' then active := public.quiz_question_dto(q.id); end if;
      end if;
    end if;
    return public.quiz_receipt_dto(p_me,p_request,at) || jsonb_build_object('server_now',at,'active_question',active,'active_item',item);
  end if;
  -- A guard survives erasure/cancellation and is checked before any draw.
  if exists(select 1 from public.sport_quiz_week_guards where profile_id = p_me and week_start = w) then
    select id into a.id from public.sport_quiz_attempts where profile_id = p_me and week_start = w;
    receipt := public.quiz_save_request(p_me,p_request,'start',w,d,a.id,'week_spent',at);
    return receipt || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  perform public.quiz_require_testing(p_me);
  perform public.quiz_expire(p_me,at);
  if exists(select 1 from public.sport_quiz_attempts where profile_id = p_me and status = 'issued') then raise exception 'quiz_round_active'; end if;
  select * into p from public.sport_quiz_preferences where profile_id = p_me;
  if p.notice_version is distinct from p_notice then raise exception 'quiz_notice_required'; end if;
  if p_group is null then
    if (p_topic <> 'sport' and not public.quiz_fun_slot(p_me,w)) or (p_topic = 'sport' and public.quiz_fun_slot(p_me,w) and public.quiz_fun_available(p_me)) then
      raise exception 'quiz_topic_not_allowed'; end if;
    planned := least(s.round_size,public.quiz_unseen_count(p_me,p_topic,filter));
  else
    if not s.groups_enabled then raise exception 'quiz_groups_paused'; end if;
    if not exists(select 1 from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id
        where m.group_id = p_group and m.profile_id = p_me and m.status = 'active' and g.status = 'active') then raise exception 'quiz_group_not_member'; end if;
    select theme_sport into filter from public.sport_quiz_groups where id = p_group;
    setn := public.quiz_group_ensure_set(p_group,w,s.round_size,at);
    planned := least(setn,public.quiz_unseen_count(p_me,'sport',filter));
  end if;
  if coalesce(planned,0) < 1 then raise exception 'quiz_no_question'; end if;
  at := clock_timestamp(); w := public.quiz_week_at(at);
  if w is distinct from p_expected_week then raise exception 'quiz_week_changed'; end if;
  -- The whole round (items plus Next windows) must fit before the UTC week ends.
  if at + planned * p_duration * interval '1 second' + (planned - 1) * public.quiz_round_gap() > public.quiz_week_end(w) then raise exception 'quiz_week_closing'; end if;
  perform public.quiz_spend(p_me,w,at);
  insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status,issued_at,mode,duration_seconds,started_at,expires_at,session_hash,
      round_state,position,planned_items,round_size,topic_category,sport_filter,group_id)
    values(p_me,w,null,'issued',at,'round',p_duration,at,at + p_duration * interval '1 second',public.hash_secret(p_secret),
      'item',1,planned,s.round_size,p_topic,filter,p_group) returning * into a;
  qid := public.quiz_round_pick(p_me,a.id,1);
  if qid is null then raise exception 'quiz_no_question'; end if;
  perform public.quiz_round_issue(p_me,a.id,1,qid,at,p_duration,null);
  perform public.quiz_bump_history(p_me);
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,created_at) values(p_me,'start',qid,a.id,at);
  receipt := public.quiz_save_request(p_me,p_request,'start',w,d,a.id,'started',at);
  return receipt || jsonb_build_object('server_now',at,'active_question',public.quiz_question_dto(qid),'active_item',public.quiz_active_item(a.id));
end $$;

create or replace function public.quiz_start(p_topic_category text,p_sport text,p_duration_seconds integer,p_expected_week date,
 p_notice_version text,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id);
begin
  if p_request_id is null or coalesce(p_topic_category,'') not in ('sport','science','geography','general') or p_duration_seconds is null or p_duration_seconds not in (30,90)
    or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' or p_notice_version is distinct from 'timed-trivia-v1-testing'
    or (p_sport is not null and char_length(btrim(p_sport)) not between 2 and 80) or (p_topic_category <> 'sport' and p_sport is not null) then raise exception 'quiz_start_invalid'; end if;
  return public.quiz_round_begin(me,p_topic_category,p_sport,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,null);
end $$;

-- A member plays the group's shared set only by starting from that group's page. Same weekly opportunity.
create or replace function public.quiz_group_start(p_group_id uuid,p_duration_seconds integer,p_expected_week date,p_notice_version text,
 p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id);
begin
  if p_group_id is null or p_request_id is null or p_duration_seconds is null or p_duration_seconds not in (30,90)
    or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' or p_notice_version is distinct from 'timed-trivia-v1-testing' then raise exception 'quiz_start_invalid'; end if;
  return public.quiz_round_begin(me,'sport',null,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,p_group_id);
end $$;

create or replace function public.quiz_next(p_attempt_id uuid,p_expected_position integer,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype;
  a public.sport_quiz_attempts%rowtype; it public.sport_quiz_round_items%rowtype; s public.sport_quiz_settings%rowtype;
  active jsonb; item jsonb; qid uuid; st text;
begin
  if p_attempt_id is null or p_request_id is null or p_expected_position is null or p_expected_position not between 1 and 4
    or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' then raise exception 'quiz_next_invalid'; end if;
  perform public.quiz_lock(me);
  select * into s from public.sport_quiz_settings where singleton;
  at := clock_timestamp(); d := public.quiz_digest(jsonb_build_array(p_attempt_id,p_expected_position,p_session_secret));
  select * into r from public.sport_quiz_requests where profile_id = me and request_id = p_request_id;
  if found then
    -- Exact recovery: the same item, only before its deadline and only with the round's secret.
    if r.operation <> 'next' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict'; end if;
    perform public.quiz_expire(me,at);
    select * into a from public.sport_quiz_attempts where id = r.attempt_id;
    select * into it from public.sport_quiz_round_items where attempt_id = a.id and next_request_id = p_request_id;
    if a.status = 'issued' and a.round_state = 'item' and a.position = it.position and it.status = 'issued' and it.expires_at > at
       and a.session_hash = public.hash_secret(p_session_secret) and s.enabled and me = any(s.pilot_accounts) then
      active := public.quiz_question_dto(it.question_id); item := public.quiz_active_item(a.id);
    end if;
    return public.quiz_receipt_dto(me,p_request_id,at) || jsonb_build_object('server_now',at,'active_question',active,'active_item',item);
  end if;
  select * into a from public.sport_quiz_attempts where id = p_attempt_id and profile_id = me for update;
  if a.id is null or a.mode <> 'round' then raise exception 'quiz_round_closed'; end if;
  perform public.quiz_require_testing(me);
  if a.status = 'issued' and a.session_hash is distinct from public.hash_secret(p_session_secret) then raise exception 'quiz_capability_invalid'; end if;
  perform public.quiz_round_settle(a.id,at);
  select * into a from public.sport_quiz_attempts where id = p_attempt_id for update;
  if a.status <> 'issued' then
    return public.quiz_save_request(me,p_request_id,'next',a.week_start,d,a.id,a.status,at) || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  if a.round_state <> 'between' or a.position <> p_expected_position then raise exception 'quiz_next_not_ready'; end if;
  at := clock_timestamp();
  if a.week_start <> public.quiz_week_at(at) or at + a.duration_seconds * interval '1 second' > public.quiz_week_end(a.week_start) then
    st := public.quiz_round_close(a.id,at,'week_end');
    return public.quiz_save_request(me,p_request_id,'next',a.week_start,d,a.id,'week_closed',at) || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  qid := public.quiz_round_pick(me,a.id,a.position + 1);
  if qid is null then
    st := public.quiz_round_close(a.id,at,'pool_exhausted');
    return public.quiz_save_request(me,p_request_id,'next',a.week_start,d,a.id,'pool_exhausted',at) || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  perform public.quiz_round_issue(me,a.id,a.position + 1,qid,at,a.duration_seconds,p_request_id);
  update public.sport_quiz_attempts set position = position + 1,round_state = 'item',next_by = null,expires_at = at + a.duration_seconds * interval '1 second' where id = a.id;
  perform public.quiz_bump_history(me);
  return public.quiz_save_request(me,p_request_id,'next',a.week_start,d,a.id,'issued',at)
    || jsonb_build_object('server_now',at,'active_question',public.quiz_question_dto(qid),'active_item',public.quiz_active_item(a.id));
end $$;

create or replace function public.quiz_answer(p_attempt_id uuid,p_option integer,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype;
  a public.sport_quiz_attempts%rowtype; q public.sport_quiz_questions%rowtype; it public.sport_quiz_round_items%rowtype; outcome text;
begin
  if p_request_id is null or p_attempt_id is null or p_option is null or p_option not between 0 and 3 or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' then raise exception 'quiz_answer_invalid'; end if;
  perform public.quiz_lock(me); select * into a from public.sport_quiz_attempts where id = p_attempt_id and profile_id = me for update;
  at := clock_timestamp(); d := public.quiz_digest(jsonb_build_array(p_attempt_id,p_option,p_session_secret));
  select * into r from public.sport_quiz_requests where profile_id = me and request_id = p_request_id;
  if found then if r.operation <> 'answer' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict'; end if; return public.quiz_receipt_dto(me,p_request_id,at); end if;
  if a.id is null or a.mode not in ('timed','round') then raise exception 'quiz_round_closed'; end if;
  perform public.quiz_require_testing(me);
  if a.status = 'issued' and a.session_hash is distinct from public.hash_secret(p_session_secret) then raise exception 'quiz_capability_invalid'; end if;
  if a.mode = 'timed' then
    -- Single-question rounds started before QUIZ-03 keep their QUIZ-02 behaviour.
    if a.status = 'issued' and a.expires_at <= at then perform public.quiz_expire(me,at); return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'expired',at); end if;
    if a.status <> 'issued' then return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,a.status,at); end if;
    select * into q from public.sport_quiz_questions where id = a.question_id for share;
    if q.status = 'void' or public.quiz_normalize_options(q.options) is null then raise exception 'quiz_question_unavailable'; end if;
    if p_option >= jsonb_array_length(q.options) then raise exception 'quiz_answer_invalid'; end if;
    at := clock_timestamp();
    if a.expires_at <= at then perform public.quiz_expire(me,at); return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'expired',at); end if;
    update public.sport_quiz_attempts set status = 'completed',answered_option = p_option,request_id = p_request_id,completed_at = at,closed_at = at,close_reason = 'answered',session_hash = null where id = a.id;
    insert into public.sport_quiz_badges(profile_id,attempt_id,week_start,label,issued_at) values(me,a.id,a.week_start,'Trivia Explorer',at);
    perform public.quiz_sync_badges(me,at);
    perform public.quiz_bump_history(me);
    insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,created_at) values(me,'answer',q.id,a.id,at);
    return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'completed',at);
  end if;
  perform public.quiz_round_settle(a.id,at);
  select * into a from public.sport_quiz_attempts where id = p_attempt_id for update;
  if a.status <> 'issued' then return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,a.status,at); end if;
  select * into it from public.sport_quiz_round_items where attempt_id = a.id and position = a.position for update;
  if a.round_state = 'between' then
    return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,case it.status when 'answered' then 'already_answered' else it.status end,at);
  end if;
  select * into q from public.sport_quiz_questions where id = it.question_id for share;
  if q.status = 'void' or public.quiz_normalize_options(q.options) is null then raise exception 'quiz_question_unavailable'; end if;
  if p_option >= jsonb_array_length(q.options) then raise exception 'quiz_answer_invalid'; end if;
  at := clock_timestamp();
  if it.expires_at <= at then
    perform public.quiz_round_settle(a.id,at);
    return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'expired',at);
  end if;
  update public.sport_quiz_round_items set status = 'answered',answered_option = p_option,answered_at = at,answer_request_id = p_request_id,closed_at = at
    where attempt_id = a.id and position = a.position;
  if a.position >= a.planned_items then perform public.quiz_round_close(a.id,at,'answered'); outcome := 'completed';
  else update public.sport_quiz_attempts set round_state = 'between',next_by = at + public.quiz_round_gap() where id = a.id; outcome := 'answered'; end if;
  perform public.quiz_sync_badges(me,at);
  perform public.quiz_bump_history(me);
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,created_at) values(me,'answer',q.id,a.id,at);
  return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,outcome,at);
end $$;

create or replace function public.quiz_end(p_attempt_id uuid,p_start_request_id uuid,p_expected_week date,p_reason text,p_request_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype;
  source public.sport_quiz_requests%rowtype; a public.sport_quiz_attempts%rowtype; outcome text; w date;
begin
  if (p_attempt_id is null) = (p_start_request_id is null) or p_request_id is null or p_request_id = p_start_request_id
    or coalesce(p_reason,'') not in ('user_end','left_page','background','identity_change') then raise exception 'quiz_end_invalid'; end if;
  perform public.quiz_lock(me); at := clock_timestamp(); w := public.quiz_week_at(at);
  d := public.quiz_digest(jsonb_build_array(p_attempt_id,p_start_request_id,p_expected_week,p_reason));
  select * into r from public.sport_quiz_requests where profile_id = me and request_id = p_request_id;
  if found then if r.operation <> 'end' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict'; end if; return public.quiz_receipt_dto(me,p_request_id,at); end if;
  if p_expected_week is null or p_expected_week > w then raise exception 'quiz_week_changed'; end if;
  if p_start_request_id is not null then
    select * into source from public.sport_quiz_requests where profile_id = me and request_id = p_start_request_id;
    if found and (source.operation <> 'start' or source.week_start <> p_expected_week) then raise exception 'quiz_request_conflict'; end if;
    if source.request_id is null then
      if p_expected_week <> w then raise exception 'quiz_round_closed'; end if;
      if exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = w) then raise exception 'quiz_round_closed'; end if;
      perform public.quiz_spend(me,w,at);
      perform public.quiz_bump_history(me);
      perform public.quiz_save_request(me,p_start_request_id,'start',w,null,null,'cancelled',at);
      return public.quiz_save_request(me,p_request_id,'end',w,d,null,'cancelled',at);
    end if;
    p_attempt_id := source.attempt_id;
    if p_attempt_id is null then return public.quiz_save_request(me,p_request_id,'end',p_expected_week,d,null,'cancelled',at); end if;
  end if;
  select * into a from public.sport_quiz_attempts where id = p_attempt_id and profile_id = me and week_start = p_expected_week for update;
  if a.id is null then raise exception 'quiz_round_closed'; end if;
  at := clock_timestamp();
  if a.mode = 'round' then
    -- Leaving ends the whole round; unissued positions were never drawn, so they stay in the pool.
    perform public.quiz_round_settle(a.id,at);
    select * into a from public.sport_quiz_attempts where id = a.id for update;
    if a.status = 'issued' then
      outcome := public.quiz_round_close(a.id,at,p_reason);
      insert into public.sport_quiz_audit(actor_id,action,attempt_id,created_at) values(me,'end',a.id,at);
    else outcome := a.status; end if;
    return public.quiz_save_request(me,p_request_id,'end',a.week_start,d,a.id,outcome,at);
  end if;
  if a.status = 'issued' then
    outcome := case when a.expires_at <= at then 'expired' else 'ended' end;
    update public.sport_quiz_attempts set status = outcome,closed_at = case when outcome = 'expired' then expires_at else at end,
      close_reason = case when outcome = 'expired' then 'deadline' else p_reason end,session_hash = null where id = a.id;
    perform public.quiz_bump_history(me);
    insert into public.sport_quiz_audit(actor_id,action,attempt_id,created_at) values(me,'end',a.id,at);
  else outcome := a.status; end if;
  return public.quiz_save_request(me,p_request_id,'end',a.week_start,d,a.id,outcome,at);
end $$;

-- 12. Participant reads ---------------------------------------------------------------------------------------------------
create or replace function public.quiz_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id(); at timestamptz := statement_timestamp(); w date := public.quiz_week_at(at);
  s public.sport_quiz_settings%rowtype; pref jsonb; available text; pools jsonb := '[]'; aid uuid; scheduled text;
begin
  select * into s from public.sport_quiz_settings where singleton;
  if auth.uid() is null or me is null or public.profile_age_band(me) not in ('adult','teen_13_15','teen_16_17') then me := null; available := 'ineligible';
  elsif s.singleton is null then available := 'unavailable';
  elsif not s.enabled then available := 'paused';
  elsif not (me = any(s.pilot_accounts)) then available := 'not_enrolled'; else available := 'ready'; end if;
  pref := public.quiz_preferences_dto(me);
  scheduled := case when public.quiz_fun_slot(me,w) then 'fun' else 'sport' end;
  if available = 'ready' then
    select coalesce(jsonb_agg(jsonb_build_object('topic_category',x.topic_category,'sport',x.sport,'unseen_count',x.n,
      'allowed',case when x.topic_category = 'sport' then scheduled = 'sport' or not public.quiz_fun_available(me) else scheduled = 'fun' end) order by x.topic_category,x.sport),'[]') into pools
    from (select q.topic_category,q.sport,count(*) filter (where not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = me and e.question_key = q.question_key)) n
      from public.sport_quiz_questions q where q.status = 'approved' and q.question_type <> 'image_choice' and public.quiz_normalize_options(q.options) is not null
        and char_length(btrim(q.source_notes)) >= 10 group by q.topic_category,q.sport) x;
    if not exists(select 1 from jsonb_array_elements(pools) p where (p ->> 'unseen_count')::int > 0 and (p ->> 'allowed')::boolean) then available := 'unavailable'; end if;
  end if;
  if me is not null and s.singleton is not null then select id into aid from public.sport_quiz_attempts where profile_id = me and week_start = w; end if;
  return jsonb_build_object('contract_version',2,'profile_id',me,'server_now',at,'week_start',w,'week_end',w + 7,'testing_only',true,
    'availability',available,'preferences',pref,'attempt',public.quiz_summary(aid,at),
    'week_spent',me is not null and exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = w),
    'scheduled_topic',scheduled,'pools',pools,'history_version',(pref ->> 'history_version')::bigint,
    'history_count',(select count(*) from public.sport_quiz_attempts a where a.profile_id = me and public.quiz_summary(a.id,at) ->> 'status' <> 'issued'),
    'badge_count',(select count(*) from public.sport_quiz_badges where profile_id = me and voided_at is null),
    'correction_count',(select count(*) from public.sport_quiz_attempts where profile_id = me and status = 'void')
      + (select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.profile_id = me and i.status = 'void' and a.status <> 'void'),
    'round_size',coalesce(s.round_size,5),'groups_available',coalesce(s.groups_enabled,false) and available = 'ready');
end $$;

create or replace function public.quiz_history(p_before text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); at timestamptz := statement_timestamp(); c jsonb := public.quiz_cursor(p_before,'history'); items jsonb; next_before text;
  last_id uuid; last_week date; total bigint;
begin
  select count(*) into total from public.sport_quiz_attempts a where a.profile_id = me and public.quiz_summary(a.id,at) ->> 'status' <> 'issued';
  select coalesce(jsonb_agg(jsonb_build_object('attempt',public.quiz_summary(a.id,at),'question',public.quiz_question_dto(a.question_id),
    'result',case when a.mode = 'round' then null else public.quiz_result_dto(a.id,at) end,
    'items',case when a.mode = 'round' then public.quiz_round_items_dto(a.id,at) else '[]'::jsonb end,
    'badge',(select to_jsonb(b) - 'profile_id' - 'attempt_id' - 'week_start' from public.sport_quiz_badges b where b.attempt_id = a.id and b.kind = 'weekly' limit 1))
    order by a.week_start desc,a.id desc),'[]') into items
  from (select * from public.sport_quiz_attempts x where x.profile_id = me and public.quiz_summary(x.id,at) ->> 'status' <> 'issued'
    and (c is null or (x.week_start,x.id) < ((c ->> 'at')::date,(c ->> 'id')::uuid)) order by x.week_start desc,x.id desc limit 50) a;
  if jsonb_array_length(items) = 50 then
    last_id := (items -> 49 -> 'attempt' ->> 'id')::uuid; last_week := (items -> 49 -> 'attempt' ->> 'week_start')::date;
    if exists(select 1 from public.sport_quiz_attempts x where x.profile_id = me and public.quiz_summary(x.id,at) ->> 'status' <> 'issued' and (x.week_start,x.id) < (last_week,last_id)) then
      next_before := jsonb_build_object('v',1,'stream','history','at',last_week,'id',last_id)::text;
    end if;
  end if;
  return jsonb_build_object('contract_version',2,'profile_id',me,'server_now',at,'history_version',(public.quiz_preferences_dto(me) ->> 'history_version')::bigint,
    'total',total,'items',items,'next_before',next_before);
end $$;

create or replace function public.quiz_badge_shelf()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_actor();
begin
  return jsonb_build_object('contract_version',3,'profile_id',me,
    'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'label',b.label,'kind',b.kind,'sport',b.sport,'period',b.period,
      'visibility',b.visibility,'issued_at',b.issued_at) order by b.issued_at desc,b.id) from public.sport_quiz_badges b where b.profile_id = me and b.voided_at is null),'[]'::jsonb));
end $$;

create or replace function public.quiz_badge_visibility(p_badge_id uuid,p_visibility text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); b public.sport_quiz_badges%rowtype;
begin
  if p_badge_id is null or coalesce(p_visibility,'') not in ('private','groups') then raise exception 'quiz_badge_invalid'; end if;
  perform public.quiz_lock(me);
  update public.sport_quiz_badges set visibility = p_visibility where id = p_badge_id and profile_id = me and voided_at is null returning * into b;
  if b.id is null then raise exception 'quiz_badge_missing'; end if;
  return jsonb_build_object('contract_version',3,'id',b.id,'label',b.label,'kind',b.kind,'sport',b.sport,'period',b.period,'visibility',b.visibility,'issued_at',b.issued_at);
end $$;

-- Own data only: facts by sport and topic in one calendar quarter (a season until sport seasons are defined).
create or replace function public.quiz_season_recap(p_quarter text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); qkey text; qs date; qe date; per_sport jsonb; per_topic jsonb; rounds bigint;
begin
  if p_quarter is not null and p_quarter !~ '^[0-9]{4}-Q[1-4]$' then raise exception 'quiz_recap_invalid'; end if;
  qkey := coalesce(p_quarter,public.quiz_quarter_of((statement_timestamp() at time zone 'UTC')::date));
  qs := make_date(split_part(qkey,'-Q',1)::int,(split_part(qkey,'-Q',2)::int - 1) * 3 + 1,1); qe := (qs + interval '3 months')::date;
  with f as (
    select q.topic_category,q.sport from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
      join public.sport_quiz_questions q on q.id = i.question_id
      where a.profile_id = me and i.status = 'answered' and a.week_start >= qs and a.week_start < qe
    union all
    select q.topic_category,q.sport from public.sport_quiz_attempts a join public.sport_quiz_questions q on q.id = a.question_id
      where a.profile_id = me and a.mode <> 'round' and a.status = 'completed' and a.week_start >= qs and a.week_start < qe)
  select coalesce((select jsonb_agg(jsonb_build_object('sport',sport,'facts',n) order by n desc,sport) from (select sport,count(*) n from f where topic_category = 'sport' group by sport) x),'[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('topic_category',topic_category,'facts',n) order by topic_category) from (select topic_category,count(*) n from f group by topic_category) y),'[]'::jsonb)
    into per_sport,per_topic;
  select count(*) into rounds from public.sport_quiz_attempts a where a.profile_id = me and a.week_start >= qs and a.week_start < qe
    and ((a.mode = 'round' and exists(select 1 from public.sport_quiz_round_items i where i.attempt_id = a.id and i.status = 'answered')) or (a.mode <> 'round' and a.status = 'completed'));
  return jsonb_build_object('contract_version',3,'profile_id',me,'quarter',qkey,'starts_on',qs,'ends_before',qe,
    'facts',public.quiz_facts(me,qs,qe),'sports',jsonb_array_length(per_sport),'rounds',rounds,'per_sport',per_sport,'per_topic',per_topic,
    'badges',(select count(*) from public.sport_quiz_badges b where b.profile_id = me and b.voided_at is null and b.issued_at >= qs and b.issued_at < qe));
end $$;

-- 13. Groups: participant RPCs -------------------------------------------------------------------------------------------
create or replace function public.quiz_group_create(p_name_key text,p_theme_sport text,p_request_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; g public.sport_quiz_groups%rowtype; code jsonb; theme text := nullif(btrim(coalesce(p_theme_sport,'')),'');
begin
  if p_request_id is null or coalesce(p_name_key,'') not in ('family','friends','team_fans','cousins','game_day_crew','home_team')
    or (theme is not null and char_length(theme) not between 2 and 80) then raise exception 'quiz_group_invalid'; end if;
  perform public.quiz_lock(me); at := clock_timestamp();
  select * into g from public.sport_quiz_groups where create_request_id = p_request_id;
  if found then
    if g.created_by is distinct from me then raise exception 'quiz_request_conflict'; end if;
    -- The code is shown once; a retry gets the page and can renew the code.
    return public.quiz_group_page_dto(g.id,me,at) || jsonb_build_object('code',null,'code_shown',false);
  end if;
  perform public.quiz_require_testing(me);
  if not (select groups_enabled from public.sport_quiz_settings where singleton) then raise exception 'quiz_groups_paused'; end if;
  if theme is not null and not exists(select 1 from public.sport_quiz_questions q where q.status = 'approved' and q.topic_category = 'sport' and q.sport = theme) then raise exception 'quiz_group_theme_invalid'; end if;
  if (select count(*) from public.sport_quiz_groups where owner_id = me and status = 'active') >= 3 then raise exception 'quiz_group_create_limit'; end if;
  if (select count(*) from public.sport_quiz_group_members m join public.sport_quiz_groups x on x.id = m.group_id where m.profile_id = me and m.status = 'active' and x.status = 'active') >= 5 then raise exception 'quiz_group_member_limit'; end if;
  insert into public.sport_quiz_groups(name_key,theme_sport,owner_id,created_by,create_request_id,created_at) values(p_name_key,theme,me,me,p_request_id,at) returning * into g;
  insert into public.sport_quiz_group_members(group_id,profile_id,status,joined_at) values(g.id,me,'active',at);
  perform public.log_supervision_event(me,'trivia_group_joined','{}'::jsonb);
  code := public.quiz_group_issue_code(g.id,me,at);
  perform public.quiz_sync_badges(me,at);
  return public.quiz_group_page_dto(g.id,me,at) || jsonb_build_object('code',code ->> 'code','code_shown',true);
end $$;

-- Wrong or refused codes return (never raise) so the counted try survives; every refusal reads the same to the joiner.
create or replace function public.quiz_group_join(p_code text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; h text; gid uuid; why text; tries bigint; joins bigint;
begin
  if p_code is null or char_length(p_code) > 40 then raise exception 'quiz_group_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for share;
  if not found then raise exception 'quiz_unavailable'; end if;
  perform public.quiz_require_testing(me);
  if not (select groups_enabled from public.sport_quiz_settings where singleton) then raise exception 'quiz_groups_paused'; end if;
  h := public.hash_secret(upper(regexp_replace(p_code,'[^A-Za-z0-9]','','g')));
  select group_id into gid from public.sport_quiz_group_codes where code_hash = h;
  if gid is not null then perform 1 from public.sport_quiz_groups where id = gid for update; end if;
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz:' || me,0));
  at := clock_timestamp();
  select count(*) filter (where outcome in ('wrong_code','refused')),count(*) filter (where outcome = 'joined') into tries,joins
    from public.sport_quiz_group_join_attempts where profile_id = me and created_at > at - interval '1 day';
  if tries >= 10 then raise exception 'quiz_group_try_limit'; end if;
  if gid is not null and exists(select 1 from public.sport_quiz_group_members where group_id = gid and profile_id = me and status = 'active') then
    return jsonb_build_object('contract_version',3,'outcome','joined','group',public.quiz_group_page_dto(gid,me,at));
  end if;
  if gid is null or not exists(select 1 from public.sport_quiz_group_codes where group_id = gid and code_hash = h and expires_at > at) then
    insert into public.sport_quiz_group_join_attempts(profile_id,group_id,outcome,created_at,prune_after) values(me,null,'wrong_code',at,at + interval '35 days');
    return jsonb_build_object('contract_version',3,'outcome','refused','group',null);
  end if;
  if joins >= 5 then raise exception 'quiz_group_join_limit'; end if;
  if (select count(*) from public.sport_quiz_group_members m join public.sport_quiz_groups x on x.id = m.group_id where m.profile_id = me and m.status = 'active' and x.status = 'active') >= 5 then raise exception 'quiz_group_member_limit'; end if;
  why := public.quiz_group_refusal(gid,me);
  if why is not null then
    insert into public.sport_quiz_group_join_attempts(profile_id,group_id,outcome,refusal_reason,created_at,prune_after) values(me,gid,'refused',why,at,at + interval '35 days');
    if why = 'full' then delete from public.sport_quiz_group_codes where group_id = gid; end if;
    return jsonb_build_object('contract_version',3,'outcome','refused','group',null);
  end if;
  -- A teen_rule or closed removal leaves no rejoin bar; the row is reused when the rules allow the join again.
  insert into public.sport_quiz_group_members(group_id,profile_id,status,joined_at) values(gid,me,'active',at)
    on conflict (group_id,profile_id) do update set status = 'active',joined_at = excluded.joined_at,removed_at = null,removed_reason = null;
  insert into public.sport_quiz_group_join_attempts(profile_id,group_id,outcome,created_at,prune_after) values(me,gid,'joined',at,at + interval '35 days');
  perform public.log_supervision_event(me,'trivia_group_joined','{}'::jsonb);
  if public.quiz_group_active_count(gid) >= 12 then delete from public.sport_quiz_group_codes where group_id = gid; end if;
  perform public.quiz_sync_badges(me,at);
  return jsonb_build_object('contract_version',3,'outcome','joined','group',public.quiz_group_page_dto(gid,me,at));
end $$;

create or replace function public.quiz_group_leave(p_group_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; g public.sport_quiz_groups%rowtype;
begin
  perform 1 from public.sport_quiz_settings where singleton for share;
  select * into g from public.sport_quiz_groups where id = p_group_id for update;
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz:' || me,0)); at := clock_timestamp();
  delete from public.sport_quiz_group_members where group_id = p_group_id and profile_id = me and status = 'active';
  if not found then return jsonb_build_object('contract_version',3,'outcome','not_member'); end if;
  perform public.log_supervision_event(me,'trivia_group_left','{}'::jsonb);
  if g.owner_id = me then perform public.quiz_group_handover(g.id,me,at);
  elsif public.quiz_group_active_count(g.id) = 0 then
    update public.sport_quiz_groups set status = 'closed',closed_at = at,close_reason = 'dissolved' where id = g.id and status = 'active';
  end if;
  return jsonb_build_object('contract_version',3,'outcome','left');
end $$;

create or replace function public.quiz_group_owned(p_group uuid,p_me uuid)
returns public.sport_quiz_groups language plpgsql security definer set search_path = '' as $$
declare g public.sport_quiz_groups%rowtype;
begin
  perform 1 from public.sport_quiz_settings where singleton for share;
  select * into g from public.sport_quiz_groups where id = p_group for update;
  if g.id is null or g.status <> 'active' or g.owner_id is distinct from p_me then raise exception 'quiz_group_not_owner'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz:' || p_me,0));
  return g;
end $$;

drop function if exists public.quiz_group_remove_member(uuid,uuid,uuid);
create or replace function public.quiz_group_remove_member(p_group_id uuid,p_member_ref text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; g public.sport_quiz_groups%rowtype; code jsonb; p_profile_id uuid;
begin
  g := public.quiz_group_owned(p_group_id,me); at := clock_timestamp();
  if p_member_ref is null or p_member_ref !~ '^[0-9a-f]{32}$' then raise exception 'quiz_group_invalid'; end if;
  select profile_id into p_profile_id from public.sport_quiz_group_members where group_id = g.id and status = 'active' and public.quiz_member_ref(g.id,profile_id) = p_member_ref;
  if p_profile_id = me then raise exception 'quiz_group_invalid'; end if;
  if p_profile_id is null then
    return public.quiz_group_page_dto(g.id,me,at) || jsonb_build_object('code',null);
  end if;
  perform public.quiz_group_mark_removed(g.id,p_profile_id,'creator',me,null,at);
  -- The code rotates: the old one stops working and the creator gets the new one now.
  code := public.quiz_group_issue_code(g.id,me,at);
  return public.quiz_group_page_dto(g.id,me,at) || jsonb_build_object('code',code ->> 'code');
end $$;

create or replace function public.quiz_group_renew_code(p_group_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; g public.sport_quiz_groups%rowtype; code jsonb;
begin
  g := public.quiz_group_owned(p_group_id,me); at := clock_timestamp();
  if not (select groups_enabled from public.sport_quiz_settings where singleton) then raise exception 'quiz_groups_paused'; end if;
  if public.quiz_group_active_count(g.id) >= 12 then raise exception 'quiz_group_full'; end if;
  code := public.quiz_group_issue_code(g.id,me,at);
  return jsonb_build_object('contract_version',3,'group_id',g.id,'code',code ->> 'code','expires_at',code -> 'expires_at');
end $$;

create or replace function public.quiz_group_set_theme(p_group_id uuid,p_theme_sport text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); g public.sport_quiz_groups%rowtype; theme text := nullif(btrim(coalesce(p_theme_sport,'')),'');
begin
  if theme is not null and char_length(theme) not between 2 and 80 then raise exception 'quiz_group_invalid'; end if;
  g := public.quiz_group_owned(p_group_id,me);
  if theme is not null and not exists(select 1 from public.sport_quiz_questions q where q.status = 'approved' and q.topic_category = 'sport' and q.sport = theme) then raise exception 'quiz_group_theme_invalid'; end if;
  -- A theme is a sport filter; a set already drawn this week keeps its questions.
  update public.sport_quiz_groups set theme_sport = theme where id = g.id;
  return public.quiz_group_page_dto(g.id,me,clock_timestamp());
end $$;

create or replace function public.quiz_group_page(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); m public.sport_quiz_group_members%rowtype; g public.sport_quiz_groups%rowtype;
begin
  -- Read-only unless the rules drifted (a birthday, for example); then settle under settings → group locks first.
  if exists(select 1 from public.sport_quiz_group_members where group_id = p_group_id and profile_id = me and status = 'active')
     and public.quiz_group_needs_recheck(p_group_id) then
    perform 1 from public.sport_quiz_settings where singleton for share;
    perform 1 from public.sport_quiz_groups where id = p_group_id and status = 'active' for update;
    perform public.quiz_group_recheck_group(p_group_id);
  end if;
  select * into m from public.sport_quiz_group_members where group_id = p_group_id and profile_id = me;
  if m.group_id is null then raise exception 'quiz_group_not_member'; end if;
  select * into g from public.sport_quiz_groups where id = p_group_id;
  -- One message for a creator removal, a block removal or an admin removal.
  if m.status = 'removed' then return jsonb_build_object('contract_version',3,'group_id',p_group_id,'name_key',g.name_key,'outcome','removed'); end if;
  return public.quiz_group_page_dto(p_group_id,me,statement_timestamp()) || jsonb_build_object('outcome',case when g.status = 'active' then 'member' else 'closed' end);
end $$;

create or replace function public.quiz_groups_mine()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); at timestamptz := statement_timestamp(); w date := public.quiz_week_at(at);
begin
  return jsonb_build_object('contract_version',3,'profile_id',me,'week_start',w,
    'groups_enabled',coalesce((select groups_enabled from public.sport_quiz_settings where singleton),false),
    'groups',coalesce((select jsonb_agg(jsonb_build_object('group_id',g.id,'name_key',g.name_key,'theme_sport',g.theme_sport,'is_owner',g.owner_id = me,
        'members',public.quiz_group_active_count(g.id),'played_this_week',public.quiz_played(me,w),
        'everyone_played',(select bool_and(public.quiz_played(x.profile_id,w)) from public.sport_quiz_group_members x where x.group_id = g.id and x.status = 'active'))
        order by m.joined_at,g.id)
      from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id where m.profile_id = me and m.status = 'active' and g.status = 'active'),'[]'::jsonb),
    'removed',coalesce((select jsonb_agg(jsonb_build_object('group_id',g.id,'name_key',g.name_key) order by m.removed_at desc)
      from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id where m.profile_id = me and m.status = 'removed'),'[]'::jsonb),
    'limits',jsonb_build_object('created',(select count(*) from public.sport_quiz_groups where owner_id = me and status = 'active'),'create_limit',3,
      'belong',(select count(*) from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id where m.profile_id = me and m.status = 'active' and g.status = 'active'),
      'belong_limit',5,'max_members',12));
end $$;

create or replace function public.quiz_group_report(p_group_id uuid,p_reason_code text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz;
begin
  if p_group_id is null or coalesce(p_reason_code,'') not in ('safety','unwanted_contact','name_or_theme','other') then raise exception 'quiz_group_invalid'; end if;
  perform public.quiz_lock(me); at := clock_timestamp();
  -- Members and removed members can report; nobody else learns whether the group exists.
  if not exists(select 1 from public.sport_quiz_group_members where group_id = p_group_id and profile_id = me) then raise exception 'quiz_group_not_member'; end if;
  if (select count(*) from public.sport_quiz_group_cases where actor_id = me and kind = 'report' and created_at > at - interval '1 day') >= 5 then raise exception 'quiz_group_report_limit'; end if;
  perform public.quiz_group_case(p_group_id,'report',me,null,p_reason_code,null,at);
  return jsonb_build_object('contract_version',3,'outcome','reported','group_id',p_group_id);
end $$;

-- 14. Blocks remove the blocked party; a deleted creator hands the group over ------------------------------------------
create or replace function public.quiz_groups_on_block()
returns trigger language plpgsql security definer set search_path = '' as $$
declare gid uuid; at timestamptz := clock_timestamp();
begin
  perform 1 from public.sport_quiz_settings where singleton for share;
  for gid in select m1.group_id from public.sport_quiz_group_members m1 join public.sport_quiz_group_members m2 on m2.group_id = m1.group_id
      where m1.profile_id = new.blocker_id and m2.profile_id = new.blocked_id and m1.status = 'active' and m2.status = 'active' order by m1.group_id loop
    perform 1 from public.sport_quiz_groups where id = gid for update;
    perform public.quiz_group_mark_removed(gid,new.blocked_id,'blocked',new.blocker_id,null,at);
  end loop;
  return new;
end $$;
drop trigger if exists quiz_groups_block on public.user_blocks;
create trigger quiz_groups_block after insert on public.user_blocks for each row execute function public.quiz_groups_on_block();

-- Age correction / under-13 closure (remove this account) or a friend-request setting change (remove whom it refuses).
create or replace function public.quiz_groups_on_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.sport_quiz_group_members where profile_id = new.id and status = 'active') then return new; end if;
  if (new.birth_year,new.birth_month,new.age_blocked_at) is distinct from (old.birth_year,old.birth_month,old.age_blocked_at) then
    -- MINOR-01 applies teen defaults in a second update of the same transaction; remember that this account changed.
    perform set_config('quiz.age_changed',new.id::text,true);
    perform public.quiz_group_recheck(new.id,true);
  elsif new.friend_requests_from is distinct from old.friend_requests_from then
    perform public.quiz_group_recheck(new.id,coalesce(current_setting('quiz.age_changed',true),'') = new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists quiz_groups_profile_rules on public.profiles;
create trigger quiz_groups_profile_rules after update of birth_year,birth_month,friend_requests_from,age_blocked_at on public.profiles
  for each row execute function public.quiz_groups_on_profile();

create or replace function public.quiz_groups_on_friendship()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'accepted' then perform public.quiz_group_recheck_pair(old.requester_id,old.addressee_id); end if;
    return old;
  end if;
  if old.status = 'accepted' and new.status is distinct from 'accepted' then perform public.quiz_group_recheck_pair(new.requester_id,new.addressee_id); end if;
  return new;
end $$;
drop trigger if exists quiz_groups_friendship_rules on public.friendships;
create trigger quiz_groups_friendship_rules after delete or update of status on public.friendships
  for each row execute function public.quiz_groups_on_friendship();

create or replace function public.quiz_groups_on_guardian_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.ended_at is null and new.ended_at is not null then perform public.quiz_group_recheck_pair(new.minor_id,new.guardian_id); end if;
  return new;
end $$;
drop trigger if exists quiz_groups_guardian_rules on public.guardian_links;
create trigger quiz_groups_guardian_rules after update of ended_at on public.guardian_links
  for each row execute function public.quiz_groups_on_guardian_link();

create or replace function public.quiz_group_owner_gone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.owner_id is not null and new.owner_id is null and new.status = 'active' then
    new.owner_id := (select profile_id from public.sport_quiz_group_members where group_id = new.id and status = 'active' and profile_id <> old.owner_id
                     order by joined_at,profile_id limit 1);
    delete from public.sport_quiz_group_codes where group_id = new.id;
    if new.owner_id is null then new.status := 'closed'; new.closed_at := clock_timestamp(); new.close_reason := 'dissolved'; end if;
    insert into public.sport_quiz_group_cases(group_id,kind,subject_id,created_at) values(new.id,case when new.owner_id is null then 'dissolved' else 'handover' end,new.owner_id,clock_timestamp());
  end if;
  return new;
end $$;
drop trigger if exists quiz_group_owner_gone on public.sport_quiz_groups;
create trigger quiz_group_owner_gone before update of owner_id on public.sport_quiz_groups for each row execute function public.quiz_group_owner_gone();

create or replace function public.quiz_guard_group_case()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Account deletion may null actor/subject; nothing else may rewrite or remove the safety record.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 and (to_jsonb(new) - 'actor_id' - 'subject_id') = (to_jsonb(old) - 'actor_id' - 'subject_id')
     and (new.actor_id is null or new.actor_id = old.actor_id) and (new.subject_id is null or new.subject_id = old.subject_id) then return new; end if;
  raise exception 'quiz_group_case_immutable';
end $$;
drop trigger if exists quiz_group_case_guard on public.sport_quiz_group_cases;
create trigger quiz_group_case_guard before update or delete on public.sport_quiz_group_cases for each row execute function public.quiz_guard_group_case();
drop trigger if exists quiz_group_case_truncate_guard on public.sport_quiz_group_cases;
create trigger quiz_group_case_truncate_guard before truncate on public.sport_quiz_group_cases for each statement execute function public.quiz_guard_group_case();

-- 15. Guardian supervision: MINOR-01's summary copied with one more count ("trivia_groups") -----------------------------
create or replace function public.supervision_json(minor uuid, events_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', p.id,
    'first_name', public.first_name_of(p.id),
    'username', p.username,
    'settings', public.privacy_settings_json(p.id),
    'status', public.minor_status_json(p.id, false),
    'summary', jsonb_build_object(
      'friends', (select count(*) from public.friendships f where f.status = 'accepted' and p.id in (f.requester_id, f.addressee_id)),
      'incoming_requests', (select count(*) from public.friendships f where f.status = 'pending' and f.addressee_id = p.id),
      'blocked_accounts', (select count(*) from public.user_blocks u where u.blocker_id = p.id),
      'tags_waiting', (select count(*) from public.reels r
                       where r.player_id = public.verified_player_of(p.id) and r.tag_status = 'pending'),
      'hidden_from_search', p.hide_from_search,
      -- QUIZ-03: a count only, the same for teen and guardian; no group names, members or pages.
      'trivia_groups', (select count(*) from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id
                        where m.profile_id = p.id and m.status = 'active' and g.status = 'active')
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'detail', e.detail, 'at', e.created_at,
                                          'by_teen', e.actor_id is not distinct from p.id) order by e.created_at desc)
      from (
        select * from public.supervision_events e
        where e.minor_id = p.id and e.created_at >= coalesce(events_since, '-infinity'::timestamptz)
          and e.created_at > timezone('utc', now()) - interval '365 days'
        order by e.created_at desc limit 30
      ) e
    ), '[]'::jsonb)
  )
  from public.profiles p where p.id = minor;
$$;

-- 16. Erasure ---------------------------------------------------------------------------------------------------------
-- Also leaves every group (hand-over or dissolve), removes the sets of groups that dissolve and every badge
-- (including group-visible ones). Join attempts stay until their 35-day prune (like the week guard), so erasing
-- cannot reset the try/join limits or remove refusal evidence; removed-member tombstones keep barring a rejoin.
create or replace function public.quiz_erase_history(p_expected_history_version bigint,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; w date; rev bigint; na bigint; ne bigint; nb bigint; nr bigint; nau bigint;
  prune timestamptz; gid uuid; owner uuid; ng bigint := 0; nj bigint; ns bigint := 0; n bigint;
begin
  -- Lock order: settings → each group (ordered) → account.
  perform 1 from public.sport_quiz_settings where singleton for share;
  if not found then raise exception 'quiz_unavailable'; end if;
  for gid in select group_id from public.sport_quiz_group_members where profile_id = me and status = 'active' order by group_id loop
    perform 1 from public.sport_quiz_groups where id = gid for update;
  end loop;
  perform public.quiz_lock(me); at := clock_timestamp(); w := public.quiz_week_at(at);
  insert into public.sport_quiz_preferences(profile_id) values(me) on conflict do nothing;
  select history_version into rev from public.sport_quiz_preferences where profile_id = me for update;
  if rev is distinct from p_expected_history_version then raise exception 'quiz_history_stale'; end if;
  perform public.quiz_spend(me,w,at);
  select prune_after into prune from public.sport_quiz_week_guards where profile_id = me and week_start = w;
  select count(*) into na from public.sport_quiz_attempts where profile_id = me;
  for gid in select group_id from public.sport_quiz_group_members where profile_id = me and status = 'active' order by group_id loop
    delete from public.sport_quiz_group_members where group_id = gid and profile_id = me;
    ng := ng + 1;
    perform public.log_supervision_event(me,'trivia_group_left','{}'::jsonb);
    select owner_id into owner from public.sport_quiz_groups where id = gid;
    if owner = me then perform public.quiz_group_handover(gid,me,at);
    elsif public.quiz_group_active_count(gid) = 0 then
      update public.sport_quiz_groups set status = 'closed',closed_at = at,close_reason = 'dissolved' where id = gid and status = 'active';
    end if;
    if (select status from public.sport_quiz_groups where id = gid) = 'closed' then
      delete from public.sport_quiz_group_sets where group_id = gid; get diagnostics n = row_count; ns := ns + n;
    end if;
  end loop;
  select count(*) into nj from public.sport_quiz_group_join_attempts where profile_id = me;
  delete from public.sport_quiz_badges where profile_id = me; get diagnostics nb = row_count;
  delete from public.sport_quiz_requests where profile_id = me; get diagnostics nr = row_count;
  delete from public.sport_quiz_exposures where profile_id = me; get diagnostics ne = row_count;
  perform set_config('quiz.erase_profile',me::text,true);
  delete from public.sport_quiz_audit where actor_id = me and action in ('start','answer','skip','end'); get diagnostics nau = row_count;
  perform set_config('quiz.erase_profile','',true);
  delete from public.sport_quiz_attempts where profile_id = me;
  update public.sport_quiz_preferences set history_version = history_version + 1,updated_at = at where profile_id = me;
  return jsonb_build_object('contract_version',2,'profile_id',me,'history_version',rev + 1,'week_start',w,'week_spent',true,'quota_prune_after',prune,
    'removed_attempts',na,'removed_exposures',ne,'removed_badges',nb,'removed_requests',nr,'removed_audit',nau,
    'removed_group_memberships',ng,'retained_join_attempts',nj,'removed_group_sets',ns);
end $$;

-- 17. Admin ------------------------------------------------------------------------------------------------------------
-- QUIZ-02 settings with round-aware closure: pause or removal settles and ends active rounds for good.
create or replace function public.quiz_admin_settings(p_payload jsonb,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); testers uuid[]; next_enabled boolean; at timestamptz; affected uuid; rid uuid;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload -> 'enabled') is distinct from 'boolean'
    or jsonb_typeof(p_payload -> 'pilot_accounts') is distinct from 'array' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('enabled','pilot_accounts')) then raise exception 'quiz_settings_invalid'; end if;
  if jsonb_array_length(p_payload -> 'pilot_accounts') > 100 then raise exception 'quiz_testers_limit'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload -> 'pilot_accounts') v where jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'quiz_settings_invalid'; end if;
  select coalesce(array_agg(x::uuid),'{}'::uuid[]) into testers from jsonb_array_elements_text(p_payload -> 'pilot_accounts') x;
  next_enabled := (p_payload ->> 'enabled')::boolean;
  if cardinality(testers) <> (select count(distinct x) from unnest(testers) x) then raise exception 'quiz_testers_duplicate'; end if;
  if next_enabled and cardinality(testers) = 0 then raise exception 'quiz_testers_required'; end if;
  if next_enabled and exists(select 1 from unnest(testers) x where public.profile_age_band(x) not in ('adult','teen_13_15','teen_16_17') or
    not exists(select 1 from public.profiles p where p.id = x and p.age_blocked_at is null)) then raise exception 'quiz_testers_ineligible'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  update public.sport_quiz_settings set enabled = next_enabled,pilot_accounts = testers,reason = btrim(p_reason),updated_at = at,updated_by = me where singleton;
  for affected in select distinct profile_id from public.sport_quiz_attempts where status = 'issued' and (not next_enabled or not (profile_id = any(testers))) order by profile_id loop
    perform public.quiz_lock(affected);
  end loop;
  for affected in with changed as (update public.sport_quiz_attempts set status = case when expires_at <= at then 'expired' else 'ended' end,
      closed_at = case when expires_at <= at then expires_at else at end,close_reason = case when expires_at <= at then 'deadline' when not next_enabled then 'paused' else 'access_revoked' end,session_hash = null
      where mode <> 'round' and status = 'issued' and (not next_enabled or not (profile_id = any(testers))) returning profile_id) select distinct profile_id from changed order by profile_id loop
    perform public.quiz_bump_history(affected);
  end loop;
  for rid in select id from public.sport_quiz_attempts where mode = 'round' and status = 'issued' and (not next_enabled or not (profile_id = any(testers))) order by profile_id,id loop
    perform public.quiz_round_settle(rid,at);
    perform public.quiz_round_close(rid,at,case when not next_enabled then 'paused' else 'access_revoked' end);
  end loop;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'settings',btrim(p_reason),at);
  return jsonb_build_object('contract_version',2,'enabled',next_enabled,'testing_only',true,'pilot_accounts',testers);
end $$;

create or replace function public.quiz_admin_play_settings(p_payload jsonb,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; s public.sport_quiz_settings%rowtype;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('round_size','groups_enabled','images_enabled'))
    or jsonb_typeof(p_payload -> 'round_size') is distinct from 'number' or (p_payload ->> 'round_size') !~ '^[1-5]$'
    or jsonb_typeof(p_payload -> 'groups_enabled') is distinct from 'boolean' or jsonb_typeof(p_payload -> 'images_enabled') is distinct from 'boolean' then raise exception 'quiz_settings_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  -- New rounds use the new size; a paused groups switch stops new groups, joins and group rounds without touching data.
  update public.sport_quiz_settings set round_size = (p_payload ->> 'round_size')::int,groups_enabled = (p_payload ->> 'groups_enabled')::boolean,
    images_enabled = (p_payload ->> 'images_enabled')::boolean,reason = btrim(p_reason),updated_at = at,updated_by = me where singleton returning * into s;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'settings',btrim(p_reason),at);
  return jsonb_build_object('contract_version',3,'round_size',s.round_size,'groups_enabled',s.groups_enabled,'images_enabled',s.images_enabled);
end $$;

create or replace function public.quiz_admin_question(p_id uuid,p_action text,p_payload jsonb,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); q public.sport_quiz_questions%rowtype; nextq public.sport_quiz_questions%rowtype;
  why text := btrim(p_payload ->> 'reason'); family uuid; at timestamptz; affected uuid; qtype text; opts jsonb; rid uuid; ritem record;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(p_action,'') not in ('create','edit','approve','archive','void','review_media') or char_length(coalesce(why,'')) not between 10 and 500
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('reason','sport','prompt','options','correct_option','explanation','topic_category','source_notes','family_action','question_key',
      'question_type','media_path','media_licence','media_source','media_attribution','media_alt_text','media_size_bytes','media_has_person','media_no_marks','media_exif_stripped')) then raise exception 'quiz_question_action_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  if p_action = 'void' then
    for affected in select profile_id from public.sport_quiz_attempts where question_id = p_id
        union select a.profile_id from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where i.question_id = p_id order by 1 loop
      perform public.quiz_lock(affected);
    end loop;
  end if;
  if p_action <> 'create' then select * into q from public.sport_quiz_questions where id = p_id for update; if not found then raise exception 'quiz_question_missing'; end if;
  elsif p_id is not null then raise exception 'quiz_create_id_invalid'; end if;
  if p_action in ('create','edit') then
    if p_action = 'create' then
      if coalesce(p_payload ->> 'family_action','') not in ('new','existing') then raise exception 'quiz_family_required'; end if;
      if p_payload ->> 'family_action' = 'new' then
        if p_payload ? 'question_key' then raise exception 'quiz_family_invalid'; end if; family := gen_random_uuid();
      else
        if coalesce(p_payload ->> 'question_key','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'quiz_family_invalid'; end if;
        family := (p_payload ->> 'question_key')::uuid; if not exists(select 1 from public.sport_quiz_questions where question_key = family) then raise exception 'quiz_family_invalid'; end if;
      end if;
    else
      family := q.question_key;
      if (p_payload ? 'question_key' and p_payload ->> 'question_key' <> family::text) or (p_payload ? 'family_action' and p_payload ->> 'family_action' <> 'existing') then raise exception 'quiz_family_invalid'; end if;
    end if;
    qtype := coalesce(p_payload ->> 'question_type','choice4'); opts := p_payload -> 'options';
    if qtype not in ('choice4','true_false','image_choice') or jsonb_typeof(opts) is distinct from 'array'
      or (qtype = 'choice4' and jsonb_array_length(opts) <> 4) or (qtype = 'true_false' and opts <> '["True","False"]'::jsonb)
      or (qtype = 'image_choice' and jsonb_array_length(opts) not between 2 and 4) then raise exception 'quiz_question_content_invalid'; end if;
    if coalesce(p_payload ->> 'topic_category','') not in ('sport','science','geography','general') or char_length(btrim(coalesce(p_payload ->> 'source_notes',''))) not between 10 and 1000
      or jsonb_typeof(p_payload -> 'correct_option') is distinct from 'number' or (p_payload ->> 'correct_option') !~ '^[0-3]$'
      or (p_payload ->> 'correct_option')::int >= jsonb_array_length(opts) then raise exception 'quiz_question_content_invalid'; end if;
    if exists(select 1 from unnest(array['sport','prompt','explanation','source_notes']) k where jsonb_typeof(p_payload -> k) is distinct from 'string') then raise exception 'quiz_question_content_invalid'; end if;
    if qtype = 'image_choice' then
      if exists(select 1 from unnest(array['media_path','media_licence','media_source','media_attribution','media_alt_text']) k where jsonb_typeof(p_payload -> k) is distinct from 'string')
        or jsonb_typeof(p_payload -> 'media_size_bytes') is distinct from 'number' or (p_payload ->> 'media_size_bytes') !~ '^[0-9]{1,6}$'
        or (p_payload ->> 'media_size_bytes')::int not between 1 and 307200 or p_payload -> 'media_has_person' is distinct from 'false'::jsonb
        or p_payload -> 'media_no_marks' is distinct from 'true'::jsonb or p_payload -> 'media_exif_stripped' is distinct from 'true'::jsonb then raise exception 'quiz_media_invalid'; end if;
    elsif exists(select 1 from jsonb_object_keys(p_payload) k where k like 'media\_%') then raise exception 'quiz_media_invalid'; end if;
    update public.sport_quiz_questions set status = 'archived',reason = why where question_key = family and status = 'approved';
    -- The 300 cap counts only versions still in play (draft or approved); archived and void history is free.
    if (select count(*) from public.sport_quiz_questions where status in ('draft','approved')) >= 300 then raise exception 'quiz_bank_full'; end if;
    insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,created_by,topic_category,source_notes,
        question_type,media_path,media_licence,media_source,media_attribution,media_alt_text,media_size_bytes,media_has_person,media_no_marks,media_exif_stripped)
      values(family,coalesce((select max(version) + 1 from public.sport_quiz_questions where question_key = family),1),
        btrim(p_payload ->> 'sport'),btrim(p_payload ->> 'prompt'),opts,(p_payload ->> 'correct_option')::integer,btrim(p_payload ->> 'explanation'),why,me,
        p_payload ->> 'topic_category',btrim(p_payload ->> 'source_notes'),qtype,
        case when qtype = 'image_choice' then btrim(p_payload ->> 'media_path') end,case when qtype = 'image_choice' then p_payload ->> 'media_licence' end,
        case when qtype = 'image_choice' then btrim(p_payload ->> 'media_source') end,case when qtype = 'image_choice' then btrim(p_payload ->> 'media_attribution') end,
        case when qtype = 'image_choice' then btrim(p_payload ->> 'media_alt_text') end,case when qtype = 'image_choice' then (p_payload ->> 'media_size_bytes')::int end,
        case when qtype = 'image_choice' then false end,case when qtype = 'image_choice' then true end,case when qtype = 'image_choice' then true end) returning * into nextq;
  elsif p_action = 'review_media' then
    -- The rights reviewer is a second admin, recorded before approval; the creator cannot review their own image.
    if q.question_type <> 'image_choice' or q.status <> 'draft' then raise exception 'quiz_media_review_invalid'; end if;
    if q.created_by is not distinct from me then raise exception 'quiz_media_reviewer_is_creator'; end if;
    update public.sport_quiz_questions set media_reviewed_by = me,media_reviewed_at = at where id = q.id returning * into nextq;
  else
    if q.status = 'void' then raise exception 'quiz_void_final'; end if;
    if p_action = 'approve' and q.status <> 'draft' then raise exception 'quiz_approve_draft_only'; end if;
    if p_action = 'approve' and q.question_type = 'image_choice' and not (select images_enabled from public.sport_quiz_settings where singleton) then raise exception 'quiz_images_off'; end if;
    if p_action = 'approve' and q.question_type = 'image_choice' and (q.media_reviewed_by is null or q.media_reviewed_by is not distinct from q.created_by) then raise exception 'quiz_media_review_required'; end if;
    if p_action = 'approve' then update public.sport_quiz_questions set status = 'archived',reason = why where question_key = q.question_key and status = 'approved'; end if;
    update public.sport_quiz_questions set status = case p_action when 'approve' then 'approved' when 'archive' then 'archived' else 'void' end,
      reason = why,reviewed_at = at,reviewed_by = me where id = q.id returning * into nextq;
    if p_action = 'void' then
      -- Single-question attempts: QUIZ-02 correction (attempt and badge).
      for affected in with changed as (update public.sport_quiz_attempts set status = 'void',voided_at = at,closed_at = coalesce(closed_at,at),correction_reason = why,session_hash = null
          where question_id = q.id and status <> 'skipped' returning profile_id) select distinct profile_id from changed order by profile_id loop perform public.quiz_bump_history(affected); end loop;
      update public.sport_quiz_badges set voided_at = at where attempt_id in (select id from public.sport_quiz_attempts where question_id = q.id) and voided_at is null;
      -- Rounds: void the item only. An open voided item closes and the round waits for Next (or ends if it was last).
      for ritem in select i.attempt_id,i.position,i.status,a.profile_id,a.status attempt_status,a.position current_position,a.planned_items
          from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where i.question_id = q.id and i.status <> 'void' order by a.profile_id,i.attempt_id loop
        update public.sport_quiz_round_items set status = 'void',voided_at = at,closed_at = coalesce(closed_at,at),correction_reason = why
          where attempt_id = ritem.attempt_id and position = ritem.position;
        if ritem.attempt_status = 'issued' and ritem.status = 'issued' and ritem.position = ritem.current_position then
          if ritem.position >= ritem.planned_items then perform public.quiz_round_close(ritem.attempt_id,at,'corrected');
          else update public.sport_quiz_attempts set round_state = 'between',next_by = at + public.quiz_round_gap() where id = ritem.attempt_id; end if;
        elsif ritem.attempt_status <> 'issued' and not exists(select 1 from public.sport_quiz_round_items where attempt_id = ritem.attempt_id and status = 'answered') then
          update public.sport_quiz_attempts set status = 'void',voided_at = coalesce(voided_at,at),correction_reason = why where id = ritem.attempt_id and status <> 'void';
        end if;
        update public.sport_quiz_attempts set correction_reason = coalesce(correction_reason,why) where id = ritem.attempt_id;
        perform public.quiz_bump_history(ritem.profile_id);
      end loop;
      for affected in select distinct a.profile_id from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where i.question_id = q.id
          union select distinct profile_id from public.sport_quiz_attempts where question_id = q.id order by 1 loop
        perform public.quiz_sync_badges(affected,at);
      end loop;
    end if;
  end if;
  insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'question_' || p_action,nextq.id,why,at);
  return jsonb_build_object('id',nextq.id,'question_key',nextq.question_key,'version',nextq.version,'status',nextq.status);
end $$;

-- Weeks until the most-exposed recent player runs out of a sport at the current pace (exposures in the last 28 days).
create or replace function public.quiz_admin_forecast(p_at timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with bank as (select q.sport,count(*) families from public.sport_quiz_questions q
      where q.status = 'approved' and q.topic_category = 'sport' and q.question_type <> 'image_choice'
        and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 group by q.sport),
  recent as (select q.sport,e.profile_id,public.quiz_week_at(e.first_issued_at) wk from public.sport_quiz_exposures e
      join public.sport_quiz_questions q on q.id = e.question_id where q.topic_category = 'sport' and e.first_issued_at > p_at - interval '28 days'),
  pace as (select sport,count(*) issued,count(distinct profile_id) players,count(distinct (profile_id,wk)) player_weeks from recent group by sport),
  seen as (select q.sport,e.profile_id,count(*) n from public.sport_quiz_exposures e join public.sport_quiz_questions q on q.id = e.question_id
      where q.topic_category = 'sport' and e.profile_id in (select profile_id from recent) group by q.sport,e.profile_id),
  maxseen as (select sport,max(n) max_seen from seen group by sport)
  select coalesce(jsonb_agg(jsonb_build_object('sport',b.sport,'approved_families',b.families,'players_28d',coalesce(p.players,0),'issued_28d',coalesce(p.issued,0),
    'pace_per_player_week',case when coalesce(p.player_weeks,0) > 0 then round(p.issued::numeric / p.player_weeks,2) else 0 end,
    'max_seen',coalesce(m.max_seen,0),
    'weeks_left',case when coalesce(p.player_weeks,0) > 0 then greatest(floor((b.families - coalesce(m.max_seen,0)) / (p.issued::numeric / p.player_weeks)),0)::int end)
    order by b.sport),'[]'::jsonb)
  from bank b left join pace p on p.sport = b.sport left join maxseen m on m.sport = b.sport
$$;

create or replace function public.quiz_admin_snapshot(p_question_cursor text default null,p_audit_before bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); at timestamptz := statement_timestamp(); w date := public.quiz_week_at(at);
  c jsonb := public.quiz_cursor(p_question_cursor,'questions'); bank jsonb; audit jsonb; nextq text; nexta text; last_id uuid; last_at timestamptz; wk jsonb;
begin
  if p_audit_before is not null and p_audit_before <= 0 then raise exception 'quiz_cursor_invalid'; end if;
  select coalesce(jsonb_agg(to_jsonb(q) - 'media_reviewed_by' || jsonb_build_object('media_reviewed_by',q.media_reviewed_by) order by created_at desc,id desc),'[]') into bank from
    (select * from public.sport_quiz_questions where c is null or (created_at,id) < ((c ->> 'at')::timestamptz,(c ->> 'id')::uuid) order by created_at desc,id desc limit 50) q;
  if jsonb_array_length(bank) = 50 then
    last_at := (bank -> 49 ->> 'created_at')::timestamptz; last_id := (bank -> 49 ->> 'id')::uuid;
    if exists(select 1 from public.sport_quiz_questions where (created_at,id) < (last_at,last_id)) then nextq := jsonb_build_object('v',1,'stream','questions','at',last_at,'id',last_id)::text; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id::text,'action',x.action,
    'actor_id',case when x.action in ('settings','retention') or x.action like 'question_%' then x.actor_id else null end,
    'question_id',case when x.action like 'question_%' then x.question_id else null end,'reason',x.reason,'created_at',x.created_at) order by x.id desc),'[]') into audit
    from (select * from public.sport_quiz_audit where p_audit_before is null or id < p_audit_before order by id desc limit 50) x;
  if jsonb_array_length(audit) = 50 and exists(select 1 from public.sport_quiz_audit where id < (audit -> 49 ->> 'id')::bigint) then nexta := audit -> 49 ->> 'id'; end if;
  select jsonb_build_object(
    'week_issued',count(*) filter (where s ->> 'status' = 'issued'),'week_completed',count(*) filter (where s ->> 'status' = 'completed'),
    'week_skipped',count(*) filter (where s ->> 'status' = 'skipped'),'week_void',count(*) filter (where s ->> 'status' = 'void'),
    'week_ended',count(*) filter (where s ->> 'status' = 'ended'),'week_expired',count(*) filter (where s ->> 'status' = 'expired'),
    'week_rounds_short',count(*) filter (where (s ->> 'short_round')::boolean),'week_rounds_group',count(*) filter (where s ->> 'group_id' is not null))
    into wk from (select public.quiz_summary(a.id,at) s from public.sport_quiz_attempts a where a.week_start = w) x;
  return jsonb_build_object('contract_version',2,'generated_at',at,'week_start',w,'week_end',w + 7,
    'settings',(select (to_jsonb(s) - 'singleton') || jsonb_build_object('contract_version',2) from public.sport_quiz_settings s where singleton),
    'questions',bank,'question_total',(select count(*) from public.sport_quiz_questions),
    'active_total',(select count(*) from public.sport_quiz_questions where status in ('draft','approved')),
    'question_cap',300,'next_question_cursor',nextq,'audit',audit,'next_before',nexta,
    'pools',(select coalesce(jsonb_agg(to_jsonb(x) order by topic_category,sport),'[]') from (select topic_category,sport,count(*) approved_count from public.sport_quiz_questions
      where status = 'approved' and question_type <> 'image_choice' and public.quiz_normalize_options(options) is not null and char_length(btrim(source_notes)) >= 10 group by topic_category,sport) x),
    'forecast',public.quiz_admin_forecast(at),
    'counts',wk || jsonb_build_object(
      'questions_draft',(select count(*) from public.sport_quiz_questions where status = 'draft'),
      'questions_approved',(select count(*) from public.sport_quiz_questions where status = 'approved'),
      'questions_archived',(select count(*) from public.sport_quiz_questions where status = 'archived'),
      'questions_void',(select count(*) from public.sport_quiz_questions where status = 'void'),
      'questions_true_false',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and question_type = 'true_false'),
      'questions_image',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and question_type = 'image_choice'),
      'week_items_issued',(select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.week_start = w),
      'week_items_answered',(select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.week_start = w and i.status = 'answered'),
      'week_items_void',(select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.week_start = w and i.status = 'void'),
      'badges_issued',(select count(*) from public.sport_quiz_badges where voided_at is null),
      'badges_void',(select count(*) from public.sport_quiz_badges where voided_at is not null),
      'badges_sport',(select count(*) from public.sport_quiz_badges where voided_at is null and kind = 'sport'),
      'badges_family',(select count(*) from public.sport_quiz_badges where voided_at is null and kind = 'family'),
      'badges_season',(select count(*) from public.sport_quiz_badges where voided_at is null and kind = 'season'),
      'badges_group_visible',(select count(*) from public.sport_quiz_badges where voided_at is null and visibility = 'groups'),
      'recap_facts_quarter',(select coalesce(sum(public.quiz_facts(p.profile_id,date_trunc('quarter',at at time zone 'UTC')::date,(date_trunc('quarter',at at time zone 'UTC') + interval '3 months')::date)),0)
        from (select distinct profile_id from public.sport_quiz_attempts) p),
      'preferences_weekly',(select count(*) from public.sport_quiz_preferences where invitation_mode = 'weekly'),
      'exposures',(select count(*) from public.sport_quiz_exposures),'week_spent',(select count(*) from public.sport_quiz_week_guards where week_start = w),
      'retained_guards',(select count(*) from public.sport_quiz_week_guards),'retained_requests',(select count(*) from public.sport_quiz_requests)),
    -- Counts only: never member names, answers or per-member play.
    'groups',jsonb_build_object(
      'groups_active',(select count(*) from public.sport_quiz_groups where status = 'active'),
      'groups_closed',(select count(*) from public.sport_quiz_groups where status = 'closed'),
      'members_active',(select count(*) from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id where m.status = 'active' and g.status = 'active'),
      'members_removed',(select count(*) from public.sport_quiz_group_members where status = 'removed'),
      'groups_played_this_week',(select count(distinct m.group_id) from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id
         where m.status = 'active' and g.status = 'active' and public.quiz_played(m.profile_id,w)),
      'codes_active',(select count(*) from public.sport_quiz_group_codes where expires_at > at),
      'codes_issued',(select coalesce(sum(codes_issued),0) from public.sport_quiz_groups),
      'joins_7d',(select count(*) from public.sport_quiz_group_join_attempts where outcome = 'joined' and created_at > at - interval '7 days'),
      'refusals_7d',(select count(*) from public.sport_quiz_group_join_attempts where outcome = 'refused' and created_at > at - interval '7 days'),
      'wrong_codes_7d',(select count(*) from public.sport_quiz_group_join_attempts where outcome = 'wrong_code' and created_at > at - interval '7 days'),
      'reports_7d',(select count(*) from public.sport_quiz_group_cases where kind = 'report' and created_at > at - interval '7 days'),
      'sets_this_week',(select count(distinct group_id) from public.sport_quiz_group_sets where week_start = w),
      'retained_sets',(select count(*) from public.sport_quiz_group_sets),'retained_join_attempts',(select count(*) from public.sport_quiz_group_join_attempts)),
    'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id::text,'group_id',r.group_id,'reason_code',r.reason_code,'created_at',r.created_at) order by r.id desc)
      from (select * from public.sport_quiz_group_cases where kind = 'report' order by id desc limit 50) r),'[]'::jsonb));
end $$;

create or replace function public.quiz_admin_retention(p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; ng bigint; nr bigint; kept bigint; nc bigint; ns bigint; nj bigint; ngp bigint;
begin
  if char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'quiz_retention_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  delete from public.sport_quiz_requests where (profile_id,request_id) in (select profile_id,request_id from public.sport_quiz_requests where prune_after <= at order by prune_after,profile_id,request_id limit 500); get diagnostics nr = row_count;
  delete from public.sport_quiz_week_guards where (profile_id,week_start) in (select profile_id,week_start from public.sport_quiz_week_guards where prune_after <= at order by prune_after,profile_id,week_start limit 500); get diagnostics ng = row_count;
  delete from public.sport_quiz_group_codes where group_id in (select group_id from public.sport_quiz_group_codes where expires_at <= at order by expires_at,group_id limit 500); get diagnostics nc = row_count;
  delete from public.sport_quiz_group_sets where (group_id,week_start,position) in (select group_id,week_start,position from public.sport_quiz_group_sets where prune_after <= at order by prune_after,group_id,week_start,position limit 500); get diagnostics ns = row_count;
  delete from public.sport_quiz_group_join_attempts where id in (select id from public.sport_quiz_group_join_attempts where prune_after <= at order by prune_after,id limit 500); get diagnostics nj = row_count;
  -- Closed groups (and their removal tombstones) go 35 days after closing; the case log keeps the safety record.
  delete from public.sport_quiz_groups where id in (select id from public.sport_quiz_groups where (status = 'closed' and closed_at <= at - interval '35 days')
    or (status = 'active' and not exists(select 1 from public.sport_quiz_group_members m where m.group_id = id and m.status = 'active')) order by created_at,id limit 500); get diagnostics ngp = row_count;
  select count(*) into kept from public.sport_quiz_week_guards where prune_after > at;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'retention',btrim(p_reason),at);
  return jsonb_build_object('contract_version',2,'removed_guards',ng,'removed_requests',nr,'preserved_guards',kept,'batch_limit',500,
    'removed_codes',nc,'removed_group_sets',ns,'removed_join_attempts',nj,'removed_groups',ngp);
end $$;

-- Audited case view: member ids, age bands, statuses and join refusals for one group. Admins only; each read is logged.
create or replace function public.quiz_admin_group_case(p_group_id uuid,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; g public.sport_quiz_groups%rowtype;
begin
  if p_group_id is null or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'quiz_group_case_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for share; at := clock_timestamp();
  select * into g from public.sport_quiz_groups where id = p_group_id;
  if g.id is null and not exists(select 1 from public.sport_quiz_group_cases where group_id = p_group_id) then raise exception 'quiz_group_missing'; end if;
  perform public.quiz_group_case(p_group_id,'admin_view',me,null,null,btrim(p_reason),at);
  return jsonb_build_object('contract_version',3,'generated_at',at,'group_id',p_group_id,
    'group',case when g.id is null then null else jsonb_build_object('name_key',g.name_key,'theme_sport',g.theme_sport,'status',g.status,'created_at',g.created_at,
      'closed_at',g.closed_at,'close_reason',g.close_reason,'owner_id',g.owner_id,'codes_issued',g.codes_issued,
      'code_active',exists(select 1 from public.sport_quiz_group_codes c where c.group_id = g.id and c.expires_at > at)) end,
    'members',coalesce((select jsonb_agg(jsonb_build_object('profile_id',m.profile_id,'age_band',public.profile_age_band(m.profile_id),'status',m.status,
      'joined_at',m.joined_at,'removed_at',m.removed_at,'removed_reason',m.removed_reason,'is_owner',m.profile_id = g.owner_id) order by m.joined_at,m.profile_id)
      from public.sport_quiz_group_members m where m.group_id = p_group_id),'[]'::jsonb),
    'refusals',coalesce((select jsonb_agg(jsonb_build_object('profile_id',j.profile_id,'age_band',public.profile_age_band(j.profile_id),'refusal_reason',j.refusal_reason,'created_at',j.created_at) order by j.id desc)
      from (select * from public.sport_quiz_group_join_attempts where group_id = p_group_id and outcome = 'refused' order by id desc limit 100) j),'[]'::jsonb),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',x.id::text,'kind',x.kind,'actor_id',x.actor_id,'subject_id',x.subject_id,'reason_code',x.reason_code,
      'reason',x.reason,'created_at',x.created_at) order by x.id desc) from (select * from public.sport_quiz_group_cases where group_id = p_group_id order by id desc limit 100) x),'[]'::jsonb));
end $$;

-- Remove one member (bars rejoining, rotates the code) or close the whole group, with a recorded reason.
create or replace function public.quiz_admin_group_remove(p_group_id uuid,p_profile_id uuid,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; g public.sport_quiz_groups%rowtype; m uuid;
begin
  if p_group_id is null or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'quiz_group_case_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for share;
  select * into g from public.sport_quiz_groups where id = p_group_id for update;
  if g.id is null then raise exception 'quiz_group_missing'; end if;
  at := clock_timestamp();
  if p_profile_id is null then
    if g.status <> 'active' then return jsonb_build_object('contract_version',3,'outcome','already_closed','group_id',g.id,'profile_id',null); end if;
    for m in select profile_id from public.sport_quiz_group_members where group_id = g.id and status = 'active' order by profile_id loop
      perform public.log_supervision_event(m,'trivia_group_left','{}'::jsonb);
    end loop;
    update public.sport_quiz_groups set status = 'closed',closed_at = at,close_reason = 'admin_removed' where id = g.id;
    delete from public.sport_quiz_group_codes where group_id = g.id;
    perform public.quiz_group_case(g.id,'admin_close',me,null,'admin',btrim(p_reason),at);
    return jsonb_build_object('contract_version',3,'outcome','closed','group_id',g.id,'profile_id',null);
  end if;
  if not exists(select 1 from public.sport_quiz_group_members where group_id = g.id and profile_id = p_profile_id and status = 'active') then raise exception 'quiz_group_not_member'; end if;
  perform public.quiz_group_mark_removed(g.id,p_profile_id,'admin',me,btrim(p_reason),at);
  return jsonb_build_object('contract_version',3,'outcome','removed','group_id',g.id,'profile_id',p_profile_id);
end $$;

-- 18. Access: RPC-only, explicit revokes, closed-account policy on every new RLS table -------------------------------------
do $$ declare t text; f record; begin
  foreach t in array array['sport_quiz_round_items','sport_quiz_groups','sport_quiz_group_members','sport_quiz_group_codes',
      'sport_quiz_group_join_attempts','sport_quiz_group_sets','sport_quiz_group_cases'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
    execute format('drop policy if exists "Closed accounts" on public.%I',t);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))',t);
  end loop;
  revoke all on sequence public.sport_quiz_group_join_attempts_id_seq from public,anon,authenticated,service_role;
  revoke all on sequence public.sport_quiz_group_cases_id_seq from public,anon,authenticated,service_role;
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'quiz\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
  revoke all on function public.supervision_json(uuid,timestamptz) from public,anon,authenticated;
  grant execute on function public.supervision_json(uuid,timestamptz) to service_role;
end $$;
grant execute on function public.quiz_snapshot(),public.quiz_preferences(jsonb,bigint,uuid,uuid),public.quiz_invitation(date,uuid,uuid),
 public.quiz_start(text,text,integer,date,text,uuid,text,uuid),public.quiz_answer(uuid,integer,uuid,text,uuid),
 public.quiz_end(uuid,uuid,date,text,uuid,uuid),public.quiz_skip(date,uuid,uuid),public.quiz_receipt(uuid),public.quiz_history(text),
 public.quiz_erase_history(bigint,uuid),public.quiz_admin_snapshot(text,bigint),public.quiz_admin_settings(jsonb,text,uuid),
 public.quiz_admin_question(uuid,text,jsonb,uuid),public.quiz_admin_retention(text,uuid),
 public.quiz_next(uuid,integer,uuid,text,uuid),public.quiz_group_start(uuid,integer,date,text,uuid,text,uuid),
 public.quiz_badge_shelf(),public.quiz_badge_visibility(uuid,text,uuid),public.quiz_season_recap(text),
 public.quiz_group_create(text,text,uuid,uuid),public.quiz_group_join(text,uuid),public.quiz_group_leave(uuid,uuid),
 public.quiz_group_remove_member(uuid,text,uuid),public.quiz_group_renew_code(uuid,uuid),public.quiz_group_set_theme(uuid,text,uuid),
 public.quiz_group_page(uuid),public.quiz_groups_mine(),public.quiz_group_report(uuid,text,uuid),
 public.quiz_admin_play_settings(jsonb,text,uuid),public.quiz_admin_group_case(uuid,text,uuid),public.quiz_admin_group_remove(uuid,uuid,text,uuid) to authenticated;
