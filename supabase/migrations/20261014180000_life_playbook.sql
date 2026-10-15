-- QUIZ-04: Life Playbook and personal progress. Local source only; not applied anywhere.
-- Requires QUIZ-01, QUIZ-02, QUIZ-03 (20261014160000), the QUIZ-03 starter bank and MINOR-01 / PRIV-01.
-- Design: docs/engineering/design/LIFE_PLAYBOOK_DESIGN.md (§8 owner simplification 2026-10-15 overrides §2–§7).
-- Owner: POLLS with BACKEND, DATABASE_MIGRATIONS, AURA (levels and badges), ADMIN and DATA_GOVERNANCE. Reviews: LEGAL,
--   MINOR_SAFETY, PRIVACY_ENGINEERING, RLS_SECURITY, VOICE, QA.
-- Owner simplification (2026-10-15, edited in place before any apply): keep trivia simple and fun, simple facts only.
--   One admin approves a Life question exactly like sports trivia. The CPA sign-off, named finance / tax reviewers,
--   source URLs / retrieval dates / tax years, re-review and the January withdrawal, and the 16+ / adult bands are
--   gone (excerpts kept in archive/superseded-2026-10-15/sql/life_playbook_review.archived.sql). Life content carries
--   no money figures or years, so nothing goes stale.
-- What it adds:
--   1. Round kinds (§7.1): round_kind personal | group | life on attempts, week guards, request receipts and the Start
--      digest; one round per (account, week, kind); quiz_end takes the kind and spends only that guard; still one active
--      round at a time; reserved request slots per (week, kind) and the weekly request cap raised 57 -> 171.
--   2. Explicit fun-slot categories (science, geography, general); topic 'life' only through quiz_life_start (§7.2).
--   3. Group "played", Family Challenger and group fact totals count group rounds only; group Start needs >= 2 members;
--      Trivia Explorer re-points to another qualifying round of the same week when its round is voided (§7.3).
--   4. Life columns on questions (chapter, min_age_band '13', education_only) and a separate Life version cap (200 draft
--      + approved; trivia keeps its 300). Approval: one admin, the education-only attestation and the copy rules.
--   5. Four chapters (sport_quiz_life_chapters, seeded closed, all 13+): Money Huddle, Savings Season, Scam Defense,
--      Smart Plays. A chapter opens with 5 approved items (one round).
--   6. Eligibility: Life is for trivia-eligible accounts plus 13+ accounts without a recorded age (not_given / unknown),
--      checked at Start and every Next. No error or read mentions age.
--   7. Levels: admin thresholds (Rookie 0, Varsity 15, All-Star 40, Pro 80, Hall of Fame 150 by default); stored
--      highest level per account and per chapter only goes up (cleared by erasure); chapter progress = share of the
--      chapter's approved questions seen; one private Life badge per chapter at Varsity.
--   8. Privacy: admin Life statistics are aggregate only (per-question >= 20 responders, age band x chapter cells < 10
--      hidden, no per-user rows); Life stays out of the trivia counts and audit feed; Life audit rows carry no question
--      id; erasure covers Life; the opt-in is private.
--   9. The Life copy ruleset runs in SQL at approval (quiz_life_copy_problems): no advice, brands, Tapua'i money words,
--      NIL / eligibility, tax / loan / credit score / APR, money figures or years; Scam Defense ends "Tell a trusted adult
--      and use Report."; prompt <= 120 and explanation <= 200 characters. CI runs the same rules over the JSON bank
--      (scripts/life-bank-sql.mjs) from one file, supabase/content/life_copy_rules.json.
--  10. trivia.life switch (sport_quiz_settings.life_enabled), default off.
--  11. Control tower (2026-10-15, edited in place before any apply): quiz_admin_snapshot.bank_counts (draft / approved
--      versions by topic, sport and chapter; content counts only) and the atomic quiz_admin_question 'edit_replace'.
-- Access: RPC-only, "Closed accounts" restrictive policy on every new table, explicit revokes on every function, pinned
--   search_path. Lock order unchanged: settings -> group -> account -> attempt.
-- Safe to re-run: add column if not exists, create table if not exists, named constraints dropped and re-added NOT VALID,
--   seeds on conflict do nothing, create or replace. Rollback: switch trivia.life off and pause; keep records; forward fix.

-- 0. Helpers used by constraints ---------------------------------------------------------------------------------------
create or replace function public.quiz_level_keys()
returns text[] language sql immutable set search_path = '' as $$ select array['rookie','varsity','all_star','pro','hall_of_fame'] $$;
create or replace function public.quiz_level_label(p_rank integer)
returns text language sql immutable set search_path = '' as $$ select (array['Rookie','Varsity','All-Star','Pro','Hall of Fame'])[p_rank + 1] $$;

-- Five integer thresholds, Rookie = 0, strictly increasing.
create or replace function public.quiz_thresholds_ok(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; prev integer := -1; v integer;
begin
  if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p)) <> 5 then return false; end if;
  foreach k in array public.quiz_level_keys() loop
    if jsonb_typeof(p -> k) is distinct from 'number' or (p ->> k) !~ '^[0-9]{1,5}$' then return false; end if;
    v := (p ->> k)::integer;
    if (k = 'rookie' and v <> 0) or v <= prev then return false; end if;
    prev := v;
  end loop;
  return true;
end $$;
create or replace function public.quiz_level_rank(p_facts integer,p_thresholds jsonb)
returns integer language sql immutable set search_path = '' as $$
  select coalesce(max(i::integer - 1),0) from unnest(public.quiz_level_keys()) with ordinality k(name,i) where coalesce(p_facts,0) >= (p_thresholds ->> name)::integer
$$;

