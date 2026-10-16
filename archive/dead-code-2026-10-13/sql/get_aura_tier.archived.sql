-- ARCHIVED 2026-10-13 · DATA-01-F5 · owner approved · database function get_aura_tier, formerly in schema.sql.
-- Never called (the app computes Aura tiers in apps/mobile/src/frontend/lib/aura.ts). Dropped by
-- supabase/migrations/20261013120000_data_governance_closures.sql. Restore: run this file and copy it back onto schema.sql.

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
