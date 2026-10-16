-- QUIZ-02: private timed trivia replaces untimed authority; local-only, no hosted application.
-- Requires QUIZ-01/MINOR-01. Reset to paused, empty <=100 tester cohort before revised admin review.
-- Approved contract: docs/engineering/design/TIMED_TRIVIA_PROPOSAL.md §7.
-- Repair: pause, retain evidence and use a reviewed forward migration; no automatic untimed restoration.
-- No money/Aura/public badge. Settings fence precedes account/attempt locks; helpers are never client APIs.

-- The mode column is the durable transition marker. Capture it before structural additions.
-- This private DDL context is overwritten here; a repeat must not reset an already timed cohort/history.
do $$ begin
 perform set_config('quiz.initial_upgrade',(not exists(select 1 from pg_attribute where attrelid='public.sport_quiz_attempts'::regclass and attname='mode' and not attisdropped))::text,true);
end $$;

alter table public.sport_quiz_questions add column if not exists topic_category text not null default 'sport'
  check(topic_category in ('sport','science','geography','general'));
alter table public.sport_quiz_questions add column if not exists source_notes text not null default '' check(char_length(source_notes)<=1000);
alter table public.sport_quiz_attempts drop constraint if exists sport_quiz_attempts_status_check;
alter table public.sport_quiz_attempts add constraint sport_quiz_attempts_status_check check(status in ('issued','completed','skipped','void','ended','expired'));
alter table public.sport_quiz_attempts add column if not exists mode text not null default 'legacy' check(mode in ('legacy','timed'));
alter table public.sport_quiz_attempts add column if not exists duration_seconds integer check(duration_seconds in (30,90));
alter table public.sport_quiz_attempts add column if not exists started_at timestamptz;
alter table public.sport_quiz_attempts add column if not exists expires_at timestamptz;
alter table public.sport_quiz_attempts add column if not exists session_hash text check(session_hash ~ '^[0-9a-f]{64}$');
alter table public.sport_quiz_attempts add column if not exists closed_at timestamptz;
alter table public.sport_quiz_attempts add column if not exists close_reason text;
alter table public.sport_quiz_attempts drop constraint if exists quiz_timed_window;
alter table public.sport_quiz_attempts add constraint quiz_timed_window check(mode<>'timed' or status='skipped' or
  (duration_seconds is not null and started_at is not null and expires_at is not null and expires_at=started_at+duration_seconds*interval '1 second'));
alter table public.sport_quiz_attempts drop constraint if exists quiz_timed_capability;
alter table public.sport_quiz_attempts add constraint quiz_timed_capability check(mode<>'timed' or status<>'issued' or session_hash is not null);
alter table public.sport_quiz_badges drop constraint if exists sport_quiz_badges_label_check;
-- NOT VALID: on a re-run after QUIZ-03 (which widens these lists) existing rows must not stop the migration; new rows are
-- still checked, and QUIZ-03 re-adds the wider list.
alter table public.sport_quiz_badges add constraint sport_quiz_badges_label_check check(label in ('Sport Learner','Trivia Explorer')) not valid;
alter table public.sport_quiz_audit drop constraint if exists sport_quiz_audit_action_check;
alter table public.sport_quiz_audit add constraint sport_quiz_audit_action_check check(action in
  ('settings','question_create','question_edit','question_approve','question_archive','question_void','start','answer','skip','end','retention')) not valid;

create table if not exists public.sport_quiz_preferences (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 invitation_mode text not null default 'off' check(invitation_mode in ('off','weekly')),
 topic_mode text not null default 'sports' check(topic_mode in ('sports','mix')),
 notice_version text check(notice_version='timed-trivia-v1-testing'), notice_accepted_at timestamptz,
 version bigint not null default 0 check(version>=0), history_version bigint not null default 0 check(history_version>=0),
 last_invited_week date, updated_at timestamptz not null default now()
);
create table if not exists public.sport_quiz_exposures (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 question_key uuid not null, question_id uuid not null references public.sport_quiz_questions(id), first_issued_at timestamptz not null,
 primary key(profile_id,question_key)
);
create table if not exists public.sport_quiz_week_guards (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1), spent_at timestamptz not null,
 prune_after timestamptz not null, primary key(profile_id,week_start),
 check(prune_after=spent_at+interval '35 days')
);
create table if not exists public.sport_quiz_requests (
 profile_id uuid not null references public.profiles(id) on delete cascade, request_id uuid not null,
 operation text not null check(operation in ('preferences','invitation','start','answer','end','skip')),
 week_start date not null, payload_digest text check(payload_digest ~ '^[0-9a-f]{64}$'),
 attempt_id uuid references public.sport_quiz_attempts(id) on delete cascade,
 receipt jsonb not null check(jsonb_typeof(receipt)='object'), created_at timestamptz not null,
 prune_after timestamptz not null check(prune_after=created_at+interval '35 days'),
 capacity_class text not null default 'ordinary' check(capacity_class in ('ordinary','answer','off','end')),
 primary key(profile_id,request_id)
);
create index if not exists quiz_requests_prune on public.sport_quiz_requests(prune_after);
create unique index if not exists quiz_reserved_request_slot on public.sport_quiz_requests(profile_id,week_start,capacity_class) where capacity_class<>'ordinary';
create index if not exists quiz_guards_prune on public.sport_quiz_week_guards(prune_after);
create index if not exists quiz_history_order on public.sport_quiz_attempts(profile_id,week_start desc,id desc);
create index if not exists quiz_bank_order on public.sport_quiz_questions(created_at desc,id desc);

-- Backfill all exposed families, including voided versions; old active rounds cannot become timed.
do $$ begin
if current_setting('quiz.initial_upgrade',true)='true' then
insert into public.sport_quiz_exposures(profile_id,question_key,question_id,first_issued_at)
 select distinct on(a.profile_id,q.question_key) a.profile_id,q.question_key,q.id,a.issued_at
 from public.sport_quiz_attempts a join public.sport_quiz_questions q on q.id=a.question_id
 order by a.profile_id,q.question_key,a.issued_at,a.id on conflict do nothing;
insert into public.sport_quiz_week_guards(profile_id,week_start,spent_at,prune_after)
 select profile_id,week_start,issued_at,issued_at+interval '35 days' from public.sport_quiz_attempts
 where issued_at+interval '35 days'>statement_timestamp() on conflict do nothing;
