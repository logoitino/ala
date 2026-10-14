-- QUIZ-01: optional weekly private sport learning, isolated from money, Aura and Fan Zone votes.
-- Requires MINOR-01 helpers; ordered after FUN-01. Written locally, not applied anywhere.
-- All settings start paused with an empty <=100 canonical-profile tester allowlist. No production mode.
-- Admin facts are draft until reviewed. Edits create new versions; voids invalidate affected completion badges.
-- Rollback: drop the five sport_quiz_* tables and quiz_* functions below; no existing money/media data changes.

create table if not exists public.sport_quiz_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  testing_only boolean not null default true check (testing_only),
  pilot_accounts uuid[] not null default '{}' check (cardinality(pilot_accounts) <= 100),
  reason text not null default 'Paused; local testing only.' check (char_length(reason) between 10 and 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  check (not enabled or cardinality(pilot_accounts) > 0)
);
insert into public.sport_quiz_settings(singleton) values (true) on conflict do nothing;

create table if not exists public.sport_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  question_key uuid not null default gen_random_uuid(),
  version integer not null check (version > 0),
  sport text not null check (char_length(btrim(sport)) between 2 and 80),
  prompt text not null check (char_length(btrim(prompt)) between 10 and 280),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option integer not null check (correct_option between 0 and 3),
  explanation text not null check (char_length(btrim(explanation)) between 10 and 500),
  status text not null default 'draft' check (status in ('draft','approved','archived','void')),
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique(question_key,version)
);

create table if not exists public.sport_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  question_id uuid references public.sport_quiz_questions(id),
  status text not null check (status in ('issued','completed','skipped','void')),
  issued_at timestamptz not null default now(),
  answered_option integer check (answered_option between 0 and 3),
  request_id uuid unique,
  completed_at timestamptz,
  voided_at timestamptz,
  correction_reason text,
  unique(profile_id,week_start),
  check (status <> 'completed' or (question_id is not null and answered_option is not null and request_id is not null and completed_at is not null)),
  check (status <> 'issued' or question_id is not null)
);

create table if not exists public.sport_quiz_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null unique references public.sport_quiz_attempts(id) on delete cascade,
  week_start date not null,
  label text not null default 'Sport Learner' check (label = 'Sport Learner'),
  visibility text not null default 'private' check (visibility = 'private'),
  issued_at timestamptz not null default now(),
  voided_at timestamptz,
  unique(profile_id,week_start)
);

create table if not exists public.sport_quiz_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('settings','question_create','question_edit','question_approve','question_archive','question_void','start','answer','skip')),
  question_id uuid references public.sport_quiz_questions(id),
  attempt_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.quiz_week()
returns date language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'UTC')::date;
$$;

create or replace function public.quiz_actor()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id();
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null or me is null
     or public.profile_age_band(me) not in ('adult','teen_13_15','teen_16_17') then
    raise exception 'quiz_ineligible';
  end if;
  return me;
end;
$$;

create or replace function public.quiz_admin_actor()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_actor();
begin
  if public.current_user_role() is distinct from 'admin' then raise exception 'quiz_admin_only'; end if;
  return me;
end;
$$;

