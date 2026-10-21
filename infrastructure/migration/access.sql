-- REDUNDANCY-01/02 access parity: does the app see the same rows, as each kind of user, on source and target?
-- Structural parity compares the raw database as a superuser. The app never reads that way: it reads through row level
-- security as a guest (anon), a signed-in user (authenticated + JWT claims) or an admin. If the target's Auth layer
-- evaluates auth.uid() / claims differently (exit B), every policy shows different rows while the schema still matches.
--
-- For each identity — anon, the three lowest auth.users ids, and the lowest-id admin when public.profiles.is_admin
-- exists — and each readable table/view in the application schemas, this counts (and optionally hashes) the rows that
-- identity can see. Identities are chosen from the data itself, so identical data picks identical people on both sides.
-- A read that errors (a policy calling a function that refuses that identity) is recorded by SQLSTATE, not skipped.
--
-- It needs a transaction that may create temp tables (not READ ONLY); parity.py runs it in its own transaction and
-- rolls it back. The connecting role must be allowed to SET ROLE anon / authenticated (Supabase's postgres role is).
-- Settings read: tapuai.parity_schemas ('auto' or a comma list), tapuai.parity_hash_rows ('off' = counts only).
set local row_security = on;  -- pg_restore leaves its session with row_security off; reads must filter, not fail
create temp table if not exists tapuai_access (who text, key text, row_count bigint, digest text, error text) on commit drop;
create temp table if not exists tapuai_identities (who text, role text, claims text) on commit drop;
do $$
declare
  requested text := coalesce(nullif(current_setting('tapuai.parity_schemas', true), ''), 'auto');
  managed text[] := array['auth','storage','realtime','_realtime','extensions','graphql','graphql_public','vault','pgsodium',
                          'pgsodium_masks','supabase_functions','supabase_migrations','net','pgbouncer','cron','pgtle','_analytics',
                          'topology','tiger','tiger_data'];
  scope text[];
  hash boolean := coalesce(current_setting('tapuai.parity_hash_rows', true), 'on') <> 'off';
  ident record;
  rel record;
  uid uuid;
  n bigint;
  d text;
begin
  if requested = 'auto' then
    select coalesce(array_agg(nspname order by nspname), '{}') into scope from pg_namespace
    where nspname <> all (managed) and nspname not in ('pg_catalog', 'information_schema')
      and nspname not like 'pg\_toast%' and nspname not like 'pg\_temp%'
      and oid not in (select objid from pg_depend where deptype = 'e');
  else
    select array_agg(trim(s)) into scope from unnest(string_to_array(requested, ',')) s where trim(s) <> '';
  end if;

  insert into tapuai_identities values ('anon', 'anon', '{"role":"anon"}');
  if to_regclass('auth.users') is not null then
    for uid in execute 'select id from auth.users order by id limit 3' loop
      insert into tapuai_identities values ('user:' || uid, 'authenticated',
        json_build_object('role', 'authenticated', 'sub', uid, 'aal', 'aal1')::text);
    end loop;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin') then
    for uid in execute 'select id from public.profiles where is_admin order by id limit 1' loop
      insert into tapuai_identities values ('admin:' || uid, 'authenticated',
        json_build_object('role', 'authenticated', 'sub', uid, 'aal', 'aal2')::text);
    end loop;
  end if;

  for ident in select * from tapuai_identities order by who loop
    for rel in
      select ns.nspname, c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = any (scope) and c.relkind in ('r', 'p', 'v', 'm')
        and c.oid not in (select objid from pg_depend where deptype = 'e')
      order by 1, 2
    loop
      if not has_table_privilege(ident.role, format('%I.%I', rel.nspname, rel.relname), 'SELECT') then
        continue;
      end if;
      begin
        perform set_config('request.jwt.claims', ident.claims, true);
        -- Older auth.uid() implementations read the single-claim setting instead of the JSON.
        perform set_config('request.jwt.claim.sub', coalesce(ident.claims::json ->> 'sub', ''), true);
        perform set_config('request.jwt.claim.role', ident.role, true);
        execute format('set local role %I', ident.role);
        execute format('select count(*)::bigint, %s from %I.%I t',
          case when hash then 'coalesce(md5(string_agg(md5(t::text), '''' order by md5(t::text))), '''')' else 'null::text' end,
          rel.nspname, rel.relname) into n, d;
        execute 'reset role';
        insert into tapuai_access values (ident.who, rel.nspname || '.' || rel.relname, n, d, null);
      exception when others then
        -- The failed read's subtransaction is rolled back, which also undoes its SET LOCAL ROLE.
        insert into tapuai_access values (ident.who, rel.nspname || '.' || rel.relname, null, null, sqlstate);
      end;
    end loop;
  end loop;
end $$;
select coalesce(jsonb_agg(jsonb_build_object('who', who, 'key', key, 'count', row_count, 'digest', digest, 'error', error)
                          order by who, key), '[]'::jsonb)::text as access
from tapuai_access;
