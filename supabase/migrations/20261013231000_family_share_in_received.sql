-- Show families what actually reaches their account (2026-10-13).
--
-- Purpose
--   The athlete's "Support received" list (get_received_malo) and the custodial money cards (get_custodial_summary,
--   "… received" / "Held for you") showed the full amount fans donated. The family account receives that amount
--   minus Tapua'i's share (90% today), so a family saw $50 when $45 reached them.
--   - get_received_malo gains family_cents per donation.
--   - get_custodial_summary gains family_cents; received_cents keeps meaning "donated by fans" so app builds already
--     installed keep working (expand, then contract).
--   family_cents comes from the books' recorded payout for that donation (company_revenue_logs, source 'malo'), and
--   falls back to the current split (company_revenue_bps('malo')) when no revenue row exists.
--   The fallback uses company_revenue_bps('malo'); sync_company_revenue_logs hard-codes 1000 bps, so the two differ
--   only if the rate changes (RLS_SECURITY note).
--   Not changed: withdrawal requests are still not capped against the family share; how money reaches families is
--   an open owner + counsel decision (STATE §6 item 8).
--
-- Owner: COMMERCE → LEDGER, CUSTODIAL (chain: owner → CTO → COMMERCE); copy reviewed by VOICE and LEGAL.
-- Depends on: company_revenue.sql (company_revenue_logs, company_revenue_bps), custodial_money.sql, the Rally /
--   thanks migration (get_received_malo). All on staging.
-- Safe to re-run: get_received_malo is dropped and re-created (its result columns change), with grants restored;
--   get_custodial_summary is create or replace.
-- Applied: written 2026-10-13, not applied anywhere.
-- Rollback: re-run both functions' previous definitions from schema.sql history (the app falls back to the
--   donated total when family_cents is missing).

drop function if exists public.get_received_malo(uuid);

create or replace function public.get_received_malo(target_player_id uuid)
returns table (
  id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  origin text,
  entry text,
  source_label text,
  reel_id uuid,
  wishlist_item_id uuid,
  fan_name text,
  family_cents integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target_player_id is null then
    return;
  end if;

  if public.current_user_role() is distinct from 'admin'
    and not exists (
      select 1
      from public.profiles me
      where me.user_id = auth.uid()
        and me.player_id = target_player_id
    )
    and not exists (
      select 1
      from public.players pl
      join public.profiles me on me.id = pl.guardian_id
      where pl.id = target_player_id
        and me.user_id = auth.uid()
    )
  then
    return;
  end if;

  return query
  select
    t.id,
    t.amount_cents,
    coalesce(t.aura_points, 0) as aura_points,
    t.created_at,
    coalesce(t.origin, 'profile') as origin,
    coalesce(t.entry, 'in_app') as entry,
    coalesce(t.source_label, '') as source_label,
    t.reel_id,
    t.wishlist_item_id,
    coalesce(nullif(split_part(btrim(coalesce(f.full_name, '')), ' ', 1), ''), 'Fan') as fan_name,
    -- What reaches the family account: the books' recorded payout for this donation, or the current split when
    -- no revenue row exists yet.
    coalesce(
      r.payout_cents,
      t.amount_cents - round((t.amount_cents * public.company_revenue_bps('malo'))::numeric / 10000.0)::integer
    ) as family_cents
  from public.tips t
  left join public.profiles f on f.user_id = t.fan_id
  left join public.company_revenue_logs r on r.source = 'malo' and r.source_id = t.id::text
  where t.player_id = target_player_id
  order by t.created_at desc
  limit 100;
end;
$$;

revoke execute on function public.get_received_malo(uuid) from public, anon;
grant execute on function public.get_received_malo(uuid) to authenticated;

create or replace function public.get_custodial_summary(target_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text := public.custodial_role(target_player_id);
  acct public.custodial_accounts%rowtype;
  athlete public.players%rowtype;
  guardian_name text;
  handover date;
begin
  if role_name is null then
    return null;
  end if;
  select * into athlete from public.players where id = target_player_id;
  select * into acct from public.custodial_accounts where player_id = target_player_id;
  select coalesce(nullif(trim(p.full_name), ''), 'Your guardian') into guardian_name
  from public.profiles p where p.id = athlete.guardian_id;
  handover := public.athlete_handover_date(target_player_id);

  return jsonb_build_object(
    'viewer_role', role_name,
    'player_id', target_player_id,
    'athlete_name', coalesce(athlete.name, ''),
    'guardian_linked', athlete.guardian_id is not null,
    'guardian_name', guardian_name,
    'has_account', acct.player_id is not null,
    'payouts_enabled', coalesce(acct.payouts_enabled, false),
    'bank_in_athlete_name', acct.bank_in_athlete_name,
    'handover_age', coalesce(acct.handover_age, 18),
    'handover_date', handover,
    'athlete_controls', coalesce(handover <= current_date, false),
    'received_cents', (
      select coalesce(sum(t.amount_cents), 0) from public.tips t where t.player_id = target_player_id
    ),
    -- The family account's share (after Tapua'i's share), from the books; received_cents stays the donated total.
    'family_cents', (
      select coalesce(sum(coalesce(
        r.payout_cents,
        t.amount_cents - round((t.amount_cents * public.company_revenue_bps('malo'))::numeric / 10000.0)::integer
      )), 0)
      from public.tips t
      left join public.company_revenue_logs r on r.source = 'malo' and r.source_id = t.id::text
      where t.player_id = target_player_id
    ),
    'requests', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.created_at desc)
      from (
        select id, requested_role, amount_cents, note, status, created_at, decided_at
        from public.custodial_withdrawals
        where player_id = target_player_id
        order by created_at desc
        limit 20
      ) w
    ), '[]'::jsonb)
  );
end;
$$;

-- Hosted Supabase grants new functions to anon by default; the summary is for signed-in custodial parties only
-- (it returns null without a user, so this is tidy-up; RLS_SECURITY review).
revoke execute on function public.get_custodial_summary(uuid) from public, anon;
grant execute on function public.get_custodial_summary(uuid) to authenticated;