create or replace function public.quiz_require_testing(me uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.sport_quiz_settings%rowtype;
begin
  -- User writes share this lock; admin pause/allowlist/void serializes before any new completion.
  select * into s from public.sport_quiz_settings where singleton for share;
  if not found or s.testing_only is not true then raise exception 'quiz_unavailable'; end if;
  if s.enabled is not true then raise exception 'quiz_paused'; end if;
  if not (me = any(s.pilot_accounts)) then raise exception 'quiz_not_enrolled'; end if;
end;
$$;

create or replace function public.quiz_guard_question()
returns trigger language plpgsql set search_path = '' as $$
declare item jsonb;
begin
  if tg_op = 'UPDATE' and (new.question_key,new.version,new.sport,new.prompt,new.options,new.correct_option,new.explanation,new.created_at)
    is distinct from (old.question_key,old.version,old.sport,old.prompt,old.options,old.correct_option,old.explanation,old.created_at) then
    raise exception 'quiz_immutable: edit creates a new draft version';
  end if;
  if tg_op = 'UPDATE' and old.status = 'void' and new.status <> 'void' then raise exception 'quiz_void_final'; end if;
  for item in select value from jsonb_array_elements(new.options) loop
    if jsonb_typeof(item) <> 'string' or char_length(btrim(item #>> '{}')) not between 1 and 100 then raise exception 'quiz_options_invalid'; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(new.options)) <> 4 then raise exception 'quiz_options_distinct'; end if;
  return new;
end;
$$;
drop trigger if exists quiz_question_guard on public.sport_quiz_questions;
create trigger quiz_question_guard before insert or update on public.sport_quiz_questions for each row execute function public.quiz_guard_question();

create or replace function public.quiz_guard_audit()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Account deletion may null the FK; no audit content may otherwise be rewritten or erased.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 and old.actor_id is not null and new.actor_id is null
    and (to_jsonb(new)-'actor_id') = (to_jsonb(old)-'actor_id') then return new; end if;
  raise exception 'quiz_audit_immutable';
end;
$$;
drop trigger if exists quiz_audit_guard on public.sport_quiz_audit;
create trigger quiz_audit_guard before update or delete on public.sport_quiz_audit for each row execute function public.quiz_guard_audit();
drop trigger if exists quiz_audit_truncate_guard on public.sport_quiz_audit;
create trigger quiz_audit_truncate_guard before truncate on public.sport_quiz_audit for each statement execute function public.quiz_guard_audit();

create or replace function public.quiz_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.my_profile_id();
  s public.sport_quiz_settings%rowtype;
  a public.sport_quiz_attempts%rowtype;
  q public.sport_quiz_questions%rowtype;
  availability text; sports jsonb := '[]'; badges jsonb := '[]'; corrections jsonb := '[]'; attempt jsonb := null;
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'quiz_ineligible'; end if;
  select * into s from public.sport_quiz_settings where singleton;
  availability := case
    when me is null or public.profile_age_band(me) not in ('adult','teen_13_15','teen_16_17') then 'ineligible'
    when s.singleton is null or s.testing_only is not true then 'unavailable'
    when not s.enabled then 'paused'
    when not (me = any(s.pilot_accounts)) then 'not_enrolled'
    else 'ready' end;
  if availability not in ('ineligible','unavailable') then
    select * into a from public.sport_quiz_attempts where profile_id = me and week_start = public.quiz_week();
    if a.id is not null then
      select * into q from public.sport_quiz_questions where id = a.question_id;
      attempt := jsonb_build_object('id',a.id,'week_start',a.week_start,'sport',q.sport,'status',a.status,
        'question',case when q.id is not null and a.status <> 'void' and (availability = 'ready' or a.status = 'completed') then
          jsonb_build_object('id',q.id,'question_key',q.question_key,'version',q.version,'sport',q.sport,'prompt',q.prompt,'options',q.options) else null end,
        'result',case when a.status = 'completed' then jsonb_build_object('option',a.answered_option,'correct_option',q.correct_option,
          'was_correct',a.answered_option = q.correct_option,'explanation',q.explanation,'completed_at',a.completed_at,'request_id',a.request_id) else null end);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'attempt_id',b.attempt_id,'week_start',b.week_start,
      'label',b.label,'visibility',b.visibility,'issued_at',b.issued_at) order by b.week_start desc),'[]') into badges
      from public.sport_quiz_badges b where b.profile_id = me and b.voided_at is null;
    select coalesce(jsonb_agg(jsonb_build_object('attempt_id',x.id,'week_start',x.week_start,'reason',x.correction_reason,'voided_at',x.voided_at) order by x.week_start desc),'[]')
      into corrections from public.sport_quiz_attempts x where x.profile_id = me and x.status = 'void';
  end if;
  if availability = 'ready' then
    select coalesce(jsonb_agg(x.sport order by x.sport),'[]') into sports from (select distinct sport from public.sport_quiz_questions where status = 'approved') x;
    -- An empty approved pool cannot offer a new question. Already-issued versions remain stable and answerable.
    if jsonb_array_length(sports) = 0 and a.id is null then availability := 'unavailable'; end if;
  end if;
  return jsonb_build_object('availability',availability,'testing_only',true,'week_start',public.quiz_week(),'week_end',public.quiz_week()+7,
    'status',case when a.id is not null then a.status when availability = 'ready' then 'available' else 'unavailable' end,
    'sports',sports,'attempt',attempt,'badges',badges,'corrections',corrections);
