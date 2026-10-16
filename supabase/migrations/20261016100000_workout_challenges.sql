-- Workout challenges, part 1a: preset responses, friend invites, the "Challenge finisher" badge and the admin desk
-- (CHAL-01, 2026-10-16). Design: docs/engineering/design/WORKOUT_CHALLENGES_DESIGN.md (§6 "1a" overrides §1–§5).
--
-- Purpose
--   On a public Train Like Me workout, a signed-in fan can answer with one preset ("Challenge accepted!", "Love this
--   workout", "I'm in", "Did it! 💪") and invite an accepted friend to try it. No free text, no list of who responded.
--   1. challenge_responses: one preset per account per post, changeable or removable; 50 posts a day. Only on a
--      listable, non-Vault, non-Exclusive `train_like_me` post with a confirmed athlete tag whose athlete account allows
--      challenges. Eligible: signed in, not closed, age band known (`unknown` / `not_given` count as 13–15).
--   2. challenge_counts: counts per preset, each hidden below 5; on a minor athlete's post only the athlete and their
--      guardian see them. Closed responders and responders blocked with the athlete or the viewer do not count.
--   3. challenge_nudges: "{name} invited you to try {athlete}'s workout", in Activity only (never a push). Accepted
--      two-way friends only; 5 a day per sender and 1 per pair per day across all posts, counted under a per-sender
--      lock. A mute (everyone or one sender), a block, or an admin mute drops the invite silently: the row is kept with
--      delivered = false so the limits behave exactly the same and the sender cannot tell. Deleted after 30 days.
--   4. challenge_athlete_settings: "Allow challenges on my workouts". With no row the default is on for adults and off
--      for everyone else (minors, unknown ages). Changing it logs a MINOR-01 supervision event; the guardian summary
--      gains `challenge_invites_7d` (a count, never who).
--   5. challenge_badges: "Challenge finisher" after "Did it! 💪" on 3 different workouts. Private, noncash.
--   6. Admin: the challenges.enabled switch (off; refused while PRIV-01 / MINOR-01 objects are missing), per-post
--      aggregate counts, the nudge-abuse view (counts per sender, recipient ids only) with a mute or suspend that needs
--      a reason (challenge_sender_holds, audited in challenge_admin_events), retention, and erasure.
--   7. challenge_response_quota: minimal responder/post IDs and last-response time enforce 50 distinct workouts in
--      rolling 24 hours despite response/post removal. No reel FK, so deletion cannot reset the quota or resurrect a post.
--      Expired entries are pruned on participant writes and by admin retention; own export and privileged erasure
--      cover them. Support erasure deliberately clears quota, even if the account survives; not a self-service reset.
--   8. Export (challenge_export_my_data) and erasure (admin_challenge_erase, challenge_erase_profile, and on delete
--      cascade from profiles) cover every challenge table. A sender's export never shows whether an invite was dropped.
--   Every table is RPC-only (RLS on, no client grants, the restrictive "Closed accounts" policy); every function pins
--   search_path. Functions that use PRIV-01 / MINOR-01 objects are plpgsql (late-bound), so this file applies on a
--   database without them and the switch then refuses with the missing pieces named.
--
-- Owner: HIGHLIGHTS (via ENGINEERING, CTO), with BACKEND, DATABASE_MIGRATIONS, ADMIN; reviews MINOR_SAFETY,
--   PRIVACY_ENGINEERING, RLS_SECURITY, MODERATION, VOICE, SUPPORT, DATA_GOVERNANCE.
-- Needs: 20261014090000_profile_privacy.sql and 20261014110000_minor_accounts.sql for the switch to turn on. If either
--   is applied after this file, re-run this file (the guardian summary count and the "Closed accounts" policy are
--   added only when MINOR-01 exists; the switch lists what is missing).
-- Safe to re-run: create table if not exists; create or replace; drop policy / trigger if exists.
-- Applied: written 2026-10-16, not applied anywhere.
-- Rollback: drop the eight challenge_* tables and the functions below, then re-run supervision_json from
--   20261014110000_minor_accounts.sql (it drops the challenge_invites_7d count).

-- 1. Tables -------------------------------------------------------------------------------------------------------------

create table if not exists public.challenge_responses (
  reel_id uuid not null references public.reels (id) on delete cascade,
  responder_id uuid not null references public.profiles (id) on delete cascade,
  preset text not null check (preset in ('accepted', 'love_it', 'im_in', 'did_it')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (reel_id, responder_id)
);
create index if not exists challenge_responses_responder_idx on public.challenge_responses (responder_id, updated_at desc);

-- Minimal abuse counter, not response history. No reel FK: a deleted workout still consumes its recent slot.
-- Ownership: HIGHLIGHTS / BACKEND; no text or preset, no growth reuse. Profile deletion cascades; expiry and
-- privileged support erasure remove rows. Timestamp is captured by the server under the per-responder lock.
create table if not exists public.challenge_response_quota (
  responder_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid not null,
  last_responded_at timestamptz not null,
  primary key (responder_id, reel_id)
);
create index if not exists challenge_response_quota_expiry_idx on public.challenge_response_quota (last_responded_at);
-- Reapplying over an older local challenge schema preserves still-recent recorded responses without overwriting
-- a newer durable quota entry. Existing timestamps are recorded response times, not reconstructed history.
insert into public.challenge_response_quota as q (responder_id, reel_id, last_responded_at)
select r.responder_id, r.reel_id, r.updated_at from public.challenge_responses r
where r.updated_at > now() - interval '24 hours'
on conflict (responder_id, reel_id) do update
  set last_responded_at = greatest(q.last_responded_at, excluded.last_responded_at);

-- delivered = false: dropped because of a mute, a block or an admin mute. Kept (30 days, like the rest) only so the
-- limits count it and the sender cannot tell; never shown to the recipient or in the sender's export.
create table if not exists public.challenge_nudges (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid not null references public.reels (id) on delete cascade,
  delivered boolean not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint challenge_nudges_not_self check (sender_id <> recipient_id)
);
create index if not exists challenge_nudges_sender_idx on public.challenge_nudges (sender_id, created_at desc);
create index if not exists challenge_nudges_recipient_idx on public.challenge_nudges (recipient_id, created_at desc);
create index if not exists challenge_nudges_reel_idx on public.challenge_nudges (reel_id);

-- sender_id null = mute everyone.
create table if not exists public.challenge_mutes (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint challenge_mutes_not_self check (sender_id is null or sender_id <> recipient_id)
);
create unique index if not exists challenge_mutes_all_uidx on public.challenge_mutes (recipient_id) where sender_id is null;
create unique index if not exists challenge_mutes_one_uidx on public.challenge_mutes (recipient_id, sender_id) where sender_id is not null;

create table if not exists public.challenge_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge text not null check (badge in ('challenge_finisher')),
  earned_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, badge)
);

