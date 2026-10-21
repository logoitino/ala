-- get_admin_reports: trivia funnel top (preparation views + Start presses).
--
-- Purpose
--   Two counts at the top of the existing `trivia` key: `prep_views_7d` (preparation screens
--   shown) and `start_presses_7d` (Start taps, including attempts that never confirm). Together
--   with `starts_7d` they split the top of the funnel three ways: viewed-but-never-pressed is
--   friction (disclosure wall, confusion), pressed-but-never-confirmed is technical (network,
--   server), confirmed is flow-through. Counts only. Preparation-driven personal/group starts
--   pass through all three; Highlight auto-Play, Learn-card and Life starts enter mid-funnel.
--   Nothing else changes: same signature, returns jsonb, language sql, stable, security definer,
--   set search_path = public, require_admin_guard() first. This body INCLUDES the 20261012180000
--   bigint casts and donation_bands and the 20261020180000 trivia/smoothness keys.
--
-- Ordering: apply AFTER 20261020180000 (or instead of it — this file supersedes its body). Do NOT
--   apply 20261012180000 or 20261020180000 after this file: their older bodies would drop keys.
--
-- Dependencies: none new. No table, column, policy or Storage change.
--
-- Grants: create or replace keeps the existing ACL; revoke public/anon + grant authenticated
--   are repeated (idempotent) to match the documented grant.
--
-- Rollback: re-apply supabase/migrations/20261020180000_reports_trivia_smoothness.sql
--   (restores its body; the two funnel-top counts disappear, everything else unchanged).
--
-- Safe to re-run: create or replace with an unchanged return type; revoke and grant are idempotent.
begin;

-- Pre-flight: the report's first statement calls the admin guard.
do $$
begin
  if to_regprocedure('public.require_admin_guard()') is null then
    raise exception 'public.require_admin_guard() is missing. Apply the 2026-09 audit section of apps/mobile/src/backend/db/schema.sql (require_admin_guard) first.';
  end if;
end $$;

