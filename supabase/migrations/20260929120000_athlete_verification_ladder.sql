-- =============================================================================================
-- Athlete verification ladder — the school confirms each athlete in person
-- =============================================================================================
-- Design: docs/ATHLETE_VERIFICATION_DESIGN.md (owner decisions 2026-09-29, §0 and §4).
--
-- What changes:
--   1. Anyone can still claim to be an athlete. The claim is visible as "verification pending".
--   2. The shared school team code no longer verifies anyone. It only records the school.
--   3. An athletic director or coach, added by a Tapua'i admin, gets a private link. It opens a
--      form in the app. To confirm a student they must type the 6-digit code shown on that
--      student's phone — proof that they met in person — and sign with their name.
--   4. Only verification links an account to a `players` row. Clients can no longer write
--      `profiles.is_verified`, `verification_status` or `player_id` (they could, until now,
--      with one raw REST update).
--   5. Admin approval stamps the requester only. It used to stamp every profile with the same
--      name. `athlete_is_varsity_verified` and tag confirmation stop trusting name matches.
--   6. Existing accounts that were verified only by a shared team code go back to "pending".
--
-- Money: gifts to an athlete who is not verified are held. Payouts are blocked everywhere today
-- (503), and any future payout path must call `athlete_payout_allowed(player_id)` first.
--
-- Roll back: re-apply the previous definitions of redeem_team_code, request_athlete_verification,
-- athlete_is_varsity_verified, can_confirm_player_tag and confirm_reel_player_tag from git
-- history (commit 7afbef6, apps/mobile/src/backend/db/schema.sql), then
--   drop trigger guard_profiles_verification on public.profiles;
-- The new tables and columns are additive and can stay.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Claim records: extend verification_requests (the admin desk already reads it)
-- ---------------------------------------------------------------------------------------------

alter table public.verification_requests add column if not exists sport text;
alter table public.verification_requests add column if not exists class_year text;
alter table public.verification_requests add column if not exists jersey text;
alter table public.verification_requests add column if not exists meet_code_hash text;
alter table public.verification_requests add column if not exists meet_code_expires_at timestamptz;
alter table public.verification_requests add column if not exists meet_code_attempts integer not null default 0;
alter table public.verification_requests add column if not exists confirmer_id uuid;
alter table public.verification_requests add column if not exists confirmer_name text;
alter table public.verification_requests add column if not exists decided_at timestamptz;
alter table public.verification_requests add column if not exists decision_note text;

-- Statuses: pending (waiting on the school) · approved · rejected · disputed (two accounts claim
-- the same athlete; admin decides) · revoked (verification taken back). NOT VALID so legacy rows
-- with other values do not block the migration.
do $$
begin
  alter table public.verification_requests
    add constraint verification_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'disputed', 'revoked')) not valid;
exception
  when duplicate_object then null;
end $$;

-- One open claim per account. Close older duplicates first so the unique index can be built.
update public.verification_requests v
set status = 'rejected', decision_note = 'Superseded by a newer request (2026-09-29 migration)'
where v.status = 'pending'
  and v.requester_user_id is not null
  and exists (
    select 1 from public.verification_requests newer
    where newer.requester_user_id = v.requester_user_id
      and newer.status = 'pending'
      and (newer.created_at, newer.id) > (v.created_at, v.id)
  );

create unique index if not exists verification_requests_one_open_per_account
  on public.verification_requests (requester_user_id)
  where status in ('pending', 'disputed');

create index if not exists verification_requests_school_pending_idx
  on public.verification_requests (school_id)
  where status = 'pending';

create index if not exists verification_requests_player_idx
  on public.verification_requests (player_id);

-- ---------------------------------------------------------------------------------------------
-- 2. School confirmers: athletic directors and coaches allowed to confirm athletes
-- ---------------------------------------------------------------------------------------------
-- Only the SHA-256 of the link token is stored. The token itself is returned once, to the admin
-- who creates the confirmer, and sent to the AD/coach at their school email.

