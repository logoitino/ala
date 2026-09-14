-- Award aura points after a successful Mālo. Safe to re-run.

alter table public.players add column if not exists aura_points integer not null default 0;
alter table public.profiles add column if not exists aura_points integer not null default 0;
alter table public.profiles add column if not exists username text;

drop function if exists public.add_user_aura(uuid, integer);
drop function if exists public.get_aura_tier(integer);

create or replace function public.add_user_aura(target_user_id uuid, points_to_add integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  add_points integer;
  player_total integer;
  profile_total integer;
begin
  add_points := greatest(coalesce(points_to_add, 0), 0);

  update public.players
  set aura_points = coalesce(aura_points, 0) + add_points
  where id = target_user_id
  returning aura_points into player_total;

  update public.profiles
  set aura_points = coalesce(aura_points, 0) + add_points
  where user_id = target_user_id or id = target_user_id
  returning aura_points into profile_total;

  return jsonb_build_object(
    'aura_points', coalesce(player_total, profile_total, add_points),
    'player_aura_points', player_total,
    'profile_aura_points', profile_total,
    'points_added', add_points
  );
end;
$$;

grant execute on function public.add_user_aura(uuid, integer) to anon, authenticated;

create or replace function public.get_aura_tier(points integer)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'tier', ranked.tier,
    'title', ranked.title,
    'min_points', ranked.min_points,
    'color', ranked.color
  )
  from (
    select *
    from (
      values
        (1, 0, 'Slate Silver', '#94A3B8'),
        (2, 8, 'Island Cyan', '#00E5FF'),
        (3, 20, 'Neon Jade', '#00E676'),
        (4, 40, 'Electric Violet', '#B388FF'),
        (5, 70, 'Crimson Ember', '#FF1744'),
        (6, 110, 'Polished Gold', '#FFD700'),
        (7, 170, 'Celestial Prism', '#00E676')
    ) as t(tier, min_points, title, color)
    where greatest(coalesce(points, 0), 0) >= t.min_points
    order by t.min_points desc
    limit 1
  ) ranked;
$$;

grant execute on function public.get_aura_tier(integer) to anon, authenticated;
