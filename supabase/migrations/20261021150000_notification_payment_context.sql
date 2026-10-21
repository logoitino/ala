-- NOTIFY-01 prepared, immutable test-mode donation quotes and provider observations. This migration neither
-- writes tips/Aura nor enqueues receipts. Every row is constrained notification_authority=false; canonical
-- business/refund accounting plus outbox integration and client-writer retirement require a separate review.
begin;

create table if not exists public.notification_payment_contexts (
  id uuid primary key,
  payment_intent_id text not null unique check (payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  donor_user_id uuid not null,
  athlete_id uuid not null,
  purpose text not null default 'donation' check (purpose = 'donation'),
  currency text not null check (currency = 'usd'),
  gift_cents bigint not null check (gift_cents between 50 and 9007199254740991),
  cover_fee_cents bigint not null check (cover_fee_cents between 0 and 9007199254740991),
  platform_tip_cents bigint not null check (platform_tip_cents between 0 and 9007199254740991),
  total_cents bigint not null check (total_cents between 50 and 9007199254740991),
  livemode boolean not null default false check (livemode = false),
  notification_authority boolean not null default false check (notification_authority = false),
  observation_state text not null default 'pending' check (observation_state in ('pending','succeeded','partially_refunded','refunded','disputed')),
  success_observed boolean not null default false,
  dispute_observed boolean not null default false,
  refunded_cents bigint not null default 0 check (refunded_cents >= 0 and refunded_cents <= total_cents),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (total_cents = gift_cents + cover_fee_cents + platform_tip_cents)
);
comment on table public.notification_payment_contexts is 'Prepared server quote attribution only; notification authority is always false and observations never credit money/Aura.';
alter table public.notification_payment_contexts enable row level security;
revoke all on public.notification_payment_contexts from public, anon, authenticated, service_role;

create table if not exists public.notification_payment_observations (
  provider_event_id text primary key check (provider_event_id ~ '^evt_[A-Za-z0-9_]+$'),
  context_id uuid not null references public.notification_payment_contexts(id),
  observation_kind text not null check (observation_kind in ('success','refund','dispute')),
  refunded_cents bigint not null check (refunded_cents >= 0),
  observed_at timestamptz not null default statement_timestamp()
);
comment on table public.notification_payment_observations is 'Unique verified provider observation IDs, committed with the observation transition; never claims canonical financial application.';
alter table public.notification_payment_observations enable row level security;
revoke all on public.notification_payment_observations from public, anon, authenticated, service_role;

-- The optional server quote adapter is unwired. A service call may preserve a reviewed quote but cannot enable delivery.
create or replace function public.record_notification_payment_context(
  context_id uuid, provider_intent_id text, donor_user_id uuid, athlete_id uuid,
  gift_cents bigint, cover_fee_cents bigint, platform_tip_cents bigint,
  currency_code text, provider_livemode boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
declare existing public.notification_payment_contexts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'payment_context_denied' using errcode='42501'; end if;
  if context_id is null or provider_intent_id is null or provider_intent_id !~ '^pi_[A-Za-z0-9_]+$'
    or donor_user_id is null or athlete_id is null or currency_code is distinct from 'usd'
    or provider_livemode is distinct from false or gift_cents is null or gift_cents < 50
    or cover_fee_cents is null or cover_fee_cents < 0 or platform_tip_cents is null or platform_tip_cents < 0
    or gift_cents > 9007199254740991 or cover_fee_cents > 9007199254740991 or platform_tip_cents > 9007199254740991
    or gift_cents + cover_fee_cents + platform_tip_cents > 9007199254740991
    or not exists(select 1 from auth.users u where u.id=donor_user_id)
    or not exists(select 1 from public.players p where p.id=athlete_id)
    then raise exception 'payment_context_invalid' using errcode='22023'; end if;
  insert into public.notification_payment_contexts(id,payment_intent_id,donor_user_id,athlete_id,currency,
    gift_cents,cover_fee_cents,platform_tip_cents,total_cents)
    values(context_id,provider_intent_id,donor_user_id,athlete_id,currency_code,
      gift_cents,cover_fee_cents,platform_tip_cents,gift_cents+cover_fee_cents+platform_tip_cents)
    on conflict do nothing;
  select * into existing from public.notification_payment_contexts c where c.id=context_id for update;
  if not found or existing.payment_intent_id is distinct from provider_intent_id
    or existing.donor_user_id is distinct from donor_user_id or existing.athlete_id is distinct from athlete_id
    or existing.gift_cents is distinct from gift_cents or existing.cover_fee_cents is distinct from cover_fee_cents
    or existing.platform_tip_cents is distinct from platform_tip_cents or existing.currency is distinct from currency_code
    then raise exception 'payment_context_conflict' using errcode='22023'; end if;
  return true;
end $$;
revoke all on function public.record_notification_payment_context(uuid,text,uuid,uuid,bigint,bigint,bigint,text,boolean) from public, anon, authenticated;
grant execute on function public.record_notification_payment_context(uuid,text,uuid,uuid,bigint,bigint,bigint,text,boolean) to service_role;

-- One transaction owns unique event insertion AND observation state. A failed update rolls the insertion back.
-- Refund input is the provider's cumulative charge.amount_refunded: greatest(), never additive accounting.
create or replace function public.apply_notification_payment_event(
  provider_event_id text, provider_intent_id text, observation_kind text, provider_livemode boolean,
  currency_code text, total_cents bigint, refunded_cents bigint, context_metadata jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare context public.notification_payment_contexts%rowtype;
  prior public.notification_payment_observations%rowtype;
  next_refunded bigint;
  next_disputed boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'payment_observation_denied' using errcode='42501'; end if;
  if provider_event_id is null or provider_event_id !~ '^evt_[A-Za-z0-9_]+$'
    or provider_intent_id is null or provider_intent_id !~ '^pi_[A-Za-z0-9_]+$'
    or observation_kind is null or observation_kind not in ('success','refund','dispute')
    or provider_livemode is distinct from false or currency_code is distinct from 'usd'
    or total_cents is null or total_cents < 50 or total_cents > 9007199254740991
    or refunded_cents is null or refunded_cents < 0 or refunded_cents > total_cents
    or (observation_kind <> 'refund' and refunded_cents <> 0)
    or context_metadata is null or jsonb_typeof(context_metadata) <> 'object'
    then raise exception 'payment_observation_invalid' using errcode='22023'; end if;
  select * into context from public.notification_payment_contexts c where c.payment_intent_id=provider_intent_id for update;
  if not found then return jsonb_build_object('status','source_unavailable','notification','unavailable','observed',false); end if;
  if context.notification_authority is distinct from false or context.total_cents is distinct from total_cents
    or context.currency is distinct from currency_code or context.livemode is distinct from provider_livemode
    or context_metadata->>'tapuai_context_id' is distinct from context.id::text
    or context_metadata->>'tapuai_purpose' is distinct from context.purpose
    or context_metadata->>'tapuai_user_id' is distinct from context.donor_user_id::text
    or context_metadata->>'tapuai_player_id' is distinct from context.athlete_id::text
    or context_metadata->>'tapuai_gift_cents' is distinct from context.gift_cents::text
    or context_metadata->>'tapuai_cover_fee_cents' is distinct from context.cover_fee_cents::text
    or context_metadata->>'tapuai_platform_tip_cents' is distinct from context.platform_tip_cents::text
    or context_metadata->>'tapuai_notification_authority' is distinct from 'false'
    then raise exception 'payment_observation_mismatch' using errcode='22023'; end if;
  select * into prior from public.notification_payment_observations o where o.provider_event_id=apply_notification_payment_event.provider_event_id;
  if found then
    if prior.context_id is distinct from context.id or prior.observation_kind is distinct from observation_kind
      or prior.refunded_cents is distinct from refunded_cents
      then raise exception 'payment_observation_conflict' using errcode='22023'; end if;
    return jsonb_build_object('status','source_unavailable','notification','unavailable','observed',true,'duplicate',true);
  end if;
  insert into public.notification_payment_observations(provider_event_id,context_id,observation_kind,refunded_cents)
    values(provider_event_id,context.id,observation_kind,refunded_cents);
  next_refunded := greatest(context.refunded_cents,refunded_cents);
  next_disputed := context.dispute_observed or observation_kind='dispute';
  update public.notification_payment_contexts c set
    refunded_cents=next_refunded, dispute_observed=next_disputed,
    success_observed=context.success_observed or observation_kind='success',
    observation_state=case when next_disputed then 'disputed' when next_refunded=context.total_cents then 'refunded'
      when next_refunded>0 then 'partially_refunded' when context.success_observed or observation_kind='success' then 'succeeded' else 'pending' end,
    updated_at=statement_timestamp() where c.id=context.id;
  return jsonb_build_object('status','source_unavailable','notification','unavailable','observed',true,'duplicate',false);
end $$;
revoke all on function public.apply_notification_payment_event(text,text,text,boolean,text,bigint,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.apply_notification_payment_event(text,text,text,boolean,text,bigint,bigint,jsonb) to service_role;
commit;
