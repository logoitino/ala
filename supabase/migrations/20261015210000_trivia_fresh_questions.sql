-- QUIZ-05: fresh questions — self-healing trivia, Know your athlete (fun facts) and admin refills. Local source only; not
-- applied anywhere. Requires QUIZ-01..04 (20261014140000–20261014190000), PRIV-01 (20261014090000 / 100000), MINOR-01
-- (20261014110000) and the athlete verification ladder.
-- Design: docs/engineering/design/TRIVIA_FRESH_QUESTIONS_DESIGN.md (§6 design review 2026-10-15 overrides §1–§5).
-- Owner: POLLS with BACKEND, DATABASE_MIGRATIONS, ADMIN, PROFILE and CUSTODIAL. Reviews: MINOR_SAFETY (lead),
--   PRIVACY_ENGINEERING, RLS_SECURITY, VOICE, DATA_GOVERNANCE, infrastructure seat.
-- The one rule: nothing reaches players without an admin approving it. Spotting, pausing, drafting and alerting are
--   automatic; publishing never is.
-- What it adds (§6 item numbers):
--   1. Fun facts (§6.1–6.7): a PRIV-01 per-item audience `fun_facts` (default friends; 13–15 capped at friends);
--      quiz_athlete_facts keeps the athlete's answer text apart from question rows (filled in at read time); six preset
--      prompts with curated wrong-answer lists (the pre-game meal is chosen from its list); a server text filter (the Life
--      text cleanup and brand / money lists plus links, handles, digits, addresses, weekdays and times, the athlete's own
--      school or city, emoji, non-Latin letters and a not-okay word list) and a near-match-to-a-wrong-option refusal.
--      Order: athlete submit → guardian (under 16, MINOR-01 approval change_key 'fun_fact:<id>') → one admin approves.
--      13–15 without a guardian keep a draft "waiting for a guardian"; no recorded age (unknown / not_given) cannot
--      submit. Only the athlete withdraws. Withdrawal, account deletion, unlinking and an under-13 block clear the text in
--      the same transaction and void the question and every issued, unrevealed item; history shows "Removed by the
--      athlete" and no audit row holds the text. Drawn only for verified athletes, in personal rounds, at most one per
--      round, in about 1 of 3 rounds per player (deterministic per player-week from a server salt), at most one per
--      athlete per viewer per month, when the viewer follows the athlete or started from the athlete's Learn card
--      (quiz_learn_start validates the athlete id), the audience allows and neither side blocked the other. Checked when
--      issued and again at the reveal; on failure an ordinary question is drawn (issue) or the item is voided (reveal).
--      Athlete counts: completed months only, distinct fans in buckets 5+ / 10+ / 25+ (under 5 hidden), never counting
--      the athlete, guardians, admins or the testing group; a "paused for a check" state for the owner. Supervision adds
--      "fun_facts_shared". Switch trivia.athlete_questions (off) and a share setting 0–10% (default 0).
--   2. Answer shuffle (§6.8): each round item stores its shown order when issued (stable on replay); the client sends the
--      shown position, the server maps it to the stored index and keeps both on the item and in the receipt result.
--      True / false is not shuffled. The stored order is shuffled on bulk import and at approval (a permutation the
--      question guard allows only for draft → approved). Stats, voids and history use the stored index.
--   3. Reports (§6.9): one per account per question and 10 a day, only after a closed round item for that question;
--      counted only from accounts 7+ days old with a completed round and never across a block; auto-pause at 2 counted
--      reporters (ordinary) or 1 "Not okay" / "Shares something private" (fun fact); 3 new counted reporters after a
--      restore; at most 10 auto-pauses per topic per UTC day, then reports queue and an alert is recorded; intake pause;
--      reporter id cleared at 90 days, reports deleted at 180 (quiz_admin_retention); erasure removes own reports.
--   4. Quality flags and difficulty (§6.10): counters refreshed when each answer or time-out is committed (trigger, no
--      scheduler) over distinct accounts on the current version, excluding admins and the author; type-aware
--      "confusing"; easy / medium / hard; at most two hard per round (group sets choose without reading members'
--      history).
--   5. Bulk import (§6.11): admin-only, 200 rows / 64 KB, server re-check, dry run, refuses athlete / image rows and
--      formula-start cells, version caps, duplicate check across all statuses / versions / families / topics and the
--      batch (exact after cleanup blocks, near match warns); rows land as drafts; there is no approve-all.
--   6. Needs a look: an admin read with reasons; Restore / Dismiss / Archive, and Edit through the atomic edit_replace
--      (now also for an approved question that needs a look). The admin snapshot adds weeks left / Refill needed per
--      topic, sport and Life chapter and the Needs a look count.
--   7. Data and audit (§6.12): new audit actions; fun-fact answer audit rows carry no question id; the athlete export
--      (quiz_fact_export) lists their facts and every decision.
--   8. Security: RPC-only tables with the Closed accounts restrictive policy, explicit revokes, pinned search_path.
-- Lock order unchanged: settings → group → account → attempt; a per-question advisory lock (reports) sits after settings
--   and before accounts; a per-athlete advisory lock (facts) sits after settings.
-- Safe to re-run alone or through schema.sql (the QUIZ transaction sets quiz.full_schema): add column if not exists,
--   create table if not exists, named constraints dropped and re-added NOT VALID, create or replace, no data updates.
--   QUIZ-04 (20261014180000) now refuses a lone re-run after this file (quiz_rerun_after_quiz05), like QUIZ-03 after
--   QUIZ-04. Rollback: switch trivia.athlete_questions off, set the share to 0 and pause report intake; keep records;
--   forward fix.

-- 0. Text helpers -------------------------------------------------------------------------------------------------------
-- Lookalike letters folded to Latin (security review 2026-10-15): dotless i, Cyrillic and Greek letters that read as
-- Latin, so "shıt" or a Cyrillic "а" cannot slip past a word list or a duplicate check.
create or replace function public.quiz_fold_lookalikes(p text)
returns text language sql immutable set search_path = '' as $$
  select translate(coalesce(p,''),'ıİаеорсхуіјѕԁһкмтвнАЕОРСХУІЈЅКМТВНαοερτυνικΑΟΕΡΤΥΝΙΚ',
    'iIaeopcxyijsdhkmtbhAEOPCXYIJSKMTBHaoeptuvikAOEPTYNIK')
$$;
-- Cleanup for comparisons: the Life normalization (NFKC, zero-width, quotes, lowercase), lookalikes folded, macrons
-- stripped; letters (Latin, accented and any other script) and digits kept, everything else becomes one space.
create or replace function public.quiz_fresh_norm(p text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(public.quiz_life_strip(public.quiz_life_normalize(public.quiz_fold_lookalikes(p))),'[[:space:][:punct:]]+',' ','g'))
$$;
-- Edit distance for short texts (fun-fact answers against wrong options).
create or replace function public.quiz_levenshtein(a text,b text)
returns integer language plpgsql immutable set search_path = '' as $$
declare la integer := char_length(coalesce(a,'')); lb integer := char_length(coalesce(b,'')); prev integer[]; cur integer[]; i integer; j integer; cost integer;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  if la > 120 or lb > 120 then return greatest(la,lb); end if;
  prev := array(select generate_series(0,lb));
  for i in 1..la loop
    cur := array[i];
    for j in 1..lb loop
      cost := case when substr(a,i,1) = substr(b,j,1) then 0 else 1 end;
      cur := cur || least(cur[j] + 1,prev[j + 1] + 1,prev[j] + cost);
    end loop;
    prev := cur;
  end loop;
  return prev[lb + 1];
end $$;
-- Same, nearly the same (one edit for short words, two otherwise) or one inside the other (both 4+ characters).
create or replace function public.quiz_near_match(a text,b text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare x text := public.quiz_fresh_norm(a); y text := public.quiz_fresh_norm(b); shortest integer;
begin
  if x = '' or y = '' then return false; end if;
  if x = y or replace(x,' ','') = replace(y,' ','') then return true; end if;
  shortest := least(char_length(x),char_length(y));
  if shortest >= 4 and (position(x in y) > 0 or position(y in x) > 0) then return true; end if;
  return public.quiz_levenshtein(x,y) <= case when shortest <= 5 then 1 else 2 end;
end $$;
-- Share of words two prompts have in common (near-duplicate warning for imports).
create or replace function public.quiz_word_overlap(a text,b text)
returns numeric language sql immutable set search_path = '' as $$
  with x as (select distinct w from regexp_split_to_table(public.quiz_fresh_norm(a),' ') w where w <> ''),
       y as (select distinct w from regexp_split_to_table(public.quiz_fresh_norm(b),' ') w where w <> '')
  select case when (select count(*) from (select w from x union select w from y) u) = 0 then 0
    else round((select count(*) from (select w from x intersect select w from y) i)::numeric / (select count(*) from (select w from x union select w from y) u),2) end
$$;
-- A random permutation of 0..n-1 (shown order for one item).
create or replace function public.quiz_random_order(p_n integer)
returns smallint[] language sql volatile set search_path = '' as $$
  select array_agg(i::smallint order by random()) from generate_series(0,p_n - 1) i
$$;
-- Shuffle stored options and move the correct index with them (import and approval); true / false keeps its order.
create or replace function public.quiz_shuffle_options(p_options jsonb,p_correct integer,p_type text)
returns jsonb language plpgsql volatile set search_path = '' as $$
declare perm smallint[]; out jsonb := '[]'; i integer; correct integer;
begin
  if p_type = 'true_false' or jsonb_typeof(p_options) is distinct from 'array' then
    return jsonb_build_object('options',p_options,'correct_option',p_correct);
  end if;
  perm := public.quiz_random_order(jsonb_array_length(p_options));
  for i in 1..array_length(perm,1) loop
    out := out || jsonb_build_array(p_options -> perm[i]);
    if perm[i] = p_correct then correct := i - 1; end if;
  end loop;
  return jsonb_build_object('options',out,'correct_option',correct);
end $$;
-- Two option arrays hold the same texts (any order).
create or replace function public.quiz_same_options(a jsonb,b jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(a) = 'array' and jsonb_typeof(b) = 'array' and jsonb_array_length(a) = jsonb_array_length(b)
    and (select array_agg(x order by x) from jsonb_array_elements_text(a) x) = (select array_agg(x order by x) from jsonb_array_elements_text(b) x)
$$;
-- A stable 0–99 bucket from a server-side hash (deterministic per input, unpredictable without the salt).
create or replace function public.quiz_bucket(p_seed text,p_slice integer)
returns integer language sql immutable set search_path = '' as $$
  select (('x' || substr(public.hash_secret(p_seed),1 + p_slice * 8,8))::bit(32)::bigint % 100)::integer
$$;

-- 1. Self-heal thresholds, report rules and fun-fact prompts --------------------------------------------------------------
create or replace function public.quiz_self_heal_defaults()
returns jsonb language sql immutable set search_path = '' as $$
  select '{"min_responders":30,"too_easy_pct":95,"confusing_choice4_pct":15,"confusing_true_false_pct":35,"too_long_pct":40}'::jsonb
$$;
-- Editable within these bounds only (admin Settings); anything else is refused.
create or replace function public.quiz_self_heal_ok(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; lo integer; hi integer; v text;
begin
  if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p)) <> 5 then return false; end if;
  for k,lo,hi in select * from (values ('min_responders',20,200),('too_easy_pct',80,100),('confusing_choice4_pct',5,30),
      ('confusing_true_false_pct',20,45),('too_long_pct',20,80)) t(k,lo,hi) loop
    v := p ->> k;
    if jsonb_typeof(p -> k) is distinct from 'number' or v !~ '^[0-9]{1,3}$' or v::integer not between lo and hi then return false; end if;
  end loop;
  return true;
end $$;
-- Report rules from design §6.9 (fixed; shown read-only on the desk).
create or replace function public.quiz_report_rules()
returns jsonb language sql immutable set search_path = '' as $$
  select '{"ordinary_reporters":2,"fact_reporters":1,"fact_reasons":["not_okay","private"],"restored_reporters":3,"daily_pause_cap":10,
    "min_account_days":7,"per_account_per_day":10,"reporter_clear_days":90,"delete_days":180}'::jsonb
$$;
-- The six preset prompts (§6.4). `question` / `explanation` use {name}; the stored question holds {answer} where the
-- athlete's text goes, so no question row ever holds it. `answers` (pre-game meal only) is the list the athlete picks
-- from; `wrong` lists are curated per prompt and never come from other athletes. US spelling for on-screen labels.
create or replace function public.quiz_fact_prompts()
returns jsonb language sql immutable set search_path = '' as $$ select $fact_prompts$[
  {"key":"pregame_meal","label":"Pre-game meal","question":"What does {name} like to eat before a game?",
   "answers":["Pasta","Chicken and rice","Pancakes","Waffles","Peanut butter sandwich","Oatmeal","Eggs and toast","Breakfast burrito","Teriyaki chicken","Poke bowl","Smoothie","Bagel","Turkey sandwich","Fruit bowl","Rice and fish","Tacos","Pizza","Grilled cheese"],
   "wrong":["Pasta","Chicken and rice","Pancakes","Waffles","Peanut butter sandwich","Oatmeal","Eggs and toast","Breakfast burrito","Teriyaki chicken","Poke bowl","Smoothie","Bagel","Turkey sandwich","Fruit bowl","Rice and fish","Tacos","Pizza","Grilled cheese"]},
  {"key":"hype_song","label":"Hype song","question":"Which song gets {name} hyped before a game?",
   "wrong":["We Will Rock You","Eye of the Tiger","Thunderstruck","Seven Nation Army","Jump Around","Lose Yourself","Remember the Name","Can't Hold Us","Centuries","Believer","Hall of Fame","Till I Collapse"]},
  {"key":"pro_athlete","label":"Favorite pro athlete","question":"Who is {name}'s favorite pro athlete?",
   "wrong":["Michael Jordan","Serena Williams","Babe Ruth","Wayne Gretzky","Simone Biles","Usain Bolt","Mia Hamm","Jackie Robinson","Wilma Rudolph","Muhammad Ali","Billie Jean King","Jim Thorpe"]},
  {"key":"pregame_ritual","label":"Pre-game ritual","question":"What is {name}'s pre-game ritual?",
   "wrong":["Stretching with the team","Listening to music","Tying shoes twice","Picturing the game","A team handshake","Quiet time alone","Wearing lucky socks","Eating a banana","Jumping jacks","A deep breath routine","High fives with teammates","Reading the playbook"]},
  {"key":"hidden_talent","label":"Hidden talent","question":"What is {name}'s hidden talent?",
   "wrong":["Juggling","Drawing","Singing","Cooking","Solving puzzle cubes","Playing piano","Dancing","Skateboarding","Playing ukulele","Card tricks","Baking","Writing poems"]},
  {"key":"other_sport","label":"Other sport you love","question":"Which other sport does {name} love?",
   "wrong":["Basketball","Soccer","Volleyball","Tennis","Swimming","Golf","Baseball","Track and field","Wrestling","Softball","Rugby","Bowling"]}
]$fact_prompts$::jsonb $$;
create or replace function public.quiz_fact_prompt(p_key text)
returns jsonb language sql immutable set search_path = '' as $$
  select x from jsonb_array_elements(public.quiz_fact_prompts()) x where x ->> 'key' = p_key
$$;
-- Words a fun fact may never contain (profanity, slurs, sexual, drug and alcohol words). Matched whole-word on cleaned text.
create or replace function public.quiz_fact_not_okay_words()
returns jsonb language sql immutable set search_path = '' as $$ select '["damn","hell","shit","shitty","fuck","fucking","fucker","bitch","ass","asshole","bastard","crap","piss","pissed","dick","cock","pussy","slut","whore","fag","faggot","retard","retarded","nigger","nigga","cunt","twat","wanker","bollocks","sex","sexy","porn","nude","naked","boobs","weed","vape","vaping","beer","vodka","whiskey","drunk","stoned","cocaine","meth","kill","gun","guns"]'::jsonb $$;

-- 2. Settings: trivia.athlete_questions, the share, report intake and self-heal thresholds --------------------------------
alter table public.sport_quiz_settings add column if not exists athlete_questions_enabled boolean not null default false;
alter table public.sport_quiz_settings add column if not exists athlete_share_pct smallint not null default 0;
alter table public.sport_quiz_settings drop constraint if exists quiz_athlete_share_range;
alter table public.sport_quiz_settings add constraint quiz_athlete_share_range check (athlete_share_pct between 0 and 10) not valid;
alter table public.sport_quiz_settings add column if not exists reports_paused boolean not null default false;
alter table public.sport_quiz_settings add column if not exists self_heal jsonb not null
  default '{"min_responders":30,"too_easy_pct":95,"confusing_choice4_pct":15,"confusing_true_false_pct":35,"too_long_pct":40}'::jsonb;
alter table public.sport_quiz_settings drop constraint if exists quiz_self_heal_valid;
alter table public.sport_quiz_settings add constraint quiz_self_heal_valid check (public.quiz_self_heal_ok(self_heal)) not valid;
-- Private salt for the 1-in-3 fun-fact rounds; never returned by any read (stripped from the admin snapshot).
alter table public.sport_quiz_settings add column if not exists fact_salt text not null default replace(gen_random_uuid()::text,'-','');

-- 3. PRIV-01 audience: a per-item `fun_facts` audience, default friends -------------------------------------------------------
create or replace function public.privacy_default_audience()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{"photo":"friends","bio":"friends","school":"friends","social_links":"only_me","stats":"friends","aura":"friends","crew":"friends","friends_list":"only_me","fun_facts":"friends"}'::jsonb;
$$;

-- 4. Tables ------------------------------------------------------------------------------------------------------------------
-- The athlete's fun facts. answer_text is the only place the athlete's words live; it is cleared (null) at once on
-- withdrawal, account closure, unlinking or an under-13 block. Questions point here through fact_id.
create table if not exists public.quiz_athlete_facts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  prompt_key text not null check (prompt_key in ('pregame_meal','hype_song','pro_athlete','pregame_ritual','hidden_talent','other_sport')),
  answer_text text check (answer_text is null or char_length(answer_text) between 2 and 40),
  status text not null check (status in ('waiting_guardian','guardian_review','admin_review','approved','declined','withdrawn','removed')),
  look_reasons text[] not null default '{}',
  submitted_at timestamptz not null,
  guardian_request_id uuid references public.guardian_approval_requests(id) on delete set null,
  guardian_decision text check (guardian_decision in ('approved','declined')),
  guardian_decided_at timestamptz,
  admin_decided_at timestamptz,
  admin_decided_by uuid references public.profiles(id) on delete set null,
  decline_reason text check (decline_reason in ('guardian','not_okay','private','sponsor_or_business','place','schedule','other')),
  question_id uuid references public.sport_quiz_questions(id) on delete set null,
  cleared_at timestamptz,
  clear_cause text,
  updated_at timestamptz not null
);
-- Text is gone exactly when cleared; withdrawn / removed facts never keep text; a declined fact's text is purged after
-- 30 days by quiz_admin_retention (clear_cause declined_purged). Named checks re-added NOT VALID (re-run safe).
alter table public.quiz_athlete_facts drop constraint if exists quiz_athlete_facts_clear_cause_check;
alter table public.quiz_athlete_facts drop constraint if exists quiz_fact_clear_cause;
alter table public.quiz_athlete_facts add constraint quiz_fact_clear_cause check (clear_cause in ('withdrawn','unlinked','age_blocked','account_deleted','declined_purged')) not valid;
alter table public.quiz_athlete_facts drop constraint if exists quiz_fact_cleared;
alter table public.quiz_athlete_facts add constraint quiz_fact_cleared check ((answer_text is null) = (cleared_at is not null)
  and (cleared_at is null) = (clear_cause is null)
  and (status not in ('withdrawn','removed') or answer_text is null)
  and (answer_text is not null or status in ('withdrawn','removed','declined'))
  and (status <> 'withdrawn' or clear_cause = 'withdrawn')
  and (clear_cause is distinct from 'declined_purged' or status = 'declined')) not valid;
create unique index if not exists quiz_fact_one_live_prompt on public.quiz_athlete_facts(athlete_id, prompt_key) where status not in ('declined','withdrawn','removed');
create index if not exists quiz_fact_status on public.quiz_athlete_facts(status, submitted_at desc);
create index if not exists quiz_fact_question on public.quiz_athlete_facts(question_id) where question_id is not null;

alter table public.sport_quiz_questions add column if not exists fact_id uuid references public.quiz_athlete_facts(id) on delete set null;
alter table public.sport_quiz_questions drop constraint if exists sport_quiz_questions_topic_category_check;
alter table public.sport_quiz_questions add constraint sport_quiz_questions_topic_category_check
  check (topic_category in ('sport','science','geography','general','life','athlete')) not valid;
