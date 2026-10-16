-- FUN-01: default-off, approved-account testing pilot, private immutable media, exact permission and free ballots.
-- Design: docs/engineering/design/FAN_ZONE_DESIGN.md. Written/replayed locally; never applied by this script.
-- Rollback: pause campaigns, retain consent/audit/case records, revoke fun_* API grants and archive media via approved removal.
-- Dependencies: MINOR-01 profile age/guardian links and PRIV-01 profile/block helpers. No financial data is changed.

create table if not exists public.fan_zone_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  theme text not null check (char_length(theme) between 1 and 240),
  period text not null check (period in ('game','week')),
  status text not null default 'draft' check (status in ('draft','open','paused','closed','finalized')),
  testing_only boolean not null default true check (testing_only),
  pilot_accounts uuid[] not null default '{}' check (cardinality(pilot_accounts) <= 100),
  entry_opens_at timestamptz not null,
  entry_closes_at timestamptz not null,
  vote_opens_at timestamptz not null,
  vote_closes_at timestamptz not null,
  rules text not null check (char_length(rules) between 10 and 4000),
  support_contact text not null default '' check (char_length(support_contact) <= 200),
  story_reel_id uuid references public.reels(id) on delete set null,
  opened_at timestamptz,
  results jsonb not null default '[]',
  result_signature text,
  recount_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_opens_at < entry_closes_at and vote_opens_at < vote_closes_at and entry_closes_at <= vote_closes_at)
);
create table if not exists public.fan_zone_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  owner_id uuid not null references public.profiles(id),
  revision integer not null default 1 check (revision between 1 and 100),
  path text not null unique,
  alias text not null default '' check (char_length(alias) <= 40),
  caption text not null default '' check (char_length(caption) <= 240),
  rights_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','submitted','accepted','changes','rejected','suspended','withdrawn')),
  reason text check (char_length(reason) <= 500),
  verified boolean not null default false,
  digest text check (digest ~ '^[a-f0-9]{64}$'),
  bytes integer check (bytes between 1 and 20971520),
  duration_ms integer check (duration_ms between 1000 and 30000),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id,owner_id)
);
create table if not exists public.fan_zone_consents (
  id uuid primary key default gen_random_uuid(),
  sequence_id bigint generated always as identity,
  entry_id uuid not null references public.fan_zone_entries(id),
  revision integer not null,
  actor_id uuid not null references public.profiles(id),
  link_id uuid references public.guardian_links(id),
  action text not null check (action in ('assent','grant','revoke')),
  scope jsonb not null,
  created_at timestamptz not null default now()
);
-- Explicit publication binding: historical grants cannot replace a revoked or ended relied-on grant.
alter table public.fan_zone_entries add column if not exists guardian_consent_id uuid references public.fan_zone_consents(id);
create table if not exists public.fan_zone_ballots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  voter_id uuid not null references public.profiles(id),
  entry_id uuid not null references public.fan_zone_entries(id),
  version integer not null check (version > 0),
  invalidated_at timestamptz,
  invalid_reason text check (char_length(invalid_reason) between 5 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,voter_id)
);
create table if not exists public.fan_zone_requests (
  request_id uuid not null,
  voter_id uuid not null references public.profiles(id),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  entry_id uuid not null,
  expected_version integer not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key(voter_id,request_id)
);
create table if not exists public.fan_zone_cases (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.fan_zone_entries(id),
  revision integer not null,
  path text not null,
  reporter_id uuid references public.profiles(id),
  kind text not null check(kind in ('report','appeal','deletion')),
  details text not null check(char_length(details) between 3 and 1000),
  secret_hash text not null unique,
  status text not null default 'open' check(status in ('open','escalated','resolved','completed')),
  reason text check(char_length(reason) between 5 and 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',
  updated_at timestamptz not null default now()
);
create table if not exists public.fan_zone_audit (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  subject_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.fan_zone_reflections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  owner_id uuid not null references public.profiles(id),
  idea text not null check(idea in ('encourage','help_at_home','serve_together','thank_someone')),
  created_at timestamptz not null default now()
);
create index if not exists fan_zone_consents_entry on public.fan_zone_consents(entry_id,revision,created_at desc);
create index if not exists fan_zone_cases_page on public.fan_zone_cases(entry_id,created_at desc);
-- One deletion request covers every historical revision; exact retries reuse its receipt rather than adding cases.
create unique index if not exists fan_zone_one_deletion on public.fan_zone_cases(entry_id) where kind='deletion';
create index if not exists fan_zone_audit_page on public.fan_zone_audit(campaign_id,created_at desc);

-- Table grants are closed even under Supabase's permissive default privileges. Definer APIs enforce actor gates.
do $$ declare t text; begin
  foreach t in array array['campaigns','entries','consents','ballots','requests','cases','audit','reflections'] loop
    execute format('alter table public.fan_zone_%I enable row level security',t);
    execute format('revoke all on public.fan_zone_%I from public, anon, authenticated',t);
    execute format('grant all on public.fan_zone_%I to service_role',t);
    execute format('drop policy if exists fan_zone_closed_account on public.fan_zone_%I',t);
    execute format('create policy fan_zone_closed_account on public.fan_zone_%I as restrictive for all to authenticated using (public.my_profile_id() is not null) with check (public.my_profile_id() is not null)',t);
  end loop;
end $$;

create or replace function public.fun_eligible(p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
  -- Check the stored closure marker and age band directly; calling this helper from itself recurses.
  select exists(select 1 from public.profiles p where p.id=p_profile and p.age_blocked_at is null
    and public.profile_age_band(p.id) in ('adult','teen_13_15','teen_16_17'));
$$;
create or replace function public.fun_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); begin
  if not public.fun_eligible(me) then raise exception 'FUN_ACCOUNT_INELIGIBLE'; end if; return me;
end $$;
create or replace function public.fun_admin_guard() returns uuid language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); begin
  if not coalesce(public.current_user_role()='admin',false) then raise exception 'FUN_ADMIN_REQUIRED'; end if; return me;