update public.sport_quiz_attempts set status='ended',closed_at=statement_timestamp(),close_reason='legacy_transition',session_hash=null where status='issued';
update public.sport_quiz_attempts set closed_at=coalesce(completed_at,voided_at,issued_at) where status<>'issued' and closed_at is null;
update public.sport_quiz_settings set enabled=false,pilot_accounts='{}',reason='Paused for timed trivia admin review.',updated_at=statement_timestamp();
insert into public.sport_quiz_preferences(profile_id,history_version) select distinct profile_id,1 from public.sport_quiz_attempts on conflict do nothing;
end if;
perform set_config('quiz.initial_upgrade','false',true);
end $$;

create or replace function public.quiz_week_at(p_time timestamptz)
returns date language sql immutable set search_path='' as $$ select date_trunc('week',p_time at time zone 'UTC')::date $$;
create or replace function public.quiz_expected_actor(p_expected uuid,p_admin boolean default false)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare me uuid;
begin
 me:=case when p_admin then public.quiz_admin_actor() else public.quiz_actor() end;
 if p_expected is null or me is distinct from p_expected then raise exception 'quiz_identity_changed'; end if;
 return me;
end $$;

create or replace function public.quiz_cursor(p_cursor text,p_stream text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare c jsonb;
begin
 if p_cursor is null then return null;end if;
 if char_length(p_cursor)>300 then raise exception 'quiz_cursor_invalid';end if;
 c:=p_cursor::jsonb;
 if jsonb_typeof(c) is distinct from 'object' or c->'v' is distinct from '1'::jsonb or c->>'stream' is distinct from p_stream
  or (select count(*) from jsonb_object_keys(c))<>4 or jsonb_typeof(c->'at') is distinct from 'string' or jsonb_typeof(c->'id') is distinct from 'string'
  or (c->>'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'quiz_cursor_invalid';end if;
 if p_stream='history' then
  if (c->>'at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'quiz_cursor_invalid';end if;perform (c->>'at')::date;
 elsif p_stream='questions' then
  if (c->>'at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'quiz_cursor_invalid';end if;perform (c->>'at')::timestamptz;
 else raise exception 'quiz_cursor_invalid';end if;
 perform (c->>'id')::uuid;return c;
exception when others then raise exception 'quiz_cursor_invalid';
end $$;

create or replace function public.quiz_history(p_before text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.quiz_actor();at timestamptz:=statement_timestamp();c jsonb:=public.quiz_cursor(p_before,'history');items jsonb;next_before text;
 last_id uuid;last_week date;total bigint;
begin
 select count(*) into total from public.sport_quiz_attempts where profile_id=me and (status<>'issued' or expires_at<=at);
 select coalesce(jsonb_agg(jsonb_build_object('attempt',public.quiz_summary(a.id,at),'question',public.quiz_question_dto(a.question_id),
  'result',public.quiz_result_dto(a.id,at),'badge',(select to_jsonb(b)-'profile_id'-'attempt_id'-'week_start' from public.sport_quiz_badges b where attempt_id=a.id))
  order by a.week_start desc,a.id desc),'[]') into items
 from(select * from public.sport_quiz_attempts where profile_id=me and (status<>'issued' or expires_at<=at)
  and (c is null or (week_start,id)<((c->>'at')::date,(c->>'id')::uuid)) order by week_start desc,id desc limit 50)a;
 if jsonb_array_length(items)=50 then
  last_id:=(items->49->'attempt'->>'id')::uuid;last_week:=(items->49->'attempt'->>'week_start')::date;
  if exists(select 1 from public.sport_quiz_attempts where profile_id=me and (status<>'issued' or expires_at<=at) and (week_start,id)<(last_week,last_id)) then
   next_before:=jsonb_build_object('v',1,'stream','history','at',last_week,'id',last_id)::text;
  end if;
 end if;
 return jsonb_build_object('contract_version',2,'profile_id',me,'server_now',at,'history_version',(public.quiz_preferences_dto(me)->>'history_version')::bigint,
  'total',total,'items',items,'next_before',next_before);
end $$;

create or replace function public.quiz_guard_audit()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and old.action in ('start','answer','skip','end') and old.actor_id::text=current_setting('quiz.erase_profile',true) then return old;end if;
 if tg_op='UPDATE' and pg_trigger_depth()>1 and old.actor_id is not null and new.actor_id is null and (to_jsonb(new)-'actor_id')=(to_jsonb(old)-'actor_id') then return new;end if;
 raise exception 'quiz_audit_immutable';
end $$;

create or replace function public.quiz_erase_history(p_expected_history_version bigint,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_profile_id);at timestamptz;w date;rev bigint;na bigint;ne bigint;nb bigint;nr bigint;nau bigint;prune timestamptz;
begin
 perform public.quiz_lock(me);at:=clock_timestamp();w:=public.quiz_week_at(at);
 insert into public.sport_quiz_preferences(profile_id) values(me) on conflict do nothing;
 select history_version into rev from public.sport_quiz_preferences where profile_id=me for update;
 if rev is distinct from p_expected_history_version then raise exception 'quiz_history_stale';end if;
 -- Spend even if a pending Start has not arrived: clearing history also ends this week's opportunity.
 perform public.quiz_spend(me,w,at);
 select prune_after into prune from public.sport_quiz_week_guards where profile_id=me and week_start=w;
 select count(*) into na from public.sport_quiz_attempts where profile_id=me;
 select count(*) into nb from public.sport_quiz_badges where profile_id=me;
 delete from public.sport_quiz_requests where profile_id=me;get diagnostics nr=row_count;
 delete from public.sport_quiz_exposures where profile_id=me;get diagnostics ne=row_count;
 perform set_config('quiz.erase_profile',me::text,true);
 delete from public.sport_quiz_audit where actor_id=me and action in ('start','answer','skip','end');get diagnostics nau=row_count;
 perform set_config('quiz.erase_profile','',true);
 delete from public.sport_quiz_attempts where profile_id=me;
 update public.sport_quiz_preferences set history_version=history_version+1,updated_at=at where profile_id=me;
 return jsonb_build_object('contract_version',2,'profile_id',me,'history_version',rev+1,'week_start',w,'week_spent',true,'quota_prune_after',prune,
  'removed_attempts',na,'removed_exposures',ne,'removed_badges',nb,'removed_requests',nr,'removed_audit',nau);
end $$;

create or replace function public.quiz_guard_question()
returns trigger language plpgsql set search_path='' as $$
declare normalized jsonb;
begin
 if tg_op='UPDATE' and (new.question_key,new.version,new.sport,new.prompt,new.options,new.correct_option,new.explanation,new.created_at,new.topic_category,new.source_notes)
  is distinct from (old.question_key,old.version,old.sport,old.prompt,old.options,old.correct_option,old.explanation,old.created_at,old.topic_category,old.source_notes) then raise exception 'quiz_immutable';end if;
 if tg_op='UPDATE' and old.status='void' and new.status<>'void' then raise exception 'quiz_void_final';end if;
 normalized:=public.quiz_normalize_options(new.options);
 if normalized is null and tg_op='UPDATE' and new.status in ('archived','void') then return new;end if;
 if normalized is null then raise exception 'quiz_options_invalid';end if;
 if new.status='approved' and char_length(btrim(new.source_notes)) not between 10 and 1000 then raise exception 'quiz_sources_required';end if;
 if tg_op='INSERT' then new.options:=normalized;end if;return new;
end $$;

create or replace function public.quiz_admin_settings(p_payload jsonb,p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_actor_id,true);testers uuid[];next_enabled boolean;at timestamptz;affected uuid;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean'
  or jsonb_typeof(p_payload->'pilot_accounts') is distinct from 'array' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500
  or exists(select 1 from jsonb_object_keys(p_payload)k where k not in ('enabled','pilot_accounts')) then raise exception 'quiz_settings_invalid';end if;
 if jsonb_array_length(p_payload->'pilot_accounts')>100 then raise exception 'quiz_testers_limit';end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'pilot_accounts')v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'quiz_settings_invalid';end if;
 select coalesce(array_agg(x::uuid),'{}'::uuid[]) into testers from jsonb_array_elements_text(p_payload->'pilot_accounts')x;
 next_enabled:=(p_payload->>'enabled')::boolean;
 if cardinality(testers)<>(select count(distinct x) from unnest(testers)x) then raise exception 'quiz_testers_duplicate';end if;
 if next_enabled and cardinality(testers)=0 then raise exception 'quiz_testers_required';end if;
 if next_enabled and exists(select 1 from unnest(testers)x where public.profile_age_band(x) not in ('adult','teen_13_15','teen_16_17') or
  not exists(select 1 from public.profiles p where p.id=x and p.age_blocked_at is null)) then raise exception 'quiz_testers_ineligible';end if;
 perform 1 from public.sport_quiz_settings where singleton for update;if not found then raise exception 'quiz_unavailable';end if;at:=clock_timestamp();
 update public.sport_quiz_settings set enabled=next_enabled,pilot_accounts=testers,reason=btrim(p_reason),updated_at=at,updated_by=me where singleton;
 -- Pausing/removing an audience is terminal, so an old capability cannot revive after re-enable.
 for affected in select distinct profile_id from public.sport_quiz_attempts where status='issued' and (not next_enabled or not(profile_id=any(testers))) order by profile_id loop
  perform public.quiz_lock(affected);
 end loop;
 for affected in with changed as (update public.sport_quiz_attempts set status=case when expires_at<=at then 'expired' else 'ended' end,
  closed_at=case when expires_at<=at then expires_at else at end,close_reason=case when expires_at<=at then 'deadline' when not next_enabled then 'paused' else 'access_revoked' end,session_hash=null
  where status='issued' and (not next_enabled or not(profile_id=any(testers))) returning profile_id) select distinct profile_id from changed order by profile_id loop
  perform public.quiz_bump_history(affected);
 end loop;
 insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'settings',btrim(p_reason),at);
 return jsonb_build_object('contract_version',2,'enabled',next_enabled,'testing_only',true,'pilot_accounts',testers);
end $$;

create or replace function public.quiz_admin_question(p_id uuid,p_action text,p_payload jsonb,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_actor_id,true);q public.sport_quiz_questions%rowtype;nextq public.sport_quiz_questions%rowtype;
 why text:=btrim(p_payload->>'reason');family uuid;at timestamptz;affected uuid;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(p_action,'') not in ('create','edit','approve','archive','void') or char_length(coalesce(why,'')) not between 10 and 500
  or exists(select 1 from jsonb_object_keys(p_payload)k where k not in ('reason','sport','prompt','options','correct_option','explanation','topic_category','source_notes','family_action','question_key')) then raise exception 'quiz_question_action_invalid';end if;
 perform 1 from public.sport_quiz_settings where singleton for update;if not found then raise exception 'quiz_unavailable';end if;at:=clock_timestamp();
 if p_action='void' then
  for affected in select distinct profile_id from public.sport_quiz_attempts where question_id=p_id order by profile_id loop perform public.quiz_lock(affected);end loop;
 end if;
 if p_action<>'create' then select * into q from public.sport_quiz_questions where id=p_id for update;if not found then raise exception 'quiz_question_missing';end if;
 elsif p_id is not null then raise exception 'quiz_create_id_invalid';end if;
 if p_action in ('create','edit') then
  if (select count(*) from public.sport_quiz_questions)>=100 then raise exception 'quiz_bank_full';end if;
  if p_action='create' then
   if coalesce(p_payload->>'family_action','') not in ('new','existing') then raise exception 'quiz_family_required';end if;
   if p_payload->>'family_action'='new' then
    if p_payload?'question_key' then raise exception 'quiz_family_invalid';end if;family:=gen_random_uuid();
   else
    if coalesce(p_payload->>'question_key','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'quiz_family_invalid';end if;
    family:=(p_payload->>'question_key')::uuid;if not exists(select 1 from public.sport_quiz_questions where question_key=family) then raise exception 'quiz_family_invalid';end if;
   end if;
  else
   family:=q.question_key;
   if (p_payload?'question_key' and p_payload->>'question_key'<>family::text) or (p_payload?'family_action' and p_payload->>'family_action'<>'existing') then raise exception 'quiz_family_invalid';end if;
  end if;
  if coalesce(p_payload->>'topic_category','') not in ('sport','science','geography','general') or char_length(btrim(coalesce(p_payload->>'source_notes',''))) not between 10 and 1000
   or jsonb_typeof(p_payload->'correct_option') is distinct from 'number' or (p_payload->>'correct_option') !~ '^[0-3]$' then raise exception 'quiz_question_content_invalid';end if;
  if exists(select 1 from unnest(array['sport','prompt','explanation','source_notes'])k where jsonb_typeof(p_payload->k) is distinct from 'string') then raise exception 'quiz_question_content_invalid';end if;
  update public.sport_quiz_questions set status='archived',reason=why where question_key=family and status='approved';
  insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,created_by,topic_category,source_notes)
   values(family,coalesce((select max(version)+1 from public.sport_quiz_questions where question_key=family),1),
    btrim(p_payload->>'sport'),btrim(p_payload->>'prompt'),p_payload->'options',(p_payload->>'correct_option')::integer,btrim(p_payload->>'explanation'),why,me,p_payload->>'topic_category',btrim(p_payload->>'source_notes')) returning * into nextq;
 else
  if q.status='void' then raise exception 'quiz_void_final';end if;
  if p_action='approve' and q.status<>'draft' then raise exception 'quiz_approve_draft_only';end if;
  if p_action='approve' then update public.sport_quiz_questions set status='archived',reason=why where question_key=q.question_key and status='approved';end if;
  update public.sport_quiz_questions set status=case p_action when 'approve' then 'approved' when 'archive' then 'archived' else 'void' end,
   reason=why,reviewed_at=at,reviewed_by=me where id=q.id returning * into nextq;
  if p_action='void' then
   for affected in with changed as (update public.sport_quiz_attempts set status='void',voided_at=at,closed_at=coalesce(closed_at,at),correction_reason=why,session_hash=null
    where question_id=q.id and status<>'skipped' returning profile_id) select distinct profile_id from changed order by profile_id loop perform public.quiz_bump_history(affected);end loop;
   update public.sport_quiz_badges set voided_at=at where attempt_id in(select id from public.sport_quiz_attempts where question_id=q.id) and voided_at is null;
  end if;
 end if;
 insert into public.sport_quiz_audit(actor_id,action,question_id,reason,created_at) values(me,'question_'||p_action,nextq.id,why,at);
 return jsonb_build_object('id',nextq.id,'question_key',nextq.question_key,'version',nextq.version,'status',nextq.status);
end $$;
create or replace function public.quiz_lock(p_me uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.sport_quiz_settings where singleton for share;
 if not found then raise exception 'quiz_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended('sport-quiz:'||p_me,0));
end $$;
create or replace function public.quiz_bump_history(p_me uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- The same settings/account fence protects erasure and every material history revision.
 perform public.quiz_lock(p_me);
 insert into public.sport_quiz_preferences(profile_id) values(p_me) on conflict do nothing;
 update public.sport_quiz_preferences set history_version=history_version+1,updated_at=clock_timestamp() where profile_id=p_me;
end $$;
create or replace function public.quiz_preferences_dto(p_me uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select to_jsonb(p)-'profile_id'-'updated_at' from public.sport_quiz_preferences p where profile_id=p_me),
 jsonb_build_object('invitation_mode','off','topic_mode','sports','notice_version',null,'notice_accepted_at',null,'version',0,'history_version',0,'last_invited_week',null))
$$;
create or replace function public.quiz_summary(p_attempt uuid,p_asof timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'week_start',week_start,'mode',mode,
 'status',case when status='issued' and expires_at<=p_asof then 'expired' else status end,
 'started_at',started_at,'expires_at',expires_at,'duration_seconds',duration_seconds,'closed_at',closed_at,'close_reason',close_reason,
 'effective_expired',status='issued' and expires_at<=p_asof,'correction_reason',correction_reason)
 from public.sport_quiz_attempts where id=p_attempt
$$;
create or replace function public.quiz_question_dto(p_question uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'question_key',question_key,'version',version,'topic_category',topic_category,'sport',sport,'prompt',prompt,'options',options)
 from public.sport_quiz_questions where id=p_question
$$;
create or replace function public.quiz_result_dto(p_attempt uuid,p_asof timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('answered_option',a.answered_option,'correct_option',q.correct_option,
 'was_correct',case when a.answered_option is null then null else a.answered_option=q.correct_option end,
 'explanation',q.explanation,'completed_at',a.completed_at)
 from public.sport_quiz_attempts a join public.sport_quiz_questions q on q.id=a.question_id
 where a.id=p_attempt and (a.status<>'issued' or a.expires_at<=p_asof)
$$;
create or replace function public.quiz_digest(p_payload jsonb)
returns text language sql immutable set search_path='' as $$ select encode(public.digest(p_payload::text,'sha256'),'hex') $$;
create or replace function public.quiz_receipt_dto(p_me uuid,p_request uuid,p_asof timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
 select r.receipt || jsonb_build_object('attempt',public.quiz_summary(r.attempt_id,p_asof),'result',public.quiz_result_dto(r.attempt_id,p_asof))
 from public.sport_quiz_requests r where profile_id=p_me and request_id=p_request
$$;
create or replace function public.quiz_save_request(p_me uuid,p_request uuid,p_operation text,p_week date,p_digest text,p_attempt uuid,p_outcome text,p_at timestamptz,p_preferences jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb; budget text:='ordinary';
begin
 receipt:=jsonb_build_object('contract_version',2,'profile_id',p_me,'request_id',p_request,'operation',p_operation,'outcome',p_outcome,
 'week_start',p_week,'committed_at',p_at,'attempt',public.quiz_summary(p_attempt,p_at),'result',public.quiz_result_dto(p_attempt,p_at),'preferences',p_preferences);
 -- Reserve three slots for one answer, Off transition and End. Nothing silently loses its receipt.
 if (select count(*) from public.sport_quiz_requests where profile_id=p_me and week_start=p_week)>=57 then
  budget:=case when p_operation='end' then 'end' when p_operation='answer' or (p_operation='start' and p_outcome='cancelled') then 'answer'
   when p_outcome='saved_off' then 'off' else 'ordinary' end;
  if budget='ordinary' or exists(select 1 from public.sport_quiz_requests r where r.profile_id=p_me and r.week_start=p_week and r.capacity_class=budget)
   then raise exception 'quiz_request_limit';end if;
 end if;
 insert into public.sport_quiz_requests values(p_me,p_request,p_operation,p_week,p_digest,p_attempt,receipt,p_at,p_at+interval '35 days',budget);
 return receipt;
end $$;

drop function if exists public.quiz_start(text);
drop function if exists public.quiz_answer(uuid,integer,uuid);
drop function if exists public.quiz_skip();
drop function if exists public.quiz_admin_snapshot(bigint);
drop function if exists public.quiz_admin_settings(jsonb,text);
drop function if exists public.quiz_admin_question(uuid,text,jsonb);

create or replace function public.quiz_start(p_topic_category text,p_sport text,p_duration_seconds integer,p_expected_week date,
 p_notice_version text,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_profile_id);at timestamptz; d text; r public.sport_quiz_requests%rowtype;
 a public.sport_quiz_attempts%rowtype;q public.sport_quiz_questions%rowtype;p public.sport_quiz_preferences%rowtype;receipt jsonb;active jsonb;w date;
begin
 if p_request_id is null or coalesce(p_topic_category,'') not in ('sport','science','geography','general') or p_duration_seconds is null or p_duration_seconds not in (30,90)
  or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' or p_notice_version is distinct from 'timed-trivia-v1-testing'
  or (p_sport is not null and char_length(btrim(p_sport)) not between 2 and 80) or (p_topic_category<>'sport' and p_sport is not null) then raise exception 'quiz_start_invalid';end if;
 perform public.quiz_lock(me);at:=clock_timestamp();w:=public.quiz_week_at(at);
 if p_expected_week is distinct from w then raise exception 'quiz_week_changed';end if;
 d:=public.quiz_digest(jsonb_build_array(p_topic_category,case when p_sport is null then null else btrim(p_sport) end,p_duration_seconds,p_expected_week,p_notice_version,p_session_secret));
 select * into r from public.sport_quiz_requests where profile_id=me and request_id=p_request_id;
 if found then
  if r.operation<>'start' or (r.payload_digest is not null and r.payload_digest is distinct from d) then raise exception 'quiz_request_conflict';end if;
  perform public.quiz_expire(me,at);
  select * into a from public.sport_quiz_attempts where id=r.attempt_id for update;
  if a.status='issued' and a.expires_at>at and a.session_hash=encode(public.digest(p_session_secret,'sha256'),'hex')
   and exists(select 1 from public.sport_quiz_settings where singleton and enabled and me=any(pilot_accounts)) then
   select * into q from public.sport_quiz_questions where id=a.question_id for share;
   if q.status<>'void' then active:=public.quiz_question_dto(q.id);end if;
  end if;
  receipt:=public.quiz_receipt_dto(me,p_request_id,at);
  return receipt||jsonb_build_object('server_now',at,'active_question',active);
 end if;
 -- A guard survives erasure/cancellation. It is checked before assignment, regardless of receipts.
 if exists(select 1 from public.sport_quiz_week_guards where profile_id=me and week_start=w) then
  select id into a.id from public.sport_quiz_attempts where profile_id=me and week_start=w;
  receipt:=public.quiz_save_request(me,p_request_id,'start',w,d,a.id,'week_spent',at);
  return receipt||jsonb_build_object('server_now',at,'active_question',null);
 end if;
 perform public.quiz_require_testing(me);
 perform public.quiz_expire(me,at);
 if at+p_duration_seconds*interval '1 second'>((w+7)::timestamp at time zone 'UTC') then raise exception 'quiz_week_closing';end if;
 if exists(select 1 from public.sport_quiz_attempts where profile_id=me and status='issued') then raise exception 'quiz_round_active';end if;
 select * into p from public.sport_quiz_preferences where profile_id=me;
 if p.notice_version is distinct from p_notice_version then raise exception 'quiz_notice_required';end if;
 if (p_topic_category<>'sport' and not public.quiz_fun_slot(me,w)) or (p_topic_category='sport' and public.quiz_fun_slot(me,w) and public.quiz_fun_available(me)) then raise exception 'quiz_topic_not_allowed';end if;
 select b.* into q from public.sport_quiz_questions b where b.status='approved' and b.topic_category=p_topic_category
  and (p_sport is null or b.sport=btrim(p_sport)) and public.quiz_normalize_options(b.options) is not null and char_length(btrim(b.source_notes))>=10
  and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id=me and e.question_key=b.question_key)
  order by random() limit 1 for share;
 if not found then raise exception 'quiz_no_question';end if;
 at:=clock_timestamp();w:=public.quiz_week_at(at);
 if w is distinct from p_expected_week then raise exception 'quiz_week_changed';end if;
 if at+p_duration_seconds*interval '1 second'>((w+7)::timestamp at time zone 'UTC') then raise exception 'quiz_week_closing';end if;
 perform public.quiz_spend(me,w,at);
 insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status,issued_at,mode,duration_seconds,started_at,expires_at,session_hash)
  values(me,w,q.id,'issued',at,'timed',p_duration_seconds,at,at+p_duration_seconds*interval '1 second',encode(public.digest(p_session_secret,'sha256'),'hex')) returning * into a;
 insert into public.sport_quiz_exposures values(me,q.question_key,q.id,at);
 perform public.quiz_bump_history(me);
 insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,created_at) values(me,'start',q.id,a.id,at);
 receipt:=public.quiz_save_request(me,p_request_id,'start',w,d,a.id,'started',at);
 return receipt||jsonb_build_object('server_now',at,'active_question',public.quiz_question_dto(q.id));
end $$;

create or replace function public.quiz_answer(p_attempt_id uuid,p_option integer,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_profile_id);at timestamptz;d text;r public.sport_quiz_requests%rowtype;
 a public.sport_quiz_attempts%rowtype;q public.sport_quiz_questions%rowtype;
begin
 if p_request_id is null or p_attempt_id is null or p_option is null or p_option not between 0 and 3 or p_session_secret is null or p_session_secret !~ '^[0-9a-f]{64}$' then raise exception 'quiz_answer_invalid';end if;
 perform public.quiz_lock(me);select * into a from public.sport_quiz_attempts where id=p_attempt_id and profile_id=me for update;
 at:=clock_timestamp();d:=public.quiz_digest(jsonb_build_array(p_attempt_id,p_option,p_session_secret));
 select * into r from public.sport_quiz_requests where profile_id=me and request_id=p_request_id;
 if found then if r.operation<>'answer' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict';end if;return public.quiz_receipt_dto(me,p_request_id,at);end if;
 if a.id is null or a.mode<>'timed' then raise exception 'quiz_round_closed';end if;
 perform public.quiz_require_testing(me);
 if a.status='issued' and a.session_hash is distinct from encode(public.digest(p_session_secret,'sha256'),'hex') then raise exception 'quiz_capability_invalid';end if;
 if a.status='issued' and a.expires_at<=at then
  perform public.quiz_expire(me,at);return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'expired',at);
 end if;
 if a.status<>'issued' then return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,a.status,at);end if;
 select * into q from public.sport_quiz_questions where id=a.question_id for share;
 if q.status='void' or public.quiz_normalize_options(q.options) is null then raise exception 'quiz_question_unavailable';end if;
 at:=clock_timestamp();
 if a.expires_at<=at then perform public.quiz_expire(me,at);return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'expired',at);end if;
 update public.sport_quiz_attempts set status='completed',answered_option=p_option,request_id=p_request_id,completed_at=at,closed_at=at,close_reason='answered',session_hash=null where id=a.id;
 insert into public.sport_quiz_badges(profile_id,attempt_id,week_start,label,issued_at) values(me,a.id,a.week_start,'Trivia Explorer',at);
 perform public.quiz_bump_history(me);
 insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id,created_at) values(me,'answer',q.id,a.id,at);
 return public.quiz_save_request(me,p_request_id,'answer',a.week_start,d,a.id,'completed',at);