alter table public.sport_quiz_questions drop constraint if exists quiz_fact_fields;
alter table public.sport_quiz_questions add constraint quiz_fact_fields check ((fact_id is null or topic_category = 'athlete')
  and (topic_category <> 'athlete' or question_type = 'choice4')) not valid;
create index if not exists quiz_questions_fact on public.sport_quiz_questions(fact_id) where fact_id is not null;

-- Per-question health: aggregates only (distinct accounts, right, time-outs), flags, difficulty and the pause state.
create table if not exists public.sport_quiz_question_stats (
  question_id uuid primary key references public.sport_quiz_questions(id) on delete cascade,
  responders integer not null default 0 check (responders >= 0),
  right_count integer not null default 0 check (right_count >= 0),
  timeouts integer not null default 0 check (timeouts >= 0),
  difficulty text check (difficulty in ('easy','medium','hard')),
  flags text[] not null default '{}',
  dismissed_flags text[] not null default '{}',
  paused_at timestamptz,
  pause_reason text check (pause_reason in ('reports','fact_report')),
  queued_at timestamptz,
  restored_at timestamptz,
  restored_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null,
  check ((paused_at is null) = (pause_reason is null))
);
create index if not exists quiz_stats_paused on public.sport_quiz_question_stats(paused_at) where paused_at is not null;

-- Reports: fixed reasons, no free text. reporter_id is cleared at 90 days and rows are deleted at 180.
create table if not exists public.sport_quiz_reports (
  id bigint generated always as identity primary key,
  question_id uuid not null references public.sport_quiz_questions(id) on delete cascade,
  topic_category text not null,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('wrong_answer','confusing','not_okay','private')),
  is_fact boolean not null,
  counted boolean not null,
  not_counted_reason text check (not_counted_reason in ('new_account','no_completed_round','blocked_pair')),
  created_at timestamptz not null,
  reporter_cleared_at timestamptz,
  check (counted = (not_counted_reason is null)),
  check (reason <> 'private' or is_fact)
);
create unique index if not exists quiz_report_once on public.sport_quiz_reports(reporter_id, question_id) where reporter_id is not null;
create index if not exists quiz_report_question on public.sport_quiz_reports(question_id, created_at);
create index if not exists quiz_report_reporter_day on public.sport_quiz_reports(reporter_id, created_at desc) where reporter_id is not null;
create index if not exists quiz_report_age on public.sport_quiz_reports(created_at);

-- Bulk imports: one row per real import (dry runs write nothing).
create table if not exists public.sport_quiz_imports (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  rows_total integer not null check (rows_total between 1 and 200),
  rows_imported integer not null check (rows_imported >= 0),
  rows_refused integer not null check (rows_refused >= 0),
  rows_warned integer not null check (rows_warned >= 0),
  created_at timestamptz not null
);

-- Round items: the shown order (null = stored order: true / false and older items) and the shown position answered.
alter table public.sport_quiz_round_items add column if not exists shown_order smallint[];
alter table public.sport_quiz_round_items add column if not exists answered_position smallint;
alter table public.sport_quiz_round_items drop constraint if exists quiz_item_shown_order;
alter table public.sport_quiz_round_items add constraint quiz_item_shown_order check ((shown_order is null or array_length(shown_order,1) between 2 and 4)
  and (answered_position is null or (answered_option is not null and answered_position between 0 and 3))) not valid;
-- The athlete whose Learn card started this personal round (validated at Start; null otherwise).
alter table public.sport_quiz_attempts add column if not exists learn_athlete_id uuid references public.profiles(id) on delete set null;

-- 5. MINOR-01 approval type fun_fact (fact id in change_key) and audit vocabulary ---------------------------------------------
alter table public.guardian_approval_requests drop constraint if exists guardian_approval_requests_change_key_check;
alter table public.guardian_approval_requests add constraint guardian_approval_requests_change_key_check
  check (change_key in ('account_public','friend_requests_everyone') or change_key ~ '^fun_fact:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') not valid;
alter table public.sport_quiz_audit drop constraint if exists sport_quiz_audit_action_check;
alter table public.sport_quiz_audit add constraint sport_quiz_audit_action_check check (action in
  ('settings','question_create','question_edit','question_approve','question_archive','question_void','question_review_media',
   'start','answer','skip','end','retention','life_settings','life_chapter',
   'fact_submit','fact_withdraw','fact_guardian','fact_approve','fact_decline','fact_clear',
   'question_pause','question_restore','question_dismiss','question_import','fresh_settings','report_alert')) not valid;

-- 6. Question guard: QUIZ-04's guard plus the approval shuffle, fact_id and the fun-fact shape --------------------------------
-- Content stays immutable on a version. One exception: draft → approved may permute the options (approval shuffle) when
-- the texts and the correct text are unchanged; true / false never moves. fact_id may only drop to null (account deleted).
create or replace function public.quiz_guard_question()
returns trigger language plpgsql set search_path = '' as $$
declare normalized jsonb; problems text[]; shuffled boolean := false;
begin
  if tg_op = 'UPDATE' then
    shuffled := old.status = 'draft' and new.status = 'approved' and (new.options,new.correct_option) is distinct from (old.options,old.correct_option);
    if shuffled and (new.question_type = 'true_false' or not public.quiz_same_options(old.options,new.options)
       or (new.options ->> new.correct_option) is distinct from (old.options ->> old.correct_option)) then raise exception 'quiz_immutable'; end if;
    if (new.question_key,new.version,new.sport,new.prompt,new.explanation,new.created_at,new.topic_category,new.source_notes,new.question_type,
        new.media_path,new.media_licence,new.media_source,new.media_attribution,new.media_alt_text,new.media_size_bytes,new.media_has_person,
        new.media_no_marks,new.media_exif_stripped,new.chapter,new.min_age_band,new.education_only,coalesce(new.fact_id,old.fact_id),
        case when shuffled then null else new.options end,case when shuffled then null else new.correct_option end)
      is distinct from (old.question_key,old.version,old.sport,old.prompt,old.explanation,old.created_at,old.topic_category,old.source_notes,old.question_type,
        old.media_path,old.media_licence,old.media_source,old.media_attribution,old.media_alt_text,old.media_size_bytes,old.media_has_person,
        old.media_no_marks,old.media_exif_stripped,old.chapter,old.min_age_band,old.education_only,old.fact_id,
        case when shuffled then null else old.options end,case when shuffled then null else old.correct_option end) then raise exception 'quiz_immutable'; end if;
  end if;
  if tg_op = 'UPDATE' and old.status = 'void' and new.status <> 'void' then raise exception 'quiz_void_final'; end if;
  normalized := public.quiz_normalize_options(new.options);
  if normalized is null and tg_op = 'UPDATE' and new.status in ('archived','void') then return new; end if;
  if normalized is null then raise exception 'quiz_options_invalid'; end if;
  if new.status = 'approved' and char_length(btrim(new.source_notes)) not between 10 and 1000 then raise exception 'quiz_sources_required'; end if;
  if new.status = 'approved' and new.question_type = 'image_choice' and (tg_op = 'INSERT' or old.status <> 'approved')
     and not coalesce((select s.images_enabled from public.sport_quiz_settings s where s.singleton), false) then raise exception 'quiz_images_off'; end if;
  if new.status = 'approved' and new.question_type = 'image_choice' and (tg_op = 'INSERT' or old.status <> 'approved')
     and (new.media_reviewed_by is null or new.media_reviewed_by is not distinct from new.created_by) then raise exception 'quiz_media_review_required'; end if;
  if new.question_type = 'image_choice' and new.correct_option < jsonb_array_length(normalized)
     and position(lower(normalized ->> new.correct_option) in lower(coalesce(new.media_alt_text,''))) > 0 then raise exception 'quiz_media_alt_reveals_answer'; end if;
  if new.topic_category = 'life' then
    if not exists(select 1 from public.sport_quiz_life_chapters where id = new.chapter) or new.min_age_band is distinct from '13' then raise exception 'quiz_life_fields_invalid'; end if;
    if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
      if new.education_only is not true then raise exception 'quiz_life_attestation_required'; end if;
      problems := public.quiz_life_copy_problems(new.prompt,new.options,new.explanation,new.chapter);
      if cardinality(problems) > 0 then raise exception 'quiz_life_copy: %', array_to_string(problems,', '); end if;
    end if;
  end if;
  -- A fun-fact question holds {answer} (exactly once, the correct option) and {name}; never the athlete's words.
  if tg_op = 'INSERT' and new.topic_category = 'athlete' and (new.fact_id is null
     or (select count(*) from jsonb_array_elements_text(normalized) x where x = '{answer}') <> 1
     or normalized ->> new.correct_option is distinct from '{answer}' or position('{name}' in new.prompt) = 0) then raise exception 'quiz_fact_question_invalid'; end if;
  if tg_op = 'INSERT' then new.options := normalized; end if;
  return new;
end $$;