end;
$$;

create or replace function public.quiz_start(p_sport text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); qid uuid; aid uuid;
begin
  perform public.quiz_require_testing(me);
  -- Serializes start/skip for this canonical profile across sport changes and request retries.
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz:' || me::text,0));
  if exists(select 1 from public.sport_quiz_attempts where profile_id = me and week_start = public.quiz_week()) then return public.quiz_snapshot(); end if;
  select id into qid from public.sport_quiz_questions where status = 'approved' and sport = btrim(p_sport) order by random() limit 1 for share;
  if qid is null then raise exception 'quiz_no_question'; end if;
  insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status) values(me,public.quiz_week(),qid,'issued') returning id into aid;
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id) values(me,'start',qid,aid);
  return public.quiz_snapshot();
end;
$$;

create or replace function public.quiz_answer(p_attempt_id uuid,p_option integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); a public.sport_quiz_attempts%rowtype; q public.sport_quiz_questions%rowtype;
begin
  perform public.quiz_require_testing(me);
  if p_option is null or p_option not between 0 and 3 or p_request_id is null then raise exception 'quiz_answer_invalid'; end if;
  select * into a from public.sport_quiz_attempts where id = p_attempt_id and profile_id = me for update;
  if a.id is null then raise exception 'quiz_attempt_not_owned'; end if;
  if a.week_start <> public.quiz_week() then raise exception 'quiz_week_closed'; end if;
  select * into q from public.sport_quiz_questions where id = a.question_id for share;
  if a.status = 'void' or q.status = 'void' then raise exception 'quiz_question_void'; end if;
  if a.status = 'completed' then
    if a.request_id = p_request_id and a.answered_option = p_option then return public.quiz_snapshot(); end if;
    raise exception 'quiz_answer_already_committed';
  end if;
  if a.status <> 'issued' then raise exception 'quiz_attempt_not_issued'; end if;
  if exists(select 1 from public.sport_quiz_attempts where request_id = p_request_id) then raise exception 'quiz_request_reused'; end if;
  update public.sport_quiz_attempts set status = 'completed',answered_option = p_option,request_id = p_request_id,completed_at = now() where id = a.id;
  insert into public.sport_quiz_badges(profile_id,attempt_id,week_start) values(me,a.id,a.week_start);
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id) values(me,'answer',a.question_id,a.id);
  return public.quiz_snapshot();
end;
$$;

create or replace function public.quiz_skip()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); aid uuid;
begin
  perform public.quiz_require_testing(me);
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz:' || me::text,0));
  insert into public.sport_quiz_attempts(profile_id,week_start,status) values(me,public.quiz_week(),'skipped')
    on conflict(profile_id,week_start) do update set status = 'skipped'
      where sport_quiz_attempts.status = 'issued' returning id into aid;
  if aid is not null then insert into public.sport_quiz_audit(actor_id,action,attempt_id) values(me,'skip',aid); end if;
  return public.quiz_snapshot();
end;
$$;

