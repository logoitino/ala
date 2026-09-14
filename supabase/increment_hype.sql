-- Public jumbotron stats: views + Aura / Flex / Seki on an athlete profile.
alter table public.players add column if not exists view_count integer not null default 0;
alter table public.players add column if not exists aura_count integer not null default 0;
alter table public.players add column if not exists flex_count integer not null default 0;
alter table public.players add column if not exists seki_count integer not null default 0;

create or replace function public.increment_player_hype(target_player_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.players%rowtype;
begin
  if hype_kind = 'view' then
    update public.players
    set view_count = coalesce(view_count, 0) + 1
    where id = target_player_id
    returning * into result;
  elsif hype_kind = 'aura' then
    update public.players
    set aura_count = coalesce(aura_count, 0) + 1
    where id = target_player_id
    returning * into result;
  elsif hype_kind = 'flex' then
    update public.players
    set flex_count = coalesce(flex_count, 0) + 1
    where id = target_player_id
    returning * into result;
  elsif hype_kind = 'seki' then
    update public.players
    set seki_count = coalesce(seki_count, 0) + 1
    where id = target_player_id
    returning * into result;
  else
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  return jsonb_build_object(
    'view_count', coalesce(result.view_count, 0),
    'aura_count', coalesce(result.aura_count, 0),
    'flex_count', coalesce(result.flex_count, 0),
    'seki_count', coalesce(result.seki_count, 0)
  );
end;
$$;

grant execute on function public.increment_player_hype(uuid, text) to anon, authenticated;
