-- Client playback / socket / checkout telemetry.
-- Insert is closed to anon. The full guard (event-type allowlist, field limits, server-stamped
-- created_at) is supabase/migrations/20260929190000_telemetry_insert_guard.sql. This policy
-- matches that file so a re-run cannot put `with check (true)` back.

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
create policy "Insert telemetry logs"
  on public.telemetry_logs
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and event_type in (
      'video_stall',
      'video_first_frame',
      'socket_reconnect',
      'checkout_latency',
      'tab_dwell',
      'surface_scroll',
      'feature_tap',
      'ui_issue',
      'flash_unlock'
    )
    and (video_id is null or char_length(video_id) <= 120)
    and (channel is null or char_length(channel) <= 120)
    and (step is null or char_length(step) <= 120)
    and (duration_ms is null or duration_ms between 0 and 86400000)
    and (attempts is null or attempts between 0 and 100)
    and octet_length(coalesce(payload, '{}'::jsonb)::text) <= 4000
  );

drop policy if exists "Authenticated read telemetry logs" on public.telemetry_logs;
create policy "Authenticated read telemetry logs" on public.telemetry_logs for select using (auth.role() = 'authenticated');

revoke insert on public.telemetry_logs from anon;
grant insert on public.telemetry_logs to authenticated;
grant select on public.telemetry_logs to authenticated;
