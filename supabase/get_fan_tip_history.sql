-- Fan Mālo ledger + receipts RPC. Safe to re-run.
-- Creates `public.tips` when this project never ran full schema.sql (42P01).

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.players') is null then
    return;
  end if;
  alter table public.tips
    add constraint tips_player_id_fkey
    foreign key (player_id) references public.players (id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

alter table public.tips add column if not exists fan_id uuid;
alter table public.tips add column if not exists reel_id uuid;
alter table public.tips add column if not exists aura_points integer not null default 0;

do $$
begin
  if to_regclass('public.reels') is null then
    return;
  end if;
  alter table public.tips
    add constraint tips_reel_id_fkey
    foreign key (reel_id) references public.reels (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists tips_fan_id_created_at_idx on public.tips (fan_id, created_at desc);

alter table public.tips enable row level security;

drop policy if exists "Public read tips" on public.tips;
create policy "Public read tips" on public.tips for select using (true);

drop policy if exists "Insert tips" on public.tips;
create policy "Insert tips" on public.tips for insert with check (true);

grant select, insert on public.tips to anon, authenticated;

drop function if exists public.get_fan_tip_history(uuid);

create or replace function public.get_fan_tip_history(fan_user_id uuid)
returns table (
  id uuid,
  player_id uuid,
  reel_id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  athlete_name text,
  school_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.player_id,
    t.reel_id,
    t.amount_cents,
    coalesce(t.aura_points, 0) as aura_points,
    t.created_at,
    coalesce(p.name, 'Athlete') as athlete_name,
    coalesce(nullif(p.school_name, ''), '') as school_name
  from public.tips t
  left join public.players p on p.id = t.player_id
  where t.fan_id = coalesce(auth.uid(), fan_user_id)
  order by t.created_at desc;
$$;

grant execute on function public.get_fan_tip_history(uuid) to anon, authenticated;