end $$;
create or replace function public.fun_pilot(p_campaign uuid,p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.fun_eligible(p_profile) and exists(select 1 from public.fan_zone_campaigns c where c.id=p_campaign and p_profile=any(c.pilot_accounts));
$$;
create or replace function public.fun_scope(p_entry public.fan_zone_entries) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('campaign_id',p_entry.campaign_id,'revision',p_entry.revision,'digest',p_entry.digest,
 'alias',p_entry.alias,'caption',p_entry.caption,'audience','approved_pilot_accounts','form_version','fan-zone-v1-testing','reuse',false);
$$;
create or replace function public.fun_guardian(p_owner uuid,p_actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.fun_eligible(p_actor) and public.profile_age_band(p_actor)='adult' and public.fun_eligible(p_owner)
 and public.is_minor_band(public.profile_age_band(p_owner)) and not public.is_blocked_between(p_actor,p_owner)
 and exists(select 1 from public.guardian_links l where l.minor_id=p_owner and l.guardian_id=p_actor and l.confirmed_at is not null and l.ended_at is null);
$$;
create or replace function public.fun_guardian_grant_valid(p_entry public.fan_zone_entries) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.fan_zone_consents s join public.guardian_links l on l.id=s.link_id
 where s.id=p_entry.guardian_consent_id and s.entry_id=p_entry.id and s.revision=p_entry.revision
 and s.scope=public.fun_scope(p_entry) and s.action='grant'
 and l.minor_id=p_entry.owner_id and l.guardian_id=s.actor_id and l.confirmed_at is not null and l.ended_at is null
 and public.fun_guardian(p_entry.owner_id,s.actor_id) and not exists(select 1 from public.fan_zone_consents x
 where x.entry_id=s.entry_id and x.revision=s.revision and x.actor_id=s.actor_id and x.sequence_id>s.sequence_id));
$$;
create or replace function public.fun_permission_valid(p_entry public.fan_zone_entries) returns boolean language sql stable security definer set search_path='' as $$
 select public.fun_eligible(p_entry.owner_id) and p_entry.verified and p_entry.removed_at is null and exists(
 select 1 from public.fan_zone_consents s where s.entry_id=p_entry.id and s.revision=p_entry.revision and s.actor_id=p_entry.owner_id
 and s.scope=public.fun_scope(p_entry) and s.action='assent' and not exists(select 1 from public.fan_zone_consents x where x.entry_id=s.entry_id and x.revision=s.revision and x.actor_id=s.actor_id and x.sequence_id>s.sequence_id))
 and (public.profile_age_band(p_entry.owner_id)='adult' or public.fun_guardian_grant_valid(p_entry));
$$;
create or replace function public.fun_candidate(p_entry public.fan_zone_entries) returns boolean language sql stable security definer set search_path='' as $$
 select p_entry.status='accepted' and public.fun_pilot(p_entry.campaign_id,p_entry.owner_id) and public.fun_permission_valid(p_entry);
$$;
create or replace function public.fun_entry_json(p_entry public.fan_zone_entries) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p_entry)||jsonb_build_object('consent_scope',public.fun_scope(p_entry),'permission_valid',public.fun_permission_valid(p_entry),'media_revisions',coalesce((select jsonb_agg(jsonb_build_object('revision',(a.detail->>'revision')::int,'path',a.detail->>'path','present',exists(select 1 from storage.objects o where o.bucket_id='fan_zone' and o.name=a.detail->>'path')) order by a.created_at) from public.fan_zone_audit a where a.subject_id=p_entry.id and a.action='entry_revision'),'[]'::jsonb));
$$;
create or replace function public.fun_campaign_json(p_campaign public.fan_zone_campaigns) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p_campaign)-'pilot_accounts'-'result_signature';
$$;
create or replace function public.fun_case_json(p_case public.fan_zone_cases) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p_case.id,'entry_id',p_case.entry_id,'revision',p_case.revision,'kind',p_case.kind,'status',p_case.status,'created_at',p_case.created_at,'expires_at',p_case.expires_at);
$$;
create or replace function public.fun_audit(p_campaign uuid,p_action text,p_subject uuid,p_detail jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.fan_zone_audit(campaign_id,actor_id,action,subject_id,detail) values(p_campaign,public.my_profile_id(),p_action,p_subject,p_detail);
$$;
create or replace function public.fun_signature(p_campaign uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(coalesce((select string_agg(e.id::text||':'||e.revision::text,',' order by e.id) from public.fan_zone_entries e where e.campaign_id=p_campaign and public.fun_candidate(e)),'')||'|'||coalesce((select string_agg(b.id::text||':'||b.version::text,',' order by b.id) from public.fan_zone_ballots b join public.fan_zone_entries e on e.id=b.entry_id where b.campaign_id=p_campaign and b.invalidated_at is null and public.fun_pilot(p_campaign,b.voter_id) and public.fun_candidate(e) and b.voter_id<>e.owner_id and not public.is_blocked_between(b.voter_id,e.owner_id)),''));
$$;

create or replace function public.fun_admin_campaign(p_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); c public.fan_zone_campaigns; tally jsonb;
begin
 if p_action='create' then
  insert into public.fan_zone_campaigns(title,theme,period,entry_opens_at,entry_closes_at,vote_opens_at,vote_closes_at,rules,support_contact,story_reel_id,pilot_accounts)
  values(p_payload->>'title',p_payload->>'theme',p_payload->>'period',(p_payload->>'entry_opens_at')::timestamptz,(p_payload->>'entry_closes_at')::timestamptz,(p_payload->>'vote_opens_at')::timestamptz,(p_payload->>'vote_closes_at')::timestamptz,p_payload->>'rules',coalesce(p_payload->>'support_contact',''),(p_payload->>'story_reel_id')::uuid,coalesce(array(select jsonb_array_elements_text(p_payload->'pilot_accounts')::uuid),'{}')) returning * into c;
 else
  select * into c from public.fan_zone_campaigns where id=p_id for update;
  if not found then raise exception 'FUN_CAMPAIGN_UNAVAILABLE'; end if;
  if p_action='configure' then
   if c.opened_at is not null then raise exception 'FUN_RULES_IMMUTABLE'; end if;
   update public.fan_zone_campaigns set title=coalesce(p_payload->>'title',title),theme=coalesce(p_payload->>'theme',theme),period=coalesce(p_payload->>'period',period),rules=coalesce(p_payload->>'rules',rules),support_contact=coalesce(p_payload->>'support_contact',support_contact),
   entry_opens_at=coalesce((p_payload->>'entry_opens_at')::timestamptz,entry_opens_at),entry_closes_at=coalesce((p_payload->>'entry_closes_at')::timestamptz,entry_closes_at),vote_opens_at=coalesce((p_payload->>'vote_opens_at')::timestamptz,vote_opens_at),vote_closes_at=coalesce((p_payload->>'vote_closes_at')::timestamptz,vote_closes_at),
   story_reel_id=case when p_payload?'story_reel_id' then (p_payload->>'story_reel_id')::uuid else story_reel_id end,pilot_accounts=case when p_payload?'pilot_accounts' then array(select jsonb_array_elements_text(p_payload->'pilot_accounts')::uuid) else pilot_accounts end where id=c.id;
  elsif p_action='open' then
   if c.status not in ('draft','paused') or now()>=c.vote_closes_at or char_length(trim(c.support_contact))<5 or cardinality(c.pilot_accounts)=0
   or exists(select 1 from unnest(c.pilot_accounts) p where not public.fun_eligible(p)) then raise exception 'FUN_TESTING_OPEN_DENIED'; end if;
   update public.fan_zone_campaigns set status='open',opened_at=coalesce(opened_at,now()) where id=c.id;
  elsif p_action='pause' then
   if c.status<>'open' then raise exception 'FUN_STATE_INVALID'; end if;
   update public.fan_zone_campaigns set status='paused' where id=c.id;
  elsif p_action='close' then
   if c.status not in ('open','paused') then raise exception 'FUN_STATE_INVALID'; end if;
   update public.fan_zone_campaigns set status='closed' where id=c.id;
  elsif p_action in ('finalize','recount') then
   if now()<c.vote_closes_at or c.opened_at is null then raise exception 'FUN_VOTING_NOT_ENDED'; end if;
   with counts as (select e.id,count(b.id)::int votes from public.fan_zone_entries e left join public.fan_zone_ballots b on b.entry_id=e.id and b.invalidated_at is null and public.fun_pilot(c.id,b.voter_id) and b.voter_id<>e.owner_id and not public.is_blocked_between(b.voter_id,e.owner_id) where e.campaign_id=c.id and public.fun_candidate(e) group by e.id)
   select coalesce(jsonb_agg(jsonb_build_object('entry_id',id,'votes',votes) order by id),'[]') into tally from counts where votes>0 and votes=(select max(votes) from counts);
   update public.fan_zone_campaigns set status='finalized',results=tally,recount_required=false,result_signature=public.fun_signature(c.id) where id=c.id;
  else raise exception 'FUN_ACTION_INVALID'; end if;
  update public.fan_zone_campaigns set updated_at=now() where id=c.id returning * into c;
 end if;
 perform public.fun_audit(c.id,'campaign_'||p_action,c.id);
 return jsonb_build_object('ok',true,'campaign',to_jsonb(c)-'result_signature');
end $$;

create or replace function public.fun_entry(p_campaign_id uuid,p_entry_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); c public.fan_zone_campaigns; e public.fan_zone_entries; eid uuid:=gen_random_uuid();
begin
 select * into c from public.fan_zone_campaigns where id=p_campaign_id for update;
 if not found then raise exception 'FUN_ENTRY_UNAVAILABLE'; end if;
 if p_action='reserve' then
  if not public.fun_pilot(c.id,me) or c.status<>'open' or now()<c.entry_opens_at or now()>=c.entry_closes_at then raise exception 'FUN_ENTRY_WINDOW_CLOSED'; end if;
  if (select count(*) from public.fan_zone_entries where campaign_id=c.id)>=100 then raise exception 'FUN_ENTRY_CAP'; end if;
  insert into public.fan_zone_entries(id,campaign_id,owner_id,path) values(eid,c.id,me,eid::text||'/1/'||gen_random_uuid()::text||'.mp4') returning * into e;
 else
  select * into e from public.fan_zone_entries where id=p_entry_id and campaign_id=c.id and owner_id=me for update;
  if not found then raise exception 'FUN_ENTRY_UNAVAILABLE'; end if;
  if p_action='withdraw' then
   update public.fan_zone_entries set status='withdrawn',updated_at=now() where id=e.id returning * into e;
   update public.fan_zone_campaigns set recount_required=true where id=c.id;
  else
   if not public.fun_pilot(c.id,me) or c.status<>'open' or now()<c.entry_opens_at or now()>=c.entry_closes_at or e.status='withdrawn' then raise exception 'FUN_ENTRY_WINDOW_CLOSED'; end if;
   if p_action='edit' then
    -- A changed revision never points at old sanitized bytes or old public permission.
    update public.fan_zone_entries set revision=revision+1,path=id::text||'/'||(revision+1)::text||'/'||gen_random_uuid()::text||'.mp4',alias=coalesce(p_payload->>'alias',''),caption=coalesce(p_payload->>'caption',''),rights_confirmed=coalesce((p_payload->>'rights_confirmed')::boolean,false),status='draft',reason=null,verified=false,digest=null,bytes=null,duration_ms=null,removed_at=null,guardian_consent_id=null,updated_at=now() where id=e.id returning * into e;
    update public.fan_zone_campaigns set recount_required=true where id=c.id;
   elsif p_action='submit' then
    if e.status<>'draft' or not e.verified or e.removed_at is not null or not e.rights_confirmed or char_length(trim(e.alias))<1 or char_length(trim(e.caption))<1 then raise exception 'FUN_VERIFIED_RIGHTS_REQUIRED'; end if;
    update public.fan_zone_entries set status='submitted',updated_at=now() where id=e.id returning * into e;
   else raise exception 'FUN_ACTION_INVALID'; end if;
  end if;
 end if;
 if p_action in ('reserve','edit') then perform public.fun_audit(c.id,'entry_revision',e.id,jsonb_build_object('revision',e.revision,'path',e.path)); end if;
 perform public.fun_audit(c.id,'entry_'||p_action,e.id,jsonb_build_object('revision',e.revision));
 return jsonb_build_object('ok',true,'entry',public.fun_entry_json(e));
end $$;

create or replace function public.fun_permission(p_entry_id uuid,p_revision integer,p_action text,p_expected_scope jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); e public.fan_zone_entries; c public.fan_zone_campaigns; link uuid; scope jsonb; receipt_id uuid; bind_grant boolean:=false;
begin
 select c0.* into c from public.fan_zone_campaigns c0 join public.fan_zone_entries e0 on e0.campaign_id=c0.id where e0.id=p_entry_id for update of c0;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found or (e.owner_id<>me and not public.fun_guardian(e.owner_id,me)) then raise exception 'FUN_PERMISSION_UNAVAILABLE'; end if;
 scope:=public.fun_scope(e);
 if e.revision<>p_revision or p_expected_scope is distinct from scope then raise exception 'FUN_PERMISSION_SCOPE_STALE'; end if;
 if p_action='assent' then
  if me<>e.owner_id then raise exception 'FUN_PERMISSION_UNAVAILABLE'; end if;
 elsif p_action='grant' then
  if not public.fun_guardian(e.owner_id,me) then raise exception 'FUN_PERMISSION_UNAVAILABLE'; end if;
  select id into link from public.guardian_links where minor_id=e.owner_id and guardian_id=me and confirmed_at is not null and ended_at is null;
  -- A different guardian's receipt is retained but cannot replace a still-valid relied-on guardian.
  bind_grant:=not public.fun_guardian_grant_valid(e) or exists(select 1 from public.fan_zone_consents s where s.id=e.guardian_consent_id and s.actor_id=me);
 elsif p_action='revoke' then
  if me<>e.owner_id then select id into link from public.guardian_links where minor_id=e.owner_id and guardian_id=me and confirmed_at is not null and ended_at is null; end if;
 else raise exception 'FUN_ACTION_INVALID'; end if;
 if p_action<>'revoke' and (not e.verified or e.removed_at is not null or e.status='withdrawn' or not public.fun_pilot(c.id,e.owner_id)) then raise exception 'FUN_PERMISSION_UNAVAILABLE'; end if;
 insert into public.fan_zone_consents(entry_id,revision,actor_id,link_id,action,scope) values(e.id,e.revision,me,link,p_action,scope) returning id into receipt_id;
 if bind_grant then update public.fan_zone_entries set guardian_consent_id=receipt_id,updated_at=now() where id=e.id returning * into e; end if;
 update public.fan_zone_campaigns set recount_required=true where id=e.campaign_id;
 perform public.fun_audit(e.campaign_id,'permission_'||p_action,e.id,jsonb_build_object('revision',e.revision));
 return jsonb_build_object('ok',true,'entry',public.fun_entry_json(e));
end $$;

create or replace function public.fun_vote(p_campaign_id uuid,p_entry_id uuid,p_request_id uuid,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); c public.fan_zone_campaigns; e public.fan_zone_entries; b public.fan_zone_ballots; r public.fan_zone_requests; receipt jsonb;
begin
 -- The campaign lock serializes ballots with review, withdrawal, pause, invalidation and finalization.
 select * into c from public.fan_zone_campaigns where id=p_campaign_id for update;
 if not found or p_request_id is null or p_expected_version is null or p_expected_version<0 then raise exception 'FUN_BALLOT_INVALID'; end if;
 select * into r from public.fan_zone_requests where voter_id=me and request_id=p_request_id;
 if found then
  if r.campaign_id<>p_campaign_id or r.entry_id<>p_entry_id or r.expected_version<>p_expected_version or now()>=r.expires_at then raise exception 'FUN_REQUEST_REUSED'; end if; return r.receipt;
 end if;
 if not public.fun_pilot(c.id,me) or c.status<>'open' or now()<c.vote_opens_at or now()>=c.vote_closes_at then raise exception 'FUN_VOTE_WINDOW_CLOSED'; end if;
 if (select count(*) from public.fan_zone_requests where voter_id=me and campaign_id=c.id)>=60 then raise exception 'FUN_BALLOT_RATE_LIMIT'; end if;
 select * into e from public.fan_zone_entries where id=p_entry_id and campaign_id=c.id;
 if not found or not public.fun_candidate(e) or e.owner_id=me or public.is_blocked_between(me,e.owner_id) then raise exception 'FUN_CANDIDATE_UNAVAILABLE'; end if;
 select * into b from public.fan_zone_ballots where campaign_id=c.id and voter_id=me for update;
 if coalesce(b.version,0)<>p_expected_version then raise exception 'FUN_BALLOT_VERSION_STALE'; end if;
 if b.invalidated_at is not null then raise exception 'FUN_BALLOT_INVALIDATED'; end if;
 insert into public.fan_zone_ballots(campaign_id,voter_id,entry_id,version) values(c.id,me,e.id,1)
 on conflict(campaign_id,voter_id) do update set entry_id=excluded.entry_id,version=fan_zone_ballots.version+1,updated_at=now() returning * into b;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request_id,'ballot',jsonb_build_object('id',b.id,'campaign_id',b.campaign_id,'entry_id',b.entry_id,'version',b.version,'invalidated',false));
 insert into public.fan_zone_requests(request_id,voter_id,campaign_id,entry_id,expected_version,receipt,expires_at) values(p_request_id,me,c.id,e.id,p_expected_version,receipt,c.vote_closes_at+interval '30 days');
 return receipt;
end $$;

-- Remove the unpublished old overload before restoring narrow API grants.
drop function if exists public.fun_admin_entry(uuid,text,text);
create or replace function public.fun_admin_entry(p_entry_id uuid,p_action text,p_reason text,p_expected_scope jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); e public.fan_zone_entries; c public.fan_zone_campaigns; target text;
begin
 select c0.* into c from public.fan_zone_campaigns c0 join public.fan_zone_entries e0 on e0.campaign_id=c0.id where e0.id=p_entry_id for update of c0;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found then raise exception 'FUN_ENTRY_UNAVAILABLE'; end if;
 if p_reason is null or char_length(trim(p_reason)) not between 5 and 500 then raise exception 'FUN_REASON_REQUIRED'; end if;
 -- Normal review applies only to the exact media/copy seen; explicit emergency suspension stops the current entry.
 if p_expected_scope is distinct from public.fun_scope(e) and not (p_action='suspend' and p_expected_scope is null) then raise exception 'FUN_REVIEW_SCOPE_STALE'; end if;
 target:=case p_action when 'accept' then 'accepted' when 'changes' then 'changes' when 'reject' then 'rejected' when 'suspend' then 'suspended' end;
 if target is null or e.status='withdrawn' or (target='accepted' and (e.status not in ('submitted','suspended') or not e.verified or not e.rights_confirmed or e.removed_at is not null)) then raise exception 'FUN_STATE_INVALID'; end if;
 update public.fan_zone_entries set status=target,reason=p_reason,updated_at=now() where id=e.id returning * into e;
 update public.fan_zone_campaigns set recount_required=true where id=e.campaign_id;
 perform public.fun_audit(e.campaign_id,'review_'||p_action,e.id,jsonb_build_object('reason',p_reason,'revision',e.revision));
 return jsonb_build_object('ok',true,'entry',public.fun_entry_json(e));
end $$;
create or replace function public.fun_admin_ballot(p_ballot_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); b public.fan_zone_ballots;
begin
 perform 1 from public.fan_zone_campaigns c join public.fan_zone_ballots b0 on b0.campaign_id=c.id where b0.id=p_ballot_id for update of c;
 if p_reason is null or char_length(trim(p_reason)) not between 5 and 500 then raise exception 'FUN_REASON_REQUIRED'; end if;
 update public.fan_zone_ballots set invalidated_at=coalesce(invalidated_at,now()),invalid_reason=p_reason where id=p_ballot_id returning * into b;
 if not found then raise exception 'FUN_BALLOT_UNAVAILABLE'; end if;
 update public.fan_zone_campaigns set recount_required=true where id=b.campaign_id;
 perform public.fun_audit(b.campaign_id,'ballot_invalidate',b.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true,'ballot',to_jsonb(b));
end $$;

create or replace function public.fun_media_access(p_entry_id uuid,p_revision integer,p_intent text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); e public.fan_zone_entries; media_path text;
begin
 select * into e from public.fan_zone_entries where id=p_entry_id;
 if not found or not public.fun_eligible(me) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
 if p_intent='remove' then
  if me<>e.owner_id and not public.fun_guardian(e.owner_id,me) and not coalesce(public.current_user_role()='admin',false) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
  if not exists(select 1 from public.fan_zone_cases k where k.entry_id=e.id and k.kind='deletion' and k.status in ('open','escalated')) then raise exception 'FUN_REMOVAL_NOT_REQUESTED'; end if;
  select a.detail->>'path' into media_path from public.fan_zone_audit a where a.subject_id=e.id and a.action='entry_revision' and (a.detail->>'revision')::int=p_revision order by a.created_at desc limit 1;
  if media_path is null then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
 else
  if e.revision<>p_revision or e.removed_at is not null then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
  media_path:=e.path;
  if p_intent='verify' then
   -- Only the owner may reauthorize a current draft; an existing digest permits a receipt retry, never another Storage write.
   if me<>e.owner_id or not public.fun_pilot(e.campaign_id,me) or e.status<>'draft' or not exists(select 1 from public.fan_zone_campaigns c where c.id=e.campaign_id and c.status='open' and now()>=c.entry_opens_at and now()<c.entry_closes_at) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
  elsif p_intent='read' then
   if not e.verified or (me<>e.owner_id and not public.fun_guardian(e.owner_id,me) and not coalesce(public.current_user_role()='admin',false)
    and not (public.fun_pilot(e.campaign_id,me) and public.fun_candidate(e) and not public.is_blocked_between(me,e.owner_id))) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
   if e.status='withdrawn' and me<>e.owner_id and not coalesce(public.current_user_role()='admin',false) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
  else raise exception 'FUN_ACTION_INVALID'; end if;
 end if;
 return jsonb_build_object('ok',true,'bucket','fan_zone','path',media_path,'entry_id',e.id,'revision',p_revision,'digest',case when e.revision=p_revision then e.digest end,'bytes',case when e.revision=p_revision then e.bytes end,'duration_ms',case when e.revision=p_revision then e.duration_ms end);
end $$;
create or replace function public.fun_verify_media(p_entry_id uuid,p_revision integer,p_digest text,p_bytes integer,p_duration_ms integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.fan_zone_entries; c public.fan_zone_campaigns;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FUN_SERVICE_REQUIRED'; end if;
 select c0.* into c from public.fan_zone_campaigns c0 join public.fan_zone_entries e0 on e0.campaign_id=c0.id where e0.id=p_entry_id for update of c0;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found or e.revision<>p_revision or e.status<>'draft' or e.verified or not public.fun_pilot(c.id,e.owner_id)
 or c.status<>'open' or now()<c.entry_opens_at or now()>=c.entry_closes_at or not exists(select 1 from storage.objects o where o.bucket_id='fan_zone' and o.name=e.path) then raise exception 'FUN_VERIFY_STALE'; end if;
 if p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes not between 1 and 20971520 or p_duration_ms is null or p_duration_ms not between 1000 and 30000 then raise exception 'FUN_MEDIA_INVALID'; end if;
 update public.fan_zone_entries set verified=true,digest=p_digest,bytes=p_bytes,duration_ms=p_duration_ms,updated_at=now() where id=e.id returning * into e;
 perform public.fun_audit(e.campaign_id,'media_verified',e.id,jsonb_build_object('revision',e.revision));
 return jsonb_build_object('ok',true,'entry',public.fun_entry_json(e));
end $$;
create or replace function public.fun_complete_removal(p_entry_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.fan_zone_entries; media_path text; complete boolean;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FUN_SERVICE_REQUIRED'; end if;
 perform 1 from public.fan_zone_campaigns c join public.fan_zone_entries e0 on e0.campaign_id=c.id where e0.id=p_entry_id for update of c;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found or not exists(select 1 from public.fan_zone_cases k where k.entry_id=e.id and k.kind='deletion') then raise exception 'FUN_REMOVAL_NOT_REQUESTED'; end if;
 select a.detail->>'path' into media_path from public.fan_zone_audit a where a.subject_id=e.id and a.action='entry_revision' and (a.detail->>'revision')::int=p_revision order by a.created_at desc limit 1;
 if media_path is null or exists(select 1 from storage.objects where bucket_id='fan_zone' and name=media_path) then raise exception 'FUN_OBJECT_STILL_PRESENT'; end if;
 if p_revision=e.revision then update public.fan_zone_entries set verified=false,removed_at=now(),status='withdrawn',updated_at=now() where id=e.id; end if;
 complete:=not exists(select 1 from storage.objects where bucket_id='fan_zone' and name like e.id::text||'/%');
 if complete then update public.fan_zone_cases set status='completed',reason='Server confirmed all entry objects removed',updated_at=now() where entry_id=e.id and kind='deletion' and status in ('open','escalated'); end if;
 update public.fan_zone_campaigns set recount_required=true where id=e.campaign_id;
 perform public.fun_audit(e.campaign_id,'media_removed',e.id,jsonb_build_object('revision',p_revision));
 return jsonb_build_object('ok',true,'entry_id',e.id,'revision',p_revision,'completed',complete);
end $$;

create or replace function public.fun_case(p_entry_id uuid,p_kind text,p_details text,p_secret uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); e public.fan_zone_entries; k public.fan_zone_cases; h text; staff boolean:=coalesce(public.current_user_role()='admin',false);
begin
 if p_secret is null or p_details is null or char_length(trim(p_details)) not between 3 and 1000 or p_kind not in ('report','appeal','deletion') or p_kind is null then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 if auth.uid() is not null and not public.fun_eligible(me) then raise exception 'FUN_ACCOUNT_INELIGIBLE'; end if;
 h:=encode(public.digest(p_secret::text,'sha256'),'hex');
 -- All entry/case mutations take campaign then entry, before a case lock or its audit campaign FK lock.
 perform 1 from public.fan_zone_campaigns c join public.fan_zone_entries e0 on e0.campaign_id=c.id where e0.id=p_entry_id for update of c;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found or not coalesce((me=e.owner_id or public.fun_guardian(e.owner_id,me) or coalesce(public.current_user_role()='admin',false)
  or (p_kind='report' and public.fun_candidate(e) and (me is null or public.fun_pilot(e.campaign_id,me)) and not public.is_blocked_between(me,e.owner_id))),false) then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 if p_kind='appeal' and not coalesce((me=e.owner_id or public.fun_guardian(e.owner_id,me)),false) then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 if p_kind='deletion' and not coalesce((me=e.owner_id or public.fun_guardian(e.owner_id,me) or staff),false) then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 if staff then perform public.fun_admin_guard(); end if;
 -- Global intake accounting follows campaign/entry locks; it never blocks the path to an existing removal request.
 perform pg_advisory_xact_lock(710014);
 -- Receipt lookup can be foreign to this entry; read it without taking a foreign case lock out of order.
 select * into k from public.fan_zone_cases where secret_hash=h;
 if found then
  if k.entry_id<>e.id or k.kind<>p_kind or k.details<>p_details or k.reporter_id is distinct from me or now()>=k.expires_at then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
  return jsonb_build_object('ok',true,'case',public.fun_case_json(k));
 end if;
 if p_kind='deletion' and exists(select 1 from public.fan_zone_cases where entry_id=e.id and kind='deletion') then raise exception 'FUN_DELETION_ALREADY_REQUESTED'; end if;
 -- Public report volume must not prevent the owner from requesting actual removal.
 if (p_kind='report' and ((select count(*) from public.fan_zone_cases where entry_id=e.id and kind='report' and created_at>now()-interval '1 day')>=5
 or (select count(*) from public.fan_zone_cases where kind='report' and status in ('open','escalated'))>=500))
 or (p_kind<>'deletion' and me is not null and (select count(*) from public.fan_zone_cases where reporter_id=me and kind<>'deletion' and created_at>now()-interval '1 day')>=10) then raise exception 'FUN_CASE_RATE_LIMIT'; end if;
 insert into public.fan_zone_cases(entry_id,revision,path,reporter_id,kind,details,secret_hash) values(e.id,e.revision,e.path,me,p_kind,p_details,h) returning * into k;
 perform public.fun_audit(e.campaign_id,'case_'||p_kind,k.id);
 return jsonb_build_object('ok',true,'case',public.fun_case_json(k));
end $$;
create or replace function public.fun_case_status(p_case_id uuid,p_secret uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k public.fan_zone_cases;
begin
 select * into k from public.fan_zone_cases where id=p_case_id and secret_hash=encode(public.digest(p_secret::text,'sha256'),'hex') and now()<expires_at;
 if not found then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 return jsonb_build_object('ok',true,'case',public.fun_case_json(k));
end $$;
create or replace function public.fun_admin_case(p_case_id uuid,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); k public.fan_zone_cases; campaign uuid;
begin
 -- Match entry/permission/removal mutation lock order; audit insertion needs the already-held campaign FK lock.
 perform 1 from public.fan_zone_campaigns c join public.fan_zone_entries e on e.campaign_id=c.id join public.fan_zone_cases k0 on k0.entry_id=e.id where k0.id=p_case_id for update of c;
 perform 1 from public.fan_zone_entries e join public.fan_zone_cases k0 on k0.entry_id=e.id where k0.id=p_case_id for update of e;
 select * into k from public.fan_zone_cases where id=p_case_id for update;
 if not found or k.status not in ('open','escalated') or p_reason is null or char_length(trim(p_reason)) not between 5 and 500 or p_action not in ('resolve','escalate') or p_action is null then raise exception 'FUN_CASE_INVALID'; end if;
 if k.kind='deletion' and p_action='resolve' then raise exception 'FUN_ACTUAL_REMOVAL_REQUIRED'; end if;
 update public.fan_zone_cases set status=case p_action when 'resolve' then 'resolved' else 'escalated' end,reason=p_reason,updated_at=now() where id=k.id returning * into k;
 select campaign_id into campaign from public.fan_zone_entries where id=k.entry_id;
 perform public.fun_audit(campaign,'case_'||p_action,k.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true,'case',public.fun_case_json(k));
end $$;
create or replace function public.fun_reflection(p_campaign_id uuid,p_id uuid,p_idea text,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); r public.fan_zone_reflections;
begin
 if p_action='create' then
  if not public.fun_pilot(p_campaign_id,me) or not exists(select 1 from public.fan_zone_campaigns where id=p_campaign_id and opened_at is not null) or p_idea is null or p_idea not in ('encourage','help_at_home','serve_together','thank_someone') then raise exception 'FUN_REFLECTION_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text));
  if (select count(*) from public.fan_zone_reflections where owner_id=me and campaign_id=p_campaign_id)>=20 then raise exception 'FUN_REFLECTION_CAP'; end if;
  insert into public.fan_zone_reflections(campaign_id,owner_id,idea) values(p_campaign_id,me,p_idea) returning * into r;
  return jsonb_build_object('ok',true,'reflection',to_jsonb(r)-'owner_id');
 elsif p_action='delete' then
  delete from public.fan_zone_reflections where id=p_id and owner_id=me and campaign_id=p_campaign_id returning * into r;
  if not found then raise exception 'FUN_REFLECTION_UNAVAILABLE'; end if;
  return jsonb_build_object('ok',true,'deleted_id',r.id);
 else raise exception 'FUN_ACTION_INVALID'; end if;
end $$;

create or replace function public.fun_snapshot(p_campaign_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); c public.fan_zone_campaigns; own jsonb; ballot jsonb; candidates jsonb; results jsonb; story jsonb; queue jsonb; reflections jsonb;
begin
 select * into c from public.fan_zone_campaigns x where (p_campaign_id is null or x.id=p_campaign_id) and public.fun_eligible(me)
 and (public.fun_pilot(x.id,me) or coalesce(public.current_user_role()='admin',false) or exists(select 1 from public.fan_zone_entries e where e.campaign_id=x.id and (e.owner_id=me or public.fun_guardian(e.owner_id,me))))
 and (x.opened_at is not null or coalesce(public.current_user_role()='admin',false)) order by x.created_at desc,x.id desc limit 1;
 if c.id is null then return jsonb_build_object('ok',true,'campaign',null,'candidates','[]'::jsonb,'results','[]'::jsonb,'entry',null,'ballot',null,'guardian_queue','[]'::jsonb,'reflections','[]'::jsonb,'story',null,'eligible',public.fun_eligible(me),'can_participate',false); end if;
 select public.fun_entry_json(e) into own from public.fan_zone_entries e where campaign_id=c.id and owner_id=me;
 select jsonb_build_object('id',b.id,'campaign_id',b.campaign_id,'entry_id',b.entry_id,'version',b.version,'invalidated',b.invalidated_at is not null) into ballot from public.fan_zone_ballots b where b.campaign_id=c.id and b.voter_id=me;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'alias',e.alias,'caption',e.caption) order by md5(e.id::text||current_date::text)),'[]') into candidates from public.fan_zone_entries e where e.campaign_id=c.id and public.fun_pilot(c.id,me) and public.fun_candidate(e) and not public.is_blocked_between(me,e.owner_id);
 results:='[]';
 if c.status='finalized' and not c.recount_required and c.result_signature=public.fun_signature(c.id) and public.fun_pilot(c.id,me) then
  select coalesce(jsonb_agg(j),'[]') into results from jsonb_array_elements(c.results) j join public.fan_zone_entries e on e.id=(j->>'entry_id')::uuid where public.fun_candidate(e) and not public.is_blocked_between(me,e.owner_id);
 end if;
 select coalesce(jsonb_agg(public.fun_entry_json(e) order by e.created_at),'[]') into queue from public.fan_zone_entries e where e.campaign_id=c.id and public.fun_guardian(e.owner_id,me) and e.status<>'withdrawn';
 select coalesce(jsonb_agg(to_jsonb(r)-'owner_id' order by r.created_at desc),'[]') into reflections from public.fan_zone_reflections r where r.campaign_id=c.id and r.owner_id=me;
 -- A curated story must remain free/public; no alternative athlete is substituted when its source becomes private.
 select jsonb_build_object('id',r.id,'player_id',r.player_id,'video_url',r.video_url,'title',r.title) into story from public.reels r join public.profiles p on p.id=r.uploaded_by
 where r.id=c.story_reel_id and r.tag_status='confirmed' and r.media_type='video' and not r.is_removed and not r.is_flagged and not r.is_vault_only and not r.is_exclusive and not p.account_private and public.fun_eligible(p.id) and (public.profile_age_band(p.id)='adult' or public.minor_has_consent(p.id,'public_profile')) and not public.is_blocked_between(me,p.id);
 return jsonb_build_object('ok',true,'campaign',public.fun_campaign_json(c)||jsonb_build_object('results',results,'recount_required',c.recount_required or (c.result_signature is not null and c.result_signature<>public.fun_signature(c.id))),
 'candidates',candidates,'results',results,'entry',own,'ballot',ballot,'guardian_queue',queue,'reflections',reflections,'story',story,'eligible',public.fun_eligible(me),'can_participate',public.fun_pilot(c.id,me));
end $$;
drop function if exists public.fun_admin_snapshot(uuid,timestamptz);
create or replace function public.fun_admin_snapshot(p_campaign_id uuid default null,p_before text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); c public.fan_zone_campaigns; campaigns jsonb; entries jsonb; cases jsonb; audit jsonb; ballots jsonb; counts jsonb;
 cursor jsonb; marker jsonb; case_at timestamptz; case_id uuid; audit_at timestamptz; audit_id uuid; case_next jsonb; audit_next jsonb; combined jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(x)-'result_signature' order by x.created_at desc),'[]') into campaigns from (select * from public.fan_zone_campaigns order by created_at desc limit 100) x;
 select * into c from public.fan_zone_campaigns where p_campaign_id is null or id=p_campaign_id order by created_at desc,id desc limit 1;
 -- Independent composite markers also preserve imported rows with identical timestamps.
 if p_before is not null then
  begin
   if char_length(p_before)>2000 then raise exception 'FUN_CURSOR_INVALID'; end if;
   cursor:=p_before::jsonb;
   if jsonb_typeof(cursor)<>'object' or cursor->'v' is distinct from '1'::jsonb or jsonb_typeof(cursor->'campaign') is distinct from 'string'
    or cursor->>'campaign' is distinct from c.id::text or not (cursor ? 'cases' or cursor ? 'audit')
    or exists(select 1 from jsonb_object_keys(cursor) k where k not in ('v','campaign','cases','audit')) then raise exception 'FUN_CURSOR_INVALID'; end if;
   for marker in select value from jsonb_each(cursor) where key in ('cases','audit') loop
    if jsonb_typeof(marker)<>'object' or jsonb_typeof(marker->'at') is distinct from 'string' or jsonb_typeof(marker->'id') is distinct from 'string'
     or exists(select 1 from jsonb_object_keys(marker) k where k not in ('at','id'))
     or (marker->>'at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
     or (marker->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'FUN_CURSOR_INVALID'; end if;
   end loop;
   case_at:=(cursor->'cases'->>'at')::timestamptz;case_id:=(cursor->'cases'->>'id')::uuid;
   audit_at:=(cursor->'audit'->>'at')::timestamptz;audit_id:=(cursor->'audit'->>'id')::uuid;
  exception when others then raise exception 'FUN_CURSOR_INVALID'; end;
 end if;
 select coalesce(jsonb_agg(public.fun_entry_json(e)||jsonb_build_object('media_revisions',coalesce((select jsonb_agg(jsonb_build_object('revision',(a.detail->>'revision')::int,'path',a.detail->>'path','present',exists(select 1 from storage.objects o where o.bucket_id='fan_zone' and o.name=a.detail->>'path')) order by a.created_at) from public.fan_zone_audit a where a.subject_id=e.id and a.action='entry_revision'),'[]'::jsonb)) order by e.created_at),'[]') into entries from public.fan_zone_entries e where e.campaign_id=c.id;
 select coalesce(jsonb_agg(to_jsonb(x)-'secret_hash' order by x.created_at desc,x.id desc),'[]') into cases from (select k.* from public.fan_zone_cases k join public.fan_zone_entries e on e.id=k.entry_id where e.campaign_id=c.id and (case_at is null or (k.created_at,k.id)<(case_at,case_id)) order by k.created_at desc,k.id desc limit 50) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') into audit from (select * from public.fan_zone_audit where campaign_id=c.id and (audit_at is null or (created_at,id)<(audit_at,audit_id)) order by created_at desc,id desc limit 50) x;
 select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('valid',b.invalidated_at is null and public.fun_pilot(c.id,b.voter_id) and public.fun_candidate(e) and b.voter_id<>e.owner_id and not public.is_blocked_between(b.voter_id,e.owner_id)) order by b.created_at),'[]') into ballots from public.fan_zone_ballots b join public.fan_zone_entries e on e.id=b.entry_id where b.campaign_id=c.id;
 select jsonb_build_object('entries',(select count(*) from public.fan_zone_entries where campaign_id=c.id),'ballots',(select count(*) from public.fan_zone_ballots where campaign_id=c.id),'valid_ballots',(select count(*) from public.fan_zone_ballots b join public.fan_zone_entries e on e.id=b.entry_id where b.campaign_id=c.id and b.invalidated_at is null and public.fun_pilot(c.id,b.voter_id) and public.fun_candidate(e) and b.voter_id<>e.owner_id and not public.is_blocked_between(b.voter_id,e.owner_id)),
 'cases',(select count(*) from public.fan_zone_cases k join public.fan_zone_entries e on e.id=k.entry_id where e.campaign_id=c.id),'open_cases',(select count(*) from public.fan_zone_cases k join public.fan_zone_entries e on e.id=k.entry_id where e.campaign_id=c.id and k.status in ('open','escalated')),'audit',(select count(*) from public.fan_zone_audit where campaign_id=c.id),
 'entry_statuses',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from public.fan_zone_entries where campaign_id=c.id group by status) x),'{}'::jsonb)) into counts;
 if jsonb_array_length(cases)=50 then case_next:=jsonb_build_object('v',1,'campaign',c.id,'cases',jsonb_build_object('at',cases->49->>'created_at','id',cases->49->>'id')); end if;
 if jsonb_array_length(audit)=50 then audit_next:=jsonb_build_object('v',1,'campaign',c.id,'audit',jsonb_build_object('at',audit->49->>'created_at','id',audit->49->>'id')); end if;
 if case_next is not null or audit_next is not null then combined:=coalesce(case_next,'{}')||coalesce(audit_next,'{}'); end if;
 return jsonb_build_object('ok',true,'campaigns',campaigns,'campaign',case when c.id is not null then to_jsonb(c)-'result_signature' end,'entries',entries,'ballots',ballots,'cases',cases,'audit',audit,'counts',counts,'next_cursor',combined::text,'case_next_cursor',case_next::text,'audit_next_cursor',audit_next::text);
