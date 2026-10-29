-- Sports builder: per-sport scoring, periods, callouts, and Stats 📊 fields. Safe to re-run.

create table if not exists public.sport_configs (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  emoji text not null default '🏅',
  period_label text not null default 'Period',
  periods jsonb not null default '["P1","P2","OT"]'::jsonb,
  uses_clock boolean not null default true,
  clock_seconds integer not null default 720,
  scoring jsonb not null default '[]'::jsonb,
  callouts jsonb not null default '[]'::jsonb,
  stat_fields jsonb not null default '[]'::jsonb,
  measurables jsonb not null default '[]'::jsonb,
  positions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sport_configs add column if not exists emoji text not null default '🏅';
alter table public.sport_configs add column if not exists period_label text not null default 'Period';
alter table public.sport_configs add column if not exists periods jsonb not null default '["P1","P2","OT"]'::jsonb;
alter table public.sport_configs add column if not exists uses_clock boolean not null default true;
alter table public.sport_configs add column if not exists clock_seconds integer not null default 720;
alter table public.sport_configs add column if not exists scoring jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists callouts jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists stat_fields jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists measurables jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists positions jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists is_active boolean not null default true;
alter table public.sport_configs add column if not exists sort_order integer not null default 0;
alter table public.sport_configs add column if not exists updated_at timestamptz not null default now();

create unique index if not exists sport_configs_sport_key
  on public.sport_configs (lower(btrim(sport)));

-- Which playbook a match uses. Operator console reads it to build score buttons and period chips.
alter table public.games add column if not exists sport text not null default 'Football';

alter table public.sport_configs enable row level security;

drop policy if exists "Public read sport configs" on public.sport_configs;
create policy "Public read sport configs"
  on public.sport_configs for select
  using (true);

drop policy if exists "Admin write sport configs" on public.sport_configs;
create policy "Admin write sport configs"
  on public.sport_configs for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

/**
 * Every playbook, active first, in builder order. The fan app and operator console both read this.
 */
create or replace function public.get_sport_configs()
returns setof public.sport_configs
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.sport_configs
  order by sort_order, sport
  limit 100;
$$;

/**
 * Create or update one playbook from the admin Sports desk. Matching is by lower(sport) so a
 * rename creates a new row instead of silently orphaning games.
 */
create or replace function public.upsert_sport_config(payload jsonb)
returns public.sport_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  sport_n text := btrim(coalesce(payload ->> 'sport', ''));
  target_id uuid := nullif(payload ->> 'id', '')::uuid;
  result public.sport_configs;
begin
  if sport_n = '' then
    raise exception 'Name the sport before saving.';
  end if;

  if target_id is null then
    select id into target_id
    from public.sport_configs
    where lower(btrim(sport)) = lower(sport_n);
  end if;

  insert into public.sport_configs as sc (
    id, sport, emoji, period_label, periods, uses_clock, clock_seconds,
    scoring, callouts, stat_fields, measurables, positions, is_active, sort_order, updated_at
  )
  values (
    coalesce(target_id, gen_random_uuid()),
    sport_n,
    coalesce(nullif(payload ->> 'emoji', ''), '🏅'),
    coalesce(nullif(payload ->> 'period_label', ''), 'Period'),
    coalesce(payload -> 'periods', '[]'::jsonb),
    coalesce((payload ->> 'uses_clock')::boolean, true),
    greatest(coalesce((payload ->> 'clock_seconds')::integer, 0), 0),
    coalesce(payload -> 'scoring', '[]'::jsonb),
    coalesce(payload -> 'callouts', '[]'::jsonb),
    coalesce(payload -> 'stat_fields', '[]'::jsonb),
    coalesce(payload -> 'measurables', '[]'::jsonb),
    coalesce(payload -> 'positions', '[]'::jsonb),
    coalesce((payload ->> 'is_active')::boolean, true),
    coalesce((payload ->> 'sort_order')::integer, 0),
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    sport = excluded.sport,
    emoji = excluded.emoji,
    period_label = excluded.period_label,
    periods = excluded.periods,
    uses_clock = excluded.uses_clock,
    clock_seconds = excluded.clock_seconds,
    scoring = excluded.scoring,
    callouts = excluded.callouts,
    stat_fields = excluded.stat_fields,
    measurables = excluded.measurables,
    positions = excluded.positions,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = timezone('utc', now())
  returning * into result;

  return result;
end;
$$;

/**
 * Remove a playbook. Games keep their `sport` text and fall back to the generic console.
 */
create or replace function public.delete_sport_config(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sport_configs where id = target_id;
  return found;
end;
$$;

grant select on public.sport_configs to anon, authenticated;
grant insert, update, delete on public.sport_configs to anon, authenticated;
grant execute on function public.get_sport_configs() to anon, authenticated;
grant execute on function public.upsert_sport_config(jsonb) to anon, authenticated;
grant execute on function public.delete_sport_config(uuid) to anon, authenticated;