end $$;

create or replace function public.quiz_end(p_attempt_id uuid,p_start_request_id uuid,p_expected_week date,p_reason text,p_request_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_profile_id);at timestamptz;d text;r public.sport_quiz_requests%rowtype;
 source public.sport_quiz_requests%rowtype;a public.sport_quiz_attempts%rowtype;outcome text;w date;
begin
 if (p_attempt_id is null)=(p_start_request_id is null) or p_request_id is null or p_request_id=p_start_request_id
  or coalesce(p_reason,'') not in ('user_end','left_page','background','identity_change') then raise exception 'quiz_end_invalid';end if;
 perform public.quiz_lock(me);at:=clock_timestamp();w:=public.quiz_week_at(at);
 d:=public.quiz_digest(jsonb_build_array(p_attempt_id,p_start_request_id,p_expected_week,p_reason));
 select * into r from public.sport_quiz_requests where profile_id=me and request_id=p_request_id;
 if found then if r.operation<>'end' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict';end if;return public.quiz_receipt_dto(me,p_request_id,at);end if;
 if p_expected_week is null or p_expected_week>w then raise exception 'quiz_week_changed';end if;
 if p_start_request_id is not null then
  select * into source from public.sport_quiz_requests where profile_id=me and request_id=p_start_request_id;
  if found and (source.operation<>'start' or source.week_start<>p_expected_week) then raise exception 'quiz_request_conflict';end if;
  if source.request_id is null then
   if p_expected_week<>w then raise exception 'quiz_round_closed';end if;
   -- A pending unknown Start can be cancelled once. Existing active rounds retain their End slot.
   if exists(select 1 from public.sport_quiz_week_guards where profile_id=me and week_start=w) then raise exception 'quiz_round_closed';end if;
   perform public.quiz_spend(me,w,at);
   perform public.quiz_bump_history(me);
   perform public.quiz_save_request(me,p_start_request_id,'start',w,null,null,'cancelled',at);
   return public.quiz_save_request(me,p_request_id,'end',w,d,null,'cancelled',at);
  end if;
  p_attempt_id:=source.attempt_id;
  if p_attempt_id is null then return public.quiz_save_request(me,p_request_id,'end',p_expected_week,d,null,'cancelled',at);end if;
 end if;
 select * into a from public.sport_quiz_attempts where id=p_attempt_id and profile_id=me and week_start=p_expected_week for update;
 if a.id is null then raise exception 'quiz_round_closed';end if;
 at:=clock_timestamp();
 if a.status='issued' then
  outcome:=case when a.expires_at<=at then 'expired' else 'ended' end;
  update public.sport_quiz_attempts set status=outcome,closed_at=case when outcome='expired' then expires_at else at end,
   close_reason=case when outcome='expired' then 'deadline' else p_reason end,session_hash=null where id=a.id;
  perform public.quiz_bump_history(me);
  insert into public.sport_quiz_audit(actor_id,action,attempt_id,created_at) values(me,'end',a.id,at);
 else outcome:=a.status;end if;
 return public.quiz_save_request(me,p_request_id,'end',a.week_start,d,a.id,outcome,at);
