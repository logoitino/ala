-- DETECT-02: restricted support evidence, independent reviews, release provenance and atomic audit.
-- Dependencies: current_user_role(), auth.uid(), September RBAC and October bookkeeping tables.
-- Local replay only. The owner applies SQL. No financial rules or payout gates are changed.
-- Rollback: revoke RPC execution and remove source audit triggers after review; retain evidence.
-- Trust boundary: DB owners/superusers can disable triggers/change functions and recompute hashes.
-- Chains detect accidental/application tampering; they are not signed or externally anchored.

begin;

-- Fixed vocabulary keeps client reports from carrying private payloads or arbitrary diagnostic text.
create or replace function public.support_code_metadata(p_code text)
returns jsonb language sql immutable set search_path = '' as $$
  select case p_code
    when 'render_failure' then '["ui","error"]'::jsonb
    when 'runtime_failure' then '["runtime","error"]'::jsonb
    when 'unhandled_rejection' then '["runtime","error"]'::jsonb
    when 'read_timeout' then '["network","warning"]'::jsonb
    when 'network_unavailable' then '["network","warning"]'::jsonb
    when 'read_failed' then '["data","error"]'::jsonb
    when 'user_cancelled' then '["ui","info"]'::jsonb
    when 'auth_expired' then '["runtime","info"]'::jsonb
    when 'data_invalid' then '["data","error"]'::jsonb
    when 'payment_failed' then '["finance","error"]'::jsonb
    when 'access_denied' then '["security","warning"]'::jsonb
    when 'suspicious_pattern' then '["security","warning"]'::jsonb
    when 'confirmed_attack' then '["security","critical"]'::jsonb
    when 'syntax_check_failed' then '["syntax","error"]'::jsonb
    when 'user_report' then '["user_report","warning"]'::jsonb
    when 'recovery_succeeded' then '["runtime","info"]'::jsonb
    when 'recovery_failed' then '["runtime","error"]'::jsonb
    when 'auth_invalid' then '["security","warning"]'::jsonb
    when 'auth_unavailable' then '["network","error"]'::jsonb
    when 'server_configuration_error' then '["runtime","critical"]'::jsonb
  end
$$;
revoke all on function public.support_code_metadata(text) from public, anon, authenticated, service_role;

