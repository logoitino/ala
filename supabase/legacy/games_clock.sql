-- Game clock + created_at for the Field Operator console. Safe to re-run.
alter table public.games add column if not exists clock text not null default '12:00';
alter table public.games add column if not exists created_at timestamptz not null default now();
alter table public.games add column if not exists is_clock_running boolean not null default false;