create table if not exists public.school_confirmers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools_and_teams (id) on delete cascade,
  full_name text not null,
  email text not null,
  staff_role text not null check (staff_role in ('athletic_director', 'coach')),
  -- null = every sport at the school (usual for an AD); otherwise the coach's sport only.
  sport text,
  token_hash text not null unique,
  active boolean not null default true,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '1 year'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz
);

do $$
begin
  alter table public.verification_requests
    add constraint verification_requests_confirmer_fk
    foreign key (confirmer_id) references public.school_confirmers (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

alter table public.school_confirmers enable row level security;
revoke all on public.school_confirmers from anon, authenticated;
grant select on public.school_confirmers to authenticated;

drop policy if exists "Admins read school confirmers" on public.school_confirmers;
create policy "Admins read school confirmers"
  on public.school_confirmers for select
  using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------------------------

-- The verification RPCs below set this transaction-local flag right before they write the
-- guarded columns; guard_profiles_verification lets those writes through and nothing else.
create or replace function public.allow_verification_write()
returns void
language sql
as $$
  select set_config('app.tapuai_verification_write', 'true', true);
$$;

revoke all on function public.allow_verification_write() from public, anon, authenticated;

create or replace function public.hash_secret(raw text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(raw, ''), 'sha256'), 'hex');
$$;

revoke all on function public.hash_secret(text) from public, anon, authenticated;

-- True for a direct database session (SQL Editor, migrations) or an admin app session.
create or replace function public.is_admin_or_db()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() is null or auth.role() = 'service_role' or public.current_user_role() = 'admin';
$$;

revoke all on function public.is_admin_or_db() from public, anon;
grant execute on function public.is_admin_or_db() to authenticated;

-- The one question every payout path must ask. A player row can receive gifts before anyone is
-- verified; the money is only released once an account verified by the school is linked to it.
create or replace function public.athlete_payout_allowed(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.player_id = target_player_id
      and p.verification_status = 'verified'
      and coalesce(p.is_verified, false)
  );
$$;

grant execute on function public.athlete_payout_allowed(uuid) to authenticated;

