-- Web Admin Dashboard: profiles.is_admin, reel takedowns, Spotlight publish, metrics.
-- Safe to re-run.

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.reels add column if not exists is_removed boolean not null default false;

update public.profiles
set is_admin = true
where coalesce(is_admin, false) = false
  and (
    role = 'admin'
    or coalesce(roles, array[]::text[]) @> array['admin']::text[]
  );

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when coalesce(is_admin, false)
          or role = 'admin'
          or coalesce(roles, array[]::text[]) @> array['admin']::text[]
        then 'admin'
        else role
      end
      from public.profiles
      where user_id = auth.uid()
      limit 1
    ),
    'guest'
  );
$$;

drop function if exists public.add_user_role(text);

create or replace function public.add_user_role(new_role text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  next_roles text[];
  normalized text;
begin
  normalized := lower(btrim(coalesce(new_role, '')));
  if normalized = '' then
    raise exception 'role required';
  end if;

  update public.profiles
  set
    roles = (
      select coalesce(array_agg(distinct r), array[normalized]::text[])
      from unnest(
        coalesce(roles, array[]::text[])
        || array[normalized]::text[]
        || case when normalized = 'athlete' then array['fan']::text[] else array[]::text[] end
      ) as r
    ),
    role = case
      when normalized = 'admin' then 'admin'
      when normalized = 'athlete' then 'athlete'
      else role
    end,
    is_admin = case when normalized = 'admin' then true else is_admin end,
    active_role = case
      when normalized = 'athlete' then 'athlete'
      when normalized in ('fan', 'athlete') then normalized
      else coalesce(nullif(active_role, ''), 'fan')
    end
  where user_id = auth.uid()
  returning roles into next_roles;

  return next_roles;
end;
$$;

drop function if exists public.publish_spotlight_award(uuid, text, text, date, date);

create or replace function public.publish_spotlight_award(
  target_player_id uuid,
  award_headline text,
  period_kind text,
  window_start date,
  window_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := lower(btrim(coalesce(period_kind, 'week')));
  headline text := btrim(coalesce(award_headline, ''));
  athlete public.players%rowtype;
  linked uuid;
  clip uuid;
  award_id uuid;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  if kind not in ('week', 'month', 'player_of_the_week', 'player_of_the_month') then
    raise exception 'Unknown period_kind %', period_kind;
  end if;
  if headline = '' then
    raise exception 'Headline required';
  end if;
  if window_start is null or window_end is null or window_end < window_start then
    raise exception 'Valid start and end dates required';
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    raise exception 'Athlete not found.';
  end if;

  select pr.id into linked
  from public.profiles pr
  where pr.id = target_player_id
     or lower(pr.full_name) = lower(athlete.name)
  order by case when pr.id = target_player_id then 0 else 1 end
  limit 1;

  select r.id into clip
  from public.reels r
  where r.player_id = athlete.id
    and coalesce(r.is_removed, false) = false
    and coalesce(r.is_vault_only, false) = false
  order by r.created_at desc
  limit 1;

  insert into public.spotlight_awards (
    athlete_id, award_type, level, district_region, headline, highlight_reel_id, start_date, end_date
  )
  values (
    linked,
    case when kind in ('month', 'player_of_the_month') then 'month' else 'week' end,
    'school',
    athlete.school_name,
    headline,
    clip,
    window_start,
    window_end
  )
  returning id into award_id;

  return jsonb_build_object(
    'id', award_id,
    'athlete_id', linked,
    'player_id', athlete.id,
    'headline', headline,
    'highlight_reel_id', clip,
    'start_date', window_start,
    'end_date', window_end,
    'award_type', case when kind in ('month', 'player_of_the_month') then 'month' else 'week' end
  );
end;
$$;

drop function if exists public.moderate_flagged_reel(uuid, text);

create or replace function public.moderate_flagged_reel(
  target_reel_id uuid,
  moderation_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action text := lower(btrim(coalesce(moderation_action, '')));
  result public.reels%rowtype;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  if action not in ('dismiss', 'remove') then
    raise exception 'Unknown moderation_action %', moderation_action;
  end if;

  if action = 'dismiss' then
    update public.reels
    set is_flagged = false
    where id = target_reel_id
    returning * into result;
  else
    update public.reels
    set is_removed = true, is_flagged = false
    where id = target_reel_id
    returning * into result;
  end if;

  if result.id is null then
    raise exception 'Highlight not found.';
  end if;

  return jsonb_build_object(
    'id', result.id,
    'is_flagged', result.is_flagged,
    'is_removed', coalesce(result.is_removed, false)
  );
end;
$$;

drop function if exists public.get_admin_platform_metrics();

create or replace function public.get_admin_platform_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'highlight_count', (
      select count(*)::int from public.reels where coalesce(is_removed, false) = false
    ),
    'engagement_count', (
      select coalesce(sum(coalesce(seki_count, 0) + coalesce(aura_count, 0) + coalesce(flex_count, 0)), 0)::int
      from public.reels
      where coalesce(is_removed, false) = false
    ),
    'malo_cents', (
      select coalesce(sum(amount_cents), 0)::int from public.tips
    ),
    'open_flags', (
      select count(*)::int
      from public.reels
      where coalesce(is_flagged, false) = true
        and coalesce(is_removed, false) = false
    ),
    'telemetry_events_24h', (
      select count(*)::int
      from public.telemetry_logs
      where created_at >= timezone('utc', now()) - interval '24 hours'
    )
  );
$$;

drop policy if exists "Admin write spotlight awards" on public.spotlight_awards;
create policy "Admin write spotlight awards"
  on public.spotlight_awards for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

grant select, insert, update, delete on public.spotlight_awards to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.add_user_role(text) to authenticated;
grant execute on function public.publish_spotlight_award(uuid, text, text, date, date) to anon, authenticated;
grant execute on function public.moderate_flagged_reel(uuid, text) to anon, authenticated;
grant execute on function public.get_admin_platform_metrics() to anon, authenticated;
