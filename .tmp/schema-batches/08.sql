insert into public.athlete_game_logs (player_id, played_on, opponent_school, stat_line, scoring_value, volume_value)
select p.id, d.played_on, d.opponent_school, d.stat_line, d.scoring_value, d.volume_value
from public.players p
cross join (
  values
    ('2026-09-04'::date, 'Lone Peak Knights', '2 TD · 186 yds', 12, 186),
    ('2026-08-28'::date, 'Skyridge Sentinels', '1 TD · 142 yds', 6, 142),
    ('2026-08-21'::date, 'Timpview Thunderbirds', '3 TD · 221 yds', 18, 221)
) as d(played_on, opponent_school, stat_line, scoring_value, volume_value)
where not exists (
  select 1 from public.athlete_game_logs g where g.player_id = p.id
);
insert into public.spotlight_awards (
  athlete_id, award_type, level, district_region, headline, highlight_reel_id, start_date, end_date
)
select
  null,
  'week',
  'school',
  'Westlake High',
  '4 Touchdowns & 12 Tackles',
  (
    select r.id
    from public.reels r
    where coalesce(r.is_vault_only, false) = false
    order by r.created_at desc
    limit 1
  ),
  date_trunc('week', timezone('utc', now()))::date,
  (date_trunc('week', timezone('utc', now())) + interval '6 days')::date
where not exists (
  select 1
  from public.spotlight_awards a
  where a.start_date = date_trunc('week', timezone('utc', now()))::date
    and lower(a.award_type) in ('week', 'player_of_the_week')
);
-- Admin portal control plane: Drip catalog, school/poll writes. Safe to re-run.