-- Life is for the trivia bands plus 13+ accounts without a recorded age (not_given / unknown); never under 13.
create or replace function public.quiz_life_band_ok(p_profile_band text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_profile_band in ('adult','teen_16_17','teen_13_15','not_given','unknown'),false)
$$;
-- A chapter opens with one round of approved items (owner simplification 2026-10-15; was 20).
create or replace function public.quiz_life_open_at()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;
-- The Life copy ruleset (v4, design §8). One rule list: supabase/content/life_copy_rules.json, read by
-- scripts/life-bank-sql.mjs and copied here between the markers; `pnpm life:bank:check` fails if the two differ.
-- life-copy-rules:begin
create or replace function public.quiz_life_copy_rules()
returns jsonb language sql immutable set search_path = '' as $$ select $life_rules${"version":4,"advice":["you should","you shouldn't","you should not","you ought to","you must","you mustn't","you need to","should you","you shouldnt","you mustnt"],"brands":["visa","mastercard","master card","american express","amex","paypal","venmo","zelle","cash app","cashapp","apple pay","google pay","apple","chase","nike","adidas","wells fargo","bank of america","citibank","capital one","sallie mae","sofi","credit karma","nerdwallet","equifax","experian","transunion","fico","turbotax","h&r block","robinhood","coinbase","bitcoin","klarna","afterpay"],"money_words":["tapua'i","tapuai","donate","donates","donated","donating","donation","donations","donor","donors","rally","rallies","family account","family accounts","payout","payouts","pay out","pays out","aura","gift","gifts","gifted","gifting","mālo","malo","pay-out","pay-outs"],"money_patterns":["tapua[^a-z0-9]?i"],"nil_eligibility":["nil","name, image and likeness","name, image, and likeness","name image and likeness","eligible","eligibility","ineligible","ineligibility"],"tax_loan_credit":["tax","taxes","taxed","taxable","taxation","loan","loans","credit score","credit scores","apr","aprs","annual percentage rate","annual percentage rates"],"money_symbols":"$€£¥¢%","number_words":["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety","hundred","thousand","million","billion","dozen","half"],"figure_words":["dollar","dollars","cent","cents","usd","buck","bucks","penny","pennies","percent","per cent","percentage points","pct","euro","euros","pound","pounds","grand"],"currency_words":["dollar","dollars","cent","cents","buck","bucks","penny","pennies","euro","euros"],"currency_prefixes":["usd","us$","eur","gbp","cad","aud"],"amount_suffixes":["k","m","bn"],"magnitude_words":["million","billion","trillion"],"year_pattern":"(?<![0-9])(?:1[6-9]|20|21)[0-9]{2}(?![0-9])","scam_chapter":"scam_defense","scam_end":"tell a trusted adult and use report.","prompt_max":120,"explanation_max":200,"allowed_non_ascii":"āēīōū—–·×"}$life_rules$::jsonb $$;
-- life-copy-rules:end
-- Normalize before matching: NFKC (full-width digits / %, compatibility spaces), drop zero-width characters, plain
-- spaces and quotes (ʻokina and curly quotes become '), lowercase. The same steps run in scripts/life-bank-sql.mjs.
create or replace function public.quiz_life_normalize(p text)
returns text language sql immutable set search_path = '' as $$
  select lower(translate(regexp_replace(normalize(coalesce(p,''),nfkc),U&'[\200B-\200D\2060\FEFF\00AD]','','g'),
    U&'\00A0\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\202F\205F\3000\2018\2019\02BB\02BC\0060\00B4\2032\201C\201D\201E\2033',
    repeat(' ',15) || repeat(chr(39),7) || repeat(chr(34),4)))
$$;
-- Whole-word alternation of a phrase list (spaces match any run of spaces); identical pattern in the JS check.
-- Matching runs on macron-stripped text (quiz_life_strip), so phrases are stripped too.
create or replace function public.quiz_life_strip(p text)
returns text language sql immutable set search_path = '' as $$ select translate(coalesce(p,''),'āēīōū','aeiou') $$;
create or replace function public.quiz_life_alt(p_list jsonb)
returns text language sql immutable set search_path = '' as $$
  select '(?:' || string_agg(replace(regexp_replace(public.quiz_life_strip(x),'([.^$*+?()\[\]{}|\\])','\\\1','g'),' ','\s+'),'|') || ')'
  from jsonb_array_elements_text(p_list) x
$$;
create or replace function public.quiz_life_phrase_re(p_list jsonb)
returns text language sql immutable set search_path = '' as $$ select '(?<![a-z0-9_])' || public.quiz_life_alt(p_list) || '(?![a-z0-9_])' $$;
-- Money figure pattern (macron-stripped, normalized text): any money symbol or %, digits or number words with a
-- currency / percent / "grand" word, "a" / "an" with a currency word, a currency code before digits, digits with
-- k / m / bn, or million / billion / trillion on their own. Life content has no figures at all (design §8).
create or replace function public.quiz_life_figure_re()
returns text language sql immutable set search_path = '' as $$
  select '[' || (r ->> 'money_symbols') || ']|[0-9][0-9,.]*\s*-?\s*' || public.quiz_life_alt(r -> 'figure_words') || '(?![a-z0-9_])|'
    || public.quiz_life_phrase_re(r -> 'number_words') || '\s*-?\s*' || public.quiz_life_alt(r -> 'figure_words') || '(?![a-z0-9_])|'
    || '(?<![a-z0-9_])(?:a|an)\s+' || public.quiz_life_alt(r -> 'currency_words') || '(?![a-z0-9_])|'
    || '(?<![a-z0-9_])' || public.quiz_life_alt(r -> 'currency_prefixes') || '\s*[0-9]|'
    || '[0-9][0-9,.]*\s*' || public.quiz_life_alt(r -> 'amount_suffixes') || '(?![a-z0-9_])|' || public.quiz_life_phrase_re(r -> 'magnitude_words')
  from (select public.quiz_life_copy_rules() r) x
$$;
-- Returns the broken rule names in this order (empty = passes): non_latin_text on the display text (letters outside
-- ASCII and the allowed macron / dash forms, e.g. Cyrillic lookalikes); then on the macron-stripped text over prompt,
-- explanation and options: advice_you_should, brand_name, tapuai_money_word (phrases + tapua?i patterns),
-- nil_eligibility, tax_loan_credit, money_figure, year; scam_missing_report_line (Scam Defense explanations end
-- "Tell a trusted adult and use Report."); prompt_too_long (> 120) and explanation_too_long (> 200 characters).
create or replace function public.quiz_life_copy_problems(p_prompt text,p_options jsonb,p_explanation text,p_chapter text)
returns text[] language plpgsql immutable set search_path = '' as $$
declare r jsonb := public.quiz_life_copy_rules(); p text; e text; t text; m text; out text[] := '{}';
begin
  p := public.quiz_life_normalize(p_prompt);
  e := btrim(public.quiz_life_normalize(p_explanation));
  t := p || ' ' || e || ' ' || public.quiz_life_normalize(coalesce((select string_agg(v,' ') from jsonb_array_elements_text(case when jsonb_typeof(p_options) = 'array' then p_options else '[]'::jsonb end) v),''));
  m := public.quiz_life_strip(t);
  if exists(select 1 from regexp_split_to_table(t,'') c where ascii(c) > 126 and position(c in r ->> 'allowed_non_ascii') = 0) then out := out || 'non_latin_text'::text; end if;
  if m ~ public.quiz_life_phrase_re(r -> 'advice') then out := out || 'advice_you_should'::text; end if;
  if m ~ public.quiz_life_phrase_re(r -> 'brands') then out := out || 'brand_name'::text; end if;
  if m ~ public.quiz_life_phrase_re(r -> 'money_words')
     or m ~ ('(?<![a-z0-9_])(?:' || (select string_agg(x,'|') from jsonb_array_elements_text(r -> 'money_patterns') x) || ')(?![a-z0-9_])') then out := out || 'tapuai_money_word'::text; end if;
  if m ~ public.quiz_life_phrase_re(r -> 'nil_eligibility') then out := out || 'nil_eligibility'::text; end if;
  if m ~ public.quiz_life_phrase_re(r -> 'tax_loan_credit') then out := out || 'tax_loan_credit'::text; end if;
  if m ~ public.quiz_life_figure_re() then out := out || 'money_figure'::text; end if;
  if m ~ (r ->> 'year_pattern') then out := out || 'year'::text; end if;
  if p_chapter = r ->> 'scam_chapter' and right(e,char_length(r ->> 'scam_end')) is distinct from r ->> 'scam_end' then out := out || 'scam_missing_report_line'::text; end if;
  if char_length(btrim(coalesce(p_prompt,''))) > (r ->> 'prompt_max')::integer then out := out || 'prompt_too_long'::text; end if;
  if char_length(btrim(coalesce(p_explanation,''))) > (r ->> 'explanation_max')::integer then out := out || 'explanation_too_long'::text; end if;
  return out;
end $$;

-- 1. Settings: the trivia.life switch and level thresholds -------------------------------------------------------------
alter table public.sport_quiz_settings add column if not exists life_enabled boolean not null default false;
alter table public.sport_quiz_settings add column if not exists level_thresholds jsonb not null
  default '{"rookie":0,"varsity":15,"all_star":40,"pro":80,"hall_of_fame":150}'::jsonb;
alter table public.sport_quiz_settings drop constraint if exists quiz_level_thresholds_valid;
alter table public.sport_quiz_settings add constraint quiz_level_thresholds_valid check (public.quiz_thresholds_ok(level_thresholds));

-- 2. Chapters (all 13+, seeded closed) ----------------------------------------------------------------------------------
create table if not exists public.sport_quiz_life_chapters (
  id text primary key check (id ~ '^[a-z][a-z_]{2,39}$'),
  title text not null check (char_length(btrim(title)) between 2 and 80),
  framing text not null default '' check (char_length(framing) <= 200),
  open boolean not null default false,
  position smallint not null unique check (position between 1 and 50),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.sport_quiz_life_chapters(id,title,framing,position) values
  ('money_huddle','Money Huddle','Calling the play before you spend',1),
  ('savings_season','Savings Season','Building your bench',2),
  ('scam_defense','Scam Defense','Defense wins',3),
  ('smart_plays','Smart Plays','Good calls every day',4)
on conflict (id) do nothing;

-- 3. Life columns on questions -----------------------------------------------------------------------------------------
alter table public.sport_quiz_questions drop constraint if exists sport_quiz_questions_topic_category_check;
alter table public.sport_quiz_questions add constraint sport_quiz_questions_topic_category_check
  check (topic_category in ('sport','science','geography','general','life')) not valid;
alter table public.sport_quiz_questions add column if not exists chapter text references public.sport_quiz_life_chapters(id);
alter table public.sport_quiz_questions add column if not exists min_age_band text check (min_age_band = '13');
alter table public.sport_quiz_questions add column if not exists education_only boolean not null default false;
alter table public.sport_quiz_questions drop constraint if exists quiz_life_fields;
alter table public.sport_quiz_questions add constraint quiz_life_fields check (case when topic_category = 'life' then
    chapter is not null and min_age_band = '13' and question_type in ('choice4','true_false')
  else
    chapter is null and min_age_band is null and education_only = false
  end) not valid;
create index if not exists quiz_questions_life on public.sport_quiz_questions(chapter, status) where topic_category = 'life';

-- 4. Round kinds ---------------------------------------------------------------------------------------------------------
alter table public.sport_quiz_attempts add column if not exists round_kind text not null default 'personal';
alter table public.sport_quiz_attempts drop constraint if exists quiz_round_kind_values;
alter table public.sport_quiz_attempts add constraint quiz_round_kind_values check (round_kind in ('personal','group','life'));
update public.sport_quiz_attempts set round_kind = 'group' where group_id is not null and round_kind = 'personal';
alter table public.sport_quiz_attempts drop constraint if exists sport_quiz_attempts_profile_id_week_start_key;
do $$ begin
  if not exists(select 1 from pg_constraint where conname = 'quiz_attempt_week_kind' and conrelid = 'public.sport_quiz_attempts'::regclass) then
    alter table public.sport_quiz_attempts add constraint quiz_attempt_week_kind unique (profile_id, week_start, round_kind);
  end if;
end $$;
alter table public.sport_quiz_attempts drop constraint if exists quiz_round_kind_shape;
alter table public.sport_quiz_attempts add constraint quiz_round_kind_shape check ((group_id is null or round_kind = 'group')
  and (round_kind = 'personal' or mode = 'round') and ((round_kind = 'life') = (coalesce(topic_category,'') = 'life'))) not valid;
alter table public.sport_quiz_attempts drop constraint if exists quiz_round_shape;
alter table public.sport_quiz_attempts add constraint quiz_round_shape check (mode <> 'round' or (
  question_id is null and duration_seconds is not null and started_at is not null and expires_at is not null
  and topic_category in ('sport','science','geography','general','life')
  and round_size between 1 and 5 and planned_items between 1 and round_size and position between 1 and planned_items
  and status in ('issued','completed','ended','expired','void')
  and (status = 'issued') = (round_state is not null)
  and (round_state is distinct from 'between' or next_by is not null)
  and (status <> 'issued' or session_hash is not null))) not valid;

alter table public.sport_quiz_week_guards add column if not exists round_kind text not null default 'personal';
alter table public.sport_quiz_week_guards drop constraint if exists quiz_guard_kind_values;
alter table public.sport_quiz_week_guards add constraint quiz_guard_kind_values check (round_kind in ('personal','group','life'));
update public.sport_quiz_week_guards g set round_kind = 'group' from public.sport_quiz_attempts a
  where a.profile_id = g.profile_id and a.week_start = g.week_start and a.round_kind = 'group' and g.round_kind = 'personal'
    and not exists(select 1 from public.sport_quiz_attempts p where p.profile_id = g.profile_id and p.week_start = g.week_start and p.round_kind = 'personal');
do $$ begin
  if not exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.sport_quiz_week_guards'::regclass and c.contype = 'p' and a.attname = 'round_kind') then
    alter table public.sport_quiz_week_guards drop constraint if exists sport_quiz_week_guards_pkey;
    alter table public.sport_quiz_week_guards add constraint sport_quiz_week_guards_pkey primary key (profile_id, week_start, round_kind);
  end if;
end $$;

alter table public.sport_quiz_requests add column if not exists round_kind text not null default 'personal';
alter table public.sport_quiz_requests drop constraint if exists quiz_request_kind_values;
alter table public.sport_quiz_requests add constraint quiz_request_kind_values check (round_kind in ('personal','group','life'));
update public.sport_quiz_requests r set round_kind = a.round_kind from public.sport_quiz_attempts a where a.id = r.attempt_id and r.round_kind <> a.round_kind;
-- Review fix (P3): round operations (Start, Next, answer, End) use a per-kind budget ('round') that ordinary saves cannot use.
alter table public.sport_quiz_requests drop constraint if exists sport_quiz_requests_capacity_class_check;
alter table public.sport_quiz_requests add constraint sport_quiz_requests_capacity_class_check check (capacity_class in ('ordinary','round','answer','off','end')) not valid;
drop index if exists public.quiz_reserved_request_slot;
create unique index quiz_reserved_request_slot on public.sport_quiz_requests(profile_id, week_start, round_kind, capacity_class) where capacity_class in ('answer','off','end');

-- 5. Private Life opt-in, levels and badge / audit vocabulary --------------------------------------------------------------
alter table public.sport_quiz_preferences add column if not exists life_opt_in boolean not null default false;
alter table public.sport_quiz_preferences add column if not exists life_notice_version text check (life_notice_version = 'life-playbook-v1-testing');
alter table public.sport_quiz_preferences add column if not exists life_opted_in_at timestamptz;
alter table public.sport_quiz_preferences add column if not exists life_version bigint not null default 0 check (life_version >= 0);

create table if not exists public.sport_quiz_levels (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track = 'overall' or track ~ '^[a-z][a-z_]{2,39}$'),
  level text not null check (level in ('rookie','varsity','all_star','pro','hall_of_fame')),
  rank smallint not null check (rank between 0 and 4),
  reached_at timestamptz not null,
  primary key (profile_id, track)
);

alter table public.sport_quiz_badges drop constraint if exists quiz_badge_label;
alter table public.sport_quiz_badges add constraint quiz_badge_label check (
  (kind = 'weekly' and label in ('Sport Learner','Trivia Explorer') and attempt_id is not null and sport is null)
  or (kind = 'family' and label = 'Family Challenger' and attempt_id is null and sport is null)
  or (kind = 'season' and label = 'Season Learner' and attempt_id is null and sport is null and period ~ '^[0-9]{4}-Q[1-4]$')
  or (kind = 'sport' and sport is not null and label = sport || ' Explorer' and attempt_id is null and period = 'lifetime')
  or (kind = 'life' and label like '% Playbook' and attempt_id is null and sport is null and period = 'lifetime' and visibility = 'private')) not valid;
alter table public.sport_quiz_audit drop constraint if exists sport_quiz_audit_action_check;
alter table public.sport_quiz_audit add constraint sport_quiz_audit_action_check check (action in
  ('settings','question_create','question_edit','question_approve','question_archive','question_void','question_review_media',
   'start','answer','skip','end','retention','life_settings','life_chapter')) not valid;

-- 6. Life read helpers -------------------------------------------------------------------------------------------------
-- Approved items in a chapter: the count that opens a chapter.
create or replace function public.quiz_life_approved_count(p_chapter text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.sport_quiz_questions q where q.status = 'approved' and q.topic_category = 'life' and q.chapter = p_chapter
$$;
create or replace function public.quiz_life_chapter_state(p_chapter text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('approved_count',z.n,'needs_more',greatest(z.at - z.n,0),'ready',z.n >= z.at,'switched_open',c.open,
    'open',c.open and z.n >= z.at,
    'reasons',to_jsonb(array_remove(array[case when z.n < z.at then 'needs ' || (z.at - z.n) || ' more approved question' || case when z.at - z.n = 1 then '' else 's' end end],null)))
  from public.sport_quiz_life_chapters c
  cross join lateral (select public.quiz_life_approved_count(c.id) n, public.quiz_life_open_at() at) z
  where c.id = p_chapter
$$;
create or replace function public.quiz_life_chapter_open(p_chapter text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((public.quiz_life_chapter_state(p_chapter) ->> 'open')::boolean,false)
$$;
-- Unseen, drawable Life questions for one account right now: approved, in an open chapter, optionally one chapter.
-- Eligibility is checked by the caller (Start and every Next).
create or replace function public.quiz_life_pool(p_me uuid,p_chapter text)
returns table(id uuid, question_key uuid, chapter text) language sql stable security definer set search_path = '' as $$
  select q.id,q.question_key,q.chapter from public.sport_quiz_questions q join public.sport_quiz_life_chapters c on c.id = q.chapter
  where q.status = 'approved' and q.topic_category = 'life' and q.question_type <> 'image_choice' and (p_chapter is null or q.chapter = p_chapter)
    and public.quiz_life_chapter_open(c.id)
    and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10
    and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
$$;
create or replace function public.quiz_life_unseen_count(p_me uuid,p_chapter text)
returns integer language sql stable security definer set search_path = '' as $$ select count(*)::integer from public.quiz_life_pool(p_me,p_chapter) $$;
-- Life accepts 13+ accounts without a recorded age (not_given / unknown); sport and group trivia keep QUIZ-02's bands.
create or replace function public.quiz_life_actor()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id();
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null or me is null or not public.quiz_life_band_ok(public.profile_age_band(me)) then
    raise exception 'quiz_ineligible'; end if;
  return me;
end $$;
create or replace function public.quiz_life_expected_actor(p_expected uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_life_actor();
begin
  if p_expected is null or me is distinct from p_expected then raise exception 'quiz_identity_changed'; end if;
  return me;
end $$;
create or replace function public.quiz_trivia_band(p_me uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.profile_age_band(p_me) in ('adult','teen_13_15','teen_16_17')
$$;
-- Switch on, opted in with the current Life notice, and eligible by the server's band.
create or replace function public.quiz_life_access(p_me uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.life_enabled from public.sport_quiz_settings s where s.singleton),false)
    and coalesce((select p.life_opt_in and p.life_notice_version = 'life-playbook-v1-testing' from public.sport_quiz_preferences p where p.profile_id = p_me),false)
    and public.quiz_life_band_ok(public.profile_age_band(p_me))
$$;

-- 7. Guards ------------------------------------------------------------------------------------------------------------
-- QUIZ-03's question guard plus the Life fields: chapter, band and attestation are fixed on a version; approving a Life
-- version needs the education-only attestation and a clean copy-rule check (one admin, like sports trivia).
create or replace function public.quiz_guard_question()
returns trigger language plpgsql set search_path = '' as $$
declare normalized jsonb; problems text[];
begin
  if tg_op = 'UPDATE' and (new.question_key,new.version,new.sport,new.prompt,new.options,new.correct_option,new.explanation,new.created_at,
      new.topic_category,new.source_notes,new.question_type,new.media_path,new.media_licence,new.media_source,new.media_attribution,
      new.media_alt_text,new.media_size_bytes,new.media_has_person,new.media_no_marks,new.media_exif_stripped,
      new.chapter,new.min_age_band,new.education_only)
    is distinct from (old.question_key,old.version,old.sport,old.prompt,old.options,old.correct_option,old.explanation,old.created_at,
      old.topic_category,old.source_notes,old.question_type,old.media_path,old.media_licence,old.media_source,old.media_attribution,
      old.media_alt_text,old.media_size_bytes,old.media_has_person,old.media_no_marks,old.media_exif_stripped,
      old.chapter,old.min_age_band,old.education_only) then raise exception 'quiz_immutable'; end if;
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
  if tg_op = 'INSERT' then new.options := normalized; end if;
  return new;
end $$;

-- A chapter switches open only when ready; its id never changes and it is never deleted.
create or replace function public.quiz_guard_life_chapter()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'quiz_life_chapter_immutable'; end if;
  if tg_op = 'UPDATE' and new.id is distinct from old.id then raise exception 'quiz_life_chapter_immutable'; end if;
  if new.open and (tg_op = 'INSERT' or not old.open) and not coalesce((public.quiz_life_chapter_state(new.id) ->> 'ready')::boolean,false) then
    raise exception 'quiz_life_chapter_not_ready'; end if;
  return new;
end $$;
drop trigger if exists quiz_life_chapter_guard on public.sport_quiz_life_chapters;
create trigger quiz_life_chapter_guard before insert or update or delete on public.sport_quiz_life_chapters for each row execute function public.quiz_guard_life_chapter();

-- Levels only go up; only history erasure (or account deletion) removes them.
create or replace function public.quiz_guard_level()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 or old.profile_id::text = coalesce(current_setting('quiz.erase_profile',true),'') then return old; end if;
    raise exception 'quiz_level_only_up';
  end if;
  if (new.profile_id,new.track) is distinct from (old.profile_id,old.track) or new.rank <= old.rank then raise exception 'quiz_level_only_up'; end if;
  return new;
end $$;
drop trigger if exists quiz_level_guard on public.sport_quiz_levels;
create trigger quiz_level_guard before update or delete on public.sport_quiz_levels for each row execute function public.quiz_guard_level();
drop trigger if exists quiz_level_truncate_guard on public.sport_quiz_levels;
create or replace function public.quiz_guard_truncate()
returns trigger language plpgsql set search_path = '' as $$ begin raise exception 'quiz_truncate_refused'; end $$;
create trigger quiz_level_truncate_guard before truncate on public.sport_quiz_levels for each statement execute function public.quiz_guard_truncate();


-- 8. Receipts, guards and summaries by kind ------------------------------------------------------------------------------
-- Request budgets per account and UTC week (review fix P3): round operations (Start, Next, answer, End) have 20 per
-- kind ('round'), ordinary saves (preferences, invitation, skip) 111, so neither can block the other (3 x 57 = 171 in
-- all). Past a budget only the reserved answer / off / end slot of that (week, kind) remains.
create or replace function public.quiz_save_receipt(p_me uuid,p_request uuid,p_operation text,p_week date,p_digest text,p_attempt uuid,p_outcome text,
  p_at timestamptz,p_kind text,p_preferences jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare receipt jsonb; budget text; kind text; round_op boolean := p_operation in ('start','next','answer','end');
begin
  kind := coalesce(p_kind,(select round_kind from public.sport_quiz_attempts where id = p_attempt),'personal');
  receipt := jsonb_build_object('contract_version',2,'profile_id',p_me,'request_id',p_request,'operation',p_operation,'outcome',p_outcome,
    'week_start',p_week,'committed_at',p_at,'round_kind',kind,'attempt',public.quiz_summary(p_attempt,p_at),'result',public.quiz_result_dto(p_attempt,p_at),'preferences',p_preferences);
  if round_op and (select count(*) from public.sport_quiz_requests where profile_id = p_me and week_start = p_week and round_kind = kind and capacity_class = 'round') < 20 then
    budget := 'round';
  elsif not round_op and (select count(*) from public.sport_quiz_requests where profile_id = p_me and week_start = p_week and capacity_class = 'ordinary') < 111 then
    budget := 'ordinary';
  else
    budget := case when p_operation = 'end' then 'end' when p_operation = 'answer' or (p_operation = 'start' and p_outcome = 'cancelled') then 'answer'
      when p_outcome = 'saved_off' then 'off' else null end;
    if budget is null or exists(select 1 from public.sport_quiz_requests r where r.profile_id = p_me and r.week_start = p_week and r.round_kind = kind and r.capacity_class = budget)
      then raise exception 'quiz_request_limit'; end if;
  end if;
  insert into public.sport_quiz_requests(profile_id,request_id,operation,week_start,payload_digest,attempt_id,receipt,created_at,prune_after,capacity_class,round_kind)
    values(p_me,p_request,p_operation,p_week,p_digest,p_attempt,receipt,p_at,p_at + interval '35 days',budget,kind);
  return receipt;
end $$;
-- QUIZ-02 signature kept for preferences / invitation callers: the kind comes from the attempt, else personal.
create or replace function public.quiz_save_request(p_me uuid,p_request uuid,p_operation text,p_week date,p_digest text,p_attempt uuid,p_outcome text,p_at timestamptz,p_preferences jsonb default null)
returns jsonb language sql security definer set search_path = '' as $$
  select public.quiz_save_receipt(p_me,p_request,p_operation,p_week,p_digest,p_attempt,p_outcome,p_at,null,p_preferences)
$$;
create or replace function public.quiz_spend(p_me uuid,p_week date,p_at timestamptz,p_kind text)
returns void language sql security definer set search_path = '' as $$
  insert into public.sport_quiz_week_guards(profile_id,week_start,spent_at,prune_after,round_kind) values(p_me,p_week,p_at,p_at + interval '35 days',p_kind) on conflict do nothing
$$;

create or replace function public.quiz_summary(p_attempt uuid,p_asof timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when a.mode = 'round' then
    jsonb_build_object('id',a.id,'week_start',a.week_start,'mode',a.mode,'status',v ->> 'status','started_at',a.started_at,'expires_at',a.expires_at,
      'duration_seconds',a.duration_seconds,'closed_at',v -> 'closed_at','close_reason',v ->> 'close_reason','effective_expired',(v ->> 'effective_expired')::boolean,
      'correction_reason',a.correction_reason,'round_state',v ->> 'round_state','position',a.position,'planned_items',a.planned_items,
      'round_size',a.round_size,'next_by',v -> 'next_by','answered_count',(v ->> 'answered_count')::int,'short_round',a.planned_items < a.round_size,
      'group_id',a.group_id,'round_kind',a.round_kind)
  else
    jsonb_build_object('id',a.id,'week_start',a.week_start,'mode',a.mode,
      'status',case when a.status = 'issued' and a.expires_at <= p_asof then 'expired' else a.status end,
      'started_at',a.started_at,'expires_at',a.expires_at,'duration_seconds',a.duration_seconds,'closed_at',a.closed_at,'close_reason',a.close_reason,
      'effective_expired',a.status = 'issued' and a.expires_at <= p_asof,'correction_reason',a.correction_reason,
      'round_state',null,'position',null,'planned_items',null,'round_size',null,'next_by',null,'answered_count',
      case when a.status = 'completed' then 1 else 0 end,'short_round',false,'group_id',null,'round_kind',a.round_kind)
  end
  from public.sport_quiz_attempts a cross join lateral (select public.quiz_round_view(a.id,p_asof) v) x where a.id = p_attempt
$$;
-- The QUIZ-02 preferences contract is unchanged; the private Life opt-in travels only in the Life reads.
create or replace function public.quiz_preferences_dto(p_me uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select to_jsonb(p) - 'profile_id' - 'updated_at' - 'life_opt_in' - 'life_notice_version' - 'life_opted_in_at' - 'life_version'
      from public.sport_quiz_preferences p where profile_id = p_me),
    jsonb_build_object('invitation_mode','off','topic_mode','sports','notice_version',null,'notice_accepted_at',null,'version',0,'history_version',0,'last_invited_week',null))
$$;
-- §7.2: the fun slot names its categories; Life is never a fun-slot topic.
create or replace function public.quiz_fun_available(p_me uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_questions q where status = 'approved' and topic_category in ('science','geography','general') and question_type <> 'image_choice'
    and char_length(btrim(source_notes)) >= 10 and public.quiz_normalize_options(options) is not null
    and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key))
$$;
-- §7.3: "played" (group pages, Family Challenger, admin group counts) means a group round with a committed answer.
create or replace function public.quiz_played(p_me uuid,p_week date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_attempts a join public.sport_quiz_round_items i on i.attempt_id = a.id
    where a.profile_id = p_me and a.round_kind = 'group' and a.week_start = p_week and i.status = 'answered')
$$;
create or replace function public.quiz_group_facts(p_me uuid,p_from date,p_to date)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
  where a.profile_id = p_me and a.round_kind = 'group' and i.status = 'answered' and a.week_start >= p_from and a.week_start < p_to
$$;
create or replace function public.quiz_attempt_qualifies(p_attempt uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_attempts a where a.id = p_attempt and ((a.mode = 'round'
    and exists(select 1 from public.sport_quiz_round_items i where i.attempt_id = a.id and i.status = 'answered')) or (a.mode = 'timed' and a.status = 'completed')))
$$;

-- 9. Draw: Life rounds draw from the Life pool re-evaluated now (open chapters, unseen items) -----------------------------
create or replace function public.quiz_round_pick(p_me uuid,p_attempt uuid,p_position integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.sport_quiz_attempts%rowtype; qid uuid;
begin
  select * into a from public.sport_quiz_attempts where id = p_attempt;
  if a.round_kind = 'life' then
    select q.id into qid from public.sport_quiz_questions q where q.id in (select x.id from public.quiz_life_pool(p_me,a.sport_filter) x)
      order by random() limit 1 for share of q;
    return qid;
  end if;
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
    where q.status = 'approved' and q.question_type <> 'image_choice' and q.topic_category = a.topic_category and a.topic_category <> 'life'
      and (a.sport_filter is null or q.sport = a.sport_filter)
      and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10
      and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id = p_me and e.question_key = q.question_key)
    order by random() limit 1 for share of q;
  return qid;
end $$;

-- 10. Start core: one weekly opportunity per kind; one active round at a time -------------------------------------------
drop function if exists public.quiz_round_begin(uuid,text,text,integer,date,text,uuid,text,uuid);
create or replace function public.quiz_round_begin(p_me uuid,p_kind text,p_topic text,p_sport text,p_duration integer,p_expected_week date,p_notice text,
  p_request uuid,p_secret text,p_group uuid,p_chapter text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare at timestamptz; w date; d text; r public.sport_quiz_requests%rowtype; a public.sport_quiz_attempts%rowtype; it public.sport_quiz_round_items%rowtype;
  q public.sport_quiz_questions%rowtype; p public.sport_quiz_preferences%rowtype; s public.sport_quiz_settings%rowtype;
  receipt jsonb; active jsonb; item jsonb; planned integer; setn integer; qid uuid; filter text := case when p_sport is null then null else btrim(p_sport) end;
begin
  if coalesce(p_kind,'') not in ('personal','group','life') or (p_kind = 'group') <> (p_group is not null) or (p_kind <> 'life' and p_chapter is not null)
     or (p_kind = 'life') <> (p_topic = 'life') then raise exception 'quiz_start_invalid'; end if;
  -- Lock order: settings -> group (row + set advisory lock) -> account.
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
  d := public.quiz_digest(jsonb_build_array(p_kind,p_topic,filter,p_duration,p_expected_week,p_notice,p_secret,p_group,p_chapter));
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
          active := public.quiz_question_dto(it.question_id); item := public.quiz_active_item(a.id);
        end if;
      elsif a.expires_at > at then
        select * into q from public.sport_quiz_questions where id = a.question_id for share;
        if q.status <> 'void' then active := public.quiz_question_dto(q.id); end if;
      end if;
    end if;
    return public.quiz_receipt_dto(p_me,p_request,at) || jsonb_build_object('server_now',at,'active_question',active,'active_item',item);
  end if;
  -- A guard of this kind survives erasure / cancellation and is checked before any draw; other kinds are independent.
  if exists(select 1 from public.sport_quiz_week_guards where profile_id = p_me and week_start = w and round_kind = p_kind) then
    select id into a.id from public.sport_quiz_attempts where profile_id = p_me and week_start = w and round_kind = p_kind;
    receipt := public.quiz_save_receipt(p_me,p_request,'start',w,d,a.id,'week_spent',at,p_kind);
    return receipt || jsonb_build_object('server_now',at,'active_question',null,'active_item',null);
  end if;
  perform public.quiz_require_testing(p_me);
  perform public.quiz_expire(p_me,at);
  if exists(select 1 from public.sport_quiz_attempts where profile_id = p_me and status = 'issued') then raise exception 'quiz_round_active'; end if;
  select * into p from public.sport_quiz_preferences where profile_id = p_me;
  if p_kind = 'life' then
    if p.notice_version is distinct from 'timed-trivia-v1-testing' or p.life_notice_version is distinct from p_notice then raise exception 'quiz_notice_required'; end if;
    if not s.life_enabled then raise exception 'quiz_life_paused'; end if;
    if p.life_opt_in is not true then raise exception 'quiz_life_not_opted_in'; end if;
    if not public.quiz_life_band_ok(public.profile_age_band(p_me)) then raise exception 'quiz_ineligible'; end if;
    -- A closed, empty or unknown chapter reads exactly like an empty pool.
    planned := least(s.round_size,public.quiz_life_unseen_count(p_me,p_chapter));
  else
    if p.notice_version is distinct from p_notice then raise exception 'quiz_notice_required'; end if;
    if p_kind = 'personal' then
      if coalesce(p_topic,'') not in ('sport','science','geography','general') then raise exception 'quiz_start_invalid'; end if;
      if (p_topic <> 'sport' and not public.quiz_fun_slot(p_me,w)) or (p_topic = 'sport' and public.quiz_fun_slot(p_me,w) and public.quiz_fun_available(p_me)) then
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
      round_state,position,planned_items,round_size,topic_category,sport_filter,group_id,round_kind)
    values(p_me,w,null,'issued',at,'round',p_duration,at,at + p_duration * interval '1 second',public.hash_secret(p_secret),
      'item',1,planned,s.round_size,p_topic,case when p_kind = 'life' then p_chapter else filter end,p_group,p_kind) returning * into a;
  qid := public.quiz_round_pick(p_me,a.id,1);
  if qid is null then raise exception 'quiz_no_question'; end if;
  perform public.quiz_round_issue(p_me,a.id,1,qid,at,p_duration,null);
  perform public.quiz_bump_history(p_me);
  -- Life audit rows keep chapter and position only, never the Life question id (review fix P3).
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,reason,created_at)
    values(p_me,'start',case when p_kind = 'life' then null else qid end,a.id,
      case when p_kind = 'life' then (select chapter from public.sport_quiz_questions where id = qid) || ' #1' end,at);
  receipt := public.quiz_save_receipt(p_me,p_request,'start',w,d,a.id,'started',at,p_kind);
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
  return public.quiz_round_begin(me,'personal',p_topic_category,p_sport,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,null,null);
end $$;

-- The group opportunity is one per week across every group; a group round needs at least two active members.
create or replace function public.quiz_group_start(p_group_id uuid,p_duration_seconds integer,p_expected_week date,p_notice_version text,
 p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id);
begin
  if p_group_id is null or p_request_id is null or p_duration_seconds is null or p_duration_seconds not in (30,90)
    or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' or p_notice_version is distinct from 'timed-trivia-v1-testing' then raise exception 'quiz_start_invalid'; end if;
  return public.quiz_round_begin(me,'group','sport',null,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,p_group_id,null);
end $$;

-- Life round: 90 seconds by default (30 allowed); optional single chapter; the Life notice and opt-in are required.
create or replace function public.quiz_life_start(p_expected_week date,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid,
  p_notice_version text,p_chapter text default null,p_duration_seconds integer default 90)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id);
begin
  if p_request_id is null or p_duration_seconds is null or p_duration_seconds not in (30,90) or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$'
    or p_notice_version is distinct from 'life-playbook-v1-testing' or (p_chapter is not null and p_chapter !~ '^[a-z][a-z_]{2,39}$') then raise exception 'quiz_start_invalid'; end if;
  return public.quiz_round_begin(me,'life','life',null,p_duration_seconds,p_expected_week,p_notice_version,p_request_id,p_session_secret,null,p_chapter);
end $$;

-- 11. Next, answer, End and skip --------------------------------------------------------------------------------------
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
      active := public.quiz_question_dto(it.question_id); item := public.quiz_active_item(a.id);
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
  -- Life: switch, opt-in and eligibility are re-checked at every Next; the draw itself re-reads the open chapters.
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
    || jsonb_build_object('server_now',at,'active_question',public.quiz_question_dto(qid),'active_item',public.quiz_active_item(a.id));
end $$;

create or replace function public.quiz_answer(p_attempt_id uuid,p_option integer,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype;
  a public.sport_quiz_attempts%rowtype; q public.sport_quiz_questions%rowtype; it public.sport_quiz_round_items%rowtype; outcome text;
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
    -- Trivia Explorer is derived per week in quiz_sync_badges (several rounds can share a week now).
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
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,reason,created_at)
    values(me,'answer',case when a.round_kind = 'life' then null else q.id end,a.id,case when a.round_kind = 'life' then q.chapter || ' #' || a.position end,at);
  return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,outcome,at);
end $$;

-- End takes the kind: a pending unknown Start is cancelled against that kind's guard only; an attempt must match it.
drop function if exists public.quiz_end(uuid,uuid,date,text,uuid,uuid);
create or replace function public.quiz_end(p_attempt_id uuid,p_start_request_id uuid,p_expected_week date,p_reason text,p_request_id uuid,p_expected_profile_id uuid,p_round_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype;
  source public.sport_quiz_requests%rowtype; a public.sport_quiz_attempts%rowtype; outcome text; w date;
begin
  if (p_attempt_id is null) = (p_start_request_id is null) or p_request_id is null or p_request_id = p_start_request_id
    or coalesce(p_reason,'') not in ('user_end','left_page','background','identity_change') or coalesce(p_round_kind,'') not in ('personal','group','life') then raise exception 'quiz_end_invalid'; end if;
  if p_round_kind <> 'life' and not public.quiz_trivia_band(me) then raise exception 'quiz_ineligible'; end if;
  perform public.quiz_lock(me); at := clock_timestamp(); w := public.quiz_week_at(at);
  d := public.quiz_digest(jsonb_build_array(p_attempt_id,p_start_request_id,p_expected_week,p_reason,p_round_kind));
  select * into r from public.sport_quiz_requests where profile_id = me and request_id = p_request_id;
  if found then if r.operation <> 'end' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict'; end if; return public.quiz_receipt_dto(me,p_request_id,at); end if;
  if p_expected_week is null or p_expected_week > w then raise exception 'quiz_week_changed'; end if;
  if p_start_request_id is not null then
    select * into source from public.sport_quiz_requests where profile_id = me and request_id = p_start_request_id;
    if found and (source.operation <> 'start' or source.week_start <> p_expected_week or source.round_kind <> p_round_kind) then raise exception 'quiz_request_conflict'; end if;
    if source.request_id is null then
      if p_expected_week <> w then raise exception 'quiz_round_closed'; end if;
      if exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = w and round_kind = p_round_kind) then raise exception 'quiz_round_closed'; end if;
      -- A client-chosen kind the caller could not start writes nothing (review fix P3): enrolled, plus Life access or
      -- an active group membership with groups on.
      if not exists(select 1 from public.sport_quiz_settings s where s.singleton and s.enabled and me = any(s.pilot_accounts)
           and (p_round_kind <> 'group' or s.groups_enabled))
         or (p_round_kind = 'life' and not public.quiz_life_access(me))
         or (p_round_kind = 'group' and not exists(select 1 from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id
           where m.profile_id = me and m.status = 'active' and g.status = 'active')) then raise exception 'quiz_round_closed'; end if;
      perform public.quiz_spend(me,w,at,p_round_kind);
      perform public.quiz_bump_history(me);
      perform public.quiz_save_receipt(me,p_start_request_id,'start',w,null,null,'cancelled',at,p_round_kind);
      return public.quiz_save_receipt(me,p_request_id,'end',w,d,null,'cancelled',at,p_round_kind);
    end if;
    p_attempt_id := source.attempt_id;
    if p_attempt_id is null then return public.quiz_save_receipt(me,p_request_id,'end',p_expected_week,d,null,'cancelled',at,p_round_kind); end if;
  end if;
  select * into a from public.sport_quiz_attempts where id = p_attempt_id and profile_id = me and week_start = p_expected_week for update;
  if a.id is null then raise exception 'quiz_round_closed'; end if;
  if a.round_kind <> p_round_kind then raise exception 'quiz_end_invalid'; end if;
  at := clock_timestamp();
  if a.mode = 'round' then
    perform public.quiz_round_settle(a.id,at);
    select * into a from public.sport_quiz_attempts where id = a.id for update;
    if a.status = 'issued' then
      outcome := public.quiz_round_close(a.id,at,p_reason);
      insert into public.sport_quiz_audit(actor_id,action,attempt_id,reason,created_at) values(me,'end',a.id,case when a.round_kind = 'life' then 'life' end,at);
    else outcome := a.status; end if;
    return public.quiz_save_receipt(me,p_request_id,'end',a.week_start,d,a.id,outcome,at,p_round_kind);
  end if;
  if a.status = 'issued' then
    outcome := case when a.expires_at <= at then 'expired' else 'ended' end;
    update public.sport_quiz_attempts set status = outcome,closed_at = case when outcome = 'expired' then expires_at else at end,
      close_reason = case when outcome = 'expired' then 'deadline' else p_reason end,session_hash = null where id = a.id;
    perform public.quiz_bump_history(me);
    insert into public.sport_quiz_audit(actor_id,action,attempt_id,created_at) values(me,'end',a.id,at);
  else outcome := a.status; end if;
  return public.quiz_save_receipt(me,p_request_id,'end',a.week_start,d,a.id,outcome,at,p_round_kind);
end $$;

-- QUIZ-02 skip spends only the personal opportunity.
create or replace function public.quiz_skip(p_expected_week date,p_request_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype; a public.sport_quiz_attempts%rowtype;
begin
  if p_request_id is null then raise exception 'quiz_request_invalid'; end if; perform public.quiz_lock(me); at := clock_timestamp();
  if p_expected_week is distinct from public.quiz_week_at(at) then raise exception 'quiz_week_changed'; end if;
  d := public.quiz_digest(jsonb_build_array(p_expected_week)); select * into r from public.sport_quiz_requests where profile_id = me and request_id = p_request_id;
  if found then if r.operation <> 'skip' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict'; end if; return public.quiz_receipt_dto(me,p_request_id,at); end if;
  perform public.quiz_require_testing(me);
  select * into a from public.sport_quiz_attempts where profile_id = me and week_start = p_expected_week and round_kind = 'personal' for update;
  if exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = p_expected_week and round_kind = 'personal') then
    return public.quiz_save_receipt(me,p_request_id,'skip',p_expected_week,d,a.id,'week_spent',at,'personal');
  end if;
  perform public.quiz_spend(me,p_expected_week,at,'personal');
  insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,closed_at,close_reason,round_kind)
    values(me,p_expected_week,'skipped',at,'timed',at,'skip','personal') returning * into a;
  perform public.quiz_bump_history(me);
  insert into public.sport_quiz_audit(actor_id,action,attempt_id,created_at) values(me,'skip',a.id,at);
  return public.quiz_save_receipt(me,p_request_id,'skip',p_expected_week,d,a.id,'skipped',at,'personal');
end $$;

-- 12. Own reads that Life players (including 13+ accounts without a recorded age) also need ---------------------------
create or replace function public.quiz_receipt(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_life_actor(); result jsonb;
begin
  result := public.quiz_receipt_dto(me,p_request_id,statement_timestamp());
  if result is null then raise exception 'quiz_receipt_unavailable'; end if; return result;
end $$;

create or replace function public.quiz_history(p_before text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_life_actor(); at timestamptz := statement_timestamp(); c jsonb := public.quiz_cursor(p_before,'history'); items jsonb; next_before text;
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
declare me uuid := public.quiz_life_actor();
begin
  return jsonb_build_object('contract_version',3,'profile_id',me,
    'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'label',b.label,'kind',b.kind,'sport',b.sport,'period',b.period,
      'visibility',b.visibility,'issued_at',b.issued_at) order by b.issued_at desc,b.id) from public.sport_quiz_badges b where b.profile_id = me and b.voided_at is null),'[]'::jsonb));
