-- Close the telemetry anon-insert hole (docs/STATE.md §5).
--
-- `telemetry_logs` allowed INSERT with `with check (true)` and a grant to `anon`. The anon
-- key ships in the app, so anyone could write fake stalls, dwell, taps and checkout times and
-- poison /admin Reports, Coverage and Money. This does not add user or session ids — that is
-- still an owner decision (STATE §6) because Terms do not disclose per-account logging and
-- SELECT is still open to every signed-in user.
--
-- After this file: only a real signed-in session can insert, and only the event types the app
-- actually writes, with short text fields and a small payload. `created_at` is stamped on the
-- server so a client cannot backdate a row into last week's reports. The Stripe webhook uses
-- the service role, which bypasses RLS, so `stripe_webhook_payment_succeeded` is unchanged.
--
-- No dependency on the other 2026-09-29 migrations. Not applied yet.
--
-- Rollback:
--   drop trigger if exists telemetry_logs_stamp_created_at on public.telemetry_logs;
--   drop function if exists public.telemetry_logs_stamp_created_at();
--   drop policy if exists "Insert telemetry logs" on public.telemetry_logs;
--   create policy "Insert telemetry logs" on public.telemetry_logs for insert with check (true);
--   grant insert on public.telemetry_logs to anon, authenticated;

create or replace function public.telemetry_logs_stamp_created_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.telemetry_logs_stamp_created_at() from public, anon, authenticated;

drop trigger if exists telemetry_logs_stamp_created_at on public.telemetry_logs;
create trigger telemetry_logs_stamp_created_at
  before insert on public.telemetry_logs
  for each row
  execute function public.telemetry_logs_stamp_created_at();

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

revoke insert on public.telemetry_logs from anon;
grant insert on public.telemetry_logs to authenticated;
