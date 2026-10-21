-- Smoothness telemetry: allow screen-mount and cold-start timing into telemetry_logs.
--
-- Purpose: behavior-logging Step 2 (STATE 2026-10-20). The app continuously measures cold start
-- (`app_start`, JS bundle eval to first render) and key screen mounts (`screen_mount`, Home /
-- Sport Pop Quiz / donate sheet) so Health can show regressions before fans complain. No question,
-- answer, athlete, group or account content rides these rows (channel/surface + duration only).
--
-- Why a migration: telemetry_logs.event_type is CHECK-whitelisted, so the two new values must be
-- added here. Duration/text/payload bounds already cover them (mount/start are seconds at most,
-- well under the 10-minute else-branch; surfaces are short literals).
--
-- Apply order: run this file, THEN flip layouts.telemetrySmoothness on in Expo /admin App setup
-- → Features and publish. The client emits these rows only while that flag (default off) is on,
-- so a pre-apply client never poisons a batch: one CHECK-rejected row fails its whole 15-row
-- INSERT, which would also drop valid telemetry already queued with it.
--
-- Rollback: delete the new-type rows first (re-adding the old CHECK validates existing rows),
-- then restore the previous list:
--   delete from public.telemetry_logs where event_type in ('screen_mount', 'app_start');
--   alter table public.telemetry_logs drop constraint if exists telemetry_logs_event_type_check;
--   alter table public.telemetry_logs add constraint telemetry_logs_event_type_check
--     check (event_type in (
--       'video_stall', 'video_first_frame', 'socket_reconnect', 'checkout_latency',
--       'tab_dwell', 'surface_scroll', 'feature_tap', 'ui_issue',
--       'flash_unlock', 'stripe_webhook_payment_succeeded'
--     ));

alter table public.telemetry_logs drop constraint if exists telemetry_logs_event_type_check;
alter table public.telemetry_logs add constraint telemetry_logs_event_type_check
  check (event_type in (
    'video_stall', 'video_first_frame', 'socket_reconnect', 'checkout_latency',
    'tab_dwell', 'surface_scroll', 'feature_tap', 'ui_issue',
    'flash_unlock', 'stripe_webhook_payment_succeeded',
    'screen_mount', 'app_start'
  ));
