-- NOTIFY-01: recipient-owned optional notifications and service-only delivery evidence.
-- Requires PRIV-01/MINOR-01 and existing admin guards. Local source; no provider activation.
-- Rollback: pause both channels, preserve event dedup/attempt history, use reviewed forward repair.
-- Optional email remains unavailable until a reviewed unsubscribe POST/token contract is present.
create table if not exists public.notification_config (
 singleton boolean primary key default true check(singleton), revision bigint not null default 0,
 email_enabled boolean not null default false, in_app_enabled boolean not null default false,
 categories jsonb not null default '{"account":false,"donation_receipts":false,"donations_received":false,"payment_updates":false,"social":false,"crew":false,"workouts":false,"games":false}'
);
insert into public.notification_config(singleton) values(true) on conflict do nothing;
create table if not exists public.notification_preferences (
 recipient_id uuid primary key references auth.users(id) on delete cascade, revision bigint not null default 0,
 email_enabled boolean not null default true,in_app_enabled boolean not null default true,
 categories jsonb not null default '{"account":{"email":false,"inApp":true},"donation_receipts":{"email":false,"inApp":true},"donations_received":{"email":false,"inApp":true},"payment_updates":{"email":false,"inApp":true},"social":{"email":false,"inApp":true},"crew":{"email":false,"inApp":true},"workouts":{"email":false,"inApp":true},"games":{"email":false,"inApp":false}}'
);
create table if not exists public.notification_events (
 id uuid primary key default gen_random_uuid(),event_key text not null unique check(length(event_key)<=200),
 event_type text not null check(event_type='account_welcome'),category text not null check(category='account'),
 reference_id uuid not null,payload jsonb not null check(jsonb_typeof(payload)='object'),created_at timestamptz not null default now()
);
create table if not exists public.notification_account_activations (
 recipient_id uuid primary key references auth.users(id) on delete cascade,enrolled_at timestamptz not null default now(),activated_at timestamptz
);
create table if not exists public.notification_inbox (
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.notification_events(id),
 recipient_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),
 read_at timestamptz,archived_at timestamptz,unique(event_id,recipient_id)
);
create index if not exists notification_inbox_owner on public.notification_inbox(recipient_id,created_at desc,id desc);
create table if not exists public.notification_inbox_snapshots (
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references auth.users(id) on delete cascade,
 cutoff_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '1 hour',
 -- The exact ID set prevents a later transaction with an older timestamp being marked read.
 inbox_ids uuid[] not null default '{}'
);
create table if not exists public.notification_deliveries (
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.notification_events(id),
 -- Preserve sanitized attempt/dedup evidence without preventing account erasure.
 recipient_id uuid references auth.users(id) on delete set null,category text not null check(category='account'),
 status text not null default 'queued' check(status in ('queued','attempting','accepted','delivered','suppressed','failed','unknown','bounced')),
 attempts integer not null default 0 check(attempts between 0 and 3),last_error_code text,
 retryable boolean not null default false,lease_token uuid,lease_until timestamptz,started_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(event_id,recipient_id)
);
create index if not exists notification_deliveries_queue on public.notification_deliveries(status,created_at,id);
create table if not exists public.notification_delivery_attempts (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.notification_deliveries(id),
 attempt_number integer not null check(attempt_number between 1 and 3),lease_token uuid not null,
 outcome text not null check(outcome in ('attempting','accepted','delivered','suppressed','failed','unknown','bounced')),
 error_code text,provider_message_id text check(provider_message_id is null or provider_message_id ~ '^[A-Za-z0-9_-]{1,120}$'),
 created_at timestamptz not null default now(),finished_at timestamptz,unique(job_id,attempt_number)
);
create table if not exists public.notification_admin_audit (
 id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('config','retry')),job_id uuid references public.notification_deliveries(id),
 reason text not null check(reason in ('reviewed_change','pause_delivery','resume_future_events','retry_known_failure')),
 before_revision bigint,after_revision bigint,created_at timestamptz not null default now()
);
create or replace function public.notification_categories() returns text[] language sql immutable set search_path='' as $$
 select array['account','donation_receipts','donations_received','payment_updates','social','crew','workouts','games']::text[] $$;
create or replace function public.notification_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_profile_id() is null then raise exception using errcode='42501',message='recipient_ineligible'; end if;
 return auth.uid();