end $$;

-- Life badges stay private: they cannot be opted in to group pages.
create or replace function public.quiz_badge_visibility(p_badge_id uuid,p_visibility text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_profile_id); b public.sport_quiz_badges%rowtype;
begin
  if p_badge_id is null or coalesce(p_visibility,'') not in ('private','groups') then raise exception 'quiz_badge_invalid'; end if;
  perform public.quiz_lock(me);
  update public.sport_quiz_badges set visibility = p_visibility where id = p_badge_id and profile_id = me and voided_at is null and kind <> 'life' returning * into b;
  if b.id is null then raise exception 'quiz_badge_missing'; end if;
  return jsonb_build_object('contract_version',3,'id',b.id,'label',b.label,'kind',b.kind,'sport',b.sport,'period',b.period,'visibility',b.visibility,'issued_at',b.issued_at);
end $$;

-- 13. Badges and levels --------------------------------------------------------------------------------------------------
-- Derived from live rows on every answer, join and correction. Trivia Explorer is one per week and points at the
-- week's earliest qualifying round; a void moves it to another qualifying round of that week before withdrawing it.
-- Levels and Life chapter badges only go up (quiz_guard_level); a void never lowers them.
create or replace function public.quiz_sync_badges(p_me uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare earned text[]; seasons text[]; w date := public.quiz_week_at(p_at); th jsonb; rk integer; ch record;
begin
  update public.sport_quiz_badges b set attempt_id = x.id,week_start = x.week_start,voided_at = null
    from (select distinct on (a.week_start) a.week_start,a.id from public.sport_quiz_attempts a where a.profile_id = p_me and public.quiz_attempt_qualifies(a.id)
          order by a.week_start,a.issued_at,a.id) x
    where b.profile_id = p_me and b.label = 'Trivia Explorer' and b.period = x.week_start::text
      and (b.voided_at is not null or b.attempt_id is null or not public.quiz_attempt_qualifies(b.attempt_id));
  insert into public.sport_quiz_badges(profile_id,attempt_id,week_start,label,kind,period,issued_at)
    select p_me,x.id,x.week_start,'Trivia Explorer','weekly',x.week_start::text,p_at
    from (select distinct on (a.week_start) a.week_start,a.id from public.sport_quiz_attempts a where a.profile_id = p_me and public.quiz_attempt_qualifies(a.id)
          order by a.week_start,a.issued_at,a.id) x
    on conflict (profile_id,label,period) do nothing;
  update public.sport_quiz_badges set voided_at = p_at where profile_id = p_me and label = 'Trivia Explorer' and voided_at is null
    and (attempt_id is null or not public.quiz_attempt_qualifies(attempt_id));
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
  -- quiz_played counts group rounds only (§7.3).
  if public.quiz_played(p_me,w) and exists(select 1 from public.sport_quiz_group_members m join public.sport_quiz_groups g on g.id = m.group_id
      where m.profile_id = p_me and m.status = 'active' and g.status = 'active') then
    insert into public.sport_quiz_badges(profile_id,label,kind,period,issued_at) values(p_me,'Family Challenger','family',w::text,p_at)
      on conflict (profile_id,label,period) do update set voided_at = null where public.sport_quiz_badges.voided_at is not null;
  end if;
  update public.sport_quiz_badges set voided_at = p_at where profile_id = p_me and kind = 'family' and voided_at is null
    and not public.quiz_played(p_me,period::date);
  -- Personal level: facts learned across every round kind, never correctness or speed.
  th := coalesce((select level_thresholds from public.sport_quiz_settings where singleton),'{"rookie":0,"varsity":15,"all_star":40,"pro":80,"hall_of_fame":150}'::jsonb);
  rk := public.quiz_level_rank(public.quiz_facts(p_me,date '1900-01-01',date '9999-01-01'),th);
  insert into public.sport_quiz_levels(profile_id,track,level,rank,reached_at) values(p_me,'overall',(public.quiz_level_keys())[rk + 1],rk,p_at)
    on conflict (profile_id,track) do update set level = excluded.level,rank = excluded.rank,reached_at = excluded.reached_at
      where public.sport_quiz_levels.rank < excluded.rank;
  for ch in select c.id,(select count(*)::integer from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
      join public.sport_quiz_questions q on q.id = i.question_id where a.profile_id = p_me and i.status = 'answered' and q.topic_category = 'life' and q.chapter = c.id) n
      from public.sport_quiz_life_chapters c order by c.position loop
    rk := public.quiz_level_rank(ch.n,th);
    if rk > 0 then
      insert into public.sport_quiz_levels(profile_id,track,level,rank,reached_at) values(p_me,ch.id,(public.quiz_level_keys())[rk + 1],rk,p_at)
        on conflict (profile_id,track) do update set level = excluded.level,rank = excluded.rank,reached_at = excluded.reached_at
          where public.sport_quiz_levels.rank < excluded.rank;
    end if;
  end loop;
  insert into public.sport_quiz_badges(profile_id,label,kind,period,visibility,issued_at)
    select p_me,c.title || ' Playbook','life','lifetime','private',p_at from public.sport_quiz_levels l join public.sport_quiz_life_chapters c on c.id = l.track
    where l.profile_id = p_me and l.rank >= 1
    on conflict (profile_id,label,period) do nothing;
end $$;

-- Group page: fact totals count group rounds only (Life never appears on group pages or totals).
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
                  where b.profile_id = m.profile_id and b.visibility = 'groups' and b.kind <> 'life' and b.voided_at is null)) order by m.joined_at,m.profile_id) from mem m),'[]'::jsonb),
    'totals',jsonb_build_object('members',(select count(*) from mem),'played_this_week',(select count(*) from mem where played),
      'facts_this_week',case when (select ok from shown) then (select (coalesce(sum(public.quiz_group_facts(m.profile_id,(select w from w),(select w from w) + 7)),0) / 5) * 5 from mem m) end,
      'facts_this_season',case when (select ok from shown) then (select (coalesce(sum(public.quiz_group_facts(m.profile_id,(select qs from w),((select qs from w) + interval '3 months')::date)),0) / 5) * 5 from mem m) end),
    'everyone_played',(select count(*) > 0 and bool_and(played) from mem),
    'code_active',exists(select 1 from public.sport_quiz_group_codes c where c.group_id = g.id and c.expires_at > p_at),
    'code_expires_at',case when g.owner_id = p_me then (select c.expires_at from public.sport_quiz_group_codes c where c.group_id = g.id and c.expires_at > p_at) end,
    'can_invite',g.owner_id = p_me and g.status = 'active' and (select count(*) from mem) < 12)
  from g
