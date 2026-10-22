-- MONEY-TIPS-01: no athlete-gift cut; published default-OFF optional extras and immutable test quote admission.
-- No historical financial rewrite, provider settlement, gift/Aura webhook credit, or payout activation.
-- Containment: pause new checkout, keep extras OFF and reconcile issued/paid quotes; never restore the gift cut.
-- Forward repair must preserve zero-cut allocations and original financial history.
begin;

create or replace function public.company_revenue_bps(stream_source text)
returns integer
language sql
immutable
as $$
  select case lower(btrim(coalesce(stream_source, '')))
    when 'malo' then 0
    when 'booster' then 1500
    when 'vault' then 2000
    when 'merch' then 10000
    when 'tip' then 10000
    when 'card_fee' then 10000
    else 0
  end;
$$;

create or replace function public.sync_company_revenue_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  -- Share the existing month lock so a close cannot race this missing-gift catch-up.
  perform public.ledger_lock_period(period) from (
    select distinct to_char(t.created_at, 'YYYY-MM') period from public.tips t
    where not exists (select 1 from public.company_revenue_logs l where l.source='malo' and l.source_id=t.id::text)
    order by 1
  ) missing;
  insert into public.company_revenue_logs (
    transaction_type, source, source_id, label, payee_kind, player_id,
    gross_cents, platform_cents, payout_cents,
    gross_amount, platform_cut_amount, payout_amount, created_at
  )
  select
    'malo',
    'malo',
    t.id::text,
    'Gift · ' || public.tip_origin_label(t.origin, t.entry, t.source_label)
      || ' · ' || coalesce(nullif(p.name, ''), 'Athlete'),
    'athlete',
    t.player_id,
    t.amount_cents,
    0,
    t.amount_cents,
    round(t.amount_cents / 100.0, 2),
    0,
    round((t.amount_cents) / 100.0, 2),
    t.created_at
  from public.tips t
  left join public.players p on p.id = t.player_id
  where not public.ledger_period_is_closed(t.created_at::date)
  -- Historical rows retain their original booked allocation. Closed-month gaps require reviewed repair.
  on conflict (source, source_id) do nothing;

  get diagnostics n = row_count;

  insert into public.company_revenue_logs (
    transaction_type, source, source_id, label, payee_kind, player_id,
    gross_cents, platform_cents, payout_cents,
    gross_amount, platform_cut_amount, payout_amount, created_at
  )
  select
    'booster',
    'booster',
    s.id::text,
    'Booster · ' || coalesce(nullif(s.business_name, ''), 'Local booster'),
    'operator',
    null,
    coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0),
    round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) * 1500)::numeric / 10000.0)::integer,
    coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0)
      - round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) * 1500)::numeric / 10000.0)::integer,
    round(coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) / 100.0, 2),
    round(round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) * 1500)::numeric / 10000.0)::integer / 100.0, 2),
    round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0)
      - round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) * 1500)::numeric / 10000.0)::integer) / 100.0, 2),
    s.created_at
  from public.sponsorships s
  on conflict (source, source_id) do update
    set
      label = excluded.label,
      gross_cents = excluded.gross_cents,
      platform_cents = excluded.platform_cents,
      payout_cents = excluded.payout_cents,
      gross_amount = excluded.gross_amount,
      platform_cut_amount = excluded.platform_cut_amount,
      payout_amount = excluded.payout_amount;

  insert into public.company_revenue_logs (
    transaction_type, source, source_id, label, payee_kind, player_id,
    gross_cents, platform_cents, payout_cents,
    gross_amount, platform_cut_amount, payout_amount, created_at
  )
  select
    'vault',
    'vault',
    sub.id::text,
    'Vault · ' || coalesce(nullif(p.name, ''), 'Athlete'),
    'athlete',
    sub.athlete_id,
    499,
    round((499 * 2000)::numeric / 10000.0)::integer,
    499 - round((499 * 2000)::numeric / 10000.0)::integer,
    4.99,
    round(round((499 * 2000)::numeric / 10000.0)::integer / 100.0, 2),
    round((499 - round((499 * 2000)::numeric / 10000.0)::integer) / 100.0, 2),
    sub.created_at
  from public.subscriptions sub
  left join public.players p on p.id = sub.athlete_id
  on conflict (source, source_id) do update
    set
      label = excluded.label,
      player_id = excluded.player_id,
      gross_cents = excluded.gross_cents,
      platform_cents = excluded.platform_cents,
      payout_cents = excluded.payout_cents,
      gross_amount = excluded.gross_amount,
      platform_cut_amount = excluded.platform_cut_amount,
      payout_amount = excluded.payout_amount;

  insert into public.company_revenue_logs (
    transaction_type, source, source_id, label, payee_kind, player_id,
    gross_cents, platform_cents, payout_cents,
    gross_amount, platform_cut_amount, payout_amount, created_at
  )
  select
    'merch',
    'merch',
    o.id::text,
    'Drip · ' || coalesce(nullif(sp.name, ''), coalesce(o.product_id, 'Merch')),
    'none',
    null,
    o.amount_cents,
    o.amount_cents,
    0,
    round(o.amount_cents / 100.0, 2),
    round(o.amount_cents / 100.0, 2),
    0,
    o.created_at
  from public.shop_orders o
  left join public.shop_products sp on sp.id = o.product_id
  on conflict (source, source_id) do update
    set
      label = excluded.label,
      gross_cents = excluded.gross_cents,
      platform_cents = excluded.platform_cents,
      payout_cents = excluded.payout_cents,
      gross_amount = excluded.gross_amount,
      platform_cut_amount = excluded.platform_cut_amount,
      payout_amount = excluded.payout_amount;

  return n;