-- 7. Self-heal counters (refreshed when an answer or time-out is committed) -----------------------------------------------
-- Distinct accounts on this version only, never admins or the author (the creating admin, or the fact's athlete).
-- Flags and difficulty appear only from min_responders; "confusing" depends on the type.
create or replace function public.quiz_question_stats_refresh(p_question uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare q public.sport_quiz_questions%rowtype; th jsonb; author uuid; n integer; r integer; t integer; pct numeric; tpct numeric;
  fl text[] := '{}'; diff text;
begin
  select * into q from public.sport_quiz_questions where id = p_question;
  if not found then return; end if;
  th := coalesce((select s.self_heal from public.sport_quiz_settings s where s.singleton),public.quiz_self_heal_defaults());
  author := coalesce((select f.athlete_id from public.quiz_athlete_facts f where f.id = q.fact_id),q.created_by);
  select count(distinct a.profile_id),
         count(distinct a.profile_id) filter (where i.status = 'answered' and i.answered_option = q.correct_option),
         count(distinct a.profile_id) filter (where i.status = 'expired')
    into n,r,t
    from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id join public.profiles p on p.id = a.profile_id
    where i.question_id = q.id and i.status in ('answered','expired') and a.profile_id is distinct from author and p.role <> 'admin' and not coalesce(p.is_admin,false);
  if n >= (th ->> 'min_responders')::integer then
    pct := r * 100.0 / n; tpct := t * 100.0 / n;
    if pct >= (th ->> 'too_easy_pct')::numeric then fl := fl || 'too_easy'::text; end if;
    if pct <= (th ->> case when q.question_type = 'true_false' then 'confusing_true_false_pct' else 'confusing_choice4_pct' end)::numeric then fl := fl || 'confusing'::text; end if;
    if tpct >= (th ->> 'too_long_pct')::numeric then fl := fl || 'too_long'::text; end if;
    diff := case when q.question_type = 'true_false' then case when pct >= 90 then 'easy' when pct <= 60 then 'hard' else 'medium' end
      else case when pct >= 80 then 'easy' when pct <= 40 then 'hard' else 'medium' end end;
  end if;
  insert into public.sport_quiz_question_stats(question_id,responders,right_count,timeouts,difficulty,flags,updated_at)
    values(q.id,n,r,t,diff,fl,clock_timestamp())
    on conflict (question_id) do update set responders = excluded.responders,right_count = excluded.right_count,timeouts = excluded.timeouts,
      difficulty = excluded.difficulty,flags = excluded.flags,updated_at = excluded.updated_at;
end $$;
create or replace function public.quiz_items_stats()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'issued' and new.status in ('answered','expired') then perform public.quiz_question_stats_refresh(new.question_id); end if;
  return new;
end $$;
drop trigger if exists quiz_round_items_stats on public.sport_quiz_round_items;
create trigger quiz_round_items_stats after update of status on public.sport_quiz_round_items for each row execute function public.quiz_items_stats();

create or replace function public.quiz_question_paused(p_question uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_question_stats s where s.question_id = p_question and s.paused_at is not null)
$$;
create or replace function public.quiz_question_hard(p_question uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_question_stats s where s.question_id = p_question and s.difficulty = 'hard')
$$;
create or replace function public.quiz_round_hard_count(p_attempt uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.sport_quiz_round_items i where i.attempt_id = p_attempt and public.quiz_question_hard(i.question_id)
$$;
-- Open reports: since the last admin review (restore / dismiss).
create or replace function public.quiz_open_reports(p_question uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.sport_quiz_reports r
  where r.question_id = p_question and r.created_at > coalesce((select s.reviewed_at from public.sport_quiz_question_stats s where s.question_id = p_question),'-infinity'::timestamptz)
$$;
create or replace function public.quiz_needs_look(p_question uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.paused_at is not null or s.queued_at is not null or not (s.flags <@ s.dismissed_flags)
    from public.sport_quiz_question_stats s where s.question_id = p_question),false) or public.quiz_open_reports(p_question) > 0
$$;
-- Shown position of a stored index (null order = stored order).
create or replace function public.quiz_shown_position(p_order smallint[],p_stored integer)
returns integer language sql immutable set search_path = '' as $$
  select case when p_stored is null then null when p_order is null then p_stored
    else (select (i - 1)::integer from generate_subscripts(p_order,1) i where p_order[i] = p_stored limit 1) end
$$;

-- 8. Fun facts: text filter, audience, eligibility and display ------------------------------------------------------------
-- Word scan shared by the refusal check and the look reasons (re-review 2026-10-15), so both read words the same way:
--   profanity: a token whose letters (swaps undone: sh!t, b1tch, Phuck) are a clear word, or a run of 3+ spaced single
--     letters spelling one ("f u c k"), refuses; the same letters anywhere else inside a word ("Crush it", "Scunthorpe")
--     is only a look;
--   (runs of 3+ repeated letters collapse first: "fuuuck"; common variants such as "biatch" are in the list);
--   digits: spelled digit words in a row (split at spaces and punctuation) refuse when phone-like (7 or more, or 4 or more with 3 that are not "oh"); 3
--     real digit words are a look; "oh" alone never counts;
--   address: an abbreviation (St, Ave, Rd, Blvd, Hwy, Apt) or Street / Highway after a capitalised name or a number, an
--     unambiguous word (avenue, boulevard, apartment, suite, PO box, zip code) or a number before road / drive / court /
--     lane refuses; a capitalised name before road / drive / court / lane ("Thunder Road") is a look; the bare words
--     ("Court vision", "Drive to the hoop") are fine.
create or replace function public.quiz_fact_word_scan(p_text text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare t text := btrim(regexp_replace(normalize(coalesce(p_text,''),nfkc),'\s+',' ','g'));
  m text; tok text; wc text; dw text; run text := ''; prof text; dig text; addr text; drun integer := 0; dreal integer := 0;
  strong constant text := '(fuck|fuk|fck|fuq|phuck|phuk|fvck|shit|sht|shyt|bitch|biatch|biotch|beyotch|bish|cunt|nigg[a-z]*|fagg[a-z]*|whore|hoe|slut|pussy|asshole|bastard|wanker|porn|cocaine)';
begin
  m := public.quiz_life_strip(public.quiz_life_normalize(public.quiz_fold_lookalikes(t)));
  foreach tok in array regexp_split_to_array(m,'\s+') loop
    -- Swaps undone, then runs of 3+ repeated letters collapse to one ("fuuuck").
    wc := regexp_replace(regexp_replace(translate(tok,'0134578@$!|','oieastbasii'),'[^a-z]','','g'),'([a-z])\1{2,}','\1','g');
    if wc ~ ('^' || strong || '(s|es|ed|er|ers|ing|in|y|ty|head|heads|face|hole)?$') then prof := 'refuse'; end if;
    if char_length(wc) = 1 then run := run || wc;
    else
      if char_length(run) >= 3 and run ~ strong then prof := 'refuse'; end if;
      run := '';
    end if;
  end loop;
  -- Spelled digits are counted on words split at spaces and any punctuation ("five-five-five", "five.five").
  foreach dw in array regexp_split_to_array(m,'[[:space:][:punct:]]+') loop
    if dw in ('zero','oh','one','two','three','four','five','six','seven','eight','nine') then
      drun := drun + 1; if dw <> 'oh' then dreal := dreal + 1; end if;
    else drun := 0; dreal := 0; end if;
    if drun >= 7 or (drun >= 4 and dreal >= 3) then dig := 'refuse'; elsif dreal >= 3 and dig is null then dig := 'look'; end if;
  end loop;
  if char_length(run) >= 3 and run ~ strong then prof := 'refuse'; end if;
  if prof is null and regexp_replace(regexp_replace(translate(m,'0134578@$!|','oieastbasii'),'[^a-z]','','g'),'([a-z])\1{2,}','\1','g') ~ strong then prof := 'look'; end if;
  if m ~ '(?<![a-z])(avenue|boulevard|apartment|suite|p\.?o\.? box|zip code)(?![a-z])'
     or t ~ '(^|[^A-Za-z])([A-Z][A-Za-z]*|[0-9]+)\.?\s+([Ss][Tt]|[Aa][Vv][Ee]|[Rr][Dd]|[Bb][Ll][Vv][Dd]|[Hh][Ww][Yy]|[Aa][Pp][Tt]|[Ss]treet|[Hh]ighway)\.?([^A-Za-z]|$)'
     or t ~ '[0-9]+\s+([A-Za-z]+\s+)?([Rr]oad|[Dd]rive|[Cc]ourt|[Ll]ane)([^A-Za-z]|$)' then addr := 'refuse';
  elsif t ~ '(^|[^A-Za-z])[A-Z][a-z]+\s+([Rr]oad|[Dd]rive|[Cc]ourt|[Ll]ane)([^A-Za-z]|$)' then addr := 'look'; end if;
  return jsonb_build_object('profanity',prof,'digits',dig,'address',addr);
end $$;
-- Refusal codes (empty = passes). Display text is NFKC-trimmed; matching runs on the Life cleanup (lowercase, macrons).
create or replace function public.quiz_fact_text_problems(p_text text,p_prompt text,p_athlete uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare t text := btrim(regexp_replace(normalize(coalesce(p_text,''),nfkc),'\s+',' ','g')); m text; n text; r jsonb := public.quiz_life_copy_rules();
  pr jsonb := public.quiz_fact_prompt(p_prompt); out text[] := '{}'; place text; w text; scan jsonb := public.quiz_fact_word_scan(p_text);
begin
  if pr is null then return array['prompt_invalid']; end if;
  m := public.quiz_life_strip(public.quiz_life_normalize(public.quiz_fold_lookalikes(t))); n := ' ' || public.quiz_fresh_norm(t) || ' ';
  if char_length(t) not between 2 and 40 then out := out || 'length'::text; end if;
  if t ~ '[^ -~À-ÖØ-öø-ſ‘’ʻ]' then out := out || 'emoji_or_non_latin'::text; end if;
  if m ~ '(https?|www\.)' or m ~ '[a-z0-9-]+\.[a-z]{2,}' or m ~ '(?<![a-z])dot\s+(com|net|org|co|io|me|app|gg|tv|ly|us)(?![a-z])' then out := out || 'link'::text; end if;
  if m ~ '[@#]' or m ~ '(?<![a-z])at\s+(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail|live|msn)(?![a-z])'
     or m ~ '(?<![a-z])(insta|instagram|ig|snap|snapchat|sc|tiktok|discord|twitter|facebook|fb|youtube|yt|twitch|threads|whatsapp|telegram)\s+[a-z0-9_.]+' then out := out || 'handle_or_email'::text; end if;
  -- Digits, or a phone-like run of spelled digits (quiz_fact_word_scan).
  if m ~ '[0-9]' or scan ->> 'digits' = 'refuse' then out := out || 'digits'::text; end if;
  if scan ->> 'address' = 'refuse' then out := out || 'address'::text; end if;
  if m ~ '(?<![a-z])(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays|noon|midnight|o.?clock|tonight|tomorrow|weekend|weekends)(?![a-z])'
     or m ~ '(?<![a-z])(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\.?\s+(morning|mornings|night|nights|afternoon|afternoons|evening|evenings)(?![a-z])'
     or m ~ '(?<![a-z])(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])' then out := out || 'weekday_or_time'::text; end if;
  -- The athlete's own school, team or town: the whole name, or any distinctive word of 4+ letters in it.
  for place in select public.quiz_fresh_norm(x) from (
      select s.name x from public.profiles p join public.schools_and_teams s on s.id = p.school_id where p.id = p_athlete
      union all select s.city from public.profiles p join public.schools_and_teams s on s.id = p.school_id where p.id = p_athlete
      union all select s.mascot from public.profiles p join public.schools_and_teams s on s.id = p.school_id where p.id = p_athlete
      union all select pl.school_name from public.profiles p join public.players pl on pl.id = p.player_id where p.id = p_athlete
      union all select pl.team from public.profiles p join public.players pl on pl.id = p.player_id where p.id = p_athlete) z loop
    if char_length(coalesce(place,'')) >= 3 and (position(' ' || place || ' ' in n) > 0
       or exists(select 1 from regexp_split_to_table(place,' ') wd where char_length(wd) >= 4
         and wd not in ('high','school','academy','college','university','prep','christian','saint','the','of','middle','junior','senior','central','north','south','east','west',
           'team','club','varsity','boys','girls','mens','womens','women','lady','ladies',
           'football','basketball','rugby','volleyball','soccer','baseball','softball','wrestling','track','field','lacrosse','hockey','tennis')
         and position(' ' || wd || ' ' in n) > 0)) then out := out || 'school_or_city'::text; exit; end if;
  end loop;
  if m ~ public.quiz_life_phrase_re(public.quiz_fact_not_okay_words()) or scan ->> 'profanity' = 'refuse' then out := out || 'not_okay_word'::text; end if;
  if m ~ public.quiz_life_phrase_re(r -> 'money_words')
     or m ~ ('(?<![a-z0-9_])(?:' || (select string_agg(x,'|') from jsonb_array_elements_text(r -> 'money_patterns') x) || ')(?![a-z0-9_])') then out := out || 'money_word'::text; end if;
  if m ~ public.quiz_life_phrase_re(r -> 'brands') then out := out || 'brand'::text; end if;
  if pr ? 'answers' then
    if not exists(select 1 from jsonb_array_elements_text(pr -> 'answers') a where public.quiz_fresh_norm(a) = public.quiz_fresh_norm(t)) then out := out || 'not_on_list'::text; end if;
  else
    for w in select x from jsonb_array_elements_text(pr -> 'wrong') x loop
      if public.quiz_near_match(t,w) then out := out || 'matches_wrong_option'::text; exit; end if;
    end loop;
  end if;
  return out;
end $$;
-- For the admin's look (not a refusal): a pair of capitalised words may name a person, place or business.
-- Borderline cases (security review 2026-10-15, re-review): schedule-like or place-like words, words hidden inside other
-- words or by swaps, a possible street name, spelled digits short of a phone number. The admin decides; nothing is refused.
create or replace function public.quiz_fact_look_reasons(p_text text,p_prompt text)
returns text[] language sql immutable set search_path = '' as $$
  with x as (select coalesce(p_text,'') t,public.quiz_life_strip(public.quiz_life_normalize(public.quiz_fold_lookalikes(coalesce(p_text,'')))) m,
    public.quiz_fact_word_scan(p_text) scan)
  select case when public.quiz_fact_prompt(p_prompt) ? 'answers' then '{}'::text[] else array_remove(array[
    case when x.t ~ '(^|[^A-Za-z])[A-Z][a-z]+\s+[A-Z][a-z]+' then 'capitalised_pair' end,
    case when x.m ~ '(?<![a-z])(daily|every day|everyday|after school|before school|mornings|evenings|nights|weekly|practice at|near|downtown)(?![a-z])' then 'schedule_or_place_words' end,
    case when x.scan ->> 'profanity' = 'look' or (regexp_replace(translate(x.m,'0134578@$!|','oieastbasii'),'[^a-z]','','g') ~ '(damn|hell|crap|piss|dick|cock|sexy|weed|vape|beer|drunk)'
      and not x.m ~ public.quiz_life_phrase_re(public.quiz_fact_not_okay_words())) then 'hidden_word' end,
    case when x.scan ->> 'address' = 'look' then 'possible_address' end,
    case when x.scan ->> 'digits' = 'look' then 'spelled_numbers' end],null) end from x
$$;
-- The athlete's fun_facts audience for this viewer: 13–15 are capped at friends; a guardian of the athlete passes unless
-- the audience is only me; no admin bypass. Blocks either way refuse.
create or replace function public.quiz_fact_audience_ok(p_athlete uuid,p_viewer uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles%rowtype; lvl text;
begin
  if p_athlete is null or p_viewer is null or p_athlete = p_viewer then return false; end if;
  select * into p from public.profiles where id = p_athlete;
  if not found or public.is_blocked_between(p_athlete,p_viewer) then return false; end if;
  lvl := coalesce(p.profile_audience ->> 'fun_facts',public.privacy_default_audience() ->> 'fun_facts','only_me');
  if public.profile_age_band(p_athlete) = 'teen_13_15' and lvl = 'everyone' then lvl := 'friends'; end if;
  if lvl not in ('friends','everyone') then return false; end if;
  if exists(select 1 from public.guardian_links l where l.minor_id = p_athlete and l.guardian_id = p_viewer and l.ended_at is null and l.confirmed_at is not null)
     or exists(select 1 from public.players pl where pl.id = p.player_id and pl.guardian_id = p_viewer) then return true; end if;
  if public.are_friends(p_athlete,p_viewer) then return true; end if;
  return lvl = 'everyone' and not coalesce(p.account_private,true);
end $$;
-- Issue and reveal check: switch on with a share, an approved live fact on an approved unpaused question, a verified
-- athlete with a recorded 13+ age (13–15 needs the guardian's approval), not the viewer, audience, no block, and the viewer
-- follows the athlete or started from that athlete's Learn card.
create or replace function public.quiz_fact_viewer_ok(p_fact uuid,p_viewer uuid,p_learn uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.athlete_questions_enabled and s.athlete_share_pct > 0 from public.sport_quiz_settings s where s.singleton),false)
    and exists(select 1 from public.quiz_athlete_facts f join public.profiles p on p.id = f.athlete_id join public.sport_quiz_questions q on q.id = f.question_id
      where f.id = p_fact and f.status = 'approved' and f.answer_text is not null and q.status = 'approved' and not public.quiz_question_paused(q.id)
        and p.age_blocked_at is null and p.verification_status = 'verified' and p.player_id is not null
        and public.profile_age_band(p.id) in ('adult','teen_16_17','teen_13_15')
        and (public.profile_age_band(p.id) <> 'teen_13_15' or f.guardian_decision = 'approved')
        and p.id <> p_viewer and not public.quiz_profile_closed(p_viewer) and public.quiz_fact_audience_ok(p.id,p_viewer)
        and (p.id = p_learn or exists(select 1 from public.crew_follows c join public.profiles v on v.user_id = c.follower_id
          where v.id = p_viewer and c.athlete_id = p.player_id)))
$$;
-- Display check for history and results (no follow / switch requirement): live text, verified open account, audience,
-- no block, guardian approval for 13–15.
create or replace function public.quiz_fact_visible(p_fact uuid,p_viewer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.quiz_athlete_facts f join public.profiles p on p.id = f.athlete_id
    where f.id = p_fact and f.status = 'approved' and f.answer_text is not null and p.age_blocked_at is null and p.verification_status = 'verified'
      and not public.quiz_question_paused(f.question_id)
      and (public.profile_age_band(p.id) <> 'teen_13_15' or f.guardian_decision = 'approved')
      and (p.id = p_viewer or public.quiz_fact_audience_ok(p.id,p_viewer)))
$$;
-- Fill a fun-fact question for one viewer: prompt, options, explanation and the athlete card. Null for other questions.
create or replace function public.quiz_fact_fill(p_question uuid,p_viewer uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.sport_quiz_questions%rowtype; f public.quiz_athlete_facts%rowtype; vis boolean; nm text; ans text; gone text;
begin
  select * into q from public.sport_quiz_questions where id = p_question;
  if q.id is null or q.topic_category <> 'athlete' then return null; end if;
  select * into f from public.quiz_athlete_facts where id = q.fact_id;
  vis := f.id is not null and public.quiz_fact_visible(f.id,p_viewer);
  gone := case when f.id is not null and f.status = 'withdrawn' then 'Removed by the athlete' when f.id is null or f.status = 'removed' then 'No longer available' end;
  nm := case when vis then public.first_name_of(f.athlete_id) else 'this athlete' end;
  ans := case when vis then f.answer_text else coalesce(gone,'Not available') end;
  return jsonb_build_object(
    'prompt',coalesce(gone,replace(q.prompt,'{name}',nm)),
    'options',(select jsonb_agg(case when x = '{answer}' then to_jsonb(ans) else to_jsonb(x) end order by o) from jsonb_array_elements_text(q.options) with ordinality t(x,o)),
    'explanation',case when gone is not null then gone || '.' else replace(q.explanation,'{name}',nm) end,
    'visible',vis,'prompt_key',f.prompt_key,'first_name',case when vis then nm end,
    'athlete_player_id',case when vis then (select p.player_id from public.profiles p where p.id = f.athlete_id) end);
end $$;
-- The fun-fact position of this personal round, or null: switch on with a share, not group / Life, two or more items, and
-- the player-week falls in the share (deterministic from the private salt; about 1 in 3 at most; never position 1).
create or replace function public.quiz_fact_slot(p_me uuid,p_attempt uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; s public.sport_quiz_settings%rowtype; seed text;
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt;
  select * into s from public.sport_quiz_settings where singleton;
  if a.id is null or a.round_kind <> 'personal' or a.group_id is not null or a.mode <> 'round' or coalesce(a.planned_items,0) < 2
     or not coalesce(s.athlete_questions_enabled,false) or coalesce(s.athlete_share_pct,0) = 0 then return null; end if;
  seed := s.fact_salt || ':' || p_me::text || ':' || a.week_start::text;
  if public.quiz_bucket(seed,0) >= least(s.athlete_share_pct * a.round_size,34) then return null; end if;
  return 2 + public.quiz_bucket(seed,1) % (a.planned_items - 1);
end $$;
-- One drawable fun fact for this viewer: at most one per round, unseen family, at most one per athlete per viewer per UTC
-- month; the Learn card's athlete first.
create or replace function public.quiz_fact_pick(p_me uuid,p_attempt uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; qid uuid; month_start timestamptz := date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt;
  if exists(select 1 from public.sport_quiz_round_items i join public.sport_quiz_questions q on q.id = i.question_id where i.attempt_id = a.id and q.topic_category = 'athlete') then return null; end if;
  select q.id into qid from public.sport_quiz_questions q join public.quiz_athlete_facts f on f.id = q.fact_id
    where q.status = 'approved' and q.topic_category = 'athlete' and public.quiz_fact_viewer_ok(f.id,p_me,a.learn_athlete_id)
      and (public.quiz_round_hard_count(a.id) < 2 or not public.quiz_question_hard(q.id))
      and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
      and not exists(select 1 from public.sport_quiz_round_items i2 join public.sport_quiz_attempts a2 on a2.id = i2.attempt_id
        join public.sport_quiz_questions q2 on q2.id = i2.question_id join public.quiz_athlete_facts f2 on f2.id = q2.fact_id
        where a2.profile_id = p_me and f2.athlete_id = f.athlete_id and i2.issued_at >= month_start)
    order by (f.athlete_id = a.learn_athlete_id) desc nulls last, random() limit 1 for share of q;
  return qid;
end $$;
-- Void issued items of one question (all viewers, or one): the round moves on to Next (or ends if it was the last item).
create or replace function public.quiz_fact_void_items(p_question uuid,p_viewer uuid,p_reason text,p_at timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select i.attempt_id,i.position,a.profile_id,a.status attempt_status,a.position current_position,a.planned_items
      from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
      where i.question_id = p_question and i.status = 'issued' and (p_viewer is null or a.profile_id = p_viewer) order by a.profile_id,i.attempt_id loop
    perform public.quiz_lock(r.profile_id);
    update public.sport_quiz_round_items set status = 'void',voided_at = p_at,closed_at = coalesce(closed_at,p_at),correction_reason = p_reason
      where attempt_id = r.attempt_id and position = r.position and status = 'issued';
    if r.attempt_status = 'issued' and r.position = r.current_position then
      if r.position >= r.planned_items then perform public.quiz_round_close(r.attempt_id,p_at,'corrected');
      else update public.sport_quiz_attempts set round_state = 'between',next_by = p_at + public.quiz_round_gap() where id = r.attempt_id and status = 'issued'; end if;
    end if;
    perform public.quiz_bump_history(r.profile_id); n := n + 1;
  end loop;
  return n;
end $$;
-- Retire a fun-fact question: void it (final) and every issued, unrevealed item.
create or replace function public.quiz_fact_retire_question(p_question uuid,p_reason text,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_question is null then return; end if;
  update public.sport_quiz_questions set status = 'void',reason = p_reason,reviewed_at = p_at where id = p_question and status <> 'void';
  perform public.quiz_fact_void_items(p_question,null,p_reason,p_at);
end $$;
-- Clear a fact's text in this transaction (withdrawal, unlink, under-13 block), retire its question and cancel a pending
-- guardian request. The audit row carries the cause code, never the text.
create or replace function public.quiz_fact_clear(p_fact uuid,p_cause text,p_actor uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.quiz_athlete_facts%rowtype;
begin
  select * into f from public.quiz_athlete_facts where id = p_fact for update;
  if not found or f.status in ('withdrawn','removed') then return; end if;
  update public.quiz_athlete_facts set answer_text = null,status = case when p_cause = 'withdrawn' then 'withdrawn' else 'removed' end,
    cleared_at = p_at,clear_cause = p_cause,look_reasons = '{}',updated_at = p_at where id = f.id;
  perform public.quiz_fact_retire_question(f.question_id,case when p_cause = 'withdrawn' then 'Removed by the athlete.' else 'Removed: the athlete account changed.' end,p_at);
  if f.guardian_request_id is not null then
    update public.guardian_approval_requests set status = 'cancelled',decided_at = p_at where id = f.guardian_request_id and status = 'pending';
  end if;
  insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at)
    values(p_actor,case when p_cause = 'withdrawn' then 'fact_withdraw' else 'fact_clear' end,f.question_id,p_cause,p_at);
end $$;

-- 9. Round items: shown order at issue; participant DTOs fill fun facts and apply the shown order -----------------------------
create or replace function public.quiz_round_issue(p_me uuid,p_attempt uuid,p_position integer,p_question uuid,p_at timestamptz,p_duration integer,p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare k uuid; t text; n integer;
begin
  select question_key,question_type,jsonb_array_length(options) into k,t,n from public.sport_quiz_questions where id = p_question;
  insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,status,next_request_id,shown_order)
    values(p_attempt,p_position,p_question,k,p_at,p_at + p_duration * interval '1 second','issued',p_request,
      case when t = 'true_false' then null else public.quiz_random_order(n) end);
  insert into public.sport_quiz_exposures(profile_id,question_key,question_id,first_issued_at) values(p_me,k,p_question,p_at);
end $$;
-- A fun-fact item may show the athlete's words only if it was answered (revealed then) or still passes the issue / reveal
-- check now (security review 2026-10-15: a timed-out or unanswered item is re-checked before anything is filled in).
create or replace function public.quiz_item_fact_ok(p_attempt uuid,p_position integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select q.topic_category <> 'athlete' or i.status = 'answered' or public.quiz_fact_viewer_ok(q.fact_id,a.profile_id,a.learn_athlete_id)
    from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id join public.sport_quiz_questions q on q.id = i.question_id
    where i.attempt_id = p_attempt and i.position = p_position),false)
$$;
-- The item's question as its player saw it: options in the stored shown order (identical on every replay), the fun fact
-- filled for this viewer. Never the correct option, the explanation or the order itself before the reveal.
create or replace function public.quiz_item_question_dto(p_attempt uuid,p_position integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare it public.sport_quiz_round_items%rowtype; q public.sport_quiz_questions%rowtype; viewer uuid; fill jsonb; opts jsonb; shown jsonb := '[]'; i integer;
begin
  select * into it from public.sport_quiz_round_items where attempt_id = p_attempt and position = p_position;
  if it.attempt_id is null then return null; end if;
  select * into q from public.sport_quiz_questions where id = it.question_id;
  select profile_id into viewer from public.sport_quiz_attempts where id = p_attempt;
  fill := public.quiz_fact_fill(q.id,viewer);
  if fill is not null and not public.quiz_item_fact_ok(p_attempt,p_position) then
    fill := fill || jsonb_build_object('prompt',replace(q.prompt,'{name}','this athlete'),'first_name',null,
      'options',(select jsonb_agg(case when x = '{answer}' then to_jsonb('Not available'::text) else to_jsonb(x) end order by o) from jsonb_array_elements_text(q.options) with ordinality t(x,o)));
  end if;
  opts := coalesce(fill -> 'options',q.options);
  if it.shown_order is not null then
    for i in 1..array_length(it.shown_order,1) loop shown := shown || jsonb_build_array(opts -> it.shown_order[i]::integer); end loop;
    opts := shown;
  end if;
  return jsonb_build_object('id',q.id,'question_key',q.question_key,'version',q.version,'topic_category',q.topic_category,'sport',q.sport,
    'prompt',coalesce(fill ->> 'prompt',q.prompt),'options',opts,'question_type',q.question_type,'shuffled',it.shown_order is not null)
    || case when fill is null then '{}'::jsonb else jsonb_build_object('fun_fact',jsonb_build_object('first_name',fill ->> 'first_name','prompt_key',fill ->> 'prompt_key')) end;
end $$;
-- Result of one closed item: stored indices (answered_option / correct_option, as before) plus the shown positions and
-- the shown order (after the reveal only), the filled explanation and, for a visible fun fact, the athlete card.
create or replace function public.quiz_item_result_dto(p_attempt uuid,p_position integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare it public.sport_quiz_round_items%rowtype; q public.sport_quiz_questions%rowtype; viewer uuid; fill jsonb;
begin
  select * into it from public.sport_quiz_round_items where attempt_id = p_attempt and position = p_position;
  if it.attempt_id is null then return null; end if;
  select * into q from public.sport_quiz_questions where id = it.question_id;
  select profile_id into viewer from public.sport_quiz_attempts where id = p_attempt;
  fill := public.quiz_fact_fill(q.id,viewer);
  -- An unanswered fun fact that no longer passes the check reveals nothing: no positions, order or athlete card.
  if fill is not null and not public.quiz_item_fact_ok(p_attempt,p_position) then
    return jsonb_build_object('answered_option',null,'correct_option',q.correct_option,'was_correct',null,'explanation','Fun fact no longer available.',
      'completed_at',null,'position',it.position,'item_status','fact_unavailable','answered_position',null,'correct_position',null,'shown_order',null);
  end if;
  return jsonb_build_object('answered_option',it.answered_option,'correct_option',q.correct_option,
    'was_correct',case when it.answered_option is null then null else it.answered_option = q.correct_option end,
    'explanation',coalesce(fill ->> 'explanation',q.explanation),'completed_at',it.answered_at,'position',it.position,
    'item_status',case when it.status = 'issued' then 'expired' else it.status end,
    'answered_position',coalesce(it.answered_position,public.quiz_shown_position(it.shown_order,it.answered_option)),
    'correct_position',public.quiz_shown_position(it.shown_order,q.correct_option),'shown_order',to_jsonb(it.shown_order))
    || case when fill is not null and (fill ->> 'visible')::boolean then jsonb_build_object('fun_fact',jsonb_build_object('first_name',fill ->> 'first_name','athlete_player_id',fill -> 'athlete_player_id')) else '{}'::jsonb end;
end $$;
create or replace function public.quiz_result_dto(p_attempt uuid,p_asof timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; it public.sport_quiz_round_items%rowtype; v jsonb;
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
  return public.quiz_item_result_dto(a.id,it.position);
end $$;
create or replace function public.quiz_round_items_dto(p_attempt uuid,p_asof timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('position',i.position,
    'status',case when i.status = 'issued' then 'expired' else i.status end,'question',public.quiz_item_question_dto(i.attempt_id,i.position),
    -- item_status stays only when it says fact_unavailable (an unanswered fun fact that no longer passes the check).
    'result',r.j - 'position' - (case when r.j ->> 'item_status' = 'fact_unavailable' then '' else 'item_status' end),
    'correction_reason',i.correction_reason) order by i.position),'[]'::jsonb)
  from public.sport_quiz_round_items i cross join lateral (select public.quiz_item_result_dto(i.attempt_id,i.position) j) r
  where i.attempt_id = p_attempt and (i.status <> 'issued' or i.expires_at <= p_asof)
$$;

-- 10. Draws: paused questions are never drawn; at most two hard per round; the fun-fact slot in personal rounds ---------------
create or replace function public.quiz_unseen_count(p_me uuid,p_topic text,p_sport text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.sport_quiz_questions q
  where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = p_topic and (p_sport is null or q.sport = p_sport)
    and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)
    and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
$$;
create or replace function public.quiz_fun_available(p_me uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_questions q where status = 'approved' and topic_category in ('science','geography','general') and question_type <> 'image_choice'
    and char_length(btrim(source_notes)) >= 10 and public.quiz_normalize_options(options) is not null and not public.quiz_question_paused(q.id)
    and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key))
$$;
create or replace function public.quiz_life_pool(p_me uuid,p_chapter text)
returns table(id uuid, question_key uuid, chapter text) language sql stable security definer set search_path = '' as $$
  select q.id,q.question_key,q.chapter from public.sport_quiz_questions q join public.sport_quiz_life_chapters c on c.id = q.chapter
  where q.status = 'approved' and q.topic_category = 'life' and q.question_type <> 'image_choice' and (p_chapter is null or q.chapter = p_chapter)
    and public.quiz_life_chapter_open(c.id) and not public.quiz_question_paused(q.id)
    and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10
    and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
$$;
-- The group-week set: drawn at random from the theme without reading any member's exposures, at most two hard (from the
-- question's own aggregate difficulty, never a member's history), never paused.
create or replace function public.quiz_group_ensure_set(p_group uuid,p_week date,p_size integer,p_at timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare theme text; n integer;
begin
  select count(*) into n from public.sport_quiz_group_sets where group_id = p_group and week_start = p_week;
  if n > 0 then return n; end if;
  select theme_sport into theme from public.sport_quiz_groups where id = p_group;
  insert into public.sport_quiz_group_sets(group_id,week_start,position,question_key,question_id,created_at,prune_after)
    select p_group,p_week,row_number() over (order by y.r),y.question_key,y.id,p_at,public.quiz_week_end(p_week) + interval '35 days'
    from (select z.* from (select x.*,row_number() over (partition by x.hard order by x.r) hr
            from (select q.id,q.question_key,random() r,public.quiz_question_hard(q.id) hard from public.sport_quiz_questions q
              where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = 'sport' and (theme is null or q.sport = theme)
                and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)) x) z
          where not z.hard or z.hr <= 2 order by z.r limit p_size) y;
  get diagnostics n = row_count;
  return n;
end $$;
create or replace function public.quiz_round_pick(p_me uuid,p_attempt uuid,p_position integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; qid uuid; hard_full boolean;
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt;
  hard_full := public.quiz_round_hard_count(a.id) >= 2;
  if a.round_kind = 'life' then
    select q.id into qid from public.sport_quiz_questions q where q.id in (select x.id from public.quiz_life_pool(p_me,a.sport_filter) x)
      and (not hard_full or not public.quiz_question_hard(q.id)) order by random() limit 1 for share of q;
    return qid;
  end if;
  if a.group_id is not null then
    select q.id into qid from public.sport_quiz_group_sets gs join public.sport_quiz_questions q on q.id = gs.question_id
      where gs.group_id = a.group_id and gs.week_start = a.week_start and gs.position = p_position
        and q.status = 'approved' and q.question_type <> 'image_choice' and public.quiz_normalize_options(q.options) is not null
        and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)
        and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = gs.question_key)
      for share of q;
    if qid is not null then return qid; end if;
    select q.id into qid from public.sport_quiz_questions q
      where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = 'sport' and (a.sport_filter is null or q.sport = a.sport_filter)
        and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)
        and (not hard_full or not public.quiz_question_hard(q.id))
        and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
      order by exists(select 1 from public.sport_quiz_group_sets gs where gs.group_id = a.group_id and gs.week_start = a.week_start
                        and gs.position > p_position and gs.question_key = q.question_key), random()
      limit 1 for share of q;
    return qid;
  end if;
  -- Personal rounds: the fun-fact slot first (issue-time checks inside quiz_fact_pick); any failure draws an ordinary question.
  if p_position = public.quiz_fact_slot(p_me,a.id) then
    qid := public.quiz_fact_pick(p_me,a.id);
    if qid is not null then return qid; end if;
  end if;
  select q.id into qid from public.sport_quiz_questions q
    where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = a.topic_category and a.topic_category not in ('life','athlete')
      and (a.sport_filter is null or q.sport = a.sport_filter)
      and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 and not public.quiz_question_paused(q.id)
      and (not hard_full or not public.quiz_question_hard(q.id))
      and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
    order by random() limit 1 for share of q;
  return qid;
end $$;

-- 11. Start: QUIZ-04's core plus the Learn card's athlete (validated here, recorded on the attempt, part of the digest) -------
drop function if exists public.quiz_round_begin(uuid,text,text,text,integer,date,text,uuid,text,uuid,text);
create or replace function public.quiz_round_begin(p_me uuid,p_kind text,p_topic text,p_sport text,p_duration integer,p_expected_week date,p_notice text,
  p_request uuid,p_secret text,p_group uuid,p_chapter text,p_learn_player uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare at timestamptz; w date; d text; r public.sport_quiz_requests%rowtype; a public.sport_quiz_attempts%rowtype; it public.sport_quiz_round_items%rowtype;
  q public.sport_quiz_questions%rowtype; p public.sport_quiz_preferences%rowtype; s public.sport_quiz_settings%rowtype;
  receipt jsonb; active jsonb; item jsonb; planned integer; setn integer; qid uuid; filter text := case when p_sport is null then null else btrim(p_sport) end;
  learn uuid; base jsonb;
begin
  if coalesce(p_kind,'') not in ('personal','group','life') or (p_kind = 'group') <> (p_group is not null) or (p_kind <> 'life' and p_chapter is not null)
     or (p_kind = 'life') <> (p_topic = 'life') or (p_learn_player is not null and (p_kind <> 'personal' or p_topic <> 'sport')) then raise exception 'quiz_start_invalid'; end if;
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
  -- The athlete id joins the digest only for a Learn-card Start, so every earlier Start keeps its digest.
  base := jsonb_build_array(p_kind,p_topic,filter,p_duration,p_expected_week,p_notice,p_secret,p_group,p_chapter);
  d := public.quiz_digest(case when p_learn_player is null then base else base || jsonb_build_array(p_learn_player) end);
  select * into r from public.sport_quiz_requests where profile_id = p_me and request_id = p_request;
  if found then
    if r.operation <> 'start' or (r.payload_digest is not null and r.payload_digest is distinct from d) then raise exception 'quiz_request_conflict'; end if;
    perform public.quiz_expire(p_me,at);
    select * into a from public.sport_quiz_attempts where id = r.attempt_id for update;
    if a.status = 'issued' and a.session_hash = public.hash_secret(p_secret) and s.enabled and p_me = any(s.pilot_accounts)
       and (a.round_kind <> 'life' or public.quiz_life_access(p_me)) then
      if a.mode = 'round' then
        select * into it from public.sport_quiz_round_items where attempt_id = a.id and position = 1;
        if a.round_state = 'item' and a.position = 1 and it.status = 'issued' and it.expires_at > at then
          active := public.quiz_item_question_dto(a.id,1); item := public.quiz_active_item(a.id);
        end if;
      elsif a.expires_at > at then
        select * into q from public.sport_quiz_questions where id = a.question_id for share;
        if q.status <> 'void' then active := public.quiz_question_dto(q.id); end if;
      end if;
    end if;
    return public.quiz_receipt_dto(p_me,p_request,at) || jsonb_build_object('server_now',at,'active_question',active,'active_item',item);
  end if;
  if exists(select 1 from public.sport_quiz_week_guards where profile_id = p_me and week_start = w and round_kind = p_kind) then
    select id into a.id from public.sport_quiz_attempts where profile_id = p_me and week_start = w and round_kind = p_kind;
    receipt := public.quiz_save_receipt(p_me,p_request,'start',w,d,a.id,'week_spent',at,p_kind);
    return receipt || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  perform public.quiz_require_testing(p_me);
  perform public.quiz_expire(p_me,at);
  if exists(select 1 from public.sport_quiz_attempts where profile_id = p_me and status = 'issued') then raise exception 'quiz_round_active'; end if;
  select * into p from public.sport_quiz_preferences where profile_id = p_me;
  -- The Learn card's athlete: a verified, open account other than the caller with no block either way; anything else is
  -- recorded as no athlete (the round still starts, so the card reveals nothing about blocks).
  if p_learn_player is not null then
    select pr.id into learn from public.profiles pr where pr.player_id = p_learn_player and pr.verification_status = 'verified' and pr.age_blocked_at is null
      and pr.id <> p_me and not public.is_blocked_between(pr.id,p_me) order by pr.id limit 1;
  end if;
  if p_kind = 'life' then
    if p.notice_version is distinct from 'timed-trivia-v1-testing' or p.life_notice_version is distinct from p_notice then raise exception 'quiz_notice_required'; end if;
    if not s.life_enabled then raise exception 'quiz_life_paused'; end if;
    if p.life_opt_in is not true then raise exception 'quiz_life_not_opted_in'; end if;
    if not public.quiz_life_band_ok(public.profile_age_band(p_me)) then raise exception 'quiz_ineligible'; end if;
    planned := least(s.round_size,public.quiz_life_unseen_count(p_me,p_chapter));
  else
    if p.notice_version is distinct from p_notice then raise exception 'quiz_notice_required'; end if;
    if p_kind = 'personal' then
      if coalesce(p_topic,'') not in ('sport','science','geography','general') then raise exception 'quiz_start_invalid'; end if;
      -- A Learn-card Start for a validated athlete is an explicit sports choice, so the fun-slot rotation does not apply;
      -- an unknown, blocked or unverified athlete id does not skip it (security review 2026-10-15).
      if learn is null and ((p_topic <> 'sport' and not public.quiz_fun_slot(p_me,w)) or (p_topic = 'sport' and public.quiz_fun_slot(p_me,w) and public.quiz_fun_available(p_me))) then
        raise exception 'quiz_topic_not_allowed'; end if;
      planned := least(s.round_size,public.quiz_unseen_count(p_me,p_topic,filter));
    else
      if not s.groups_enabled then raise exception 'quiz_groups_paused'; end if;
      if not exists(select 1 from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id
          where m.group_id = p_group and m.profile_id = p_me and m.status = 'active' and g.status = 'active') then raise exception 'quiz_group_not_member'; end if;
      if public.quiz_group_active_count(p_group) < 2 then raise exception 'quiz_group_too_small'; end if;
      select theme_sport into filter from public.sport_quiz_groups where id = p_group;
      setn := public.quiz_group_ensure_set(p_group,w,s.round_size,at);
      planned := least(setn,public.quiz_unseen_count(p_me,'sport',filter));
    end if;
  end if;
  if coalesce(planned,0) < 1 then raise exception 'quiz_no_question'; end if;
  at := clock_timestamp(); w := public.quiz_week_at(at);
  if w is distinct from p_expected_week then raise exception 'quiz_week_changed'; end if;
  if at + planned * p_duration * interval '1 second' + (planned - 1) * public.quiz_round_gap() > public.quiz_week_end(w) then raise exception 'quiz_week_closing'; end if;
  perform public.quiz_spend(p_me,w,at,p_kind);
  insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status,issued_at,mode,duration_seconds,started_at,expires_at,session_hash,
      round_state,position,planned_items,round_size,topic_category,sport_filter,group_id,round_kind,learn_athlete_id)
    values(p_me,w,null,'issued',at,'round',p_duration,at,at + p_duration * interval '1 second',public.hash_secret(p_secret),
      'item',1,planned,s.round_size,p_topic,case when p_kind = 'life' then p_chapter else filter end,p_group,p_kind,learn) returning * into a;
  qid := public.quiz_round_pick(p_me,a.id,1);
  if qid is null then raise exception 'quiz_no_question'; end if;
  perform public.quiz_round_issue(p_me,a.id,1,qid,at,p_duration,null);
  perform public.quiz_bump_history(p_me);
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,reason,created_at)
    values(p_me,'start',case when p_kind = 'life' or (select topic_category from public.sport_quiz_questions where id = qid) = 'athlete' then null else qid end,a.id,
      case when p_kind = 'life' then (select chapter from public.sport_quiz_questions where id = qid) || ' #1' end,at);
  receipt := public.quiz_save_receipt(p_me,p_request,'start',w,d,a.id,'started',at,p_kind);
  return receipt || jsonb_build_object('server_now',at,'active_question',public.quiz_item_question_dto(a.id,1),'active_item',public.quiz_active_item(a.id));
end $$;

create or replace function public.quiz_start(p_topic_category text,p_sport text,p_duration_seconds integer,p_expected_week date,
 p_notice_version text,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id);
begin
  if p_request_id is null or coalesce(p_topic_category,'') not in ('sport','science','geography','general') or p_duration_seconds is null or p_duration_seconds not in (30,90)
    or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' or p_notice_version is distinct from 'timed-trivia-v1-testing'
    or (p_sport is not null and char_length(btrim(p_sport)) not between 2 and 80) or (p_topic_category <> 'sport' and p_sport is not null) then raise exception 'quiz_start_invalid'; end if;
  return public.quiz_round_begin(me,'personal',p_topic_category,p_sport,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,null,null,null);
end $$;
create or replace function public.quiz_group_start(p_group_id uuid,p_duration_seconds integer,p_expected_week date,p_notice_version text,
 p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id);
begin
  if p_group_id is null or p_request_id is null or p_duration_seconds is null or p_duration_seconds not in (30,90)
    or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' or p_notice_version is distinct from 'timed-trivia-v1-testing' then raise exception 'quiz_start_invalid'; end if;
  return public.quiz_round_begin(me,'group','sport',null,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,p_group_id,null,null);
end $$;
create or replace function public.quiz_life_start(p_expected_week date,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid,
  p_notice_version text,p_chapter text default null,p_duration_seconds integer default 90)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id);
begin
  if p_request_id is null or p_duration_seconds is null or p_duration_seconds not in (30,90) or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$'
    or p_notice_version is distinct from 'life-playbook-v1-testing' or (p_chapter is not null and p_chapter !~ '^[a-z][a-z_]{2,39}$') then raise exception 'quiz_start_invalid'; end if;
  return public.quiz_round_begin(me,'life','life',null,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,null,p_chapter,null);
end $$;
-- Start from an athlete's "Learn {sport} with {name}" card: the personal weekly round, sports topic, with the athlete's
-- player id validated by the server (see quiz_round_begin).
create or replace function public.quiz_learn_start(p_athlete_player_id uuid,p_sport text,p_duration_seconds integer,p_expected_week date,
 p_notice_version text,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id);
begin
  if p_athlete_player_id is null or p_request_id is null or p_duration_seconds is null or p_duration_seconds not in (30,90)
    or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' or p_notice_version is distinct from 'timed-trivia-v1-testing'
    or (p_sport is not null and char_length(btrim(p_sport)) not between 2 and 80) then raise exception 'quiz_start_invalid'; end if;
  return public.quiz_round_begin(me,'personal','sport',p_sport,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,null,null,p_athlete_player_id);
end $$;

-- 12. Next and answer -----------------------------------------------------------------------------------------------------------
create or replace function public.quiz_next(p_attempt_id uuid,p_expected_position integer,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype;
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
    if r.operation <> 'next' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict'; end if;
    perform public.quiz_expire(me,at);
    select * into a from public.sport_quiz_attempts where id = r.attempt_id;
    select * into it from public.sport_quiz_round_items where attempt_id = a.id and next_request_id = p_request_id;
    if a.status = 'issued' and a.round_state = 'item' and a.position = it.position and it.status = 'issued' and it.expires_at > at
       and a.session_hash = public.hash_secret(p_session_secret) and s.enabled and me = any(s.pilot_accounts)
       and (a.round_kind <> 'life' or public.quiz_life_access(me)) then
      active := public.quiz_item_question_dto(a.id,it.position); item := public.quiz_active_item(a.id);
    end if;
    return public.quiz_receipt_dto(me,p_request_id,at) || jsonb_build_object('server_now',at,'active_question',active,'active_item',item);
  end if;
  select * into a from public.sport_quiz_attempts where id = p_attempt_id and profile_id = me for update;
  if a.id is null or a.mode <> 'round' then raise exception 'quiz_round_closed'; end if;
  if a.round_kind <> 'life' and not public.quiz_trivia_band(me) then raise exception 'quiz_ineligible'; end if;
  perform public.quiz_require_testing(me);
  if a.status = 'issued' and a.session_hash is distinct from public.hash_secret(p_session_secret) then raise exception 'quiz_capability_invalid'; end if;
  perform public.quiz_round_settle(a.id,at);
  select * into a from public.sport_quiz_attempts where id = p_attempt_id for update;
  if a.status <> 'issued' then
    return public.quiz_save_receipt(me,p_request_id,'next',a.week_start,d,a.id,a.status,at,a.round_kind) || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  if a.round_state <> 'between' or a.position <> p_expected_position then raise exception 'quiz_next_not_ready'; end if;
  at := clock_timestamp();
  if a.week_start <> public.quiz_week_at(at) or at + a.duration_seconds * interval '1 second' > public.quiz_week_end(a.week_start) then
    st := public.quiz_round_close(a.id,at,'week_end');
    return public.quiz_save_receipt(me,p_request_id,'next',a.week_start,d,a.id,'week_closed',at,a.round_kind) || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  if a.round_kind = 'life' and not public.quiz_life_access(me) then
    st := public.quiz_round_close(a.id,at,'access_revoked');
    return public.quiz_save_receipt(me,p_request_id,'next',a.week_start,d,a.id,'access_revoked',at,a.round_kind) || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  qid := public.quiz_round_pick(me,a.id,a.position + 1);
  if qid is null then
    st := public.quiz_round_close(a.id,at,'pool_exhausted');
    return public.quiz_save_receipt(me,p_request_id,'next',a.week_start,d,a.id,'pool_exhausted',at,a.round_kind) || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  perform public.quiz_round_issue(me,a.id,a.position + 1,qid,at,a.duration_seconds,p_request_id);
  update public.sport_quiz_attempts set position = position + 1,round_state = 'item',next_by = null,expires_at = at + a.duration_seconds * interval '1 second' where id = a.id;
  perform public.quiz_bump_history(me);
  return public.quiz_save_receipt(me,p_request_id,'next',a.week_start,d,a.id,'issued',at,a.round_kind)
    || jsonb_build_object('server_now',at,'active_question',public.quiz_item_question_dto(a.id,a.position + 1),'active_item',public.quiz_active_item(a.id));
end $$;

-- The client sends the position it showed; the item's stored shown order maps it to the stored index. Both are kept on
-- the item and in the receipt result. A fun fact is re-checked at the reveal: if it no longer passes, the item is voided
-- (outcome fact_unavailable) and the round moves on, so nothing about the fact is revealed.
create or replace function public.quiz_answer(p_attempt_id uuid,p_option integer,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype;
  a public.sport_quiz_attempts%rowtype; q public.sport_quiz_questions%rowtype; it public.sport_quiz_round_items%rowtype; outcome text; stored integer;
begin
  if p_request_id is null or p_attempt_id is null or p_option is null or p_option not between 0 and 3 or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' then raise exception 'quiz_answer_invalid'; end if;
  perform public.quiz_lock(me); select * into a from public.sport_quiz_attempts where id = p_attempt_id and profile_id = me for update;
  at := clock_timestamp(); d := public.quiz_digest(jsonb_build_array(p_attempt_id,p_option,p_session_secret));
  select * into r from public.sport_quiz_requests where profile_id = me and request_id = p_request_id;
  if found then if r.operation <> 'answer' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict'; end if; return public.quiz_receipt_dto(me,p_request_id,at); end if;
  if a.id is null or a.mode not in ('timed','round') then raise exception 'quiz_round_closed'; end if;
  if a.round_kind <> 'life' and not public.quiz_trivia_band(me) then raise exception 'quiz_ineligible'; end if;
  perform public.quiz_require_testing(me);
  if a.status = 'issued' and a.session_hash is distinct from public.hash_secret(p_session_secret) then raise exception 'quiz_capability_invalid'; end if;
  if a.mode = 'timed' then
    if a.status = 'issued' and a.expires_at <= at then perform public.quiz_expire(me,at); return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'expired',at); end if;
    if a.status <> 'issued' then return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,a.status,at); end if;
    select * into q from public.sport_quiz_questions where id = a.question_id for share;
    if q.status = 'void' or public.quiz_normalize_options(q.options) is null then raise exception 'quiz_question_unavailable'; end if;
    if p_option >= jsonb_array_length(q.options) then raise exception 'quiz_answer_invalid'; end if;
    at := clock_timestamp();
    if a.expires_at <= at then perform public.quiz_expire(me,at); return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'expired',at); end if;
    update public.sport_quiz_attempts set status = 'completed',answered_option = p_option,request_id = p_request_id,completed_at = at,closed_at = at,close_reason = 'answered',session_hash = null where id = a.id;
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
  if p_option >= coalesce(array_length(it.shown_order,1),jsonb_array_length(q.options)) then raise exception 'quiz_answer_invalid'; end if;
  stored := case when it.shown_order is null then p_option else it.shown_order[p_option + 1] end;
  at := clock_timestamp();
  if it.expires_at <= at then
    perform public.quiz_round_settle(a.id,at);
    return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'expired',at);
  end if;
  if q.topic_category = 'athlete' and not public.quiz_fact_viewer_ok(q.fact_id,me,a.learn_athlete_id) then
    update public.sport_quiz_round_items set status = 'void',voided_at = at,closed_at = at,correction_reason = 'Fun fact no longer available'
      where attempt_id = a.id and position = a.position;
    if a.position >= a.planned_items then perform public.quiz_round_close(a.id,at,'corrected');
    else update public.sport_quiz_attempts set round_state = 'between',next_by = at + public.quiz_round_gap() where id = a.id; end if;
    perform public.quiz_bump_history(me);
    return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'fact_unavailable',at);
  end if;
  update public.sport_quiz_round_items set status = 'answered',answered_option = stored,answered_position = p_option,answered_at = at,answer_request_id = p_request_id,closed_at = at
    where attempt_id = a.id and position = a.position;
  if a.position >= a.planned_items then perform public.quiz_round_close(a.id,at,'answered'); outcome := 'completed';
  else update public.sport_quiz_attempts set round_state = 'between',next_by = at + public.quiz_round_gap() where id = a.id; outcome := 'answered'; end if;
  perform public.quiz_sync_badges(me,at);
  perform public.quiz_bump_history(me);
  -- Life and fun-fact answer rows never carry the question id.
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,reason,created_at)
    values(me,'answer',case when a.round_kind = 'life' or q.topic_category = 'athlete' then null else q.id end,a.id,case when a.round_kind = 'life' then q.chapter || ' #' || a.position end,at);
  return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,outcome,at);
end $$;

-- 13. Reports and auto-pause (§6.9) -------------------------------------------------------------------------------------------
-- After the reveal only (a closed round item of the caller's own for that question). Fixed reasons, no free text. The
-- reply never says whether the report counted or paused anything.
create or replace function public.quiz_report(p_question_id uuid,p_reason text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id); at timestamptz; q public.sport_quiz_questions%rowtype; s public.sport_quiz_settings%rowtype;
  rr jsonb := public.quiz_report_rules(); author uuid; fact boolean; why text; st public.sport_quiz_question_stats%rowtype; since timestamptz; n integer;
  hit boolean := false; today timestamptz; safety boolean := false; capped boolean := false;
begin
  if p_question_id is null or coalesce(p_reason,'') not in ('wrong_answer','confusing','not_okay','private') then raise exception 'quiz_report_invalid'; end if;
  select * into s from public.sport_quiz_settings where singleton for share;
  if not found then raise exception 'quiz_unavailable'; end if;
  -- Lock order: settings → this question → this reporter's report budget (separate from the account lifecycle lock).
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz-question:' || p_question_id,0));
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz-report:' || me,0));
  at := clock_timestamp(); today := date_trunc('day',at at time zone 'UTC') at time zone 'UTC';
  select * into q from public.sport_quiz_questions where id = p_question_id;
  if q.id is null or not exists(select 1 from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
      where a.profile_id = me and i.question_id = q.id and (i.status <> 'issued' or i.expires_at <= at)) then raise exception 'quiz_report_not_allowed'; end if;
  fact := q.topic_category = 'athlete';
  if p_reason = 'private' and not fact then raise exception 'quiz_report_invalid'; end if;
  if s.reports_paused then return jsonb_build_object('contract_version',5,'outcome','paused','question_id',q.id); end if;
  if exists(select 1 from public.sport_quiz_reports where reporter_id = me and question_id = q.id) then
    return jsonb_build_object('contract_version',5,'outcome','already_reported','question_id',q.id); end if;
  if (select count(*) from public.sport_quiz_reports where reporter_id = me and created_at > at - interval '1 day') >= (rr ->> 'per_account_per_day')::integer then
    raise exception 'quiz_report_limit'; end if;
  author := coalesce((select f.athlete_id from public.quiz_athlete_facts f where f.id = q.fact_id),q.created_by);
  if author is not null and public.is_blocked_between(me,author) then why := 'blocked_pair';
  elsif coalesce((select p.created_at from public.profiles p where p.id = me),at) > at - make_interval(days => (rr ->> 'min_account_days')::integer) then why := 'new_account';
  elsif not exists(select 1 from public.sport_quiz_attempts a where a.profile_id = me and public.quiz_attempt_qualifies(a.id)) then why := 'no_completed_round'; end if;
  insert into public.sport_quiz_reports(question_id,topic_category,reporter_id,reason,is_fact,counted,not_counted_reason,created_at)
    values(q.id,q.topic_category,me,p_reason,fact,why is null,why,at);
  insert into public.sport_quiz_question_stats(question_id,updated_at) values(q.id,at) on conflict (question_id) do nothing;
  select * into st from public.sport_quiz_question_stats where question_id = q.id for update;
  if why is null and st.paused_at is null and q.status = 'approved' then
    since := coalesce(st.restored_at,'-infinity'::timestamptz);
    select count(*) into n from public.sport_quiz_reports where question_id = q.id and counted and created_at > since;
    -- Security review 2026-10-15: a counted "Not okay" / "Shares something private" on a fun fact always pauses it,
    -- after a restore too and past the daily cap (the alert is still recorded).
    safety := fact and p_reason in (select jsonb_array_elements_text(rr -> 'fact_reasons'));
    if safety then hit := true;
    elsif st.restored_at is not null then hit := n >= (rr ->> 'restored_reporters')::integer;
    elsif fact then hit := n >= (rr ->> 'ordinary_reporters')::integer or (select count(*) from public.sport_quiz_reports where question_id = q.id and counted
      and reason in (select jsonb_array_elements_text(rr -> 'fact_reasons'))) >= (rr ->> 'fact_reporters')::integer;
    else hit := n >= (rr ->> 'ordinary_reporters')::integer; end if;
    capped := (select count(*) from public.sport_quiz_question_stats s2 join public.sport_quiz_questions q2 on q2.id = s2.question_id
      where q2.topic_category = q.topic_category and s2.paused_at >= today) >= (rr ->> 'daily_pause_cap')::integer;
    if hit and capped and not exists(select 1 from public.sport_quiz_audit where action = 'report_alert' and reason = q.topic_category and created_at >= today) then
      insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(null,'report_alert',q.topic_category,at);
    end if;
    if hit then
      if capped and not safety then
        -- Daily cap reached for this topic: the question stays live and waits in Needs a look.
        update public.sport_quiz_question_stats set queued_at = coalesce(queued_at,at),updated_at = at where question_id = q.id;
      else
        update public.sport_quiz_question_stats set paused_at = at,pause_reason = case when fact then 'fact_report' else 'reports' end,queued_at = null,updated_at = at
          where question_id = q.id;
        insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(null,'question_pause',q.id,'reports',at);
        if fact then perform public.quiz_fact_void_items(q.id,null,'Paused for a check',at); end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('contract_version',5,'outcome','reported','question_id',q.id);
end $$;

-- 14. Fun facts: athlete, guardian and export RPCs ------------------------------------------------------------------------------
-- An athlete account (linked to a roster athlete) with a recorded 13+ age; no recorded age means no submissions.
create or replace function public.quiz_fact_actor(p_expected uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id(); band text;
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null or me is null then raise exception 'quiz_ineligible'; end if;
  if p_expected is null or me is distinct from p_expected then raise exception 'quiz_identity_changed'; end if;
  band := public.profile_age_band(me);
  if band in ('unknown','not_given') then raise exception 'quiz_fact_age_needed'; end if;
  if band not in ('adult','teen_16_17','teen_13_15') then raise exception 'quiz_ineligible'; end if;
  if not exists(select 1 from public.profiles p where p.id = me and p.player_id is not null) then raise exception 'quiz_fact_athlete_only'; end if;
  return me;
end $$;
-- The guardian step is still open only while its request is pending and younger than MINOR-01's 14 days.
create or replace function public.quiz_fact_request_open(p_request uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.guardian_approval_requests r where r.id = p_request and r.status = 'pending'
    and r.requested_at > timezone('utc',now()) - interval '14 days')
$$;
-- Owner view of one fact: own text, the effective status ("paused" for a check while its question is paused; a lapsed
-- guardian request reads as waiting again), decisions with reason codes. No counts of reporters, no viewer.
create or replace function public.quiz_fact_owner_dto(p_fact uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',f.id,'prompt_key',f.prompt_key,'label',public.quiz_fact_prompt(f.prompt_key) ->> 'label','answer_text',f.answer_text,
    'status',case when f.status = 'approved' and public.quiz_question_paused(f.question_id) then 'paused'
      when f.status = 'guardian_review' and not public.quiz_fact_request_open(f.guardian_request_id) then 'waiting_guardian' else f.status end,
    'submitted_at',f.submitted_at,'guardian_decision',f.guardian_decision,'guardian_decided_at',f.guardian_decided_at,'admin_decided_at',f.admin_decided_at,
    'decline_reason',f.decline_reason,'cleared_at',f.cleared_at)
  from public.quiz_athlete_facts f where f.id = p_fact
$$;
create or replace function public.quiz_fact_submit(p_prompt_key text,p_answer text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_fact_actor(p_expected_profile_id); at timestamptz; t text; problems text[]; pr jsonb := public.quiz_fact_prompt(p_prompt_key);
  f public.quiz_athlete_facts%rowtype; band text; st text; req uuid; k text;
begin
  if pr is null then raise exception 'quiz_fact_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton and athlete_questions_enabled for share;
  if not found then raise exception 'quiz_facts_paused'; end if;
  perform pg_advisory_xact_lock(hashtextextended('quiz-fact:' || me,0));
  at := clock_timestamp();
  t := btrim(regexp_replace(normalize(coalesce(p_answer,''),nfkc),'\s+',' ','g'));
  problems := public.quiz_fact_text_problems(t,p_prompt_key,me);
  if cardinality(problems) > 0 then raise exception 'quiz_fact_text: %', array_to_string(problems,', '); end if;
  if pr ? 'answers' then select a into t from jsonb_array_elements_text(pr -> 'answers') a where public.quiz_fresh_norm(a) = public.quiz_fresh_norm(t) limit 1; end if;
  select * into f from public.quiz_athlete_facts where athlete_id = me and prompt_key = p_prompt_key and status not in ('declined','withdrawn','removed') for update;
  if f.id is not null then
    -- Only an unsent draft (or one whose guardian request lapsed) can be edited; anything else is withdraw-and-resubmit.
    if not (f.status = 'waiting_guardian' or (f.status = 'guardian_review' and not public.quiz_fact_request_open(f.guardian_request_id))) then
      raise exception 'quiz_fact_prompt_taken'; end if;
  else
    if (select count(*) from public.quiz_athlete_facts where athlete_id = me and status not in ('declined','withdrawn','removed')) >= 3 then raise exception 'quiz_fact_limit'; end if;
    insert into public.quiz_athlete_facts(athlete_id,prompt_key,answer_text,status,submitted_at,updated_at)
      values(me,p_prompt_key,t,'waiting_guardian',at,at) returning * into f;
  end if;
  band := public.profile_age_band(me); k := 'fun_fact:' || f.id::text;
  if band = 'teen_13_15' then
    if public.minor_guardian_count(me) > 0 then
      update public.guardian_approval_requests set status = 'expired' where minor_id = me and change_key = k and status = 'pending'
        and requested_at <= timezone('utc',now()) - interval '14 days';
      insert into public.guardian_approval_requests(minor_id,change_key) values(me,k) on conflict do nothing returning id into req;
      if req is null then select id into req from public.guardian_approval_requests where minor_id = me and change_key = k and status = 'pending'; end if;
      st := 'guardian_review';
      perform public.log_supervision_event(me,'approval_requested',jsonb_build_object('changes',jsonb_build_array('fun_fact')));
    else
      -- Saved as a draft; nothing asks them to invite a guardian.
      st := 'waiting_guardian';
    end if;
  else st := 'admin_review'; end if;
  update public.quiz_athlete_facts set answer_text = t,status = st,look_reasons = public.quiz_fact_look_reasons(t,p_prompt_key),submitted_at = at,
    guardian_request_id = req,guardian_decision = null,guardian_decided_at = null,updated_at = at where id = f.id;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'fact_submit',p_prompt_key || ':' || st,at);
  return jsonb_build_object('contract_version',5,'fact',public.quiz_fact_owner_dto(f.id));
end $$;
-- Only the athlete withdraws (never a guardian or an admin). The text is cleared now; the question and every issued,
-- unrevealed item are voided in the same transaction.
create or replace function public.quiz_fact_withdraw(p_fact_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.my_profile_id(); at timestamptz; f public.quiz_athlete_facts%rowtype;
begin
  if auth.role() is distinct from 'authenticated' or me is null then raise exception 'quiz_ineligible'; end if;
  if p_expected_profile_id is null or me is distinct from p_expected_profile_id then raise exception 'quiz_identity_changed'; end if;
  perform 1 from public.sport_quiz_settings where singleton for share;
  perform pg_advisory_xact_lock(hashtextextended('quiz-fact:' || me,0));
  at := clock_timestamp();
  select * into f from public.quiz_athlete_facts where id = p_fact_id and athlete_id = me for update;
  if f.id is null then raise exception 'quiz_fact_missing'; end if;
  if f.status not in ('withdrawn','removed') then
    if f.status = 'guardian_review' and public.quiz_fact_request_open(f.guardian_request_id) then
      perform public.log_supervision_event(me,'approval_cancelled','{}'::jsonb);
    end if;
    perform public.quiz_fact_clear(f.id,'withdrawn',me,at);
  end if;
  return jsonb_build_object('contract_version',5,'fact',public.quiz_fact_owner_dto(f.id));
end $$;
-- Distinct fans who saw the fact revealed in one completed UTC month, as a bucket (null under 5). Never counted: the
-- athlete, their guardians, admins and the testing group.
create or replace function public.quiz_fact_month_bucket(p_fact uuid,p_month date)
returns text language sql stable security definer set search_path = '' as $$
  with f as (select x.athlete_id,(select pl.guardian_id from public.profiles p join public.players pl on pl.id = p.player_id where p.id = x.athlete_id) record_guardian
             from public.quiz_athlete_facts x where x.id = p_fact),
  v as (select distinct a.profile_id from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
        join public.sport_quiz_questions q on q.id = i.question_id
        where q.fact_id = p_fact and i.status in ('answered','expired')
          and i.issued_at >= (p_month::timestamp at time zone 'UTC') and i.issued_at < ((p_month + interval '1 month')::timestamp at time zone 'UTC')),
  n as (select count(*) c from v join public.profiles p on p.id = v.profile_id cross join f
        where p.id <> f.athlete_id and p.role <> 'admin' and not coalesce(p.is_admin,false) and p.id is distinct from f.record_guardian
          and not public.is_blocked_between(f.athlete_id,p.id)
          and not (p.id = any(coalesce((select s.pilot_accounts from public.sport_quiz_settings s where s.singleton),'{}'::uuid[])))
          and not exists(select 1 from public.guardian_links l where l.minor_id = f.athlete_id and l.guardian_id = p.id and l.confirmed_at is not null))
  select case when c >= 25 then '25+' when c >= 10 then '10+' when c >= 5 then '5+' end from n
$$;
create or replace function public.quiz_fact_counts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id(); this_month date := date_trunc('month',statement_timestamp() at time zone 'UTC')::date;
begin
  if auth.role() is distinct from 'authenticated' or me is null then raise exception 'quiz_ineligible'; end if;
  return jsonb_build_object('contract_version',5,'profile_id',me,
    'facts',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'prompt_key',f.prompt_key,
      'months',(select jsonb_agg(jsonb_build_object('month',to_char(m,'YYYY-MM'),'bucket',public.quiz_fact_month_bucket(f.id,m::date)) order by m desc)
        from generate_series(this_month - interval '3 months',this_month - interval '1 month',interval '1 month') m)) order by f.submitted_at)
      from public.quiz_athlete_facts f where f.athlete_id = me and f.status = 'approved'),'[]'::jsonb));
