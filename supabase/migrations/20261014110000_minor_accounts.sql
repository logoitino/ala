-- Minor accounts: birth month and year, teen-safe defaults, guardian link, signed consent and supervision (MINOR-01,
-- 2026-10-14). Builds on PRIV-01 (20261014090000_profile_privacy.sql, 20261014100000_tag_approval.sql).
--
-- Purpose
--   Owner decisions 2026-10-14 (docs/engineering/design/MINOR_ACCOUNTS_DESIGN.md): a guardian is linked and signs a
--   consent, but is not "total dictatorship"; teens can go solo within the law; sign-up stays fast.
--   1. profiles.birth_year / birth_month (no day) replace the 13+ checkbox. Bands: under_13, teen_13_15, teen_16_17,
--      adult, unknown (accounts made before this). A person reaches an age at the start of the month after their birth
--      month (never early). Under 13: sign-up is refused; a later under-13 entry blocks the account (my_profile_id()
--      stops resolving, profile details cleared, listed for deletion on the admin desk). Self-corrections only to a
--      younger age; older needs support.
--   2. Teens get teen-safe defaults: private, friend requests only from other teens (new value 'teens').
--   3. guardian_links (a teen's one-time invite code, or the admin-set athlete guardian), at most two per teen; either
--      side can end it. guardian_consents keeps the signed form (version, typed name, relationship, permissions,
--      revocation). Consent unlocks a public profile and payouts of donations (athlete_payout_status gains the reason
--      'needs_guardian_consent' for a known minor).
--   4. Supervision: the teen and the guardian see the same summary (settings, counts never who, consent, requests,
--      events). Under-16s: going public or opening friend requests to everyone becomes a guardian approve / decline
--      request. This replaces the PRIV-01 guardian lock (removed from stage 1 before anything was applied).
--   5. Admin: overview, birth correction with a reason, end a link, report, the age-blocked list, a retention purge;
--      switch minors.guardian_links pauses new invites and links (it never loosens a rule).
--   Design review (MINOR_SAFETY, CUSTODIAL, PRIVACY_ENGINEERING, LEGAL; 2026-10-14) applied: a code-linked guardian
--   gets only the supervision summary, never the teen's only-me items (the PRIV-01 'guardian' relationship stays the
--   admin-set athlete guardian); the teen confirms each code link; blocking a guardian ends the link; codes last 48
--   hours; new accounts with no age yet ('not_given') cannot be friended and cannot friend teens; payouts need positive
--   adult evidence or, for a minor, the donations consent of the guardian on record; consent records are append-only,
--   survive account deletion and pin the signed text by hash; a guardian sees only events after they linked;
--   retention purge; under-13 clips are hidden at once.
--   SQL review (RLS_SECURITY + MINOR_SAFETY, 2026-10-14) applied: "off" / "no" / "f" could make a teen public (booleans
--   are now read the way Postgres casts them and the consent rule is re-checked after every save); one refusal message
--   for every account in sign_guardian_consent; a guardian sees nothing until the teen confirms; the guardian on record
--   cannot re-link after the teen ended or blocked them; a closed under-13 account is refused by every table (a
--   restrictive "Closed accounts" policy on every RLS table) and its friendships end; stale waiting links are closed;
--   payouts treat a typed adult age as enough only with the account's own Stripe payouts on (Stripe checks the birth
--   date) and read the claimant's age on the identity path; consent records also refuse truncate and later edits.
--   Future migrations that add an RLS table must add the "Closed accounts" policy too.
--
-- Owner: PROFILE (via ENGINEERING, CTO), with AUTH, ONBOARDING, CUSTODIAL, ADMIN; reviews MINOR_SAFETY,
--   PRIVACY_ENGINEERING, RLS_SECURITY, CUSTODIAL, LEGAL (consent form, LEGAL_BRIEFING row AA), DATA_GOVERNANCE.
-- Needs: 20261014090000 and 20261014100000 first; hash_secret() (athlete verification ladder).
-- Safe to re-run: add column if not exists; create table if not exists; create or replace; drop trigger if exists.
--   After QUIZ-05 (20261015210000) it must NOT be re-run alone: it would replace QUIZ-05's guardian_decide_approval
--   (fun_fact routing) and supervision_json ("trivia_groups", "fun_facts_shared"), so it stops with
--   minor01_rerun_after_quiz05. schema.sql re-applies it with the transaction-local quiz.full_schema, then the QUIZ blocks.
-- Applied: written 2026-10-14, not applied anywhere.

-- 0. Stop a lone re-run after QUIZ-05 (QUIZ-05 security review 2026-10-15, edited in place before any apply) --------------
do $$ begin
  if to_regclass('public.quiz_athlete_facts') is not null and coalesce(current_setting('quiz.full_schema',true),'') <> 'on' then
    raise exception 'minor01_rerun_after_quiz05: 20261014110000_minor_accounts.sql must not be re-run alone after QUIZ-05; re-apply schema.sql or write a reviewed forward migration';
  end if;
end $$;
-- Rollback: drop the five new tables and the functions below; re-apply set_my_privacy, get_my_privacy, request_friend,
--   my_profile_id from 20261014090000 and athlete_payout_status / handle_new_auth_user from
--   schema.sql history; the birth columns can stay (unused).

-- 1. Age -------------------------------------------------------------------------------------------------------------

alter table public.profiles add column if not exists birth_year smallint;
alter table public.profiles add column if not exists birth_month smallint;
alter table public.profiles add column if not exists birth_recorded_at timestamptz;
alter table public.profiles add column if not exists age_blocked_at timestamptz;
-- false for accounts made before this change (their missing age is 'unknown', today's behaviour); true for every new
-- account (a missing age is 'not_given': no friend requests in or to teens, no guardian link, payouts wait).
alter table public.profiles add column if not exists age_check_required boolean;
update public.profiles set age_check_required = false where age_check_required is null;
alter table public.profiles alter column age_check_required set default true;
alter table public.profiles alter column age_check_required set not null;

alter table public.profiles drop constraint if exists profiles_birth_month_check;
alter table public.profiles add constraint profiles_birth_month_check check (
  (birth_year is null and birth_month is null)
  or (birth_month between 1 and 12 and birth_year between 1900 and 2100)
);

-- Whole years old on `on_date`, counting the birthday as the last day of the birth month (up to a month late).
create or replace function public.age_band_from(birth_y integer, birth_m integer, on_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when birth_y is null or birth_m is null then 'unknown'
    else (
      select case when y < 13 then 'under_13' when y < 16 then 'teen_13_15' when y < 18 then 'teen_16_17' else 'adult' end
      from (
        select floor(((extract(year from on_date)::int * 12 + extract(month from on_date)::int) - (birth_y * 12 + birth_m) - 1) / 12.0)::int as y
      ) a
    )
  end;
$$;

create or replace function public.is_minor_band(band text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(band in ('teen_13_15', 'teen_16_17'), false);
$$;

create or replace function public.profile_age_band(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case when p.birth_year is null and p.age_check_required then 'not_given'
                else public.age_band_from(p.birth_year, p.birth_month, current_date) end
    from public.profiles p where p.id = target
  ), 'unknown');
$$;

-- An age-blocked (under-13) account is treated as signed out by every function that asks who the caller is.
create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.user_id = auth.uid() and p.age_blocked_at is null limit 1;
$$;

-- 2. Guardian links, invites, consent, approvals, events ---------------------------------------------------------------

create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  minor_id uuid not null references public.profiles (id) on delete cascade,
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('invite', 'custodial')),
  created_at timestamptz not null default timezone('utc', now()),
  -- An invite link counts only once the teen confirms "Is this your parent or guardian?" (7 days to answer); the
  -- admin-set athlete guardian's link is confirmed when made.
  confirmed_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.profiles (id) on delete set null,
  end_reason text check (end_reason is null or char_length(end_reason) <= 200),
  constraint guardian_links_not_self check (minor_id <> guardian_id)
);
create unique index if not exists guardian_links_one_active on public.guardian_links (minor_id, guardian_id) where ended_at is null;
create index if not exists guardian_links_guardian_idx on public.guardian_links (guardian_id) where ended_at is null;

-- Only the hash of a code is stored; a code works once, for 48 hours, and only the teen's newest one works.
create table if not exists public.guardian_invites (
  code_hash text primary key,
  minor_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null
);
create index if not exists guardian_invites_minor_idx on public.guardian_invites (minor_id, created_at desc);

