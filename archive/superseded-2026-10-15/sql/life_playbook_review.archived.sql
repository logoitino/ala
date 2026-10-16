-- ARCHIVED 2026-10-15 · QUIZ-04 owner simplification · owner approved · excerpt from supabase/migrations/20261014180000_life_playbook.sql (draft, never applied) (tables quiz_life_signoffs, quiz_content_reviewers; functions quiz_life_band_rank, quiz_life_age_cap, quiz_life_source_ok, quiz_life_field_marked, quiz_life_due_on, quiz_life_today, quiz_life_item_current, quiz_life_tax_year_ok, quiz_life_signoff_current, quiz_life_is_author, quiz_life_active_grant, quiz_guard_life_signoff, quiz_guard_reviewer, quiz_admin_life_signoff, quiz_admin_life_signoff_confirm, quiz_life_signoff_dto, quiz_admin_reviewer; Life review columns and the re-review action).
-- Not built, tested or applied. Restore: add the objects back in a new reviewed migration (tables first, then helpers, guards, RPCs and grants) and re-add the client wrappers from archive/superseded-2026-10-15/apps/.
-- Every archived item and its reason: docs/engineering/data-ownership.json → archived.

-- Why: the owner chose normal one-admin trivia approval and simple facts only (LIFE_PLAYBOOK_DESIGN.md §8). The CPA
-- sign-off, named finance / tax reviewers, allow-listed source URLs, retrieval dates, tax years, yearly / January
-- re-review and the 16+ / adult age bands were removed from the migration before it was applied anywhere. The text
-- below is the 2026-10-14 version (copy rules v3 era), kept verbatim for reference.

-- Removed chapter columns and seeds (sport_quiz_life_chapters kept with id, title, framing, open, position, updated_*):
--   min_age_band text not null check (min_age_band in ('13','16')), domain text not null check (domain in ('finance','tax')),
--   needs_signoff boolean not null default false, note text; seeds bank_basics, paycheck_playbook, credit_clock (16+,
--   sign-off), tax_timeout (16+, tax, sign-off), life_needs (16+).

-- Tables --------------------------------------------------------------------------------------------------------------
create table if not exists public.quiz_life_signoffs (
  id bigint generated always as identity primary key,
  chapter text not null references public.sport_quiz_life_chapters(id),
  signed_by_name text not null check (char_length(btrim(signed_by_name)) between 3 and 120),
  signed_on date not null check (signed_on >= date '2000-01-01'),
  note text check (note is null or char_length(note) <= 500),
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now()
);
create index if not exists quiz_life_signoffs_chapter on public.quiz_life_signoffs(chapter, id desc);
-- Review fix (P2): a second admin confirms; the record lists the approved versions it covers and expires.
alter table public.quiz_life_signoffs add column if not exists covers uuid[] not null default '{}';
alter table public.quiz_life_signoffs add column if not exists expires_on date;
alter table public.quiz_life_signoffs add column if not exists confirmed_by uuid references public.profiles(id) on delete set null;
alter table public.quiz_life_signoffs add column if not exists confirmed_at timestamptz;

create table if not exists public.quiz_content_reviewers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  domain text not null check (domain in ('finance','tax')),
  qualification text not null check (char_length(btrim(qualification)) between 3 and 200),
  grant_reason text not null check (char_length(btrim(grant_reason)) between 10 and 500),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoke_reason text check (revoke_reason is null or char_length(btrim(revoke_reason)) between 10 and 500),
  check (expires_at is null or expires_at > granted_at),
  check ((revoked_at is null) = (revoke_reason is null))
);
create unique index if not exists quiz_reviewer_unrevoked on public.quiz_content_reviewers(profile_id, domain) where revoked_at is null;
-- Review fix (P2): a grant is active only after a second admin (not the granter, not the grantee) confirms it.
alter table public.quiz_content_reviewers add column if not exists confirmed_by uuid references public.profiles(id) on delete set null;
alter table public.quiz_content_reviewers add column if not exists confirmed_at timestamptz;

