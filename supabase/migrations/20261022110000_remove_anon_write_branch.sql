-- Remove the auth.role() = 'anon' branch from admin and operator policies (STATE §5, internal-testing hole 2).
--
-- Threat: any guest with the public key passed the anon branch, so could rewrite games and scores, post plays, edit
-- sport configs, shop, sponsorships, wishlists, schools, cheer polls and read every app_feedback row. Studio Unlock and
-- the Operator PIN are client-only checks, so the branch never limited anything to them. Admin desks now need a
-- signed-in admin; the operator console a signed-in operator or admin (WORK_QUEUE P1-06 owns real operator sessions).
-- Development also carried five older write policies that are not in schema.sql (open to everyone); they are dropped.
-- Each policy below is the schema.sql definition with only the anon branch removed.
--
-- Applied: staging and development 2026-10-22 (Claude Code). Replay: scripts/replay/anon-branch-replay.mjs.
-- Rollback: re-create each policy from schema.sql before this file (the anon branch restored).

drop policy if exists "Public Update/Insert Games" on public.games;
drop policy if exists "Public Operator Update Games" on public.games;
drop policy if exists "Operators Can Update Games" on public.games;
drop policy if exists "Public Insert Game Events" on public.game_events;
drop policy if exists "Booster Insert Sponsorships" on public.sponsorships;

drop policy if exists "Admin read app feedback" on public.app_feedback;
create policy "Admin read app feedback" on public.app_feedback for select
  using (public.current_user_role() = 'admin');
drop policy if exists "Admin write app feedback" on public.app_feedback;
create policy "Admin write app feedback" on public.app_feedback for update
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

do $$
declare t text;
begin
  -- Same admin-only write rule on each desk table; the policy names are unchanged.
  foreach t in array array['cheer_polls', 'schools_and_teams', 'shop_products', 'sponsorships', 'sport_configs', 'wishlist_items'] loop
    execute format('drop policy if exists %I on public.%I', 'Admin write ' || replace(t, '_', ' '), t);
    execute format('create policy %I on public.%I for all using (public.current_user_role() = %L) with check (public.current_user_role() = %L)',
      'Admin write ' || replace(t, '_', ' '), t, 'admin', 'admin');
  end loop;
end $$;

drop policy if exists "Operators insert game_events" on public.game_events;
create policy "Operators insert game_events" on public.game_events for insert
  with check (public.current_user_role() in ('operator', 'admin'));
drop policy if exists "Operators update games" on public.games;
create policy "Operators update games" on public.games for update
  using (public.current_user_role() in ('operator', 'admin')) with check (public.current_user_role() in ('operator', 'admin'));
drop policy if exists "Operators insert checkins" on public.operator_checkins;
create policy "Operators insert checkins" on public.operator_checkins for insert to authenticated
  with check (public.current_user_role() in ('operator', 'admin'));
drop policy if exists "Operators write gigs" on public.operator_gigs;
create policy "Operators write gigs" on public.operator_gigs for all
  using (public.current_user_role() in ('operator', 'admin')) with check (public.current_user_role() in ('operator', 'admin'));