-- Wrong-code attempts, so an 8-character code cannot be guessed (10 a day per account).
create table if not exists public.guardian_invite_attempts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists guardian_invite_attempts_idx on public.guardian_invite_attempts (profile_id, created_at desc);

-- Append-only signed records (guard_consent_records). They outlive the accounts (ids become null) for the period
-- counsel sets (LEGAL row AA); form_sha256 pins the exact text signed (data/guardianConsent.ts).
create table if not exists public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.guardian_links (id) on delete set null,
  minor_id uuid references public.profiles (id) on delete set null,
  guardian_id uuid references public.profiles (id) on delete set null,
  form_version text not null check (char_length(form_version) <= 40),
  form_sha256 text not null check (form_sha256 ~ '^[0-9a-f]{64}$'),
  -- the typed full name is the signature
  signer_name text not null check (char_length(btrim(signer_name)) between 2 and 120),
  relationship text not null check (relationship in ('parent', 'legal_guardian')),
  allows_donations boolean not null,
  allows_public_profile boolean not null,
  signed_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 200)
);
create unique index if not exists guardian_consents_one_active on public.guardian_consents (link_id) where revoked_at is null;
create index if not exists guardian_consents_minor_idx on public.guardian_consents (minor_id) where revoked_at is null;

create table if not exists public.guardian_approval_requests (
  id uuid primary key default gen_random_uuid(),
  minor_id uuid not null references public.profiles (id) on delete cascade,
  change_key text not null check (change_key in ('account_public', 'friend_requests_everyone')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled', 'expired')),
  requested_at timestamptz not null default timezone('utc', now()),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz
);
create unique index if not exists guardian_approval_one_pending on public.guardian_approval_requests (minor_id, change_key) where status = 'pending';

-- What the teen and their guardian both see. Kept 365 days (trimmed on write, filtered on read, purged by the desk).
create table if not exists public.supervision_events (
  id bigint generated always as identity primary key,
  minor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'age_recorded', 'age_corrected', 'invite_created', 'guardian_linked', 'guardian_unlinked', 'consent_signed',
    'consent_withdrawn', 'settings_changed', 'made_private', 'approval_requested', 'approval_decided', 'approval_cancelled'
  )),
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists supervision_events_minor_idx on public.supervision_events (minor_id, created_at desc);

alter table public.guardian_links enable row level security;
alter table public.guardian_invites enable row level security;
alter table public.guardian_invite_attempts enable row level security;
alter table public.guardian_consents enable row level security;
alter table public.guardian_approval_requests enable row level security;
alter table public.supervision_events enable row level security;

-- 3. Building blocks ---------------------------------------------------------------------------------------------------

create or replace function public.guardian_links_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (c.published -> 'features' ->> 'minors.guardian_links')::boolean
    from public.app_runtime_config c where c.id = 'default'
  ), true);
$$;

-- The consent form text lives in the app (data/guardianConsent.ts); the server accepts only this version and hash.
create or replace function public.guardian_consent_form_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select '2026-10-14-draft'::text;
$$;

create or replace function public.guardian_consent_form_sha256()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'f39f7c23538fcf209fb368bd56f16250ba685cd7c3a4bf23d94be19cea0caa0f'::text;
$$;

create or replace function public.guard_consent_records()
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
    raise exception 'Signed consent records are kept.';
  end if;
  if (new.form_version, new.form_sha256, new.signer_name, new.relationship, new.allows_donations, new.allows_public_profile, new.signed_at)
     is distinct from (old.form_version, old.form_sha256, old.signer_name, old.relationship, old.allows_donations, old.allows_public_profile, old.signed_at)
     or new.id is distinct from old.id
     or (old.revoked_at is not null and (new.revoked_at is distinct from old.revoked_at or new.revoke_reason is distinct from old.revoke_reason
         or (new.revoked_by is distinct from old.revoked_by and new.revoked_by is not null)))
     or (new.link_id is distinct from old.link_id and new.link_id is not null)
     or (new.minor_id is distinct from old.minor_id and new.minor_id is not null)
     or (new.guardian_id is distinct from old.guardian_id and new.guardian_id is not null) then
    raise exception 'Signed consent records are kept as signed; sign again instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_consents_append_only on public.guardian_consents;
create trigger guardian_consents_append_only
  before update or delete on public.guardian_consents
  for each row execute function public.guard_consent_records();

create or replace function public.guard_consent_truncate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Signed consent records are kept.';
end;
$$;

drop trigger if exists guardian_consents_no_truncate on public.guardian_consents;
create trigger guardian_consents_no_truncate
  before truncate on public.guardian_consents
  for each statement execute function public.guard_consent_truncate();

create or replace function public.first_name_of(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), nullif(btrim(p.username), ''), 'Someone')
  from public.profiles p where p.id = target;
$$;

-- An active consent on a confirmed link. Donations also need the signer to be the guardian on record for the athlete
-- (players.guardian_id, admin-set; the custodial money guardian) at the time it is checked.
create or replace function public.minor_has_consent(minor uuid, scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_consents c
    join public.guardian_links l on l.id = c.link_id and l.ended_at is null and l.confirmed_at is not null
    where c.minor_id = minor and c.revoked_at is null
      and case scope
        when 'public_profile' then c.allows_public_profile
        when 'donations' then c.allows_donations and exists (
          select 1 from public.profiles t join public.players pl on pl.id = t.player_id
          where t.id = minor and t.verification_status = 'verified' and pl.guardian_id = c.guardian_id)
        else false end
  );
$$;

