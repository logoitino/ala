-- GUEST-ACCESS-01: guest preview is a narrow explicit source; raw app records and RPCs require accounts.
-- This migration preserves effective non-guest grants and existing row/role/privacy rules.
-- Apply on hosted only after review; the API anonymous-auth guard has a separate installation checkpoint.
-- Do not replace an unrelated security hook, including database-specific role configuration.
do $$
declare hook text;
begin
 -- A database-specific blank value overrides the global hook too; fail before changing grants.
 if exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig) setting where r.rolname='authenticator' and s.setdatabase=(select oid from pg_database where datname=current_database()) and setting like 'pgrst.db_pre_request=%' and substr(setting,length('pgrst.db_pre_request=')+1)<>'public.enforce_registered_api_account') then
  raise exception 'GUEST_API_GUARD_EXISTING_HOOK' using errcode='55000';
 end if;
 for hook in
  select substr(setting,length('pgrst.db_pre_request=')+1) from pg_roles r cross join lateral unnest(r.rolconfig) setting where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%'
  union
  select substr(setting,length('pgrst.db_pre_request=')+1) from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig) setting where r.rolname='authenticator' and s.setdatabase in(0,(select oid from pg_database where datname=current_database())) and setting like 'pgrst.db_pre_request=%'
 loop
  if nullif(btrim(hook),'') is not null and hook<>'public.enforce_registered_api_account' then raise exception 'GUEST_API_GUARD_EXISTING_HOOK' using errcode='55000';end if;
 end loop;
end $$;

-- Anonymous identities also fail the existing shared eligibility check used by account RPCs.
create or replace function public.caller_not_age_blocked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and not exists(select 1 from auth.users u where u.id=auth.uid() and coalesce(to_jsonb(u)->>'is_anonymous','false')='true')
    and not exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.age_blocked_at is not null);
$$;

create or replace function public.account_browsing_allowed()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
   and coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
   and exists(select 1 from auth.users u where u.id=auth.uid() and coalesce(to_jsonb(u)->>'is_anonymous','false') <> 'true')
   and public.caller_not_age_blocked();
$$;

-- PostgREST pre-request guard: SQL role authenticated alone is not a registered account.
-- Installation must preserve any existing pre-request hook and needs hosted verification.
create or replace function public.enforce_registered_api_account()
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role()='authenticated' and (auth.uid() is null
   or coalesce(auth.jwt()->>'is_anonymous','false')='true'
   or not exists(select 1 from auth.users u where u.id=auth.uid() and coalesce(to_jsonb(u)->>'is_anonymous','false') <> 'true')) then
  raise exception 'ACCOUNT_REQUIRED' using errcode='42501';
 end if;
end $$;

