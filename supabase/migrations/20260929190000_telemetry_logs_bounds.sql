-- Bound what a telemetry row can say (docs/STATE.md §5 "telemetry anon-insert hole").
--
-- `telemetry_logs` INSERT is `with check (true)` for `anon` — deliberately, since Tapua'i is
-- browse-first and guest telemetry (tab dwell, scroll depth, feature taps) is a real, wanted flow,
-- not just a hole. Requiring `authenticated` here would silently drop all guest telemetry rather
-- than fix anything, so this migration does not touch the INSERT policy or add auth requirement.
--
-- What it does close, with no owner decision needed: a row can no longer report an `event_type`
-- the app does not write, a `duration_ms` / `attempts` value large enough to single-handedly wreck
-- a Reports / Coverage average (e.g. a fabricated 11-day "video stall"), a huge text field, or a
-- large payload. Same shape as the existing per-row caps on `tips` / `sponsorships` / `shop_orders`.
--
-- Caps that match real rows:
--   surface_scroll stores depth 0–100 in duration_ms
--   tab_dwell can be a long visit, capped at 12 hours
--   stalls, first-frame and checkout steps cap at 10 minutes
--   event types include flash_unlock (athlete reel menu) and stripe_webhook_payment_succeeded
--   (service-role webhook). A CHECK applies to the service role too, unlike RLS.
--
-- Safe to re-run: constraints are dropped and re-added, so an earlier draft of this file
-- (eight event types, one 10-minute cap on every duration) is replaced.
--
-- What this does NOT close, on purpose: an anon-key holder can still insert many rows with small,
-- valid-looking values. Closing that needs the owner's STATE.md §6 item 1 decision (session id /
-- user id on every row, then admin-only SELECT) plus Terms copy first. Do not default that here.
--
-- Depends on: none. Not applied yet.
--
-- Rollback:
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_event_type_check;
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_duration_ms_check;
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_attempts_check;
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_text_check;
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_payload_check;

alter table public.telemetry_logs drop constraint if exists telemetry_logs_event_type_check;
alter table public.telemetry_logs add constraint telemetry_logs_event_type_check
  check (event_type in (
    'video_stall',
    'video_first_frame',
    'socket_reconnect',
    'checkout_latency',
    'tab_dwell',
    'surface_scroll',
    'feature_tap',
    'ui_issue',
    'flash_unlock',
    'stripe_webhook_payment_succeeded'
  ));

alter table public.telemetry_logs drop constraint if exists telemetry_logs_duration_ms_check;
alter table public.telemetry_logs add constraint telemetry_logs_duration_ms_check
  check (
    duration_ms is null
    or (
      duration_ms >= 0
      and case event_type
        when 'surface_scroll' then duration_ms <= 100
        when 'tab_dwell' then duration_ms <= 43200000
        else duration_ms <= 600000
      end
    )
  );

alter table public.telemetry_logs drop constraint if exists telemetry_logs_attempts_check;
alter table public.telemetry_logs add constraint telemetry_logs_attempts_check
  check (attempts is null or (attempts >= 0 and attempts <= 1000));

alter table public.telemetry_logs drop constraint if exists telemetry_logs_text_check;
alter table public.telemetry_logs add constraint telemetry_logs_text_check
  check (
    (video_id is null or char_length(video_id) <= 80)
    and (channel is null or char_length(channel) <= 160)
    and (step is null or char_length(step) <= 80)
  );

alter table public.telemetry_logs drop constraint if exists telemetry_logs_payload_check;
alter table public.telemetry_logs add constraint telemetry_logs_payload_check
  check (octet_length(payload::text) <= 4000);