end $$;
-- The athlete's own facts, prompts (with the meal list), limits and the switch. Works for any signed-in account so the
-- app can explain why submitting is not open.
create or replace function public.quiz_fact_mine()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id(); band text; p public.profiles%rowtype; lvl text;
begin
  if auth.role() is distinct from 'authenticated' or me is null then raise exception 'quiz_ineligible'; end if;
  select * into p from public.profiles where id = me; band := public.profile_age_band(me);
  lvl := coalesce(p.profile_audience ->> 'fun_facts',public.privacy_default_audience() ->> 'fun_facts');
  return jsonb_build_object('contract_version',5,'profile_id',me,
    'enabled',coalesce((select s.athlete_questions_enabled from public.sport_quiz_settings s where s.singleton),false),
    'can_submit',p.player_id is not null and band in ('adult','teen_16_17','teen_13_15'),'needs_birth',band in ('unknown','not_given'),
    'guardian_needed',band = 'teen_13_15','has_guardian',public.minor_guardian_count(me) > 0,'verified',p.verification_status = 'verified',
    'audience',lvl,'effective_audience',case when band = 'teen_13_15' and lvl = 'everyone' then 'friends' else lvl end,
    'max_live',3,'live',(select count(*) from public.quiz_athlete_facts where athlete_id = me and status not in ('declined','withdrawn','removed')),
    'prompts',(select jsonb_agg(jsonb_build_object('key',x ->> 'key','label',x ->> 'label','answers',x -> 'answers')) from jsonb_array_elements(public.quiz_fact_prompts()) x),
    'facts',coalesce((select jsonb_agg(public.quiz_fact_owner_dto(f.id) order by f.submitted_at desc) from public.quiz_athlete_facts f where f.athlete_id = me),'[]'::jsonb));