-- No row = the default (on for adults, off for everyone else).
create table if not exists public.challenge_athlete_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  allow_challenges boolean not null,
  updated_at timestamptz not null default timezone('utc', now())
);

-- An admin's hold on one sender's invites: 'mute' drops them silently, 'suspend' refuses them with a message.
create table if not exists public.challenge_sender_holds (
  sender_id uuid primary key references public.profiles (id) on delete cascade,
  hold text not null check (hold in ('mute', 'suspend')),
  reason text not null check (char_length(btrim(reason)) between 5 and 300),
  set_by uuid references public.profiles (id) on delete set null,
  set_at timestamptz not null default timezone('utc', now())
);

-- The switch history and every admin action, with the reason. The newest switch_on / switch_off row is the switch.
create table if not exists public.challenge_admin_events (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('switch_on', 'switch_off', 'sender_mute', 'sender_suspend', 'sender_clear',
                                         'retention', 'erase')),
  target_profile_id uuid references public.profiles (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 300),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists challenge_admin_events_action_idx on public.challenge_admin_events (action, id desc);

alter table public.challenge_response_quota enable row level security;
alter table public.challenge_responses enable row level security;
alter table public.challenge_nudges enable row level security;
alter table public.challenge_mutes enable row level security;
alter table public.challenge_badges enable row level security;
alter table public.challenge_athlete_settings enable row level security;
alter table public.challenge_sender_holds enable row level security;
alter table public.challenge_admin_events enable row level security;

-- The audit evidence is immutable. Retention may delete expired rows; a private helper may only null the exact
-- profile identity being erased/deleted, preserving every other column. No client has table or helper authority.
create or replace function public.guard_challenge_admin_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.tapuai_challenge_purge', true), '') = 'on' then
    return old;
  end if;
  if tg_op = 'UPDATE'
     and new.id is not distinct from old.id and new.action is not distinct from old.action
     and new.reason is not distinct from old.reason and new.detail is not distinct from old.detail
     and new.created_at is not distinct from old.created_at
     and (new.admin_id is not distinct from old.admin_id or
          (new.admin_id is null and old.admin_id::text = current_setting('app.tapuai_challenge_redact_profile', true)))
     and (new.target_profile_id is not distinct from old.target_profile_id or
          (new.target_profile_id is null and old.target_profile_id::text = current_setting('app.tapuai_challenge_redact_profile', true)))
     and (new.admin_id is distinct from old.admin_id or new.target_profile_id is distinct from old.target_profile_id) then
    return new;
  end if;
  raise exception 'Challenge admin records are kept as written.';
end;
$$;

drop trigger if exists challenge_admin_events_append_only on public.challenge_admin_events;
create trigger challenge_admin_events_append_only
  before update or delete on public.challenge_admin_events
  for each row execute function public.guard_challenge_admin_events();

-- Narrow identity-only redaction used by trusted erasure and profile deletion. Restore any enclosing setting
-- on both success and failure; the audit trigger still rejects action/reason/detail/time changes under this scope.
create or replace function public.challenge_redact_audit_identity(target uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_scope text := coalesce(current_setting('app.tapuai_challenge_redact_profile', true), '');
  redacted integer;
begin
  perform set_config('app.tapuai_challenge_redact_profile', coalesce(target::text, ''), true);
  update public.challenge_admin_events e
    set admin_id = case when e.admin_id = target then null else e.admin_id end,
        target_profile_id = case when e.target_profile_id = target then null else e.target_profile_id end
    where e.admin_id = target or e.target_profile_id = target;
  get diagnostics redacted = row_count;
  perform set_config('app.tapuai_challenge_redact_profile', previous_scope, true);
  return redacted;
exception when others then
  perform set_config('app.tapuai_challenge_redact_profile', previous_scope, true);
  raise;
end;
$$;

-- Run before the FK's SET NULL updates; those updates cannot widen the immutable audit exception.
create or replace function public.challenge_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.challenge_redact_audit_identity(old.id);
  return old;
end;
$$;
drop trigger if exists challenge_profile_identity_redaction on public.profiles;
create trigger challenge_profile_identity_redaction before delete on public.profiles
  for each row execute function public.challenge_on_profile_delete();

-- 2. Building blocks ------------------------------------------------------------------------------------------------------

-- Every public RPC binds the caller's expected canonical profile to the current JWT. This UUID is only an
-- equality check, never authority. Guests may read counts only with an explicit null; authenticated callers must
-- match a nonclosed profile. The JSON lookup remains compatible before MINOR-01 adds the closure field.
create or replace function public.challenge_expected_profile(expected_actor_id uuid, allow_guest boolean default false)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actual uuid;
begin
  if auth.uid() is null then
    if allow_guest and expected_actor_id is null then return null; end if;
    raise exception 'Account access required.';
  end if;
  select p.id into actual from public.profiles p
    where p.user_id = auth.uid() and to_jsonb(p)->>'age_blocked_at' is null limit 1;
  if actual is null then raise exception 'Sign in first.'; end if;
  if expected_actor_id is null or actual is distinct from expected_actor_id then
    raise exception 'Account access required.';
  end if;
  return actual;
end;
$$;

-- What this feature needs from PRIV-01 and MINOR-01, as readable names; empty when everything is there.
create or replace function public.challenge_missing_dependencies()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing text[] := '{}';
  tbl text;
  summary_fn regprocedure;
begin
  if to_regclass('public.friendships') is null or to_regprocedure('public.are_friends(uuid, uuid)') is null
     or to_regprocedure('public.my_profile_id()') is null or to_regprocedure('public.is_guardian_of_profile(uuid)') is null then
    missing := array_append(missing, 'PRIV-01 friends (friendships, are_friends, my_profile_id, is_guardian_of_profile)');
  end if;
  if to_regclass('public.user_blocks') is null or to_regprocedure('public.is_blocked_between(uuid, uuid)') is null then
    missing := array_append(missing, 'PRIV-01 blocks (user_blocks, is_blocked_between)');
  end if;
  if to_regprocedure('public.profile_age_band(uuid)') is null
     or not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = 'public.profiles'::regclass
                    and a.attname = 'age_blocked_at' and not a.attisdropped) then
    missing := array_append(missing, 'MINOR-01 age bands (profile_age_band, profiles.age_blocked_at)');
  end if;
  if to_regprocedure('public.caller_not_age_blocked()') is null then
    missing := array_append(missing, 'MINOR-01 closed accounts (caller_not_age_blocked)');
  end if;
  if to_regprocedure('public.log_supervision_event(uuid, text, jsonb)') is null
     or to_regprocedure('public.is_supervising_guardian(uuid)') is null
     or to_regprocedure('public.first_name_of(uuid)') is null then
    missing := array_append(missing, 'MINOR-01 supervision (log_supervision_event, is_supervising_guardian, first_name_of)');
  end if;
  summary_fn := to_regprocedure('public.supervision_json(uuid, timestamptz)');
  if summary_fn is null or position('challenge_invites_7d' in pg_catalog.pg_get_functiondef(summary_fn)) = 0 then
    missing := array_append(missing, 'the guardian summary count (re-run 20261016100000_workout_challenges.sql after MINOR-01)');
  end if;
  foreach tbl in array array['challenge_response_quota', 'challenge_responses', 'challenge_nudges', 'challenge_mutes', 'challenge_badges',
                             'challenge_athlete_settings', 'challenge_sender_holds', 'challenge_admin_events'] loop
    if not exists (select 1 from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = tbl
                   and p.policyname = 'Closed accounts' and p.permissive = 'RESTRICTIVE') then
      missing := array_append(missing, 'the "Closed accounts" policy on the challenge tables (re-run 20261016100000_workout_challenges.sql after MINOR-01)');
      exit;
    end if;
  end loop;
  return missing;