$$;

-- 14. Participant snapshot: the trivia snapshot stays QUIZ-02/03 shaped plus per-kind rounds; Life has its own reads ---
create or replace function public.quiz_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id(); at timestamptz := statement_timestamp(); w date := public.quiz_week_at(at);
  s public.sport_quiz_settings%rowtype; pref jsonb; available text; pools jsonb := '[]'; aid uuid; scheduled text; active_kind text;
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
      from public.sport_quiz_questions q where q.status = 'approved' and q.topic_category in ('sport','science','geography','general') and q.question_type <> 'image_choice'
        and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes)) >= 10 group by q.topic_category,q.sport) x;
    if not exists(select 1 from jsonb_array_elements(pools) p where (p ->> 'unseen_count')::int > 0 and (p ->> 'allowed')::boolean) then available := 'unavailable'; end if;
  end if;
  if me is not null and s.singleton is not null then
    -- The open round (any kind) comes first so a client resumes it; otherwise this week's personal attempt.
    select id,round_kind into aid,active_kind from public.sport_quiz_attempts a where a.profile_id = me and a.status = 'issued' and public.quiz_summary(a.id,at) ->> 'status' = 'issued'
      order by a.issued_at desc limit 1;
    if aid is null then select id into aid from public.sport_quiz_attempts where profile_id = me and week_start = w and round_kind = 'personal'; end if;
  end if;
  return jsonb_build_object('contract_version',2,'profile_id',me,'server_now',at,'week_start',w,'week_end',w + 7,'testing_only',true,
    'availability',available,'preferences',pref,'attempt',public.quiz_summary(aid,at),
    'week_spent',me is not null and exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = w and round_kind = 'personal'),
    'week_spent_by_kind',jsonb_build_object(
      'personal',me is not null and exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = w and round_kind = 'personal'),
      'group',me is not null and exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = w and round_kind = 'group'),
      'life',me is not null and exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = w and round_kind = 'life')),
    'active_round_kind',active_kind,
    'scheduled_topic',scheduled,'pools',pools,'history_version',(pref ->> 'history_version')::bigint,
    'history_count',(select count(*) from public.sport_quiz_attempts a where a.profile_id = me and public.quiz_summary(a.id,at) ->> 'status' <> 'issued'),
    'badge_count',(select count(*) from public.sport_quiz_badges where profile_id = me and voided_at is null),
    'correction_count',(select count(*) from public.sport_quiz_attempts where profile_id = me and status = 'void')
      + (select count(*) from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id where a.profile_id = me and i.status = 'void' and a.status <> 'void'),
    'round_size',coalesce(s.round_size,5),'groups_available',coalesce(s.groups_enabled,false) and available = 'ready');