end;
$$;

create or replace function public.get_company_revenue_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;
  perform public.sync_company_revenue_logs();

  select jsonb_build_object(
    'total_gross', round((select coalesce(sum(gross_cents), 0) from public.company_revenue_logs) / 100.0, 2),
    'total_platform_revenue', round((select coalesce(sum(platform_cents), 0) from public.company_revenue_logs) / 100.0, 2),
    'total_payouts', round((select coalesce(sum(payout_cents), 0) from public.company_revenue_logs) / 100.0, 2),
    'gross_volume_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs),
    'company_net_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs),
    'payouts_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs),
    'gift_repair_gap_count', (select count(*) from public.tips t where public.ledger_period_is_closed(t.created_at::date) and not exists (select 1 from public.company_revenue_logs l where l.source='malo' and l.source_id=t.id::text)),
    'stripe_paid_cents', (
      select coalesce(sum(amount_cents), 0)::int
      from public.disbursements
      where status = 'paid'
    ),
    'streams', jsonb_build_array(
      jsonb_build_object(
        'source', 'malo',
        'label', 'Gifts',
        'split', '0% platform / 100% family gross; historical allocations retained',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'payout_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'platform_bps', 0,
        'payout_bps', 10000,
        'payee', 'Athlete'
      ),
      jsonb_build_object(
        'source', 'tip',
        'label', 'Optional tips to Tapua''i',
        'split', '100% platform (donor chose it)',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'tip'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'tip'),
        'payout_cents', 0,
        'platform_bps', 10000,
        'payout_bps', 0,
        'payee', 'Tapua''i'
      ),
      jsonb_build_object(
        'source', 'card_fee',
        'label', 'Estimated processing contributions',
        'split', 'Separate estimated processing contribution; actual provider cost unverified',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'card_fee'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'card_fee'),
        'payout_cents', 0,
        'platform_bps', 10000,
        'payout_bps', 0,
        'payee', 'Tapua''i'
      ),
      jsonb_build_object(
        'source', 'booster',
        'label', 'Local District Booster Sponsorships',
        'split', '15% platform / 85% operator',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'booster'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'booster'),
        'payout_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs where source = 'booster'),
        'platform_bps', 1500,
        'payout_bps', 8500,
        'payee', 'Operator'
      ),
      jsonb_build_object(
        'source', 'merch_vault',
        'label', 'Merch & Vault Subscriptions',
        'split', 'Vault 20% / 80% athlete · Drip 100% platform',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source in ('vault', 'merch')),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source in ('vault', 'merch')),
        'payout_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs where source in ('vault', 'merch')),
        'platform_bps', null,
        'payout_bps', null,
        'payee', 'Athlete + company'
      )
    ),
    'recent', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', row.id,
            'source', row.source,
            'label', row.label,
            'gross_cents', row.gross_cents,
            'platform_cents', row.platform_cents,
            'payout_cents', row.payout_cents,
            'payee_kind', row.payee_kind,
            'created_at', row.created_at
          )
          order by row.created_at desc
        ),
        '[]'::jsonb
      )
      from (
        select *
        from public.company_revenue_logs
        order by created_at desc
        limit 40
      ) row
    )
  )
  into payload;

  return payload;