create or replace function public.minor_guardian_count(minor uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.guardian_links l where l.minor_id = minor and l.ended_at is null and l.confirmed_at is not null;
$$;

-- Confirmed links plus invite links still waiting for the teen (both use one of the two places).
create or replace function public.minor_link_slots_used(minor uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.guardian_links l
  where l.minor_id = minor and l.ended_at is null
    and (l.confirmed_at is not null or l.created_at > timezone('utc', now()) - interval '7 days');
$$;

-- The caller supervises this teen: a confirmed link while the account is 13–17. This is NOT the PRIV-01 'guardian'
-- viewer relationship (which stays the admin-set athlete guardian): supervision is only the summary below.
create or replace function public.is_supervising_guardian(minor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guardian_links l
    where l.minor_id = minor and l.guardian_id = public.my_profile_id() and l.ended_at is null and l.confirmed_at is not null
      and public.is_minor_band(public.profile_age_band(minor))
  );
$$;

create or replace function public.is_guardian_of_record(minor uuid, guardian uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles t join public.players pl on pl.id = t.player_id
    where t.id = minor and t.verification_status = 'verified' and pl.guardian_id = guardian
  );
$$;

create or replace function public.log_supervision_event(minor uuid, event_kind text, event_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_minor_band(public.profile_age_band(minor)) then
    return;
  end if;
  insert into public.supervision_events (minor_id, kind, detail, actor_id)
  values (minor, event_kind, coalesce(event_detail, '{}'::jsonb), public.my_profile_id());
  delete from public.supervision_events e
  where e.minor_id = minor and e.created_at < timezone('utc', now()) - interval '365 days';
end;
$$;

-- The athlete account for a roster athlete: the verified one, else the open claimant.
create or replace function public.athlete_profile_for_player(target_player_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.profiles p where p.player_id = target_player_id and p.verification_status = 'verified' limit 1),
    (select v.requester_user_id from public.verification_requests v
       where v.player_id = target_player_id and v.status in ('pending', 'disputed') order by v.created_at desc limit 1)
  );
$$;

-- Why money for this athlete must wait, or null. `account` is the athlete account money would follow (the verified
-- account, or the open claimant). Adult evidence: the custodial birth date, or a typed adult age on an account whose own
-- Stripe payouts are on (Stripe checks the birth date; unverified assumption, counsel row AA). A minor needs the
-- donations consent of the guardian on record. When signals disagree, the protective one wins.
create or replace function public.minor_payout_hold_reason(target_player_id uuid, account uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bd date;
  band text;
  own_payouts boolean;
begin
  select b.birth_date into bd from public.athlete_birthdates b where b.player_id = target_player_id;
  band := case when account is null then 'unknown' else public.profile_age_band(account) end;
  select coalesce(p.payouts_enabled, false) into own_payouts from public.profiles p where p.id = account;
  if (bd is not null and bd > current_date - interval '18 years') or public.is_minor_band(band) or band = 'under_13' then
    return case when public.minor_has_consent(account, 'donations') then null else 'needs_guardian_consent' end;
  end if;
  if (bd is not null and bd <= current_date - interval '18 years') or (band = 'adult' and coalesce(own_payouts, false)) then
    return null;
  end if;
  if band = 'adult' then
    return 'needs_payout_setup';
  end if;
  return 'needs_birth_month';
end;
$$;

-- A teen's account cannot stay public without a consent that allows it.
create or replace function public.enforce_minor_consent(minor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_minor_band(public.profile_age_band(minor))
     and exists (select 1 from public.profiles p where p.id = minor and not p.account_private)
     and not public.minor_has_consent(minor, 'public_profile') then
    perform public.apply_privacy_settings(minor, '{"account_private": true}'::jsonb);
    perform public.log_supervision_event(minor, 'made_private', '{"why": "no_consent"}'::jsonb);
  end if;
  if public.minor_guardian_count(minor) = 0 then
    update public.guardian_approval_requests set status = 'cancelled', decided_at = timezone('utc', now())
    where minor_id = minor and status = 'pending';
  end if;
end;
$$;

-- Teen defaults when an age is first recorded (or corrected into the teen range).
create or replace function public.apply_teen_defaults(minor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_minor_band(public.profile_age_band(minor)) then
    return;
  end if;
  if exists (select 1 from public.profiles p where p.id = minor and p.friend_requests_from = 'everyone') then
    perform public.apply_privacy_settings(minor, '{"friend_requests_from": "teens"}'::jsonb);
  end if;
  perform public.enforce_minor_consent(minor);
end;
$$;

-- Closes an account whose holder is under 13 (COPPA actual knowledge): stop using it, clear what it shared, hide its
-- clips, end its friendships and guardian links. The caller has already recorded the birth month and set the flag.
create or replace function public.close_under_13_account(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link uuid;
begin
  -- The age-write flag stays on to the end: the closed-account guard would refuse these server-side writes too.
  perform set_config('app.tapuai_age_write', 'on', true);
  update public.profiles set bio = null, avatar_url = null, social_links = '{}'::jsonb where id = target;
  perform public.apply_privacy_settings(target, '{"account_private": true, "hide_from_search": true}'::jsonb);
  update public.reels set is_removed = true where uploaded_by = target;
  delete from public.friendships where target in (requester_id, addressee_id);
  for link in select l.id from public.guardian_links l where l.minor_id = target and l.ended_at is null loop
    perform public.close_guardian_link(link, 'age_blocked');
  end loop;
  perform set_config('app.tapuai_age_write', 'off', true);
end;
$$;

-- Every RLS table refuses a closed (under-13) account: policies that use auth.uid() directly would otherwise still let
-- it write. Evaluated once per query.
create or replace function public.caller_not_age_blocked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.age_blocked_at is not null);
$$;

-- 4. New accounts and the birth columns --------------------------------------------------------------------------------

-- Inserts start on the private defaults (a client insert could otherwise create a public row and skip the PRIV-01
-- guard, which only watches updates). A recorded age sets the teen rules or refuses an under-13 account; a new account
-- with no age yet ('not_given') takes no friend requests until it adds one.
create or replace function public.profiles_apply_new_account_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  band text;
begin
  if not (coalesce(current_setting('app.tapuai_privacy_write', true), '') = 'on' or public.is_trusted_server()) then
    new.account_private := true;
    new.profile_audience := public.privacy_default_audience();
    new.hide_from_search := false;
    new.tag_review := 'review_all';
    new.friend_requests_from := 'everyone';
    new.age_blocked_at := null;
    new.age_check_required := true;
  end if;
  if new.birth_year is null or new.birth_month is null then
    new.birth_year := null;
    new.birth_month := null;
    new.birth_recorded_at := null;
    if coalesce(new.age_check_required, true) then
      new.friend_requests_from := 'nobody';
    end if;
    return new;
  end if;
  if new.birth_year * 12 + new.birth_month > extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    raise exception 'Check your birth month and year.';
  end if;
  band := public.age_band_from(new.birth_year, new.birth_month, current_date);
  if band = 'under_13' then
    raise exception 'We can''t create your account right now.';
  end if;
  new.birth_recorded_at := coalesce(new.birth_recorded_at, timezone('utc', now()));
  new.age_confirmed_13_plus := true;
  if public.is_minor_band(band) then
    new.account_private := true;
    new.friend_requests_from := 'teens';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_new_account_rules on public.profiles;
create trigger profiles_new_account_rules
  before insert on public.profiles
  for each row execute function public.profiles_apply_new_account_rules();

create or replace function public.guard_profiles_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.tapuai_age_write', true), '') = 'on' or public.is_trusted_server() then
    return new;
  end if;
  -- A closed (under-13) account changes nothing; support reopens it with admin_set_birth_month.
  if old.age_blocked_at is not null and public.current_user_role() is distinct from 'admin' then
    raise exception 'This account is closed.';
  end if;
  if new.birth_year is distinct from old.birth_year or new.birth_month is distinct from old.birth_month
     or new.birth_recorded_at is distinct from old.birth_recorded_at or new.age_blocked_at is distinct from old.age_blocked_at
     or new.age_check_required is distinct from old.age_check_required then
    raise exception 'Add or correct your birth month and year from Profile.';
  end if;
  -- Older builds only ever set the 13+ confirmation to true.
  if coalesce(old.age_confirmed_13_plus, false) and new.age_confirmed_13_plus is distinct from old.age_confirmed_13_plus then
    raise exception 'Add or correct your birth month and year from Profile.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_age_guard on public.profiles;
create trigger profiles_age_guard
  before update on public.profiles
  for each row execute function public.guard_profiles_age();

-- Sign-up metadata now carries birth_year / birth_month (email and magic-link sign-up); Apple / Google ask after the
-- first sign-in. Bad values are dropped (the app asks again); an under-13 date fails the sign-up (the trigger above).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  by_text text := new.raw_user_meta_data->>'birth_year';
  bm_text text := new.raw_user_meta_data->>'birth_month';
  by_val smallint;
  bm_val smallint;
begin
  if by_text ~ '^[0-9]{4}$' and bm_text ~ '^[0-9]{1,2}$' and bm_text::int between 1 and 12 and by_text::int >= 1900
     and by_text::int * 12 + bm_text::int <= extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    by_val := by_text::smallint;
    bm_val := bm_text::smallint;
  end if;
  insert into public.profiles (
    user_id, full_name, role, roles, is_verified, aura_points, active_role, age_confirmed_13_plus, birth_year, birth_month,
    age_check_required
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(coalesce(new.email, 'fan'), '@', 1),
      'Fan'
    ),
    'fan',
    array['fan']::text[],
    false,
    0,
    'fan',
    -- Older builds send only the 13+ confirmation; a birth month and year sets it too (profiles_new_account_rules).
    nullif(new.raw_user_meta_data->>'age_confirmed_13_plus', '')::boolean,
    by_val,
    bm_val,
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- The teen's own view adds their birth month and year and the links waiting for their answer.
create or replace function public.minor_status_json(target uuid, for_teen boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'age_band', public.profile_age_band(p.id),
    'needs_birth', p.birth_year is null,
    'birth_year', case when for_teen then p.birth_year end,
    'birth_month', case when for_teen then p.birth_month end,
    'guardian_links_enabled', public.guardian_links_enabled(),
    'has_public_consent', public.minor_has_consent(p.id, 'public_profile'),
    'has_donations_consent', public.minor_has_consent(p.id, 'donations'),
    'guardians', coalesce((
      select jsonb_agg(jsonb_build_object(
        'link_id', l.id, 'first_name', public.first_name_of(l.guardian_id), 'since', l.confirmed_at,
        'guardian_of_record', public.is_guardian_of_record(p.id, l.guardian_id),
        'consent', (select jsonb_build_object('signed_at', c.signed_at, 'form_version', c.form_version,
                      'relationship', c.relationship, 'allows_donations', c.allows_donations,
                      'allows_public_profile', c.allows_public_profile)
                    from public.guardian_consents c where c.link_id = l.id and c.revoked_at is null)
      ) order by l.confirmed_at)
      from public.guardian_links l where l.minor_id = p.id and l.ended_at is null and l.confirmed_at is not null
    ), '[]'::jsonb),
    'pending_links', case when for_teen then coalesce((
      select jsonb_agg(jsonb_build_object(
        'link_id', l.id, 'first_name', public.first_name_of(l.guardian_id),
        'username', (select g.username from public.profiles g where g.id = l.guardian_id), 'requested_at', l.created_at
      ) order by l.created_at)
      from public.guardian_links l
      where l.minor_id = p.id and l.ended_at is null and l.confirmed_at is null
        and l.created_at > timezone('utc', now()) - interval '7 days'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'pending_approvals', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'change_key', r.change_key, 'requested_at', r.requested_at) order by r.requested_at)
      from public.guardian_approval_requests r
      where r.minor_id = p.id and r.status = 'pending' and r.requested_at > timezone('utc', now()) - interval '14 days'
    ), '[]'::jsonb)
  )
  from public.profiles p where p.id = target;
$$;

-- Records (or corrects to a younger age) the caller's birth month and year. Returns the new status; an under-13 entry
-- blocks the account and returns {"status": "blocked"}.
create or replace function public.set_my_birth_month(birth_y integer, birth_m integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  cur public.profiles%rowtype;
  band text;
  old_band text;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  if birth_m is null or birth_y is null or birth_m not between 1 and 12 or birth_y < 1900
     or birth_y * 12 + birth_m > extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    raise exception 'Check your birth month and year.';
  end if;
  select * into cur from public.profiles where id = me;
  old_band := public.profile_age_band(me);
  if cur.birth_year is not null then
    if birth_y * 12 + birth_m < cur.birth_year * 12 + cur.birth_month then
      raise exception 'To change this to an older age, contact support.';
    end if;
    if birth_y = cur.birth_year and birth_m = cur.birth_month then
      return public.minor_status_json(me, true);
    end if;
  end if;
  band := public.age_band_from(birth_y, birth_m, current_date);
  perform set_config('app.tapuai_age_write', 'on', true);
  if band = 'under_13' then
    -- COPPA actual knowledge: the desk lists the account for deletion (admin_list_age_blocked).
    update public.profiles
    set birth_year = birth_y, birth_month = birth_m, birth_recorded_at = timezone('utc', now()), age_blocked_at = timezone('utc', now())
    where id = me;
    perform set_config('app.tapuai_age_write', 'off', true);
    perform public.close_under_13_account(me);
    return jsonb_build_object('status', 'blocked');
  end if;
  update public.profiles
  set birth_year = birth_y, birth_month = birth_m, birth_recorded_at = timezone('utc', now()), age_confirmed_13_plus = true
  where id = me;
  perform set_config('app.tapuai_age_write', 'off', true);
  -- Leaving 'not_given' opens friend requests to the band's default; a correction never loosens otherwise.
  if old_band = 'not_given' and cur.friend_requests_from = 'nobody' then
    perform public.apply_privacy_settings(me, jsonb_build_object('friend_requests_from',
      case when public.is_minor_band(band) then 'teens' else 'everyone' end));
  elsif not public.is_minor_band(band) and cur.friend_requests_from = 'teens' then
    perform public.apply_privacy_settings(me, '{"friend_requests_from": "nobody"}'::jsonb);
  end if;
  if public.is_minor_band(band) and band is distinct from old_band then
    perform public.apply_teen_defaults(me);
  end if;
  perform public.log_supervision_event(me, case when cur.birth_year is null then 'age_recorded' else 'age_corrected' end,
    jsonb_build_object('band', band));
  return public.minor_status_json(me, true);
end;
$$;

-- 5. Privacy with the teen rules ------------------------------------------------------------------------------------

create or replace function public.get_my_privacy()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in to see your privacy settings.';
  end if;
  return public.privacy_settings_json(me) || jsonb_build_object('minor', public.minor_status_json(me, true));
end;
$$;

-- Teens: Public needs a guardian consent that allows it; under-16s send Public and friend requests from Anyone to the
-- guardian as approve / decline requests (the rest of the save applies). 'teens' is only for teen accounts; a new
-- account adds its age before opening up.
create or replace function public.set_my_privacy(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  cur public.profiles%rowtype;
  band text;
  wants_public boolean;
  wants_open boolean;
  held text[] := array[]::text[];
  before_json jsonb;
  after_json jsonb;
  changed text[];
begin
  if me is null then
    raise exception 'Sign in to change your privacy settings.';
  end if;
  settings := coalesce(settings, '{}'::jsonb);
  select * into cur from public.profiles where id = me;
  band := public.profile_age_band(me);
  -- Read booleans the way apply_privacy_settings casts them ("off", "no", "f" and "0" are all false).
  wants_public := cur.account_private and not coalesce((settings ->> 'account_private')::boolean, true);
  wants_open := coalesce(settings ->> 'friend_requests_from', cur.friend_requests_from) <> cur.friend_requests_from
    and (settings ->> 'friend_requests_from') in ('everyone', 'teens');

  if (settings ->> 'friend_requests_from') = 'teens' and cur.friend_requests_from <> 'teens' and not public.is_minor_band(band) then
    raise exception 'That setting is for teen accounts.';
  end if;
  if band = 'not_given' and (wants_public or wants_open) then
    raise exception 'Add your birth month and year first.';
  end if;
  if public.is_minor_band(band) then
    if wants_public and not public.minor_has_consent(me, 'public_profile') then
      raise exception 'A parent or guardian needs to sign the consent before your profile can be public.';
    end if;
    wants_open := (settings ->> 'friend_requests_from') = 'everyone' and cur.friend_requests_from <> 'everyone';
    if band = 'teen_13_15' and (wants_public or wants_open) then
      if public.minor_guardian_count(me) = 0 then
        raise exception 'Invite a parent or guardian first. They approve this change.';
      end if;
      update public.guardian_approval_requests set status = 'expired'
      where minor_id = me and status = 'pending' and requested_at <= timezone('utc', now()) - interval '14 days';
      if wants_public then
        held := array_append(held, 'account_public');
        settings := settings - 'account_private';
      end if;
      if wants_open then
        held := array_append(held, 'friend_requests_everyone');
        settings := settings - 'friend_requests_from';
      end if;
      insert into public.guardian_approval_requests (minor_id, change_key)
      select me, k from unnest(held) k
      on conflict do nothing;
      perform public.log_supervision_event(me, 'approval_requested', jsonb_build_object('changes', to_jsonb(held)));
    end if;
  end if;

  before_json := public.privacy_settings_json(me);
  after_json := public.apply_privacy_settings(me, settings);
  select array_agg(k) into changed from jsonb_object_keys(after_json) k where after_json -> k is distinct from before_json -> k;
  if changed is not null then
    perform public.log_supervision_event(me, 'settings_changed', jsonb_build_object('keys', to_jsonb(changed)));
  end if;
  -- Belt and braces: whatever was sent, a teen without a public-profile consent ends the save private.
  perform public.enforce_minor_consent(me);
  after_json := public.privacy_settings_json(me);
  return after_json || jsonb_build_object('minor', public.minor_status_json(me, true), 'held_for_approval', to_jsonb(held));
end;
$$;

-- PRIV-01's request_friend with one more rule: "Only other teens" refuses everyone who is not a recorded teen (a
-- linked guardian may still ask). The refusal reads the same as every other refusal, so it does not reveal a teen.
create or replace function public.request_friend(target_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  t public.profiles%rowtype;
  row_found public.friendships%rowtype;
  sent_today integer;
begin
  if me is null then
    raise exception 'Sign in to add friends.';
  end if;
  if not public.friend_requests_enabled() then
    raise exception 'Friend requests are paused right now.';
  end if;
  select * into t from public.profiles where id = target_profile_id;
  if not found or t.id = me or t.age_blocked_at is not null or public.is_blocked_between(me, t.id) or t.friend_requests_from = 'nobody'
     or (t.friend_requests_from = 'teens'
         and not public.is_minor_band(public.profile_age_band(me))
         and not exists (select 1 from public.guardian_links l
                         where l.minor_id = t.id and l.guardian_id = me and l.ended_at is null and l.confirmed_at is not null)) then
    raise exception 'You can''t send a friend request to this account.';
  end if;
  select * into row_found from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, t.id)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, t.id);
  if found then
    if row_found.status = 'accepted' then
      return 'friends';
    end if;
    if row_found.status = 'pending' and row_found.requester_id = me then
      return 'requested';
    end if;
    if row_found.status = 'pending' and row_found.addressee_id = me then
      update public.friendships set status = 'accepted', responded_at = timezone('utc', now()) where id = row_found.id;
      return 'friends';
    end if;
    -- Declined: the requester waits 30 days and is never told; the person who declined may send their own request.
    if row_found.requester_id = me and row_found.responded_at > timezone('utc', now()) - interval '30 days' then
      return 'requested';
    end if;
    delete from public.friendships where id = row_found.id;
  end if;
  select count(*)::int into sent_today from public.friend_request_log l
  where l.requester_id = me and l.created_at > timezone('utc', now()) - interval '1 day';
  if sent_today >= 20 then
    raise exception 'You''ve sent a lot of friend requests today. Try again tomorrow.';
  end if;
  if (select count(*) from public.friend_request_log l
      where l.requester_id = me and l.addressee_id = t.id and l.created_at > timezone('utc', now()) - interval '7 days') >= 3 then
    return 'requested';
  end if;
  insert into public.friend_request_log (requester_id, addressee_id) values (me, t.id);
  insert into public.friendships (requester_id, addressee_id) values (me, t.id);
  return 'requested';
end;
$$;

-- 6. Invites, links and consent ---------------------------------------------------------------------------------------

create or replace function public.create_guardian_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  band text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  raw text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  code text := '';
  i integer;
  expires timestamptz := timezone('utc', now()) + interval '48 hours';
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  band := public.profile_age_band(me);
  if band in ('unknown', 'not_given') then
    raise exception 'Add your birth month and year first.';
  end if;
  if not public.is_minor_band(band) then
    raise exception 'Guardian links are for accounts aged 13 to 17.';
  end if;
  if not public.guardian_links_enabled() then
    raise exception 'Guardian links are paused right now.';
  end if;
  if public.minor_link_slots_used(me) >= 2 then
    raise exception 'You already have two guardians linked or waiting.';
  end if;
  if (select count(*) from public.guardian_invites g where g.minor_id = me and g.created_at > timezone('utc', now()) - interval '1 day') >= 5 then
    raise exception 'You''ve made a lot of codes today. Try again tomorrow.';
  end if;
  -- 8 characters from 31 (no 0/O, 1/I/L), each from two random hex digits of v4 UUIDs.
  for i in 0..7 loop
    code := code || substr(alphabet, 1 + (('x' || substr(raw, 1 + i * 2, 2))::bit(8)::int % 31), 1);
  end loop;
  update public.guardian_invites set expires_at = timezone('utc', now())
  where minor_id = me and used_at is null and expires_at > timezone('utc', now());
  insert into public.guardian_invites (code_hash, minor_id, expires_at) values (public.hash_secret(code), me, expires);
  perform public.log_supervision_event(me, 'invite_created', '{}'::jsonb);
  return jsonb_build_object('code', code, 'expires_at', expires);
end;
$$;

-- The guardian side of a code: the caller must be 18+ (recorded), with 10 wrong tries a day. Returns the invite row, or
-- an empty row for a wrong code (no exception, so the counted try is kept: an exception would roll it back).
create or replace function public.guardian_invite_for_code(invite_code text)
returns public.guardian_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  band text;
  inv public.guardian_invites%rowtype;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  band := public.profile_age_band(me);
  if band in ('unknown', 'not_given') then
    raise exception 'Add your birth month and year first.';
  end if;
  if band <> 'adult' then
    raise exception 'A parent or guardian must be 18 or older.';
  end if;
  if not public.guardian_links_enabled() then
    raise exception 'Guardian links are paused right now.';
  end if;
  if (select count(*) from public.guardian_invite_attempts a where a.profile_id = me and a.created_at > timezone('utc', now()) - interval '1 day') >= 10 then
    raise exception 'Too many tries. Try again tomorrow.';
  end if;
  select * into inv from public.guardian_invites g
  where g.code_hash = public.hash_secret(upper(btrim(coalesce(invite_code, ''))))
    and g.used_at is null and g.expires_at > timezone('utc', now());
  if not found or inv.minor_id = me or public.is_blocked_between(me, inv.minor_id) then
    insert into public.guardian_invite_attempts (profile_id) values (me);
    return null;
  end if;
  return inv;
end;
$$;

create or replace function public.preview_guardian_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.guardian_invites%rowtype := public.guardian_invite_for_code(invite_code);
begin
  if inv.code_hash is null then
    return jsonb_build_object('status', 'bad_code');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'first_name', public.first_name_of(inv.minor_id),
    'username', (select p.username from public.profiles p where p.id = inv.minor_id),
    'form_version', public.guardian_consent_form_version(),
    'can_allow_donations', public.is_guardian_of_record(inv.minor_id, public.my_profile_id())
  );
end;
$$;

-- Records a signed consent on a link (revoking the guardian's earlier one), then applies its effects. The consent counts
-- once the link is confirmed; payouts only from the guardian on record.
create or replace function public.record_guardian_consent(
  link uuid, signer text, relation text, donations boolean, public_profile boolean, version text, text_sha256 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.guardian_links%rowtype;
begin
  select * into l from public.guardian_links where id = link and ended_at is null;
  if not found then
    raise exception 'This guardian link has ended.';
  end if;
  if version is distinct from public.guardian_consent_form_version() or text_sha256 is distinct from public.guardian_consent_form_sha256() then
    raise exception 'The consent form has changed. Reload and read it again.';
  end if;
  if char_length(btrim(coalesce(signer, ''))) < 2 then
    raise exception 'Type your full name to sign.';
  end if;
  if relation is null or relation not in ('parent', 'legal_guardian') then
    raise exception 'Choose parent or legal guardian.';
  end if;
  if coalesce(donations, false) and not public.is_guardian_of_record(l.minor_id, l.guardian_id) then
    raise exception 'Only the guardian on record for this athlete''s family account can allow payouts.';
  end if;
  update public.guardian_consents set revoked_at = timezone('utc', now()), revoked_by = public.my_profile_id(), revoke_reason = 'signed_again'
  where link_id = link and revoked_at is null;
  insert into public.guardian_consents (link_id, minor_id, guardian_id, form_version, form_sha256, signer_name, relationship, allows_donations, allows_public_profile)
  values (link, l.minor_id, l.guardian_id, version, text_sha256, btrim(signer), relation, coalesce(donations, false), coalesce(public_profile, false));
  perform public.log_supervision_event(l.minor_id, 'consent_signed',
    jsonb_build_object('donations', coalesce(donations, false), 'public_profile', coalesce(public_profile, false)));
  perform public.enforce_minor_consent(l.minor_id);
end;
$$;

-- The guardian redeems a teen's code and signs. The link waits for the teen to confirm (respond_guardian_link).
create or replace function public.accept_guardian_invite(
  invite_code text, signer_name text, relationship text, allows_donations boolean, allows_public_profile boolean,
  form_version text, form_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  inv public.guardian_invites%rowtype := public.guardian_invite_for_code(invite_code);
  link uuid;
  waiting boolean := false;
begin
  if inv.code_hash is null or not public.is_minor_band(public.profile_age_band(inv.minor_id)) then
    return jsonb_build_object('status', 'bad_code');
  end if;
  -- A waiting link the teen never answered (7 days) is closed, so the new code starts a fresh one they can see.
  update public.guardian_links set ended_at = timezone('utc', now()), end_reason = 'not_confirmed'
  where minor_id = inv.minor_id and guardian_id = me and ended_at is null and confirmed_at is null
    and created_at <= timezone('utc', now()) - interval '7 days';
  select l.id, l.confirmed_at is null into link, waiting from public.guardian_links l
  where l.minor_id = inv.minor_id and l.guardian_id = me and l.ended_at is null;
  if link is null then
    if public.minor_link_slots_used(inv.minor_id) >= 2 then
      raise exception 'This account already has two guardians linked or waiting.';
    end if;
    insert into public.guardian_links (minor_id, guardian_id, source) values (inv.minor_id, me, 'invite') returning id into link;
    waiting := true;
  end if;
  update public.guardian_invites set used_at = timezone('utc', now()), used_by = me where code_hash = inv.code_hash;
  perform public.record_guardian_consent(link, signer_name, relationship, allows_donations, allows_public_profile, form_version, form_sha256);
  return jsonb_build_object('status', case when waiting then 'waiting_for_teen' else 'linked' end,
                            'first_name', public.first_name_of(inv.minor_id), 'link_id', link);
end;
$$;

-- The teen answers "Is {name} your parent or guardian?". Yes makes the link (and its consent) count; no ends it.
create or replace function public.respond_guardian_link(link_id uuid, accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  l public.guardian_links%rowtype;
begin
  select * into l from public.guardian_links g
  where g.id = link_id and g.minor_id = me and g.ended_at is null and g.confirmed_at is null
    and g.created_at > timezone('utc', now()) - interval '7 days'
  for update;
  if not found then
    raise exception 'This request has ended.';
  end if;
  if coalesce(accept, false) then
    if public.minor_guardian_count(me) >= 2 then
      raise exception 'You already have two guardians linked.';
    end if;
    update public.guardian_links set confirmed_at = timezone('utc', now()) where id = l.id;
    perform public.log_supervision_event(me, 'guardian_linked', jsonb_build_object('guardian', public.first_name_of(l.guardian_id)));
    perform public.enforce_minor_consent(me);
  else
    perform public.close_guardian_link(l.id, 'teen_declined');
  end if;
  return public.minor_status_json(me, true);
end;
$$;

-- A guardian signs (or re-signs) for a teen they are linked to; the admin-set athlete guardian may start a link here.
-- Every refusal reads the same, so this cannot be used to find out who is a teen. The guardian on record's new link is
-- confirmed at once, unless the teen ended or blocked an earlier one: then the teen confirms again.
create or replace function public.sign_guardian_consent(
  minor_profile_id uuid, signer_name text, relationship text, allows_donations boolean, allows_public_profile boolean,
  form_version text, form_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  link uuid;
  refused constant text := 'You can''t sign for this account. Ask the teen for a guardian code.';
  teen_ended boolean;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  if public.profile_age_band(me) <> 'adult' then
    raise exception 'A parent or guardian must be 18 or older (add your birth month and year first).';
  end if;
  update public.guardian_links set ended_at = timezone('utc', now()), end_reason = 'not_confirmed'
  where minor_id = minor_profile_id and guardian_id = me and ended_at is null and confirmed_at is null
    and created_at <= timezone('utc', now()) - interval '7 days';
  select l.id into link from public.guardian_links l where l.minor_id = minor_profile_id and l.guardian_id = me and l.ended_at is null;
  -- An admin-ended link stays ended: support reinstates on purpose (or changes players.guardian_id) — review P2.
  if (link is null and not public.is_guardian_of_record(minor_profile_id, me))
     or not public.is_minor_band(public.profile_age_band(minor_profile_id))
     or public.is_blocked_between(me, minor_profile_id)
     or (link is null and exists (
           select 1 from public.guardian_links l
           where l.minor_id = minor_profile_id and l.guardian_id = me and l.end_reason like 'admin:%')) then
    raise exception '%', refused;
  end if;
  if link is null then
    if not public.guardian_links_enabled() then
      raise exception 'Guardian links are paused right now.';
    end if;
    if public.minor_link_slots_used(minor_profile_id) >= 2 then
      raise exception '%', refused;
    end if;
    select exists (
      select 1 from public.guardian_links l
      where l.minor_id = minor_profile_id and l.guardian_id = me and l.end_reason in ('teen_unlinked', 'teen_declined', 'blocked')
    ) into teen_ended;
    insert into public.guardian_links (minor_id, guardian_id, source, confirmed_at)
    values (minor_profile_id, me, 'custodial', case when teen_ended then null else timezone('utc', now()) end)
    returning id into link;
    if not teen_ended then
      perform public.log_supervision_event(minor_profile_id, 'guardian_linked', jsonb_build_object('guardian', public.first_name_of(me)));
    end if;
  end if;
  perform public.record_guardian_consent(link, signer_name, relationship, allows_donations, allows_public_profile, form_version, form_sha256);
  return public.guardian_view(minor_profile_id);
end;
$$;

create or replace function public.revoke_guardian_consent(minor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  n integer;
begin
  update public.guardian_consents c set revoked_at = timezone('utc', now()), revoked_by = me, revoke_reason = 'withdrawn'
  from public.guardian_links l
  where l.id = c.link_id and l.ended_at is null and l.guardian_id = me and l.minor_id = minor_profile_id and c.revoked_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'There is no consent of yours to withdraw.';
  end if;
  perform public.log_supervision_event(minor_profile_id, 'consent_withdrawn', '{}'::jsonb);
  perform public.enforce_minor_consent(minor_profile_id);
  return public.guardian_view(minor_profile_id);
end;
$$;

-- Ends a link and the consent signed on it, then re-applies the teen rules. Shared by both sides, blocks and the admin.
create or replace function public.close_guardian_link(link uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.guardian_links%rowtype;
begin
  update public.guardian_links
  set ended_at = timezone('utc', now()), ended_by = public.my_profile_id(), end_reason = left(reason, 200)
  where id = link and ended_at is null
  returning * into l;
  if l.id is null then
    raise exception 'This guardian link has already ended.';
  end if;
  update public.guardian_consents set revoked_at = timezone('utc', now()), revoked_by = public.my_profile_id(), revoke_reason = 'link_ended'
  where link_id = link and revoked_at is null;
  if l.confirmed_at is not null then
    perform public.log_supervision_event(l.minor_id, 'guardian_unlinked',
      jsonb_build_object('guardian', public.first_name_of(l.guardian_id), 'reason', left(reason, 40)));
  end if;
  perform public.enforce_minor_consent(l.minor_id);
end;
$$;

-- Either side may end a link at any time (the owner's "no dictatorship" rule).
create or replace function public.end_guardian_link(link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  l public.guardian_links%rowtype;
begin
  select * into l from public.guardian_links g where g.id = link_id and g.ended_at is null;
  if not found or me is null or me not in (l.minor_id, l.guardian_id) then
    raise exception 'This guardian link has already ended.';
  end if;
  perform public.close_guardian_link(link_id, case when me = l.minor_id then 'teen_unlinked' else 'guardian_unlinked' end);
end;
$$;

-- Blocking either way ends every link between the two (a teen can always cut a guardian off with Block).
create or replace function public.user_blocks_end_guardian_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  link uuid;
begin
  for link in
    select l.id from public.guardian_links l
    where l.ended_at is null
      and ((l.minor_id = new.blocker_id and l.guardian_id = new.blocked_id) or (l.minor_id = new.blocked_id and l.guardian_id = new.blocker_id))
  loop
    perform public.close_guardian_link(link, 'blocked');
  end loop;
  return new;
end;
$$;

drop trigger if exists user_blocks_end_links on public.user_blocks;
create trigger user_blocks_end_links
  after insert on public.user_blocks
  for each row execute function public.user_blocks_end_guardian_links();

-- 7. Supervision and approvals ----------------------------------------------------------------------------------------

create or replace function public.verified_player_of(target uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.player_id from public.profiles p where p.id = target and p.verification_status = 'verified';
$$;

-- What the teen and their guardian both see: settings, status, counts (never who) and events since `events_since`
-- (a guardian sees only what happened after they linked).
create or replace function public.supervision_json(minor uuid, events_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', p.id,
    'first_name', public.first_name_of(p.id),
    'username', p.username,
    'settings', public.privacy_settings_json(p.id),
    'status', public.minor_status_json(p.id, false),
    'summary', jsonb_build_object(
      'friends', (select count(*) from public.friendships f where f.status = 'accepted' and p.id in (f.requester_id, f.addressee_id)),
      'incoming_requests', (select count(*) from public.friendships f where f.status = 'pending' and f.addressee_id = p.id),
      'blocked_accounts', (select count(*) from public.user_blocks u where u.blocker_id = p.id),
      'tags_waiting', (select count(*) from public.reels r
                       where r.player_id = public.verified_player_of(p.id) and r.tag_status = 'pending'),
      'hidden_from_search', p.hide_from_search
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'detail', e.detail, 'at', e.created_at,
                                          'by_teen', e.actor_id is not distinct from p.id) order by e.created_at desc)
      from (
        select * from public.supervision_events e
        where e.minor_id = p.id and e.created_at >= coalesce(events_since, '-infinity'::timestamptz)
          and e.created_at > timezone('utc', now()) - interval '365 days'
        order by e.created_at desc limit 30
      ) e
    ), '[]'::jsonb)
  )
  from public.profiles p where p.id = minor;
$$;

-- The guardian's view of one teen: the shared summary from the date they linked, plus whether they can allow payouts.
create or replace function public.guardian_view(minor uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_supervising_guardian(minor) then
      public.supervision_json(minor, (
        select min(l.confirmed_at) from public.guardian_links l
        where l.minor_id = minor and l.guardian_id = public.my_profile_id() and l.ended_at is null and l.confirmed_at is not null
      )) || jsonb_build_object('can_allow_donations', public.is_guardian_of_record(minor, public.my_profile_id()), 'link_status', 'linked')
    -- Nothing about the teen until they confirm the link.
    else jsonb_build_object('profile_id', minor, 'link_status', 'waiting_for_teen')
  end;
$$;

create or replace function public.get_my_supervision()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  return public.supervision_json(me, null) || jsonb_build_object('status', public.minor_status_json(me, true));
end;
$$;

create or replace function public.guardian_get_supervision(minor_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_supervising_guardian(minor_profile_id) then
    raise exception 'Only this teen''s linked guardian can see this.';
  end if;
  return public.guardian_view(minor_profile_id);
end;
$$;

-- Teens this guardian supervises or is waiting on, plus the admin-set athlete guardian's teens who still need a consent.
create or replace function public.guardian_list_minors()
returns table (
  profile_id uuid, first_name text, username text, age_band text, link_id uuid, link_status text,
  account_private boolean, my_consent jsonb, can_allow_donations boolean, pending_approvals integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select public.my_profile_id() as id),
  mine as (
    select l.minor_id, l.id as link_id, case when l.confirmed_at is null then 'waiting_for_teen' else 'linked' end as link_status
    from public.guardian_links l, me
    where l.guardian_id = me.id and l.ended_at is null
      and (l.confirmed_at is not null or l.created_at > timezone('utc', now()) - interval '7 days')
    union
    select t.id, null::uuid, 'not_linked' from public.profiles t join public.players pl on pl.id = t.player_id, me
    where pl.guardian_id = me.id and t.verification_status = 'verified'
      and not exists (select 1 from public.guardian_links l where l.minor_id = t.id and l.guardian_id = me.id and l.ended_at is null)
  )
  select p.id, public.first_name_of(p.id), p.username, public.profile_age_band(p.id), m.link_id, m.link_status,
    case when m.link_status = 'linked' then p.account_private end,
    (select jsonb_build_object('signed_at', c.signed_at, 'form_version', c.form_version, 'relationship', c.relationship,
                               'allows_donations', c.allows_donations, 'allows_public_profile', c.allows_public_profile)
       from public.guardian_consents c where c.link_id = m.link_id and c.revoked_at is null),
    public.is_guardian_of_record(p.id, (select id from me)),
    case when m.link_status = 'linked' then (select count(*)::int from public.guardian_approval_requests r
       where r.minor_id = p.id and r.status = 'pending' and r.requested_at > timezone('utc', now()) - interval '14 days') else 0 end
  from mine m join public.profiles p on p.id = m.minor_id
  where (select id from me) is not null;
$$;

create or replace function public.guardian_decide_approval(request_id uuid, approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.guardian_approval_requests%rowtype;
begin
  select * into r from public.guardian_approval_requests a where a.id = request_id for update;
  if not found or not (public.is_supervising_guardian(r.minor_id) or public.current_user_role() = 'admin') then
    raise exception 'This request is not yours to decide.';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request was already handled.';
  end if;
  -- Fail closed (QUIZ-05 security review 2026-10-15): this function decides only the two privacy requests; any other
  -- approval type is refused before anything changes (QUIZ-05 redefines it to route fun_fact requests).
  if r.change_key not in ('account_public', 'friend_requests_everyone') then
    raise exception 'This request cannot be decided here.';
  end if;
  if r.requested_at <= timezone('utc', now()) - interval '14 days' then
    update public.guardian_approval_requests set status = 'expired' where id = r.id;
    return public.guardian_view(r.minor_id) || jsonb_build_object('notice', 'This request expired. They can ask again.');
  end if;
  if coalesce(approve, false) then
    if r.change_key = 'account_public' then
      if public.is_minor_band(public.profile_age_band(r.minor_id)) and not public.minor_has_consent(r.minor_id, 'public_profile') then
        raise exception 'Sign the consent with "public profile" allowed first.';
      end if;
      perform public.apply_privacy_settings(r.minor_id, '{"account_private": false}'::jsonb);
    elsif r.change_key = 'friend_requests_everyone' then
      perform public.apply_privacy_settings(r.minor_id, '{"friend_requests_from": "everyone"}'::jsonb);
    end if;
  end if;
  update public.guardian_approval_requests
  set status = case when coalesce(approve, false) then 'approved' else 'declined' end,
      decided_by = public.my_profile_id(), decided_at = timezone('utc', now())
  where id = r.id;
  perform public.log_supervision_event(r.minor_id, 'approval_decided',
    jsonb_build_object('change', r.change_key, 'approved', coalesce(approve, false)));
  return public.guardian_view(r.minor_id);
end;
$$;

create or replace function public.cancel_my_approval_request(request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  n integer;
begin
  update public.guardian_approval_requests set status = 'cancelled', decided_by = me, decided_at = timezone('utc', now())
  where id = request_id and minor_id = me and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'This request was already handled.';
  end if;
  perform public.log_supervision_event(me, 'approval_cancelled', '{}'::jsonb);
  return public.minor_status_json(me, true);
end;
$$;

-- 8. Money: payouts wait for positive adult evidence, or a minor's donations consent ------------------------------------

-- Same as before (athlete verification ladder), plus minor_payout_hold_reason wherever money would otherwise be allowed.
--   reason   why it is held: 'disputed' | 'no_claim' | 'needs_payout_setup' | 'needs_guardian_consent' |
--            'needs_birth_month' | null
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
    hold := public.minor_payout_hold_reason(target_player_id, public.athlete_profile_for_player(target_player_id));
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
  hold := public.minor_payout_hold_reason(target_player_id, req.requester_user_id);
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

-- 9. Admin -------------------------------------------------------------------------------------------------------------

-- The safety case file for one account: names are shown here (admins only), unlike the counts-only privacy panel.
create or replace function public.admin_minor_overview(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return (
    select jsonb_build_object(
      'age_band', public.profile_age_band(p.id),
      'birth_year', p.birth_year,
      'birth_month', p.birth_month,
      'birth_recorded_at', p.birth_recorded_at,
      'age_blocked_at', p.age_blocked_at,
      'links', coalesce((
        select jsonb_agg(jsonb_build_object('link_id', l.id, 'guardian_id', l.guardian_id,
          'guardian_name', (select g.full_name from public.profiles g where g.id = l.guardian_id),
          'guardian_teens', (select count(*) from public.guardian_links x where x.guardian_id = l.guardian_id and x.ended_at is null),
          'source', l.source, 'created_at', l.created_at, 'confirmed_at', l.confirmed_at,
          'ended_at', l.ended_at, 'end_reason', l.end_reason) order by l.created_at desc)
        from public.guardian_links l where l.minor_id = p.id
      ), '[]'::jsonb),
      'consents', coalesce((
        select jsonb_agg(jsonb_build_object('form_version', c.form_version, 'signer_name', c.signer_name,
          'relationship', c.relationship, 'allows_donations', c.allows_donations,
          'allows_public_profile', c.allows_public_profile, 'signed_at', c.signed_at, 'revoked_at', c.revoked_at,
          'revoke_reason', c.revoke_reason) order by c.signed_at desc)
        from public.guardian_consents c where c.minor_id = p.id
      ), '[]'::jsonb),
      'supervision', public.supervision_json(p.id, null)
    )
    from public.profiles p where p.id = target_profile_id
  );
end;
$$;

-- Support's correction (either direction), with a reason kept as a supervision event.
create or replace function public.admin_set_birth_month(target_profile_id uuid, birth_y integer, birth_m integer, reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  band text;
  old_band text := public.profile_age_band(target_profile_id);
begin
  perform public.require_admin_guard();
  if char_length(btrim(coalesce(reason, ''))) < 5 then
    raise exception 'Give a reason (at least 5 characters).';
  end if;
  if birth_m is null or birth_y is null or birth_m not between 1 and 12 or birth_y < 1900
     or birth_y * 12 + birth_m > extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    raise exception 'Check the birth month and year.';
  end if;
  band := public.age_band_from(birth_y, birth_m, current_date);
  perform set_config('app.tapuai_age_write', 'on', true);
  update public.profiles
  set birth_year = birth_y, birth_month = birth_m, birth_recorded_at = timezone('utc', now()),
      age_blocked_at = case when band = 'under_13' then coalesce(age_blocked_at, timezone('utc', now())) else null end
  where id = target_profile_id;
  perform set_config('app.tapuai_age_write', 'off', true);
  if band = 'under_13' then
    perform public.close_under_13_account(target_profile_id);
  else
    if not public.is_minor_band(band) and exists (select 1 from public.profiles p where p.id = target_profile_id and p.friend_requests_from = 'teens') then
      perform public.apply_privacy_settings(target_profile_id, '{"friend_requests_from": "nobody"}'::jsonb);
    end if;
    if band is distinct from old_band then
      perform public.apply_teen_defaults(target_profile_id);
    end if;
  end if;
  perform public.log_supervision_event(target_profile_id, 'age_corrected', jsonb_build_object('band', band, 'by', 'support', 'reason', left(btrim(reason), 200)));
  return public.admin_minor_overview(target_profile_id);
end;
$$;

create or replace function public.admin_end_guardian_link(link_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  minor uuid;
begin
  perform public.require_admin_guard();
  if char_length(btrim(coalesce(reason, ''))) < 5 then
    raise exception 'Give a reason (at least 5 characters).';
  end if;
  select l.minor_id into minor from public.guardian_links l where l.id = link_id;
  perform public.close_guardian_link(link_id, 'admin: ' || btrim(reason));
  return public.admin_minor_overview(minor);
end;
$$;

create or replace function public.admin_minor_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return (
    with bands as (
      select p.id, public.profile_age_band(p.id) as band, p.age_blocked_at from public.profiles p
    )
    select jsonb_build_object(
      'teen_13_15', count(*) filter (where band = 'teen_13_15' and age_blocked_at is null),
      'teen_16_17', count(*) filter (where band = 'teen_16_17' and age_blocked_at is null),
      'adult', count(*) filter (where band = 'adult'),
      'not_given', count(*) filter (where band = 'not_given'),
      'unknown', count(*) filter (where band = 'unknown'),
      'under_13_blocked', count(*) filter (where age_blocked_at is not null),
      'teens_with_guardian', count(*) filter (where public.is_minor_band(band) and public.minor_guardian_count(id) > 0),
      'teens_public_consent', count(*) filter (where public.is_minor_band(band) and public.minor_has_consent(id, 'public_profile')),
      'teens_donations_consent', count(*) filter (where public.is_minor_band(band) and public.minor_has_consent(id, 'donations')),
      'pending_approvals', (select count(*) from public.guardian_approval_requests r
                            where r.status = 'pending' and r.requested_at > timezone('utc', now()) - interval '14 days'),
      'invites_7d', (select count(*) from public.guardian_invites g where g.created_at > timezone('utc', now()) - interval '7 days'),
      -- abuse signals: one adult supervising many teens; adults sending friend requests to teens
      'guardians_over_3_teens', (select count(*) from (
          select l.guardian_id from public.guardian_links l where l.ended_at is null group by l.guardian_id having count(*) > 3) g),
      'adult_requests_to_teens_7d', (select count(*) from public.friend_request_log f
          where f.created_at > timezone('utc', now()) - interval '7 days'
            and public.profile_age_band(f.requester_id) = 'adult' and public.is_minor_band(public.profile_age_band(f.addressee_id))),
      'guardian_links_enabled', public.guardian_links_enabled()
    )
    from bands
  );
end;
$$;

-- Under-13 accounts waiting for deletion (deleting the sign-in itself needs the service role / Supabase dashboard).
create or replace function public.admin_list_age_blocked()
returns table (profile_id uuid, user_id uuid, blocked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return query select p.id, p.user_id, p.age_blocked_at from public.profiles p where p.age_blocked_at is not null order by p.age_blocked_at;
end;
$$;

-- Retention (PRIVACY_ENGINEERING): events 365 days, invite codes 30 days, wrong tries 2 days, decided or expired
-- approvals 90 days. Consent records are not purged here (counsel sets their period, LEGAL row AA).
create or replace function public.admin_purge_minor_records()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev integer;
  inv integer;
  att integer;
  app integer;
begin
  perform public.require_admin_guard();
  delete from public.supervision_events where created_at < timezone('utc', now()) - interval '365 days';
  get diagnostics ev = row_count;
  delete from public.guardian_invites where created_at < timezone('utc', now()) - interval '30 days';
  get diagnostics inv = row_count;
  delete from public.guardian_invite_attempts where created_at < timezone('utc', now()) - interval '2 days';
  get diagnostics att = row_count;
  delete from public.guardian_approval_requests
  where (status <> 'pending' and coalesce(decided_at, requested_at) < timezone('utc', now()) - interval '90 days')
     or (status = 'pending' and requested_at < timezone('utc', now()) - interval '90 days');
  get diagnostics app = row_count;
  return jsonb_build_object('events', ev, 'invites', inv, 'attempts', att, 'approvals', app);
end;
$$;

-- 10. Access -------------------------------------------------------------------------------------------------------------

do $$
declare
  t text;
  fn text;
begin
  foreach t in array array['guardian_links', 'guardian_invites', 'guardian_invite_attempts', 'guardian_consents',
                           'guardian_approval_requests', 'supervision_events'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
  execute 'revoke all on sequence public.supervision_events_id_seq from public, anon, authenticated';
  -- internal: other functions, triggers and the server only
  foreach fn in array array[
    'public.profile_age_band(uuid)', 'public.guardian_links_enabled()', 'public.first_name_of(uuid)',
    'public.guard_consent_records()', 'public.minor_has_consent(uuid, text)', 'public.minor_guardian_count(uuid)',
    'public.minor_link_slots_used(uuid)', 'public.is_supervising_guardian(uuid)', 'public.is_guardian_of_record(uuid, uuid)',
    'public.log_supervision_event(uuid, text, jsonb)', 'public.athlete_profile_for_player(uuid)',
    'public.minor_payout_hold_reason(uuid, uuid)', 'public.enforce_minor_consent(uuid)', 'public.close_under_13_account(uuid)',
    'public.guard_consent_truncate()', 'public.apply_teen_defaults(uuid)',
    'public.profiles_apply_new_account_rules()', 'public.guard_profiles_age()', 'public.minor_status_json(uuid, boolean)',
    'public.guardian_invite_for_code(text)', 'public.record_guardian_consent(uuid, text, text, boolean, boolean, text, text)',
    'public.close_guardian_link(uuid, text)', 'public.user_blocks_end_guardian_links()',
    'public.supervision_json(uuid, timestamptz)', 'public.verified_player_of(uuid)', 'public.guardian_view(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  -- evaluated as the caller inside the "Closed accounts" policies; answers only about the caller
  execute 'revoke all on function public.caller_not_age_blocked() from public, anon';
  execute 'grant execute on function public.caller_not_age_blocked() to authenticated, service_role';
  -- pure helpers (no lookups)
  foreach fn in array array['public.age_band_from(integer, integer, date)', 'public.is_minor_band(text)',
                            'public.guardian_consent_form_version()', 'public.guardian_consent_form_sha256()'] loop
    execute format('grant execute on function %s to anon, authenticated, service_role', fn);
  end loop;
  -- signed-in only
  foreach fn in array array[
    'public.set_my_birth_month(integer, integer)', 'public.get_my_privacy()', 'public.set_my_privacy(jsonb)',
    'public.request_friend(uuid)', 'public.create_guardian_invite()', 'public.preview_guardian_invite(text)',
    'public.accept_guardian_invite(text, text, text, boolean, boolean, text, text)', 'public.respond_guardian_link(uuid, boolean)',
    'public.sign_guardian_consent(uuid, text, text, boolean, boolean, text, text)', 'public.revoke_guardian_consent(uuid)',
    'public.end_guardian_link(uuid)', 'public.get_my_supervision()', 'public.guardian_get_supervision(uuid)',
    'public.guardian_list_minors()', 'public.guardian_decide_approval(uuid, boolean)', 'public.cancel_my_approval_request(uuid)',
    'public.admin_minor_overview(uuid)', 'public.admin_set_birth_month(uuid, integer, integer, text)',
    'public.admin_end_guardian_link(uuid, text)', 'public.admin_minor_report()', 'public.admin_list_age_blocked()',
    'public.admin_purge_minor_records()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- 11. Closed accounts on every RLS table ------------------------------------------------------------------------------

do $$
declare
  tbl text;
begin
  for tbl in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity loop
    execute format('drop policy if exists "Closed accounts" on public.%I', tbl);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated
                    using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))', tbl);
  end loop;
  -- Uploads too (avatars, reels): a closed account cannot add or change files.
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Closed accounts" on storage.objects';
    execute 'create policy "Closed accounts" on storage.objects as restrictive for all to authenticated
             using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))';
  end if;
end;
$$;