end $$;

-- 15. Erasure covers Life: attempts, items, exposures, badges, levels. All three weekly opportunities are spent.
create or replace function public.quiz_erase_history(p_expected_history_version bigint,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id); at timestamptz; w date; rev bigint; na bigint; ne bigint; nb bigint; nr bigint; nau bigint;
  prune timestamptz; gid uuid; owner uuid; ng bigint := 0; nj bigint; ns bigint := 0; n bigint; nl bigint;
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
  perform set_config('quiz.erase_profile',me::text,true);
  delete from public.sport_quiz_audit where actor_id = me and action in ('start','answer','skip','end'); get diagnostics nau = row_count;
  delete from public.sport_quiz_levels where profile_id = me; get diagnostics nl = row_count;
  perform set_config('quiz.erase_profile','',true);
  delete from public.sport_quiz_attempts where profile_id = me;
  update public.sport_quiz_preferences set history_version = history_version + 1,updated_at = at where profile_id = me;
  return jsonb_build_object('contract_version',2,'profile_id',me,'history_version',rev + 1,'week_start',w,'week_spent',true,'quota_prune_after',prune,
    'removed_attempts',na,'removed_exposures',ne,'removed_badges',nb,'removed_requests',nr,'removed_audit',nau,
    'removed_group_memberships',ng,'retained_join_attempts',nj,'removed_group_sets',ns,'removed_levels',nl);
