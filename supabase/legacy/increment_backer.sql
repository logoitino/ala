-- Allow a signed-in fan to increment a player's backer_count after a successful Mālo.
-- Canonical body lives in apps/mobile/src/backend/db/schema.sql. Keep the freeze check here so
-- re-running this incremental cannot replace that function with the older ungated version.
create or replace function public.increment_backer_count(target_player_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if public.malo_target_frozen(target_player_id) then
    raise exception 'Mālo is frozen for this athlete; backer count cannot be incremented.';
  end if;

  update public.players
  set backer_count = coalesce(backer_count, 0) + 1
  where id = target_player_id
  returning backer_count into new_count;

  return new_count;
end;
$$;

-- 2026-09 audit item 1: authenticated only, matching schema.sql. REVOKE so a re-run
-- drops the earlier anon grant from this file.
revoke execute on function public.increment_backer_count(uuid) from anon;
grant execute on function public.increment_backer_count(uuid) to authenticated;