end $$;
-- Data export: every fact with its text (while kept) and every decision.
create or replace function public.quiz_fact_export()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id();
begin
  if auth.role() is distinct from 'authenticated' or me is null then raise exception 'quiz_ineligible'; end if;
  return jsonb_build_object('contract_version',5,'profile_id',me,'exported_at',statement_timestamp(),
    'facts',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'prompt_key',f.prompt_key,'answer_text',f.answer_text,'status',f.status,
      'submitted_at',f.submitted_at,'guardian_decision',f.guardian_decision,'guardian_decided_at',f.guardian_decided_at,
      'admin_decision',case when f.admin_decided_at is null then null when f.status = 'declined' and f.decline_reason <> 'guardian' then 'declined' else 'approved' end,
      'admin_decided_at',f.admin_decided_at,'decline_reason',f.decline_reason,'cleared_at',f.cleared_at,'clear_cause',f.clear_cause,'look_reasons',to_jsonb(f.look_reasons))
      order by f.submitted_at) from public.quiz_athlete_facts f where f.athlete_id = me),'[]'::jsonb));
end $$;
-- Guardian: fun facts waiting for this guardian (teens they supervise). The guardian sees the text to decide; they can
-- approve or decline only, never write, edit or withdraw.
create or replace function public.quiz_fact_guardian_pending()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id();
begin
  if auth.role() is distinct from 'authenticated' or me is null then raise exception 'quiz_ineligible'; end if;
  return jsonb_build_object('contract_version',5,'profile_id',me,
    'facts',coalesce((select jsonb_agg(jsonb_build_object('fact_id',f.id,'minor_profile_id',f.athlete_id,'first_name',public.first_name_of(f.athlete_id),
      'prompt_key',f.prompt_key,'label',public.quiz_fact_prompt(f.prompt_key) ->> 'label','answer_text',f.answer_text,'requested_at',r.requested_at) order by r.requested_at)
      from public.quiz_athlete_facts f join public.guardian_approval_requests r on r.id = f.guardian_request_id
      where f.status = 'guardian_review' and public.quiz_fact_request_open(r.id) and public.is_supervising_guardian(f.athlete_id)),'[]'::jsonb));
end $$;
create or replace function public.quiz_fact_guardian_decide(p_fact_id uuid,p_approve boolean,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.my_profile_id(); f public.quiz_athlete_facts%rowtype; at timestamptz;
begin
  if auth.role() is distinct from 'authenticated' or me is null then raise exception 'quiz_ineligible'; end if;
  if p_expected_profile_id is null or me is distinct from p_expected_profile_id then raise exception 'quiz_identity_changed'; end if;
  if p_fact_id is null or p_approve is null then raise exception 'quiz_fact_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for share;
  select * into f from public.quiz_athlete_facts where id = p_fact_id for update;
  if f.id is null or not public.is_supervising_guardian(f.athlete_id) then raise exception 'quiz_fact_guardian_only'; end if;
  if f.status <> 'guardian_review' or not public.quiz_fact_request_open(f.guardian_request_id) then raise exception 'quiz_fact_already_decided'; end if;
  at := clock_timestamp();
  update public.guardian_approval_requests set status = case when p_approve then 'approved' else 'declined' end,decided_by = me,decided_at = at
    where id = f.guardian_request_id;
  perform public.log_supervision_event(f.athlete_id,'approval_decided',jsonb_build_object('change','fun_fact','approved',p_approve));
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'fact_guardian',case when p_approve then 'approved' else 'declined' end,at);
  return jsonb_build_object('contract_version',5,'fact_id',f.id,'status',(select status from public.quiz_athlete_facts where id = f.id));
end $$;

