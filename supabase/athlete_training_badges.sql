-- Athlete HQ training badges. Catalog + earn rules live in @tapuai/shared-types
-- (`TRAINING_BADGES`). This table stores first-unlock time; the RPC re-evaluates
-- live predicates (confirmed tags, Mālo, roster claim) and upserts.
-- Safe to re-run. Not Spotlight awards and not athlete_career_stats.mvp_badges.

create table if not exists public.athlete_training_badge_unlocks (
  player_id uuid not null references public.players (id) on delete cascade,
  badge_id text not null check (
    badge_id in ('film_room_starter', 'community_backer_magnet', 'friday_night_lights')
  ),
  unlocked_at timestamptz not null default timezone('utc', now()),
  primary key (player_id, badge_id)
);

create index if not exists athlete_training_badge_unlocks_player_idx
  on public.athlete_training_badge_unlocks (player_id, unlocked_at desc);

alter table public.athlete_training_badge_unlocks enable row level security;

drop policy if exists "Public read athlete training badges" on public.athlete_training_badge_unlocks;
create policy "Public read athlete training badges"
  on public.athlete_training_badge_unlocks for select
  using (true);

grant select on public.athlete_training_badge_unlocks to anon, authenticated;

/**
 * Evaluate Athlete HQ badges from real tables and persist first unlocks.
 * film_room_starter         → reels.tag_status = confirmed
 * community_backer_magnet   → tips.amount_cents > 0
 * friday_night_lights       → profiles.player_id claimed this roster row
 */
create or replace function public.sync_athlete_training_badges(target_player_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  player uuid := target_player_id;
  confirmed_tags integer := 0;
  malo_cents integer := 0;
  roster_claimed boolean := false;
begin
  if player is null then
    select pr.player_id into player
    from public.profiles pr
    where pr.user_id = auth.uid()
    limit 1;
  end if;

  if player is null then
    return jsonb_build_object(
      'player_id', null,
      'confirmed_tags', 0,
      'malo_cents', 0,
      'roster_claimed', false,
      'unlocks', '[]'::jsonb
    );
  end if;

  select count(*)::integer into confirmed_tags
  from public.reels r
  where r.player_id = player
    and r.tag_status = 'confirmed'
    and coalesce(r.is_removed, false) = false;

  select coalesce(sum(t.amount_cents), 0)::integer into malo_cents
  from public.tips t
  where t.player_id = player;

  select exists (
    select 1 from public.profiles pr where pr.player_id = player
  ) into roster_claimed;

  if confirmed_tags > 0 then
    insert into public.athlete_training_badge_unlocks (player_id, badge_id)
    values (player, 'film_room_starter')
    on conflict (player_id, badge_id) do nothing;
  end if;

  if malo_cents > 0 then
    insert into public.athlete_training_badge_unlocks (player_id, badge_id)
    values (player, 'community_backer_magnet')
    on conflict (player_id, badge_id) do nothing;
  end if;

  if roster_claimed then
    insert into public.athlete_training_badge_unlocks (player_id, badge_id)
    values (player, 'friday_night_lights')
    on conflict (player_id, badge_id) do nothing;
  end if;

  return jsonb_build_object(
    'player_id', player,
    'confirmed_tags', confirmed_tags,
    'malo_cents', malo_cents,
    'roster_claimed', roster_claimed,
    'unlocks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'badge_id', u.badge_id,
          'unlocked_at', u.unlocked_at
        )
        order by u.unlocked_at
      )
      from public.athlete_training_badge_unlocks u
      where u.player_id = player
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.sync_athlete_training_badges(uuid) to anon, authenticated;