end $$;

create or replace function public.quiz_skip(p_expected_week date,p_request_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_profile_id);at timestamptz;d text;r public.sport_quiz_requests%rowtype;a public.sport_quiz_attempts%rowtype;
begin
 if p_request_id is null then raise exception 'quiz_request_invalid';end if;perform public.quiz_lock(me);at:=clock_timestamp();
 if p_expected_week is distinct from public.quiz_week_at(at) then raise exception 'quiz_week_changed';end if;
 d:=public.quiz_digest(jsonb_build_array(p_expected_week));select * into r from public.sport_quiz_requests where profile_id=me and request_id=p_request_id;
 if found then if r.operation<>'skip' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict';end if;return public.quiz_receipt_dto(me,p_request_id,at);end if;
 perform public.quiz_require_testing(me);select * into a from public.sport_quiz_attempts where profile_id=me and week_start=p_expected_week for update;
 if exists(select 1 from public.sport_quiz_week_guards where profile_id=me and week_start=p_expected_week) then
  return public.quiz_save_request(me,p_request_id,'skip',p_expected_week,d,a.id,'week_spent',at);
 end if;
 perform public.quiz_spend(me,p_expected_week,at);
 insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,closed_at,close_reason)
  values(me,p_expected_week,'skipped',at,'timed',at,'skip') returning * into a;
 perform public.quiz_bump_history(me);
 insert into public.sport_quiz_audit(actor_id,action,attempt_id,created_at) values(me,'skip',a.id,at);
 return public.quiz_save_request(me,p_request_id,'skip',p_expected_week,d,a.id,'skipped',at);