-- Replaces the old version, which also counted an unlinked profile whose name matched.
create or replace function public.athlete_is_varsity_verified(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.athlete_payout_allowed(target_player_id);
$$;

grant execute on function public.athlete_is_varsity_verified(uuid) to anon, authenticated;

-- Marks `me` verified and links the player row. Callers have already checked who may do this.
create or replace function public.apply_verification(req public.verification_requests)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.allow_verification_write();
  update public.profiles
  set
    is_verified = true,
    verification_status = 'verified',
    player_id = coalesce(req.player_id, player_id),
    school_id = coalesce(req.school_id, school_id),
    roles = (
      select coalesce(array_agg(distinct r), array['fan', 'athlete']::text[])
      from unnest(coalesce(roles, array['fan']::text[]) || array['athlete', 'fan']::text[]) as r
    ),
    role = case when role in ('admin', 'athlete') then role else 'athlete' end
  where id = req.requester_user_id;
end;
$$;

revoke all on function public.apply_verification(public.verification_requests) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Existing data: undo verification that only a shared team code granted, and self-links
-- ---------------------------------------------------------------------------------------------
-- An account keeps "verified" only if an admin approved a request for it (team_code is null on
-- admin approvals). Everyone else goes back to pending with an open request, so they show up in
-- their school's confirmation queue. `player_id` on an unverified account was self-set; it moves
-- onto the request as the athlete they claim to be.

do $$
declare
  downgraded integer;
  unlinked integer;
begin
  with keep as (
    select distinct p.id
    from public.profiles p
    join public.verification_requests v
      on v.status = 'approved'
     and v.team_code is null
     and (v.requester_user_id = p.id or (p.player_id is not null and v.player_id = p.player_id))
  ),
  targets as (
    select p.id, p.full_name, p.player_id, p.school_id, p.athlete_sport, p.athlete_class_year, p.athlete_jersey
    from public.profiles p
    where p.verification_status = 'verified'
      and not coalesce(p.is_admin, false)
      and not (coalesce(p.roles, array[]::text[]) @> array['admin']::text[])
      and p.id not in (select id from keep)
  ),
  reopened as (
    insert into public.verification_requests
      (player_id, full_name, status, notes, requester_user_id, school_id, sport, class_year, jersey)
    select t.player_id, coalesce(t.full_name, 'Athlete'), 'pending',
           'Re-opened 2026-09-29: a shared team code no longer verifies on its own',
           t.id, t.school_id, t.athlete_sport, t.athlete_class_year, t.athlete_jersey
    from targets t
    where not exists (
      select 1 from public.verification_requests o
      where o.requester_user_id = t.id and o.status in ('pending', 'disputed')
    )
    returning 1
  )
  update public.profiles p
  set is_verified = false, verification_status = 'pending'
  from targets t
  where p.id = t.id;
  get diagnostics downgraded = row_count;

  -- Carry each unverified self-link onto the account's open request, then clear it.
  update public.verification_requests v
  set player_id = p.player_id
  from public.profiles p
  where v.requester_user_id = p.id
    and v.status in ('pending', 'disputed')
    and v.player_id is null
    and p.player_id is not null
    and p.verification_status <> 'verified';

  update public.profiles
  set player_id = null
  where player_id is not null
    and verification_status <> 'verified';
  get diagnostics unlinked = row_count;

  raise notice 'verification ladder: % team-code-only accounts set to pending, % self-links cleared',
    downgraded, unlinked;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Guard: clients cannot write the verification columns
-- ---------------------------------------------------------------------------------------------
-- Separate from guard_profiles_admin_escalation so it can be reviewed and rolled back on its own.

create or replace function public.guard_profiles_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_or_db()
     or coalesce(current_setting('app.tapuai_verification_write', true), '') = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_verified, false)
       or coalesce(new.verification_status, 'unverified') <> 'unverified'
       or new.player_id is not null then
      raise exception 'Verification can only be set by your school or Tapua''i.';
    end if;
  elsif new.is_verified is distinct from old.is_verified
     or new.verification_status is distinct from old.verification_status
     or new.player_id is distinct from old.player_id then
    raise exception 'Verification can only be set by your school or Tapua''i.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profiles_verification on public.profiles;
create trigger guard_profiles_verification
  before insert or update on public.profiles
  for each row
  execute function public.guard_profiles_verification();

-- ---------------------------------------------------------------------------------------------
-- 6. Athlete side: claim, team code, in-person code, status
-- ---------------------------------------------------------------------------------------------

