-- Caller-bound Stripe test onboarding for adult athletes and a guardian's separate account per athlete.
-- Requires MINOR-01, VERIFY-02 and custodial_money.sql. No new table, client grant or KYC evidence.
-- The server passes the user id from live Auth getUser, never from the request body. Both RPCs are
-- service-role-only; service RLS bypass is compensated by explicit age/owner/consent/handover checks.
-- Context locks are short database transactions; never hold them across Stripe requests. Save repeats
-- authorization after the provider await and compares the exact captured profile/binding before writing.
-- Test fixtures only while the guardian consent form awaits counsel; payouts remain blocked separately.
-- Rollback: stop the new onboarding path and use a reviewed forward migration. Do not restore the old
-- minor bypass, broaden client grants, erase bindings/history or infer identity/TIN from transfer flags.

create or replace function public.stripe_connect_context(actor_user_id uuid, target_player_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  athlete public.profiles%rowtype;
  athlete_ids uuid[];
  player public.players%rowtype;
  custodial public.custodial_accounts%rowtype;
  birth_date date;
  link public.guardian_links%rowtype;
  consent public.guardian_consents%rowtype;
  relationship public.payee_verifications%rowtype;
  binding text;
  initial_player_id uuid;
begin
  if auth.role() is distinct from 'service_role' or actor_user_id is null then
    raise exception using errcode = '42501', message = 'Only the server can load a bank setup context.';
  end if;
  select p.* into actor from public.profiles p where p.user_id = actor_user_id;
  if not found then
    raise exception using errcode = '42501', message = 'Create your profile before bank setup.';
  end if;

  initial_player_id := actor.player_id;
  if target_player_id is null then
    -- Verification decisions lock requests before profiles; keep that order to avoid a cycle.
    perform 1 from public.verification_requests v where v.player_id = initial_player_id
      order by v.id for share;
    select p.* into actor from public.profiles p where p.id = actor.id and p.user_id = actor_user_id for update;
    if not found or actor.age_blocked_at is not null or public.profile_age_band(actor.id) <> 'adult'
       or not (actor.role = 'athlete' or coalesce(actor.roles, array[]::text[]) @> array['athlete']::text[]) then
      raise exception using errcode = '42501', message = 'Bank setup is available to an adult athlete or their guardian on record.';
    end if;
    if actor.player_id is distinct from initial_player_id then
      raise exception using errcode = '40001', message = 'The athlete claim changed. Reload before bank setup.';
    end if;
    if actor.player_id is not null then
      -- Lock existing claim rows as well as the player so an in-flight dispute update cannot pass unnoticed.
      perform 1 from public.players pl where pl.id = actor.player_id for update;
      select ca.* into custodial from public.custodial_accounts ca where ca.player_id = actor.player_id for update;
      perform 1 from public.athlete_birthdates b where b.player_id = actor.player_id for share;
      if custodial.player_id is not null and not public.athlete_controls_money(actor.player_id) then
        raise exception using errcode = '42501', message = 'The guardian on record manages bank setup until the handover date.';
      end if;
      if exists (select 1 from public.verification_requests v where v.player_id = actor.player_id and v.status = 'disputed') then
        raise exception using errcode = '42501', message = 'This athlete account needs review before bank setup.';
      end if;
    end if;
    binding := actor.stripe_connect_id;
  else
    select array_agg(p.id order by p.id) into athlete_ids from public.profiles p
    where p.player_id = target_player_id and p.verification_status = 'verified' and p.is_verified;
    if coalesce(array_length(athlete_ids, 1), 0) <> 1 or athlete_ids[1] = actor.id then
      raise exception using errcode = '42501', message = 'A verified athlete and a separate guardian on record are required.';
    end if;
    -- Link/consent precede profile locks, matching consent revocation's existing order. These rows
    -- are held until commit; every current predicate is checked again after acquiring the locks.
    select l.* into link from public.guardian_links l
    where l.minor_id = athlete_ids[1] and l.guardian_id = actor.id and l.ended_at is null
      and l.confirmed_at is not null order by l.id limit 1 for share;
    if not found then
      raise exception using errcode = '42501', message = 'Confirm the guardian link before bank setup.';
    end if;
    select c.* into consent from public.guardian_consents c
    where c.link_id = link.id and c.guardian_id = actor.id and c.minor_id = athlete_ids[1]
      and c.revoked_at is null and c.allows_donations order by c.signed_at desc, c.id desc limit 1 for share;
    if not found then
      raise exception using errcode = '42501', message = 'Current guardian donations consent is required for bank setup.';
    end if;
    -- Match admin approval/revocation's request-before-profile order after link/consent locks.
    perform 1 from public.verification_requests v where v.player_id = target_player_id
      order by v.id for share;
    select p.* into actor from public.profiles p where p.id = actor.id and p.user_id = actor_user_id for update;
    if not found or actor.age_blocked_at is not null or public.profile_age_band(actor.id) <> 'adult' then
      raise exception using errcode = '42501', message = 'An adult guardian account is required for bank setup.';
    end if;
    select p.* into athlete from public.profiles p where p.id = athlete_ids[1] for update;
    if not found or athlete.player_id is distinct from target_player_id or athlete.verification_status <> 'verified'
       or not athlete.is_verified or athlete.age_blocked_at is not null then
      raise exception using errcode = '42501', message = 'This athlete account needs review before bank setup.';
    end if;
    select pl.* into player from public.players pl where pl.id = target_player_id for update;
    if not found or player.guardian_id is distinct from actor.id then
      raise exception using errcode = '42501', message = 'Only the guardian on record can set up this athlete bank account.';
    end if;
    select ca.* into custodial from public.custodial_accounts ca where ca.player_id = target_player_id for update;
    if not found or custodial.guardian_id is distinct from actor.id then
      raise exception using errcode = '42501', message = 'Set up the matching custodial record before connecting a bank.';
    end if;
    select b.birth_date into birth_date from public.athlete_birthdates b where b.player_id = target_player_id for share;
    if not found or birth_date is null or public.athlete_controls_money(target_player_id) then
      raise exception using errcode = '42501', message = 'Guardian bank setup requires a birth date and a future handover date.';
    end if;
    if exists (select 1 from public.verification_requests v where v.player_id = target_player_id and v.status = 'disputed') then
      raise exception using errcode = '42501', message = 'This athlete account needs review before bank setup.';
    end if;
    -- Latest live relationship outcome wins; a newer pending/failed outcome cannot borrow an older pass.
    select v.* into relationship from public.payee_verifications v
    where v.subject_profile_id = actor.id and v.player_id = target_player_id
      and v.method in ('school_parent_confirmation', 'document_review') and v.status <> 'superseded'
    order by v.created_at desc, v.id desc limit 1 for share;
    if not found or relationship.status <> 'verified' or relationship.checks ->> 'relationship' is distinct from 'true'
       or (relationship.expires_at is not null and relationship.expires_at <= pg_catalog.now())
       or relationship.reviewer_id is null or relationship.second_reviewer_id is null
       or relationship.reviewer_id = relationship.second_reviewer_id or relationship.reviewer_id = actor.id
       or relationship.second_reviewer_id = actor.id then
      raise exception using errcode = '42501', message = 'Reviewed guardian relationship evidence is required before bank setup.';
    end if;
    binding := custodial.stripe_connect_id;
  end if;
  return jsonb_build_object('id', actor.id, 'stripe_connect_id', binding,
    'legal_terms_accepted_at', actor.legal_terms_accepted_at, 'owner_user_id', actor_user_id,
    'target_player_id', target_player_id, 'target_kind', case when target_player_id is null then 'self' else 'guardian' end);
end;
$$;

create or replace function public.save_stripe_connect_account(
  actor_user_id uuid, target_player_id uuid, expected_profile_id uuid, expected_account_id text,
  account_id text, onboarding_complete boolean, transfers_enabled boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  context jsonb;
  saved text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the server can save a bank setup account.';
  end if;
  if account_id is null or account_id !~ '^acct_[A-Za-z0-9]{6,64}$'
     or onboarding_complete is null or transfers_enabled is null then
    raise exception using errcode = '22023', message = 'The bank setup response is incomplete.';
  end if;
  -- Every application account writer uses this same lock: simultaneous profile/custodial saves
  -- cannot both pass a cross-table reuse check for the same provider account. Privileged manual
  -- writes remain a separate administrative boundary, not an authorization path for clients.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account_id, 0));
  context := public.stripe_connect_context(actor_user_id, target_player_id);
  if (context ->> 'id')::uuid is distinct from expected_profile_id
     or (context ->> 'stripe_connect_id') is distinct from expected_account_id
     or (expected_account_id is not null and account_id is distinct from pg_catalog.btrim(expected_account_id)) then
    raise exception using errcode = '40001', message = 'The bank account binding changed. Reload before continuing.';
  end if;
  if expected_account_id is null and context ->> 'legal_terms_accepted_at' is null then
    raise exception using errcode = '42501', message = 'Agree to the current bank setup terms before continuing.';
  end if;
  if exists (select 1 from public.profiles p where pg_catalog.btrim(p.stripe_connect_id) = account_id
      and (target_player_id is not null or p.id <> expected_profile_id))
     or exists (select 1 from public.custodial_accounts ca where pg_catalog.btrim(ca.stripe_connect_id) = account_id
      and (target_player_id is null or ca.player_id <> target_player_id)) then
    raise exception using errcode = '23505', message = 'That bank account is already linked elsewhere.';
  end if;
  if target_player_id is null then
    update public.profiles p set stripe_connect_id = account_id,
      stripe_onboarding_complete = onboarding_complete, payouts_enabled = transfers_enabled
    where p.id = expected_profile_id and p.user_id = actor_user_id
      and p.stripe_connect_id is not distinct from expected_account_id
    returning p.stripe_connect_id into saved;
  else
    update public.custodial_accounts ca set stripe_connect_id = account_id,
      payouts_enabled = transfers_enabled, updated_at = pg_catalog.now()
    where ca.player_id = target_player_id and ca.guardian_id = expected_profile_id
      and ca.stripe_connect_id is not distinct from expected_account_id
    returning ca.stripe_connect_id into saved;
  end if;
  if not found or saved is distinct from account_id then
    raise exception using errcode = '40001', message = 'The bank account binding changed. Reload before continuing.';
  end if;
  return saved;