create or replace function public.quiz_admin_settings(p_payload jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); testers uuid[]; next_enabled boolean;
begin
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean'
     or jsonb_typeof(p_payload->'pilot_accounts') is distinct from 'array' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('enabled','pilot_accounts')) then raise exception 'quiz_settings_invalid'; end if;
  if jsonb_array_length(p_payload->'pilot_accounts') > 100 then raise exception 'quiz_testers_limit'; end if;
  select coalesce(array_agg(x::uuid),'{}'::uuid[]) into testers from jsonb_array_elements_text(p_payload->'pilot_accounts') x;
  next_enabled := (p_payload->>'enabled')::boolean;
  if cardinality(testers) <> (select count(distinct x) from unnest(testers) x) then raise exception 'quiz_testers_duplicate'; end if;
  -- Pause must remain available after a listed tester closes; re-enabling still requires a valid eligible audience.
  if next_enabled and exists(select 1 from unnest(testers) x where not exists(select 1 from public.profiles p where p.id = x and p.age_blocked_at is null
     and public.profile_age_band(p.id) in ('adult','teen_13_15','teen_16_17'))) then raise exception 'quiz_testers_ineligible'; end if;
  if next_enabled and cardinality(testers) = 0 then raise exception 'quiz_testers_required'; end if;
  update public.sport_quiz_settings set enabled = next_enabled, pilot_accounts = testers,reason = btrim(p_reason),updated_at = now(),updated_by = me where singleton;
  insert into public.sport_quiz_audit(actor_id,action,reason) values(me,'settings',btrim(p_reason));
  return jsonb_build_object('enabled',next_enabled,'testing_only',true,'pilot_accounts',testers);
end;
$$;

create or replace function public.quiz_admin_question(p_id uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); q public.sport_quiz_questions%rowtype; nextq public.sport_quiz_questions%rowtype; why text := btrim(p_payload->>'reason');
begin
  if p_action is null or p_action not in ('create','edit','approve','archive','void') or char_length(coalesce(why,'')) not between 10 and 500 then raise exception 'quiz_question_action_invalid'; end if;
  -- All question/config mutations lock settings first, matching user-write lock order.
  perform 1 from public.sport_quiz_settings where singleton for update;
  if p_action <> 'create' then
    select * into q from public.sport_quiz_questions where id = p_id for update;
    if q.id is null then raise exception 'quiz_question_missing'; end if;
  elsif p_id is not null then raise exception 'quiz_create_id_invalid'; end if;
  if p_action in ('create','edit') then
    if (select count(*) from public.sport_quiz_questions) >= 100 then raise exception 'quiz_bank_full'; end if;
    if p_action = 'edit' then
      update public.sport_quiz_questions set status = 'archived',reason = why where question_key = q.question_key and status = 'approved';
    end if;
    insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,created_by)
      values(case when p_action = 'edit' then q.question_key else gen_random_uuid() end,
        case when p_action = 'edit' then (select max(version)+1 from public.sport_quiz_questions where question_key = q.question_key) else 1 end,
        btrim(p_payload->>'sport'),btrim(p_payload->>'prompt'),p_payload->'options',(p_payload->>'correct_option')::integer,btrim(p_payload->>'explanation'),why,me)
      returning * into nextq;
  else
    if q.status = 'void' then raise exception 'quiz_void_final'; end if;
    if p_action = 'approve' and q.status <> 'draft' then raise exception 'quiz_approve_draft_only'; end if;
    if p_action = 'approve' then update public.sport_quiz_questions set status = 'archived',reason = why where question_key = q.question_key and status = 'approved'; end if;
    update public.sport_quiz_questions set status = case p_action when 'approve' then 'approved' when 'archive' then 'archived' else 'void' end,
      reason = why,reviewed_at = now(),reviewed_by = me where id = q.id returning * into nextq;
    if p_action = 'void' then
      update public.sport_quiz_attempts set status = 'void',voided_at = now(),correction_reason = why where question_id = q.id and status in ('issued','completed');
      update public.sport_quiz_badges set voided_at = now() where attempt_id in (select id from public.sport_quiz_attempts where question_id = q.id) and voided_at is null;
    end if;
  end if;
  insert into public.sport_quiz_audit(actor_id,action,question_id,reason) values(me,'question_'||p_action,nextq.id,why);
  return jsonb_build_object('id',nextq.id,'question_key',nextq.question_key,'version',nextq.version,'status',nextq.status);
end;
$$;

