-- Payee verification: who may receive an athlete's donations, how they were verified, and who can change payout flags
-- (VERIFY-02, 2026-10-14). Plan and owner decisions: docs/engineering/design/PAYEE_VERIFICATION_PLAN.md.
--
-- Purpose
--   Owner decisions 2026-10-14: (1) an earner's Social Security number goes to Stripe only (Stripe-hosted Connect
--   onboarding verifies it and issues tax forms); Tapua'i never stores an SSN or part of one; (2) a guardian may receive a
--   minor's money only after Stripe verifies their identity AND the school confirms in person that they are the parent on
--   record (support reviews a birth certificate or court order as the fallback, without keeping it); (3) Stripe Identity
--   (ID + selfie) only for disputes; (4) payout flags change by hand only with a written reason and a second admin.
--   1. payee_verifications: append-only record of each check (provider, method, provider reference, status, yes/no
--      checks, reviewer, reason). CHECK constraints refuse SSN-shaped text and unknown check names. No client access.
--   2. payee_for_player / payee_hold_reason: the actual payee (the guardian on record while the guardian holds the money
--      or the athlete is a minor; otherwise the athlete's account) needs a current identity check (Stripe: identity and
--      TIN) and, for a guardian, a current relationship check. athlete_payout_status adds 'needs_payee_verification'.
--      "Transfers active" (payouts_enabled) is no longer read as identity.
--   3. record_stripe_kyc (server only) records Stripe's result for the future account.updated webhook (CONNECT).
--   4. Payout flags (profiles.stripe_connect_id / payouts_enabled / stripe_onboarding_complete and the custodial
--      account's) change only from the server or through an approved two-admin override (payout_flag_overrides).
--   5. A changed guardian on record or Connect account supersedes the old checks (re-verification).
--   6. Admin: overview, relationship check entry, revoke, override request / approval, report.
--
-- Owner: CONNECT (via COMMERCE, CTO) with CUSTODIAL, ATHLETE_VERIFICATION, ADMIN; reviews RLS_SECURITY, SECURITY,
--   PRIVACY_ENGINEERING, INFO_RETURNS, LEGAL (row AA), DATA_GOVERNANCE.
-- Needs: 20261014110000_minor_accounts.sql first.
-- Safe to re-run: create table if not exists; create or replace; drop trigger if exists.
-- Applied: written 2026-10-14, not applied anywhere. Payouts stay blocked (503) regardless.
-- Rollback: drop the two new tables and the functions and triggers below; re-apply athlete_payout_status from
--   20261014110000; restore admin writes to the payout flags (guard_profiles_admin_escalation still allows them).

-- 1. Records -----------------------------------------------------------------------------------------------------------

create table if not exists public.payee_verifications (
  id uuid primary key default gen_random_uuid(),
  subject_profile_id uuid references public.profiles (id) on delete set null,
  player_id uuid references public.players (id) on delete set null,
  role text not null check (role in ('adult_athlete', 'guardian_payee')),
  method text not null check (method in ('stripe_connect_kyc', 'school_parent_confirmation', 'document_review', 'stripe_identity')),
  provider text not null check (provider in ('stripe', 'school', 'support')),
  -- Stripe object ids only (acct_…, vs_…); never a number a person typed.
  provider_ref text check (provider_ref is null or provider_ref ~ '^(acct|vs|vi)_[A-Za-z0-9]{6,64}$'),
  status text not null check (status in ('pending', 'verified', 'requires_input', 'failed', 'revoked', 'superseded')),
  checks jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  expires_at timestamptz,
  reviewer_id uuid references public.profiles (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 500),
  superseded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  -- Owner decision: no SSN, not even part of one, ever lands here.
  constraint payee_verifications_no_ssn check (coalesce(reason, '') !~ '[0-9]{3}[- ]?[0-9]{2}[- ]?[0-9]{4}'),
  constraint payee_verifications_known_checks check (
    jsonb_typeof(checks) = 'object'
    and checks - array['identity', 'tin', 'bank', 'relationship', 'document_kept'] = '{}'::jsonb
  )
);
create index if not exists payee_verifications_subject_idx on public.payee_verifications (subject_profile_id, created_at desc);
create index if not exists payee_verifications_player_idx on public.payee_verifications (player_id, created_at desc);

create table if not exists public.payout_flag_overrides (
  id uuid primary key default gen_random_uuid(),
  subject_profile_id uuid not null references public.profiles (id) on delete cascade,
  player_id uuid references public.players (id) on delete cascade,
  target text not null check (target in ('profile', 'custodial')),
  payouts_enabled boolean not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 500 and reason !~ '[0-9]{3}[- ]?[0-9]{2}[- ]?[0-9]{4}'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  constraint payout_flag_overrides_custodial_player check (target = 'profile' or player_id is not null)
);
create index if not exists payout_flag_overrides_pending_idx on public.payout_flag_overrides (status, requested_at desc);

alter table public.payee_verifications enable row level security;
alter table public.payout_flag_overrides enable row level security;

-- Append-only: a record only moves to superseded / revoked (once), from these functions.
create or replace function public.guard_payee_verifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if public.is_trusted_server() then
      return old;
    end if;
    raise exception 'Verification records are kept.';
  end if;
  if (new.id, new.subject_profile_id, new.player_id, new.role, new.method, new.provider, new.provider_ref, new.checks,
      new.verified_at, new.expires_at, new.reviewer_id, new.reason, new.created_at)
     is distinct from (old.id, old.subject_profile_id, old.player_id, old.role, old.method, old.provider, old.provider_ref,
      old.checks, old.verified_at, old.expires_at, old.reviewer_id, old.reason, old.created_at)
     and not ((new.subject_profile_id is null and old.subject_profile_id is not null) or (new.player_id is null and old.player_id is not null)
              or (new.reviewer_id is null and old.reviewer_id is not null)) then
    raise exception 'Verification records are kept as recorded.';
  end if;
  if new.status is distinct from old.status
     and not (old.status in ('pending', 'verified', 'requires_input') and new.status in ('superseded', 'revoked')) then
    raise exception 'Verification records are kept as recorded.';
  end if;
  return new;
end;
$$;

drop trigger if exists payee_verifications_append_only on public.payee_verifications;
create trigger payee_verifications_append_only
  before update or delete on public.payee_verifications
  for each row execute function public.guard_payee_verifications();

-- 2. Who the payee is, and is it verified ------------------------------------------------------------------------------

-- The guardian on record while they hold the money (custodial account, before handover) or while the athlete is a known
-- minor; otherwise the athlete's own account (verified, else the open claimant).
create or replace function public.payee_for_player(target_player_id uuid)
returns table (payee_profile_id uuid, payee_role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  guardian uuid;
  account uuid := public.athlete_profile_for_player(target_player_id);
  bd date;
  band text;
begin
  select pl.guardian_id into guardian from public.players pl where pl.id = target_player_id;
  select b.birth_date into bd from public.athlete_birthdates b where b.player_id = target_player_id;
  band := case when account is null then 'unknown' else public.profile_age_band(account) end;
  if (exists (select 1 from public.custodial_accounts ca where ca.player_id = target_player_id)
      and not public.athlete_controls_money(target_player_id))
     or (bd is not null and bd > current_date - interval '18 years') or public.is_minor_band(band) or band = 'under_13' then
    return query select guardian, 'guardian_payee'::text;
  else
    return query select account, 'adult_athlete'::text;
  end if;
end;
$$;

-- The newest live record of one method for this payee (and athlete, for relationship checks).
create or replace function public.current_payee_check(subject uuid, target_player_id uuid, check_methods text[])
returns public.payee_verifications
language sql
stable
security definer
set search_path = ''
as $$
  select v.* from public.payee_verifications v
  where v.subject_profile_id = subject
    and v.method = any (check_methods)
    and (target_player_id is null or v.player_id = target_player_id)
    and v.status not in ('superseded', 'revoked')
    and (v.expires_at is null or v.expires_at > timezone('utc', now()))
  order by v.created_at desc
  limit 1;
$$;

-- What the payee still needs, as a list: 'payee' (nobody to pay), 'identity' (Stripe identity + TIN), 'relationship'
-- (school parent confirmation or document review, for a guardian). Empty = verified.
create or replace function public.payee_missing_checks(target_player_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payee uuid;
  payee_role text;
  kyc public.payee_verifications;
  rel public.payee_verifications;
  missing text[] := array[]::text[];
begin
  select p.payee_profile_id, p.payee_role into payee, payee_role from public.payee_for_player(target_player_id) p;
  if payee is null then
    return array['payee'];
  end if;
  kyc := public.current_payee_check(payee, null, array['stripe_connect_kyc']);
  if kyc.id is null or kyc.status <> 'verified' or coalesce((kyc.checks ->> 'identity')::boolean, false) is not true
     or coalesce((kyc.checks ->> 'tin')::boolean, false) is not true then
    missing := array_append(missing, 'identity');
  end if;
  if payee_role = 'guardian_payee' then
    rel := public.current_payee_check(payee, target_player_id, array['school_parent_confirmation', 'document_review']);
    if rel.id is null or rel.status <> 'verified' then
      missing := array_append(missing, 'relationship');
    end if;
  end if;
  return missing;
end;
$$;

create or replace function public.payee_hold_reason(target_player_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when cardinality(public.payee_missing_checks(target_player_id)) = 0 then null else 'needs_payee_verification' end;
$$;

-- 3. The payout gate ----------------------------------------------------------------------------------------------

-- Same as MINOR-01, plus payee_hold_reason wherever money would otherwise be allowed (the payout flags alone are no
-- longer read as identity).
--   reason   why it is held: 'disputed' | 'no_claim' | 'needs_payout_setup' | 'needs_guardian_consent' |
--            'needs_birth_month' | 'needs_payee_verification' | null
create or replace function public.athlete_payout_status(target_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req public.verification_requests%rowtype;
  open_claims integer;
  claimant_kyc boolean;
  guardian_kyc boolean;
  guardian_holds boolean;
  vouches integer := 0;
  hold text;
begin
  if target_player_id is null then
    return jsonb_build_object('allowed', false, 'path', null, 'cap_cents', null, 'reason', 'no_claim', 'vouches', 0);
  end if;

  if exists (
    select 1 from public.profiles p
    where p.player_id = target_player_id
      and p.verification_status = 'verified'
      and coalesce(p.is_verified, false)
  ) then
    hold := coalesce(public.minor_payout_hold_reason(target_player_id, public.athlete_profile_for_player(target_player_id)),
                     public.payee_hold_reason(target_player_id));
    if hold is not null then
      return jsonb_build_object('allowed', false, 'path', 'school', 'cap_cents', null, 'reason', hold, 'vouches', 0);
    end if;
    return jsonb_build_object('allowed', true, 'path', 'school', 'cap_cents', null, 'reason', null, 'vouches', 0);
  end if;

  if exists (
    select 1 from public.verification_requests v
    where v.player_id = target_player_id and v.status = 'disputed'
  ) then
    return jsonb_build_object('allowed', false, 'path', null, 'cap_cents', null, 'reason', 'disputed', 'vouches', 0);
  end if;

  select count(*) into open_claims
  from public.verification_requests v
  where v.player_id = target_player_id and v.status = 'pending';
  if open_claims <> 1 then
    return jsonb_build_object('allowed', false, 'path', null, 'cap_cents', null, 'reason', 'no_claim', 'vouches', 0);
  end if;

  select * into req
  from public.verification_requests v
  where v.player_id = target_player_id and v.status = 'pending'
  limit 1;

  select count(*) into vouches from public.athlete_vouches av where av.request_id = req.id;

  -- players.guardian_id is admin-set only; custodial_accounts.payouts_enabled is server-only.
  select exists (
    select 1
    from public.custodial_accounts ca
    join public.players pl on pl.id = ca.player_id and pl.guardian_id = ca.guardian_id
    where ca.player_id = target_player_id and ca.payouts_enabled
  ) into guardian_kyc;

  guardian_holds := exists (select 1 from public.custodial_accounts ca where ca.player_id = target_player_id)
    and not public.athlete_controls_money(target_player_id);

  select coalesce(p.payouts_enabled, false) into claimant_kyc
  from public.profiles p where p.id = req.requester_user_id;

  if not (guardian_kyc or (coalesce(claimant_kyc, false) and not guardian_holds)) then
    return jsonb_build_object('allowed', false, 'path', null, 'cap_cents', null, 'reason', 'needs_payout_setup', 'vouches', vouches);
  end if;

  -- the claimant is the account money would follow on this path
  hold := coalesce(public.minor_payout_hold_reason(target_player_id, req.requester_user_id), public.payee_hold_reason(target_player_id));
  if hold is not null then
    return jsonb_build_object('allowed', false, 'path', 'identity', 'cap_cents', null, 'reason', hold, 'vouches', vouches);
  end if;

  return jsonb_build_object(
    'allowed', true,
    'path', 'identity',
    'cap_cents', case when vouches >= 3 then null else public.athlete_pending_payout_cap_cents() end,
    'reason', null,
    'vouches', vouches
  );
end;
$$;

-- 4. Recording checks --------------------------------------------------------------------------------------------------

-- Marks this payee's live checks of these methods superseded (a new check, or something changed that needs a new one).
create or replace function public.supersede_payee_checks(subject uuid, target_player_id uuid, check_methods text[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payee_verifications set status = 'superseded', superseded_at = timezone('utc', now())
  where subject_profile_id = subject and method = any (check_methods)
    and (target_player_id is null or player_id = target_player_id)
    and status in ('pending', 'verified', 'requires_input');
$$;

-- Stripe's answer for a Connect account (server only: the account.updated webhook, CONNECT follow-up). Records identity /
-- TIN / bank results and, with the server's own flag, mirrors "transfers active" onto the account row.
create or replace function public.record_stripe_kyc(account_id text, identity_verified boolean, tin_verified boolean, transfers_active boolean, details_due boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject uuid;
  rec uuid;
begin
  if not public.is_trusted_server() then
    raise exception 'Only the server records Stripe results.';
  end if;
  select p.id into subject from public.profiles p where p.stripe_connect_id = account_id limit 1;
  if subject is null then
    select ca.guardian_id into subject from public.custodial_accounts ca where ca.stripe_connect_id = account_id limit 1;
  end if;
  if subject is null then
    raise exception 'Unknown Connect account.';
  end if;
  perform public.supersede_payee_checks(subject, null, array['stripe_connect_kyc']);
  insert into public.payee_verifications (subject_profile_id, role, method, provider, provider_ref, status, checks, verified_at)
  values (
    subject,
    case when exists (select 1 from public.players pl where pl.guardian_id = subject) then 'guardian_payee' else 'adult_athlete' end,
    'stripe_connect_kyc', 'stripe', account_id,
    case when coalesce(identity_verified, false) and coalesce(tin_verified, false) then 'verified'
         when coalesce(details_due, false) then 'requires_input' else 'pending' end,
    jsonb_build_object('identity', coalesce(identity_verified, false), 'tin', coalesce(tin_verified, false), 'bank', coalesce(transfers_active, false)),
    case when coalesce(identity_verified, false) and coalesce(tin_verified, false) then timezone('utc', now()) end
  )
  returning id into rec;
  perform set_config('app.tapuai_payout_flag_write', 'on', true);
  update public.profiles set payouts_enabled = coalesce(transfers_active, false) where stripe_connect_id = account_id;
  update public.custodial_accounts set payouts_enabled = coalesce(transfers_active, false) where stripe_connect_id = account_id;
  perform set_config('app.tapuai_payout_flag_write', 'off', true);
  return rec;
end;
$$;

-- An admin records a relationship check for a guardian: the school's in-person confirmation that they are the parent on
-- record (default), or support's review of a birth certificate / court order (fallback; the document is not kept).
-- Stripe Identity is entered here only for a dispute.
create or replace function public.admin_record_payee_check(
  target_player_id uuid, subject uuid, check_method text, passed boolean, reason text, provider_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec uuid;
  me uuid := public.my_profile_id();
begin
  perform public.require_admin_guard();
  if check_method not in ('school_parent_confirmation', 'document_review', 'stripe_identity') then
    raise exception 'Choose school parent confirmation, document review or Stripe Identity.';
  end if;
  if char_length(btrim(coalesce(reason, ''))) < 10 then
    raise exception 'Say what was checked (at least 10 characters). Never type an SSN or a document number.';
  end if;
  if check_method <> 'stripe_identity' and not exists (select 1 from public.players pl where pl.id = target_player_id and pl.guardian_id = subject) then
    raise exception 'Set this person as the athlete''s guardian on record first.';
  end if;
  perform public.supersede_payee_checks(subject, target_player_id, array[check_method]);
  insert into public.payee_verifications (subject_profile_id, player_id, role, method, provider, provider_ref, status, checks, verified_at, reviewer_id, reason)
  values (
    subject, target_player_id,
    case when exists (select 1 from public.players pl where pl.id = target_player_id and pl.guardian_id = subject) then 'guardian_payee' else 'adult_athlete' end,
    check_method,
    case check_method when 'school_parent_confirmation' then 'school' when 'document_review' then 'support' else 'stripe' end,
    provider_ref,
    case when coalesce(passed, false) then 'verified' else 'failed' end,
    case check_method
      when 'stripe_identity' then jsonb_build_object('identity', coalesce(passed, false))
      when 'document_review' then jsonb_build_object('relationship', coalesce(passed, false), 'document_kept', false)
      else jsonb_build_object('relationship', coalesce(passed, false)) end,
    case when coalesce(passed, false) then timezone('utc', now()) end,
    me, btrim(reason)
  )
  returning id into rec;
  return rec;
end;
$$;

create or replace function public.admin_revoke_payee_check(verification_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.require_admin_guard();
  if char_length(btrim(coalesce(reason, ''))) < 10 then
    raise exception 'Give a reason (at least 10 characters).';
  end if;
  update public.payee_verifications set status = 'revoked', superseded_at = timezone('utc', now())
  where id = verification_id and status in ('pending', 'verified', 'requires_input');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'This check is no longer live.';
  end if;
  insert into public.payee_verifications (subject_profile_id, player_id, role, method, provider, status, reviewer_id, reason)
  select v.subject_profile_id, v.player_id, v.role, v.method, v.provider, 'revoked', public.my_profile_id(), 'Revoked: ' || btrim(reason)
  from public.payee_verifications v where v.id = verification_id;
end;
$$;

-- 5. Payout flags: the server, or two admins with a reason --------------------------------------------------------------

create or replace function public.guard_payout_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_trusted_server() or coalesce(current_setting('app.tapuai_payout_flag_write', true), '') = 'on' then
    return new;
  end if;
  if tg_table_name = 'profiles' then
    if new.stripe_connect_id is distinct from old.stripe_connect_id
       or new.payouts_enabled is distinct from old.payouts_enabled
       or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete then
      raise exception 'Payout settings change only from Stripe, or with a second admin''s approval.';
    end if;
  elsif new.stripe_connect_id is distinct from old.stripe_connect_id or new.payouts_enabled is distinct from old.payouts_enabled then
    raise exception 'Payout settings change only from Stripe, or with a second admin''s approval.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_payout_flags_guard on public.profiles;
create trigger profiles_payout_flags_guard
  before update on public.profiles
  for each row execute function public.guard_payout_flags();
drop trigger if exists custodial_payout_flags_guard on public.custodial_accounts;
create trigger custodial_payout_flags_guard
  before update on public.custodial_accounts
  for each row execute function public.guard_payout_flags();

create or replace function public.admin_request_payout_override(subject uuid, target_player_id uuid, enable boolean, reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec uuid;
begin
  perform public.require_admin_guard();
  insert into public.payout_flag_overrides (subject_profile_id, player_id, target, payouts_enabled, reason, requested_by)
  values (subject, target_player_id, case when target_player_id is null then 'profile' else 'custodial' end, coalesce(enable, false), btrim(coalesce(reason, '')), public.my_profile_id())
  returning id into rec;
  return rec;
end;
$$;

-- A second admin (not the requester) approves or rejects within 7 days; approval applies the flag.
create or replace function public.admin_decide_payout_override(override_id uuid, approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.payout_flag_overrides%rowtype;
  me uuid := public.my_profile_id();
begin
  perform public.require_admin_guard();
  select * into o from public.payout_flag_overrides where id = override_id for update;
  if not found or o.status <> 'pending' then
    raise exception 'This request was already handled.';
  end if;
  if o.requested_by is not distinct from me then
    raise exception 'A second admin has to decide this.';
  end if;
  if o.requested_at <= timezone('utc', now()) - interval '7 days' then
    update public.payout_flag_overrides set status = 'expired', decided_at = timezone('utc', now()) where id = o.id;
    return 'expired';
  end if;
  if coalesce(approve, false) then
    perform set_config('app.tapuai_payout_flag_write', 'on', true);
    if o.target = 'profile' then
      update public.profiles set payouts_enabled = o.payouts_enabled where id = o.subject_profile_id;
    else
      update public.custodial_accounts set payouts_enabled = o.payouts_enabled where player_id = o.player_id;
    end if;
    perform set_config('app.tapuai_payout_flag_write', 'off', true);
  end if;
  update public.payout_flag_overrides
  set status = case when coalesce(approve, false) then 'approved' else 'rejected' end, decided_by = me, decided_at = timezone('utc', now())
  where id = o.id;
  return case when coalesce(approve, false) then 'approved' else 'rejected' end;
end;
$$;

-- 6. Re-verification ----------------------------------------------------------------------------------------------------

-- A new guardian on record needs new checks; so does a new Connect account.
create or replace function public.payee_changes_supersede()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nested: PL/pgSQL resolves every field named in a condition, so each table's columns are read only for that table.
  if tg_table_name = 'players' then
    if new.guardian_id is distinct from old.guardian_id and old.guardian_id is not null then
      perform public.supersede_payee_checks(old.guardian_id, new.id, array['school_parent_confirmation', 'document_review', 'stripe_identity']);
    end if;
  elsif tg_table_name = 'profiles' then
    if new.stripe_connect_id is distinct from old.stripe_connect_id then
      perform public.supersede_payee_checks(new.id, null, array['stripe_connect_kyc']);
    end if;
  elsif tg_table_name = 'custodial_accounts' then
    if new.stripe_connect_id is distinct from old.stripe_connect_id then
      perform public.supersede_payee_checks(new.guardian_id, null, array['stripe_connect_kyc']);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists players_payee_supersede on public.players;
create trigger players_payee_supersede after update of guardian_id on public.players
  for each row execute function public.payee_changes_supersede();
drop trigger if exists profiles_payee_supersede on public.profiles;
create trigger profiles_payee_supersede after update of stripe_connect_id on public.profiles
  for each row execute function public.payee_changes_supersede();
drop trigger if exists custodial_payee_supersede on public.custodial_accounts;
create trigger custodial_payee_supersede after update of stripe_connect_id on public.custodial_accounts
  for each row execute function public.payee_changes_supersede();

-- 7. Admin ---------------------------------------------------------------------------------------------------------------

-- One person's payee picture: athletes they are the payee for (as the athlete or the guardian on record), what each
-- still needs, the check history (never an SSN; no document), the payout flags and open override requests.
create or replace function public.admin_payee_overview(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return jsonb_build_object(
    'payouts_enabled', (select coalesce(p.payouts_enabled, false) from public.profiles p where p.id = target_profile_id),
    'has_connect_account', (select p.stripe_connect_id is not null from public.profiles p where p.id = target_profile_id),
    'athletes', coalesce((
      select jsonb_agg(jsonb_build_object('player_id', pl.id, 'name', pl.name,
        'as', case when pl.guardian_id = target_profile_id then 'guardian' else 'athlete' end,
        'payee_is_this_person', (select f.payee_profile_id = target_profile_id from public.payee_for_player(pl.id) f),
        'missing', to_jsonb(public.payee_missing_checks(pl.id)),
        'payout', public.athlete_payout_status(pl.id)) order by pl.name)
      from public.players pl
      where pl.guardian_id = target_profile_id
         or pl.id = (select p.player_id from public.profiles p where p.id = target_profile_id and p.verification_status = 'verified')
    ), '[]'::jsonb),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'player_id', v.player_id, 'role', v.role, 'method', v.method,
        'provider', v.provider, 'status', v.status, 'checks', v.checks, 'verified_at', v.verified_at, 'created_at', v.created_at,
        'reviewer', (select r.full_name from public.profiles r where r.id = v.reviewer_id), 'reason', v.reason) order by v.created_at desc)
      from public.payee_verifications v where v.subject_profile_id = target_profile_id
    ), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'target', o.target, 'player_id', o.player_id, 'payouts_enabled', o.payouts_enabled,
        'reason', o.reason, 'status', o.status, 'requested_at', o.requested_at,
        'requested_by', (select r.full_name from public.profiles r where r.id = o.requested_by),
        'mine', o.requested_by is not distinct from public.my_profile_id()) order by o.requested_at desc)
      from public.payout_flag_overrides o where o.subject_profile_id = target_profile_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_payee_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return jsonb_build_object(
    'verified_identity', (select count(distinct v.subject_profile_id) from public.payee_verifications v
                          where v.method = 'stripe_connect_kyc' and v.status = 'verified'),
    'verified_relationship', (select count(*) from public.payee_verifications v
                              where v.method in ('school_parent_confirmation', 'document_review') and v.status = 'verified'),
    'needs_input', (select count(*) from public.payee_verifications v where v.status = 'requires_input'),
    'failed_30d', (select count(*) from public.payee_verifications v where v.status = 'failed' and v.created_at > timezone('utc', now()) - interval '30 days'),
    'overrides_waiting', (select count(*) from public.payout_flag_overrides o
                          where o.status = 'pending' and o.requested_at > timezone('utc', now()) - interval '7 days')
  );
end;
$$;

-- 8. Access ----------------------------------------------------------------------------------------------------------------

do $$
declare
  t text;
  fn text;
begin
  foreach t in array array['payee_verifications', 'payout_flag_overrides'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    -- MINOR-01 rule for every RLS table: closed (under-13) accounts are refused.
    execute format('drop policy if exists "Closed accounts" on public.%I', t);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated
                    using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))', t);
  end loop;
  foreach fn in array array[
    'public.guard_payee_verifications()', 'public.payee_for_player(uuid)', 'public.current_payee_check(uuid, uuid, text[])',
    'public.payee_missing_checks(uuid)', 'public.payee_hold_reason(uuid)', 'public.supersede_payee_checks(uuid, uuid, text[])',
    'public.record_stripe_kyc(text, boolean, boolean, boolean, boolean)', 'public.guard_payout_flags()', 'public.payee_changes_supersede()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  foreach fn in array array[
    'public.admin_record_payee_check(uuid, uuid, text, boolean, text, text)', 'public.admin_revoke_payee_check(uuid, text)',
    'public.admin_request_payout_override(uuid, uuid, boolean, text)', 'public.admin_decide_payout_override(uuid, boolean)',
    'public.admin_payee_overview(uuid)', 'public.admin_payee_report()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;