create table if not exists public.support_signals (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null check (char_length(fingerprint) <= 180),
  feature text not null check (feature in ('app','highlights','activity','local','spotlight','drip','profile','auth','donation','payouts','operator','upload','admin','support')),
  code text not null check (public.support_code_metadata(code) is not null),
  category text not null check (category = public.support_code_metadata(code)->>0),
  severity text not null check (severity = public.support_code_metadata(code)->>1),
  source text not null check (source in ('client','server','security','check')),
  environment text not null check (environment in ('development','test','preview','production')),
  release text not null check (release ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  check (source <> 'client' or (actor_id is not null and code not in ('confirmed_attack','syntax_check_failed','auth_invalid','auth_unavailable','server_configuration_error'))),
  check (code <> 'confirmed_attack' or source = 'security')
);
create index if not exists support_signals_read_idx on public.support_signals(occurred_at desc,id desc);
create index if not exists support_signals_scope_idx on public.support_signals(fingerprint,occurred_at desc);
create index if not exists support_signals_actor_rate_idx on public.support_signals(actor_id,occurred_at desc) where source='client';

create table if not exists public.support_reviews (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null check (char_length(fingerprint) <= 180),
  disposition text not null check (disposition in ('investigating','expected','false_positive','resolved','confirmed_attack')),
  rationale text not null check (char_length(btrim(rationale)) between 8 and 500 and octet_length(rationale) <= 2000),
  reviewed_through timestamptz not null,
  actor_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  decision text not null check (decision in ('pending','confirmed')),
  parent_review_id uuid unique references public.support_reviews(id)
);
create index if not exists support_reviews_read_idx on public.support_reviews(created_at desc,id desc);
create index if not exists support_reviews_scope_idx on public.support_reviews(fingerprint,created_at desc);

create table if not exists public.support_audit_events (
  id uuid primary key default gen_random_uuid(),
  chain_index bigint generated always as identity unique,
  actor_id uuid,
  actor_role text not null,
  occurred_at timestamptz not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  record_id text not null check (char_length(record_id) <= 128),
  changed_fields text[] not null,
  previous_hash text check (previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists support_audit_read_idx on public.support_audit_events(chain_index desc);
create index if not exists support_audit_chain_idx on public.support_audit_events(table_name,record_id,chain_index desc);

create table if not exists public.support_releases (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  manifest jsonb not null check (jsonb_typeof(manifest)='object' and octet_length(manifest::text) <= 65536)
);
create index if not exists support_releases_read_idx on public.support_releases(created_at desc,id desc);

-- Every API role, including the server credential role, uses scoped RPCs rather than table writes.
alter table public.support_signals enable row level security;
alter table public.support_reviews enable row level security;
alter table public.support_audit_events enable row level security;
alter table public.support_releases enable row level security;
revoke all on public.support_signals,public.support_reviews,public.support_audit_events,public.support_releases from public,anon,authenticated,service_role;
revoke all on sequence public.support_audit_events_chain_index_seq from public,anon,authenticated,service_role;

create or replace function public.guard_support_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Support evidence is append-only'; end $$;
revoke all on function public.guard_support_append_only() from public,anon,authenticated,service_role;
do $$ declare t text; begin
  foreach t in array array['support_signals','support_reviews','support_audit_events','support_releases'] loop
    execute format('drop trigger if exists support_append_only on public.%I',t);
    execute format('create trigger support_append_only before update or delete or truncate on public.%I for each statement execute function public.guard_support_append_only()',t);
  end loop;
end $$;

-- Internal insertion has no public EXECUTE; immutable scope and actor are derived by RPC wrappers.
create or replace function public.insert_support_signal(p_feature text,p_code text,p_environment text,p_release text,p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_meta jsonb; v_scope text; v_actor uuid := auth.uid(); v_count integer; v_time timestamptz;
begin
  v_meta := public.support_code_metadata(p_code);
  if p_feature is null or p_feature not in ('app','highlights','activity','local','spotlight','drip','profile','auth','donation','payouts','operator','upload','admin','support')
    or v_meta is null or p_environment is null or p_environment not in ('development','test','preview','production')
    or p_release is null or p_release !~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    or p_source is null or p_source not in ('client','server','security','check') then
    raise exception 'Invalid support signal vocabulary';
  end if;
  if p_source='client' and (v_actor is null or p_code in ('confirmed_attack','syntax_check_failed','auth_invalid','auth_unavailable','server_configuration_error')) then
    raise exception 'Trusted code or signed-in actor required';
  end if;
  if p_code='confirmed_attack' and p_source<>'security' then raise exception 'Confirmed attack requires security source'; end if;
  v_scope := p_feature||':'||p_code||':'||p_source||':'||p_environment||':'||p_release;
  -- Serialize only one reporting account/scope. No global audit lock or automatic repair.
  if p_source='client' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-rate:'||v_actor::text,0));
    select count(*) into v_count from public.support_signals where source='client' and actor_id=v_actor and occurred_at>clock_timestamp()-interval '1 minute';
    if v_count>=30 then raise exception 'Support client rate limit reached'; end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-rate:'||v_scope,0));
    select count(*) into v_count from public.support_signals where fingerprint=v_scope and occurred_at>clock_timestamp()-interval '1 minute';
    if v_count>=120 then raise exception 'Support trusted rate limit reached'; end if;
  end if;
  -- Equal clock readings cannot let a later occurrence inherit an earlier review's coverage.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-occurrence:'||v_scope,0));
  select greatest(clock_timestamp(),max(occurred_at)+interval '1 microsecond') into v_time from public.support_signals where fingerprint=v_scope;
  insert into public.support_signals(fingerprint,feature,code,category,severity,source,environment,release,actor_id,occurred_at)
    values(v_scope,p_feature,p_code,v_meta->>0,v_meta->>1,p_source,p_environment,p_release,v_actor,v_time) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.insert_support_signal(text,text,text,text,text) from public,anon,authenticated,service_role;

-- Signed-in clients submit minimal untrusted reports; category/severity cannot be forged.
create or replace function public.record_support_signal(p_feature text,p_code text,p_environment text,p_release text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Signed-in actor required'; end if;
  return public.insert_support_signal(p_feature,p_code,p_environment,p_release,'client');
end $$;
revoke all on function public.record_support_signal(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_support_signal(text,text,text,text) to authenticated;

-- The actual PostgREST role, rather than user_metadata/JWT text alone, gates trusted capture.
create or replace function public.record_trusted_support_signal(p_feature text,p_code text,p_environment text,p_release text,p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role',true)<>'service_role' then raise exception 'Trusted service role required'; end if;
  if p_source is null or p_source not in ('server','security','check') then raise exception 'Invalid trusted source'; end if;
  return public.insert_support_signal(p_feature,p_code,p_environment,p_release,p_source);
end $$;
revoke all on function public.record_trusted_support_signal(text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_trusted_support_signal(text,text,text,text,text) to service_role;

-- Admin reviews retain original occurrences and decisions. Later occurrences reopen the issue.
create or replace function public.record_support_review(p_fingerprint text,p_disposition text,p_rationale text,p_reviewed_through timestamptz,p_parent_review_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_signal public.support_signals; v_parent public.support_reviews; v_id uuid; v_decision text; v_latest timestamptz; v_time timestamptz;
begin
  if auth.uid() is null or public.current_user_role()<>'admin' then raise exception 'Admin access required'; end if;
  if p_fingerprint is null or char_length(p_fingerprint)>180 or p_disposition is null or p_disposition not in ('investigating','expected','false_positive','resolved','confirmed_attack')
    or p_rationale is null or char_length(btrim(p_rationale)) not between 8 and 500 or octet_length(p_rationale)>2000
    or p_rationale ~ '[[:cntrl:]]' or p_reviewed_through is null then raise exception 'Invalid review bounds'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-review:'||p_fingerprint,0));
  select * into v_signal from public.support_signals where fingerprint=p_fingerprint order by occurred_at desc,id desc limit 1;
  if not found then raise exception 'Review source not found'; end if;
  v_latest := v_signal.occurred_at;
  -- Require an actual occurrence, not a future timestamp that could suppress unseen evidence.
  if p_reviewed_through>v_latest or not exists(select 1 from public.support_signals where fingerprint=p_fingerprint and occurred_at=p_reviewed_through) then
    raise exception 'Review must match an existing occurrence';
  end if;
  if p_disposition='confirmed_attack' and (v_signal.source<>'security' or v_signal.code<>'confirmed_attack') then
    raise exception 'Confirmed attack requires trusted security source';
  end if;
  if p_parent_review_id is not null then
    select * into v_parent from public.support_reviews where id=p_parent_review_id;
    if not found or v_parent.decision<>'pending' or v_parent.parent_review_id is not null or v_parent.fingerprint<>p_fingerprint
      or v_parent.disposition<>p_disposition or v_parent.reviewed_through<>p_reviewed_through then raise exception 'Second review must match pending review'; end if;
    if v_parent.actor_id=auth.uid() then raise exception 'Second reviewer must be independent'; end if;
    if p_reviewed_through<>v_latest then raise exception 'New occurrence requires a new review'; end if;
    v_decision := 'confirmed';
  elsif (v_signal.category in ('security','finance') or v_signal.feature in ('auth','donation','payouts','admin','support')) and p_disposition<>'investigating' then v_decision := 'pending';
  else v_decision := 'confirmed'; end if;
  select greatest(clock_timestamp(),max(created_at)+interval '1 microsecond') into v_time from public.support_reviews where fingerprint=p_fingerprint;
  insert into public.support_reviews(fingerprint,disposition,rationale,reviewed_through,actor_id,decision,parent_review_id,created_at)
    values(p_fingerprint,p_disposition,btrim(p_rationale),p_reviewed_through,auth.uid(),v_decision,p_parent_review_id,v_time) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_support_review(text,text,text,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function public.record_support_review(text,text,text,timestamptz,uuid) to authenticated;

-- Registration records reported local capsule verification. It does not certify signer/deployment.
create or replace function public.register_support_release(p_manifest jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_m jsonb; v_date timestamptz;
begin
  if auth.uid() is null or public.current_user_role()<>'admin' then raise exception 'Admin access required'; end if;
  if p_manifest is null or jsonb_typeof(p_manifest)<>'object' or octet_length(p_manifest::text)>65536
    or (select array_agg(k order by k) from jsonb_object_keys(p_manifest) k) is distinct from
      array['byteCount','capsuleHash','createdAt','filesCount','gitCommit','manifestHash','migrationHashes','provenanceHash','releaseId','schemaHash','treeHash','verification','version']::text[] then
    raise exception 'Invalid release manifest keys or bounds';
  end if;
  if p_manifest->'version'<>'1'::jsonb or jsonb_typeof(p_manifest->'releaseId')<>'string' or p_manifest->>'releaseId' !~ '^[a-z0-9][a-z0-9-]{0,79}$'
    or jsonb_typeof(p_manifest->'createdAt')<>'string' or p_manifest->>'createdAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$'
    or not (p_manifest->'gitCommit'='null'::jsonb or (jsonb_typeof(p_manifest->'gitCommit')='string' and p_manifest->>'gitCommit' ~ '^[a-f0-9]{40}$'))
    or not (p_manifest->'schemaHash'='null'::jsonb or (jsonb_typeof(p_manifest->'schemaHash')='string' and p_manifest->>'schemaHash' ~ '^[a-f0-9]{64}$'))
    or jsonb_typeof(p_manifest->'verification')<>'string' or p_manifest->>'verification' not in ('not-run','passed')
    or jsonb_typeof(p_manifest->'filesCount')<>'number' or (p_manifest->>'filesCount') !~ '^\d+$' or (p_manifest->>'filesCount')::numeric not between 1 and 100000
    or jsonb_typeof(p_manifest->'byteCount')<>'number' or (p_manifest->>'byteCount') !~ '^\d+$' or (p_manifest->>'byteCount')::numeric not between 0 and 10737418240
    or jsonb_typeof(p_manifest->'migrationHashes')<>'array' or jsonb_array_length(p_manifest->'migrationHashes')>1000 then
    raise exception 'Invalid release manifest values';
  end if;
  v_date := (p_manifest->>'createdAt')::timestamptz;
  if v_date<'2020-01-01'::timestamptz or v_date>clock_timestamp()+interval '5 minutes' then raise exception 'Invalid package time'; end if;
  if exists(select 1 from unnest(array['treeHash','manifestHash','capsuleHash','provenanceHash']) k where jsonb_typeof(p_manifest->k)<>'string' or p_manifest->>k !~ '^[a-f0-9]{64}$') then raise exception 'Invalid release hash'; end if;
  for v_m in select value from jsonb_array_elements(p_manifest->'migrationHashes') loop
    if jsonb_typeof(v_m)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(v_m) k) is distinct from array['path','sha256']::text[]
      or jsonb_typeof(v_m->'path')<>'string' or v_m->>'path' !~ '^supabase/migrations/[0-9]{14}_[a-z0-9_]+\.sql$'
      or jsonb_typeof(v_m->'sha256')<>'string' or v_m->>'sha256' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid migration hash entry'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_manifest->'migrationHashes') x group by x->>'path' having count(*)>1) then raise exception 'Duplicate migration path'; end if;
  insert into public.support_releases(actor_id,manifest) values(auth.uid(),p_manifest) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.register_support_release(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.register_support_release(jsonb) to authenticated;

-- Atomic AFTER trigger observes actual field changes, stores no row values and locks only its entity.
create or replace function public.capture_support_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old jsonb := case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(OLD) end;
  v_new jsonb := case when TG_OP='DELETE' then '{}'::jsonb else to_jsonb(NEW) end;
  v_fields text[]; v_record text; v_prev text; v_hash text; v_id uuid := gen_random_uuid();
  v_time timestamptz := clock_timestamp(); v_actor uuid := auth.uid(); v_role text := public.current_user_role(); v_payload jsonb;
begin
  select array_agg(k order by k) into v_fields from (select jsonb_object_keys(v_old||v_new) k) keys where v_old->k is distinct from v_new->k;
  if v_fields is null then return null; end if;
  if TG_TABLE_NAME='profiles' then
    v_fields := array(select f from unnest(v_fields) f where f in ('role','roles','is_admin','active_role','player_id','is_verified','verification_status','stripe_connect_id','malo_frozen','payouts_enabled'));
    if cardinality(v_fields)=0 then return null; end if;
    if TG_OP<>'INSERT' and v_old->>'user_id'=v_actor::text then
      v_role := case when coalesce((v_old->>'is_admin')::boolean,false) or v_old->>'role'='admin' or coalesce(v_old->'roles','[]'::jsonb) ? 'admin' then 'admin' else coalesce(v_old->>'role','guest') end;
    end if;
  elsif TG_TABLE_NAME in ('games','reels','players') and v_role<>'admin' and current_setting('role',true)<>'service_role' then
    v_fields := array(select f from unnest(v_fields) f where f in ('guardian_id','parental_consent_approved','malo_frozen','is_verified','verification_status','is_hidden','is_published','status'));
    if cardinality(v_fields)=0 then return null; end if;
  end if;
  if current_setting('role',true)='service_role' then v_role := 'service_role';
  elsif v_actor is null then v_role := 'database_operator'; end if;
  v_record := coalesce(v_new->>'id',v_old->>'id',v_new->>'user_id',v_old->>'user_id',v_new->>'code',v_old->>'code',v_new->>'period',v_old->>'period');
  if v_record is null then raise exception 'Audited entity requires opaque id'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-audit:'||TG_TABLE_NAME||':'||v_record,0));
  select event_hash into v_prev from public.support_audit_events where table_name=TG_TABLE_NAME and record_id=v_record order by chain_index desc limit 1;
  v_payload := jsonb_build_object('id',v_id,'actor_id',v_actor,'actor_role',v_role,'occurred_at',to_char(v_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'operation',TG_OP,'table_name',TG_TABLE_NAME,'record_id',v_record,'changed_fields',v_fields,'previous_hash',v_prev);
  v_hash := encode(pg_catalog.sha256(convert_to(v_payload::text,'UTF8')),'hex');
  insert into public.support_audit_events(id,actor_id,actor_role,occurred_at,operation,table_name,record_id,changed_fields,previous_hash,event_hash)
    values(v_id,v_actor,v_role,v_time,TG_OP,TG_TABLE_NAME,v_record,v_fields,v_prev,v_hash);
  return null;
end $$;
revoke all on function public.capture_support_audit() from public,anon,authenticated,service_role;

-- Required source scope is explicit; missing dependencies fail activation rather than hiding coverage.
do $$ declare t text; begin
  foreach t in array array['profiles','players','games','reels','app_runtime_config','school_confirmers','tips','disbursements','company_revenue_logs','sponsorships','subscriptions','ledger_accounts','ledger_manual_entries','ledger_manual_lines','ledger_period_closes','ledger_period_reopens'] loop
    if to_regclass('public.'||t) is null then raise exception 'Apply source migrations first: %',t; end if;
    execute format('drop trigger if exists support_actual_write_audit on public.%I',t);
    execute format('create trigger support_actual_write_audit after insert or update or delete on public.%I for each row execute function public.capture_support_audit()',t);
  end loop;
end $$;

-- Admin-only one-statement read. Absence/error remains an error; clients cannot supply unbounded limits.
create or replace function public.get_engineering_support_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.current_user_role()<>'admin' then raise exception 'Admin access required'; end if;
  select jsonb_build_object('version',1,'read_at',clock_timestamp(),
    'signals',coalesce((select jsonb_agg(to_jsonb(s) order by s.occurred_at desc,s.id desc) from (select * from public.support_signals order by occurred_at desc,id desc limit 200) s),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from (select * from public.support_reviews order by created_at desc,id desc limit 300) r),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)-'chain_index' order by a.chain_index desc) from (select * from public.support_audit_events order by chain_index desc limit 200) a),'[]'::jsonb),
    'releases',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id desc) from (select * from public.support_releases order by created_at desc,id desc limit 20) m),'[]'::jsonb),
    'limits',jsonb_build_object('signals',200,'reviews',300,'audit',200,'releases',20)) into v_result;
  return v_result;
end $$;
revoke all on function public.get_engineering_support_snapshot() from public,anon,authenticated,service_role;
grant execute on function public.get_engineering_support_snapshot() to authenticated;

commit;
