-- Second tap clears this fan's Seki / Aura / Flex on a Highlight.
-- Canonical copy: apps/mobile/src/backend/db/schema.sql (clear_reel_hype).

create or replace function public.clear_reel_hype(target_reel_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.reels%rowtype;
  viewer uuid := auth.uid();
  removed integer := 0;
begin
  if viewer is null then
    raise exception 'Sign in to change hype';
  end if;

  if hype_kind not in ('aura', 'flex', 'seki') then
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  delete from public.reel_hype_votes
  where user_id = viewer
    and reel_id = target_reel_id
    and kind = hype_kind;
  get diagnostics removed = row_count;

  if removed > 0 then
    if hype_kind = 'aura' then
      update public.reels
      set aura_count = greatest(coalesce(aura_count, 0) - 1, 0)
      where id = target_reel_id
      returning * into result;
    elsif hype_kind = 'flex' then
      update public.reels
      set flex_count = greatest(coalesce(flex_count, 0) - 1, 0)
      where id = target_reel_id
      returning * into result;
    else
      update public.reels
      set seki_count = greatest(coalesce(seki_count, 0) - 1, 0)
      where id = target_reel_id
      returning * into result;
    end if;
    perform public.sync_live_spotlight_awards();
  else
    select * into result from public.reels where id = target_reel_id;
  end if;

  return jsonb_build_object(
    'seki_count', coalesce(result.seki_count, 0),
    'aura_count', coalesce(result.aura_count, 0),
    'flex_count', coalesce(result.flex_count, 0),
    'total_tips_cents', coalesce(result.total_tips_cents, 0),
    'applied', removed > 0
  );
end;
$$;

revoke execute on function public.clear_reel_hype(uuid, text) from public, anon;
grant execute on function public.clear_reel_hype(uuid, text) to authenticated;
