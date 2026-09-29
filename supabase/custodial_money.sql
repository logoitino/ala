-- Custodial money rules (owner decision, 2026-09-29). Canonical copy lives in
-- apps/mobile/src/backend/db/schema.sql; this standalone file is for applying the change by hand
-- to an existing project. Safe to re-run.
--
-- The rules, in plain words (docs/PARENT_PAYEE_CONNECT_DESIGN.md §7):
--   1. A guardian holds one payout account per athlete, and it holds only that athlete's money
--      (custodial_accounts is keyed by player_id; a Stripe account can serve only one athlete).
--   2. The athlete sees every gift and every withdrawal request (get_custodial_summary).
--   3. A guardian cannot withdraw without the athlete approving it in the app
--      (request_custodial_withdrawal -> pending_athlete -> decide_custodial_withdrawal).
--   4. At the handover age (default 18; admin sets 19 or 21 where counsel says the state requires
--      it) control passes to the athlete automatically: the guardian can no longer request, and the
--      athlete can move the money themselves. "Automatically" = computed from the birth date on
--      every call, so no scheduled job is needed.
--   5. Guardians are strongly encouraged to pay out to a bank account in the athlete's name
--      (bank_in_athlete_name), and stay in charge until the handover age.
--
-- Nothing here moves money. Approved requests wait until payouts open (ROADMAP Phase 1a +
-- Release waves Wave 1 checklist); POST /api/create-payout stays hard-blocked (503) until then.
-- Only a *verified* athlete account can approve: profiles.player_id alone is client-writable
-- (lib/teams.ts links by name match), so it cannot be trusted to identify the athlete.

