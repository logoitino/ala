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
alter table public.tips add column if not exists origin text not null default 'profile';
alter table public.tips add column if not exists entry text not null default 'in_app';
alter table public.tips add column if not exists source_label text not null default '';
alter table public.tips add column if not exists wishlist_item_id uuid;

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

-- Policies stay in schema.sql: SELECT own fan_id or admin, INSERT auth.uid() = fan_id
-- and not frozen. This file used to reset INSERT to `with check (true)` and grant anon.
grant select, insert on public.tips to authenticated;

drop function if exists public.get_fan_tip_history(uuid);

-- fan_user_id is accepted (and ignored) only for client call-signature compatibility;
-- the function ALWAYS scopes to the authenticated caller and never trusts a
-- client-supplied identity. An anonymous caller (auth.uid() is null) gets zero rows.
create or replace function public.get_fan_tip_history(fan_user_id uuid)
returns table (
  id uuid,
  player_id uuid,
  reel_id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  athlete_name text,
  school_name text,
  origin text,
  entry text,
  wishlist_item_id uuid,
  source_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    t.id,
    t.player_id,
    t.reel_id,
    t.amount_cents,
    coalesce(t.aura_points, 0) as aura_points,
    t.created_at,
    coalesce(p.name, 'Athlete') as athlete_name,
    coalesce(nullif(p.school_name, ''), '') as school_name,
    coalesce(t.origin, 'profile') as origin,
    coalesce(t.entry, 'in_app') as entry,
    t.wishlist_item_id,
    coalesce(t.source_label, '') as source_label
  from public.tips t
  left join public.players p on p.id = t.player_id
  where auth.uid() is not null
    and t.fan_id = auth.uid()
  order by t.created_at desc;
end;
$$;

grant execute on function public.get_fan_tip_history(uuid) to authenticated;