create or replace function public.quiz_admin_snapshot(p_before bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); bank jsonb; audit jsonb; next_before text;
begin
  select coalesce(jsonb_agg(to_jsonb(q) order by q.sport,q.question_key,q.version),'[]') into bank from public.sport_quiz_questions q;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id::text,'action',x.action,'actor_id',case when x.action = 'settings' or x.action like 'question_%' then x.actor_id else null end,
    'question_id',x.question_id,'reason',x.reason,'created_at',x.created_at) order by x.id desc),'[]') into audit
    from (select * from public.sport_quiz_audit where p_before is null or id < p_before order by id desc limit 50) x;
  if jsonb_array_length(audit) = 50 and exists(select 1 from public.sport_quiz_audit where id < (audit->49->>'id')::bigint) then next_before := audit->49->>'id'; end if;
  return jsonb_build_object('generated_at',now(),'week_start',public.quiz_week(),'week_end',public.quiz_week()+7,
    'settings',(select to_jsonb(s)-'singleton' from public.sport_quiz_settings s where singleton),'questions',bank,'audit',audit,'next_before',next_before,
    'counts',jsonb_build_object(
      'questions_draft',(select count(*) from public.sport_quiz_questions where status = 'draft'),
      'questions_approved',(select count(*) from public.sport_quiz_questions where status = 'approved'),
      'questions_archived',(select count(*) from public.sport_quiz_questions where status = 'archived'),
      'questions_void',(select count(*) from public.sport_quiz_questions where status = 'void'),
      'week_issued',(select count(*) from public.sport_quiz_attempts where week_start = public.quiz_week() and status = 'issued'),
      'week_completed',(select count(*) from public.sport_quiz_attempts where week_start = public.quiz_week() and status = 'completed'),
      'week_skipped',(select count(*) from public.sport_quiz_attempts where week_start = public.quiz_week() and status = 'skipped'),
      'week_void',(select count(*) from public.sport_quiz_attempts where week_start = public.quiz_week() and status = 'void'),
      'badges_issued',(select count(*) from public.sport_quiz_badges where voided_at is null),
      'badges_void',(select count(*) from public.sport_quiz_badges where voided_at is not null)));
end;
$$;

-- Draft-only seeds: human fact/context approval is required before a question can be assigned.
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason)
select '10000000-0000-0000-0000-000000000001',1,'American football',
  'In American football, how many points is a touchdown before any extra point or conversion?',
  '["3","6","7","2"]',1,'A touchdown is worth six points. The extra-point or two-point conversion attempt is scored separately.',
  'Draft factual example; content owner must verify context before approval.'
where not exists(select 1 from public.sport_quiz_questions where question_key = '10000000-0000-0000-0000-000000000001');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason)
select '10000000-0000-0000-0000-000000000002',1,'Basketball',
  'In standard five-on-five basketball, how many players from each team are on the court?',
  '["4","5","6","7"]',1,'Standard five-on-five basketball has five players from each team on the court.',
  'Draft factual example; content owner must verify five-on-five context before approval.'
where not exists(select 1 from public.sport_quiz_questions where question_key = '10000000-0000-0000-0000-000000000002');

do $$
declare tab text; fn text;
begin
  foreach tab in array array['sport_quiz_settings','sport_quiz_questions','sport_quiz_attempts','sport_quiz_badges','sport_quiz_audit'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',tab);
    execute format('drop policy if exists "Closed accounts" on public.%I',tab);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated using (public.caller_not_age_blocked()) with check (public.caller_not_age_blocked())',tab);
  end loop;
  revoke all on sequence public.sport_quiz_audit_id_seq from public,anon,authenticated,service_role;
  foreach fn in array array['public.quiz_week()','public.quiz_actor()','public.quiz_admin_actor()','public.quiz_require_testing(uuid)','public.quiz_guard_question()','public.quiz_guard_audit()',
    'public.quiz_snapshot()','public.quiz_start(text)','public.quiz_answer(uuid,integer,uuid)','public.quiz_skip()',
    'public.quiz_admin_snapshot(bigint)','public.quiz_admin_question(uuid,text,jsonb)','public.quiz_admin_settings(jsonb,text)'] loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);
  end loop;
  foreach fn in array array['public.quiz_snapshot()','public.quiz_start(text)','public.quiz_answer(uuid,integer,uuid)','public.quiz_skip()',
    'public.quiz_admin_snapshot(bigint)','public.quiz_admin_question(uuid,text,jsonb)','public.quiz_admin_settings(jsonb,text)'] loop
    execute format('grant execute on function %s to authenticated',fn);
  end loop;
end;
$$;