-- Triggers on the removed tables:
drop trigger if exists quiz_life_signoff_guard on public.quiz_life_signoffs;
create trigger quiz_life_signoff_guard before update or delete on public.quiz_life_signoffs for each row execute function public.quiz_guard_life_signoff();
drop trigger if exists quiz_life_signoff_truncate_guard on public.quiz_life_signoffs;
create trigger quiz_life_signoff_truncate_guard before truncate on public.quiz_life_signoffs for each statement execute function public.quiz_guard_life_signoff();
drop trigger if exists quiz_reviewer_guard on public.quiz_content_reviewers;
create trigger quiz_reviewer_guard before update or delete on public.quiz_content_reviewers for each row execute function public.quiz_guard_reviewer();
drop trigger if exists quiz_reviewer_truncate_guard on public.quiz_content_reviewers;
create trigger quiz_reviewer_truncate_guard before truncate on public.quiz_content_reviewers for each statement execute function public.quiz_guard_truncate();

-- Removed Life review columns on sport_quiz_questions ---------------------------------------------------------------
alter table public.sport_quiz_questions add column if not exists domain text check (domain in ('finance','tax'));
alter table public.sport_quiz_questions add column if not exists source_url text check (source_url is null or char_length(source_url) <= 500);
alter table public.sport_quiz_questions add column if not exists source_retrieved_on date;
alter table public.sport_quiz_questions add column if not exists as_of_tax_year integer check (as_of_tax_year between 2000 and 2100);
alter table public.sport_quiz_questions add column if not exists review_due_on date;
alter table public.sport_quiz_questions add column if not exists approved_at timestamptz;
alter table public.sport_quiz_questions add column if not exists life_reviewer_id uuid references public.profiles(id) on delete set null;
alter table public.sport_quiz_questions add column if not exists life_reviewer_grant_id uuid references public.quiz_content_reviewers(id) on delete set null;
alter table public.sport_quiz_questions add column if not exists life_reviewed_at timestamptz;
alter table public.sport_quiz_questions add column if not exists life_rereviewed_by uuid references public.profiles(id) on delete set null;
alter table public.sport_quiz_questions add column if not exists life_rereviewed_at timestamptz;
-- approved_at marks "this version was approved once" (it survives archive/void) for the author-exclusion rule.
update public.sport_quiz_questions set approved_at = coalesce(reviewed_at, created_at) where status = 'approved' and approved_at is null;
update public.sport_quiz_questions q set approved_at = x.at from (select question_id, min(created_at) at from public.sport_quiz_audit
  where action = 'question_approve' and question_id is not null group by question_id) x where q.id = x.question_id and q.approved_at is null;

-- Removed functions ---------------------------------------------------------------------------------------------------
-- Item / chapter bands are '13', '16' or '18' (adult-only item). Profile bands map to the highest band they may see.
create or replace function public.quiz_life_band_rank(p_band text)
returns integer language sql immutable set search_path = '' as $$ select case p_band when '13' then 13 when '16' then 16 when '18' then 18 end $$;

create or replace function public.quiz_life_age_cap(p_profile_band text)
returns integer language sql immutable set search_path = '' as $$
  select case p_profile_band when 'adult' then 18 when 'teen_16_17' then 16 when 'teen_13_15' then 13 when 'not_given' then 13 when 'unknown' then 13 else 0 end
$$;