-- 15. Guardian approvals, clearing on unlink / under-13 / account deletion, and blocks --------------------------------------------
-- Any decision on a fun_fact request (through either function) must come from a supervising guardian; it moves the fact.
create or replace function public.quiz_fact_on_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if new.change_key not like 'fun_fact:%' or new.status is not distinct from old.status then return new; end if;
  fid := substr(new.change_key,10)::uuid;
  if new.status in ('approved','declined') then
    if new.decided_by is null or not exists(select 1 from public.guardian_links l where l.minor_id = new.minor_id and l.guardian_id = new.decided_by
        and l.ended_at is null and l.confirmed_at is not null) then raise exception 'quiz_fact_guardian_only'; end if;
    update public.quiz_athlete_facts set status = case when new.status = 'approved' then 'admin_review' else 'declined' end,guardian_decision = new.status,
      guardian_decided_at = coalesce(new.decided_at,clock_timestamp()),decline_reason = case when new.status = 'declined' then 'guardian' end,updated_at = clock_timestamp()
      where id = fid and status = 'guardian_review';
  elsif new.status in ('cancelled','expired') then
    update public.quiz_athlete_facts set status = 'waiting_guardian',updated_at = clock_timestamp() where id = fid and status = 'guardian_review';
  end if;
  return new;
end $$;
drop trigger if exists quiz_fact_approval on public.guardian_approval_requests;
create trigger quiz_fact_approval after update of status on public.guardian_approval_requests for each row execute function public.quiz_fact_on_approval();

-- MINOR-01's decision function with the fun_fact type: only the supervising guardian (never an admin), and no privacy
-- setting changes for a fun fact.
create or replace function public.guardian_decide_approval(request_id uuid, approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.guardian_approval_requests%rowtype;
begin
  select * into r from public.guardian_approval_requests a where a.id = request_id for update;
  if not found or not (public.is_supervising_guardian(r.minor_id) or (public.current_user_role() = 'admin' and r.change_key not like 'fun_fact:%')) then
    raise exception 'This request is not yours to decide.';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request was already handled.';
  end if;
  -- Fail closed, as in MINOR-01: only the two privacy requests and fun_fact requests are decided here.
  if r.change_key not in ('account_public', 'friend_requests_everyone') and r.change_key !~ '^fun_fact:[0-9a-f-]{36}$' then
    raise exception 'This request cannot be decided here.';
  end if;
  if r.requested_at <= timezone('utc', now()) - interval '14 days' then
    update public.guardian_approval_requests set status = 'expired' where id = r.id;
    return public.guardian_view(r.minor_id) || jsonb_build_object('notice', 'This request expired. They can ask again.');
  end if;
  if coalesce(approve, false) then
    if r.change_key = 'account_public' then
      if public.is_minor_band(public.profile_age_band(r.minor_id)) and not public.minor_has_consent(r.minor_id, 'public_profile') then
        raise exception 'Sign the consent with "public profile" allowed first.';
      end if;
      perform public.apply_privacy_settings(r.minor_id, '{"account_private": false}'::jsonb);
    elsif r.change_key = 'friend_requests_everyone' then
      perform public.apply_privacy_settings(r.minor_id, '{"friend_requests_from": "everyone"}'::jsonb);
    end if;
  end if;
  update public.guardian_approval_requests
  set status = case when coalesce(approve, false) then 'approved' else 'declined' end,
      decided_by = public.my_profile_id(), decided_at = timezone('utc', now())
  where id = r.id;
  perform public.log_supervision_event(r.minor_id, 'approval_decided',
    jsonb_build_object('change', case when r.change_key like 'fun_fact:%' then 'fun_fact' else r.change_key end, 'approved', coalesce(approve, false)));
  return public.guardian_view(r.minor_id);
end;
$$;

-- Unlinking the athlete (roster link changes) or an under-13 block clears every fact's text in the same transaction.
create or replace function public.quiz_facts_on_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare fid uuid; cause text; at timestamptz := clock_timestamp();
begin
  if new.age_blocked_at is not null and old.age_blocked_at is null then cause := 'age_blocked';
  elsif new.player_id is distinct from old.player_id then cause := 'unlinked';
  else return new; end if;
  for fid in select id from public.quiz_athlete_facts where athlete_id = new.id and status not in ('withdrawn','removed') order by id loop
    perform public.quiz_fact_clear(fid,cause,null,at);
  end loop;
  return new;
end $$;
drop trigger if exists quiz_facts_profile_rules on public.profiles;
create trigger quiz_facts_profile_rules after update of player_id,age_blocked_at on public.profiles for each row execute function public.quiz_facts_on_profile();
-- Account deletion removes the fact rows (cascade); their questions and unrevealed items are voided first.
create or replace function public.quiz_facts_on_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.quiz_fact_retire_question(old.question_id,'Removed: the athlete account was deleted.',clock_timestamp());
  return old;
end $$;
drop trigger if exists quiz_facts_delete on public.quiz_athlete_facts;
create trigger quiz_facts_delete before delete on public.quiz_athlete_facts for each row execute function public.quiz_facts_on_delete();
-- A block either way voids any issued, unrevealed fun fact between the two (the reveal and history re-check it too).
create or replace function public.quiz_facts_on_block()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; at timestamptz := clock_timestamp();
begin
  for r in select q.id qid,pair.viewer from public.quiz_athlete_facts f join public.sport_quiz_questions q on q.fact_id = f.id
      cross join (values (new.blocker_id,new.blocked_id),(new.blocked_id,new.blocker_id)) pair(athlete,viewer)
      where f.athlete_id = pair.athlete order by q.id loop
    perform public.quiz_fact_void_items(r.qid,r.viewer,'Fun fact no longer available',at);
  end loop;
  -- Saved receipts between the two keep no athlete card (first name / player id) of the other side.
  update public.sport_quiz_requests q set receipt = jsonb_set(q.receipt,'{result}',(q.receipt -> 'result') - 'fun_fact')
    from (values (new.blocker_id,new.blocked_id),(new.blocked_id,new.blocker_id)) pair(viewer,athlete) join public.profiles ap on ap.id = pair.athlete
    where q.profile_id = pair.viewer and jsonb_typeof(q.receipt -> 'result') = 'object'
      and q.receipt -> 'result' -> 'fun_fact' ->> 'athlete_player_id' = ap.player_id::text;
  return new;
end $$;
drop trigger if exists quiz_facts_block on public.user_blocks;
create trigger quiz_facts_block after insert on public.user_blocks for each row execute function public.quiz_facts_on_block();

-- 16. Admin: questions (approval shuffle, caps without fun facts, edit_replace for questions that need a look) ----------------
-- QUIZ-04's function with four changes: approval shuffles the stored option order (true / false kept); the trivia cap no
-- longer counts fun-fact questions; edit_replace also accepts an approved question that needs a look (Needs a look → Edit);
-- fun-fact questions are approved only through quiz_admin_fact_decide (archive / void stay available here).
create or replace function public.quiz_admin_question(p_id uuid,p_action text,p_payload jsonb,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); q public.sport_quiz_questions%rowtype; nextq public.sport_quiz_questions%rowtype;
  why text := btrim(p_payload ->> 'reason'); family uuid; at timestamptz; affected uuid; qtype text; opts jsonb; ritem record;
  life boolean; fam_life boolean; ch public.sport_quiz_life_chapters%rowtype; sport_text text; problems text[]; sh jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(p_action,'') not in ('create','edit','edit_replace','approve','archive','void','review_media') or char_length(coalesce(why,'')) not between 10 and 500
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('reason','sport','prompt','options','correct_option','explanation','topic_category','source_notes','family_action','question_key',
      'question_type','media_path','media_licence','media_source','media_attribution','media_alt_text','media_size_bytes','media_has_person','media_no_marks','media_exif_stripped',
      'chapter','min_age_band','education_only')) then raise exception 'quiz_question_action_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  if p_action = 'void' then
    for affected in select profile_id from public.sport_quiz_attempts where question_id = p_id
        union select a.profile_id from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where i.question_id = p_id order by 1 loop
      perform public.quiz_lock(affected);
    end loop;
  end if;
  if p_action <> 'create' then select * into q from public.sport_quiz_questions where id = p_id for update; if not found then raise exception 'quiz_question_missing'; end if;
  elsif p_id is not null then raise exception 'quiz_create_id_invalid'; end if;
  -- Fun-fact questions are decided only in the fact queue / Needs a look, where archive declines the fact and clears it
  -- (security review 2026-10-15: a bank archive or void left the fact live with its text).
  if q.topic_category = 'athlete' then raise exception 'quiz_fact_admin_path'; end if;
  if p_action = 'edit_replace' then
    if not (q.status = 'draft' or (q.status = 'approved' and public.quiz_needs_look(q.id))) then raise exception 'quiz_replace_draft_only'; end if;
    update public.sport_quiz_questions set status = 'archived',reason = why,reviewed_at = at,reviewed_by = me where id = q.id;
  end if;
  if p_action in ('create','edit','edit_replace') then
    if p_action = 'create' then
      if coalesce(p_payload ->> 'family_action','') not in ('new','existing') then raise exception 'quiz_family_required'; end if;
      if p_payload ->> 'family_action' = 'new' then
        if p_payload ? 'question_key' then raise exception 'quiz_family_invalid'; end if; family := gen_random_uuid();
      else
        if coalesce(p_payload ->> 'question_key','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'quiz_family_invalid'; end if;
        family := (p_payload ->> 'question_key')::uuid; if not exists(select 1 from public.sport_quiz_questions where question_key = family and topic_category <> 'athlete') then raise exception 'quiz_family_invalid'; end if;
      end if;
    else
      family := q.question_key;
      if (p_payload ? 'question_key' and p_payload ->> 'question_key' <> family::text) or (p_payload ? 'family_action' and p_payload ->> 'family_action' <> 'existing') then raise exception 'quiz_family_invalid'; end if;
    end if;
    life := coalesce(p_payload ->> 'topic_category','') = 'life';
    select bool_or(topic_category = 'life') into fam_life from public.sport_quiz_questions where question_key = family;
    if fam_life is not null and fam_life <> life then raise exception 'quiz_family_invalid'; end if;
    qtype := coalesce(p_payload ->> 'question_type','choice4'); opts := p_payload -> 'options';
    if qtype not in ('choice4','true_false','image_choice') or jsonb_typeof(opts) is distinct from 'array'
      or (qtype = 'choice4' and jsonb_array_length(opts) <> 4) or (qtype = 'true_false' and opts <> '["True","False"]'::jsonb)
      or (qtype = 'image_choice' and (life or jsonb_array_length(opts) not between 2 and 4)) then raise exception 'quiz_question_content_invalid'; end if;
    if coalesce(p_payload ->> 'topic_category','') not in ('sport','science','geography','general','life') or char_length(btrim(coalesce(p_payload ->> 'source_notes',''))) not between 10 and 1000
      or jsonb_typeof(p_payload -> 'correct_option') is distinct from 'number' or (p_payload ->> 'correct_option') !~ '^[0-3]$'
      or (p_payload ->> 'correct_option')::int >= jsonb_array_length(opts) then raise exception 'quiz_question_content_invalid'; end if;
    if exists(select 1 from unnest(case when life then array['prompt','explanation','source_notes'] else array['sport','prompt','explanation','source_notes'] end) k
      where jsonb_typeof(p_payload -> k) is distinct from 'string') then raise exception 'quiz_question_content_invalid'; end if;
    if life then
      select * into ch from public.sport_quiz_life_chapters where id = p_payload ->> 'chapter';
      if ch.id is null or coalesce(p_payload ->> 'min_age_band','13') <> '13' or jsonb_typeof(p_payload -> 'education_only') is distinct from 'boolean'
        then raise exception 'quiz_life_fields_invalid'; end if;
      sport_text := ch.title;
    else
      if exists(select 1 from unnest(array['chapter','min_age_band','education_only']) k where p_payload ? k) then raise exception 'quiz_life_fields_invalid'; end if;
      sport_text := btrim(p_payload ->> 'sport');
    end if;
    if qtype = 'image_choice' then
      if exists(select 1 from unnest(array['media_path','media_licence','media_source','media_attribution','media_alt_text']) k where jsonb_typeof(p_payload -> k) is distinct from 'string')
        or jsonb_typeof(p_payload -> 'media_size_bytes') is distinct from 'number' or (p_payload ->> 'media_size_bytes') !~ '^[0-9]{1,6}$'
        or (p_payload ->> 'media_size_bytes')::int not between 1 and 307200 or p_payload -> 'media_has_person' is distinct from 'false'::jsonb
        or p_payload -> 'media_no_marks' is distinct from 'true'::jsonb or p_payload -> 'media_exif_stripped' is distinct from 'true'::jsonb then raise exception 'quiz_media_invalid'; end if;
    elsif exists(select 1 from jsonb_object_keys(p_payload) k where k like 'media\_%') then raise exception 'quiz_media_invalid'; end if;
    update public.sport_quiz_questions set status = 'archived',reason = why where question_key = family and status = 'approved';
    -- Separate caps: trivia 300 and Life 200 (draft + approved); fun-fact questions count toward neither.
    if life and (select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'life') >= 200 then raise exception 'quiz_life_bank_full'; end if;
    if not life and (select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category not in ('life','athlete')) >= 300 then raise exception 'quiz_bank_full'; end if;
    insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,created_by,topic_category,source_notes,
        question_type,media_path,media_licence,media_source,media_attribution,media_alt_text,media_size_bytes,media_has_person,media_no_marks,media_exif_stripped,
        chapter,min_age_band,education_only)
      values(family,coalesce((select max(version) + 1 from public.sport_quiz_questions where question_key = family),1),
        sport_text,btrim(p_payload ->> 'prompt'),opts,(p_payload ->> 'correct_option')::integer,btrim(p_payload ->> 'explanation'),why,me,
        p_payload ->> 'topic_category',btrim(p_payload ->> 'source_notes'),qtype,
        case when qtype = 'image_choice' then btrim(p_payload ->> 'media_path') end,case when qtype = 'image_choice' then p_payload ->> 'media_licence' end,
        case when qtype = 'image_choice' then btrim(p_payload ->> 'media_source') end,case when qtype = 'image_choice' then btrim(p_payload ->> 'media_attribution') end,
        case when qtype = 'image_choice' then btrim(p_payload ->> 'media_alt_text') end,case when qtype = 'image_choice' then (p_payload ->> 'media_size_bytes')::int end,
        case when qtype = 'image_choice' then false end,case when qtype = 'image_choice' then true end,case when qtype = 'image_choice' then true end,
        case when life then ch.id end,case when life then '13' end,coalesce(life and (p_payload ->> 'education_only')::boolean,false)) returning * into nextq;
    if p_action = 'edit_replace' and life then
      if nextq.education_only is not true then raise exception 'quiz_life_attestation_required'; end if;
      problems := public.quiz_life_copy_problems(nextq.prompt,nextq.options,nextq.explanation,nextq.chapter);
      if cardinality(problems) > 0 then raise exception 'quiz_life_copy: %', array_to_string(problems,', '); end if;
    end if;
  elsif p_action = 'review_media' then
    if q.question_type <> 'image_choice' or q.status <> 'draft' then raise exception 'quiz_media_review_invalid'; end if;
    if q.created_by is not distinct from me then raise exception 'quiz_media_reviewer_is_creator'; end if;
    update public.sport_quiz_questions set media_reviewed_by = me,media_reviewed_at = at where id = q.id returning * into nextq;
  else
    if q.status = 'void' then raise exception 'quiz_void_final'; end if;
    if p_action = 'approve' and q.status <> 'draft' then raise exception 'quiz_approve_draft_only'; end if;
    if p_action = 'approve' and q.question_type = 'image_choice' and not (select images_enabled from public.sport_quiz_settings where singleton) then raise exception 'quiz_images_off'; end if;
    if p_action = 'approve' and q.question_type = 'image_choice' and (q.media_reviewed_by is null or q.media_reviewed_by is not distinct from q.created_by) then raise exception 'quiz_media_review_required'; end if;
    if p_action = 'approve' then update public.sport_quiz_questions set status = 'archived',reason = why where question_key = q.question_key and status = 'approved'; end if;
    -- Approval shuffle: the published order never keeps the author's "correct answer first" habit.
    sh := case when p_action = 'approve' then public.quiz_shuffle_options(q.options,q.correct_option,q.question_type) end;
    update public.sport_quiz_questions set status = case p_action when 'approve' then 'approved' when 'archive' then 'archived' else 'void' end,
      options = coalesce(sh -> 'options',options),correct_option = coalesce((sh ->> 'correct_option')::integer,correct_option),
      reason = why,reviewed_at = at,reviewed_by = me where id = q.id returning * into nextq;
    if p_action = 'void' then
      for affected in with changed as (update public.sport_quiz_attempts set status = 'void',voided_at = at,closed_at = coalesce(closed_at,at),correction_reason = why,session_hash = null
          where question_id = q.id and status <> 'skipped' returning profile_id) select distinct profile_id from changed order by profile_id loop perform public.quiz_bump_history(affected); end loop;
      update public.sport_quiz_badges set voided_at = at where attempt_id in (select id from public.sport_quiz_attempts where question_id = q.id) and voided_at is null;
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
  if p_action = 'edit_replace' then
    insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'question_edit',nextq.id,why,at),(me,'question_archive',q.id,why,at);
    return jsonb_build_object('id',nextq.id,'question_key',nextq.question_key,'version',nextq.version,'status',nextq.status,'replaced_id',q.id,'replaced_status','archived');
  end if;
  insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'question_' || p_action,nextq.id,why,at);
  return jsonb_build_object('id',nextq.id,'question_key',nextq.question_key,'version',nextq.version,'status',nextq.status);
end $$;

-- 17. Admin: the fun-fact queue and decisions ---------------------------------------------------------------------------------
-- Newest first (200). Admins see the text to decide; withdrawn and removed facts show without text.
create or replace function public.quiz_admin_fact_queue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor();
begin
  return jsonb_build_object('contract_version',5,'generated_at',statement_timestamp(),
    'counts',(select jsonb_build_object('waiting_guardian',count(*) filter (where status = 'waiting_guardian'),'guardian_review',count(*) filter (where status = 'guardian_review'),
      'admin_review',count(*) filter (where status = 'admin_review'),'approved',count(*) filter (where status = 'approved'),'declined',count(*) filter (where status = 'declined'),
      'withdrawn',count(*) filter (where status = 'withdrawn'),'removed',count(*) filter (where status = 'removed')) from public.quiz_athlete_facts),
    'facts',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'athlete_profile_id',f.athlete_id,'first_name',public.first_name_of(f.athlete_id),
        'age_band',public.profile_age_band(f.athlete_id),'verified',p.verification_status = 'verified','prompt_key',f.prompt_key,
        'label',public.quiz_fact_prompt(f.prompt_key) ->> 'label','answer_text',f.answer_text,'status',f.status,
        'guardian_status',case when public.profile_age_band(f.athlete_id) <> 'teen_13_15' and f.guardian_decision is null then 'not_needed'
          when f.guardian_decision is not null then f.guardian_decision when f.status = 'waiting_guardian' then 'no_guardian_yet'
          when public.quiz_fact_request_open(f.guardian_request_id) then 'pending' else 'lapsed' end,
        'look_reasons',to_jsonb(f.look_reasons),'submitted_at',f.submitted_at,'admin_decided_at',f.admin_decided_at,'decline_reason',f.decline_reason,
        'cleared_at',f.cleared_at,'question_id',f.question_id,'paused',public.quiz_question_paused(f.question_id)) order by f.submitted_at desc)
      from (select * from public.quiz_athlete_facts order by submitted_at desc limit 200) f join public.profiles p on p.id = f.athlete_id),'[]'::jsonb));