end $$;

-- Storage checks use an unexposed namespace: callers can execute the policy, but cannot resolve/call its helper.
create schema if not exists fan_zone_private;
revoke all on schema fan_zone_private from public,anon,authenticated;
create or replace function fan_zone_private.upload_allowed(p_name text,p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.fun_eligible(public.my_profile_id()) and (p_owner is null or p_owner=auth.uid()) and exists(
 select 1 from public.fan_zone_entries e join public.fan_zone_campaigns c on c.id=e.campaign_id
 where e.path=p_name and e.owner_id=public.my_profile_id() and e.status='draft' and not e.verified and e.removed_at is null and public.fun_pilot(c.id,e.owner_id)
 and c.status='open' and now()>=c.entry_opens_at and now()<c.entry_closes_at)
 and not exists(select 1 from storage.objects o where o.bucket_id='fan_zone' and o.name=p_name);
$$;
revoke all on function fan_zone_private.upload_allowed(text,uuid) from public,anon,authenticated;
grant execute on function fan_zone_private.upload_allowed(text,uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fan_zone','fan_zone',false,20971520,array['video/mp4']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create unique index if not exists fan_zone_object_unique on storage.objects(bucket_id,name) where bucket_id='fan_zone';
-- A service upsert must also obey the reserved draft invariant: a late upload cannot recreate removed media.
-- This protects Storage catalog rows; physical provider writes/metadata compatibility require hosted verification.
create or replace function public.fun_storage_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.fan_zone_entries; c public.fan_zone_campaigns; owner_user uuid;
begin
 if tg_op='UPDATE' and (old.bucket_id='fan_zone' or new.bucket_id='fan_zone')
 and (new.bucket_id,new.name,new.owner) is distinct from (old.bucket_id,old.name,old.owner) then raise exception 'FUN_STORAGE_IMMUTABLE'; end if;
 if new.bucket_id<>'fan_zone' then return new; end if;
 select c0.* into c from public.fan_zone_campaigns c0 join public.fan_zone_entries e0 on e0.campaign_id=c0.id where e0.path=new.name for update of c0;
 select * into e from public.fan_zone_entries where path=new.name for update;
 if not found or e.status<>'draft' or e.verified or e.removed_at is not null or not public.fun_pilot(c.id,e.owner_id)
 or c.status<>'open' or now()<c.entry_opens_at or now()>=c.entry_closes_at
 or exists(select 1 from public.fan_zone_cases k where k.entry_id=e.id and k.kind='deletion') then raise exception 'FUN_STORAGE_IMMUTABLE'; end if;
 select user_id into owner_user from public.profiles where id=e.owner_id;
 if new.owner is not null and new.owner is distinct from owner_user then raise exception 'FUN_STORAGE_IMMUTABLE'; end if;
 return new;
end $$;
drop trigger if exists fan_zone_storage_guard on storage.objects;
create trigger fan_zone_storage_guard before insert or update on storage.objects for each row execute function public.fun_storage_guard();
drop policy if exists fan_zone_insert on storage.objects;
create policy fan_zone_insert on storage.objects for insert to authenticated with check(bucket_id='fan_zone' and fan_zone_private.upload_allowed(name,owner));
drop policy if exists fan_zone_insert_boundary on storage.objects;
create policy fan_zone_insert_boundary on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'fan_zone' or fan_zone_private.upload_allowed(name,owner));
drop policy if exists fan_zone_no_read on storage.objects;
create policy fan_zone_no_read on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'fan_zone');
drop policy if exists fan_zone_no_update on storage.objects;
create policy fan_zone_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'fan_zone') with check(bucket_id<>'fan_zone');
drop policy if exists fan_zone_no_delete on storage.objects;
create policy fan_zone_no_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'fan_zone');