end;
$$;

-- An account change invalidates that account's checks, not the guardian's other athletes/accounts.
-- Preserve the original athlete-scoped relationship invalidation when the guardian on record changes.
create or replace function public.payee_changes_supersede()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'players' then
    if new.guardian_id is distinct from old.guardian_id and old.guardian_id is not null then
      perform public.supersede_payee_checks(old.guardian_id, new.id,
        array['school_parent_confirmation', 'document_review', 'stripe_identity']);
    end if;
  elsif tg_table_name = 'profiles' then
    if pg_catalog.btrim(new.stripe_connect_id) is distinct from pg_catalog.btrim(old.stripe_connect_id)
       and old.stripe_connect_id is not null then
      update public.payee_verifications v set status = 'superseded', superseded_at = pg_catalog.now()
      where v.subject_profile_id = old.id and v.method = 'stripe_connect_kyc' and v.provider_ref = pg_catalog.btrim(old.stripe_connect_id)
        and v.status in ('pending', 'verified', 'requires_input');
    end if;
  elsif tg_table_name = 'custodial_accounts' then
    if (pg_catalog.btrim(new.stripe_connect_id) is distinct from pg_catalog.btrim(old.stripe_connect_id)
        or new.guardian_id is distinct from old.guardian_id)
       and old.stripe_connect_id is not null then
      update public.payee_verifications v set status = 'superseded', superseded_at = pg_catalog.now()
      where v.subject_profile_id = old.guardian_id and v.method = 'stripe_connect_kyc' and v.provider_ref = pg_catalog.btrim(old.stripe_connect_id)
        and v.status in ('pending', 'verified', 'requires_input');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.stripe_connect_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_stripe_connect_account(uuid, uuid, uuid, text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.payee_changes_supersede() from public, anon, authenticated;
grant execute on function public.stripe_connect_context(uuid, uuid) to service_role;
grant execute on function public.save_stripe_connect_account(uuid, uuid, uuid, text, text, boolean, boolean) to service_role;
grant execute on function public.payee_changes_supersede() to service_role;