end $$;
-- Approve (one admin, with the checklist: no sponsor or business, no place, no schedule) or decline with a reason code.
-- Approval re-runs the server text check, needs the guardian's approval for 13–15, and builds the question from the
-- prompt template, three curated wrong options that are not near the answer and {answer}, shuffled.
create or replace function public.quiz_admin_fact_decide(p_fact_id uuid,p_action text,p_payload jsonb,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); f public.quiz_athlete_facts%rowtype; at timestamptz; why text := btrim(p_payload ->> 'reason');
  pr jsonb; wrong text[]; sh jsonb; qid uuid; band text; problems text[]; code text := p_payload ->> 'decline_reason';
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(p_action,'') not in ('approve','decline') or char_length(coalesce(why,'')) not between 10 and 500
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('reason','decline_reason','checklist')) then raise exception 'quiz_fact_action_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; at := clock_timestamp();
  select * into f from public.quiz_athlete_facts where id = p_fact_id for update;
  if f.id is null then raise exception 'quiz_fact_missing'; end if;
  if f.status = 'guardian_review' or f.status = 'waiting_guardian' then raise exception 'quiz_fact_guardian_first'; end if;
  if f.status <> 'admin_review' then raise exception 'quiz_fact_already_decided'; end if;
  if p_action = 'decline' then
    if coalesce(code,'') not in ('not_okay','private','sponsor_or_business','place','schedule','other') then raise exception 'quiz_fact_action_invalid'; end if;
    update public.quiz_athlete_facts set status = 'declined',decline_reason = code,admin_decided_at = at,admin_decided_by = me,updated_at = at where id = f.id;
    insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'fact_decline',code || ': ' || why,at);
    return jsonb_build_object('contract_version',5,'fact_id',f.id,'status','declined','question_id',null);
  end if;
  if p_payload -> 'checklist' is distinct from '{"no_sponsor_or_business":true,"no_place":true,"no_schedule":true}'::jsonb then raise exception 'quiz_fact_checklist_required'; end if;
  band := public.profile_age_band(f.athlete_id);
  if band not in ('adult','teen_16_17','teen_13_15') then raise exception 'quiz_fact_age_needed'; end if;
  if band = 'teen_13_15' and f.guardian_decision is distinct from 'approved' then raise exception 'quiz_fact_guardian_first'; end if;
  problems := public.quiz_fact_text_problems(f.answer_text,f.prompt_key,f.athlete_id);
  if cardinality(problems) > 0 then raise exception 'quiz_fact_text: %', array_to_string(problems,', '); end if;
  pr := public.quiz_fact_prompt(f.prompt_key);
  wrong := array(select x from jsonb_array_elements_text(pr -> 'wrong') x where not public.quiz_near_match(x,f.answer_text) order by random() limit 3);
  if cardinality(wrong) < 3 then raise exception 'quiz_fact_options_short'; end if;
  sh := public.quiz_shuffle_options(to_jsonb(wrong) || '["{answer}"]'::jsonb,3,'choice4');
  insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,created_by,topic_category,source_notes,
      question_type,status,reviewed_at,reviewed_by,fact_id)
    values(gen_random_uuid(),1,'Fun fact',pr ->> 'question',sh -> 'options',(sh ->> 'correct_option')::integer,'Shared by {name} as a fun fact.',why,f.athlete_id,'athlete',
      'Shared by the athlete; a guardian (under 16) and one admin approved it.','choice4','approved',at,me,f.id) returning id into qid;
  update public.quiz_athlete_facts set status = 'approved',question_id = qid,admin_decided_at = at,admin_decided_by = me,updated_at = at where id = f.id;
  insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'fact_approve',qid,why,at);
  return jsonb_build_object('contract_version',5,'fact_id',f.id,'status','approved','question_id',qid);
end $$;

-- 18. Admin: Needs a look -------------------------------------------------------------------------------------------------------
-- Auto-paused, queued (daily cap), flagged and reported questions with their reasons. Aggregates only: responders and
-- percentages appear from min_responders; report counts by reason since the last review; never a reporter.
create or replace function public.quiz_admin_needs_look()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); minr integer := coalesce((select (s.self_heal ->> 'min_responders')::integer from public.sport_quiz_settings s where s.singleton),30);
  today timestamptz := date_trunc('day',statement_timestamp() at time zone 'UTC') at time zone 'UTC'; rows jsonb;
begin
  select coalesce(jsonb_agg(x.j order by x.paused desc,x.at desc),'[]'::jsonb) into rows from (
    select st.paused_at is not null paused,coalesce(st.paused_at,st.queued_at,st.updated_at) at,jsonb_build_object(
      'question_id',q.id,'question_key',q.question_key,'version',q.version,'topic_category',q.topic_category,'sport',q.sport,'chapter',q.chapter,
      'question_type',q.question_type,'status',q.status,'is_fact',q.topic_category = 'athlete','fact_id',q.fact_id,
      'prompt',case when q.topic_category = 'athlete' then replace(q.prompt,'{name}',coalesce(public.first_name_of(f.athlete_id),'this athlete')) else q.prompt end,
      'options',case when q.topic_category = 'athlete' then (select jsonb_agg(case when o = '{answer}' then to_jsonb(coalesce(f.answer_text,'Removed')) else to_jsonb(o) end order by n)
        from jsonb_array_elements_text(q.options) with ordinality t(o,n)) else q.options end,
      'correct_option',q.correct_option,'explanation',q.explanation,'source_notes',q.source_notes,'education_only',q.education_only,'paused_at',st.paused_at,'pause_reason',st.pause_reason,'queued_at',st.queued_at,'restored_at',st.restored_at,
      'flags',to_jsonb(array(select unnest(st.flags) except select unnest(st.dismissed_flags))),'difficulty',st.difficulty,
      'responders',case when st.responders >= minr then st.responders end,
      'right_pct',case when st.responders >= minr then round(st.right_count * 100.0 / st.responders) end,
      'timeout_pct',case when st.responders >= minr then round(st.timeouts * 100.0 / st.responders) end,
      'reports',(select jsonb_build_object('open',count(*),'counted',count(*) filter (where r.counted),'not_counted',count(*) filter (where not r.counted),
          'wrong_answer',count(*) filter (where r.reason = 'wrong_answer'),'confusing',count(*) filter (where r.reason = 'confusing'),
          'not_okay',count(*) filter (where r.reason = 'not_okay'),'private',count(*) filter (where r.reason = 'private'))
        from public.sport_quiz_reports r where r.question_id = q.id and r.created_at > coalesce(st.reviewed_at,'-infinity'::timestamptz))) j
    from public.sport_quiz_question_stats st join public.sport_quiz_questions q on q.id = st.question_id left join public.quiz_athlete_facts f on f.id = q.fact_id
    where q.status in ('draft','approved') and public.quiz_needs_look(q.id) limit 200) x;
  return jsonb_build_object('contract_version',5,'generated_at',statement_timestamp(),'min_responders',minr,'count',jsonb_array_length(rows),'questions',rows,
    'alerts',coalesce((select jsonb_agg(distinct u.reason) from public.sport_quiz_audit u where u.action = 'report_alert' and u.created_at >= today),'[]'::jsonb));
end $$;
-- Restore (un-pause; it then needs 3 new counted reporters to pause again), Dismiss (keep as is; clears current flags and
-- open reports from the list) or Archive (an ordinary question is archived; a fun fact is declined and its question voided).
create or replace function public.quiz_admin_needs_look_action(p_question_id uuid,p_action text,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); q public.sport_quiz_questions%rowtype; st public.sport_quiz_question_stats%rowtype; at timestamptz; why text := btrim(p_reason);
begin
  if p_question_id is null or coalesce(p_action,'') not in ('restore','dismiss','archive') or char_length(coalesce(why,'')) not between 10 and 500 then raise exception 'quiz_look_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; at := clock_timestamp();
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz-question:' || p_question_id,0));
  select * into q from public.sport_quiz_questions where id = p_question_id for update;
  if q.id is null then raise exception 'quiz_question_missing'; end if;
  insert into public.sport_quiz_question_stats(question_id,updated_at) values(q.id,at) on conflict (question_id) do nothing;
  select * into st from public.sport_quiz_question_stats where question_id = q.id for update;
  if p_action = 'restore' then
    if st.paused_at is null then raise exception 'quiz_look_not_paused'; end if;
    update public.sport_quiz_question_stats set paused_at = null,pause_reason = null,queued_at = null,restored_at = at,restored_by = me,reviewed_at = at,
      dismissed_flags = flags,updated_at = at where question_id = q.id;
    insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'question_restore',q.id,why,at);
  elsif p_action = 'dismiss' then
    if st.paused_at is not null then raise exception 'quiz_look_paused'; end if;
    update public.sport_quiz_question_stats set queued_at = null,reviewed_at = at,dismissed_flags = flags,updated_at = at where question_id = q.id;
    insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'question_dismiss',q.id,why,at);
  elsif q.topic_category = 'athlete' then
    update public.quiz_athlete_facts set status = 'declined',decline_reason = 'other',admin_decided_at = at,admin_decided_by = me,updated_at = at
      where id = q.fact_id and status = 'approved';
    perform public.quiz_fact_retire_question(q.id,why,at);
    update public.sport_quiz_question_stats set queued_at = null,reviewed_at = at,updated_at = at where question_id = q.id;
    insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'fact_decline',q.id,'other: ' || why,at);
  else
    if q.status not in ('draft','approved') then raise exception 'quiz_look_invalid'; end if;
    update public.sport_quiz_questions set status = 'archived',reason = why,reviewed_at = at,reviewed_by = me where id = q.id;
    update public.sport_quiz_question_stats set queued_at = null,reviewed_at = at,updated_at = at where question_id = q.id;
    insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'question_archive',q.id,why,at);
  end if;
  return jsonb_build_object('contract_version',5,'question_id',q.id,'action',p_action,'needs_look',public.quiz_needs_look(q.id),
    'status',(select status from public.sport_quiz_questions where id = q.id));
end $$;

-- 19. Admin: fresh-question settings (trivia.athlete_questions, share 0–10%, report intake, self-heal thresholds) -------------
create or replace function public.quiz_admin_fresh_settings(p_payload jsonb,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; s public.sport_quiz_settings%rowtype;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('athlete_questions_enabled','athlete_share_pct','reports_paused','self_heal'))
    or jsonb_typeof(p_payload -> 'athlete_questions_enabled') is distinct from 'boolean' or jsonb_typeof(p_payload -> 'reports_paused') is distinct from 'boolean'
    or jsonb_typeof(p_payload -> 'athlete_share_pct') is distinct from 'number' or (p_payload ->> 'athlete_share_pct') !~ '^([0-9]|10)$'
    or not public.quiz_self_heal_ok(p_payload -> 'self_heal') then raise exception 'quiz_settings_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  update public.sport_quiz_settings set athlete_questions_enabled = (p_payload ->> 'athlete_questions_enabled')::boolean,athlete_share_pct = (p_payload ->> 'athlete_share_pct')::smallint,
    reports_paused = (p_payload ->> 'reports_paused')::boolean,self_heal = p_payload -> 'self_heal',reason = btrim(p_reason),updated_at = at,updated_by = me where singleton returning * into s;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'fresh_settings',btrim(p_reason),at);
  return jsonb_build_object('contract_version',5,'athlete_questions_enabled',s.athlete_questions_enabled,'athlete_share_pct',s.athlete_share_pct,
    'reports_paused',s.reports_paused,'self_heal',s.self_heal,'report_rules',public.quiz_report_rules());
end $$;