-- https on a .gov host or one of a small list of nonprofit education hosts (kept in step with scripts/life-bank-sql.mjs).
create or replace function public.quiz_life_source_ok(p_url text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(char_length(p_url) <= 500 and (p_url ~ '^https://([a-z0-9-]+\.)*[a-z0-9-]+\.gov(/\S*)?$'
    or p_url ~ '^https://([a-z0-9-]+\.)*(councilforeconed\.org|jumpstart\.org|ngpf\.org|naic\.org|nefe\.org|smartaboutmoney\.org)(/\S*)?$'),false)
$$;

-- One field is marked when it has no figure, the marker comes before its first figure, or it is exempt (an option under
-- a prompt that opens with the marker).
create or replace function public.quiz_life_field_marked(p_text text,p_exempt boolean)
returns boolean language sql immutable set search_path = '' as $$
  select p_exempt or regexp_instr(m,fig) = 0 or (position(mk in m) > 0 and position(mk in m) < regexp_instr(m,fig))
  from (select public.quiz_life_strip(public.quiz_life_normalize(p_text)) m,public.quiz_life_figure_re() fig,public.quiz_life_copy_rules() ->> 'illustrative_marker' mk) x
$$;

-- Next review date: tax items every January; others 12 months; an item with a figure by 31 January after its year.
create or replace function public.quiz_life_due_on(p_domain text,p_as_of integer,p_from date)
returns date language sql immutable set search_path = '' as $$
  select least(case when p_domain = 'tax' then make_date(extract(year from p_from)::integer + 1,1,31) else (p_from + interval '12 months')::date end,
    case when p_as_of is not null then make_date(p_as_of + 1,1,31) end)
$$;

-- Today (UTC) for the January rule; a replay swaps this one function to move the calendar.
create or replace function public.quiz_life_today()
returns date language sql stable set search_path = '' as $$ select (statement_timestamp() at time zone 'UTC')::date $$;

create or replace function public.quiz_life_item_current(p_as_of integer)
returns boolean language sql stable set search_path = '' as $$
  select p_as_of is null or p_as_of >= extract(year from public.quiz_life_today())::integer
    or (p_as_of = extract(year from public.quiz_life_today())::integer - 1 and extract(month from public.quiz_life_today()) = 1)
$$;

-- An as_of_tax_year must be the previous, current or next tax year (UTC calendar year) at create and approval.
create or replace function public.quiz_life_tax_year_ok(p_as_of integer)
returns boolean language sql stable set search_path = '' as $$
  select p_as_of is null or p_as_of between extract(year from public.quiz_life_today())::integer - 1 and extract(year from public.quiz_life_today())::integer + 1
$$;

-- The current CPA sign-off of a chapter: confirmed by a second admin and not expired (tax: at the January withdrawal
-- after signing; credit: 12 months). Only the approved versions it lists are covered.
create or replace function public.quiz_life_signoff_current(p_chapter text)
returns public.quiz_life_signoffs language sql stable security definer set search_path = '' as $$
  select x.* from public.quiz_life_signoffs x where x.chapter = p_chapter and x.confirmed_at is not null and x.expires_on >= public.quiz_life_today()
  order by x.confirmed_at desc, x.id desc limit 1
$$;

-- An author of any version after the family's last approved version below p_version (inclusive of p_version).
create or replace function public.quiz_life_is_author(p_key uuid,p_version integer,p_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sport_quiz_questions x where x.question_key = p_key and x.version <= p_version and x.created_by = p_profile
    and x.version > coalesce((select max(y.version) from public.sport_quiz_questions y where y.question_key = p_key and y.version < p_version and y.approved_at is not null),0))
$$;

create or replace function public.quiz_life_active_grant(p_profile uuid,p_domain text,p_at timestamptz)
returns uuid language sql stable security definer set search_path = '' as $$
  select g.id from public.quiz_content_reviewers g where g.profile_id = p_profile and g.domain = p_domain and g.revoked_at is null and g.confirmed_at is not null
    and (g.expires_at is null or g.expires_at > p_at) limit 1
$$;

-- Append-only: FK nulling on account deletion only.
create or replace function public.quiz_guard_life_signoff()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 and (to_jsonb(new) - 'recorded_by' - 'confirmed_by') = (to_jsonb(old) - 'recorded_by' - 'confirmed_by')
     and (new.recorded_by is null or new.recorded_by = old.recorded_by) and (new.confirmed_by is null or new.confirmed_by = old.confirmed_by) then return new; end if;
  -- The only edit: one confirmation by a second admin.
  if tg_op = 'UPDATE' and old.confirmed_at is null and new.confirmed_at is not null and new.confirmed_by is not null
     and new.confirmed_by is distinct from old.recorded_by
     and (to_jsonb(new) - 'confirmed_at' - 'confirmed_by') = (to_jsonb(old) - 'confirmed_at' - 'confirmed_by') then return new; end if;
  raise exception 'quiz_life_signoff_immutable';
end $$;

-- A grant is revoked once (never edited or deleted); account deletion cascades or nulls the admin references.
create or replace function public.quiz_guard_reviewer()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'quiz_reviewer_immutable';
  end if;
  if pg_trigger_depth() > 1 and (to_jsonb(new) - 'granted_by' - 'revoked_by' - 'confirmed_by') = (to_jsonb(old) - 'granted_by' - 'revoked_by' - 'confirmed_by') then return new; end if;
  -- One confirmation by a second admin who is neither the granter nor the grantee.
  if old.confirmed_at is null and new.confirmed_at is not null and new.confirmed_by is not null and old.revoked_at is null
     and new.confirmed_by is distinct from old.granted_by and new.confirmed_by is distinct from old.profile_id
     and (to_jsonb(new) - 'confirmed_at' - 'confirmed_by') = (to_jsonb(old) - 'confirmed_at' - 'confirmed_by') then return new; end if;
  if old.revoked_at is null and new.revoked_at is not null and new.revoked_by is not null
     and (to_jsonb(new) - 'revoked_at' - 'revoked_by' - 'revoke_reason') = (to_jsonb(old) - 'revoked_at' - 'revoked_by' - 'revoke_reason') then return new; end if;
  raise exception 'quiz_reviewer_immutable';
end $$;

-- A CPA sign-off is recorded by one admin and confirmed by a second admin who is not the recorder and has written no
-- version in that chapter. signed_on: not in the future, at most 12 months old. It covers the chapter's approved
-- versions at recording; later approvals need a new sign-off. Tax sign-offs expire at the January withdrawal after
-- signing (31 January next year); Credit Clock after 12 months. Hosted has no owner role: admin + audited reason.
create or replace function public.quiz_admin_life_signoff(p_payload jsonb,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; x public.quiz_life_signoffs%rowtype; c public.sport_quiz_life_chapters%rowtype; d date;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('chapter','signed_by_name','signed_on','note'))
    or jsonb_typeof(p_payload -> 'chapter') is distinct from 'string' or jsonb_typeof(p_payload -> 'signed_by_name') is distinct from 'string'
    or char_length(btrim(p_payload ->> 'signed_by_name')) not between 3 and 120
    or coalesce(p_payload ->> 'signed_on','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(jsonb_typeof(p_payload -> 'note'),'null') not in ('string','null') or char_length(coalesce(p_payload ->> 'note','')) > 500 then raise exception 'quiz_life_signoff_invalid'; end if;
  d := (p_payload ->> 'signed_on')::date;
  if d > public.quiz_life_today() or d < (public.quiz_life_today() - interval '12 months')::date then raise exception 'quiz_life_signoff_date_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  select * into c from public.sport_quiz_life_chapters where id = p_payload ->> 'chapter';
  if c.id is null or not c.needs_signoff then raise exception 'quiz_life_signoff_invalid'; end if;
  insert into public.quiz_life_signoffs(chapter,signed_by_name,signed_on,note,recorded_by,recorded_at,expires_on,covers)
    values(c.id,btrim(p_payload ->> 'signed_by_name'),d,nullif(btrim(coalesce(p_payload ->> 'note','')),''),me,at,
      case when c.domain = 'tax' then make_date(extract(year from d)::integer + 1,1,31) else (d + interval '12 months')::date end,
      coalesce((select array_agg(q.id order by q.id) from public.sport_quiz_questions q where q.status = 'approved' and q.topic_category = 'life' and q.chapter = c.id
        and public.quiz_life_item_current(q.as_of_tax_year)),'{}')) returning * into x;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'life_signoff',x.chapter || ' sign-off ' || x.id || ': ' || btrim(p_reason),at);
  return public.quiz_life_signoff_dto(x.id);
end $$;

create or replace function public.quiz_admin_life_signoff_confirm(p_signoff_id bigint,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; x public.quiz_life_signoffs%rowtype;
begin
  if p_signoff_id is null or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'quiz_life_signoff_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  select * into x from public.quiz_life_signoffs where id = p_signoff_id for update;
  if x.id is null or x.confirmed_at is not null or x.expires_on < public.quiz_life_today() then raise exception 'quiz_life_signoff_invalid'; end if;
  if x.recorded_by is not distinct from me then raise exception 'quiz_life_signoff_second_admin'; end if;
  if exists(select 1 from public.sport_quiz_questions q where q.topic_category = 'life' and q.chapter = x.chapter and q.created_by = me) then
    raise exception 'quiz_life_signoff_confirmer_is_author'; end if;
  update public.quiz_life_signoffs set confirmed_by = me,confirmed_at = at where id = x.id;
  insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'life_signoff_confirm',x.chapter || ' sign-off ' || x.id || ': ' || btrim(p_reason),at);
  return public.quiz_life_signoff_dto(x.id);
end $$;

create or replace function public.quiz_life_signoff_dto(p_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('contract_version',4,'id',x.id::text,'chapter',x.chapter,'signed_by_name',x.signed_by_name,'signed_on',x.signed_on,'note',x.note,
    'recorded_by',x.recorded_by,'recorded_at',x.recorded_at,'confirmed_by',x.confirmed_by,'confirmed_at',x.confirmed_at,'expires_on',x.expires_on,
    'covers_count',cardinality(x.covers),'current',x.confirmed_at is not null and x.expires_on >= public.quiz_life_today())
  from public.quiz_life_signoffs x where x.id = p_id
$$;

-- Grant or revoke a named finance / tax reviewer. The grantee is another adult admin; every change is audited.
create or replace function public.quiz_admin_reviewer(p_action text,p_payload jsonb,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_expected_actor(p_expected_actor_id,true); at timestamptz; g public.quiz_content_reviewers%rowtype; target uuid;
begin
  if coalesce(p_action,'') not in ('grant','confirm','revoke') or jsonb_typeof(p_payload) is distinct from 'object' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then
    raise exception 'quiz_reviewer_invalid'; end if;
  perform 1 from public.sport_quiz_settings where singleton for update; if not found then raise exception 'quiz_unavailable'; end if; at := clock_timestamp();
  if p_action = 'grant' then
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('profile_id','domain','qualification','expires_at'))
      or coalesce(p_payload ->> 'profile_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(p_payload ->> 'domain','') not in ('finance','tax') or char_length(btrim(coalesce(p_payload ->> 'qualification',''))) not between 3 and 200
      or coalesce(jsonb_typeof(p_payload -> 'expires_at'),'null') not in ('string','null') then raise exception 'quiz_reviewer_invalid'; end if;
    target := (p_payload ->> 'profile_id')::uuid;
    if target = me then raise exception 'quiz_reviewer_self_grant'; end if;
    if not exists(select 1 from public.profiles p where p.id = target and p.age_blocked_at is null and public.profile_age_band(p.id) = 'adult'
        and (coalesce(p.is_admin,false) or p.role = 'admin' or coalesce(p.roles,array[]::text[]) @> array['admin']::text[])) then raise exception 'quiz_reviewer_not_admin'; end if;
    if (p_payload ->> 'expires_at') is not null and (p_payload ->> 'expires_at')::timestamptz <= at then raise exception 'quiz_reviewer_invalid'; end if;
    select * into g from public.quiz_content_reviewers where profile_id = target and domain = p_payload ->> 'domain' and revoked_at is null for update;
    if g.id is not null and (g.expires_at is null or g.expires_at > at) then raise exception 'quiz_reviewer_exists'; end if;
    if g.id is not null then
      update public.quiz_content_reviewers set revoked_at = at,revoked_by = me,revoke_reason = 'Expired grant replaced by a new grant.' where id = g.id;
    end if;
    insert into public.quiz_content_reviewers(profile_id,domain,qualification,grant_reason,granted_by,granted_at,expires_at)
      values(target,p_payload ->> 'domain',btrim(p_payload ->> 'qualification'),btrim(p_reason),me,at,(p_payload ->> 'expires_at')::timestamptz) returning * into g;
    insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'reviewer_grant',g.domain || ' reviewer ' || g.id || ': ' || btrim(p_reason),at);
  elsif p_action = 'confirm' then
    -- The second admin: not the granter and not the grantee. Only then does the grant approve anything.
    if exists(select 1 from jsonb_object_keys(p_payload) k where k <> 'grant_id')
      or coalesce(p_payload ->> 'grant_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'quiz_reviewer_invalid'; end if;
    select * into g from public.quiz_content_reviewers where id = (p_payload ->> 'grant_id')::uuid for update;
    if g.id is null or g.revoked_at is not null or g.confirmed_at is not null or (g.expires_at is not null and g.expires_at <= at) then raise exception 'quiz_reviewer_missing'; end if;
    if g.granted_by is not distinct from me or g.profile_id = me then raise exception 'quiz_reviewer_second_admin'; end if;
    update public.quiz_content_reviewers set confirmed_by = me,confirmed_at = at where id = g.id returning * into g;
    insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'reviewer_confirm',g.domain || ' reviewer ' || g.id || ': ' || btrim(p_reason),at);
  else
    if exists(select 1 from jsonb_object_keys(p_payload) k where k <> 'grant_id')
      or coalesce(p_payload ->> 'grant_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'quiz_reviewer_invalid'; end if;
    select * into g from public.quiz_content_reviewers where id = (p_payload ->> 'grant_id')::uuid for update;
    if g.id is null or g.revoked_at is not null then raise exception 'quiz_reviewer_missing'; end if;
    update public.quiz_content_reviewers set revoked_at = at,revoked_by = me,revoke_reason = btrim(p_reason) where id = g.id returning * into g;
    insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'reviewer_revoke',g.domain || ' reviewer ' || g.id || ': ' || btrim(p_reason),at);
  end if;
  return jsonb_build_object('contract_version',4,'id',g.id,'profile_id',g.profile_id,'domain',g.domain,'qualification',g.qualification,'granted_by',g.granted_by,
    'granted_at',g.granted_at,'expires_at',g.expires_at,'revoked_at',g.revoked_at,'revoked_by',g.revoked_by,'confirmed_by',g.confirmed_by,'confirmed_at',g.confirmed_at,
    'active',g.revoked_at is null and g.confirmed_at is not null and (g.expires_at is null or g.expires_at > at));
end $$;

-- Removed re-review branch of quiz_admin_question (action 'rereview'):
  elsif p_action = 'rereview' then
    -- Yearly (tax: January) re-check of an approved Life item by a domain reviewer who did not write it.
    if q.topic_category <> 'life' or q.status <> 'approved' then raise exception 'quiz_rereview_invalid'; end if;
    grant_id := public.quiz_life_active_grant(me,q.domain,at);
    if grant_id is null then raise exception 'quiz_life_reviewer_required'; end if;
    if q.created_by is not distinct from me or public.quiz_life_is_author(q.question_key,q.version,me) then raise exception 'quiz_life_reviewer_is_author'; end if;
    -- Re-review re-runs the copy rules and the tax-year window, and records who re-reviewed.
    if not public.quiz_life_tax_year_ok(q.as_of_tax_year) then raise exception 'quiz_life_tax_year_invalid'; end if;
    if cardinality(public.quiz_life_copy_problems(q.prompt,q.options,q.explanation,q.as_of_tax_year,q.chapter,q.min_age_band)) > 0 then
      raise exception 'quiz_life_copy: %', array_to_string(public.quiz_life_copy_problems(q.prompt,q.options,q.explanation,q.as_of_tax_year,q.chapter,q.min_age_band),', '); end if;
    update public.sport_quiz_questions set review_due_on = public.quiz_life_due_on(q.domain,q.as_of_tax_year,(at at time zone 'UTC')::date),
      life_rereviewed_by = me,life_rereviewed_at = at where id = q.id returning * into nextq;

-- Removed grants:
-- grant execute on function public.quiz_admin_life_signoff(jsonb,text,uuid),public.quiz_admin_reviewer(text,jsonb,text,uuid),
--   public.quiz_admin_life_signoff_confirm(bigint,text,uuid) to authenticated;
