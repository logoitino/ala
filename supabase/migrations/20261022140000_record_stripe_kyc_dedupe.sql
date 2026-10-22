-- record_stripe_kyc: repeat calls with the same Stripe answer change nothing (VERIFY-02, brief item 3).
--
-- Why: create-stripe-account now records Stripe's identity/TIN result on every Connect request (status polls
-- included). The 20261014120000 body superseded the current record and inserted a new one on every call, so each
-- poll appended history and briefly left no current record. Now an identical current record is returned as-is,
-- and a per-account transaction lock stops two concurrent polls from both inserting a current record.
-- A different answer still supersedes, so a real Stripe downgrade (verified -> pending) is recorded.
-- The caller only invokes this when Stripe returned a verification status; "unknown" never reaches it.
--
-- Applied: development and staging 2026-10-22 (Claude Code); guest call refused 42501 on both. Replay: scripts/replay/stripe-kyc-replay.mjs.
-- Rollback: re-run the record_stripe_kyc body from 20261014120000_payee_verification.sql.

create or replace function public.record_stripe_kyc(account_id text, identity_verified boolean, tin_verified boolean, transfers_active boolean, details_due boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject uuid;
  is_custodial boolean := false;
  rec uuid;
  verified boolean := coalesce(identity_verified, false) and coalesce(tin_verified, false);
  new_status text;
  new_checks jsonb := jsonb_build_object('identity', coalesce(identity_verified, false), 'tin', coalesce(tin_verified, false), 'bank', coalesce(transfers_active, false));
begin
  if not public.is_trusted_server() then
    raise exception 'Only the server records Stripe results.';
  end if;
  new_status := case when verified then 'verified' when coalesce(details_due, false) then 'requires_input' else 'pending' end;
  -- Serialize per account so the lookup below and the insert see each other.
  perform pg_advisory_xact_lock(hashtextextended('record_stripe_kyc:' || coalesce(account_id, ''), 0));
  select ca.guardian_id into subject from public.custodial_accounts ca where ca.stripe_connect_id = account_id limit 1;
  is_custodial := subject is not null;
  if subject is null then
    select p.id into subject from public.profiles p where p.stripe_connect_id = account_id limit 1;
  end if;
  if subject is null then
    raise exception 'Unknown Connect account.';
  end if;
  select v.id into rec from public.payee_verifications v
  where v.subject_profile_id = subject and v.method = 'stripe_connect_kyc' and v.provider_ref = account_id
    and v.superseded_at is null and v.status = new_status and v.checks = new_checks
  order by v.created_at desc limit 1;
  if rec is not null then
    return rec;
  end if;
  update public.payee_verifications set status = 'superseded', superseded_at = timezone('utc', now())
  where subject_profile_id = subject and method = 'stripe_connect_kyc' and provider_ref = account_id
    and status in ('pending', 'verified', 'requires_input');
  insert into public.payee_verifications (subject_profile_id, role, method, provider, provider_ref, status, checks, verified_at)
  values (
    subject,
    case when is_custodial or exists (select 1 from public.players pl where pl.guardian_id = subject) then 'guardian_payee' else 'adult_athlete' end,
    'stripe_connect_kyc', 'stripe', account_id, new_status, new_checks,
    case when verified then timezone('utc', now()) end
  )
  returning id into rec;
  perform set_config('app.tapuai_payout_flag_write', 'on', true);
  update public.profiles set payouts_enabled = coalesce(transfers_active, false) where stripe_connect_id = account_id;
  update public.custodial_accounts set payouts_enabled = coalesce(transfers_active, false) where stripe_connect_id = account_id;
  perform set_config('app.tapuai_payout_flag_write', 'off', true);
  return rec;
end;
$$;