-- 20. Admin: bulk import (§6.11) ----------------------------------------------------------------------------------------------
-- At most 200 rows and 64 KB. Every row runs the create checks (and the Life copy rules for Life rows) on the server.
-- Refused: athlete or image rows, unknown columns, cells starting with = + - @, an exact duplicate after cleanup of any
-- stored question (all statuses, versions, families and topics) or of an earlier row, and rows past the version caps.
-- Warned: a near duplicate (80%+ shared words). A dry run writes nothing; a real import lands the passing rows as drafts
-- with the option order shuffled. There is no approve-all.
create or replace function public.quiz_admin_import(p_rows jsonb,p_dry_run boolean,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; why text := btrim(p_reason); v jsonb; i integer; probs text[]; warns jsonb;
  out jsonb := '[]'; norms text[] := '{}'; prompts text[] := '{}'; existing text[]; n text; topic text; qtype text; opts jsonb; life boolean; ch text;
  trivia_left integer; life_left integer; ready integer := 0; refused integer := 0; warned integer := 0; sh jsonb; nid uuid; near uuid; j integer; sport_text text;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or p_dry_run is null or char_length(coalesce(why,'')) not between 10 and 500 then raise exception 'quiz_import_invalid'; end if;
  if jsonb_array_length(p_rows) not between 1 and 200 or octet_length(p_rows::text) > 65536 then raise exception 'quiz_import_too_large'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  trivia_left := 300 - (select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category not in ('life','athlete'));
  life_left := 200 - (select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'life');
  select coalesce(array_agg(public.quiz_fresh_norm(prompt)),'{}') into existing from public.sport_quiz_questions;
  for i in 0..jsonb_array_length(p_rows) - 1 loop
    v := p_rows -> i; probs := '{}'; warns := '[]'; n := null; nid := null; near := null;
    if jsonb_typeof(v) is distinct from 'object' then probs := array['row_invalid'];
    else
      if exists(select 1 from jsonb_object_keys(v) k where k not in ('topic_category','sport','chapter','question_type','prompt','options','correct_option','explanation','source_notes')) then probs := probs || 'unknown_column'::text; end if;
      -- Formula-start cells after any leading whitespace (tabs, returns, wide spaces) and full-width forms (NFKC).
      if exists(select 1 from jsonb_each(v) e where (jsonb_typeof(e.value) = 'string' and normalize(e.value #>> '{}',nfkc) ~ '^[[:space:]﻿​]*[=+@-]')
          or (jsonb_typeof(e.value) = 'array' and exists(select 1 from jsonb_array_elements(e.value) o where jsonb_typeof(o) = 'string' and normalize(o #>> '{}',nfkc) ~ '^[[:space:]﻿​]*[=+@-]'))) then
        probs := probs || 'formula_cell'::text; end if;
      -- Plain and accented Latin letters only (lookalike letters from other scripts could dodge the duplicate check).
      if exists(select 1 from jsonb_each(v) e cross join lateral (select case jsonb_typeof(e.value) when 'string' then e.value #>> '{}'
            when 'array' then (select string_agg(o,' ') from jsonb_array_elements_text(e.value) o) end txt) z
          where z.txt ~ '[^[:space:] -~À-ÖØ-öø-ſ‘’“”—–…·×āēīōū]') then probs := probs || 'non_latin_text'::text; end if;
      topic := v ->> 'topic_category'; qtype := coalesce(v ->> 'question_type','choice4'); life := topic = 'life';
      if topic = 'athlete' then probs := probs || 'athlete_row'::text;
      elsif coalesce(topic,'') not in ('sport','science','geography','general','life') then probs := probs || 'topic_invalid'::text; end if;
      if qtype = 'image_choice' then probs := probs || 'image_row'::text;
      elsif qtype not in ('choice4','true_false') then probs := probs || 'type_invalid'::text; end if;
      opts := case when qtype = 'true_false' and v -> 'options' is null then '["True","False"]'::jsonb else v -> 'options' end;
      if jsonb_typeof(v -> 'prompt') is distinct from 'string' or char_length(btrim(v ->> 'prompt')) not between 10 and 280 then probs := probs || 'prompt_length'::text; end if;
      if jsonb_typeof(v -> 'explanation') is distinct from 'string' or char_length(btrim(v ->> 'explanation')) not between 10 and 500 then probs := probs || 'explanation_length'::text; end if;
      if jsonb_typeof(v -> 'source_notes') is distinct from 'string' or char_length(btrim(v ->> 'source_notes')) not between 10 and 1000 then probs := probs || 'source_length'::text; end if;
      if public.quiz_normalize_options(opts) is null or (qtype = 'choice4' and jsonb_array_length(opts) <> 4) or (qtype = 'true_false' and opts <> '["True","False"]'::jsonb) then probs := probs || 'options_invalid'::text; end if;
      if jsonb_typeof(v -> 'correct_option') is distinct from 'number' or (v ->> 'correct_option') !~ '^[0-3]$'
         or (jsonb_typeof(opts) = 'array' and (v ->> 'correct_option')::integer >= jsonb_array_length(opts)) then probs := probs || 'correct_invalid'::text; end if;
      if life then
        ch := v ->> 'chapter';
        if not exists(select 1 from public.sport_quiz_life_chapters where id = ch) then probs := probs || 'chapter_invalid'::text; end if;
        if v ? 'sport' then probs := probs || 'sport_not_for_life'::text; end if;
        if cardinality(probs) = 0 then
          probs := probs || array(select 'life_copy:' || x from unnest(public.quiz_life_copy_problems(v ->> 'prompt',opts,v ->> 'explanation',ch)) x);
        end if;
      elsif topic is not null then
        if v ? 'chapter' then probs := probs || 'chapter_not_for_trivia'::text; end if;
        sport_text := case topic when 'science' then coalesce(nullif(btrim(v ->> 'sport'),''),'Science') when 'geography' then coalesce(nullif(btrim(v ->> 'sport'),''),'Geography')
          when 'general' then coalesce(nullif(btrim(v ->> 'sport'),''),'General') else btrim(coalesce(v ->> 'sport','')) end;
        if char_length(sport_text) not between 2 and 80 then probs := probs || 'sport_invalid'::text; end if;
      end if;
      if jsonb_typeof(v -> 'prompt') = 'string' then
        n := public.quiz_fresh_norm(v ->> 'prompt');
        if n = any(existing) then probs := probs || 'duplicate'::text; end if;
        if n = any(norms) then probs := probs || 'duplicate_in_batch'::text; end if;
        select q.id into near from public.sport_quiz_questions q where public.quiz_fresh_norm(q.prompt) <> n and public.quiz_word_overlap(q.prompt,v ->> 'prompt') >= 0.8 limit 1;
        if near is not null then warns := warns || jsonb_build_array(jsonb_build_object('code','near_duplicate','question_id',near)); end if;
        for j in 1..coalesce(array_length(prompts,1),0) loop
          if norms[j] <> n and public.quiz_word_overlap(prompts[j],v ->> 'prompt') >= 0.8 then
            warns := warns || jsonb_build_array(jsonb_build_object('code','near_duplicate_in_batch','row',j - 1)); exit; end if;
        end loop;
      end if;
      if cardinality(probs) = 0 then
        if life then if life_left <= 0 then probs := probs || 'bank_full'::text; else life_left := life_left - 1; end if;
        else if trivia_left <= 0 then probs := probs || 'bank_full'::text; else trivia_left := trivia_left - 1; end if; end if;
      end if;
    end if;
    norms := norms || coalesce(n,''); prompts := prompts || coalesce(v ->> 'prompt','');
    if cardinality(probs) = 0 then
      ready := ready + 1;
      if not p_dry_run then
        sh := public.quiz_shuffle_options(opts,(v ->> 'correct_option')::integer,qtype);
        insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,created_by,topic_category,source_notes,
            question_type,chapter,min_age_band,education_only)
          values(gen_random_uuid(),1,case when life then (select title from public.sport_quiz_life_chapters where id = ch) else sport_text end,btrim(v ->> 'prompt'),sh -> 'options',
            (sh ->> 'correct_option')::integer,btrim(v ->> 'explanation'),left('Bulk import: ' || why,500),me,topic,btrim(v ->> 'source_notes'),qtype,
            case when life then ch end,case when life then '13' end,false) returning id into nid;
        insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'question_create',nid,left('Bulk import: ' || why,500),at);
      end if;
    else refused := refused + 1; end if;
    if jsonb_array_length(warns) > 0 then warned := warned + 1; end if;
    out := out || jsonb_build_array(jsonb_build_object('index',i,'status',case when cardinality(probs) > 0 then 'refused' when p_dry_run then 'ready' else 'imported' end,
      'problems',to_jsonb(probs),'warnings',warns,'id',nid));
  end loop;
  if not p_dry_run then
    insert into public.sport_quiz_imports(actor_id,reason,rows_total,rows_imported,rows_refused,rows_warned,created_at) values(me,why,jsonb_array_length(p_rows),ready,refused,warned,at);
    insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'question_import',ready || ' drafts imported, ' || refused || ' refused: ' || left(why,400),at);
  end if;
  return jsonb_build_object('contract_version',5,'dry_run',p_dry_run,'rows_total',jsonb_array_length(p_rows),'rows_ready',ready,'rows_refused',refused,'rows_warned',warned,
    'trivia_left',trivia_left,'life_left',life_left,'rows',out);
end $$;

-- 21. Admin snapshot: weeks left / Refill needed, the Needs a look count and the fresh-question settings -----------------------
-- Weeks left per topic, sport and Life chapter: approved, drawable families minus what the most-exposed recent player
-- has seen, at the last 28 days' pace; without recent play the pace is one full round per week ("assumed"). Under 4
-- weeks reads Refill needed. Content counts and exposure pace only; no account is named.
create or replace function public.quiz_admin_refill(p_at timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with size as (select coalesce((select round_size from public.sport_quiz_settings where singleton),5) n),
  keys as (select 'topic' scope,t key from unnest(array['sport','science','geography','general']) t
    union select 'sport',q.sport from public.sport_quiz_questions q where q.topic_category = 'sport' and q.status in ('draft','approved')
    union select 'chapter',c.id from public.sport_quiz_life_chapters c),
  dims as (select q.id,q.question_key,x.scope,x.key,q.status,q.question_type,q.options,q.source_notes from public.sport_quiz_questions q
    cross join lateral (values ('topic',case when q.topic_category in ('sport','science','geography','general') then q.topic_category end),
      ('sport',case when q.topic_category = 'sport' then q.sport end),('chapter',q.chapter)) x(scope,key) where x.key is not null),
  bank as (select scope,key,count(*) n from dims where status = 'approved' and question_type <> 'image_choice' and public.quiz_normalize_options(options) is not null
    and char_length(btrim(source_notes)) >= 10 and not public.quiz_question_paused(id) group by 1,2),
  recent as (select d.scope,d.key,e.profile_id,public.quiz_week_at(e.first_issued_at) wk from public.sport_quiz_exposures e join dims d on d.id = e.question_id
    where e.first_issued_at > p_at - interval '28 days'),
  pace as (select scope,key,count(*) issued,count(distinct (profile_id,wk)) pw from recent group by 1,2),
  seen as (select d.scope,d.key,e.profile_id,count(*) n from public.sport_quiz_exposures e join dims d on d.id = e.question_id
    where e.profile_id in (select profile_id from recent) group by 1,2,3),
  maxseen as (select scope,key,max(n) m from seen group by 1,2),
  calc as (select k.scope,k.key,coalesce(b.n,0) approved,coalesce(p.issued,0) issued,coalesce(p.pw,0) pw,coalesce(m.m,0) max_seen,
      case when coalesce(p.pw,0) > 0 then greatest(floor((coalesce(b.n,0) - coalesce(m.m,0)) / (p.issued::numeric / p.pw)),0)::integer
        else floor(coalesce(b.n,0)::numeric / (select n from size))::integer end weeks_left
    from keys k left join bank b using (scope,key) left join pace p using (scope,key) left join maxseen m using (scope,key))
  select coalesce(jsonb_agg(jsonb_build_object('scope',scope,'key',key,'approved',approved,'pace_per_player_week',case when pw > 0 then round(issued::numeric / pw,2) else 0 end,
    'pace_source',case when pw > 0 then 'measured' else 'assumed' end,'max_seen',max_seen,'weeks_left',weeks_left,'refill_needed',weeks_left < 4)
    order by scope,key),'[]'::jsonb) from calc
$$;
create or replace function public.quiz_admin_snapshot(p_question_cursor text default null,p_audit_before bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); at timestamptz := statement_timestamp(); w date := public.quiz_week_at(at);
  c jsonb := public.quiz_cursor(p_question_cursor,'questions'); bank jsonb; audit jsonb; nextq text; nexta text; last_id uuid; last_at timestamptz; wk jsonb;
  hidden text[] := array['fact_submit','fact_withdraw','fact_guardian','fact_clear'];
begin
  if p_audit_before is not null and p_audit_before <= 0 then raise exception 'quiz_cursor_invalid'; end if;
  -- Fun-fact questions live in the fact queue, not the bank pages (they hold {answer} and belong to an athlete).
  select coalesce(jsonb_agg(to_jsonb(q) - 'media_reviewed_by' - 'fact_id' || jsonb_build_object('media_reviewed_by',q.media_reviewed_by) order by created_at desc,id desc),'[]') into bank from
    (select * from public.sport_quiz_questions where topic_category <> 'athlete' and (c is null or (created_at,id) < ((c ->> 'at')::timestamptz,(c ->> 'id')::uuid)) order by created_at desc,id desc limit 50) q;
  if jsonb_array_length(bank) = 50 then
    last_at := (bank -> 49 ->> 'created_at')::timestamptz; last_id := (bank -> 49 ->> 'id')::uuid;
    if exists(select 1 from public.sport_quiz_questions where topic_category <> 'athlete' and (created_at,id) < (last_at,last_id)) then nextq := jsonb_build_object('v',1,'stream','questions','at',last_at,'id',last_id)::text; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id::text,'action',x.action,
    'actor_id',case when x.action in ('settings','retention','life_settings','life_chapter','fresh_settings','fact_approve','fact_decline','question_restore','question_dismiss','question_import')
      or x.action like 'question_%' then x.actor_id else null end,
    'question_id',case when x.action like 'question_%' or x.action in ('fact_approve','fact_decline') then x.question_id else null end,'reason',x.reason,'created_at',x.created_at) order by x.id desc),'[]') into audit
    from (select * from public.sport_quiz_audit u where (p_audit_before is null or u.id < p_audit_before) and not public.quiz_audit_is_life(u.id) and u.action <> all(hidden) order by u.id desc limit 50) x;
  if jsonb_array_length(audit) = 50 and exists(select 1 from public.sport_quiz_audit u where u.id < (audit -> 49 ->> 'id')::bigint and not public.quiz_audit_is_life(u.id) and u.action <> all(hidden)) then nexta := audit -> 49 ->> 'id'; end if;
  select jsonb_build_object(
    'week_issued',count(*) filter (where s ->> 'status' = 'issued'),'week_completed',count(*) filter (where s ->> 'status' = 'completed'),
    'week_skipped',count(*) filter (where s ->> 'status' = 'skipped'),'week_void',count(*) filter (where s ->> 'status' = 'void'),
    'week_ended',count(*) filter (where s ->> 'status' = 'ended'),'week_expired',count(*) filter (where s ->> 'status' = 'expired'),
    'week_rounds_short',count(*) filter (where (s ->> 'short_round')::boolean),'week_rounds_group',count(*) filter (where s ->> 'round_kind' = 'group'),
    'week_rounds_personal',count(*) filter (where s ->> 'round_kind' = 'personal' and s ->> 'status' <> 'skipped'))
    into wk from (select public.quiz_summary(a.id,at) s from public.sport_quiz_attempts a where a.week_start = w and a.round_kind <> 'life') x;
  return jsonb_build_object('contract_version',2,'generated_at',at,'week_start',w,'week_end',w + 7,
    'settings',(select (to_jsonb(s) - 'singleton' - 'fact_salt') || jsonb_build_object('contract_version',2) from public.sport_quiz_settings s where singleton),
    'questions',bank,'question_total',(select count(*) from public.sport_quiz_questions where topic_category <> 'athlete'),
    'active_total',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category not in ('life','athlete')),
    'life_active_total',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'life'),'life_cap',200,
    'question_cap',300,'next_question_cursor',nextq,'audit',audit,'next_before',nexta,
    'pools',(select coalesce(jsonb_agg(to_jsonb(x) order by topic_category,sport),'[]') from (select topic_category,sport,count(*) approved_count from public.sport_quiz_questions q
      where status = 'approved' and topic_category not in ('life','athlete') and question_type <> 'image_choice' and public.quiz_normalize_options(options) is not null
        and char_length(btrim(source_notes)) >= 10 and not public.quiz_question_paused(q.id) group by topic_category,sport) x),
    'forecast',public.quiz_admin_forecast(at),
    'refill',public.quiz_admin_refill(at),
    'fresh',(select jsonb_build_object('athlete_questions_enabled',s.athlete_questions_enabled,'athlete_share_pct',s.athlete_share_pct,'reports_paused',s.reports_paused,
        'self_heal',s.self_heal,'report_rules',public.quiz_report_rules(),
        'needs_look_count',(select count(*) from public.sport_quiz_question_stats st join public.sport_quiz_questions q on q.id = st.question_id
          where q.status in ('draft','approved') and public.quiz_needs_look(q.id)),
        'paused_count',(select count(*) from public.sport_quiz_question_stats st join public.sport_quiz_questions q on q.id = st.question_id where q.status in ('draft','approved') and st.paused_at is not null),
        'facts_admin_review',(select count(*) from public.quiz_athlete_facts where status = 'admin_review'),
        'facts_guardian_review',(select count(*) from public.quiz_athlete_facts where status = 'guardian_review'),
        'facts_live',(select count(*) from public.quiz_athlete_facts where status = 'approved'),
        'imports_30d',(select count(*) from public.sport_quiz_imports where created_at > at - interval '30 days'),
        'alerts',coalesce((select jsonb_agg(distinct u.reason) from public.sport_quiz_audit u where u.action = 'report_alert' and u.created_at >= date_trunc('day',at at time zone 'UTC') at time zone 'UTC'),'[]'::jsonb))
      from public.sport_quiz_settings s where s.singleton),
    'bank_counts',jsonb_build_object(
      'topics',(select coalesce(jsonb_agg(jsonb_build_object('topic_category',x.topic_category,'draft_count',x.d,'approved_count',x.a) order by x.topic_category),'[]'::jsonb)
        from (select topic_category,count(*) filter (where status = 'draft') d,count(*) filter (where status = 'approved') a
          from public.sport_quiz_questions where status in ('draft','approved') and topic_category <> 'athlete' group by topic_category) x),
      'sports',(select coalesce(jsonb_agg(jsonb_build_object('sport',x.sport,'draft_count',x.d,'approved_count',x.a) order by x.sport),'[]'::jsonb)
        from (select sport,count(*) filter (where status = 'draft') d,count(*) filter (where status = 'approved') a
          from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'sport' group by sport) x),
      'chapters',(select coalesce(jsonb_agg(jsonb_build_object('chapter',c.id,'draft_count',coalesce(x.d,0),'approved_count',coalesce(x.a,0)) order by c.position),'[]'::jsonb)
        from public.sport_quiz_life_chapters c left join (select chapter,count(*) filter (where status = 'draft') d,count(*) filter (where status = 'approved') a
          from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'life' group by chapter) x on x.chapter = c.id)),
    'counts',wk || jsonb_build_object(
      'questions_draft',(select count(*) from public.sport_quiz_questions where status = 'draft' and topic_category <> 'athlete'),
      'questions_approved',(select count(*) from public.sport_quiz_questions where status = 'approved' and topic_category <> 'athlete'),
      'questions_archived',(select count(*) from public.sport_quiz_questions where status = 'archived' and topic_category <> 'athlete'),
      'questions_void',(select count(*) from public.sport_quiz_questions where status = 'void' and topic_category <> 'athlete'),
      'questions_true_false',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and question_type = 'true_false'),
      'questions_image',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and question_type = 'image_choice'),
      'week_items_issued',(select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.week_start = w and a.round_kind <> 'life'),
      'week_items_answered',(select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.week_start = w and a.round_kind <> 'life' and i.status = 'answered'),
      'week_items_void',(select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.week_start = w and a.round_kind <> 'life' and i.status = 'void'),
      'badges_issued',(select count(*) from public.sport_quiz_badges where voided_at is null and kind <> 'life'),
      'badges_void',(select count(*) from public.sport_quiz_badges where voided_at is not null and kind <> 'life'),
      'badges_sport',(select count(*) from public.sport_quiz_badges where voided_at is null and kind = 'sport'),
      'badges_family',(select count(*) from public.sport_quiz_badges where voided_at is null and kind = 'family'),
      'badges_season',(select count(*) from public.sport_quiz_badges where voided_at is null and kind = 'season'),
      'badges_group_visible',(select count(*) from public.sport_quiz_badges where voided_at is null and visibility = 'groups'),
      'recap_facts_quarter',(select coalesce(sum(public.quiz_facts(p.profile_id,date_trunc('quarter',at at time zone 'UTC')::date,(date_trunc('quarter',at at time zone 'UTC') + interval '3 months')::date)),0)
        from (select distinct profile_id from public.sport_quiz_attempts) p)
        - (select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.round_kind = 'life' and i.status = 'answered'
           and a.week_start >= date_trunc('quarter',at at time zone 'UTC')::date and a.week_start < (date_trunc('quarter',at at time zone 'UTC') + interval '3 months')::date),
      'preferences_weekly',(select count(*) from public.sport_quiz_preferences where invitation_mode = 'weekly'),
      'exposures',(select count(*) from public.sport_quiz_exposures e where not exists(select 1 from public.sport_quiz_questions q where q.id = e.question_id and q.topic_category = 'life')),
      'week_spent',(select count(*) from public.sport_quiz_week_guards where week_start = w and round_kind <> 'life'),
      'retained_guards',(select count(*) from public.sport_quiz_week_guards where round_kind <> 'life'),'retained_requests',(select count(*) from public.sport_quiz_requests where round_kind <> 'life')),
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

-- 22. Retention and erasure ---------------------------------------------------------------------------------------------------
-- QUIZ-03's retention plus reports: reporter ids cleared at 90 days, reports deleted at 180 (500 per run each).
create or replace function public.quiz_admin_retention(p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; ng bigint; nr bigint; kept bigint; nc bigint; ns bigint; nj bigint; ngp bigint; rc bigint; rd bigint; fp bigint;
begin
  if char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'quiz_retention_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  delete from public.sport_quiz_requests where (profile_id,request_id) in (select profile_id,request_id from public.sport_quiz_requests where prune_after <= at order by prune_after,profile_id,request_id limit 500); get diagnostics nr = row_count;
  delete from public.sport_quiz_week_guards where (profile_id,week_start) in (select profile_id,week_start from public.sport_quiz_week_guards where prune_after <= at order by prune_after,profile_id,week_start limit 500); get diagnostics ng = row_count;
  delete from public.sport_quiz_group_codes where group_id in (select group_id from public.sport_quiz_group_codes where expires_at <= at order by expires_at,group_id limit 500); get diagnostics nc = row_count;
  delete from public.sport_quiz_group_sets where (group_id,week_start,position) in (select group_id,week_start,position from public.sport_quiz_group_sets where prune_after <= at order by prune_after,group_id,week_start,position limit 500); get diagnostics ns = row_count;
  delete from public.sport_quiz_group_join_attempts where id in (select id from public.sport_quiz_group_join_attempts where prune_after <= at order by prune_after,id limit 500); get diagnostics nj = row_count;
  delete from public.sport_quiz_groups where id in (select id from public.sport_quiz_groups where (status = 'closed' and closed_at <= at - interval '35 days')
    or (status = 'active' and not exists(select 1 from public.sport_quiz_group_members m where m.group_id = id and m.status = 'active')) order by created_at,id limit 500); get diagnostics ngp = row_count;
  update public.sport_quiz_reports set reporter_id = null,reporter_cleared_at = at where id in (select id from public.sport_quiz_reports
    where reporter_id is not null and created_at <= at - interval '90 days' order by created_at,id limit 500); get diagnostics rc = row_count;
  delete from public.sport_quiz_reports where id in (select id from public.sport_quiz_reports where created_at <= at - interval '180 days' order by created_at,id limit 500); get diagnostics rd = row_count;
  -- Declined fun-fact text goes 30 days after the decision (the decision and reason code stay for the athlete's export).
  update public.quiz_athlete_facts set answer_text = null,cleared_at = at,clear_cause = 'declined_purged',look_reasons = '{}',updated_at = at
    where id in (select id from public.quiz_athlete_facts where status = 'declined' and answer_text is not null
      and coalesce(admin_decided_at,guardian_decided_at,updated_at) <= at - interval '30 days' order by updated_at,id limit 500); get diagnostics fp = row_count;
  select count(*) into kept from public.sport_quiz_week_guards where prune_after > at;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'retention',btrim(p_reason),at);
  return jsonb_build_object('contract_version',2,'removed_guards',ng,'removed_requests',nr,'preserved_guards',kept,'batch_limit',500,
    'removed_codes',nc,'removed_group_sets',ns,'removed_join_attempts',nj,'removed_groups',ngp,'cleared_reporters',rc,'removed_reports',rd,'purged_declined_facts',fp);
end $$;
-- QUIZ-04's erasure plus the caller's own reports.
create or replace function public.quiz_erase_history(p_expected_history_version bigint,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id); at timestamptz; w date; rev bigint; na bigint; ne bigint; nb bigint; nr bigint; nau bigint;
  prune timestamptz; gid uuid; owner uuid; ng bigint := 0; nj bigint; ns bigint := 0; n bigint; nl bigint; nrep bigint;
begin
  perform 1 from public.sport_quiz_settings where singleton for share;
  if not found then raise exception 'quiz_unavailable'; end if;
  for gid in select group_id from public.sport_quiz_group_members where profile_id = me and status = 'active' order by group_id loop
    perform 1 from public.sport_quiz_groups where id = gid for update;
  end loop;
  perform public.quiz_lock(me); at := clock_timestamp(); w := public.quiz_week_at(at);
  insert into public.sport_quiz_preferences(profile_id) values(me) on conflict do nothing;
  select history_version into rev from public.sport_quiz_preferences where profile_id = me for update;
  if rev is distinct from p_expected_history_version then raise exception 'quiz_history_stale'; end if;
  perform public.quiz_spend(me,w,at,'personal'); perform public.quiz_spend(me,w,at,'group'); perform public.quiz_spend(me,w,at,'life');
  select prune_after into prune from public.sport_quiz_week_guards where profile_id = me and week_start = w and round_kind = 'personal';
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
  delete from public.sport_quiz_reports where reporter_id = me; get diagnostics nrep = row_count;
  perform set_config('quiz.erase_profile',me::text,true);
  delete from public.sport_quiz_audit where actor_id = me and action in ('start','answer','skip','end'); get diagnostics nau = row_count;
  delete from public.sport_quiz_levels where profile_id = me; get diagnostics nl = row_count;
  perform set_config('quiz.erase_profile','',true);
  delete from public.sport_quiz_attempts where profile_id = me;
  update public.sport_quiz_preferences set history_version = history_version + 1,updated_at = at where profile_id = me;
  return jsonb_build_object('contract_version',2,'profile_id',me,'history_version',rev + 1,'week_start',w,'week_spent',true,'quota_prune_after',prune,
    'removed_attempts',na,'removed_exposures',ne,'removed_badges',nb,'removed_requests',nr,'removed_audit',nau,
    'removed_group_memberships',ng,'retained_join_attempts',nj,'removed_group_sets',ns,'removed_levels',nl,'removed_reports',nrep);
end $$;

-- 23. Guardian supervision: QUIZ-03's summary with "fun_facts_shared" (the same count for teen and guardian) ------------------
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
      'trivia_groups', (select count(*) from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id
                        where m.profile_id = p.id and m.status = 'active' and g.status = 'active'),
      -- QUIZ-05: approved fun facts live now; a count only, never the text.
      'fun_facts_shared', (select count(*) from public.quiz_athlete_facts x where x.athlete_id = p.id and x.status = 'approved')
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

-- 24. Access: RPC-only tables with the Closed accounts policy, explicit revokes and grants -----------------------------------
do $$ declare t text; f record; begin
  foreach t in array array['quiz_athlete_facts','sport_quiz_question_stats','sport_quiz_reports','sport_quiz_imports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
    execute format('drop policy if exists "Closed accounts" on public.%I',t);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))',t);
  end loop;
  revoke all on sequence public.sport_quiz_reports_id_seq from public,anon,authenticated,service_role;
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'quiz\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
  revoke all on function public.supervision_json(uuid,timestamptz) from public,anon,authenticated;
  grant execute on function public.supervision_json(uuid,timestamptz) to service_role;
end $$;
grant execute on function public.quiz_snapshot(),public.quiz_preferences(jsonb,bigint,uuid,uuid),public.quiz_invitation(date,uuid,uuid),
 public.quiz_start(text,text,integer,date,text,uuid,text,uuid),public.quiz_answer(uuid,integer,uuid,text,uuid),
 public.quiz_end(uuid,uuid,date,text,uuid,uuid,text),public.quiz_skip(date,uuid,uuid),public.quiz_receipt(uuid),public.quiz_history(text),
 public.quiz_erase_history(bigint,uuid),public.quiz_admin_snapshot(text,bigint),public.quiz_admin_settings(jsonb,text,uuid),
 public.quiz_admin_question(uuid,text,jsonb,uuid),public.quiz_admin_retention(text,uuid),
 public.quiz_next(uuid,integer,uuid,text,uuid),public.quiz_group_start(uuid,integer,date,text,uuid,text,uuid),
 public.quiz_badge_shelf(),public.quiz_badge_visibility(uuid,text,uuid),public.quiz_season_recap(text),
 public.quiz_group_create(text,text,uuid,uuid),public.quiz_group_join(text,uuid),public.quiz_group_leave(uuid,uuid),
 public.quiz_group_remove_member(uuid,text,uuid),public.quiz_group_renew_code(uuid,uuid),public.quiz_group_set_theme(uuid,text,uuid),
 public.quiz_group_page(uuid),public.quiz_groups_mine(),public.quiz_group_report(uuid,text,uuid),
 public.quiz_admin_play_settings(jsonb,text,uuid),public.quiz_admin_group_case(uuid,text,uuid),public.quiz_admin_group_remove(uuid,uuid,text,uuid),
 public.quiz_life_start(date,uuid,text,uuid,text,text,integer),public.quiz_life_snapshot(),public.quiz_life_chapters(),public.quiz_life_progress(),
 public.quiz_level(),public.quiz_life_preferences(boolean,text,bigint,uuid),
 public.quiz_admin_life_settings(jsonb,text,uuid),public.quiz_admin_life_chapter(text,boolean,text,uuid),public.quiz_admin_life_snapshot(),
 -- QUIZ-05
 public.quiz_learn_start(uuid,text,integer,date,text,uuid,text,uuid),public.quiz_report(uuid,text,uuid),
 public.quiz_fact_submit(text,text,uuid),public.quiz_fact_withdraw(uuid,uuid),public.quiz_fact_mine(),public.quiz_fact_counts(),public.quiz_fact_export(),
 public.quiz_fact_guardian_pending(),public.quiz_fact_guardian_decide(uuid,boolean,uuid),
 public.quiz_admin_fact_queue(),public.quiz_admin_fact_decide(uuid,text,jsonb,uuid),public.quiz_admin_needs_look(),
 public.quiz_admin_needs_look_action(uuid,text,text,uuid),public.quiz_admin_fresh_settings(jsonb,text,uuid),public.quiz_admin_import(jsonb,boolean,text,uuid) to authenticated;