create table if not exists public.shop_products (
  id text primary key,
  name text not null,
  category text not null check (category in ('apparel', 'aura_cards', 'merch')),
  price_cents integer not null default 0,
  blurb text not null default '',
  has_sizes boolean not null default false,
  inventory integer not null default 0,
  icon text not null default 'shirt',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.shop_products add column if not exists name text not null default '';
alter table public.shop_products add column if not exists category text not null default 'merch';
alter table public.shop_products add column if not exists price_cents integer not null default 0;
alter table public.shop_products add column if not exists blurb text not null default '';
alter table public.shop_products add column if not exists has_sizes boolean not null default false;
alter table public.shop_products add column if not exists inventory integer not null default 0;
alter table public.shop_products add column if not exists icon text not null default 'shirt';
alter table public.shop_products add column if not exists is_active boolean not null default true;
alter table public.shop_products add column if not exists sort_order integer not null default 0;
alter table public.shop_products add column if not exists created_at timestamptz not null default now();
insert into public.shop_products (id, name, category, price_cents, blurb, has_sizes, inventory, icon, sort_order)
values
  ('app-hoodie', 'Hawks Booster Hoodie', 'apparel', 5400, 'Heavyweight fleece with booster crest for Friday nights.', true, 8, 'shirt', 10),
  ('app-tee', 'Rivalry Night Tee', 'apparel', 3200, 'Westlake vs Lone Peak throwback print.', true, 24, 'shirt', 20),
  ('app-shorts', 'Sideline Practice Shorts', 'apparel', 3600, 'Mesh shorts with Neon Jade taping.', true, 14, 'shirt', 30),
  ('card-jade', 'Neon Jade Holo Card', 'aura_cards', 1400, 'Holographic Aura print with your handle on the foil edge.', false, 40, 'sparkles', 40),
  ('card-ember', 'Crimson Ember Foil Card', 'aura_cards', 2200, 'Tier 5 border replica on heavy stock.', false, 30, 'sparkles', 50),
  ('card-prism', 'Celestial Prism Set', 'aura_cards', 4000, 'Three-card pack: Jade, Cyan, and Prism foils.', false, 12, 'sparkles', 60),
  ('merch-bottle', 'Sideline Hydration Bottle', 'merch', 1800, 'Team-marked bottle for the stands.', false, 18, 'basketball', 70),
  ('merch-wrist', 'Wrist Coach Playband', 'merch', 2400, 'Call the next play from the bleachers.', false, 20, 'basketball', 80),
  ('merch-jersey', 'Replica Friday Jersey', 'merch', 6500, 'Stitched nameplate, booster-ready fit.', true, 6, 'basketball', 90)
on conflict (id) do nothing;
alter table public.shop_products enable row level security;
drop policy if exists "Public read shop products" on public.shop_products;
create policy "Public read shop products"
  on public.shop_products for select
  using (true);
drop policy if exists "Admin write shop products" on public.shop_products;
create policy "Admin write shop products"
  on public.shop_products for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');
drop policy if exists "Admin write schools and teams" on public.schools_and_teams;
create policy "Admin write schools and teams"
  on public.schools_and_teams for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');
-- School Poll labels are an admin desk action (`/admin/polls`). The anon bypass let a
-- logged-out client write the same rows the RPC was supposed to gate.
drop policy if exists "Admin write cheer polls" on public.cheer_polls;
create policy "Admin write cheer polls"
  on public.cheer_polls for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
-- 2026-09 audit item 12: dropped the `auth.role() = 'anon'` bypass. Creating a new game row is an
-- admin-desk action (`adminCatalog.ts`), not part of the anon operator-PIN scoring flow — the grant
-- for INSERT on `games` is authenticated-only now too (see grants below), so this matches.
drop policy if exists "Admin insert games" on public.games;
create policy "Admin insert games"
  on public.games for insert
  with check (public.current_user_role() in ('admin', 'operator'));
drop policy if exists "Admin write sponsorships" on public.sponsorships;
create policy "Admin write sponsorships"
  on public.sponsorships for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');
drop function if exists public.upsert_cheer_poll(text, text, text, boolean);
create or replace function public.upsert_cheer_poll(
  poll_slug text,
  home_name text,
  away_name text,
  make_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.cheer_polls%rowtype;
begin
  -- Admin only. The previous check (`role <> 'admin' AND auth.role() <> 'anon'`) rejected
  -- signed-in non-admins and let anon through.
  if public.current_user_role() <> 'admin' then
    raise exception 'Access restricted';
  end if;
  insert into public.cheer_polls (slug, home_label, away_label, is_active)
  values (
    btrim(poll_slug),
    coalesce(nullif(btrim(home_name), ''), 'Home'),
    coalesce(nullif(btrim(away_name), ''), 'Away'),
    coalesce(make_active, true)
  )
  on conflict (slug) do update
    set home_label = excluded.home_label,
        away_label = excluded.away_label,
        is_active = excluded.is_active,
        updated_at = now()
  returning * into result;

  return jsonb_build_object(
    'slug', result.slug,
    'home_label', result.home_label,
    'away_label', result.away_label,
    'home_votes', result.home_votes,
    'away_votes', result.away_votes,
    'is_active', result.is_active
  );
end;
$$;
grant select on public.shop_products to anon, authenticated;
grant insert, update, delete on public.shop_products to anon, authenticated;
grant insert, update, delete on public.schools_and_teams to anon, authenticated;
revoke insert, update, delete on public.cheer_polls from anon;
grant insert, update, delete on public.cheer_polls to authenticated;
grant insert, update on public.games to anon, authenticated;
grant update, delete on public.sponsorships to anon, authenticated;
revoke execute on function public.upsert_cheer_poll(text, text, text, boolean) from anon;
grant execute on function public.upsert_cheer_poll(text, text, text, boolean) to authenticated;
-- App chrome flags (draft vs published) + admin reports. Safe to re-run.

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
  '{"tabs":{"home":true,"local":true,"spotlight":true,"drip":true,"profile":true,"upload":true},"buttons":{"seki":true,"aura":true,"flex":true,"malo":true,"more":true,"subscribe":true,"crew":true,"vault":true,"flashUnlock":true},"layouts":{"liveMatches":true,"cheerPolls":true,"topBoosters":true,"sponsorshipModal":true,"spotlightModal":true,"operatorConsole":false,"parentHq":true,"boosterHq":true,"sponsorHq":true}}'::jsonb,
  '{"tabs":{"home":true,"local":true,"spotlight":true,"drip":true,"profile":true,"upload":true},"buttons":{"seki":true,"aura":true,"flex":true,"malo":true,"more":true,"subscribe":true,"crew":true,"vault":true,"flashUnlock":true},"layouts":{"liveMatches":true,"cheerPolls":true,"topBoosters":true,"sponsorshipModal":true,"spotlightModal":true,"operatorConsole":false,"parentHq":true,"boosterHq":true,"sponsorHq":true}}'::jsonb,
  timezone('utc', now())
)
on conflict (id) do nothing;
alter table public.app_runtime_config enable row level security;
drop policy if exists "Public read app runtime" on public.app_runtime_config;
create policy "Public read app runtime"
  on public.app_runtime_config for select
  using (true);
-- 2026-09 audit item 10: dropped the `auth.role() = 'anon'` bypass. Note this RLS policy alone
-- was never the real gate for `patch_app_runtime_draft` / `publish_app_runtime` below — both are
-- SECURITY DEFINER, which bypasses table RLS regardless of what this policy says. The actual fix
-- for those two is the internal `current_user_role() <> 'admin'` check added to each (item 9). This
-- policy still matters for the direct-table-UPDATE fallback in `lib/runtime.ts` (`saveAppRuntimeDraft`
-- / `publishAppRuntime`), which now requires a real authenticated admin session too.
drop policy if exists "Admin write app runtime" on public.app_runtime_config;
create policy "Admin write app runtime"
  on public.app_runtime_config for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
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
  -- 2026-09 audit item 9: this is SECURITY DEFINER, so the table's RLS policy above never actually
  -- gated it — anyone with `execute` (previously anon+authenticated) could publish a live config
  -- change regardless of the RLS policy's wording. The real gate has to live here.
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
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
  -- 2026-09 audit item 9: same reasoning as patch_app_runtime_draft above — SECURITY DEFINER
  -- bypasses table RLS, so the admin check has to happen inside the function body.
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
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
-- 2026-09 audit item 7: small reusable guard for `language sql` functions, which cannot use
-- `if ... raise exception` directly. Raises when the caller is not an admin, else no-ops.
create or replace function public.require_admin_guard()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;
end;
$$;
drop function if exists public.get_admin_reports();