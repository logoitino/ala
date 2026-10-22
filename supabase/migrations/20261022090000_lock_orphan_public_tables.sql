-- Lock two orphan public tables found by the Supabase advisor (rls_disabled_in_public, flagged 2026-10-20).
--
-- Threat: development has public.school_teams and public.app_feature_flags with RLS off and anon read/write
-- grants, so anyone with the public key could read or rewrite them. Neither table is in schema.sql or used by any
-- app, function or migration (repo grep 2026-10-22), so the app needs no policy: RLS on with none denies clients,
-- and the service role / SQL Editor keep access. Guarded with to_regclass so it is a no-op where they don't exist.
--
-- Applied: development 2026-10-22 (Claude Code via the Supabase plugin). Staging has neither table.
-- Rollback: alter table … disable row level security; grant select, insert, update, delete on … to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['school_teams', 'app_feature_flags'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