end;
$$;

create or replace function public.challenge_switch_on()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select e.action = 'switch_on' from public.challenge_admin_events e
    where e.action in ('switch_on', 'switch_off') order by e.id desc limit 1
  ), false);
$$;

-- The switch is on and nothing it needs is missing.
create or replace function public.challenges_live()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.challenge_switch_on() and cardinality(public.challenge_missing_dependencies()) = 0;
end;
$$;

-- The caller's profile, or an error: PRIV-01 / MINOR-01 missing, switched off (when `require_switch`), not signed in,
-- closed (my_profile_id is null for a closed account), or no age band this feature accepts.
create or replace function public.challenge_me(require_switch boolean)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid;
begin
  if cardinality(public.challenge_missing_dependencies()) > 0 or (require_switch and not public.challenge_switch_on()) then
    raise exception 'Workout challenges are not switched on.';
  end if;
  me := public.my_profile_id();
  if me is null then
    raise exception 'Sign in first.';
  end if;
  if public.challenge_band(me) not in ('adult', 'teen_16_17', 'teen_13_15') then
    raise exception 'Workout challenges are not available on this account.';
  end if;
  return me;
end;
$$;

-- The MINOR-01 band with the challenge rule: an unknown or missing age counts as 13–15.
create or replace function public.challenge_band(target uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  band text := public.profile_age_band(target);
begin
  return case when band in ('unknown', 'not_given') then 'teen_13_15' else band end;
end;
$$;

-- "Allow challenges on my workouts": the athlete's choice, else on for adults and off for everyone else.
create or replace function public.challenge_athlete_allows(athlete uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce(
    (select s.allow_challenges from public.challenge_athlete_settings s where s.profile_id = athlete),
    public.challenge_band(athlete) = 'adult'
  );
end;
$$;

-- Whether a post takes challenges, and whose workout it is. reason: null when it does, else not_found, not_workout,
-- vault, exclusive, not_listed (removed, no media, tag not confirmed), no_athlete_account, athlete_off.
-- media_type / photo_count are read through to_jsonb so a database without photo stories (UX-05a) still works.
create or replace function public.challenge_reel_check(target_reel_id uuid, out athlete_id uuid, out reason text)
returns record
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.reels%rowtype;
  media jsonb;
  has_media boolean;
begin
  select * into r from public.reels where id = target_reel_id;
  if not found then
    reason := 'not_found';
    return;
  end if;
  media := to_jsonb(r);
  -- Same rule as isListableReel in the app: a photo story needs its photos, a video needs its file.
  has_media := coalesce((media ->> 'photo_count')::int, 0) > 0;
  if coalesce(media ->> 'media_type', 'video') <> 'photo_story' then
    has_media := coalesce(r.video_url, '') <> '';
  end if;
  if coalesce(r.category, '') <> 'train_like_me' then
    reason := 'not_workout';
  elsif coalesce(r.is_vault_only, false) then
    reason := 'vault';
  elsif coalesce(r.is_exclusive, false) then
    reason := 'exclusive';
  elsif coalesce(r.is_removed, false) or r.player_id is null or coalesce(r.tag_status, 'confirmed') <> 'confirmed' or not has_media then
    reason := 'not_listed';
  end if;
  if reason is not null then
    return;
  end if;
  select p.id into athlete_id from public.profiles p
  where p.player_id = r.player_id and p.verification_status = 'verified' and p.age_blocked_at is null
  order by p.created_at limit 1;
  if athlete_id is null then
    reason := 'no_athlete_account';
  elsif not public.challenge_athlete_allows(athlete_id) then
    reason := 'athlete_off';
    athlete_id := null;
  end if;
end;
$$;

-- The caller may see the counts on this athlete's posts: everyone for an adult athlete; for a minor (or unknown age)
-- only the athlete and their guardian (a confirmed MINOR-01 link or the guardian on record).
create or replace function public.challenge_counts_visible(athlete uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if public.challenge_band(athlete) = 'adult' then
    return true;
  end if;
  if me is null then
    return false;
  end if;
  return me = athlete or public.is_supervising_guardian(athlete) or public.is_guardian_of_profile(athlete);
end;
$$;

create or replace function public.challenge_award_badge(target uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  if (select count(*) from public.challenge_responses c where c.responder_id = target and c.preset = 'did_it') < 3 then
    return false;
  end if;
  insert into public.challenge_badges (profile_id, badge) values (target, 'challenge_finisher') on conflict do nothing;
  get diagnostics added = row_count;
  return added > 0;
end;
$$;

-- The counts for one post as the caller may see them (the shape every participant RPC returns).
create or replace function public.challenge_counts_json(target_reel_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid;
  chk record;
  visible boolean;
  c record;
  mine text;
  hide constant integer := 5;
begin
  if not public.challenges_live() then
    return jsonb_build_object('enabled', false, 'eligible', false, 'reason', 'switched_off', 'visible', false,
                              'counts', null, 'total', null, 'mine', null, 'min_shown', hide);
  end if;
  me := public.my_profile_id();
  select * into chk from public.challenge_reel_check(target_reel_id);
  if me is not null and chk.athlete_id is not null and public.is_blocked_between(me, chk.athlete_id) then
    return jsonb_build_object('enabled', true, 'eligible', false, 'reason', 'not_listed', 'visible', false,
                              'counts', null, 'total', null, 'mine', null, 'min_shown', hide, 'can_respond', false);
  end if;
  if me is not null then
    select r.preset into mine from public.challenge_responses r where r.reel_id = target_reel_id and r.responder_id = me;
  end if;
  if chk.athlete_id is null then
    return jsonb_build_object('enabled', true, 'eligible', false, 'reason', chk.reason, 'visible', false,
                              'counts', null, 'total', null, 'mine', mine, 'min_shown', hide);
  end if;
  visible := public.challenge_counts_visible(chk.athlete_id);
  select
    count(*) filter (where r.preset = 'accepted') as accepted,
    count(*) filter (where r.preset = 'love_it') as love_it,
    count(*) filter (where r.preset = 'im_in') as im_in,
    count(*) filter (where r.preset = 'did_it') as did_it,
    count(*) as total
  into c
  from public.challenge_responses r
  join public.profiles p on p.id = r.responder_id
  where r.reel_id = target_reel_id
    and p.age_blocked_at is null
    and not public.is_blocked_between(r.responder_id, chk.athlete_id)
    and (me is null or r.responder_id = me or not public.is_blocked_between(r.responder_id, me));
  return jsonb_build_object(
    'enabled', true, 'eligible', true, 'reason', null, 'visible', visible,
    'counts', case when visible then jsonb_build_object(
      'accepted', case when c.accepted >= hide then c.accepted end,
      'love_it', case when c.love_it >= hide then c.love_it end,
      'im_in', case when c.im_in >= hide then c.im_in end,
      'did_it', case when c.did_it >= hide then c.did_it end) end,
    'total', case when visible and c.total >= hide then c.total end,
    'mine', mine,
    'min_shown', hide,
    'can_respond', me is not null and me <> chk.athlete_id
  );
end;
$$;

-- Unapplied contract change: remove every legacy overload so reapply cannot leave an unbound entrypoint.
drop function if exists public.challenge_respond(uuid, text);
drop function if exists public.challenge_counts(uuid);
drop function if exists public.challenge_invite(uuid, uuid);
drop function if exists public.challenge_mute(uuid, boolean);
drop function if exists public.challenge_inbox(integer);
drop function if exists public.challenge_my_status();
drop function if exists public.set_allow_challenges(boolean);
drop function if exists public.challenge_export_my_data();
drop function if exists public.admin_challenge_status();
drop function if exists public.admin_set_challenges_enabled(boolean, text);
drop function if exists public.admin_challenge_post_counts(integer);
drop function if exists public.admin_challenge_nudge_senders(integer);
drop function if exists public.admin_hold_challenge_sender(uuid, text, text);
drop function if exists public.admin_challenge_retention();
drop function if exists public.admin_challenge_erase(uuid, text);
drop function if exists public.challenge_admin_profile();

-- 3. Participant RPCs -------------------------------------------------------------------------------------------------

-- Answer a workout with one preset, change it, or remove it (preset null). 50 posts a day.
create or replace function public.challenge_respond(expected_actor_id uuid, target_reel_id uuid, preset text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.challenge_me(true);
  chk record;
  today integer;
  responded_at timestamptz;
  earned boolean := false;
begin
  perform public.challenge_expected_profile(expected_actor_id);
  select * into chk from public.challenge_reel_check(target_reel_id);
  if chk.athlete_id is null or public.is_blocked_between(me, chk.athlete_id) then
    raise exception 'Challenges are not open on this post.';
  end if;
  if chk.athlete_id = me then
    raise exception 'You can''t respond to your own workout.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('challenge-respond:' || me::text, 0));
  responded_at := clock_timestamp();
  delete from public.challenge_response_quota q where q.responder_id = me and q.last_responded_at <= responded_at - interval '24 hours';
  if preset is null then
    delete from public.challenge_responses r where r.reel_id = target_reel_id and r.responder_id = me;
    return public.challenge_counts_json(target_reel_id);
  end if;
  if preset not in ('accepted', 'love_it', 'im_in', 'did_it') then
    raise exception 'Choose one of the responses.';
  end if;
  select count(*) into today from public.challenge_response_quota q
  where q.responder_id = me and q.reel_id <> target_reel_id and q.last_responded_at > responded_at - interval '24 hours';
  if today >= 50 then
    raise exception 'You''ve responded to 50 workouts today. Try again tomorrow.';
  end if;
  insert into public.challenge_response_quota as q (responder_id, reel_id, last_responded_at)
  values (me, target_reel_id, responded_at)
  on conflict (responder_id, reel_id) do update set last_responded_at = excluded.last_responded_at;
  insert into public.challenge_responses as r (reel_id, responder_id, preset)
  values (target_reel_id, me, challenge_respond.preset)
  on conflict (reel_id, responder_id) do update
    set preset = excluded.preset, updated_at = timezone('utc', now())
    where r.preset is distinct from excluded.preset;
  if challenge_respond.preset = 'did_it' then
    earned := public.challenge_award_badge(me);
  end if;
  return public.challenge_counts_json(target_reel_id) || jsonb_build_object('badge_earned', earned);
end;
$$;

-- Counts per preset for one post (guests too). See challenge_counts_json for who sees what.
create or replace function public.challenge_counts(expected_actor_id uuid, target_reel_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.challenge_expected_profile(expected_actor_id, true);
  return public.challenge_counts_json(target_reel_id);
end;
$$;

-- Invite one accepted friend to try this workout. The answer is the same whether the invite was delivered or dropped
-- (mute, block, admin mute); only the limits, a non-friend and a suspended sender are refused.
create or replace function public.challenge_invite(expected_actor_id uuid, target_reel_id uuid, friend_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.challenge_me(true);
  chk record;
  hold_kind text;
  sent_today integer;
  deliver boolean;
begin
  perform public.challenge_expected_profile(expected_actor_id);
  select * into chk from public.challenge_reel_check(target_reel_id);
  if chk.athlete_id is null or public.is_blocked_between(me, chk.athlete_id) then
    raise exception 'Challenges are not open on this post.';
  end if;
  if friend_profile_id is null or friend_profile_id = me or not public.are_friends(me, friend_profile_id) then
    raise exception 'You can only invite friends.';
  end if;
  select h.hold into hold_kind from public.challenge_sender_holds h where h.sender_id = me;
  if hold_kind = 'suspend' then
    raise exception 'Invites are paused on your account.';
  end if;
  -- One sender at a time, so two taps at once cannot both pass the limits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('challenge-invite:' || me::text, 0));
  select count(*) into sent_today from public.challenge_nudges n
  where n.sender_id = me and n.created_at > timezone('utc', now()) - interval '24 hours';
  if sent_today >= 5 then
    raise exception 'You''ve sent 5 invites today. Try again tomorrow.';
  end if;
  if exists (select 1 from public.challenge_nudges n where n.sender_id = me and n.recipient_id = friend_profile_id
             and n.created_at > timezone('utc', now()) - interval '24 hours') then
    raise exception 'You''ve already invited this friend today.';
  end if;
  deliver := hold_kind is null
    and not public.is_blocked_between(me, friend_profile_id)
    and not public.is_blocked_between(friend_profile_id, chk.athlete_id)
    and not exists (select 1 from public.challenge_mutes m
                    where m.recipient_id = friend_profile_id and (m.sender_id is null or m.sender_id = me));
  insert into public.challenge_nudges (sender_id, recipient_id, reel_id, delivered)
  values (me, friend_profile_id, target_reel_id, deliver);
  delete from public.challenge_nudges n where n.created_at < timezone('utc', now()) - interval '30 days';
  return jsonb_build_object('status', 'sent', 'sent_today', sent_today + 1, 'daily_limit', 5);
end;
$$;

-- Mute invites from one sender (sender_profile_id) or from everyone (null); mute false lifts it.
create or replace function public.challenge_mute(expected_actor_id uuid, sender_profile_id uuid default null, mute boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.challenge_me(false);
begin
  perform public.challenge_expected_profile(expected_actor_id);
  if sender_profile_id = me then
    raise exception 'You can''t mute yourself.';
  end if;
  if mute then
    if sender_profile_id is null then
      insert into public.challenge_mutes (recipient_id, sender_id) values (me, null) on conflict do nothing;
    elsif exists (select 1 from public.profiles p where p.id = sender_profile_id) then
      insert into public.challenge_mutes (recipient_id, sender_id) values (me, sender_profile_id) on conflict do nothing;
    end if;
  else
    delete from public.challenge_mutes m where m.recipient_id = me and m.sender_id is not distinct from sender_profile_id;
  end if;
  return public.challenge_my_status(expected_actor_id);
end;
$$;

-- Invites to the caller for Activity (last 30 days, delivered only, not from muted or blocked senders, posts still open).
create or replace function public.challenge_inbox(expected_actor_id uuid, max_rows integer default 30)
returns table (id uuid, reel_id uuid, sender_id uuid, sender_name text, athlete_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.challenge_me(false);
begin
  perform public.challenge_expected_profile(expected_actor_id);
  if not public.challenge_switch_on() then
    return;
  end if;
  return query
    select n.id, n.reel_id, n.sender_id, public.first_name_of(n.sender_id), pl.name, n.created_at
    from public.challenge_nudges n
    join public.profiles s on s.id = n.sender_id and s.age_blocked_at is null
    join public.reels r on r.id = n.reel_id
    join public.players pl on pl.id = r.player_id
    cross join lateral public.challenge_reel_check(n.reel_id) chk
    where n.recipient_id = me and n.delivered
      and n.created_at > timezone('utc', now()) - interval '30 days'
      and not public.is_blocked_between(me, n.sender_id)
      and not exists (select 1 from public.challenge_mutes m where m.recipient_id = me and (m.sender_id is null or m.sender_id = n.sender_id))
      and chk.athlete_id is not null
      and not public.is_blocked_between(me, chk.athlete_id)
    order by n.created_at desc
    limit least(greatest(coalesce(max_rows, 30), 1), 100);
end;
$$;

-- The caller's challenge settings: athlete switch, mutes and badges.
create or replace function public.challenge_my_status(expected_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.challenge_me(false);
  athlete boolean;
  explicit boolean;
begin
  perform public.challenge_expected_profile(expected_actor_id);
  select p.player_id is not null and p.verification_status = 'verified' into athlete from public.profiles p where p.id = me;
  select s.allow_challenges into explicit from public.challenge_athlete_settings s where s.profile_id = me;
  return jsonb_build_object(
    'enabled', public.challenges_live(),
    'is_athlete', coalesce(athlete, false),
    'allow_challenges', public.challenge_athlete_allows(me),
    'allow_default', public.challenge_band(me) = 'adult',
    'allow_set', explicit is not null,
    'muted_all', exists (select 1 from public.challenge_mutes m where m.recipient_id = me and m.sender_id is null),
    'muted_senders', coalesce((
      select jsonb_agg(jsonb_build_object('profile_id', m.sender_id, 'name', public.first_name_of(m.sender_id)) order by m.created_at desc)
      from public.challenge_mutes m where m.recipient_id = me and m.sender_id is not null
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('badge', b.badge, 'earned_at', b.earned_at) order by b.earned_at)
      from public.challenge_badges b where b.profile_id = me
    ), '[]'::jsonb)
  );
end;
$$;

-- The athlete's "Allow challenges on my workouts". A change on a minor's account is a supervision event.
create or replace function public.set_allow_challenges(expected_actor_id uuid, allow boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.challenge_me(false);
  was_on boolean;
begin
  perform public.challenge_expected_profile(expected_actor_id);
  if allow is null then
    raise exception 'Choose on or off.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = me and p.player_id is not null and p.verification_status = 'verified') then
    raise exception 'Only a verified athlete account has this setting.';
  end if;
  was_on := public.challenge_athlete_allows(me);
  insert into public.challenge_athlete_settings as s (profile_id, allow_challenges) values (me, allow)
  on conflict (profile_id) do update set allow_challenges = excluded.allow_challenges, updated_at = timezone('utc', now());
  if was_on is distinct from allow then
    perform public.log_supervision_event(me, 'settings_changed',
      jsonb_build_object('keys', jsonb_build_array('allow_challenges'), 'allow_challenges', allow));
  end if;
  return public.challenge_my_status(expected_actor_id);
end;
$$;

-- The invite picker reads only the current account's accepted friends. It can load while the workout switch
-- is off, but still needs PRIV-01 / MINOR-01. The caller's claimed UUID is compared to the JWT before any
-- relationship is read; no pending requests, school information, full names or unrelated friendships leave here.
create or replace function public.challenge_friends(expected_actor_id uuid, max_rows integer default 50)
returns table (profile_id uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid;
begin
  me := public.challenge_expected_profile(expected_actor_id);
  perform public.challenge_me(false);
  if max_rows is null or max_rows < 1 or max_rows > 50 then
    raise exception 'Choose a friend limit from 1 to 50.';
  end if;
  return query
    select other.id, left(public.first_name_of(other.id), 160)
    from public.friendships f
    join public.profiles other on other.id = case when f.requester_id = me then f.addressee_id else f.requester_id end
    where (f.requester_id = me or f.addressee_id = me) and f.status = 'accepted'
      and to_jsonb(other)->>'age_blocked_at' is null
      and public.profile_age_band(other.id) <> 'under_13'
      and not public.is_blocked_between(me, other.id)
    order by other.id
    limit max_rows;
end;
$$;

-- 4. Export and erasure ---------------------------------------------------------------------------------------------------

-- Everything the challenge tables hold about one person. Sent invites never say whether they were dropped.
create or replace function public.challenge_profile_export(target uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'response_quota', coalesce((select jsonb_agg(jsonb_build_object('reel_id', q.reel_id, 'last_responded_at', q.last_responded_at) order by q.last_responded_at, q.reel_id)
                                from public.challenge_response_quota q where q.responder_id = target), '[]'::jsonb),
    'responses', coalesce((select jsonb_agg(jsonb_build_object('reel_id', r.reel_id, 'preset', r.preset, 'created_at', r.created_at, 'updated_at', r.updated_at) order by r.created_at)
                           from public.challenge_responses r where r.responder_id = target), '[]'::jsonb),
    'invites_sent', coalesce((select jsonb_agg(jsonb_build_object('reel_id', n.reel_id, 'recipient_id', n.recipient_id, 'created_at', n.created_at) order by n.created_at)
                              from public.challenge_nudges n where n.sender_id = target), '[]'::jsonb),
    'invites_received', coalesce((select jsonb_agg(jsonb_build_object('reel_id', n.reel_id, 'sender_id', n.sender_id, 'created_at', n.created_at) order by n.created_at)
                                  from public.challenge_nudges n where n.recipient_id = target and n.delivered), '[]'::jsonb),
    'mutes', coalesce((select jsonb_agg(jsonb_build_object('sender_id', m.sender_id, 'created_at', m.created_at) order by m.created_at)
                       from public.challenge_mutes m where m.recipient_id = target), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('badge', b.badge, 'earned_at', b.earned_at)) from public.challenge_badges b where b.profile_id = target), '[]'::jsonb),
    'athlete_setting', (select jsonb_build_object('allow_challenges', s.allow_challenges, 'updated_at', s.updated_at)
                        from public.challenge_athlete_settings s where s.profile_id = target)
  );
$$;

create or replace function public.challenge_export_my_data(expected_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.challenge_me(false);
begin
  perform public.challenge_expected_profile(expected_actor_id);
  return public.challenge_profile_export(me);
end;
$$;

-- Removes one person from every challenge table (their responses, invites both ways, mutes either side, badges,
-- setting, any hold and quota). Audit identity is nulled immediately while action/evidence/time survive.
-- This privileged support operation resets quota even when the profile survives; no participant RPC exposes it.
create or replace function public.challenge_erase_profile(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resp integer;
  nud integer;
  mut integer;
  bad integer;
  sett integer;
  hol integer;
  quota integer;
  audit_ids integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('challenge-respond:' || target::text, 0));
  audit_ids := public.challenge_redact_audit_identity(target);
  delete from public.challenge_response_quota where responder_id = target;
  get diagnostics quota = row_count;
  delete from public.challenge_responses where responder_id = target;
  get diagnostics resp = row_count;
  delete from public.challenge_nudges where target in (sender_id, recipient_id);
  get diagnostics nud = row_count;
  delete from public.challenge_mutes where recipient_id = target or sender_id = target;
  get diagnostics mut = row_count;
  delete from public.challenge_badges where profile_id = target;
  get diagnostics bad = row_count;
  delete from public.challenge_athlete_settings where profile_id = target;
  get diagnostics sett = row_count;
  delete from public.challenge_sender_holds where sender_id = target;
  get diagnostics hol = row_count;
  return jsonb_build_object('responses', resp, 'invites', nud, 'mutes', mut, 'badges', bad, 'settings', sett, 'holds', hol, 'response_quota', quota, 'audit_identities', audit_ids);
end;
$$;

-- 5. Guardian summary: invites received in the last 7 days (a count, never who) --------------------------------------
-- The body is 20261014110000's supervision_json with one line added (marked). Only replaced when MINOR-01 is there.

do $do$
begin
  if to_regprocedure('public.supervision_json(uuid, timestamptz)') is not null and to_regclass('public.friendships') is not null then
    execute $sj$
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
      'hidden_from_search', p.hide_from_search,
      -- CHAL-01 (20261016100000): workout challenge invites delivered in the last 7 days.
      'challenge_invites_7d', (select count(*) from public.challenge_nudges n
                               where n.recipient_id = p.id and n.delivered and n.created_at > timezone('utc', now()) - interval '7 days')
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
$sj$;
    execute 'revoke all on function public.supervision_json(uuid, timestamptz) from public, anon, authenticated';
    execute 'grant execute on function public.supervision_json(uuid, timestamptz) to service_role';
  end if;
end;
$do$;

-- 6. Admin ------------------------------------------------------------------------------------------------------------------

create or replace function public.challenge_admin_profile(expected_actor_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  admin uuid;
begin
  perform public.require_admin_guard();
  begin
    admin := public.challenge_expected_profile(expected_actor_id);
  exception when raise_exception then
    raise exception 'Admin access required.';
  end;
  return admin;
end;
$$;

-- The switch, what is missing, the last change and desk totals.
create or replace function public.admin_challenge_status(expected_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing text[];
  last_change record;
begin
  perform public.challenge_admin_profile(expected_actor_id);
  missing := public.challenge_missing_dependencies();
  select e.action, e.created_at, e.reason into last_change from public.challenge_admin_events e
  where e.action in ('switch_on', 'switch_off') order by e.id desc limit 1;
  return jsonb_build_object(
    'switched_on', public.challenge_switch_on(),
    'live', public.challenge_switch_on() and cardinality(missing) = 0,
    'missing', to_jsonb(missing),
    'changed_at', last_change.created_at,
    'change_reason', last_change.reason,
    'totals', jsonb_build_object(
      'responses', (select count(*) from public.challenge_responses),
      'responders', (select count(distinct responder_id) from public.challenge_responses),
      'invites_7d', (select count(*) from public.challenge_nudges where created_at > timezone('utc', now()) - interval '7 days'),
      'invites_dropped_7d', (select count(*) from public.challenge_nudges where not delivered and created_at > timezone('utc', now()) - interval '7 days'),
      'badges', (select count(*) from public.challenge_badges),
      'senders_held', (select count(*) from public.challenge_sender_holds),
      'athletes_on', (select count(*) from public.challenge_athlete_settings where allow_challenges),
      'athletes_off', (select count(*) from public.challenge_athlete_settings where not allow_challenges)
    )
  );
end;
$$;

-- Switch challenges on or off, with a reason. On is refused, with the missing pieces named, until PRIV-01 and MINOR-01
-- are in place.
create or replace function public.admin_set_challenges_enabled(expected_actor_id uuid, turn_on boolean, reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing text[];
begin
  perform public.challenge_admin_profile(expected_actor_id);
  if turn_on is null then
    raise exception 'Choose on or off.';
  end if;
  if char_length(btrim(coalesce(reason, ''))) < 5 then
    raise exception 'Give a reason (at least 5 characters).';
  end if;
  missing := public.challenge_missing_dependencies();
  if turn_on and cardinality(missing) > 0 then
    raise exception 'Workout challenges cannot be switched on yet. Missing: %.', array_to_string(missing, '; ');
  end if;
  insert into public.challenge_admin_events (admin_id, action, reason)
  values (public.challenge_admin_profile(expected_actor_id), case when turn_on then 'switch_on' else 'switch_off' end, btrim(reason));
  return public.admin_challenge_status(expected_actor_id);
end;
$$;

-- Aggregate counts per workout post (no names of who responded or was invited).
create or replace function public.admin_challenge_post_counts(expected_actor_id uuid, max_rows integer default 50)
returns table (
  reel_id uuid, title text, athlete_name text, posted_at timestamptz, eligible boolean, reason text,
  accepted integer, love_it integer, im_in integer, did_it integer, responses integer, invites integer, invites_7d integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  deps_ok boolean := cardinality(public.challenge_missing_dependencies()) = 0;
begin
  perform public.challenge_admin_profile(expected_actor_id);
  return query
    with resp as (
      select c.reel_id,
        count(*) filter (where c.preset = 'accepted')::int as accepted,
        count(*) filter (where c.preset = 'love_it')::int as love_it,
        count(*) filter (where c.preset = 'im_in')::int as im_in,
        count(*) filter (where c.preset = 'did_it')::int as did_it,
        count(*)::int as total
      from public.challenge_responses c group by c.reel_id
    ), inv as (
      select n.reel_id, count(*)::int as total,
        count(*) filter (where n.created_at > timezone('utc', now()) - interval '7 days')::int as week
      from public.challenge_nudges n group by n.reel_id
    )
    select r.id, r.title, pl.name, r.created_at,
      case when deps_ok then (select k.athlete_id from public.challenge_reel_check(r.id) k) is not null end,
      case when deps_ok then (select k.reason from public.challenge_reel_check(r.id) k) end,
      coalesce(resp.accepted, 0), coalesce(resp.love_it, 0), coalesce(resp.im_in, 0), coalesce(resp.did_it, 0),
      coalesce(resp.total, 0), coalesce(inv.total, 0), coalesce(inv.week, 0)
    from public.reels r
    left join public.players pl on pl.id = r.player_id
    left join resp on resp.reel_id = r.id
    left join inv on inv.reel_id = r.id
    where r.category = 'train_like_me'
    order by coalesce(resp.total, 0) + coalesce(inv.total, 0) desc, r.created_at desc
    limit least(greatest(coalesce(max_rows, 50), 1), 200);
end;
$$;

-- Invite counts per sender over the last `days` days, for spotting abuse. Recipients appear as ids only.
create or replace function public.admin_challenge_nudge_senders(expected_actor_id uuid, days integer default 7)
returns table (
  sender_id uuid, sender_username text, sent integer, delivered integer, dropped integer, recipients integer,
  recipient_ids uuid[], muted_by integer, hold text, hold_reason text, last_sent_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  window_days integer := least(greatest(coalesce(days, 7), 1), 30);
begin
  perform public.challenge_admin_profile(expected_actor_id);
  return query
    select n.sender_id, s.username,
      count(*)::int, count(*) filter (where n.delivered)::int, count(*) filter (where not n.delivered)::int,
      count(distinct n.recipient_id)::int,
      (array_agg(distinct n.recipient_id))[1:20],
      (select count(*)::int from public.challenge_mutes m where m.sender_id = n.sender_id),
      h.hold, h.reason, max(n.created_at)
    from public.challenge_nudges n
    left join public.profiles s on s.id = n.sender_id
    left join public.challenge_sender_holds h on h.sender_id = n.sender_id
    where n.created_at > timezone('utc', now()) - make_interval(days => window_days)
    group by n.sender_id, s.username, h.hold, h.reason
    order by count(*) desc, max(n.created_at) desc
    limit 100;
end;
$$;

-- Mute (drop silently), suspend (refuse) or clear one sender's invites, with a reason. Audited.
create or replace function public.admin_hold_challenge_sender(expected_actor_id uuid, sender_profile_id uuid, hold text, reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := public.challenge_admin_profile(expected_actor_id);
begin
  perform public.challenge_admin_profile(expected_actor_id);
  if hold not in ('mute', 'suspend', 'clear') then
    raise exception 'Choose mute, suspend or clear.';
  end if;
  if char_length(btrim(coalesce(reason, ''))) < 5 then
    raise exception 'Give a reason (at least 5 characters).';
  end if;
  if not exists (select 1 from public.profiles p where p.id = sender_profile_id) then
    raise exception 'No such account.';
  end if;
  if hold = 'clear' then
    delete from public.challenge_sender_holds h where h.sender_id = sender_profile_id;
  else
    insert into public.challenge_sender_holds as h (sender_id, hold, reason, set_by)
    values (sender_profile_id, admin_hold_challenge_sender.hold, btrim(reason), admin)
    on conflict (sender_id) do update set hold = excluded.hold, reason = excluded.reason, set_by = excluded.set_by,
      set_at = timezone('utc', now());
  end if;
  insert into public.challenge_admin_events (admin_id, action, target_profile_id, reason)
  values (admin, 'sender_' || admin_hold_challenge_sender.hold, sender_profile_id, btrim(reason));
  return jsonb_build_object('sender_id', sender_profile_id, 'hold', nullif(admin_hold_challenge_sender.hold, 'clear'));
end;
$$;

-- Retention: expired rolling-24h quota; invites after 30 days; admin records after 2 years (the newest switch change is always kept).
create or replace function public.admin_challenge_retention(expected_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  nud integer;
  ev integer;
  quota integer;
begin
  perform public.challenge_admin_profile(expected_actor_id);
  delete from public.challenge_response_quota where last_responded_at <= clock_timestamp() - interval '24 hours';
  get diagnostics quota = row_count;
  delete from public.challenge_nudges where created_at < timezone('utc', now()) - interval '30 days';
  get diagnostics nud = row_count;
  perform set_config('app.tapuai_challenge_purge', 'on', true);
  delete from public.challenge_admin_events e
  where e.created_at < timezone('utc', now()) - interval '2 years'
    and e.id is distinct from (select x.id from public.challenge_admin_events x where x.action in ('switch_on', 'switch_off') order by x.id desc limit 1);
  get diagnostics ev = row_count;
  perform set_config('app.tapuai_challenge_purge', 'off', true);
  insert into public.challenge_admin_events (admin_id, action, detail)
  values (public.challenge_admin_profile(expected_actor_id), 'retention', jsonb_build_object('invites', nud, 'admin_records', ev, 'response_quota', quota));
  return jsonb_build_object('invites', nud, 'admin_records', ev, 'response_quota', quota);
end;
$$;

-- Erase one person from the challenge tables (a deletion request handled by support), with a reason. Audited.
create or replace function public.admin_challenge_erase(expected_actor_id uuid, target_profile_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed jsonb;
  admin uuid := public.challenge_admin_profile(expected_actor_id);
begin
  perform public.challenge_admin_profile(expected_actor_id);
  if char_length(btrim(coalesce(reason, ''))) < 5 then
    raise exception 'Give a reason (at least 5 characters).';
  end if;
  removed := public.challenge_erase_profile(target_profile_id);
  insert into public.challenge_admin_events (admin_id, action, target_profile_id, reason, detail)
  -- Never reintroduce the erased target identity; erasing the acting admin also clears its attribution.
  values (case when admin = target_profile_id then null else admin end, 'erase', null, btrim(reason), removed);
  return removed;
end;
$$;

-- 7. Access -------------------------------------------------------------------------------------------------------------

do $$
declare
  t text;
  fn text;
begin
  foreach t in array array['challenge_response_quota', 'challenge_responses', 'challenge_nudges', 'challenge_mutes', 'challenge_badges',
                           'challenge_athlete_settings', 'challenge_sender_holds', 'challenge_admin_events'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
  execute 'revoke all on sequence public.challenge_mutes_id_seq from public, anon, authenticated';
  execute 'revoke all on sequence public.challenge_admin_events_id_seq from public, anon, authenticated';
  -- internal: other functions, triggers and the server only
  foreach fn in array array[
    'public.guard_challenge_admin_events()', 'public.challenge_redact_audit_identity(uuid)', 'public.challenge_on_profile_delete()',
    'public.challenge_missing_dependencies()', 'public.challenge_switch_on()',
    'public.challenges_live()', 'public.challenge_me(boolean)', 'public.challenge_band(uuid)', 'public.challenge_athlete_allows(uuid)',
    'public.challenge_reel_check(uuid)', 'public.challenge_counts_visible(uuid)', 'public.challenge_award_badge(uuid)',
    'public.challenge_counts_json(uuid)', 'public.challenge_profile_export(uuid)', 'public.challenge_erase_profile(uuid)',
    'public.challenge_admin_profile(uuid)', 'public.challenge_expected_profile(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  -- guests see counts on adult athletes' posts
  execute 'revoke all on function public.challenge_counts(uuid, uuid) from public';
  execute 'grant execute on function public.challenge_counts(uuid, uuid) to anon, authenticated, service_role';
  -- signed-in only (admin functions check the admin role inside)
  foreach fn in array array[
    'public.challenge_respond(uuid, uuid, text)', 'public.challenge_invite(uuid, uuid, uuid)', 'public.challenge_mute(uuid, uuid, boolean)',
    'public.challenge_inbox(uuid, integer)', 'public.challenge_my_status(uuid)', 'public.set_allow_challenges(uuid, boolean)',
    'public.challenge_export_my_data(uuid)', 'public.challenge_friends(uuid, integer)',
    'public.admin_challenge_status(uuid)', 'public.admin_set_challenges_enabled(uuid, boolean, text)',
    'public.admin_challenge_post_counts(uuid, integer)', 'public.admin_challenge_nudge_senders(uuid, integer)',
    'public.admin_hold_challenge_sender(uuid, uuid, text, text)', 'public.admin_challenge_retention(uuid)',
    'public.admin_challenge_erase(uuid, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- 8. Closed accounts (MINOR-01 rule for every RLS table), when MINOR-01 is there ------------------------------------------

do $$
declare
  t text;
begin
  if to_regprocedure('public.caller_not_age_blocked()') is null then
    raise notice 'MINOR-01 is not applied: the "Closed accounts" policy is skipped (no client can reach these tables anyway). Re-run this file after MINOR-01.';
    return;
  end if;
  foreach t in array array['challenge_response_quota', 'challenge_responses', 'challenge_nudges', 'challenge_mutes', 'challenge_badges',
                           'challenge_athlete_settings', 'challenge_sender_holds', 'challenge_admin_events'] loop
    execute format('drop policy if exists "Closed accounts" on public.%I', t);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated
                    using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))', t);
  end loop;
end;
$$;