end $$;

create or replace function public.quiz_receipt(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.quiz_actor();result jsonb;
begin
 result:=public.quiz_receipt_dto(me,p_request_id,statement_timestamp());
 if result is null then raise exception 'quiz_receipt_unavailable';end if;return result;
end $$;
create or replace function public.quiz_spend(p_me uuid,p_week date,p_at timestamptz)
returns void language sql security definer set search_path='' as $$
 insert into public.sport_quiz_week_guards values(p_me,p_week,p_at,p_at+interval '35 days') on conflict do nothing
$$;
create or replace function public.quiz_expire(p_me uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare changed bigint;
begin
 update public.sport_quiz_attempts set status='expired',closed_at=expires_at,close_reason='deadline',session_hash=null
 where profile_id=p_me and status='issued' and expires_at<=p_at;
 get diagnostics changed=row_count;
 if changed>0 then perform public.quiz_bump_history(p_me);end if;
end
$$;

create or replace function public.quiz_fun_slot(p_me uuid,p_week date)
returns boolean language sql stable security definer set search_path='' as $$
 select (public.quiz_preferences_dto(p_me)->>'topic_mode')='mix' and (((p_week-date '1970-01-05')/7%5+5)%5)=4
$$;
create or replace function public.quiz_fun_available(p_me uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.sport_quiz_questions q where status='approved' and topic_category<>'sport'
  and char_length(btrim(source_notes))>=10 and public.quiz_normalize_options(options) is not null
  and not exists(select 1 from public.sport_quiz_exposures e where e.profile_id=p_me and e.question_key=q.question_key))
$$;

create or replace function public.quiz_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); at timestamptz:=statement_timestamp(); w date:=public.quiz_week_at(at);
 s public.sport_quiz_settings%rowtype; pref jsonb; available text; pools jsonb:='[]'; aid uuid; scheduled text;
begin
 select * into s from public.sport_quiz_settings where singleton;
 if auth.uid() is null or me is null or public.profile_age_band(me) not in ('adult','teen_13_15','teen_16_17') then me:=null;available:='ineligible';
 elsif s.singleton is null then available:='unavailable';
 elsif not s.enabled then available:='paused';
 elsif not(me=any(s.pilot_accounts)) then available:='not_enrolled'; else available:='ready'; end if;
 pref:=public.quiz_preferences_dto(me);
 scheduled:=case when public.quiz_fun_slot(me,w) then 'fun' else 'sport' end;
 if available='ready' then
  select coalesce(jsonb_agg(jsonb_build_object('topic_category',x.topic_category,'sport',x.sport,'unseen_count',x.n,
   'allowed',case when x.topic_category='sport' then scheduled='sport' or not public.quiz_fun_available(me) else scheduled='fun' end) order by x.topic_category,x.sport),'[]') into pools
  from(select q.topic_category,q.sport,count(*) filter(where not exists(select 1 from public.sport_quiz_exposures e where e.profile_id=me and e.question_key=q.question_key)) n
   from public.sport_quiz_questions q where q.status='approved' and public.quiz_normalize_options(q.options) is not null and char_length(btrim(q.source_notes))>=10 group by q.topic_category,q.sport)x;
  if not exists(select 1 from jsonb_array_elements(pools) p where (p->>'unseen_count')::int>0 and (p->>'allowed')::boolean) then available:='unavailable'; end if;
 end if;
 if me is not null and s.singleton is not null then select id into aid from public.sport_quiz_attempts where profile_id=me and week_start=w; end if;
 return jsonb_build_object('contract_version',2,'profile_id',me,'server_now',at,'week_start',w,'week_end',w+7,'testing_only',true,
 'availability',available,'preferences',pref,'attempt',public.quiz_summary(aid,at),
 'week_spent',me is not null and exists(select 1 from public.sport_quiz_week_guards where profile_id=me and week_start=w),
 'scheduled_topic',scheduled,'pools',pools,'history_version',(pref->>'history_version')::bigint,
 'history_count',(select count(*) from public.sport_quiz_attempts where profile_id=me and (status<>'issued' or expires_at<=at)),
 'badge_count',(select count(*) from public.sport_quiz_badges where profile_id=me and voided_at is null),
 'correction_count',(select count(*) from public.sport_quiz_attempts where profile_id=me and status='void'));
end $$;

create or replace function public.quiz_preferences(p_payload jsonb,p_expected_version bigint,p_request_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_profile_id); at timestamptz; d text; r public.sport_quiz_requests%rowtype; p public.sport_quiz_preferences%rowtype;
begin
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' or
  coalesce(p_payload->>'invitation_mode','') not in ('off','weekly') or coalesce(p_payload->>'topic_mode','') not in ('sports','mix') or
  p_payload->>'notice_version' is distinct from 'timed-trivia-v1-testing' or exists(select 1 from jsonb_object_keys(p_payload)k where k not in ('invitation_mode','topic_mode','notice_version')) then raise exception 'quiz_preferences_invalid'; end if;
 perform public.quiz_lock(me);at:=clock_timestamp(); d:=public.quiz_digest(jsonb_build_array(p_payload,p_expected_version));
 select * into r from public.sport_quiz_requests where profile_id=me and request_id=p_request_id;
 if found then if r.operation<>'preferences' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict';end if;return public.quiz_receipt_dto(me,p_request_id,at);end if;
 if p_payload->>'invitation_mode'='weekly' then perform public.quiz_require_testing(me);end if;
 -- Off remains usable while paused/unlisted; it grants no participation authority.
 insert into public.sport_quiz_preferences(profile_id) values(me) on conflict do nothing;
 select * into p from public.sport_quiz_preferences where profile_id=me for update;
 if p.version is distinct from p_expected_version then raise exception 'quiz_preferences_stale';end if;
 update public.sport_quiz_preferences set invitation_mode=p_payload->>'invitation_mode',topic_mode=p_payload->>'topic_mode',notice_version=p_payload->>'notice_version',
  notice_accepted_at=at,version=version+1,updated_at=at where profile_id=me;
 return public.quiz_save_request(me,p_request_id,'preferences',public.quiz_week_at(at),d,null,
  case when p.invitation_mode='weekly' and p_payload->>'invitation_mode'='off' then 'saved_off' else 'saved' end,at,public.quiz_preferences_dto(me));
end $$;

create or replace function public.quiz_invitation(p_expected_week date,p_request_id uuid,p_expected_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_profile_id);at timestamptz;d text; r public.sport_quiz_requests%rowtype;p public.sport_quiz_preferences%rowtype;outcome text;
begin
 if p_request_id is null then raise exception 'quiz_request_invalid';end if;perform public.quiz_lock(me);at:=clock_timestamp();
 if p_expected_week is distinct from public.quiz_week_at(at) then raise exception 'quiz_week_changed';end if;
 d:=public.quiz_digest(jsonb_build_array(p_expected_week));select * into r from public.sport_quiz_requests where profile_id=me and request_id=p_request_id;
 if found then if r.operation<>'invitation' or r.payload_digest is distinct from d then raise exception 'quiz_request_conflict';end if;return public.quiz_receipt_dto(me,p_request_id,at);end if;
 perform public.quiz_require_testing(me);select * into p from public.sport_quiz_preferences where profile_id=me for update;
 outcome:=case when p.invitation_mode is distinct from 'weekly' then 'off' when p.last_invited_week=p_expected_week then 'already_claimed' else 'claimed' end;
 if outcome='claimed' then update public.sport_quiz_preferences set last_invited_week=p_expected_week where profile_id=me;end if;
 return public.quiz_save_request(me,p_request_id,'invitation',p_expected_week,d,null,outcome,at);
end $$;

create or replace function public.quiz_admin_snapshot(p_question_cursor text default null,p_audit_before bigint default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.quiz_admin_actor();at timestamptz:=statement_timestamp();w date:=public.quiz_week_at(at);
 c jsonb:=public.quiz_cursor(p_question_cursor,'questions');bank jsonb;audit jsonb;nextq text;nexta text;last_id uuid;last_at timestamptz;
begin
 if p_audit_before is not null and p_audit_before<=0 then raise exception 'quiz_cursor_invalid';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by created_at desc,id desc),'[]') into bank from
 (select * from public.sport_quiz_questions where c is null or (created_at,id)<((c->>'at')::timestamptz,(c->>'id')::uuid) order by created_at desc,id desc limit 50)q;
 if jsonb_array_length(bank)=50 then
  last_at:=(bank->49->>'created_at')::timestamptz;last_id:=(bank->49->>'id')::uuid;
  if exists(select 1 from public.sport_quiz_questions where (created_at,id)<(last_at,last_id)) then nextq:=jsonb_build_object('v',1,'stream','questions','at',last_at,'id',last_id)::text;end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id::text,'action',x.action,
  'actor_id',case when x.action in ('settings','retention') or x.action like 'question_%' then x.actor_id else null end,
  'question_id',case when x.action like 'question_%' then x.question_id else null end,'reason',x.reason,'created_at',x.created_at) order by x.id desc),'[]') into audit
  from(select * from public.sport_quiz_audit where p_audit_before is null or id<p_audit_before order by id desc limit 50)x;
 if jsonb_array_length(audit)=50 and exists(select 1 from public.sport_quiz_audit where id<(audit->49->>'id')::bigint) then nexta:=audit->49->>'id';end if;
 return jsonb_build_object('contract_version',2,'generated_at',at,'week_start',w,'week_end',w+7,
 'settings',(select (to_jsonb(s)-'singleton')||jsonb_build_object('contract_version',2) from public.sport_quiz_settings s where singleton),
 'questions',bank,'question_total',(select count(*) from public.sport_quiz_questions),'question_cap',100,'next_question_cursor',nextq,'audit',audit,'next_before',nexta,
 'pools',(select coalesce(jsonb_agg(to_jsonb(x) order by topic_category,sport),'[]') from(select topic_category,sport,count(*) approved_count from public.sport_quiz_questions where status='approved' and public.quiz_normalize_options(options) is not null and char_length(btrim(source_notes))>=10 group by topic_category,sport)x),
 'counts',jsonb_build_object(
 'questions_draft',(select count(*) from public.sport_quiz_questions where status='draft'),
 'questions_approved',(select count(*) from public.sport_quiz_questions where status='approved'),
 'questions_archived',(select count(*) from public.sport_quiz_questions where status='archived'),
 'questions_void',(select count(*) from public.sport_quiz_questions where status='void'),
 'week_issued',(select count(*) from public.sport_quiz_attempts where week_start=w and status='issued' and expires_at>at),
 'week_completed',(select count(*) from public.sport_quiz_attempts where week_start=w and status='completed'),
 'week_skipped',(select count(*) from public.sport_quiz_attempts where week_start=w and status='skipped'),
 'week_void',(select count(*) from public.sport_quiz_attempts where week_start=w and status='void'),
 'week_ended',(select count(*) from public.sport_quiz_attempts where week_start=w and status='ended'),
 'week_expired',(select count(*) from public.sport_quiz_attempts where week_start=w and (status='expired' or (status='issued' and expires_at<=at))),
 'badges_issued',(select count(*) from public.sport_quiz_badges where voided_at is null),
 'badges_void',(select count(*) from public.sport_quiz_badges where voided_at is not null),
 'preferences_weekly',(select count(*) from public.sport_quiz_preferences where invitation_mode='weekly'),
 'exposures',(select count(*) from public.sport_quiz_exposures),'week_spent',(select count(*) from public.sport_quiz_week_guards where week_start=w),
 'retained_guards',(select count(*) from public.sport_quiz_week_guards),'retained_requests',(select count(*) from public.sport_quiz_requests)));