-- Opens (or updates) the caller's claim. `target_player_id` is the roster row they say is them;
-- it is recorded on the claim and only linked when the school confirms.
create or replace function public.claim_athlete(target_player_id uuid default null, request_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  open_req public.verification_requests%rowtype;
  next_status text := 'pending';
  clash_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    raise exception 'Profile required';
  end if;
  if me.verification_status = 'verified' then
    return jsonb_build_object('ok', true, 'verification_status', 'verified', 'already', true);
  end if;
  if target_player_id is not null
     and not exists (select 1 from public.players where id = target_player_id) then
    target_player_id := null;
  end if;

  -- Someone else is already verified as this athlete, or has an open claim on them: freeze.
  if target_player_id is not null then
    if exists (
      select 1 from public.profiles p
      where p.player_id = target_player_id and p.verification_status = 'verified' and p.id <> me.id
    ) then
      next_status := 'disputed';
    else
      select v.id into clash_id
      from public.verification_requests v
      where v.player_id = target_player_id
        and v.status in ('pending', 'disputed')
        and v.requester_user_id is distinct from me.id
      limit 1;
      if clash_id is not null then
        next_status := 'disputed';
        update public.verification_requests
        set status = 'disputed', meet_code_hash = null, meet_code_expires_at = null
        where player_id = target_player_id and status = 'pending' and requester_user_id is distinct from me.id;
      end if;
    end if;
  end if;

  select * into open_req
  from public.verification_requests
  where requester_user_id = me.id and status in ('pending', 'disputed')
  limit 1;

  if open_req.id is null then
    insert into public.verification_requests
      (player_id, full_name, status, notes, requester_user_id, school_id, sport, class_year, jersey)
    values
      (target_player_id, coalesce(nullif(btrim(me.full_name), ''), 'Athlete'), next_status,
       coalesce(nullif(btrim(coalesce(request_notes, '')), ''), 'Athlete claim'),
       me.id, me.school_id, me.athlete_sport, me.athlete_class_year, me.athlete_jersey)
    returning * into open_req;
  else
    update public.verification_requests
    set
      player_id = coalesce(target_player_id, player_id),
      full_name = coalesce(nullif(btrim(me.full_name), ''), full_name),
      school_id = coalesce(me.school_id, school_id),
      sport = coalesce(me.athlete_sport, sport),
      class_year = coalesce(me.athlete_class_year, class_year),
      jersey = coalesce(me.athlete_jersey, jersey),
      status = case when next_status = 'disputed' then 'disputed' else status end,
      notes = coalesce(nullif(btrim(coalesce(request_notes, '')), ''), notes)
    where id = open_req.id
    returning * into open_req;
  end if;

  perform public.allow_verification_write();
  update public.profiles
  set
    verification_status = 'pending',
    is_verified = false,
    roles = (
      select coalesce(array_agg(distinct r), array['fan', 'athlete']::text[])
      from unnest(coalesce(roles, array['fan']::text[]) || array['athlete', 'fan']::text[]) as r
    ),
    role = case when role in ('admin', 'athlete') then role else 'athlete' end
  where id = me.id;

  return jsonb_build_object(
    'ok', true,
    'verification_status', 'pending',
    'request_status', open_req.status,
    'school_id', open_req.school_id
  );
end;
$$;

grant execute on function public.claim_athlete(uuid, text) to authenticated;

-- Kept for existing clients ("request approval" button): same as a claim with no roster row.
create or replace function public.request_athlete_verification(request_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
begin
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is not null and me.legal_terms_accepted_at is null then
    raise exception 'legal acknowledgement required';
  end if;
  return public.claim_athlete(null, request_notes);
end;
$$;

grant execute on function public.request_athlete_verification(text) to authenticated;

-- The team code now only proves which school; the school still confirms the athlete.
-- Same lockout as before (5 wrong guesses → 15 minutes).
create or replace function public.redeem_team_code(raw_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n text := public.normalize_team_code(raw_code);
  school_key text := public.team_code_school_key(raw_code);
  parts text[];
  sport_name text;
  me public.profiles%rowtype;
  school public.schools_and_teams%rowtype;
  claim jsonb;
  max_attempts constant integer := 5;
  lockout_minutes constant integer := 15;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if n = '' then
    raise exception 'Team code required';
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    raise exception 'Profile required';
  end if;
  if me.legal_terms_accepted_at is null then
    raise exception 'legal acknowledgement required';
  end if;
  if me.team_code_locked_until is not null and me.team_code_locked_until > timezone('utc', now()) then
    raise exception 'Too many attempts. Try again later.';
  end if;

  perform set_config('app.tapuai_team_code_write', 'true', true);

  select * into school
  from public.schools_and_teams s
  where upper(btrim(coalesce(s.team_code, ''))) in (n, school_key)
  limit 1;

  if school.id is null then
    -- Returned, not raised, so the fail-count increment commits (see the Round 31 note in schema.sql).
    update public.profiles
    set
      team_code_fail_count = coalesce(team_code_fail_count, 0) + 1,
      team_code_locked_until = case
        when coalesce(team_code_fail_count, 0) + 1 >= max_attempts
          then timezone('utc', now()) + (lockout_minutes || ' minutes')::interval
        else team_code_locked_until
      end
    where id = me.id;
    return jsonb_build_object('ok', false, 'error', 'Unknown team code');
  end if;

  parts := string_to_array(n, '-');
  if coalesce(array_length(parts, 1), 0) >= 3 then
    sport_name := public.sport_from_team_code_token(parts[2]);
  end if;

  update public.profiles
  set
    team_code_fail_count = 0,
    team_code_locked_until = null,
    school_id = school.id,
    athlete_division = coalesce(nullif(athlete_division, ''), school.division),
    athlete_sport = coalesce(sport_name, athlete_sport),
    active_role = 'athlete'
  where id = me.id;

  if me.verification_status = 'verified' then
    return jsonb_build_object('ok', true, 'verification_status', 'verified', 'already', true,
      'school_id', school.id, 'school_name', school.name, 'sport', sport_name);
  end if;

  claim := public.claim_athlete(null, 'School code accepted');
  update public.verification_requests
  set team_code = n
  where requester_user_id = me.id and status in ('pending', 'disputed');

  return jsonb_build_object(
    'ok', true,
    'verification_status', 'pending',
    'request_status', claim ->> 'request_status',
    'school_id', school.id,
    'school_name', school.name,
    'sport', sport_name
  );
end;
$$;

grant execute on function public.redeem_team_code(text) to authenticated;

-- The athlete shows this code to their AD or coach, who types it into the confirmation form.
-- Valid 30 minutes; asking again replaces it.
create or replace function public.start_school_check()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me public.profiles%rowtype;
  req public.verification_requests%rowtype;
  code text;
  expires timestamptz := timezone('utc', now()) + interval '30 minutes';
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  select * into req
  from public.verification_requests
  where requester_user_id = me.id and status in ('pending', 'disputed')
  limit 1;
  if req.id is null then
    return jsonb_build_object('ok', false, 'error', 'Claim your athlete status first.');
  end if;
  if req.status = 'disputed' then
    return jsonb_build_object('ok', false, 'error', 'Another account also claims this athlete. Tapua''i is reviewing it.');
  end if;
  if req.school_id is null then
    return jsonb_build_object('ok', false, 'error', 'Add your school first.');
  end if;

  code := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  update public.verification_requests
  set meet_code_hash = public.hash_secret(code), meet_code_expires_at = expires, meet_code_attempts = 0
  where id = req.id;

  return jsonb_build_object('ok', true, 'code', code, 'expires_at', expires);
end;
$$;

grant execute on function public.start_school_check() to authenticated;

-- Everything the athlete's own verification card needs.
create or replace function public.get_my_verification()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  req public.verification_requests%rowtype;
  school_name text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    return null;
  end if;
  select * into req
  from public.verification_requests
  where requester_user_id = me.id
  order by (status in ('pending', 'disputed')) desc, created_at desc
  limit 1;
  select s.name into school_name
  from public.schools_and_teams s
  where s.id = coalesce(req.school_id, me.school_id);

  return jsonb_build_object(
    'verification_status', coalesce(me.verification_status, 'unverified'),
    'request_status', req.status,
    'school_name', school_name,
    'has_school', coalesce(req.school_id, me.school_id) is not null,
    'sport', coalesce(req.sport, me.athlete_sport),
    'code_expires_at', case when req.meet_code_expires_at > timezone('utc', now()) then req.meet_code_expires_at end,
    'confirmer_name', case when req.status = 'approved' then req.confirmer_name end,
    'decision_note', case when req.status in ('rejected', 'revoked') then req.decision_note end
  );
end;
$$;

grant execute on function public.get_my_verification() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. School side: the confirmation form (no account; the link token is the credential)
-- ---------------------------------------------------------------------------------------------

create or replace function public.school_confirmer_from_token(confirm_token text)
returns public.school_confirmers
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from public.school_confirmers c
  where c.token_hash = public.hash_secret(btrim(coalesce(confirm_token, '')))
    and c.active
    and c.expires_at > timezone('utc', now())
  limit 1;
$$;

revoke all on function public.school_confirmer_from_token(text) from public, anon, authenticated;

create or replace function public.get_school_confirmation_queue(confirm_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.school_confirmers%rowtype;
  school_name text;
  queue jsonb;
begin
  c := public.school_confirmer_from_token(confirm_token);
  if c.id is null then
    return jsonb_build_object('ok', false, 'error', 'This link is not active. Ask Tapua''i for a new one.');
  end if;
  select s.name into school_name from public.schools_and_teams s where s.id = c.school_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id,
      'full_name', v.full_name,
      'sport', v.sport,
      'class_year', v.class_year,
      'jersey', v.jersey,
      'created_at', v.created_at,
      'code_ready', v.meet_code_expires_at > timezone('utc', now())
    ) order by v.created_at), '[]'::jsonb)
  into queue
  from public.verification_requests v
  where v.school_id = c.school_id
    and v.status = 'pending'
    and (c.sport is null or v.sport is null or lower(v.sport) = lower(c.sport));

  return jsonb_build_object(
    'ok', true,
    'confirmer_name', c.full_name,
    'staff_role', c.staff_role,
    'sport', c.sport,
    'school_name', school_name,
    'requests', queue
  );
end;
$$;

grant execute on function public.get_school_confirmation_queue(text) to anon, authenticated;

-- approve = true needs the student's current 6-digit code; approve = false ("not on my roster")
-- does not. Wrong codes are counted on the claim; after 5 the code is void and the student asks
-- for a new one. Failures are returned, not raised, so the attempt count commits.
create or replace function public.school_confirm_athlete(
  confirm_token text,
  request_id uuid,
  approve boolean,
  meet_code text default null,
  confirmer_signature text default null,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.school_confirmers%rowtype;
  req public.verification_requests%rowtype;
  signature text := nullif(btrim(coalesce(confirmer_signature, '')), '');
  max_attempts constant integer := 5;
begin
  c := public.school_confirmer_from_token(confirm_token);
  if c.id is null then
    return jsonb_build_object('ok', false, 'error', 'This link is not active. Ask Tapua''i for a new one.');
  end if;

  select * into req from public.verification_requests where id = request_id for update;
  if req.id is null or req.school_id is distinct from c.school_id then
    return jsonb_build_object('ok', false, 'error', 'This student is not waiting on your school.');
  end if;
  if req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'This request was already handled.');
  end if;
  if c.sport is not null and req.sport is not null and lower(req.sport) <> lower(c.sport) then
    return jsonb_build_object('ok', false, 'error', 'This student is in a different sport.');
  end if;
  if signature is null then
    return jsonb_build_object('ok', false, 'error', 'Type your full name to sign.');
  end if;

  update public.school_confirmers set last_used_at = timezone('utc', now()) where id = c.id;

  if not approve then
    update public.verification_requests
    set status = 'rejected', confirmer_id = c.id, confirmer_name = signature,
        decided_at = timezone('utc', now()), meet_code_hash = null, meet_code_expires_at = null,
        decision_note = coalesce(nullif(btrim(coalesce(note, '')), ''), 'Not on the school roster')
    where id = req.id;
    perform public.allow_verification_write();
    update public.profiles
    set verification_status = 'unverified', is_verified = false
    where id = req.requester_user_id and verification_status <> 'verified';
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  if req.meet_code_hash is null or req.meet_code_expires_at is null
     or req.meet_code_expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'error', 'Ask the student to tap "Show my school code" and read you the new code.');
  end if;
  if public.hash_secret(btrim(coalesce(meet_code, ''))) <> req.meet_code_hash then
    update public.verification_requests
    set
      meet_code_attempts = meet_code_attempts + 1,
      meet_code_hash = case when meet_code_attempts + 1 >= max_attempts then null else meet_code_hash end
    where id = req.id;
    return jsonb_build_object('ok', false, 'error',
      case when req.meet_code_attempts + 1 >= max_attempts
        then 'Too many wrong codes. Ask the student for a new one.'
        else 'That code does not match. Check the student''s screen.' end);
  end if;

  -- Last check before linking: nobody else may already be verified as this athlete.
  if req.player_id is not null and exists (
    select 1 from public.profiles p
    where p.player_id = req.player_id and p.verification_status = 'verified'
      and p.id is distinct from req.requester_user_id
  ) then
    update public.verification_requests set status = 'disputed' where id = req.id;
    return jsonb_build_object('ok', false, 'error', 'Another account is already verified as this athlete. Tapua''i will review it.');
  end if;

  update public.verification_requests
  set status = 'approved', confirmer_id = c.id, confirmer_name = signature,
      decided_at = timezone('utc', now()), meet_code_hash = null, meet_code_expires_at = null,
      decision_note = nullif(btrim(coalesce(note, '')), '')
  where id = req.id
  returning * into req;
  perform public.apply_verification(req);

  return jsonb_build_object('ok', true, 'status', 'approved', 'full_name', req.full_name);
