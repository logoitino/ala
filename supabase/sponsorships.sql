-- Local booster sponsorship tiers. Safe to re-run.
-- Creates `public.sponsorships` when this project never ran full schema.sql.

create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  sponsor_user_id uuid,
  business_name text not null,
  logo_url text not null default '',
  school_team text not null default '',
  tier text not null default 'silver' check (tier in ('silver', 'gold', 'platinum')),
  amount_cents integer not null,
  aura_points integer not null default 0,
  billing_interval text not null default 'month',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.sponsorships add column if not exists sponsor_user_id uuid;
alter table public.sponsorships add column if not exists logo_url text not null default '';
alter table public.sponsorships add column if not exists school_team text not null default '';
alter table public.sponsorships add column if not exists tier text not null default 'silver';
alter table public.sponsorships add column if not exists amount_cents integer not null default 0;
alter table public.sponsorships add column if not exists aura_points integer not null default 0;
alter table public.sponsorships add column if not exists billing_interval text not null default 'month';
alter table public.sponsorships add column if not exists status text not null default 'active';
alter table public.sponsorships add column if not exists created_at timestamptz not null default now();

alter table public.sponsorships enable row level security;

drop policy if exists "Public read sponsorships" on public.sponsorships;
create policy "Public read sponsorships" on public.sponsorships for select using (true);

drop policy if exists "Insert sponsorships" on public.sponsorships;
create policy "Insert sponsorships" on public.sponsorships for insert with check (true);

grant select, insert on public.sponsorships to anon, authenticated;