end $$;

create or replace function public.quiz_admin_retention(p_reason text,p_expected_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.quiz_expected_actor(p_expected_actor_id,true);at timestamptz;ng bigint;nr bigint;kept bigint;
begin
 if char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'quiz_retention_invalid';end if;
 perform 1 from public.sport_quiz_settings where singleton for update;if not found then raise exception 'quiz_unavailable';end if;at:=clock_timestamp();
 delete from public.sport_quiz_requests where (profile_id,request_id) in(select profile_id,request_id from public.sport_quiz_requests where prune_after<=at order by prune_after,profile_id,request_id limit 500);get diagnostics nr=row_count;
 delete from public.sport_quiz_week_guards where (profile_id,week_start) in(select profile_id,week_start from public.sport_quiz_week_guards where prune_after<=at order by prune_after,profile_id,week_start limit 500);get diagnostics ng=row_count;
 select count(*) into kept from public.sport_quiz_week_guards where prune_after>at;
 insert into public.sport_quiz_audit(actor_id,action,reason,created_at) values(me,'retention',btrim(p_reason),at);
 return jsonb_build_object('contract_version',2,'removed_guards',ng,'removed_requests',nr,'preserved_guards',kept,'batch_limit',500);
end $$;

do $$ declare t text;f record;begin
 foreach t in array array['sport_quiz_preferences','sport_quiz_exposures','sport_quiz_week_guards','sport_quiz_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists quiz_closed_account on public.%I',t);
  execute format('create policy quiz_closed_account on public.%I as restrictive for all to authenticated using (public.my_profile_id() is not null and public.profile_age_band(public.my_profile_id()) in (''adult'',''teen_13_15'',''teen_16_17'')) with check (public.my_profile_id() is not null and public.profile_age_band(public.my_profile_id()) in (''adult'',''teen_13_15'',''teen_16_17''))',t);
  execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quiz\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
grant execute on function public.quiz_snapshot(),public.quiz_preferences(jsonb,bigint,uuid,uuid),public.quiz_invitation(date,uuid,uuid),
 public.quiz_start(text,text,integer,date,text,uuid,text,uuid),public.quiz_answer(uuid,integer,uuid,text,uuid),
 public.quiz_end(uuid,uuid,date,text,uuid,uuid),public.quiz_skip(date,uuid,uuid),public.quiz_receipt(uuid),public.quiz_history(text),
 public.quiz_erase_history(bigint,uuid),public.quiz_admin_snapshot(text,bigint),public.quiz_admin_settings(jsonb,text,uuid),
 public.quiz_admin_question(uuid,text,jsonb,uuid),public.quiz_admin_retention(text,uuid) to authenticated;
