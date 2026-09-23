-- 2026-09 audit item 7: was anon-executable with no role check at all — anyone could read
-- platform-wide money/audience/content aggregates. `select public.require_admin_guard();` as the
-- first statement raises before the report query runs if the caller is not an admin; the report
-- query itself is the function's returned (final-statement) result, unchanged otherwise.
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
      'malo_cents_all', (select coalesce(sum(amount_cents), 0)::int from public.tips),
      'malo_count_all', (select count(*)::int from public.tips),
      'malo_cents_24h', (select coalesce(sum(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '24 hours'),
      'malo_count_24h', (select count(*)::int from public.tips where created_at >= timezone('utc', now()) - interval '24 hours'),
      'malo_cents_7d', (select coalesce(sum(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'malo_count_7d', (select count(*)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'malo_cents_prev_7d', (select coalesce(sum(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '14 days' and created_at < timezone('utc', now()) - interval '7 days'),
      'avg_tip_cents_7d', (select coalesce(avg(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'queued_payouts', (select count(*)::int from public.disbursements where status = 'queued'),
      'paid_payouts_cents', (select coalesce(sum(amount_cents), 0)::int from public.disbursements where status = 'paid'),
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
          select coalesce(nullif(p.name, ''), 'Unknown') as label, sum(t.amount_cents)::int as value
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
          select d::date as d, coalesce(c.n, 0)::int as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, coalesce(sum(amount_cents), 0)::int as n from public.tips group by 1
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
          select d::date as d, coalesce(c.n, 0)::int as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, coalesce(sum(duration_ms), 0)::int as n
            from public.telemetry_logs
            where event_type = 'tab_dwell'
            group by 1
          ) c on c.day = d::date
        ) bucket
      )
    ),
    'usage', jsonb_build_object(
      'sessions_24h', (select count(*)::int from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'dwell_ms_24h', (select coalesce(sum(duration_ms), 0)::int from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'dwell_ms_7d', (select coalesce(sum(duration_ms), 0)::int from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '7 days'),
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
          coalesce(sum(duration_ms), 0)::int as value
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
    )
  );
$$;
-- 2026-09 audit items 7/9/10: app_runtime_config SELECT stays public — it drives the fan app's
-- feature-flag/chrome bootstrap, read by guests before any sign-in. Writes are now
-- authenticated-only (admin enforced by the RLS policy above and, for the two RPCs, redundantly
-- inside the function bodies since SECURITY DEFINER bypasses RLS).
grant select on public.app_runtime_config to anon, authenticated;
grant insert, update on public.app_runtime_config to authenticated;
grant execute on function public.patch_app_runtime_draft(jsonb) to authenticated;
grant execute on function public.publish_app_runtime() to authenticated;
grant execute on function public.get_admin_reports() to authenticated;
grant execute on function public.require_admin_guard() to authenticated;
do $$
begin
  alter publication supabase_realtime add table public.app_runtime_config;
exception
  when duplicate_object then null;
  when duplicate_table then null;
  when undefined_object then null;
end $$;
-- Company revenue control plane for /admin/money. Incremental: supabase/company_revenue.sql.
-- Company revenue control plane for /admin/money.
-- Safe to re-run. Keep BPS in lockstep with src/frontend/data/finance.ts.
-- Existing remote stub used numeric dollars; we keep those columns and add cents.

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  buyer_id uuid,
  amount_cents integer not null,
  qty integer not null default 1,
  created_at timestamptz not null default now()
);
-- 2026-09 fix: same gap as sponsorships above — this table had no column safety net, so
-- `create table if not exists` no-ops against a pre-existing narrower table and the constraints
-- below then fail with `column "amount_cents" does not exist` (or `"qty"`).
alter table public.shop_orders add column if not exists product_id text;
alter table public.shop_orders add column if not exists buyer_id uuid;
alter table public.shop_orders add column if not exists amount_cents integer not null default 0;
alter table public.shop_orders add column if not exists qty integer not null default 1;
alter table public.shop_orders add column if not exists created_at timestamptz not null default now();
do $$
begin
  alter table public.shop_orders add constraint shop_orders_amount_cents_check check (amount_cents >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.shop_orders add constraint shop_orders_qty_check check (qty > 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
create table if not exists public.company_revenue_logs (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null,
  gross_amount numeric not null default 0,
  platform_cut_amount numeric not null default 0,
  payout_amount numeric not null default 0,
  recipient_id uuid,
  created_at timestamptz not null default now()
);
alter table public.company_revenue_logs add column if not exists source text;
alter table public.company_revenue_logs add column if not exists source_id text;
alter table public.company_revenue_logs add column if not exists label text not null default '';
alter table public.company_revenue_logs add column if not exists payee_kind text not null default 'none';
alter table public.company_revenue_logs add column if not exists player_id uuid;
alter table public.company_revenue_logs add column if not exists gross_cents integer not null default 0;
alter table public.company_revenue_logs add column if not exists platform_cents integer not null default 0;
alter table public.company_revenue_logs add column if not exists payout_cents integer not null default 0;
update public.company_revenue_logs
set source = coalesce(nullif(source, ''), nullif(transaction_type, ''), 'malo')
where source is null or source = '';
alter table public.company_revenue_logs alter column source set default 'malo';
do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_source_check
    check (source in ('malo', 'booster', 'vault', 'merch'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_payee_kind_check
    check (payee_kind in ('athlete', 'operator', 'none'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_source_id_key unique (source, source_id);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;