end $$;

-- 16. Life participant reads and the private opt-in -----------------------------------------------------------------------
create or replace function public.quiz_life_preferences_dto(p_me uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('life_opt_in',coalesce(p.life_opt_in,false),'life_notice_version',p.life_notice_version,'life_opted_in_at',p.life_opted_in_at,
    'life_version',coalesce(p.life_version,0))
  from (select 1) one left join public.sport_quiz_preferences p on p.profile_id = p_me
$$;

-- Availability: ineligible | unavailable | paused | not_enrolled | off (trivia.life) | not_opted_in | empty | ready.
create or replace function public.quiz_life_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id(); at timestamptz := statement_timestamp(); w date := public.quiz_week_at(at);
  s public.sport_quiz_settings%rowtype; available text; aid uuid; active_kind text; nopen integer := 0; unseen integer := 0;
begin
  select * into s from public.sport_quiz_settings where singleton;
  if auth.uid() is null or me is null or not public.quiz_life_band_ok(public.profile_age_band(me)) then me := null; available := 'ineligible';
  elsif s.singleton is null then available := 'unavailable';
  elsif not s.enabled then available := 'paused';
  elsif not (me = any(s.pilot_accounts)) then available := 'not_enrolled';
  elsif not s.life_enabled then available := 'off';
  else available := 'ready'; end if;
  if me is not null then
    select id into aid from public.sport_quiz_attempts where profile_id = me and week_start = w and round_kind = 'life';
    select round_kind into active_kind from public.sport_quiz_attempts a where a.profile_id = me and a.status = 'issued' and public.quiz_summary(a.id,at) ->> 'status' = 'issued'
      order by a.issued_at desc limit 1;
  end if;
  if available = 'ready' then
    select count(*) into nopen from public.sport_quiz_life_chapters c where public.quiz_life_chapter_open(c.id);
    unseen := public.quiz_life_unseen_count(me,null);
    if not coalesce((public.quiz_life_preferences_dto(me) ->> 'life_opt_in')::boolean,false) then available := 'not_opted_in';
    elsif unseen = 0 then available := 'empty'; end if;
  end if;
  return jsonb_build_object('contract_version',4,'profile_id',me,'server_now',at,'week_start',w,'week_end',w + 7,'testing_only',true,
    'availability',available,'notice_version','life-playbook-v1-testing','preferences',case when me is null then null else public.quiz_life_preferences_dto(me) end,
    'week_spent',me is not null and exists(select 1 from public.sport_quiz_week_guards where profile_id = me and week_start = w and round_kind = 'life'),
    'attempt',public.quiz_summary(aid,at),'active_round_kind',active_kind,'default_duration_seconds',90,'round_size',coalesce(s.round_size,5),
    'chapters_open',nopen,'unseen_count',unseen);
end $$;

create or replace function public.quiz_life_chapters()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_life_actor();
begin
  return jsonb_build_object('contract_version',4,'profile_id',me,
    -- Participant fields only: no draft counts or refusal reasons (those stay in the admin read).
    'chapters',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'framing',c.framing,'position',c.position,
      'open',public.quiz_life_chapter_open(c.id),'unseen_count',public.quiz_life_unseen_count(me,c.id)) order by c.position)
      from public.sport_quiz_life_chapters c),'[]'::jsonb));