create or replace function public.get_admin_reports()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.require_admin_guard();
  select jsonb_build_object(
    'generated_at', timezone('utc', now()),
    'engagement', jsonb_build_object(
      'clips_live', (select count(*)::int from public.reels where coalesce(is_removed, false) = false),
      'clips_24h', (select count(*)::int from public.reels where created_at >= timezone('utc', now()) - interval '24 hours'),
      'clips_7d', (select count(*)::int from public.reels where created_at >= timezone('utc', now()) - interval '7 days'),
      'clips_prev_7d', (select count(*)::int from public.reels where created_at >= timezone('utc', now()) - interval '14 days' and created_at < timezone('utc', now()) - interval '7 days'),
      'seki', (select coalesce(sum(coalesce(seki_count, 0)), 0)::int from public.reels where coalesce(is_removed, false) = false),
      'aura', (select coalesce(sum(coalesce(aura_count, 0)), 0)::int from public.reels where coalesce(is_removed, false) = false),
      'flex', (select coalesce(sum(coalesce(flex_count, 0)), 0)::int from public.reels where coalesce(is_removed, false) = false),
      'hype_votes', (select count(*)::int from public.reel_hype_votes),
      'saves', (select count(*)::int from public.saved_reels),
      'crew_follows', (select count(*)::int from public.crew_follows)
    ),
    'money', jsonb_build_object(
      'malo_cents_all', (select coalesce(sum(amount_cents), 0)::bigint from public.tips),
      'malo_count_all', (select count(*)::int from public.tips),
      'malo_cents_24h', (select coalesce(sum(amount_cents), 0)::bigint from public.tips where created_at >= timezone('utc', now()) - interval '24 hours'),
      'malo_count_24h', (select count(*)::int from public.tips where created_at >= timezone('utc', now()) - interval '24 hours'),
      'malo_cents_7d', (select coalesce(sum(amount_cents), 0)::bigint from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'malo_count_7d', (select count(*)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'malo_cents_prev_7d', (select coalesce(sum(amount_cents), 0)::bigint from public.tips where created_at >= timezone('utc', now()) - interval '14 days' and created_at < timezone('utc', now()) - interval '7 days'),
      'avg_tip_cents_7d', (select coalesce(avg(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'queued_payouts', (select count(*)::int from public.disbursements where status = 'queued'),
      'paid_payouts_cents', (select coalesce(sum(amount_cents), 0)::bigint from public.disbursements where status = 'paid'),
      'active_subs', (select count(*)::int from public.subscriptions where coalesce(status, 'active') = 'active')
    ),
    'content', jsonb_build_object(
      'flagged', (select count(*)::int from public.reels where coalesce(is_flagged, false) = true and coalesce(is_removed, false) = false),
      'removed', (select count(*)::int from public.reels where coalesce(is_removed, false) = true),
      'vault', (select count(*)::int from public.reels where coalesce(is_vault_only, false) = true and coalesce(is_removed, false) = false),
      'exclusive_clips', (select count(*)::int from public.reels where coalesce(is_exclusive, false) = true and coalesce(is_removed, false) = false),
      'flash_live', (select count(*)::int from public.reels where flash_unlock_until is not null and flash_unlock_until > timezone('utc', now()) and coalesce(is_removed, false) = false),
      'spotlight_live', (select count(*)::int from public.spotlight_awards where start_date <= (timezone('utc', now()))::date and end_date >= (timezone('utc', now()))::date),
      'qna', (select count(*)::int from public.subscriber_requests),
      'game_play', (select count(*)::int from public.reels where coalesce(category, 'game_play') = 'game_play' and coalesce(is_removed, false) = false),
      'train_like_me', (select count(*)::int from public.reels where category = 'train_like_me' and coalesce(is_removed, false) = false),
      'serve_like_me', (select count(*)::int from public.reels where category = 'serve_like_me' and coalesce(is_removed, false) = false)
    ),
    'audience', jsonb_build_object(
      'profiles', (select count(*)::int from public.profiles),
      'athletes', (select count(*)::int from public.players),
      'verified', (select count(*)::int from public.profiles where coalesce(is_verified, false) = true or coalesce(verification_status, '') = 'verified'),
      'admins', (select count(*)::int from public.profiles where coalesce(is_admin, false) = true),
      'schools', (select count(*)::int from public.schools_and_teams),
      'pending_verify', (select count(*)::int from public.verification_requests where status = 'pending')
    ),
    'live', jsonb_build_object(
      'live_games', (select count(*)::int from public.games where coalesce(is_active, true) = true),
      'parked_games', (select count(*)::int from public.games where coalesce(is_active, true) = false),
      'poll_votes', (select coalesce(sum(coalesce(home_votes, 0) + coalesce(away_votes, 0)), 0)::int from public.cheer_polls),
      'active_polls', (select count(*)::int from public.cheer_polls where coalesce(is_active, true) = true),
      'active_boosters', (select count(*)::int from public.sponsorships where coalesce(status, 'active') = 'active'),
      'drip_skus', (select count(*)::int from public.shop_products where coalesce(is_active, true) = true)
    ),
    'reliability', jsonb_build_object(
      'stalls_24h', (select count(*)::int from public.telemetry_logs where event_type = 'video_stall' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'reconnects_24h', (select count(*)::int from public.telemetry_logs where event_type = 'socket_reconnect' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'checkouts_24h', (select count(*)::int from public.telemetry_logs where event_type = 'checkout_latency' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'avg_checkout_ms_24h', (select coalesce(avg(duration_ms), 0)::int from public.telemetry_logs where event_type = 'checkout_latency' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'events_24h', (select count(*)::int from public.telemetry_logs where created_at >= timezone('utc', now()) - interval '24 hours')
    ),
    'leaders', jsonb_build_object(
      'malo', (
        select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value)), '[]'::jsonb)
        from (
          select coalesce(nullif(p.name, ''), 'Unknown') as label, sum(t.amount_cents)::bigint as value
          from public.tips t
          left join public.players p on p.id = t.player_id
          group by p.id, p.name
          order by value desc
          limit 5
        ) ranked
      ),
      'hype', (
        select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value)), '[]'::jsonb)
        from (
          select coalesce(nullif(r.title, ''), 'Untitled clip') as label,
            (coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0))::int as value
          from public.reels r
          where coalesce(r.is_removed, false) = false
          order by value desc, r.created_at desc
          limit 5
        ) ranked
      ),
      'schools', (
        select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value)), '[]'::jsonb)
        from (
          select coalesce(nullif(p.school_name, ''), 'Unlisted') as label, count(*)::int as value
          from public.players p
          group by 1
          order by value desc
          limit 5
        ) ranked
      )
    ),
    -- Owner decision 3C (2026-10-12): athletes counted by all-time donation total, counts only, never
    -- names or ids. Same source as leaders.malo (every public.tips row, grouped per player, no other
    -- filter); tips.player_id is NOT NULL with an FK, so the inner join drops no rows. A player whose
    -- total is 0 is in no band. Bounds in cents: (0, 5000) / [5000, 25000) / [25000, inf).
    'donation_bands', coalesce(
      (
        select jsonb_build_object(
          'under_50', (count(*) filter (where totals.total_cents > 0 and totals.total_cents < 5000))::int,
          '50_to_250', (count(*) filter (where totals.total_cents >= 5000 and totals.total_cents < 25000))::int,
          '250_plus', (count(*) filter (where totals.total_cents >= 25000))::int
        )
        from (
          select p.id, sum(t.amount_cents)::bigint as total_cents
          from public.tips t
          join public.players p on p.id = t.player_id
          group by p.id
        ) totals
      ),
      '{"under_50": 0, "50_to_250": 0, "250_plus": 0}'::jsonb
    ),
    'series', jsonb_build_object(
      'clips', (
        select coalesce(jsonb_agg(jsonb_build_object('label', to_char(bucket.d, 'Dy'), 'value', bucket.n) order by bucket.d), '[]'::jsonb)
        from (
          select d::date as d, coalesce(c.n, 0)::int as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, count(*)::int as n from public.reels group by 1
          ) c on c.day = d::date
        ) bucket
      ),
      'malo', (
        select coalesce(jsonb_agg(jsonb_build_object('label', to_char(bucket.d, 'Dy'), 'value', bucket.n) order by bucket.d), '[]'::jsonb)
        from (
          select d::date as d, coalesce(c.n, 0)::bigint as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, coalesce(sum(amount_cents), 0)::bigint as n from public.tips group by 1
          ) c on c.day = d::date
        ) bucket
      ),
      'stalls', (
        select coalesce(jsonb_agg(jsonb_build_object('label', to_char(bucket.d, 'Dy'), 'value', bucket.n) order by bucket.d), '[]'::jsonb)
        from (
          select d::date as d, coalesce(c.n, 0)::int as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, count(*)::int as n
            from public.telemetry_logs
            where event_type = 'video_stall'
            group by 1
          ) c on c.day = d::date
        ) bucket
      ),
      'dwell', (
        select coalesce(jsonb_agg(jsonb_build_object('label', to_char(bucket.d, 'Dy'), 'value', bucket.n) order by bucket.d), '[]'::jsonb)
        from (
          select d::date as d, coalesce(c.n, 0)::bigint as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, coalesce(sum(duration_ms), 0)::bigint as n
            from public.telemetry_logs
            where event_type = 'tab_dwell'
            group by 1
          ) c on c.day = d::date
        ) bucket
      )
    ),
    'usage', jsonb_build_object(
      'sessions_24h', (select count(*)::int from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'dwell_ms_24h', (select coalesce(sum(duration_ms), 0)::bigint from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'dwell_ms_7d', (select coalesce(sum(duration_ms), 0)::bigint from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '7 days'),
      'taps_24h', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'taps_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and created_at >= timezone('utc', now()) - interval '7 days'),
      'issues_24h', (select count(*)::int from public.telemetry_logs where event_type = 'ui_issue' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'issues_7d', (select count(*)::int from public.telemetry_logs where event_type = 'ui_issue' and created_at >= timezone('utc', now()) - interval '7 days'),
      'feedback_bugs_open', (select count(*)::int from public.app_feedback where kind = 'bug' and status not in ('shipped', 'declined')),
      'avg_scroll_pct_7d', (select coalesce(avg(duration_ms), 0)::int from public.telemetry_logs where event_type = 'surface_scroll' and created_at >= timezone('utc', now()) - interval '7 days')
    ),
    'tabs', (
      select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value) order by ranked.value desc), '[]'::jsonb)
      from (
        select
          case coalesce(channel, 'other')
            when 'home' then 'Home'
            when 'local' then 'Local'
            when 'spotlight' then 'Spotlight'
            when 'drip' then 'Drip'
            when 'profile' then 'Profile'
            when 'upload' then 'Upload'
            else coalesce(nullif(channel, ''), 'Other')
          end as label,
          coalesce(sum(duration_ms), 0)::bigint as value
        from public.telemetry_logs
        where event_type = 'tab_dwell'
          and created_at >= timezone('utc', now()) - interval '7 days'
        group by 1
        order by value desc
        limit 8
      ) ranked
    ),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value) order by ranked.value desc), '[]'::jsonb)
      from (
        select coalesce(nullif(step, ''), 'unknown') as label, count(*)::int as value
        from public.telemetry_logs
        where event_type = 'feature_tap'
          and created_at >= timezone('utc', now()) - interval '7 days'
          and coalesce(step, '') not like 'tab.%'
        group by 1
        order by value desc
        limit 8
      ) ranked
    ),
    'issues', (
      select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value) order by ranked.value desc), '[]'::jsonb)
      from (
        select combined.label, sum(combined.n)::int as value
        from (
          select
            coalesce(nullif(step, ''), 'control') || ' · ' || coalesce(nullif(channel, ''), 'app') as label,
            count(*)::int as n
          from public.telemetry_logs
          where event_type = 'ui_issue'
            and created_at >= timezone('utc', now()) - interval '7 days'
          group by 1
          union all
          select coalesce(surface, 'other') || ' bug' as label, count(*)::int as n
          from public.app_feedback
          where kind = 'bug'
            and status not in ('shipped', 'declined')
          group by 1
        ) combined
        where combined.label <> ''
        group by combined.label
        order by value desc
        limit 8
      ) ranked
    ),
    'scroll', (
      select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value) order by ranked.value desc), '[]'::jsonb)
      from (
        select
          case coalesce(channel, 'other')
            when 'home' then 'Home'
            when 'local' then 'Local'
            when 'spotlight' then 'Spotlight'
            when 'drip' then 'Drip'
            when 'profile' then 'Profile'
            else coalesce(nullif(channel, ''), 'Other')
          end as label,
          coalesce(avg(duration_ms), 0)::int as value
        from public.telemetry_logs
        where event_type = 'surface_scroll'
          and created_at >= timezone('utc', now()) - interval '7 days'
        group by 1
        order by value desc
        limit 8
      ) ranked
    ),
    -- 2026-10-20 (supabase/migrations/20261020180000_reports_trivia_smoothness.sql, written, not
    -- applied anywhere): trivia funnel + smoothness slices for the Health page. Counts only, never
    -- names, ids, question text or account data. A database without the 20261020173000 whitelist
    -- has no screen_mount/app_start rows, so the smoothness keys read zero there.
    -- 2026-10-20 (supabase/migrations/20261020174500_reports_trivia_funnel_top.sql, written, not
    -- applied anywhere): trivia gains prep_views_7d + start_presses_7d at the top of the funnel.
    'trivia', jsonb_build_object(
      'prep_views_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and step = 'trivia.view_prep' and created_at >= timezone('utc', now()) - interval '7 days'),
      'start_presses_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and step = 'trivia.press_start' and created_at >= timezone('utc', now()) - interval '7 days'),
      'starts_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and step = 'trivia.start' and created_at >= timezone('utc', now()) - interval '7 days'),
      'answers_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and step = 'trivia.answer' and created_at >= timezone('utc', now()) - interval '7 days'),
      'nexts_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and step = 'trivia.next' and created_at >= timezone('utc', now()) - interval '7 days'),
      'completes_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and step = 'trivia.complete' and created_at >= timezone('utc', now()) - interval '7 days'),
      'abandons_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and step = 'trivia.abandon' and created_at >= timezone('utc', now()) - interval '7 days'),
      'unavailable_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and step = 'trivia.unavailable' and created_at >= timezone('utc', now()) - interval '7 days'),
      'start_failed_7d', (select count(*)::int from public.telemetry_logs where event_type = 'ui_issue' and step = 'trivia.start_failed' and created_at >= timezone('utc', now()) - interval '7 days'),
      'answer_failed_7d', (select count(*)::int from public.telemetry_logs where event_type = 'ui_issue' and step = 'trivia.answer_failed' and created_at >= timezone('utc', now()) - interval '7 days'),
      'next_failed_7d', (select count(*)::int from public.telemetry_logs where event_type = 'ui_issue' and step = 'trivia.next_failed' and created_at >= timezone('utc', now()) - interval '7 days'),
      'explanation_failed_7d', (select count(*)::int from public.telemetry_logs where event_type = 'ui_issue' and step = 'trivia.explanation_failed' and created_at >= timezone('utc', now()) - interval '7 days'),
      'by_position_7d', (
        select coalesce(jsonb_agg(jsonb_build_object('label', 'Question ' || bucket.position, 'value', bucket.n) order by bucket.position), '[]'::jsonb)
        from (
          select (payload->>'position')::int as position, count(*)::int as n
          from public.telemetry_logs
          where event_type = 'feature_tap' and step = 'trivia.answer'
            and created_at >= timezone('utc', now()) - interval '7 days'
            and (payload->>'position') ~ '^[0-9]{1,9}$'
          group by 1
        ) bucket
      ),
      'starts_by_kind_7d', (
        select coalesce(jsonb_agg(jsonb_build_object('label', bucket.kind, 'value', bucket.n) order by bucket.n desc), '[]'::jsonb)
        from (
          select coalesce(nullif(payload->>'kind', ''), 'unknown') as kind, count(*)::int as n
          from public.telemetry_logs
          where event_type = 'feature_tap' and step = 'trivia.start'
            and created_at >= timezone('utc', now()) - interval '7 days'
          group by 1
        ) bucket
      )
    ),
    'smoothness', jsonb_build_object(
      'mounts_7d', (select count(*)::int from public.telemetry_logs where event_type = 'screen_mount' and created_at >= timezone('utc', now()) - interval '7 days'),
      'avg_mount_ms_7d', (select coalesce(avg(duration_ms), 0)::int from public.telemetry_logs where event_type = 'screen_mount' and created_at >= timezone('utc', now()) - interval '7 days'),
      'by_surface_7d', (
        select coalesce(jsonb_agg(jsonb_build_object('label', bucket.surface, 'value', bucket.ms) order by bucket.ms desc), '[]'::jsonb)
        from (
          select coalesce(nullif(channel, ''), 'other') as surface, coalesce(avg(duration_ms), 0)::int as ms
          from public.telemetry_logs
          where event_type = 'screen_mount'
            and created_at >= timezone('utc', now()) - interval '7 days'
          group by 1
        ) bucket
      ),
      'app_starts_7d', (select count(*)::int from public.telemetry_logs where event_type = 'app_start' and created_at >= timezone('utc', now()) - interval '7 days'),
      'avg_start_ms_7d', (select coalesce(avg(duration_ms), 0)::int from public.telemetry_logs where event_type = 'app_start' and created_at >= timezone('utc', now()) - interval '7 days')
    )
  );
$$;

revoke execute on function public.get_admin_reports() from public, anon;
grant execute on function public.get_admin_reports() to authenticated;

commit;