create table if not exists public.custodial_accounts (
  player_id uuid primary key references public.players (id) on delete restrict,
  guardian_id uuid not null references public.profiles (id) on delete restrict,
  -- Filled by the parent-payee Connect flow once built (design §2). Unique: one Stripe account
  -- can never hold two athletes' money.
  stripe_connect_id text unique,
  payouts_enabled boolean not null default false,
  -- Guardian's own statement that the payout bank account is in the athlete's name (or a
  -- custodial account titled for them). Encouraged, not required. Null = not answered yet.
  bank_in_athlete_name boolean,
  handover_age smallint not null default 18 check (handover_age between 18 and 21),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists custodial_accounts_guardian_idx on public.custodial_accounts (guardian_id);

-- Kept apart from players/profiles on purpose: only the guardian, the athlete and admins can read
-- it, and it exists only to compute the handover date. Collected from the guardian at custodial
-- setup, never at sign-up (the 13+ checkbox stays the only age signal for everyone else).
create table if not exists public.athlete_birthdates (
  player_id uuid primary key references public.players (id) on delete cascade,
  birth_date date not null,
  entered_by uuid references public.profiles (id) on delete set null,
  entered_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.custodial_withdrawals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  requested_role text not null check (requested_role in ('guardian', 'athlete')),
  -- Same interim per-row cap as tips (Rounds 24/26). Checked against a real balance once the
  -- Phase 1a ledger exists.
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000),
  note text check (note is null or char_length(note) <= 280),
  status text not null default 'pending_athlete'
    check (status in ('pending_athlete', 'approved', 'declined', 'cancelled', 'paid')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists custodial_withdrawals_player_idx
  on public.custodial_withdrawals (player_id, created_at desc);
-- One open request at a time per athlete, so an athlete is never asked to approve a pile.
create unique index if not exists custodial_withdrawals_one_pending
  on public.custodial_withdrawals (player_id) where status = 'pending_athlete';

-- Who is the caller to this athlete's money? 'admin' | 'guardian' | 'athlete' | null.
create or replace function public.custodial_role(target_player_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
begin
  if auth.uid() is null or target_player_id is null then
    return null;
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    return null;
  end if;
  if public.current_user_role() = 'admin' then
    return 'admin';
  end if;
  if exists (select 1 from public.players pl where pl.id = target_player_id and pl.guardian_id = me.id) then
    return 'guardian';
  end if;
  if me.player_id = target_player_id and coalesce(me.verification_status, 'unverified') = 'verified' then
    return 'athlete';
  end if;
  return null;
end;
$$;

revoke all on function public.custodial_role(uuid) from public;
grant execute on function public.custodial_role(uuid) to authenticated;

-- Birth date + handover age. Null until the guardian has entered a birth date.
create or replace function public.athlete_handover_date(target_player_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (b.birth_date + make_interval(years => coalesce(ca.handover_age, 18)::int))::date
  from public.athlete_birthdates b
  left join public.custodial_accounts ca on ca.player_id = b.player_id
  where b.player_id = target_player_id;
$$;

-- True once the athlete has reached the handover age. Unknown birth date = false (the guardian
-- stays in charge, and the athlete still approves every withdrawal).
create or replace function public.athlete_controls_money(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.athlete_handover_date(target_player_id) <= current_date, false);
$$;

-- Internal helpers only (called from the SECURITY DEFINER RPCs below). Not granted to clients:
-- a handover date would reveal a minor's birth date to anyone who asked.
revoke all on function public.athlete_handover_date(uuid) from public, anon, authenticated;
revoke all on function public.athlete_controls_money(uuid) from public, anon, authenticated;

alter table public.custodial_accounts enable row level security;
alter table public.athlete_birthdates enable row level security;
alter table public.custodial_withdrawals enable row level security;

drop policy if exists "Custodial parties read account" on public.custodial_accounts;
create policy "Custodial parties read account"
  on public.custodial_accounts for select
  to authenticated
  using (public.custodial_role(player_id) is not null);

drop policy if exists "Custodial parties read birthdate" on public.athlete_birthdates;
create policy "Custodial parties read birthdate"
  on public.athlete_birthdates for select
  to authenticated
  using (public.custodial_role(player_id) is not null);

drop policy if exists "Custodial parties read withdrawals" on public.custodial_withdrawals;
create policy "Custodial parties read withdrawals"
  on public.custodial_withdrawals for select
  to authenticated
  using (public.custodial_role(player_id) is not null);

-- Reads only. Every write goes through the SECURITY DEFINER RPCs below.
revoke all on public.custodial_accounts from anon, authenticated;
revoke all on public.athlete_birthdates from anon, authenticated;
revoke all on public.custodial_withdrawals from anon, authenticated;
grant select on public.custodial_accounts to authenticated;
grant select on public.athlete_birthdates to authenticated;
grant select on public.custodial_withdrawals to authenticated;

-- Guardian opens (or updates) the athlete's custodial record. The birth date can be entered once;
-- after that only an admin can correct it, so the handover date cannot be pushed back.
create or replace function public.guardian_setup_custodial(
  target_player_id uuid,
  athlete_birth_date date,
  bank_in_athlete_name boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
  on_file date;
begin
  if public.custodial_role(target_player_id) is distinct from 'guardian' then
    raise exception 'Only this athlete''s linked guardian can set up their account';
  end if;
  select id into caller from public.profiles where user_id = auth.uid() limit 1;

  select birth_date into on_file from public.athlete_birthdates where player_id = target_player_id;
  if on_file is null then
    if athlete_birth_date is null then
      raise exception 'Enter the athlete''s date of birth';
    end if;
    if athlete_birth_date > current_date - interval '5 years'
       or athlete_birth_date < current_date - interval '30 years' then
      raise exception 'That date of birth does not look right';
    end if;
    insert into public.athlete_birthdates (player_id, birth_date, entered_by)
    values (target_player_id, athlete_birth_date, caller);
  elsif athlete_birth_date is not null and athlete_birth_date <> on_file then
    raise exception 'A date of birth is already on file. Ask Tapua''i support to correct it';
  end if;

  if public.athlete_controls_money(target_player_id) then
    raise exception 'This athlete has reached the handover age and manages their own money';
  end if;

  insert into public.custodial_accounts (player_id, guardian_id, bank_in_athlete_name)
  values (target_player_id, caller, bank_in_athlete_name)
  on conflict (player_id) do update
    set bank_in_athlete_name = coalesce(excluded.bank_in_athlete_name, public.custodial_accounts.bank_in_athlete_name),
        updated_at = timezone('utc', now())
    where public.custodial_accounts.guardian_id = caller;

  if not found then
    raise exception 'This athlete''s account belongs to a different guardian';
  end if;
end;
$$;

revoke all on function public.guardian_setup_custodial(uuid, date, boolean) from public;
grant execute on function public.guardian_setup_custodial(uuid, date, boolean) to authenticated;

-- Admin-only: set the handover age for the athlete's state (counsel's call) or correct a birth date.
create or replace function public.admin_set_custodial_terms(
  target_player_id uuid,
  new_handover_age smallint default null,
  corrected_birth_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin required';
  end if;
  if new_handover_age is not null then
    update public.custodial_accounts
    set handover_age = new_handover_age, updated_at = timezone('utc', now())
    where player_id = target_player_id;
    if not found then
      raise exception 'No custodial account for this athlete';
    end if;
  end if;
  if corrected_birth_date is not null then
    insert into public.athlete_birthdates (player_id, birth_date, entered_by)
    values (
      target_player_id,
      corrected_birth_date,
      (select id from public.profiles where user_id = auth.uid() limit 1)
    )
    on conflict (player_id) do update
      set birth_date = excluded.birth_date,
          entered_by = excluded.entered_by,
          entered_at = timezone('utc', now());
  end if;
end;
$$;

revoke all on function public.admin_set_custodial_terms(uuid, smallint, date) from public;
grant execute on function public.admin_set_custodial_terms(uuid, smallint, date) to authenticated;

-- Before the handover age: the guardian asks, the athlete approves.
-- After it: the guardian can no longer ask; the athlete moves their own money (auto-approved).
create or replace function public.request_custodial_withdrawal(
  target_player_id uuid,
  amount_cents integer,
  note text default null
)
returns public.custodial_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text := public.custodial_role(target_player_id);
  caller uuid;
  req public.custodial_withdrawals;
  in_control boolean := public.athlete_controls_money(target_player_id);
begin
  select id into caller from public.profiles where user_id = auth.uid() limit 1;
  if not exists (select 1 from public.custodial_accounts where player_id = target_player_id) then
    raise exception 'No payout account has been set up for this athlete yet';
  end if;

  if role_name = 'guardian' then
    if in_control then
      raise exception 'This athlete has reached the handover age. The money is theirs to move now';
    end if;
    insert into public.custodial_withdrawals (player_id, requested_by, requested_role, amount_cents, note, status)
    values (target_player_id, caller, 'guardian', amount_cents, nullif(trim(note), ''), 'pending_athlete')
    returning * into req;
  elsif role_name = 'athlete' then
    if not in_control then
      raise exception 'Your guardian manages withdrawals until your handover date. You approve each one';
    end if;
    insert into public.custodial_withdrawals (
      player_id, requested_by, requested_role, amount_cents, note, status, decided_by, decided_at
    )
    values (
      target_player_id, caller, 'athlete', amount_cents, nullif(trim(note), ''), 'approved',
      caller, timezone('utc', now())
    )
    returning * into req;
  else
    raise exception 'Not allowed';
  end if;

  return req;
exception
  when unique_violation then
    raise exception 'There is already a request waiting on the athlete';
end;
$$;

revoke all on function public.request_custodial_withdrawal(uuid, integer, text) from public;
grant execute on function public.request_custodial_withdrawal(uuid, integer, text) to authenticated;

-- Only the (verified) athlete can approve or decline a guardian's request.
create or replace function public.decide_custodial_withdrawal(request_id uuid, approve boolean)
returns public.custodial_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.custodial_withdrawals;
begin
  select * into req from public.custodial_withdrawals where id = request_id;
  if req.id is null then
    raise exception 'Request not found';
  end if;
  if public.custodial_role(req.player_id) is distinct from 'athlete' then
    raise exception 'Only the athlete can approve this';
  end if;
  if req.status <> 'pending_athlete' then
    raise exception 'This request has already been decided';
  end if;

  update public.custodial_withdrawals
  set
    status = case when coalesce(approve, false) then 'approved' else 'declined' end,
    decided_by = (select id from public.profiles where user_id = auth.uid() limit 1),
    decided_at = timezone('utc', now())
  where id = request_id
  returning * into req;
  return req;
end;
$$;

revoke all on function public.decide_custodial_withdrawal(uuid, boolean) from public;
grant execute on function public.decide_custodial_withdrawal(uuid, boolean) to authenticated;

create or replace function public.cancel_custodial_withdrawal(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.custodial_withdrawals
  set status = 'cancelled', decided_at = timezone('utc', now())
  where id = request_id
    and status = 'pending_athlete'
    and requested_by = (select id from public.profiles where user_id = auth.uid() limit 1);
  if not found then
    raise exception 'Only an open request you made can be cancelled';
  end if;
end;
$$;

revoke all on function public.cancel_custodial_withdrawal(uuid) from public;
grant execute on function public.cancel_custodial_withdrawal(uuid) to authenticated;

-- Everything the guardian or athlete needs on one screen. Returns null for anyone else.
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

revoke all on function public.get_custodial_summary(uuid) from public;
grant execute on function public.get_custodial_summary(uuid) to authenticated;
