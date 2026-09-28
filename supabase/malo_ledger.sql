-- Mālo channel breakdown for the admin portal, and the athlete's received-gift list.
-- Safe to re-run. Apply after supabase/tip_origin.sql so origin / entry / source_label exist.
-- Admin body requires current_user_role() = 'admin'. Athletes and linked guardians read only their player.

create or replace function public.get_admin_malo_breakdown()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'by_origin', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'origin', grouped.origin,
        'cents', grouped.cents,
        'count', grouped.n
      ) order by grouped.cents desc), '[]'::jsonb)
      from (
        select coalesce(origin, 'profile') as origin,
               coalesce(sum(amount_cents), 0)::int as cents,
               count(*)::int as n
        from public.tips
        group by 1
      ) grouped
    ),
    'by_entry', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'entry', grouped.entry,
        'cents', grouped.cents,
        'count', grouped.n
      ) order by grouped.cents desc), '[]'::jsonb)
      from (
        select coalesce(entry, 'in_app') as entry,
               coalesce(sum(amount_cents), 0)::int as cents,
               count(*)::int as n
        from public.tips
        group by 1
      ) grouped
    ),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', grouped.day,
        'origin', grouped.origin,
        'cents', grouped.cents,
        'count', grouped.n
      ) order by grouped.day, grouped.origin), '[]'::jsonb)
      from (
        select to_char(created_at at time zone 'utc', 'YYYY-MM-DD') as day,
               coalesce(origin, 'profile') as origin,
               coalesce(sum(amount_cents), 0)::int as cents,
               count(*)::int as n
        from public.tips
        where created_at >= timezone('utc', now()) - interval '14 days'
        group by 1, 2
      ) grouped
    ),
    'recent', (
      select coalesce(jsonb_agg(to_jsonb(recent_row) order by recent_row.created_at desc), '[]'::jsonb)
      from (
        select
          t.id,
          t.amount_cents,
          coalesce(t.aura_points, 0) as aura_points,
          t.created_at,
          coalesce(t.origin, 'profile') as origin,
          coalesce(t.entry, 'in_app') as entry,
          coalesce(t.source_label, '') as source_label,
          t.reel_id,
          t.wishlist_item_id,
          coalesce(nullif(p.name, ''), 'Athlete') as athlete_name,
          coalesce(nullif(f.full_name, ''), 'Fan') as fan_name
        from public.tips t
        left join public.players p on p.id = t.player_id
        left join public.profiles f on f.user_id = t.fan_id
        order by t.created_at desc
        limit 40
      ) recent_row
    )
  ) into payload;

  return payload;
end;
$$;

-- Gifts an athlete (or their linked guardian) can read. Fans still use get_fan_tip_history for what they sent.
create or replace function public.get_received_malo(target_player_id uuid)
returns table (
  id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  origin text,
  entry text,
  source_label text,
  reel_id uuid,
  wishlist_item_id uuid,
  fan_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target_player_id is null then
    return;
  end if;

  if public.current_user_role() is distinct from 'admin'
    and not exists (
      select 1
      from public.profiles me
      where me.user_id = auth.uid()
        and me.player_id = target_player_id
    )
    and not exists (
      select 1
      from public.players pl
      join public.profiles me on me.id = pl.guardian_id
      where pl.id = target_player_id
        and me.user_id = auth.uid()
    )
  then
    return;
  end if;

  return query
  select
    t.id,
    t.amount_cents,
    coalesce(t.aura_points, 0) as aura_points,
    t.created_at,
    coalesce(t.origin, 'profile') as origin,
    coalesce(t.entry, 'in_app') as entry,
    coalesce(t.source_label, '') as source_label,
    t.reel_id,
    t.wishlist_item_id,
    coalesce(nullif(f.full_name, ''), 'Fan') as fan_name
  from public.tips t
  left join public.profiles f on f.user_id = t.fan_id
  where t.player_id = target_player_id
  order by t.created_at desc
  limit 100;
end;
$$;

revoke execute on function public.get_admin_malo_breakdown() from public, anon;
grant execute on function public.get_admin_malo_breakdown() to authenticated;
revoke execute on function public.get_received_malo(uuid) from public, anon;
grant execute on function public.get_received_malo(uuid) to authenticated;