end $$;
-- Eligibility is deliberately narrow: unsupported financial/social/content references never authorize.
create or replace function public.notification_source_eligible(event_id uuid,recipient_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.notification_events e join auth.users u on u.id=e.reference_id
 join public.profiles p on p.user_id=u.id where e.id=event_id and e.event_type='account_welcome' and e.category='account'
 and e.reference_id=recipient_id and p.age_blocked_at is null and public.profile_age_band(p.id) in ('adult','teen_13_15','teen_16_17')
 and p.role<>'guest' and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null) $$;
create or replace function public.get_notification_inbox(archived boolean default false,cursor text default null,page_size integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.notification_actor(); cursor_id uuid; cursor_at timestamptz; cutoff uuid; items jsonb; next_cursor text; unread integer;
begin
 if archived is null or page_size is null or page_size not between 1 and 50 then raise exception using errcode='22023',message='invalid_page'; end if;
 if cursor is not null then
  begin cursor_id:=cursor::uuid; exception when invalid_text_representation then raise exception using errcode='22023',message='invalid_cursor'; end;
  select created_at into cursor_at from public.notification_inbox where id=cursor_id and recipient_id=me;
  if not found then raise exception using errcode='42501',message='invalid_cursor'; end if;
 end if;
 -- Cap active capabilities; expired rows are retained until reviewed retention is authorized.
 if (select count(*) from public.notification_inbox_snapshots where recipient_id=me and expires_at>now())>=10 then
  update public.notification_inbox_snapshots set expires_at=now() where id=(select id from public.notification_inbox_snapshots
  where recipient_id=me and expires_at>now() order by cutoff_at,id limit 1);
 end if;
 insert into public.notification_inbox_snapshots(recipient_id,inbox_ids)
 select me,coalesce(array_agg(id),'{}'::uuid[]) from public.notification_inbox where recipient_id=me and archived_at is null and read_at is null returning id into cutoff;
 select count(*)::integer into unread from public.notification_inbox where recipient_id=me and archived_at is null and read_at is null;
 with page as (
  select i.*,e.category,public.notification_source_eligible(i.event_id,me) eligible from public.notification_inbox i join public.notification_events e on e.id=i.event_id
  where i.recipient_id=me and (i.archived_at is not null)=archived and (cursor is null or (i.created_at,i.id)<(cursor_at,cursor_id))
  order by i.created_at desc,i.id desc limit page_size+1
 ),visible as (select * from page order by created_at desc,id desc limit page_size)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'title',case when eligible then 'Welcome to Tapua’i' else 'Notification unavailable' end,
 'body',case when eligible then 'Your account is ready. You can manage notifications in Profile.' else 'This update is no longer available.' end,
 'createdAt',created_at,'readAt',read_at,'archivedAt',archived_at,'href',case when eligible then '/profile' else null end) order by created_at desc,id desc),'[]'::jsonb),
 case when (select count(*) from page)>page_size then (select id::text from visible order by created_at,id limit 1) else null end into items,next_cursor from visible;
 return jsonb_build_object('items',items,'unreadCount',unread,'cutoff',cutoff,'nextCursor',next_cursor);