-- No offset, ids, search or arbitrary limit: all guests see the same current safe preview window.
-- Existing reels_feed applies visibility; no player/account fields, paid media or photo sources are returned.
create or replace function public.guest_highlights_preview()
returns table(id uuid,video_url text,title text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.id,r.video_url,r.title,r.created_at from public.reels_feed r
 where r.is_removed is false and r.is_flagged is false
   and coalesce(r.is_vault_only,false) is false and coalesce(r.is_exclusive,false) is false
   and coalesce(r.media_type,'video')='video' and nullif(btrim(r.video_url),'') is not null
   and exists(select 1 from public.reels raw where raw.id=r.id and (raw.player_id is null or raw.tag_status='confirmed') and raw.attested_at is not null and nullif(raw.rights_version,'') is not null)
 order by r.created_at desc,r.id desc limit 3;
$$;

create or replace function public.get_public_profiles(
  profile_ids uuid[] default null,
  player_ids uuid[] default null,
  handle text default null
)
-- An explicit column list (not `setof profiles_public`) so re-running the schema can drop and rebuild the view.
returns table (
  id uuid, player_id uuid, username text, full_name text, avatar_url text, is_verified boolean,
  is_verified_athlete boolean, school_visible boolean, bio text, social_links jsonb, athlete_sport text,
  verification_status text, school_id uuid, aura_points integer, account_private boolean, viewer_relation text,
  stats_visible boolean, crew_visible boolean, friends_visible boolean, school_confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.*
  from public.profiles_public v
  where public.account_browsing_allowed() and (v.id = any(coalesce((profile_ids)[1:50], '{}'::uuid[]))
     or v.player_id = any(coalesce((player_ids)[1:50], '{}'::uuid[]))
     or (nullif(btrim(handle), '') is not null and lower(v.username) = lower(btrim(handle))));
$$;

-- PUBLIC privileges are inherited by anon. Preserve each existing non-guest effective privilege before revocation.
do $$
declare obj record; r text; privilege text; permitted boolean;
begin
 for obj in select c.oid,c.relkind,format('%I.%I',n.nspname,c.relname) as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p','v','m','S') and not exists(select 1 from pg_depend d where d.objid=c.oid and d.deptype='e') loop
  foreach r in array array['authenticated','service_role','supabase_auth_admin'] loop
   if exists(select 1 from pg_roles where rolname=r) then
    foreach privilege in array case when obj.relkind='S' then array['USAGE','SELECT','UPDATE'] else array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] || case when current_setting('server_version_num')::int>=170000 then array['MAINTAIN'] else array[]::text[] end end loop
     permitted:=case when obj.relkind='S' then has_sequence_privilege(r,obj.oid,privilege) else has_table_privilege(r,obj.oid,privilege) end;
     if permitted then execute format('grant %s on %s %s to %I',privilege,case when obj.relkind='S' then 'sequence' else 'table' end,obj.name,r);end if;
    end loop;
   end if;
  end loop;
  execute format('revoke all on %s %s from public,anon',case when obj.relkind='S' then 'sequence' else 'table' end,obj.name);
 end loop;
 for obj in select p.oid,p.oid::regprocedure as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') loop
  foreach r in array array['authenticated','service_role','supabase_auth_admin'] loop
   if exists(select 1 from pg_roles where rolname=r) and has_function_privilege(r,obj.oid,'EXECUTE') then execute format('grant execute on function %s to %I',obj.name,r);end if;
  end loop;
  execute format('revoke all on function %s from public,anon',obj.name);
 end loop;
 -- Existing RLS remains authoritative for account permissions; this additional read condition rejects anonymous-auth tokens.
 for obj in select c.oid,format('%I.%I',n.nspname,c.relname) as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity and c.relname<>'app_runtime_config' loop
  execute format('drop policy if exists "Account required for app reads" on %s',obj.name);
  execute format('create policy "Account required for app reads" on %s as restrictive for select to authenticated using (public.account_browsing_allowed())',obj.name);
 end loop;
end $$;

-- Runtime themes/provider switches are necessary before sign-in; their existing RLS is retained.
grant select on public.app_runtime_config to anon;
grant execute on function public.current_user_role() to anon;
grant execute on function public.account_browsing_allowed() to anon;
grant execute on function public.enforce_registered_api_account() to anon,authenticated,service_role;
grant execute on function public.guest_highlights_preview() to anon,authenticated,service_role;
-- New source created by this owner should not silently regain public guest grants.
alter default privileges in schema public revoke all on tables from public,anon;
alter default privileges in schema public revoke all on sequences from public,anon;
alter default privileges in schema public revoke execute on functions from anon;
-- PUBLIC function EXECUTE is a global default; a schema-only revoke cannot remove it.
alter default privileges revoke execute on functions from public;

-- Storage is not covered by PostgREST pre-request hooks; protect metadata and writes through its own RLS.
drop policy if exists "Registered account Storage access" on storage.objects;
create policy "Registered account Storage access" on storage.objects as restrictive for all to anon,authenticated
 using (public.account_browsing_allowed()) with check (public.account_browsing_allowed());

-- Follow current Supabase API-security docs; standalone PostgreSQL without authenticator has no PostgREST to configure.
do $$
begin
 if exists(select 1 from pg_roles where rolname='authenticator') then
  alter role authenticator set pgrst.db_pre_request='public.enforce_registered_api_account';
  notify pgrst,'reload config';
 else
  raise notice 'Guest API hook not installed: this database has no authenticator role.';
 end if;
end $$;
