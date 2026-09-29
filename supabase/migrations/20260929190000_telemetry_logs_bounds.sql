-- Bound what a telemetry row can say (docs/STATE.md §5 "telemetry anon-insert hole").
--
-- `telemetry_logs` INSERT is `with check (true)` for `anon` — deliberately, since Tapua'i is
-- browse-first and guest telemetry (tab dwell, scroll depth, feature taps) is a real, wanted flow,
-- not just a hole. Requiring `authenticated` here would silently drop all guest telemetry rather
-- than fix anything, so this migration does not touch the INSERT policy or add auth requirement.
--
-- What it does close, with no owner decision needed: a row can no longer report an `event_type`
-- outside `TelemetryManager.ts`'s own union, or a `duration_ms` / `attempts` value large enough to
-- single-handedly wreck a Reports / Coverage average (e.g. a fabricated 11-day "video stall").
-- Same shape as the existing per-row caps on `tips` / `sponsorships` / `shop_orders` amounts —
-- bounds the blast radius of a client-fabricated row without a redesign.
--
-- What this does NOT close, on purpose: an anon-key holder can still insert many rows with small,
-- valid-looking values — a volume-based fabrication vector, not a shape-based one. Closing that
-- needs the owner's STATE.md §6 item 1 decision (session id / user id on every row, then admin-only
-- SELECT) plus Terms copy disclosing per-account behavioural logging first. Do not default that
-- here.
--
-- Depends on: none.
--
-- Rollback:
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_event_type_check;
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_duration_ms_check;
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_attempts_check;

do $$
begin
  alter table public.telemetry_logs add constraint telemetry_logs_event_type_check
    check (event_type in (
      'video_stall', 'video_first_frame', 'socket_reconnect', 'checkout_latency',
      'tab_dwell', 'surface_scroll', 'feature_tap', 'ui_issue'
    ));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.telemetry_logs add constraint telemetry_logs_duration_ms_check
    check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 600000));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.telemetry_logs add constraint telemetry_logs_attempts_check
    check (attempts is null or (attempts >= 0 and attempts <= 1000));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
