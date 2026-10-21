-- RALLY · Guests can read live Rallies again (2026-10-20). Written locally, NOT applied anywhere.
--
-- Purpose: the one read policy on `public.rallies` ("Read public or own rallies", migration 20260929180000) is
--   using (status in ('live','filled','closed') or public.rally_manager_role(player_id) is not null)
-- but the same migration revokes EXECUTE on `rally_manager_role` from anon. PostgreSQL checks EXECUTE on every
-- function in the expression, so a guest read of `rallies` fails with 42501 "permission denied for function
-- rally_manager_role" instead of returning live Rallies: guests see no Rally meter on profiles or Highlights.
-- Found by REDUNDANCY access parity (infrastructure/migration/access.sql); reproduced in scripts/replay/schema-replay.mjs.
--
-- Fix: split the policy so guests only ever evaluate the status test. Permissive policies OR together, so a
-- signed-in user sees exactly what they saw before (public statuses, plus every Rally they manage). The function
-- stays closed to anon (function access hardening unchanged). The "Closed accounts" restrictive policy still applies.
--
-- Apply order: after 20260929180000 (any time; independent of the October files). Staging first, then check a guest
-- profile with a live Rally shows its meter.
--
-- Rollback:
--   drop policy if exists "Read public rallies" on public.rallies;
--   drop policy if exists "Managers read own rallies" on public.rallies;
--   create policy "Read public or own rallies" on public.rallies for select
--     using (status in ('live', 'filled', 'closed') or public.rally_manager_role(player_id) is not null);

drop policy if exists "Read public or own rallies" on public.rallies;

drop policy if exists "Read public rallies" on public.rallies;
create policy "Read public rallies"
  on public.rallies for select
  to anon, authenticated
  using (status in ('live', 'filled', 'closed'));

drop policy if exists "Managers read own rallies" on public.rallies;
create policy "Managers read own rallies"
  on public.rallies for select
  to authenticated
  using (public.rally_manager_role(player_id) is not null);
