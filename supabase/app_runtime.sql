-- App chrome flags (draft vs published) + admin reports. Safe to re-run.
-- Source of truth for Features / Look / Soft-Wall / PROFILE_CHROME_FLAGS.
-- Do not create public.app_feature_flags here (see supabase/app_feature_flags.sql).

create table if not exists public.app_runtime_config (
  id text primary key default 'default',
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_runtime_config (id, draft, published, published_at)
values (
  'default',
  '{
    "tabs": {"home": true, "local": true, "spotlight": true, "drip": true, "profile": true, "upload": true},
    "buttons": {"seki": true, "aura": true, "flex": true, "malo": true, "more": true, "subscribe": true, "crew": true, "vault": true, "flashUnlock": true, "suggest": true},
    "layouts": {"liveMatches": true, "cheerPolls": true, "topBoosters": true, "sponsorshipModal": true, "spotlightModal": true, "homeSearch": true, "localSearch": true, "operatorConsole": false, "parentHq": true, "boosterHq": true, "sponsorHq": true, "slangGuide": true, "receipts": true, "wishlist": true},
    "profile": {"showCard": true, "showCrew": true, "showStats": true, "showVault": true, "actionsOnTop": false, "statsFirst": false}
  }'::jsonb,
  '{
    "tabs": {"home": true, "local": true, "spotlight": true, "drip": true, "profile": true, "upload": true},
    "buttons": {"seki": true, "aura": true, "flex": true, "malo": true, "more": true, "subscribe": true, "crew": true, "vault": true, "flashUnlock": true, "suggest": true},
    "layouts": {"liveMatches": true, "cheerPolls": true, "topBoosters": true, "sponsorshipModal": true, "spotlightModal": true, "homeSearch": true, "localSearch": true, "operatorConsole": false, "parentHq": true, "boosterHq": true, "sponsorHq": true, "slangGuide": true, "receipts": true, "wishlist": true},
    "profile": {"showCard": true, "showCrew": true, "showStats": true, "showVault": true, "actionsOnTop": false, "statsFirst": false}
  }'::jsonb,
  timezone('utc', now())
)
on conflict (id) do nothing;

alter table public.app_runtime_config enable row level security;

drop policy if exists "Public read app runtime" on public.app_runtime_config;
create policy "Public read app runtime"
  on public.app_runtime_config for select
  using (true);

drop policy if exists "Admin write app runtime" on public.app_runtime_config;
create policy "Admin write app runtime"
  on public.app_runtime_config for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop function if exists public.patch_app_runtime_draft(jsonb);

create or replace function public.patch_app_runtime_draft(next_draft jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.app_runtime_config;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  if next_draft is null then
    raise exception 'next_draft is required';
  end if;
  insert into public.app_runtime_config (id, draft, published, updated_at)
  values ('default', next_draft, next_draft, now())
  on conflict (id) do update
    set draft = excluded.draft,
        updated_at = now();
  select * into result from public.app_runtime_config where id = 'default';
  return jsonb_build_object(
    'draft', result.draft,
    'published', result.published,
    'published_at', result.published_at,
    'updated_at', result.updated_at
  );
end;
$$;

drop function if exists public.publish_app_runtime();

create or replace function public.publish_app_runtime()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.app_runtime_config;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  update public.app_runtime_config
  set published = draft,
      published_at = timezone('utc', now()),
      updated_at = now()
  where id = 'default'
  returning * into result;
  if result.id is null then
    raise exception 'app_runtime_config is missing';
  end if;
  return jsonb_build_object(
    'draft', result.draft,
    'published', result.published,
    'published_at', result.published_at,
    'updated_at', result.updated_at
  );
end;
$$;

drop function if exists public.get_admin_reports();

create or replace function public.get_admin_reports()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
      'avg_tip_cents_7d', (
        select coalesce(avg(amount_cents), 0)::int
        from public.tips
        where created_at >= timezone('utc', now()) - interval '7 days'
      ),
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
      'verified', (select count(*)::int from public.profiles where coalesce(is_verified_athlete, false) = true or role = 'athlete'),
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
      'avg_checkout_ms_24h', (
        select coalesce(avg(metric_value), 0)::int
        from public.telemetry_logs
        where event_type = 'checkout_latency'
          and created_at >= timezone('utc', now()) - interval '24 hours'
      ),
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
      )
    )
  );
$$;

grant select on public.app_runtime_config to anon, authenticated;
grant insert, update on public.app_runtime_config to anon, authenticated;
grant execute on function public.patch_app_runtime_draft(jsonb) to anon, authenticated;
grant execute on function public.publish_app_runtime() to anon, authenticated;
grant execute on function public.get_admin_reports() to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.app_runtime_config;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