end $$;

-- Own chapter progress: share of the chapter's approved questions seen, facts and the highest chapter level reached.
create or replace function public.quiz_life_progress()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_life_actor();
  th jsonb := (select level_thresholds from public.sport_quiz_settings where singleton);
begin
  return jsonb_build_object('contract_version',4,'profile_id',me,'thresholds',th,
    'chapters',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'approved_count',x.approved,'seen_count',x.seen,
        'progress',case when x.approved = 0 then 0 else round(least(x.seen::numeric / x.approved,1),2) end,'facts',x.facts,
        'rank',x.rk,'level',(public.quiz_level_keys())[x.rk + 1],'level_label',public.quiz_level_label(x.rk),'badge_earned',x.rk >= 1) order by x.position)
      from (select c.id,c.title,c.position,
          public.quiz_life_approved_count(c.id) approved,
          (select count(*)::integer from public.sport_quiz_exposures e join public.sport_quiz_questions q on q.question_key = e.question_key and q.status = 'approved'
             and q.topic_category = 'life' and q.chapter = c.id where e.profile_id = me) seen,
          f.n facts,
          greatest(coalesce((select l.rank from public.sport_quiz_levels l where l.profile_id = me and l.track = c.id),0),public.quiz_level_rank(f.n,th)) rk
        from public.sport_quiz_life_chapters c
        cross join lateral (select count(*)::integer n from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
          join public.sport_quiz_questions q on q.id = i.question_id where a.profile_id = me and i.status = 'answered' and q.topic_category = 'life' and q.chapter = c.id) f) x),'[]'::jsonb));
end $$;

-- Own personal level: the highest of the stored level and the level the current facts reach.
create or replace function public.quiz_level()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_life_actor(); th jsonb := (select level_thresholds from public.sport_quiz_settings where singleton);
  facts integer := public.quiz_facts(me,date '1900-01-01',date '9999-01-01'); stored public.sport_quiz_levels%rowtype; rk integer;
begin
  select * into stored from public.sport_quiz_levels where profile_id = me and track = 'overall';
  rk := greatest(coalesce(stored.rank,0),public.quiz_level_rank(facts,th));
  return jsonb_build_object('contract_version',4,'profile_id',me,'facts',facts,'rank',rk,'level',(public.quiz_level_keys())[rk + 1],'level_label',public.quiz_level_label(rk),
    'next_level',(public.quiz_level_keys())[rk + 2],'next_at',(th ->> (public.quiz_level_keys())[rk + 2])::integer,'thresholds',th,'reached_at',stored.reached_at);
end $$;

-- Private opt-in with its own CAS version. Opting out closes an open Life round. Not audited (it is private).
create or replace function public.quiz_life_preferences(p_opt_in boolean,p_notice_version text,p_expected_version bigint,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_life_expected_actor(p_expected_profile_id); at timestamptz; p public.sport_quiz_preferences%rowtype; rid uuid;
begin
  if p_opt_in is null or p_expected_version is null or (p_opt_in and p_notice_version is distinct from 'life-playbook-v1-testing')
    or (p_notice_version is not null and p_notice_version <> 'life-playbook-v1-testing') then raise exception 'quiz_preferences_invalid'; end if;
  perform public.quiz_lock(me); at := clock_timestamp();
  insert into public.sport_quiz_preferences(profile_id) values(me) on conflict do nothing;
  select * into p from public.sport_quiz_preferences where profile_id = me for update;
  if p.life_opt_in = p_opt_in and (not p_opt_in or p.life_notice_version is not distinct from p_notice_version) then
    return jsonb_build_object('contract_version',4,'profile_id',me,'outcome','unchanged','preferences',public.quiz_life_preferences_dto(me));
  end if;
  if p.life_version is distinct from p_expected_version then raise exception 'quiz_preferences_stale'; end if;
  update public.sport_quiz_preferences set life_opt_in = p_opt_in,life_notice_version = case when p_opt_in then p_notice_version else life_notice_version end,
    life_opted_in_at = case when p_opt_in then at else null end,life_version = life_version + 1,updated_at = at where profile_id = me;
  if not p_opt_in then
    for rid in select id from public.sport_quiz_attempts where profile_id = me and round_kind = 'life' and status = 'issued' loop
      perform public.quiz_round_settle(rid,at); perform public.quiz_round_close(rid,at,'access_revoked');
    end loop;
  end if;
  return jsonb_build_object('contract_version',4,'profile_id',me,'outcome','saved','preferences',public.quiz_life_preferences_dto(me));
end $$;

-- 17. Admin: questions (Life fields and cap; one-admin approval like sports trivia) ----------------------------------------
-- edit_replace (control tower, 2026-10-15): the review queue's Edit in one transaction under the same locks (settings,
-- then the replaced row). It refuses unless the replaced row is still a draft, archives it, then runs the create / edit
-- path (family, content, Life fields, caps, the question guard). A Life replacement must also pass what approval would
-- check (the education-only attestation and the copy rules), tested on the stored row after the archive and insert, so
-- any refusal rolls back both. Two audit rows, in the existing vocabulary: question_edit (new version) and
-- question_archive (replaced draft), both with the reason. The cap counts after the archive: a replacement never grows
-- the bank.
create or replace function public.quiz_admin_question(p_id uuid,p_action text,p_payload jsonb,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); q public.sport_quiz_questions%rowtype; nextq public.sport_quiz_questions%rowtype;
  why text := btrim(p_payload ->> 'reason'); family uuid; at timestamptz; affected uuid; qtype text; opts jsonb; ritem record;
  life boolean; fam_life boolean; ch public.sport_quiz_life_chapters%rowtype; sport_text text; problems text[];
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
  if p_action = 'edit_replace' then
    if q.status <> 'draft' then raise exception 'quiz_replace_draft_only'; end if;
    update public.sport_quiz_questions set status = 'archived',reason = why,reviewed_at = at,reviewed_by = me where id = q.id;
  end if;
  if p_action in ('create','edit','edit_replace') then
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
    life := coalesce(p_payload ->> 'topic_category','') = 'life';
    -- A family stays Life or stays trivia across versions.
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
      if exists(select 1 from unnest(array['chapter','min_age_band','education_only']) k where p_payload ? k) then
        raise exception 'quiz_life_fields_invalid'; end if;
      sport_text := btrim(p_payload ->> 'sport');
    end if;
    if qtype = 'image_choice' then
      if exists(select 1 from unnest(array['media_path','media_licence','media_source','media_attribution','media_alt_text']) k where jsonb_typeof(p_payload -> k) is distinct from 'string')
        or jsonb_typeof(p_payload -> 'media_size_bytes') is distinct from 'number' or (p_payload ->> 'media_size_bytes') !~ '^[0-9]{1,6}$'
        or (p_payload ->> 'media_size_bytes')::int not between 1 and 307200 or p_payload -> 'media_has_person' is distinct from 'false'::jsonb
        or p_payload -> 'media_no_marks' is distinct from 'true'::jsonb or p_payload -> 'media_exif_stripped' is distinct from 'true'::jsonb then raise exception 'quiz_media_invalid'; end if;
    elsif exists(select 1 from jsonb_object_keys(p_payload) k where k like 'media\_%') then raise exception 'quiz_media_invalid'; end if;
    update public.sport_quiz_questions set status = 'archived',reason = why where question_key = family and status = 'approved';
    -- Separate caps: trivia 300 and Life 200, each counting only versions still in play (draft or approved).
    if life and (select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'life') >= 200 then raise exception 'quiz_life_bank_full'; end if;
    if not life and (select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category <> 'life') >= 300 then raise exception 'quiz_bank_full'; end if;
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
    update public.sport_quiz_questions set status = case p_action when 'approve' then 'approved' when 'archive' then 'archived' else 'void' end,
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

-- Life participant audit rows (start / answer / end / skip of a Life round) never appear row by row in any admin feed:
-- they carry a reason (chapter and position, or 'life') or point at a Life round.
create or replace function public.quiz_audit_is_life(p_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_audit u where u.id = p_id and u.action in ('start','answer','end','skip')
    and (u.reason is not null or exists(select 1 from public.sport_quiz_attempts a where a.id = u.attempt_id and a.round_kind = 'life')))