end;
$$;

grant execute on function public.school_confirm_athlete(text, uuid, boolean, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Admin side
-- ---------------------------------------------------------------------------------------------

-- Returns the link token ONCE. Check the person is real staff (school email domain, a call to the
-- school office) before creating them.
create or replace function public.admin_add_school_confirmer(
  target_school_id uuid,
  confirmer_name text,
  confirmer_email text,
  confirmer_role text,
  confirmer_sport text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token text := encode(gen_random_bytes(24), 'hex');
  new_id uuid;
  actor uuid;
begin
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  if nullif(btrim(coalesce(confirmer_name, '')), '') is null
     or nullif(btrim(coalesce(confirmer_email, '')), '') is null then
    raise exception 'Name and school email are required';
  end if;
  select id into actor from public.profiles where user_id = auth.uid() limit 1;

  insert into public.school_confirmers (school_id, full_name, email, staff_role, sport, token_hash, created_by)
  values (target_school_id, btrim(confirmer_name), lower(btrim(confirmer_email)), confirmer_role,
          nullif(btrim(coalesce(confirmer_sport, '')), ''), public.hash_secret(token), actor)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'token', token, 'link', 'alasports://school-confirm?t=' || token);
end;
$$;

grant execute on function public.admin_add_school_confirmer(uuid, text, text, text, text) to authenticated;

create or replace function public.admin_revoke_school_confirmer(confirmer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  update public.school_confirmers set active = false where id = confirmer_id;
end;
$$;

grant execute on function public.admin_revoke_school_confirmer(uuid) to authenticated;

-- Admin override and dispute resolution. Stamps the requester only (the old client-side approve
-- stamped every profile with a matching name).
create or replace function public.admin_decide_verification(request_id uuid, approve boolean, note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.verification_requests%rowtype;
begin
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  select * into req from public.verification_requests where id = request_id for update;
  if req.id is null then
    raise exception 'Request not found';
  end if;

  if not approve then
    update public.verification_requests
    set status = 'rejected', decided_at = timezone('utc', now()), meet_code_hash = null,
        decision_note = coalesce(nullif(btrim(coalesce(note, '')), ''), 'Rejected by Tapua''i')
    where id = req.id;
    if req.requester_user_id is not null then
      perform public.allow_verification_write();
      update public.profiles
      set verification_status = 'unverified', is_verified = false
      where id = req.requester_user_id and verification_status <> 'verified';
    end if;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  if req.requester_user_id is null then
    raise exception 'This request has no account to verify';
  end if;
  if req.player_id is not null and exists (
    select 1 from public.profiles p
    where p.player_id = req.player_id and p.verification_status = 'verified'
      and p.id <> req.requester_user_id
  ) then
    raise exception 'Another account is verified as this athlete. Revoke it first.';
  end if;

  update public.verification_requests
  set status = 'approved', decided_at = timezone('utc', now()), meet_code_hash = null,
      decision_note = coalesce(nullif(btrim(coalesce(note, '')), ''), 'Approved by Tapua''i')
  where id = req.id
  returning * into req;
  perform public.apply_verification(req);

  -- Close any other open claim on the same athlete, and drop those accounts back to unverified.
  if req.player_id is not null then
    perform public.allow_verification_write();
    update public.profiles p
    set verification_status = 'unverified', is_verified = false
    where p.verification_status = 'pending'
      and p.id in (
        select v.requester_user_id from public.verification_requests v
        where v.player_id = req.player_id and v.status in ('pending', 'disputed') and v.id <> req.id
      );
    update public.verification_requests
    set status = 'rejected', decided_at = timezone('utc', now()),
        decision_note = 'Another account was verified as this athlete'
    where player_id = req.player_id and status in ('pending', 'disputed') and id <> req.id;
  end if;

  return jsonb_build_object('ok', true, 'status', 'approved');
end;
$$;

grant execute on function public.admin_decide_verification(uuid, boolean, text) to authenticated;

create or replace function public.admin_revoke_verification(target_profile_id uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  update public.verification_requests
  set status = 'revoked', decided_at = timezone('utc', now()),
      decision_note = coalesce(nullif(btrim(coalesce(note, '')), ''), 'Verification revoked')
  where requester_user_id = target_profile_id and status = 'approved';
  perform public.allow_verification_write();
  update public.profiles
  set is_verified = false, verification_status = 'unverified', player_id = null
  where id = target_profile_id;
end;
$$;

grant execute on function public.admin_revoke_verification(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 9. Tags stop trusting name and jersey matches
-- ---------------------------------------------------------------------------------------------
-- Before: anyone whose profile name or jersey + school matched could confirm an athlete's tags,
-- and confirming a tag linked their account to that athlete. Now: the verified athlete, their
-- guardian, an operator at that school, or an admin; no linking.

create or replace function public.can_confirm_player_tag(target_player_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid;
  role_name text := public.current_user_role();
  athlete public.players%rowtype;
begin
  if target_player_id is null then
    return false;
  end if;
  if role_name = 'admin' then
    return true;
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    return false;
  end if;

  select pr.id into actor from public.profiles pr where pr.user_id = auth.uid() limit 1;
  if actor is null then
    return false;
  end if;

  if athlete.guardian_id is not null and athlete.guardian_id = actor then
    return true;
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = actor and pr.player_id = athlete.id and pr.verification_status = 'verified'
  ) then
    return true;
  end if;

  if role_name = 'operator'
     or exists (
       select 1 from public.profiles pr
       where pr.id = actor and coalesce(pr.roles, array[]::text[]) @> array['operator']::text[]
     )
  then
    if exists (
      select 1
      from public.profiles pr
      join public.schools_and_teams s on s.id = pr.school_id
      where pr.id = actor
        and (lower(s.name) = lower(athlete.school_name) or lower(s.name) = lower(coalesce(athlete.team, '')))
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.confirm_reel_player_tag(target_reel_id uuid, tag_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action text := lower(btrim(coalesce(tag_action, '')));
  clip public.reels%rowtype;
  actor uuid;
  next_status text;
begin
  if action not in ('confirm', 'reject') then
    raise exception 'tag_action must be confirm or reject';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if clip.id is null then
    raise exception 'Highlight not found.';
  end if;
  if clip.player_id is null then
    raise exception 'This clip has no tagged player.';
  end if;
  if not public.can_confirm_player_tag(clip.player_id) then
    raise exception 'Only the verified athlete, their parent, a school operator, or admin can verify this tag.';
  end if;

  select pr.id into actor from public.profiles pr where pr.user_id = auth.uid() limit 1;
  next_status := case when action = 'reject' then 'rejected' else 'confirmed' end;

  update public.reels
  set tag_status = next_status, tag_confirmed_at = timezone('utc', now()), tag_confirmed_by = actor
  where id = target_reel_id
  returning * into clip;

  perform public.sync_live_spotlight_awards();

  return jsonb_build_object(
    'id', clip.id,
    'player_id', clip.player_id,
    'tag_status', clip.tag_status,
    'tag_confirmed_at', clip.tag_confirmed_at
  );
end;
$$;

grant execute on function public.can_confirm_player_tag(uuid) to authenticated;
grant execute on function public.confirm_reel_player_tag(uuid, text) to authenticated;