-- Timestamp-only API cursors need a strict order even when many records share one SQL transaction.
create or replace function public.fun_page_time() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='fan_zone_audit' then
  perform pg_advisory_xact_lock(710016);
  select greatest(clock_timestamp(),coalesce(max(created_at)+interval '1 microsecond',clock_timestamp())) into new.created_at from public.fan_zone_audit;
 else
  perform pg_advisory_xact_lock(710015);
  select greatest(clock_timestamp(),coalesce(max(created_at)+interval '1 microsecond',clock_timestamp())) into new.created_at from public.fan_zone_cases;
 end if;
 return new;
end $$;
create unique index if not exists fan_zone_audit_timestamp on public.fan_zone_audit(created_at);
create unique index if not exists fan_zone_case_timestamp on public.fan_zone_cases(created_at);
drop trigger if exists fan_zone_audit_time on public.fan_zone_audit;
create trigger fan_zone_audit_time before insert on public.fan_zone_audit for each row execute function public.fun_page_time();
drop trigger if exists fan_zone_case_time on public.fan_zone_cases;
create trigger fan_zone_case_time before insert on public.fan_zone_cases for each row execute function public.fun_page_time();

create or replace function public.fun_immutable_record() returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'FUN_RECORD_IMMUTABLE'; end $$;
drop trigger if exists fan_zone_consent_immutable on public.fan_zone_consents;
create trigger fan_zone_consent_immutable before update or delete on public.fan_zone_consents for each row execute function public.fun_immutable_record();
drop trigger if exists fan_zone_audit_immutable on public.fan_zone_audit;
create trigger fan_zone_audit_immutable before update or delete on public.fan_zone_audit for each row execute function public.fun_immutable_record();
revoke all on sequence public.fan_zone_consents_sequence_id_seq from public,anon,authenticated;