$$;
-- 18. Admin snapshot: trivia cap and every participant count exclude Life (Life numbers live, thresholded, in the Life desk)
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
    'actor_id',case when x.action in ('settings','retention','life_settings','life_chapter') or x.action like 'question_%' then x.actor_id else null end,
    'question_id',case when x.action like 'question_%' then x.question_id else null end,'reason',x.reason,'created_at',x.created_at) order by x.id desc),'[]') into audit
    from (select * from public.sport_quiz_audit u where (p_audit_before is null or u.id < p_audit_before) and not public.quiz_audit_is_life(u.id) order by u.id desc limit 50) x;
  if jsonb_array_length(audit) = 50 and exists(select 1 from public.sport_quiz_audit u where u.id < (audit -> 49 ->> 'id')::bigint and not public.quiz_audit_is_life(u.id)) then nexta := audit -> 49 ->> 'id'; end if;
  select jsonb_build_object(
    'week_issued',count(*) filter (where s ->> 'status' = 'issued'),'week_completed',count(*) filter (where s ->> 'status' = 'completed'),
    'week_skipped',count(*) filter (where s ->> 'status' = 'skipped'),'week_void',count(*) filter (where s ->> 'status' = 'void'),
    'week_ended',count(*) filter (where s ->> 'status' = 'ended'),'week_expired',count(*) filter (where s ->> 'status' = 'expired'),
    'week_rounds_short',count(*) filter (where (s ->> 'short_round')::boolean),'week_rounds_group',count(*) filter (where s ->> 'round_kind' = 'group'),
    'week_rounds_personal',count(*) filter (where s ->> 'round_kind' = 'personal' and s ->> 'status' <> 'skipped'))
    into wk from (select public.quiz_summary(a.id,at) s from public.sport_quiz_attempts a where a.week_start = w and a.round_kind <> 'life') x;
  return jsonb_build_object('contract_version',2,'generated_at',at,'week_start',w,'week_end',w + 7,
    'settings',(select (to_jsonb(s) - 'singleton') || jsonb_build_object('contract_version',2) from public.sport_quiz_settings s where singleton),
    'questions',bank,'question_total',(select count(*) from public.sport_quiz_questions),
    'active_total',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category <> 'life'),
    'life_active_total',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'life'),'life_cap',200,
    'question_cap',300,'next_question_cursor',nextq,'audit',audit,'next_before',nexta,
    'pools',(select coalesce(jsonb_agg(to_jsonb(x) order by topic_category,sport),'[]') from (select topic_category,sport,count(*) approved_count from public.sport_quiz_questions
      where status = 'approved' and topic_category <> 'life' and question_type <> 'image_choice' and public.quiz_normalize_options(options) is not null and char_length(btrim(source_notes)) >= 10 group by topic_category,sport) x),
    'forecast',public.quiz_admin_forecast(at),
    -- Review-queue counts (control tower, 2026-10-15): draft and approved versions in the whole bank by topic, by sport
    -- (sports topic) and by Life chapter (every chapter, zeros included), so the desk never counts only loaded pages.
    -- Content counts only: question versions by status. No participant, answer, exposure or account information, so
    -- no privacy threshold applies.
    'bank_counts',jsonb_build_object(
      'topics',(select coalesce(jsonb_agg(jsonb_build_object('topic_category',x.topic_category,'draft_count',x.d,'approved_count',x.a) order by x.topic_category),'[]'::jsonb)
        from (select topic_category,count(*) filter (where status = 'draft') d,count(*) filter (where status = 'approved') a
          from public.sport_quiz_questions where status in ('draft','approved') group by topic_category) x),
      'sports',(select coalesce(jsonb_agg(jsonb_build_object('sport',x.sport,'draft_count',x.d,'approved_count',x.a) order by x.sport),'[]'::jsonb)
        from (select sport,count(*) filter (where status = 'draft') d,count(*) filter (where status = 'approved') a
          from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'sport' group by sport) x),
      'chapters',(select coalesce(jsonb_agg(jsonb_build_object('chapter',c.id,'draft_count',coalesce(x.d,0),'approved_count',coalesce(x.a,0)) order by c.position),'[]'::jsonb)
        from public.sport_quiz_life_chapters c left join (select chapter,count(*) filter (where status = 'draft') d,count(*) filter (where status = 'approved') a
          from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'life' group by chapter) x on x.chapter = c.id)),
    'counts',wk || jsonb_build_object(
      'questions_draft',(select count(*) from public.sport_quiz_questions where status = 'draft'),
      'questions_approved',(select count(*) from public.sport_quiz_questions where status = 'approved'),
      'questions_archived',(select count(*) from public.sport_quiz_questions where status = 'archived'),
      'questions_void',(select count(*) from public.sport_quiz_questions where status = 'void'),
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

-- 19. Admin: Life switch and level thresholds, chapters ----------------------------------------------------------------
create or replace function public.quiz_admin_life_settings(p_payload jsonb,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; s public.sport_quiz_settings%rowtype; rid uuid;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('life_enabled','level_thresholds'))
    or jsonb_typeof(p_payload -> 'life_enabled') is distinct from 'boolean' or not public.quiz_thresholds_ok(p_payload -> 'level_thresholds') then raise exception 'quiz_settings_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  update public.sport_quiz_settings set life_enabled = (p_payload ->> 'life_enabled')::boolean,level_thresholds = p_payload -> 'level_thresholds',
    reason = btrim(p_reason),updated_at = at,updated_by = me where singleton returning * into s;
  -- Switching Life off ends open Life rounds for good, like a pause.
  if not s.life_enabled then
    for rid in select id from public.sport_quiz_attempts where round_kind = 'life' and status = 'issued' order by profile_id,id loop
      perform public.quiz_round_settle(rid,at); perform public.quiz_round_close(rid,at,'paused');
    end loop;
  end if;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'life_settings',btrim(p_reason),at);
  return jsonb_build_object('contract_version',4,'life_enabled',s.life_enabled,'level_thresholds',s.level_thresholds);
end $$;

create or replace function public.quiz_admin_life_chapter(p_chapter text,p_open boolean,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; st jsonb;
begin
  if p_chapter is null or p_open is null or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'quiz_life_chapter_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  perform 1 from public.sport_quiz_life_chapters where id = p_chapter for update; if not found then raise exception 'quiz_life_chapter_invalid'; end if;
  st := public.quiz_life_chapter_state(p_chapter);
  if p_open and not (st ->> 'ready')::boolean then
    raise exception 'quiz_life_chapter_not_ready: %', (select string_agg(r,'; ') from jsonb_array_elements_text(st -> 'reasons') r); end if;
  update public.sport_quiz_life_chapters set open = p_open,updated_at = at,updated_by = me where id = p_chapter;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'life_chapter',p_chapter || (case when p_open then ' opened: ' else ' closed: ' end) || btrim(p_reason),at);
  return jsonb_build_object('contract_version',4,'chapter',p_chapter) || public.quiz_life_chapter_state(p_chapter);
end $$;

-- 20. Admin Life desk read: switch, chapters with reasons and aggregate-only statistics.
-- Privacy (§7.10): per-question numbers only with >= 20 responders; age band x chapter and level cells under 10 are
-- hidden (null); the opt-in count is hidden under 10; nothing names, lists or links a participant.
create or replace function public.quiz_admin_life_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); at timestamptz := statement_timestamp(); s public.sport_quiz_settings%rowtype; n bigint;
begin
  select * into s from public.sport_quiz_settings where singleton;
  select count(*) into n from public.sport_quiz_preferences where life_opt_in;
  return jsonb_build_object('contract_version',4,'generated_at',at,
    'settings',jsonb_build_object('life_enabled',coalesce(s.life_enabled,false),'level_thresholds',s.level_thresholds,'round_size',s.round_size,'enabled',s.enabled),
    'life_cap',200,'life_active_total',(select count(*) from public.sport_quiz_questions where status in ('draft','approved') and topic_category = 'life'),
    'open_at',public.quiz_life_open_at(),
    'chapters',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'framing',c.framing,'position',c.position,'updated_at',c.updated_at,
        'draft_count',(select count(*) from public.sport_quiz_questions q where q.topic_category = 'life' and q.chapter = c.id and q.status = 'draft'))
        || public.quiz_life_chapter_state(c.id) order by c.position),'[]'::jsonb) from public.sport_quiz_life_chapters c),
    'stats',jsonb_build_object(
      'opted_in',case when n >= 10 then n end,
      'week_life_rounds',(select case when count(*) >= 10 then count(*) end from public.sport_quiz_attempts where round_kind = 'life' and week_start = public.quiz_week_at(at)),
      'questions',(select coalesce(jsonb_agg(jsonb_build_object('question_id',x.qid,'chapter',x.chapter,'responders',x.responders,
          'correct_share',round(x.correct::numeric / x.answers,2)) order by x.chapter,x.qid),'[]'::jsonb)
        from (select i.question_id qid,q.chapter,count(distinct a.profile_id) responders,count(*) answers,count(*) filter (where i.answered_option = q.correct_option) correct
          from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id join public.sport_quiz_questions q on q.id = i.question_id
          where q.topic_category = 'life' and i.status = 'answered' group by i.question_id,q.chapter having count(distinct a.profile_id) >= 20) x),
      'questions_hidden',(select count(*) from (select i.question_id from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id
          join public.sport_quiz_questions q on q.id = i.question_id where q.topic_category = 'life' and i.status = 'answered'
          group by i.question_id having count(distinct a.profile_id) < 20) y),
      'cells',(select coalesce(jsonb_agg(jsonb_build_object('age_band',b.band,'chapter',c.id,'players',case when coalesce(z.players,0) >= 10 then z.players end,
          'hidden',coalesce(z.players,0) < 10) order by b.ord,c.position),'[]'::jsonb)
        from (values ('teen_13_15',1),('teen_16_17',2),('adult',3),('no_age',4)) b(band,ord) cross join public.sport_quiz_life_chapters c
        left join (select case when public.profile_age_band(a.profile_id) in ('not_given','unknown') then 'no_age' else public.profile_age_band(a.profile_id) end band,
            q.chapter,count(distinct a.profile_id) players
          from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id = i.attempt_id join public.sport_quiz_questions q on q.id = i.question_id
          where q.topic_category = 'life' and i.status = 'answered' group by 1,2) z on z.band = b.band and z.chapter = c.id),
      'levels',(select coalesce(jsonb_agg(jsonb_build_object('level',k.name,'label',public.quiz_level_label(k.i::integer - 1),
          'players',case when coalesce(l.players,0) >= 10 then l.players end,'hidden',coalesce(l.players,0) < 10) order by k.i),'[]'::jsonb)
        from unnest(public.quiz_level_keys()) with ordinality k(name,i)
        left join (select level,count(*) players from public.sport_quiz_levels where track = 'overall' group by level) l on l.level = k.name)));
end $$;

-- 21. Access: RPC-only, explicit revokes, closed-account policy on every new table ----------------------------------------
-- Also closes a gap from QUIZ-02 (found 2026-10-15 by the staging packet dry run): its tables never received MINOR-01's
-- restrictive "Closed accounts" policy. Every RLS-enabled sport_quiz_* table without it gets it here; RLS state and grants
-- are not changed.
do $$ declare t text; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname like 'sport\_quiz\_%' escape '\'
             and not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'Closed accounts') loop
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))',t);
  end loop;
end $$;
do $$ declare t text; f record; begin
  foreach t in array array['sport_quiz_life_chapters','sport_quiz_levels'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
    execute format('drop policy if exists "Closed accounts" on public.%I',t);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))',t);
  end loop;
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'quiz\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
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
 public.quiz_admin_life_settings(jsonb,text,uuid),public.quiz_admin_life_chapter(text,boolean,text,uuid),public.quiz_admin_life_snapshot() to authenticated;
