-- Put a role check on `operator_checkins` (GPS coordinates from the field-operator gig check-in).
--
-- Found in the 2026-09 data-privacy sweep (docs/DATA_PRIVACY_MAP.md §3.1): the policy was
-- `using (true) with check (true)`, so any signed-in account — not just an operator — could read
-- every check-in's location or write fabricated ones. This brings it to parity with its sibling
-- table `operator_gigs` ("Operators write gigs"): the demo-PIN console (no session, `anon`),
-- operators, and admins.
--
-- Not a new or wider gap: the `anon` bypass is the same accepted internal-testing-only trade-off as
-- the Phase 5 hard blocker in docs/ROADMAP.md (Studio Unlock / Operator PIN have no real session).
-- It stops being acceptable before public beta, and must be replaced with real sessions then.
-- Grants are unchanged (select + insert only), so `for all` here cannot update or delete.
--
-- Depends on: `public.current_user_role()` (already in schema.sql).
-- Not applied to any Supabase project yet.
--
-- Rollback:
--   drop policy if exists "Operators write checkins" on public.operator_checkins;
--   create policy "Operators write checkins" on public.operator_checkins for all using (true) with check (true);

drop policy if exists "Operators write checkins" on public.operator_checkins;
create policy "Operators write checkins"
  on public.operator_checkins for all
  using (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'))
  with check (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'));