-- This bounded operational helper needs a trusted runner; no scheduler or hosted cleanup is started here.
create or replace function public.fun_prune_receipts() returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; begin
 if auth.role() is distinct from 'service_role' then raise exception 'FUN_SERVICE_REQUIRED'; end if;
 delete from public.fan_zone_requests where expires_at<now(); get diagnostics n=row_count;
 return jsonb_build_object('ok',true,'deleted_requests',n);
end $$;

-- Every public function loses PostgreSQL PUBLIC and Supabase default direct grants before explicit API grants.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'fun_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
grant execute on function public.fun_snapshot(uuid),public.fun_case(uuid,text,text,uuid),public.fun_case_status(uuid,uuid) to anon,authenticated;
grant execute on function public.fun_admin_snapshot(uuid,text),public.fun_admin_campaign(uuid,text,jsonb),public.fun_entry(uuid,uuid,text,jsonb),public.fun_permission(uuid,integer,text,jsonb),public.fun_vote(uuid,uuid,uuid,integer),public.fun_admin_entry(uuid,text,text,jsonb),public.fun_admin_ballot(uuid,text),public.fun_admin_case(uuid,text,text),public.fun_reflection(uuid,uuid,text,text),public.fun_media_access(uuid,integer,text) to authenticated;
grant execute on function public.fun_prune_receipts() to service_role;
grant execute on function public.fun_verify_media(uuid,integer,text,integer,integer),public.fun_complete_removal(uuid,integer) to service_role;
