-- Client playback / socket / checkout telemetry. Safe to re-run.

create table if not exists public.telemetry_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  video_id text,
  channel text,
  step text,
  duration_ms integer,
  attempts integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.telemetry_logs add column if not exists event_type text;
alter table public.telemetry_logs add column if not exists video_id text;
alter table public.telemetry_logs add column if not exists channel text;
alter table public.telemetry_logs add column if not exists step text;
alter table public.telemetry_logs add column if not exists duration_ms integer;
alter table public.telemetry_logs add column if not exists attempts integer;
alter table public.telemetry_logs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.telemetry_logs add column if not exists created_at timestamptz not null default now();

create index if not exists telemetry_logs_created_at_idx on public.telemetry_logs (created_at desc);
create index if not exists telemetry_logs_event_type_idx on public.telemetry_logs (event_type, created_at desc);

alter table public.telemetry_logs enable row level security;

drop policy if exists "Insert telemetry logs" on public.telemetry_logs;
create policy "Insert telemetry logs" on public.telemetry_logs for insert with check (true);

drop policy if exists "Authenticated read telemetry logs" on public.telemetry_logs;
create policy "Authenticated read telemetry logs" on public.telemetry_logs for select using (auth.role() = 'authenticated');

grant insert on public.telemetry_logs to anon, authenticated;
grant select on public.telemetry_logs to authenticated;
