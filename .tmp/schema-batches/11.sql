-- 2026-09 audit item 8: anon revoked entirely — see the RLS policy comments above (all legitimate
-- writes flow through the SECURITY DEFINER trigger, which doesn't need a table grant to do it).
grant select, insert, update, delete on public.company_revenue_logs to authenticated;
-- 2026-09 audit sweep: read/update/delete are admin-only via RLS above; insert is now
-- authenticated-only too (anon revoked) — see the RLS policy comment above for why the earlier
-- "guest checkout" grant here was based on a stale reading of the Drip purchase flow.
grant select, insert, update, delete on public.shop_orders to authenticated;
grant execute on function public.company_revenue_bps(text) to authenticated;
-- 2026-09 audit (found alongside item 8, not separately numbered in the backlog): this RPC does a
-- raw `insert ... on conflict (source, source_id) do update` into the revenue ledger with
-- caller-supplied amounts and no role check, and is meant to be called ONLY by the
-- `company_revenue_after_source_insert` trigger (internal calls from another SECURITY DEFINER
-- function run as the owner and do not need this grant). No client code calls it. Revoking both
-- anon and authenticated closes a direct-RPC path to fabricate or overwrite revenue rows by
-- reusing a real (source, source_id) pair — the same class of hole as item 8, just one level
-- removed from the table itself.
revoke execute on function public.record_company_revenue(text, text, integer, text, uuid, text, timestamptz) from anon, authenticated;
revoke execute on function public.sync_company_revenue_logs() from anon, authenticated;
grant execute on function public.get_company_revenue_summary() to authenticated;
-- Fan suggestions for the admin control plane. Incremental: supabase/app_feedback.sql.
-- Fan suggestions / bugs for the admin control plane. Safe to re-run.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid,
  body text not null,
  kind text not null default 'suggestion',
  surface text not null default 'other',
  status text not null default 'new',
  runtime_path text not null default '',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_feedback add column if not exists author_id uuid;
alter table public.app_feedback add column if not exists body text not null default '';
alter table public.app_feedback add column if not exists kind text not null default 'suggestion';
alter table public.app_feedback add column if not exists surface text not null default 'other';
alter table public.app_feedback add column if not exists status text not null default 'new';
alter table public.app_feedback add column if not exists runtime_path text not null default '';
alter table public.app_feedback add column if not exists admin_note text not null default '';
alter table public.app_feedback add column if not exists created_at timestamptz not null default now();
alter table public.app_feedback add column if not exists updated_at timestamptz not null default now();
do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_kind_check
    check (kind in ('suggestion', 'bug', 'look', 'other'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_surface_check
    check (surface in ('home', 'local', 'spotlight', 'drip', 'profile', 'other'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_status_check
    check (status in ('new', 'reviewing', 'planned', 'shipping', 'shipped', 'declined'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
create index if not exists app_feedback_status_created_at_idx
  on public.app_feedback (status, created_at desc);
alter table public.app_feedback enable row level security;
drop policy if exists "Anyone insert app feedback" on public.app_feedback;
create policy "Anyone insert app feedback"
  on public.app_feedback for insert
  with check (true);
drop policy if exists "Admin read app feedback" on public.app_feedback;
create policy "Admin read app feedback"
  on public.app_feedback for select
  using (auth.role() = 'anon' or public.current_user_role() = 'admin');
drop policy if exists "Admin write app feedback" on public.app_feedback;
create policy "Admin write app feedback"
  on public.app_feedback for update
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');
create or replace function public.submit_app_feedback(
  p_body text,
  p_kind text default 'suggestion',
  p_surface text default 'other'
)
returns public.app_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  kind_n text := lower(btrim(coalesce(p_kind, 'suggestion')));
  surface_n text := lower(btrim(coalesce(p_surface, 'other')));
  body_n text := btrim(coalesce(p_body, ''));
  result public.app_feedback;
begin
  if length(body_n) < 8 then
    raise exception 'Tell us a bit more — at least a short sentence.';
  end if;
  if kind_n not in ('suggestion', 'bug', 'look', 'other') then
    kind_n := 'suggestion';
  end if;
  if surface_n not in ('home', 'local', 'spotlight', 'drip', 'profile', 'other') then
    surface_n := 'other';
  end if;

  insert into public.app_feedback (author_id, body, kind, surface, status)
  values (auth.uid(), body_n, kind_n, surface_n, 'new')
  returning * into result;

  return result;
end;
$$;
create or replace function public.get_app_feedback()
returns setof public.app_feedback
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.app_feedback
  order by
    case status
      when 'new' then 0
      when 'reviewing' then 1
      when 'planned' then 2
      when 'shipping' then 3
      else 4
    end,
    created_at desc
  limit 80;
$$;
create or replace function public.triage_app_feedback(
  target_id uuid,
  next_status text,
  next_note text default '',
  next_runtime_path text default ''
)
returns public.app_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  status_n text := lower(btrim(coalesce(next_status, '')));
  result public.app_feedback;
begin
  if status_n not in ('new', 'reviewing', 'planned', 'shipping', 'shipped', 'declined') then
    raise exception 'Unknown feedback status %', next_status;
  end if;

  update public.app_feedback
  set
    status = status_n,
    admin_note = coalesce(next_note, admin_note),
    runtime_path = coalesce(next_runtime_path, runtime_path),
    updated_at = timezone('utc', now())
  where id = target_id
  returning * into result;

  if result.id is null then
    raise exception 'Feedback not found.';
  end if;

  return result;
end;
$$;
grant select, insert, update on public.app_feedback to anon, authenticated;
grant execute on function public.submit_app_feedback(text, text, text) to anon, authenticated;
grant execute on function public.get_app_feedback() to anon, authenticated;
grant execute on function public.triage_app_feedback(uuid, text, text, text) to anon, authenticated;
-- Locker Room Wishlist gear funding. Incremental: supabase/locker_room_wishlist.sql.
-- Locker Room Wishlist: crowd-funded gear on the athlete Stats tab. Safe to re-run.

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete cascade,
  title text not null,
  photo_url text not null default '',
  buy_url text not null default '',
  target_amount_cents integer not null default 0,
  current_amount_cents integer not null default 0,
  is_equipped boolean not null default false,
  equipped_at timestamptz,
  aura_awarded boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wishlist_items add column if not exists photo_url text not null default '';
alter table public.wishlist_items add column if not exists buy_url text not null default '';
alter table public.wishlist_items add column if not exists target_amount_cents integer not null default 0;
alter table public.wishlist_items add column if not exists current_amount_cents integer not null default 0;
alter table public.wishlist_items add column if not exists is_equipped boolean not null default false;
alter table public.wishlist_items add column if not exists equipped_at timestamptz;
alter table public.wishlist_items add column if not exists aura_awarded boolean not null default false;
alter table public.wishlist_items add column if not exists is_active boolean not null default true;
alter table public.wishlist_items add column if not exists sort_order integer not null default 0;
alter table public.wishlist_items add column if not exists updated_at timestamptz not null default now();
do $$
begin
  alter table public.wishlist_items
    add constraint wishlist_items_amounts_check
    check (target_amount_cents >= 0 and current_amount_cents >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
create index if not exists wishlist_items_player_idx
  on public.wishlist_items (player_id, is_equipped, sort_order);
alter table public.wishlist_items enable row level security;
drop policy if exists "Public read wishlist items" on public.wishlist_items;
create policy "Public read wishlist items"
  on public.wishlist_items for select
  using (true);
drop policy if exists "Admin write wishlist items" on public.wishlist_items;
create policy "Admin write wishlist items"
  on public.wishlist_items for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');
/**
 * Active wishlist for one athlete. Unfunded gear first so fans see what still needs money.
 */
create or replace function public.get_wishlist_items(target_player_id uuid)
returns setof public.wishlist_items
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.wishlist_items
  where player_id = target_player_id
    and is_active
  order by is_equipped, sort_order, created_at
  limit 20;
$$;
/**
 * Add a Mālo contribution to one wishlist item. Crossing the target equips the item once and
 * awards the athlete a flat +500 Aura through add_user_aura.
 */
create or replace function public.chip_in_wishlist_item(item_id uuid, amount_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  add_cents integer := greatest(coalesce(amount_cents, 0), 0);
  equip_aura constant integer := 500;
  row_after public.wishlist_items;
  newly_equipped boolean := false;
  awarded integer := 0;
  aura_result jsonb;
  target_player uuid;
begin
  -- SECURITY TRADEOFF (2026-09 audit item 5): `wishlist_items` has no per-contribution ledger
  -- (only an aggregate `current_amount_cents`), so there is no "payer" column to check
  -- `auth.uid() =` against here. Execute is now `authenticated`-only (see grants below) and a
  -- per-call cap is enforced as a stopgap until this is verified against a real Stripe charge
  -- the same way supabase/functions/stripe-webhook/index.ts will eventually verify tips.
  if auth.role() <> 'service_role' and add_cents > 100000 then
    raise exception 'amount_cents exceeds the per-call limit (100000)';
  end if;

  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): this is a Mālo contribution too (see the
  -- doc comment above) — block it the same way `tips` INSERT does, before the aggregate even moves,
  -- not only at the equip/+500 Aura step below (add_user_aura's own check would catch that step,
  -- but not a below-target contribution that never reaches it).
  select player_id into target_player from public.wishlist_items where id = item_id;
  if target_player is not null and public.malo_target_frozen(target_player) then
    raise exception 'Mālo is frozen for this athlete; wishlist contributions are disabled.';
  end if;

  update public.wishlist_items
  set
    current_amount_cents = current_amount_cents + add_cents,
    updated_at = timezone('utc', now())
  where id = item_id
  returning * into row_after;

  if row_after.id is null then
    raise exception 'Wishlist item not found.';
  end if;

  if row_after.target_amount_cents > 0
    and row_after.current_amount_cents >= row_after.target_amount_cents
    and not row_after.aura_awarded
  then
    update public.wishlist_items
    set
      is_equipped = true,
      equipped_at = timezone('utc', now()),
      aura_awarded = true,
      updated_at = timezone('utc', now())
    where id = item_id
    returning * into row_after;

    newly_equipped := true;
    awarded := equip_aura;

    if row_after.player_id is not null then
      aura_result := public.add_user_aura(row_after.player_id, equip_aura);
    end if;
  end if;

  return jsonb_build_object(
    'item', to_jsonb(row_after),
    'newly_equipped', newly_equipped,
    'aura_points', awarded,
    'athlete_aura_points', (aura_result ->> 'aura_points')::integer
  );
end;
$$;
grant select on public.wishlist_items to anon, authenticated;
grant insert, update, delete on public.wishlist_items to anon, authenticated;
grant execute on function public.get_wishlist_items(uuid) to anon, authenticated;
-- 2026-09 audit item 1/5: Chip In is behind the Soft Wall (`SOFT_WALL_GATES` id `wishlist`), so
-- authenticated-only does not regress guest browse. See the SECURITY TRADEOFF comment on the
-- function body above for why a per-call cap stands in for a real ownership check.
grant execute on function public.chip_in_wishlist_item(uuid, integer) to authenticated;
-- Sports builder playbooks. Incremental: supabase/sport_configs.sql.
-- Sports builder: per-sport scoring, periods, callouts, and Stats 📊 fields. Safe to re-run.

create table if not exists public.sport_configs (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  emoji text not null default '🏅',
  period_label text not null default 'Period',
  periods jsonb not null default '["P1","P2","OT"]'::jsonb,
  uses_clock boolean not null default true,
  clock_seconds integer not null default 720,
  scoring jsonb not null default '[]'::jsonb,
  callouts jsonb not null default '[]'::jsonb,
  stat_fields jsonb not null default '[]'::jsonb,
  measurables jsonb not null default '[]'::jsonb,
  positions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sport_configs add column if not exists emoji text not null default '🏅';
alter table public.sport_configs add column if not exists period_label text not null default 'Period';
alter table public.sport_configs add column if not exists periods jsonb not null default '["P1","P2","OT"]'::jsonb;
alter table public.sport_configs add column if not exists uses_clock boolean not null default true;
alter table public.sport_configs add column if not exists clock_seconds integer not null default 720;
alter table public.sport_configs add column if not exists scoring jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists callouts jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists stat_fields jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists measurables jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists positions jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists is_active boolean not null default true;
alter table public.sport_configs add column if not exists sort_order integer not null default 0;
alter table public.sport_configs add column if not exists updated_at timestamptz not null default now();
create unique index if not exists sport_configs_sport_key
  on public.sport_configs (lower(btrim(sport)));
-- Which playbook a match uses. Operator console reads it to build score buttons and period chips.
alter table public.games add column if not exists sport text not null default 'Football';
alter table public.sport_configs enable row level security;
drop policy if exists "Public read sport configs" on public.sport_configs;
create policy "Public read sport configs"
  on public.sport_configs for select
  using (true);
drop policy if exists "Admin write sport configs" on public.sport_configs;
create policy "Admin write sport configs"
  on public.sport_configs for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');
/**
 * Every playbook, active first, in builder order. The fan app and operator console both read this.
 */
create or replace function public.get_sport_configs()
returns setof public.sport_configs
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.sport_configs
  order by sort_order, sport
  limit 100;
$$;
/**
 * Create or update one playbook from the admin Sports desk. Matching is by lower(sport) so a
 * rename creates a new row instead of silently orphaning games.
 */
create or replace function public.upsert_sport_config(payload jsonb)
returns public.sport_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  sport_n text := btrim(coalesce(payload ->> 'sport', ''));
  target_id uuid := nullif(payload ->> 'id', '')::uuid;
  result public.sport_configs;
begin
  if sport_n = '' then
    raise exception 'Name the sport before saving.';
  end if;

  if target_id is null then
    select id into target_id
    from public.sport_configs
    where lower(btrim(sport)) = lower(sport_n);
  end if;

  insert into public.sport_configs as sc (
    id, sport, emoji, period_label, periods, uses_clock, clock_seconds,
    scoring, callouts, stat_fields, measurables, positions, is_active, sort_order, updated_at
  )
  values (
    coalesce(target_id, gen_random_uuid()),
    sport_n,
    coalesce(nullif(payload ->> 'emoji', ''), '🏅'),
    coalesce(nullif(payload ->> 'period_label', ''), 'Period'),
    coalesce(payload -> 'periods', '[]'::jsonb),
    coalesce((payload ->> 'uses_clock')::boolean, true),
    greatest(coalesce((payload ->> 'clock_seconds')::integer, 0), 0),
    coalesce(payload -> 'scoring', '[]'::jsonb),
    coalesce(payload -> 'callouts', '[]'::jsonb),
    coalesce(payload -> 'stat_fields', '[]'::jsonb),
    coalesce(payload -> 'measurables', '[]'::jsonb),
    coalesce(payload -> 'positions', '[]'::jsonb),
    coalesce((payload ->> 'is_active')::boolean, true),
    coalesce((payload ->> 'sort_order')::integer, 0),
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    sport = excluded.sport,
    emoji = excluded.emoji,
    period_label = excluded.period_label,
    periods = excluded.periods,
    uses_clock = excluded.uses_clock,
    clock_seconds = excluded.clock_seconds,
    scoring = excluded.scoring,
    callouts = excluded.callouts,
    stat_fields = excluded.stat_fields,
    measurables = excluded.measurables,
    positions = excluded.positions,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = timezone('utc', now())
  returning * into result;

  return result;
end;
$$;