end;
$$;

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
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Admin access required';
  end if;
  if next_draft is null or jsonb_typeof(next_draft) is distinct from 'object'
    or (next_draft ? 'buttons' and jsonb_typeof(next_draft->'buttons') is distinct from 'object') then
    raise exception 'next_draft is required';
  end if;
  insert into public.app_runtime_config (id, draft, published, updated_at)
  values ('default', next_draft,
    jsonb_set(next_draft, '{buttons}', coalesce(next_draft->'buttons','{}'::jsonb) || '{"MONETIZATION_TIPS_ENABLED":false}'::jsonb, true), now())
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

-- Only literal published JSON true admits new optional monetary extras; clients cannot call this private helper.
create or replace function public.monetization_tips_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select published #> '{buttons,MONETIZATION_TIPS_ENABLED}' = 'true'::jsonb
    from public.app_runtime_config where id='default'), false);
$$;
revoke all on function public.monetization_tips_enabled() from public,anon,authenticated,service_role;

-- Persist the allocation BEFORE Stripe creates an intent. The private provisional reference is promoted exactly once.
-- The flat published catalog amount is an ESTIMATE, not a provider balance-transaction fee.
create or replace function public.prepare_tip_payment_context(
  donor_user_id uuid, athlete_id uuid, gift_cents bigint, cover_fees boolean, platform_tip_percent numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  quote_id uuid := gen_random_uuid();
  fee bigint := 0;
  platform_tip bigint;
  fee_json jsonb;
  fee_dollars numeric;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'payment_context_denied' using errcode='42501'; end if;
  if donor_user_id is null or athlete_id is null or gift_cents is null or gift_cents < 50
    or gift_cents > 100000 or cover_fees is null or platform_tip_percent is null
    or platform_tip_percent < 0 or platform_tip_percent > 100
    or not exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id
      where u.id=donor_user_id and p.age_blocked_at is null)
    or not exists(select 1 from public.players p where p.id=athlete_id)
    then raise exception 'payment_context_invalid' using errcode='22023'; end if;
  if public.malo_target_frozen(athlete_id) then raise exception 'payment_target_frozen' using errcode='42501'; end if;
  if (cover_fees or platform_tip_percent > 0) and not public.monetization_tips_enabled() then
    raise exception 'monetization_tips_disabled' using errcode='42501';
  end if;
  if cover_fees then
    select published #> '{catalog,maloFeeDollars}' into fee_json from public.app_runtime_config where id='default';
    if jsonb_typeof(fee_json) is distinct from 'number' then
      raise exception 'processing_estimate_unavailable' using errcode='22023';
    end if;
    fee_dollars := (fee_json #>> '{}')::numeric;
    if fee_dollars < 0 or fee_dollars > 21474836 then
      raise exception 'processing_estimate_unavailable' using errcode='22023';
    end if;
    fee := round(fee_dollars * 100)::bigint;
    -- The only business writer is authenticated: quote every existing ledger cap before charge.
    if fee > greatest(500, gift_cents) then
      raise exception 'processing_estimate_out_of_bounds' using errcode='22023';
    end if;
  end if;
  platform_tip := round(gift_cents * platform_tip_percent / 100)::bigint;
  if gift_cents + fee + platform_tip > 2147483647 then raise exception 'payment_context_invalid' using errcode='22023'; end if;
  insert into public.notification_payment_contexts(id,payment_intent_id,donor_user_id,athlete_id,currency,
    gift_cents,cover_fee_cents,platform_tip_cents,total_cents)
  values(quote_id,'pi_quote_' || replace(quote_id::text,'-',''),donor_user_id,athlete_id,'usd',
    gift_cents,fee,platform_tip,gift_cents+fee+platform_tip);
  return jsonb_build_object('id',quote_id,'donorId',donor_user_id,'athleteId',athlete_id,'purpose','donation','currency','usd',
    'giftCents',gift_cents,'coverFeeCents',fee,'platformTipCents',platform_tip,'totalCents',gift_cents+fee+platform_tip,
    'livemode',false,'notificationAuthority',false);
end;
$$;
revoke all on function public.prepare_tip_payment_context(uuid,uuid,bigint,boolean,numeric) from public,anon,authenticated,service_role;
grant execute on function public.prepare_tip_payment_context(uuid,uuid,bigint,boolean,numeric) to service_role;

-- Promote only the already-issued server quote, or repeat its exact original binding. OFF does not discard paid quotes.
create or replace function public.record_notification_payment_context(
  context_id uuid, provider_intent_id text, donor_user_id uuid, athlete_id uuid,
  gift_cents bigint, cover_fee_cents bigint, platform_tip_cents bigint,
  currency_code text, provider_livemode boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
declare existing public.notification_payment_contexts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'payment_context_denied' using errcode='42501'; end if;
  if context_id is null or provider_intent_id is null or provider_intent_id !~ '^pi_[A-Za-z0-9]{8,64}$'
    or provider_intent_id like 'pi_quote_%' or donor_user_id is null or athlete_id is null
    or currency_code is distinct from 'usd' or provider_livemode is distinct from false
    then raise exception 'payment_context_invalid' using errcode='22023'; end if;
  select * into existing from public.notification_payment_contexts c where c.id=context_id for update;
  if not found or existing.donor_user_id is distinct from donor_user_id or existing.athlete_id is distinct from athlete_id
    or existing.gift_cents is distinct from gift_cents or existing.cover_fee_cents is distinct from cover_fee_cents
    or existing.platform_tip_cents is distinct from platform_tip_cents or existing.currency is distinct from currency_code
    or existing.notification_authority is distinct from false or existing.livemode is distinct from false
    then raise exception 'payment_context_conflict' using errcode='22023'; end if;
  if existing.payment_intent_id = 'pi_quote_' || replace(context_id::text,'-','') then
    update public.notification_payment_contexts set payment_intent_id=provider_intent_id, updated_at=statement_timestamp() where id=context_id;
  elsif existing.payment_intent_id is distinct from provider_intent_id then
    raise exception 'payment_context_conflict' using errcode='22023';
  end if;
  return true;
end;
$$;
revoke all on function public.record_notification_payment_context(uuid,text,uuid,uuid,bigint,bigint,bigint,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.record_notification_payment_context(uuid,text,uuid,uuid,bigint,bigint,bigint,text,boolean) to service_role;

-- Context row lock serializes duplicate insertion across transactions. Legacy zero-extra gifts still work.
create or replace function public.tips_payment_context_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare context public.notification_payment_contexts%rowtype;
begin
  if coalesce(new.platform_tip_cents,0) < 0 or coalesce(new.cover_fee_cents,0) < 0 then
    raise exception 'gift_allocation_invalid' using errcode='22023';
  end if;
  if nullif(new.stripe_payment_intent_id,'') is not null then
    if new.stripe_payment_intent_id like 'pi_quote_%' then raise exception 'gift_context_unbound' using errcode='42501'; end if;
    -- Also serialize legacy zero-extra references, even if a prior client never created a context.
    perform pg_advisory_xact_lock(hashtextextended('gift-intent:' || new.stripe_payment_intent_id,0));
    if exists(select 1 from public.tips t where t.stripe_payment_intent_id=new.stripe_payment_intent_id) then
      raise exception 'gift_intent_already_recorded' using errcode='23505';
    end if;
    select * into context from public.notification_payment_contexts c where c.payment_intent_id=new.stripe_payment_intent_id for update;
  end if;
  if context.id is not null then
    if context.donor_user_id is distinct from new.fan_id or context.donor_user_id is distinct from auth.uid()
      or context.athlete_id is distinct from new.player_id or context.gift_cents is distinct from new.amount_cents
      or context.platform_tip_cents is distinct from coalesce(new.platform_tip_cents,0)
      or context.cover_fee_cents is distinct from coalesce(new.cover_fee_cents,0)
      or context.livemode is distinct from false or context.notification_authority is distinct from false then
      raise exception 'gift_context_mismatch' using errcode='42501';
    end if;
  elsif coalesce(new.platform_tip_cents,0)>0 or coalesce(new.cover_fee_cents,0)>0 then
    raise exception 'gift_context_required' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.tips_payment_context_guard() from public,anon,authenticated,service_role;
drop trigger if exists tips_payment_context_guard_bi on public.tips;
create trigger tips_payment_context_guard_bi before insert on public.tips for each row execute function public.tips_payment_context_guard();

commit;