end $$;
create or replace function public.set_notification_read(notification_id uuid,is_read boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare me uuid:=public.notification_actor();
begin
 if is_read is null then raise exception using errcode='22023',message='invalid_read'; end if;
 update public.notification_inbox set read_at=case when is_read then coalesce(read_at,now()) else null end where id=notification_id and recipient_id=me;
 if not found then raise exception using errcode='42501',message='notification_not_owned'; end if;return true;
end $$;
create or replace function public.mark_all_notifications_read(cutoff text) returns integer language plpgsql security definer set search_path='' as $$
declare me uuid:=public.notification_actor(); capability uuid; snapshot public.notification_inbox_snapshots; affected integer;
begin
 begin capability:=cutoff::uuid; exception when invalid_text_representation then raise exception using errcode='22023',message='invalid_cutoff'; end;
 select * into snapshot from public.notification_inbox_snapshots where id=capability and recipient_id=me and expires_at>now() for update;
 if not found then raise exception using errcode='42501',message='invalid_cutoff'; end if;
 update public.notification_inbox set read_at=now() where recipient_id=me and id=any(snapshot.inbox_ids) and archived_at is null and read_at is null;
 get diagnostics affected=row_count;return affected;
end $$;
create or replace function public.set_notification_archived(notification_id uuid,is_archived boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare me uuid:=public.notification_actor();
begin
 if is_archived is null then raise exception using errcode='22023',message='invalid_archive'; end if;
 update public.notification_inbox set archived_at=case when is_archived then coalesce(archived_at,now()) else null end where id=notification_id and recipient_id=me;
 if not found then raise exception using errcode='42501',message='notification_not_owned'; end if;return true;
end $$;
create or replace function public.notification_require_service() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='service_only'; end if;
end $$;
create or replace function public.notification_require_admin() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin_or_db() then raise exception using errcode='42501',message='admin_only'; end if;
end $$;
create or replace function public.get_notification_preferences() returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.notification_actor(); p public.notification_preferences;
begin
 insert into public.notification_preferences(recipient_id) values(me) on conflict do nothing;
 select * into p from public.notification_preferences where recipient_id=me;
 return jsonb_build_object('revision',p.revision,'emailEnabled',p.email_enabled,'inAppEnabled',p.in_app_enabled,'categories',p.categories);
end $$;
drop function if exists public.save_notification_preferences(bigint,jsonb);
create or replace function public.save_notification_preferences(expected_revision bigint,preferences jsonb,expected_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.notification_actor(); c text; p public.notification_preferences;
begin
 -- Compare the captured session actor; ownership still comes from Auth, never this argument.
 if expected_actor is null or expected_actor is distinct from auth.uid() then raise exception using errcode='42501',message='actor_changed'; end if;
 if expected_revision is null or preferences is null or jsonb_typeof(preferences) is distinct from 'object'
 or jsonb_typeof(preferences->'emailEnabled') is distinct from 'boolean' or jsonb_typeof(preferences->'inAppEnabled') is distinct from 'boolean'
 or jsonb_typeof(preferences->'categories') is distinct from 'object' then raise exception using errcode='22023',message='invalid_preferences'; end if;
 if exists(select 1 from jsonb_object_keys(preferences) k where k not in ('revision','emailEnabled','inAppEnabled','categories'))
 or (select count(*) from jsonb_object_keys(preferences->'categories'))<>8 then raise exception using errcode='22023',message='invalid_category'; end if;
 foreach c in array public.notification_categories() loop
  if jsonb_typeof(preferences->'categories'->c) is distinct from 'object' or jsonb_typeof(preferences->'categories'->c->'email') is distinct from 'boolean'
  or jsonb_typeof(preferences->'categories'->c->'inApp') is distinct from 'boolean'
  or (select count(*) from jsonb_object_keys(preferences->'categories'->c))<>2 then raise exception using errcode='22023',message='invalid_category'; end if;
 end loop;
 insert into public.notification_preferences(recipient_id) values(me) on conflict do nothing;
 update public.notification_preferences set revision=revision+1,email_enabled=(preferences->>'emailEnabled')::boolean,
 in_app_enabled=(preferences->>'inAppEnabled')::boolean,categories=preferences->'categories' where recipient_id=me and revision=expected_revision returning * into p;
 if not found then raise exception using errcode='40001',message='preference_conflict'; end if;
 return jsonb_build_object('revision',p.revision,'emailEnabled',p.email_enabled,'inAppEnabled',p.in_app_enabled,'categories',p.categories);
end $$;
create or replace function public.get_notification_availability() returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.notification_config;
begin
 perform public.notification_actor();select * into c from public.notification_config where singleton;
 return jsonb_build_object('emailEnabled',c.email_enabled,'inAppEnabled',c.in_app_enabled,'categories',c.categories,
 'sourceAvailability','{"account":true,"donation_receipts":false,"donations_received":false,"payment_updates":false,"social":false,"crew":false,"workouts":false,"games":false}'::jsonb);
end $$;
create or replace function public.get_admin_notification_config() returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.notification_config;
begin
 perform public.notification_require_admin();select * into c from public.notification_config where singleton;
 return jsonb_build_object('revision',c.revision,'emailEnabled',c.email_enabled,'inAppEnabled',c.in_app_enabled,'categories',c.categories,
 'sourceAvailability','{"account":true,"donation_receipts":false,"donations_received":false,"payment_updates":false,"social":false,"crew":false,"workouts":false,"games":false}'::jsonb);
end $$;
drop function if exists public.set_admin_notification_config(bigint,jsonb,text);
create or replace function public.set_admin_notification_config(expected_revision bigint,config jsonb,expected_actor uuid,reason text default 'reviewed_change')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c text; old_revision bigint;
begin
 -- Compare the captured session actor; ownership still comes from Auth, never this argument.
 if expected_actor is null or expected_actor is distinct from auth.uid() then raise exception using errcode='42501',message='actor_changed'; end if;
 perform public.notification_require_admin();
 if expected_revision is null or config is null or reason is null or reason not in ('reviewed_change','pause_delivery','resume_future_events')
 or jsonb_typeof(config) is distinct from 'object' or jsonb_typeof(config->'emailEnabled') is distinct from 'boolean'
 or jsonb_typeof(config->'inAppEnabled') is distinct from 'boolean' or jsonb_typeof(config->'categories') is distinct from 'object'
 then raise exception using errcode='22023',message='invalid_config'; end if;
 if exists(select 1 from jsonb_object_keys(config) k where k not in ('revision','emailEnabled','inAppEnabled','categories','sourceAvailability'))
 or (select count(*) from jsonb_object_keys(config->'categories'))<>8 then raise exception using errcode='22023',message='invalid_category'; end if;
 foreach c in array public.notification_categories() loop
  if jsonb_typeof(config->'categories'->c) is distinct from 'boolean' then raise exception using errcode='22023',message='invalid_category'; end if;
  if c<>'account' and (config->'categories'->>c)::boolean then raise exception using errcode='22023',message='source_unavailable'; end if;
 end loop;
 select revision into old_revision from public.notification_config where singleton for update;
 if old_revision is distinct from expected_revision then raise exception using errcode='40001',message='config_conflict'; end if;
 update public.notification_config set revision=revision+1,email_enabled=(config->>'emailEnabled')::boolean,
 in_app_enabled=(config->>'inAppEnabled')::boolean,categories=config->'categories' where singleton;
 -- Pause suppresses queued work permanently: resuming applies to future events only.
 update public.notification_deliveries set status='suppressed',last_error_code='channel_paused',updated_at=now(),lease_token=null,lease_until=null
 where (status='queued' or (status='attempting' and started_at is null)) and
 (not (config->>'emailEnabled')::boolean or not coalesce((config->'categories'->>category)::boolean,false));
 insert into public.notification_admin_audit(actor_id,action,reason,before_revision,after_revision) values(auth.uid(),'config',reason,old_revision,old_revision+1);
 return public.get_admin_notification_config();
end $$;
create or replace function public.get_admin_notification_jobs(cursor text default null,page_size integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cursor_id uuid; cursor_at timestamptz; items jsonb; next_cursor text;
begin
 perform public.notification_require_admin();
 if page_size is null or page_size not between 1 and 50 then raise exception using errcode='22023',message='invalid_page'; end if;
 if cursor is not null then
  begin cursor_id:=cursor::uuid; exception when invalid_text_representation then raise exception using errcode='22023',message='invalid_cursor'; end;
  select created_at into cursor_at from public.notification_deliveries where id=cursor_id;
  if not found then raise exception using errcode='22023',message='invalid_cursor'; end if;
 end if;
 with page as(select * from public.notification_deliveries where (status in ('failed','unknown','bounced') or (status='attempting' and started_at is not null and lease_until<=now()))
 and (cursor is null or (created_at,id)<(cursor_at,cursor_id)) order by created_at desc,id desc limit page_size+1),
 visible as(select * from page order by created_at desc,id desc limit page_size)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'status',case when status='attempting' then 'unknown' else status end,'attempts',attempts,
 'lastErrorCode',case when status='failed' and retryable and attempts<3 then 'NOTIF_RETRYABLE'
 when status in ('attempting','unknown') then 'NOTIF_UNKNOWN' when status='bounced' then 'NOTIF_PROVIDER_SUPPRESSION' else 'NOTIF_FAILED' end,
 'createdAt',created_at,'updatedAt',updated_at) order by created_at desc,id desc),'[]'::jsonb),
 case when (select count(*) from page)>page_size then (select id::text from visible order by created_at,id limit 1) else null end into items,next_cursor from visible;
 return jsonb_build_object('items',items,'nextCursor',next_cursor);
end $$;
drop function if exists public.retry_notification_job(uuid,text);
create or replace function public.retry_notification_job(job_id uuid,expected_actor uuid,reason text default 'retry_known_failure') returns boolean language plpgsql security definer set search_path='' as $$
declare d public.notification_deliveries; c public.notification_config;
begin
 -- Compare the captured session actor; ownership still comes from Auth, never this argument.
 if expected_actor is null or expected_actor is distinct from auth.uid() then raise exception using errcode='42501',message='actor_changed'; end if;
 perform public.notification_require_admin();
 if reason is distinct from 'retry_known_failure' then raise exception using errcode='22023',message='invalid_retry_reason'; end if;
 select * into d from public.notification_deliveries where id=job_id for update;
 select * into c from public.notification_config where singleton;
 if d.id is null or d.status<>'failed' or not d.retryable or d.attempts>=3 or not c.email_enabled
 or not coalesce((c.categories->>d.category)::boolean,false) or d.created_at<now()-interval '24 hours'
 or not public.notification_source_eligible(d.event_id,d.recipient_id) then raise exception using errcode='42501',message='retry_denied'; end if;
 update public.notification_deliveries set status='queued',retryable=false,last_error_code=null,lease_token=null,lease_until=null,started_at=null,updated_at=now() where id=job_id;
 insert into public.notification_admin_audit(actor_id,action,job_id,reason) values(auth.uid(),'retry',job_id,reason);return true;
end $$;
create or replace function public.get_admin_notification_health() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.notification_require_admin();
 select jsonb_build_object('asOf',now(),'windowStart',now()-interval '24 hours',
 'pending',(select count(*) from public.notification_deliveries where status='queued'),
 'oldestPendingSeconds',(select max(extract(epoch from now()-d.created_at)) from public.notification_deliveries d
 join public.notification_preferences p on p.recipient_id=d.recipient_id cross join public.notification_config c
 where d.status='queued' and d.created_at>=now()-interval '24 hours' and c.singleton and c.email_enabled and p.email_enabled
 and coalesce((c.categories->>d.category)::boolean,false) and coalesce((p.categories->d.category->>'email')::boolean,false)
 and public.notification_source_eligible(d.event_id,d.recipient_id)),
 'attempted',(select count(*) from public.notification_delivery_attempts where created_at>=now()-interval '24 hours'),
 'accepted',(select count(*) from public.notification_delivery_attempts where outcome in ('accepted','delivered','bounced') and finished_at>=now()-interval '24 hours'),
 'delivered',(select count(*) from public.notification_delivery_attempts where outcome='delivered' and finished_at>=now()-interval '24 hours'),
 'suppressed',(select count(*) from public.notification_deliveries where status='suppressed' and updated_at>=now()-interval '24 hours'),
 'failed',(select count(*) from public.notification_delivery_attempts where outcome='failed' and finished_at>=now()-interval '24 hours'),
 'bounced',(select count(*) from public.notification_delivery_attempts where outcome='bounced' and finished_at>=now()-interval '24 hours'),
 'unknown',(select count(*) from public.notification_deliveries where (status='unknown' and updated_at>=now()-interval '24 hours')
 or (status='attempting' and started_at is not null and lease_until<=now() and lease_until>=now()-interval '24 hours')),
 'providerEvidence',false) into result;return result;
end $$;
create or replace function public.notification_activate_account(recipient_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare activation public.notification_account_activations; e uuid; p public.notification_preferences; c public.notification_config;
begin
 select * into activation from public.notification_account_activations a where a.recipient_id=notification_activate_account.recipient_id for update;
 if not found then return null; end if;
 if not exists(select 1 from auth.users u join public.profiles f on f.user_id=u.id where u.id=recipient_id and f.age_blocked_at is null
 and f.role<>'guest' and public.profile_age_band(f.id) in ('adult','teen_13_15','teen_16_17')
 and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null) then return null; end if;
 if activation.activated_at is not null then
  select id into e from public.notification_events where event_key='account_welcome:'||recipient_id::text;return e;
 end if;
 insert into public.notification_events(event_key,event_type,category,reference_id,payload)
 values('account_welcome:'||recipient_id::text,'account_welcome','account',recipient_id,
 jsonb_build_object('version',1,'kind','account_welcome','referenceId',recipient_id)) on conflict(event_key) do nothing;
 select id into e from public.notification_events where event_key='account_welcome:'||recipient_id::text;
 update public.notification_account_activations a set activated_at=now() where a.recipient_id=notification_activate_account.recipient_id;
 insert into public.notification_preferences(recipient_id) values(recipient_id) on conflict do nothing;
 select * into p from public.notification_preferences n where n.recipient_id=notification_activate_account.recipient_id;
 select * into c from public.notification_config where singleton;
 if c.in_app_enabled and coalesce((c.categories->>'account')::boolean,false) and p.in_app_enabled and (p.categories->'account'->>'inApp')::boolean then
  insert into public.notification_inbox(event_id,recipient_id) values(e,recipient_id) on conflict do nothing;
 end if;
 if c.email_enabled and coalesce((c.categories->>'account')::boolean,false) and p.email_enabled and (p.categories->'account'->>'email')::boolean then
  insert into public.notification_deliveries(event_id,recipient_id,category) values(e,recipient_id,'account') on conflict do nothing;
 end if;
 return e;
end $$;
create or replace function public.emit_notification_event(event_key text,event_type text,reference_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform public.notification_require_service();
 if event_type is distinct from 'account_welcome' or reference_id is null or event_key is distinct from 'account_welcome:'||reference_id::text
 then raise exception using errcode='22023',message='invalid_source'; end if;
 return public.notification_activate_account(reference_id);
end $$;
create or replace function public.notification_auth_activation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- INSERT enrollment only prevents welcoming returning accounts or profile repairs after migration.
 if tg_op='INSERT' then insert into public.notification_account_activations(recipient_id) values(new.id) on conflict do nothing; end if;
 perform public.notification_activate_account(new.id);return new;
end $$;
create or replace function public.notification_profile_activation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.notification_activate_account(new.user_id);return new;
end $$;
drop trigger if exists zz_notification_auth_activation on auth.users;
create trigger zz_notification_auth_activation after insert or update on auth.users for each row execute function public.notification_auth_activation();
drop trigger if exists zz_notification_profile_activation on public.profiles;
create trigger zz_notification_profile_activation after insert or update on public.profiles for each row execute function public.notification_profile_activation();
create or replace function public.claim_notification_jobs(worker_id uuid,batch_size integer default 20,lease_seconds integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $$
declare jobs jsonb; expired_job public.notification_deliveries;
begin
 perform public.notification_require_service();
 if worker_id is null or batch_size is null or batch_size not between 1 and 50 or lease_seconds is null or lease_seconds not between 10 and 300
 then raise exception using errcode='22023',message='invalid_lease'; end if;
 -- Completion also locks delivery before attempt; recovery must keep that order to avoid deadlocks.
 -- A started send may have reached its provider, so expiry records unknown and never grants another send.
 for expired_job in select * from public.notification_deliveries where status='attempting' and lease_until<=now()
 order by lease_until,id limit batch_size for update skip locked loop
  if expired_job.started_at is not null then
   update public.notification_delivery_attempts a set outcome='unknown',error_code='transport_unknown',finished_at=now()
   where a.job_id=expired_job.id and a.lease_token=expired_job.lease_token and a.outcome='attempting';
   update public.notification_deliveries set status='unknown',last_error_code='transport_unknown',retryable=false,updated_at=now()
   where id=expired_job.id;
  else
   update public.notification_deliveries set status='queued',lease_token=null,lease_until=null,updated_at=now()
   where id=expired_job.id;
  end if;
 end loop;
 update public.notification_deliveries set status='suppressed',last_error_code='event_expired',updated_at=now()
 where status='queued' and created_at<now()-interval '24 hours';
 update public.notification_deliveries set status='suppressed',last_error_code='recipient_ineligible',updated_at=now()
 where status='queued' and not public.notification_source_eligible(event_id,recipient_id);
 with candidates as(select id from public.notification_deliveries where status='queued' and attempts<3 order by created_at,id limit batch_size for update skip locked),
 leased as(update public.notification_deliveries d set status='attempting',lease_token=gen_random_uuid(),lease_until=now()+make_interval(secs=>lease_seconds),started_at=null,updated_at=now()
 from candidates c where d.id=c.id returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'eventId',d.event_id,'recipientId',d.recipient_id,'category',d.category,'payload',e.payload,
 'leaseToken',d.lease_token,'attemptNumber',d.attempts+1,'idempotencyKey','notification:'||d.id::text)),'[]'::jsonb) into jobs from leased d join public.notification_events e on e.id=d.event_id;
 return jobs;
end $$;
create or replace function public.authorize_notification_send(job_id uuid,lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.notification_deliveries; c public.notification_config; p public.notification_preferences; reason text; verified_email text;
begin
 perform public.notification_require_service();
 if job_id is null or lease_token is null then raise exception using errcode='22023',message='invalid_lease'; end if;
 select * into d from public.notification_deliveries where id=job_id;
 if d.id is null or d.status<>'attempting' or d.lease_token is distinct from lease_token or d.lease_until<=now() then reason:='lease_lost';
 else
  select * into c from public.notification_config where singleton;select * into p from public.notification_preferences where recipient_id=d.recipient_id;
  if d.created_at<now()-interval '24 hours' then reason:='event_expired';
  elsif not c.email_enabled then reason:='channel_paused';
  elsif not coalesce((c.categories->>d.category)::boolean,false) then reason:='category_paused';
  elsif d.category<>'account' then reason:='source_unavailable';
  elsif not public.notification_source_eligible(d.event_id,d.recipient_id) then reason:='recipient_ineligible';
  elsif p.recipient_id is null or not p.email_enabled then reason:='email_opt_out';
  elsif not coalesce((p.categories->d.category->>'email')::boolean,false) then reason:='category_opt_out';
  else
   select u.email into verified_email from auth.users u where u.id=d.recipient_id and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null;
   if verified_email is null or length(verified_email)>320 or verified_email !~ '^[^[:space:]@]+@[^[:space:]@]+$' then reason:='email_unverified';
   elsif exists(select 1 from public.notification_deliveries old where old.recipient_id=d.recipient_id and old.status='bounced') then reason:='provider_suppression';
   else reason:='unsubscribe_unavailable'; end if;
  end if;
 end if;
 -- No application email may send until a separately reviewed unsubscribe contract exists.
 return jsonb_build_object('allowed',false,'reason',reason);
end $$;
create or replace function public.begin_notification_attempt(job_id uuid,lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.notification_deliveries; authorization jsonb;
begin
 if job_id is null or lease_token is null then raise exception using errcode='22023',message='invalid_lease'; end if;
 perform public.notification_require_service();select * into d from public.notification_deliveries where id=job_id for update;
 if d.started_at is not null then return jsonb_build_object('allowed',false,'reason','lease_lost'); end if;
 authorization:=public.authorize_notification_send(job_id,lease_token);
 if not coalesce((authorization->>'allowed')::boolean,false) then
  -- The worker persists suppression through complete; preserve its lease until that write.
  return authorization;
 end if;
 -- Only a fresh authorization snapshot may be handed to a future configured transport.
 if d.attempts>=3 then return jsonb_build_object('allowed',false,'reason','lease_lost'); end if;
 update public.notification_deliveries set attempts=attempts+1,started_at=now(),updated_at=now() where id=job_id;
 insert into public.notification_delivery_attempts(job_id,attempt_number,lease_token,outcome) values(job_id,d.attempts+1,lease_token,'attempting');
 return authorization;
end $$;
create or replace function public.release_notification_job(job_id uuid,lease_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare d public.notification_deliveries; authorization jsonb;
begin
 if job_id is null or lease_token is null then raise exception using errcode='22023',message='invalid_lease'; end if;
 perform public.notification_require_service();select * into d from public.notification_deliveries where id=job_id for update;
 if d.id is null or d.lease_token is distinct from lease_token or d.status<>'attempting' or d.started_at is not null or d.lease_until<=now() then return false; end if;
 authorization:=public.authorize_notification_send(job_id,lease_token);
 update public.notification_deliveries set status=case when authorization->>'reason'='unsubscribe_unavailable' then 'queued' else 'suppressed' end,
 last_error_code=case when authorization->>'reason'='unsubscribe_unavailable' then null else authorization->>'reason' end,lease_token=null,lease_until=null,updated_at=now() where id=job_id;
 return true;
end $$;
create or replace function public.complete_notification_attempt(job_id uuid,lease_token uuid,outcome text,error_code text default null,provider_message_id text default null,safe_retry boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare d public.notification_deliveries; retry boolean;
begin
 perform public.notification_require_service();
 if job_id is null or lease_token is null then raise exception using errcode='22023',message='invalid_lease'; end if;
 if outcome is null or outcome not in ('accepted','suppressed','failed','unknown') or safe_retry is null
 or (provider_message_id is not null and provider_message_id !~ '^[A-Za-z0-9_-]{1,120}$')
 or (error_code is not null and error_code not in ('transport_unknown','invalid_authorization','invalid_payload','email_opt_out','category_opt_out','channel_paused','category_paused',
 'source_unavailable','recipient_ineligible','email_unverified','provider_suppression','business_state_changed','event_expired','lease_lost','unsubscribe_unavailable',
 'provider_unavailable','provider_rejected','provider_rate_limited')) then raise exception using errcode='22023',message='invalid_attempt'; end if;
 select * into d from public.notification_deliveries where id=job_id for update;
 if d.id is null or d.lease_token is distinct from lease_token or d.status<>'attempting' then return false; end if;
 -- No acceptance without a durable start; expired started work can only become unknown.
 if d.started_at is null and outcome<>'suppressed' then raise exception using errcode='42501',message='attempt_not_started'; end if;
 if d.started_at is not null and d.lease_until<=now() and outcome<>'unknown' then raise exception using errcode='42501',message='lease_lost'; end if;
 if outcome in ('failed','unknown','suppressed') and error_code is null then raise exception using errcode='22023',message='invalid_attempt'; end if;
 if outcome='accepted' and (error_code is not null or provider_message_id is null) then raise exception using errcode='22023',message='invalid_attempt'; end if;
 retry:=outcome='failed' and safe_retry and error_code in ('provider_unavailable','provider_rate_limited') and d.attempts<3;
 if d.started_at is not null then
  update public.notification_delivery_attempts a set outcome=complete_notification_attempt.outcome,error_code=complete_notification_attempt.error_code,
  provider_message_id=complete_notification_attempt.provider_message_id,finished_at=now() where a.job_id=complete_notification_attempt.job_id and a.lease_token=complete_notification_attempt.lease_token and a.outcome='attempting';
  if not found then raise exception using errcode='42501',message='attempt_not_started'; end if;
 end if;
 update public.notification_deliveries set status=outcome,last_error_code=error_code,retryable=coalesce(retry,false),lease_token=null,lease_until=null,updated_at=now() where id=job_id;
 return true;
end $$;
-- Tables remain RPC-only even under Supabase's default table/function grants.
do $$
declare t text; fn record;
begin
 foreach t in array array['notification_config','notification_preferences','notification_events','notification_account_activations','notification_inbox',
 'notification_inbox_snapshots','notification_deliveries','notification_delivery_attempts','notification_admin_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('drop policy if exists "Closed accounts" on public.%I',t);
  execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated using (public.my_profile_id() is not null) with check (public.my_profile_id() is not null)',t);
 end loop;
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and (p.proname like 'notification_%' or p.proname in ('get_notification_preferences','save_notification_preferences','get_notification_availability',
 'get_notification_inbox','set_notification_read','mark_all_notifications_read','set_notification_archived','get_admin_notification_config',
 'set_admin_notification_config','get_admin_notification_jobs','retry_notification_job','get_admin_notification_health','emit_notification_event',
 'claim_notification_jobs','authorize_notification_send','begin_notification_attempt','release_notification_job','complete_notification_attempt')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.signature);
 end loop;
end $$;
grant execute on function public.get_notification_preferences(),public.save_notification_preferences(bigint,jsonb,uuid),public.get_notification_availability(),
 public.get_notification_inbox(boolean,text,integer),public.set_notification_read(uuid,boolean),public.mark_all_notifications_read(text),public.set_notification_archived(uuid,boolean) to authenticated;
grant execute on function public.get_admin_notification_config(),public.set_admin_notification_config(bigint,jsonb,uuid,text),public.get_admin_notification_jobs(text,integer),
 public.retry_notification_job(uuid,uuid,text),public.get_admin_notification_health() to authenticated,service_role;
grant execute on function public.emit_notification_event(text,text,uuid),public.claim_notification_jobs(uuid,integer,integer),public.authorize_notification_send(uuid,uuid),
 public.begin_notification_attempt(uuid,uuid),public.release_notification_job(uuid,uuid),public.complete_notification_attempt(uuid,uuid,text,text,text,boolean) to service_role;

-- Reject NULL manager roles before any thank-you write; this does not enroll a social source.
create or replace function public.thank_donation(target_tip_id uuid, message_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tips;
  role text;
begin
  select * into t from public.tips where id = target_tip_id;
  if t.id is null then
    raise exception 'Donation not found';
  end if;
  role := public.rally_manager_role(t.player_id);
  if role is null or role not in ('athlete', 'guardian') then
    raise exception 'Only the athlete or their parent / guardian can say thanks';
  end if;
  if t.fan_id is null then
    raise exception 'This donor can''t receive a thank-you';
  end if;
  if message_key not in ('malo', 'season', 'gear', 'family', 'work') then
    raise exception 'Pick one of the thank-you messages';
  end if;
  insert into public.donation_thanks (tip_id, player_id, thanked_by, message_key)
  values (t.id, t.player_id, (select id from public.profiles where user_id = auth.uid() limit 1), message_key)
  on conflict (tip_id) do nothing;
  return found;
end;
$$;
revoke all on function public.thank_donation(uuid,text) from public,anon;
grant execute on function public.thank_donation(uuid,text) to authenticated;
