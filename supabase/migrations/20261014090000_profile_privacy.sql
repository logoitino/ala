-- Profile privacy, two-way friends and blocking — stage 1 of PRIV-01 (2026-10-14).
--
-- Purpose
--   Owner decisions 2026-10-13 (docs/engineering/design/PROFILE_PRIVACY_DESIGN.md): accounts are public or private
--   (new accounts private), each profile item has an audience (everyone / friends / only me), friends are two-way,
--   people can block others, and people can hide from search. A private
--   athlete's name, approved-tagged Highlights, Donate, Rally / gear goals and Join Crew stay public.
--   Before this, `profiles` was readable by anyone (guests included), so the old hide switches only hid things from the
--   app's own screens. This migration closes direct reads of other people's rows and enforces every rule in SQL.
--
--   1. Settings live in new columns (account_private, profile_audience, hide_from_search, tag_review,
--      friend_requests_from). Existing accounts keep today's behaviour (public; each old
--      switch maps true → everyone, false → only me; friends list only me). New accounts get the private defaults.
--      Changes go only through set_my_privacy (a trigger refuses direct column writes), so the minor-account rules
--      (20261014110000_minor_accounts.sql) cannot be bypassed; older app builds that write the legacy profile_visibility switches are
--      mirrored into the new audience, fail-closed (a re-shown item becomes friends, not everyone).
--   2. friendships (requests, accepted, declined with a 30-day cooldown that the requester is never told about),
--      user_blocks (the blocked person is not told). Neither table accepts direct client writes.
--   3. viewer_relationship(target) and profile_item_visible(target, item) are the single rule; profiles_public is
--      rebuilt on them (user_id removed from it), and `profiles` SELECT becomes own row or admin.
--   4. Abuse limits: 20 friend requests a day, "who can send me requests", blocked people cannot request, join the
--      Crew (enforced in the crew_follows policy too) or appear in each other's searches; account search needs a
--      3-character username prefix.
--   5. crew_follows reads close (the follower, the athlete's own account and admins; counts still come from
--      get_crew_graph); get_crew_graph finds the athlete's account by player_id, not by matching names.
--   6. Search (account tags, local athlete search, the Aura board) respects hide-from-search and blocks.
--   Stage 2 (tags) and the screens follow in separate changes.
--
-- Owner: PROFILE (via ENGINEERING, CTO), with CREW, DISCOVERY, ADMIN; reviews RLS_SECURITY, PRIVACY_ENGINEERING,
--   MINOR_SAFETY, CUSTODIAL, DATA_GOVERNANCE. The guardian lock in the first draft was replaced before anything was
--   applied: owner 2026-10-14, a guardian supervises and approves a few changes instead (20261014110000_minor_accounts.sql).
-- Safe to re-run: add column if not exists; backfills touch only null rows; create or replace; drop policy if exists.
-- Applied: written 2026-10-14, not applied anywhere. Apply after the 2026-10-13 security files.
-- Rollback: recreate "Public read profiles" (using (true)) and "Public read crew follows" (using (true)), restore the
--   previous profiles_public view from schema.sql history; the new tables and columns can stay (unused).
--   Stage 1 review (2026-10-14) applied: helpers that answer about other people are not client-callable; the public
--   view is read only through get_public_profiles (named accounts, so hide-from-search holds); a blocked person sees a
--   guest's view; photos and full names no longer leak through reels_feed, the boards, Spotlight, donor and tag lists;
--   friend-request limits use a log; tag search escapes wildcards; one relationship lookup per view row.
-- Known limit: the avatars bucket is public, so hiding the photo hides the URL from other people but not a file whose
--   URL someone already has (WORK_QUEUE P1-02 follow-up: private avatars with signed URLs).

-- 1. Settings ------------------------------------------------------------------------------------------------------

alter table public.profiles add column if not exists account_private boolean;
alter table public.profiles add column if not exists profile_audience jsonb;
alter table public.profiles add column if not exists hide_from_search boolean not null default false;
alter table public.profiles add column if not exists tag_review text not null default 'review_all';
alter table public.profiles add column if not exists friend_requests_from text not null default 'everyone';

alter table public.profiles drop constraint if exists profiles_tag_review_check;
alter table public.profiles add constraint profiles_tag_review_check check (tag_review in ('review_all', 'auto_friends'));
alter table public.profiles drop constraint if exists profiles_friend_requests_from_check;
alter table public.profiles add constraint profiles_friend_requests_from_check check (friend_requests_from in ('everyone', 'teens', 'nobody'));

-- Existing accounts keep what they had (explicit backfill; only rows not yet migrated).
update public.profiles set account_private = false where account_private is null;
update public.profiles
set profile_audience = jsonb_build_object(
  'photo', 'everyone',
  'bio', case when coalesce((profile_visibility ->> 'bio')::boolean, true) then 'everyone' else 'only_me' end,
  'school', case when coalesce((profile_visibility ->> 'school')::boolean, true) then 'everyone' else 'only_me' end,
  'social_links', case when coalesce((profile_visibility ->> 'social_links')::boolean, true) then 'everyone' else 'only_me' end,
  'stats', case when coalesce((profile_visibility ->> 'stats')::boolean, true) then 'everyone' else 'only_me' end,
  'aura', 'everyone',
  'crew', 'everyone',
  'friends_list', 'only_me'
)
where profile_audience is null;

-- New accounts: private, with the private defaults (fail closed).
alter table public.profiles alter column account_private set default true;
alter table public.profiles alter column account_private set not null;
alter table public.profiles alter column profile_audience set default
  '{"photo":"friends","bio":"friends","school":"friends","social_links":"only_me","stats":"friends","aura":"friends","crew":"friends","friends_list":"only_me"}'::jsonb;
alter table public.profiles alter column profile_audience set not null;

-- One verified account per roster athlete, so "the athlete's account" is unambiguous (skipped with a notice if data
-- already has duplicates; an admin resolves them first).
do $$
begin
  if not exists (
    select 1 from public.profiles where verification_status = 'verified' and player_id is not null
    group by player_id having count(*) > 1
  ) then
    create unique index if not exists profiles_verified_player_uidx
      on public.profiles (player_id) where verification_status = 'verified' and player_id is not null;
  else
    raise warning 'profiles_verified_player_uidx SKIPPED: more than one verified account per athlete exists. Resolve the duplicates, then re-run this file.';
  end if;
end;
$$;

-- 2. Friends and blocks ---------------------------------------------------------------------------------------------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'declined'))
);
create unique index if not exists friendships_pair_uidx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, created_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- Every request ever sent, so the daily and per-person limits cannot be reset by cancelling and asking again.
create table if not exists public.friend_request_log (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists friend_request_log_requester_idx on public.friend_request_log (requester_id, created_at desc);

alter table public.friendships enable row level security;
alter table public.friend_request_log enable row level security;
alter table public.user_blocks enable row level security;

-- 3. The rule -------------------------------------------------------------------------------------------------------

create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.user_blocks u
    where (u.blocker_id = a and u.blocked_id = b) or (u.blocker_id = b and u.blocked_id = a)
  );
$$;

-- The guardian of an athlete's account: players.guardian_id for the roster athlete the account is linked to.
create or replace function public.is_guardian_of_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles t
    join public.players pl on pl.id = t.player_id
    where t.id = target and pl.guardian_id is not null and pl.guardian_id = public.my_profile_id()
  );
$$;

-- self, admin, guardian, blocked, friend, stranger or guest — for the signed-in caller looking at `target`.
create or replace function public.viewer_relationship(target uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if target is null then
    return 'guest';
  end if;
  if me is not null and me = target then
    return 'self';
  end if;
  if public.current_user_role() = 'admin' then
    return 'admin';
  end if;
  if me is null then
    return 'guest';
  end if;
  if public.is_guardian_of_profile(target) then
    return 'guardian';
  end if;
  if public.is_blocked_between(me, target) then
    return 'blocked';
  end if;
  if public.are_friends(me, target) then
    return 'friend';
  end if;
  return 'stranger';
end;
$$;

create or replace function public.privacy_default_audience()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{"photo":"friends","bio":"friends","school":"friends","social_links":"only_me","stats":"friends","aura":"friends","crew":"friends","friends_list":"only_me"}'::jsonb;
$$;

-- The audience rule on its own (no lookups), so a view can work out the viewer once per row and reuse it.
create or replace function public.audience_allows(rel text, is_private boolean, audience jsonb, item text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  level text;
begin
  if rel in ('self', 'admin', 'guardian') then
    return true;
  end if;
  if rel is null or rel = 'blocked' then
    return false;
  end if;
  level := coalesce(audience ->> item, public.privacy_default_audience() ->> item, 'only_me');
  if level = 'friends' then
    return rel = 'friend';
  end if;
  if level = 'everyone' then
    return rel = 'friend' or not coalesce(is_private, true);
  end if;
  return false;
end;
$$;

-- Whether the caller may see one item of `target`'s profile. Unknown item, setting or account → hidden (fail closed).
create or replace function public.profile_item_visible(target uuid, item text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.audience_allows(public.viewer_relationship(p.id), p.account_private, p.profile_audience, item)
    from public.profiles p where p.id = target
  ), false);
$$;

-- Whether a roster athlete's linked account hides from this caller's search.
create or replace function public.player_hidden_from_viewer(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.player_id = target_player_id
      and (
        (p.hide_from_search and public.viewer_relationship(p.id) not in ('self', 'admin', 'guardian', 'friend'))
        or public.viewer_relationship(p.id) = 'blocked'
      )
  );
$$;

-- 4. Direct reads close; the public view applies the rule ---------------------------------------------------------

drop policy if exists "Public read profiles" on public.profiles;
drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles
  for select using (user_id = auth.uid() or public.current_user_role() = 'admin');

drop function if exists public.get_public_profiles(uuid[], uuid[], text);
drop view if exists public.profiles_public;
create view public.profiles_public as
select
  pr.id,
  pr.player_id,
  pr.username,
  -- Accounts not linked to a roster athlete show strangers a username or first name, not the full name.
  case
    when pr.player_id is not null or v.rel in ('self', 'admin', 'guardian', 'friend') then pr.full_name
    else coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''), 'Fan')
  end as full_name,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'photo') then pr.avatar_url else null end as avatar_url,
  pr.is_verified,
  pr.is_verified_athlete,
  public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'school') as school_visible,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'bio') then pr.bio else null end as bio,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'social_links') then pr.social_links else '{}'::jsonb end as social_links,
  -- Sport is public athlete identity (clips and donations depend on it).
  case when pr.player_id is not null and (pr.role = 'athlete' or 'athlete' = any(coalesce(pr.roles, '{}'::text[])))
    then nullif(btrim(pr.athlete_sport), '') else null end as athlete_sport,
  pr.verification_status,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'school') then pr.school_id else null end as school_id,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'aura') then pr.aura_points else null end as aura_points,
  pr.account_private,
  -- A blocked person sees the same as a guest and is not told; the blocker sees 'blocked' (to offer Unblock).
  case
    when v.rel = 'blocked' and not exists (
      select 1 from public.user_blocks u where u.blocker_id = public.my_profile_id() and u.blocked_id = pr.id
    ) then 'guest'
    else v.rel
  end as viewer_relation,
  public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'stats') as stats_visible,
  public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'crew') as crew_visible,
  public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'friends_list') as friends_visible,
  -- The school-confirmed badge is public even when the school itself is hidden.
  (pr.school_id is not null) as school_confirmed
from public.profiles pr
cross join lateral (select public.viewer_relationship(pr.id) as rel) v;

-- No directory: the view is read only through get_public_profiles, for named accounts (hide-from-search holds).
revoke all on public.profiles_public from public, anon, authenticated;
grant select on public.profiles_public to service_role;

create or replace function public.get_public_profiles(
  profile_ids uuid[] default null,
  player_ids uuid[] default null,
  handle text default null
)
-- An explicit column list (not `setof profiles_public`) so re-running the schema can drop and rebuild the view.
returns table (
  id uuid, player_id uuid, username text, full_name text, avatar_url text, is_verified boolean,
  is_verified_athlete boolean, school_visible boolean, bio text, social_links jsonb, athlete_sport text,
  verification_status text, school_id uuid, aura_points integer, account_private boolean, viewer_relation text,
  stats_visible boolean, crew_visible boolean, friends_visible boolean, school_confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.*
  from public.profiles_public v
  where v.id = any(coalesce((profile_ids)[1:50], '{}'::uuid[]))
     or v.player_id = any(coalesce((player_ids)[1:50], '{}'::uuid[]))
     or (nullif(btrim(handle), '') is not null and lower(v.username) = lower(btrim(handle)));
$$;

-- Stats follow the stats audience; a roster athlete nobody has claimed has no owner to choose, so stays visible.
create or replace function public.athlete_stats_visible(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.profile_item_visible(pr.id, 'stats') from public.profiles pr where pr.player_id = target_player_id
     order by (pr.verification_status = 'verified') desc limit 1),
    true
  );
$$;

-- 5. Writes to privacy columns go through the functions below -----------------------------------------------------

create or replace function public.guard_profiles_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  was boolean;
  now_on boolean;
begin
  if coalesce(current_setting('app.tapuai_privacy_write', true), '') = 'on' or public.is_trusted_server() then
    return new;
  end if;
  if new.account_private is distinct from old.account_private
     or new.profile_audience is distinct from old.profile_audience
     or new.hide_from_search is distinct from old.hide_from_search
     or new.tag_review is distinct from old.tag_review
     or new.friend_requests_from is distinct from old.friend_requests_from then
    raise exception 'Change privacy settings from Profile → Privacy.';
  end if;
  -- Older app builds still write the four legacy switches: mirror them and fail closed.
  if new.profile_visibility is distinct from old.profile_visibility then
    foreach k in array array['bio', 'school', 'stats', 'social_links'] loop
      was := coalesce((old.profile_visibility ->> k)::boolean, true);
      now_on := coalesce((new.profile_visibility ->> k)::boolean, true);
      if was and not now_on then
        new.profile_audience := jsonb_set(new.profile_audience, array[k], '"only_me"');
      elsif now_on and not was then
        if coalesce(new.profile_audience ->> k, 'only_me') = 'only_me' then
          new.profile_audience := jsonb_set(new.profile_audience, array[k], '"friends"');
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_privacy_guard on public.profiles;
create trigger profiles_privacy_guard
  before update on public.profiles
  for each row execute function public.guard_profiles_privacy();

create or replace function public.privacy_settings_json(target uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'account_private', p.account_private,
    'audience', public.privacy_default_audience() || coalesce(p.profile_audience, '{}'::jsonb),
    'hide_from_search', p.hide_from_search,
    'tag_review', p.tag_review,
    'friend_requests_from', p.friend_requests_from
  )
  from public.profiles p where p.id = target;
$$;

-- Applies a settings object to one profile (callers check who may change what first).
create or replace function public.apply_privacy_settings(target uuid, settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.profiles%rowtype;
  next_private boolean;
  next_audience jsonb;
  next_hide boolean;
  next_review text;
  next_requests text;
  k text;
  v text;
begin
  select * into cur from public.profiles where id = target;
  if not found then
    raise exception 'Account not found.';
  end if;
  settings := coalesce(settings, '{}'::jsonb);
  next_private := coalesce((settings ->> 'account_private')::boolean, cur.account_private);
  next_hide := coalesce((settings ->> 'hide_from_search')::boolean, cur.hide_from_search);
  next_review := coalesce(settings ->> 'tag_review', cur.tag_review);
  next_requests := coalesce(settings ->> 'friend_requests_from', cur.friend_requests_from);
  next_audience := public.privacy_default_audience() || coalesce(cur.profile_audience, '{}'::jsonb);
  if jsonb_typeof(settings -> 'audience') = 'object' then
    for k, v in select key, value #>> '{}' from jsonb_each(settings -> 'audience') loop
      if not (public.privacy_default_audience() ? k) then
        raise exception 'Unknown profile item: %', k;
      end if;
      if v not in ('everyone', 'friends', 'only_me') then
        raise exception 'Choose everyone, friends or only me.';
      end if;
      next_audience := jsonb_set(next_audience, array[k], to_jsonb(v));
    end loop;
  end if;
  -- 'teens' (requests only from accounts aged 13–17, plus a linked guardian) is the teen default; its rules live in
  -- 20261014110000_minor_accounts.sql.
  if next_review not in ('review_all', 'auto_friends') or next_requests not in ('everyone', 'teens', 'nobody') then
    raise exception 'That setting is not available.';
  end if;
  perform set_config('app.tapuai_privacy_write', 'on', true);
  update public.profiles
  set account_private = next_private, profile_audience = next_audience, hide_from_search = next_hide,
      tag_review = next_review, friend_requests_from = next_requests
  where id = target;
  perform set_config('app.tapuai_privacy_write', 'off', true);
  return public.privacy_settings_json(target);
end;
$$;

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
  return public.privacy_settings_json(me);
end;
$$;

create or replace function public.set_my_privacy(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in to change your privacy settings.';
  end if;
  return public.apply_privacy_settings(me, settings);
end;
$$;

-- 6. Friends ---------------------------------------------------------------------------------------------------------

-- Friend requests can be turned off by the owner (feature switch privacy.friends = false in the published config).
create or replace function public.friend_requests_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (c.published -> 'features' ->> 'privacy.friends')::boolean
    from public.app_runtime_config c where c.id = 'default'
  ), true);
$$;

-- Returns 'friends' or 'requested'. The same message covers blocked, closed and unknown accounts.
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
  if not found or t.id = me or public.is_blocked_between(me, t.id) or t.friend_requests_from = 'nobody' then
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

create or replace function public.respond_friend(request_id uuid, accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  f public.friendships%rowtype;
begin
  select * into f from public.friendships where id = request_id;
  if not found or f.addressee_id is distinct from me or f.status <> 'pending' then
    raise exception 'That request is no longer waiting.';
  end if;
  update public.friendships
  set status = case when accept then 'accepted' else 'declined' end, responded_at = timezone('utc', now())
  where id = request_id;
  return case when accept then 'friends' else 'declined' end;
end;
$$;

-- Unfriend, or cancel my own pending request. A decline the requester is waiting out stays in place.
create or replace function public.remove_friend(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, target_profile_id)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, target_profile_id)
    and (f.status in ('accepted', 'pending') or f.addressee_id = me);
end;
$$;

create or replace function public.list_my_friends()
returns table (request_id uuid, profile_id uuid, display_name text, username text, avatar_url text, status text, since timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    return;
  end if;
  return query
  select
    f.id,
    o.id,
    case when f.status = 'accepted' or o.player_id is not null then o.full_name
         else coalesce(nullif(btrim(o.username), ''), nullif(split_part(btrim(coalesce(o.full_name, '')), ' ', 1), ''), 'Fan') end,
    o.username,
    case when public.profile_item_visible(o.id, 'photo') then o.avatar_url else null end,
    case when f.status = 'accepted' then 'friend' when f.addressee_id = me then 'incoming' else 'outgoing' end,
    coalesce(f.responded_at, f.created_at)
  from public.friendships f
  join public.profiles o on o.id = case when f.requester_id = me then f.addressee_id else f.requester_id end
  where (f.requester_id = me or f.addressee_id = me)
    and (f.status in ('accepted', 'pending'))
    and not public.is_blocked_between(me, o.id)
  order by (f.status = 'pending' and f.addressee_id = me) desc, coalesce(f.responded_at, f.created_at) desc
  limit 500;
end;
$$;

-- 7. Blocks ----------------------------------------------------------------------------------------------------------

-- Ends the friendship, any requests, Crew follows both ways and pending tags/mentions between the two accounts.
create or replace function public.block_user(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  mine public.profiles%rowtype;
  theirs public.profiles%rowtype;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  select * into theirs from public.profiles where id = target_profile_id;
  if not found or theirs.id = me then
    raise exception 'You can''t block this account.';
  end if;
  select * into mine from public.profiles where id = me;
  insert into public.user_blocks (blocker_id, blocked_id) values (me, theirs.id) on conflict do nothing;
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, theirs.id)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, theirs.id);
  if mine.player_id is not null and theirs.user_id is not null then
    delete from public.crew_follows where follower_id = theirs.user_id and athlete_id = mine.player_id;
  end if;
  if theirs.player_id is not null and mine.user_id is not null then
    delete from public.crew_follows where follower_id = mine.user_id and athlete_id = theirs.player_id;
  end if;
  -- Their pending tags of me end like a decline (untagged; nobody named). The tag-write flag lets this through the
  -- stage 2 trigger, which otherwise refuses status changes from anyone but the athlete's review (RLS_SECURITY P1).
  if mine.player_id is not null then
    -- Remembered as an automatic decline (rejected_by null) once stage 2 exists, so an admin can undo it.
    if to_regclass('public.reel_tag_rejections') is not null then
      execute 'insert into public.reel_tag_rejections (reel_id, player_id, uploader_id, rejected_by)
               select r.id, r.player_id, r.uploaded_by, null from public.reels r
               where r.uploaded_by = $1 and r.player_id = $2 and r.tag_status = ''pending''
               on conflict (reel_id, player_id) do nothing'
        using theirs.id, mine.player_id;
    end if;
    perform set_config('app.tapuai_tag_write', 'on', true);
    update public.reels set tag_status = 'rejected', player_id = null, tag_confirmed_at = null, tag_confirmed_by = null
    where uploaded_by = theirs.id and player_id = mine.player_id and tag_status = 'pending';
    perform set_config('app.tapuai_tag_write', 'off', true);
  end if;
  if to_regclass('public.reel_account_tags') is not null then
    execute 'delete from public.reel_account_tags t using public.reels r
             where r.id = t.reel_id and t.status = ''pending''
               and ((t.profile_id = $1 and r.uploaded_by = $2) or (t.profile_id = $2 and r.uploaded_by = $1))'
      using me, theirs.id;
  end if;
end;
$$;

create or replace function public.unblock_user(target_profile_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.user_blocks where blocker_id = public.my_profile_id() and blocked_id = target_profile_id;
$$;

create or replace function public.list_my_blocks()
returns table (profile_id uuid, display_name text, username text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id,
    coalesce(nullif(btrim(o.username), ''), nullif(split_part(btrim(coalesce(o.full_name, '')), ' ', 1), ''), 'Account'),
    o.username, u.created_at
  from public.user_blocks u
  join public.profiles o on o.id = u.blocked_id
  where u.blocker_id = public.my_profile_id()
  order by u.created_at desc;
$$;

-- 8. Reads that used to touch other people's profiles rows -------------------------------------------------------

-- Which of these roster athletes have a linked account (roster "claimed" badge). Ids only.
create or replace function public.claimed_player_ids(target_player_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.player_id from public.profiles p
  where p.player_id = any(coalesce(target_player_ids, '{}'::uuid[]));
$$;

-- The Aura board: only people whose Aura this caller may see, never hidden-from-search or blocked accounts.
create or replace function public.get_aura_board(max_rows integer default 20)
returns table (id uuid, username text, display_name text, aura_points integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.username, c.display_name, c.aura_points
  from (
    select p.id, p.username,
      case when p.player_id is not null then p.full_name
           else coalesce(nullif(btrim(p.username), ''), nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'Fan') end
        as display_name,
      p.aura_points, p.hide_from_search
    from public.profiles p
    where coalesce(p.aura_points, 0) > 0
    order by p.aura_points desc
    limit 200
  ) c
  where public.profile_item_visible(c.id, 'aura')
    and (not c.hide_from_search or public.viewer_relationship(c.id) in ('self', 'admin', 'guardian', 'friend'))
  order by c.aura_points desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

-- Account tag search: a username prefix of at least 3 characters (wildcards are escaped, not stripped); hidden and
-- blocked accounts never appear.
create or replace function public.search_taggable_accounts(search_query text)
returns table (id uuid, label text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := replace(replace(replace(btrim(coalesce(search_query, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  if auth.uid() is null or char_length(btrim(coalesce(search_query, ''))) < 3 then
    return;
  end if;
  return query
  select p.id, public.account_tag_label(p) as label
  from public.profiles p
  where p.username ilike q || '%'
    and (not p.hide_from_search or public.viewer_relationship(p.id) in ('self', 'admin', 'guardian', 'friend'))
    and public.viewer_relationship(p.id) <> 'blocked'
  order by p.username nulls last
  limit 8;
end;
$$;

-- Local search: athletes whose account hides from search (or blocked this caller) are left out.
create or replace function public.search_local_entities(search_query text, entity_kind text default 'all')
returns table (
  entity_type text,
  entity_id text,
  title text,
  subtitle text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  needle text := btrim(coalesce(search_query, ''));
  kind text := lower(btrim(coalesce(entity_kind, 'all')));
begin
  if char_length(needle) < 2 then
    return;
  end if;
  if kind not in ('all', 'athlete', 'school', 'booster') then
    kind := 'all';
  end if;

  if kind in ('all', 'athlete') and to_regclass('public.players') is not null then
    return query
    select
      'athlete'::text,
      p.id::text,
      p.name,
      coalesce(nullif(p.school_name, ''), coalesce(p.team, ''))
    from public.players p
    where (p.name ilike '%' || needle || '%'
       or p.school_name ilike '%' || needle || '%'
       or coalesce(p.team, '') ilike '%' || needle || '%')
      and not public.player_hidden_from_viewer(p.id)
    order by p.name
    limit 20;
  end if;

  if kind in ('all', 'school') and to_regclass('public.games') is not null then
    return query
    select
      'school'::text,
      min(school_name) as entity_id,
      min(school_name) as title,
      'High school'::text as subtitle
    from (
      select distinct btrim(label) as school_name
      from (
        select g.home_school as label from public.games g
        union all
        select g.away_school from public.games g
        union all
        select g.home_team from public.games g
        union all
        select g.away_team from public.games g
      ) raw
      where btrim(coalesce(label, '')) <> ''
    ) names
    where school_name ilike '%' || needle || '%'
    group by lower(school_name)
    order by min(school_name)
    limit 20;
  end if;

  if kind in ('all', 'booster') and to_regclass('public.sponsorships') is not null then
    return query
    select
      'booster'::text,
      s.id::text,
      s.business_name,
      coalesce(s.school_team, '')
    from public.sponsorships s
    where s.business_name ilike '%' || needle || '%'
       or coalesce(s.school_team, '') ilike '%' || needle || '%'
    order by s.business_name
    limit 20;
  end if;
end;
$$;

-- 9. Crew -------------------------------------------------------------------------------------------------------------

create or replace function public.crew_follow_blocked(target_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles a
    where a.player_id = target_athlete_id and public.is_blocked_between(a.id, public.my_profile_id())
  );
$$;

drop policy if exists "Public read crew follows" on public.crew_follows;
drop policy if exists "Read own or own athlete crew follows" on public.crew_follows;
create policy "Read own or own athlete crew follows" on public.crew_follows
  for select using (
    follower_id = auth.uid()
    or public.current_user_role() = 'admin'
    or exists (select 1 from public.profiles p where p.player_id = crew_follows.athlete_id and p.user_id = auth.uid())
  );

drop policy if exists "Users write own crew follows" on public.crew_follows;
create policy "Users write own crew follows"
  on public.crew_follows for all
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid() and not public.crew_follow_blocked(athlete_id));

create or replace function public.get_crew_graph(target_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  crew_n integer := 0;
  squad_n integer := 0;
  is_following boolean := false;
  is_mutual boolean := false;
  viewer_player uuid;
  athlete_user uuid;
begin
  select count(*)::int into crew_n
  from public.crew_follows
  where athlete_id = target_athlete_id;

  -- The athlete's account by its roster link (it used to match names, which two athletes can share).
  select p.user_id into athlete_user
  from public.profiles p
  where p.player_id = target_athlete_id and p.user_id is not null
  order by (p.verification_status = 'verified') desc
  limit 1;

  if athlete_user is not null then
    select count(*)::int into squad_n
    from public.crew_follows
    where follower_id = athlete_user;
  end if;

  if actor is not null then
    select exists(
      select 1
      from public.crew_follows
      where follower_id = actor
        and athlete_id = target_athlete_id
    ) into is_following;

    select p.player_id into viewer_player
    from public.profiles p
    where p.user_id = actor and p.player_id is not null
    limit 1;

    if is_following and viewer_player is not null and athlete_user is not null then
      select exists(
        select 1
        from public.crew_follows
        where follower_id = athlete_user
          and athlete_id = viewer_player
      ) into is_mutual;
    end if;
  end if;

  return jsonb_build_object(
    'crew_count', coalesce(crew_n, 0),
    'squad_count', coalesce(squad_n, 0),
    'following', coalesce(is_following, false),
    'mutual', coalesce(is_mutual, false)
  );
end;
$$;

create or replace function public.toggle_crew_follow(target_athlete_id uuid, should_join boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in to join the Crew.';
  end if;

  if not exists (select 1 from public.players where id = target_athlete_id) then
    raise exception 'Athlete not found.';
  end if;

  if should_join then
    if public.crew_follow_blocked(target_athlete_id) then
      raise exception 'You can''t join this Crew.';
    end if;
    insert into public.crew_follows (follower_id, athlete_id)
    values (actor, target_athlete_id)
    on conflict (follower_id, athlete_id) do nothing;
  else
    delete from public.crew_follows
    where follower_id = actor
      and athlete_id = target_athlete_id;
  end if;

  return public.get_crew_graph(target_athlete_id);
end;
$$;

-- 10. Admin -------------------------------------------------------------------------------------------------------

create or replace function public.admin_get_privacy(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return public.privacy_settings_json(target_profile_id) || jsonb_build_object(
    'friend_count', (select count(*) from public.friendships f where f.status = 'accepted' and target_profile_id in (f.requester_id, f.addressee_id)),
    'pending_incoming', (select count(*) from public.friendships f where f.status = 'pending' and f.addressee_id = target_profile_id),
    'pending_outgoing', (select count(*) from public.friendships f where f.status = 'pending' and f.requester_id = target_profile_id),
    -- from the request log, so cancelled requests still count (the spam signal)
    'requests_sent_7d', (select count(*) from public.friend_request_log l where l.requester_id = target_profile_id and l.created_at > timezone('utc', now()) - interval '7 days'),
    'blocks_made', (select count(*) from public.user_blocks u where u.blocker_id = target_profile_id),
    'blocks_received', (select count(*) from public.user_blocks u where u.blocked_id = target_profile_id)
  );
end;
$$;

create or replace function public.admin_reset_privacy(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return public.apply_privacy_settings(target_profile_id, jsonb_build_object(
    'account_private', true, 'audience', public.privacy_default_audience(),
    'hide_from_search', false, 'tag_review', 'review_all', 'friend_requests_from', 'everyone'));
end;
$$;

create or replace function public.admin_set_hide_from_search(target_profile_id uuid, hidden boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return public.apply_privacy_settings(target_profile_id, jsonb_build_object('hide_from_search', coalesce(hidden, true)));
end;
$$;

create or replace function public.admin_end_friendship(profile_a uuid, profile_b uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  perform public.require_admin_guard();
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(profile_a, profile_b)
    and greatest(f.requester_id, f.addressee_id) = greatest(profile_a, profile_b);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.admin_privacy_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return jsonb_build_object(
    'private_accounts', (select count(*) from public.profiles where account_private),
    'public_accounts', (select count(*) from public.profiles where not account_private),
    'hidden_from_search', (select count(*) from public.profiles where hide_from_search),
    'friendships', (select count(*) from public.friendships where status = 'accepted'),
    'requests_7d', (select count(*) from public.friend_request_log where created_at > timezone('utc', now()) - interval '7 days'),
    'blocks_7d', (select count(*) from public.user_blocks where created_at > timezone('utc', now()) - interval '7 days'),
    'friend_requests_enabled', public.friend_requests_enabled()
  );
end;
$$;


-- 12. Photos and names outside profiles_public (stage 1 review) ------------------------------------------------

-- One account's photo for this caller, or null. Narrow on purpose: invoker views (reels_feed) can call it without
-- clients getting the general visibility helper.
create or replace function public.visible_avatar_url(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.profile_item_visible(p.id, 'photo') then p.avatar_url else null end
  from public.profiles p where p.id = target;
$$;

-- reels_feed: the uploader's photo follows their photo audience (it used to bypass it).
create or replace view public.reels_feed as
select
  r.id,
  r.title,
  r.player_id,
  r.game_id,
  r.created_at,
  r.seki_count,
  r.aura_count,
  r.flex_count,
  r.total_tips_cents,
  r.is_exclusive,
  r.is_vault_only,
  r.is_flagged,
  r.reported_by,
  r.is_removed,
  r.category,
  r.flash_unlock_until,
  r.uploaded_by,
  r.tag_status,
  r.tag_confirmed_at,
  r.tag_confirmed_by,
  case
    when coalesce(r.is_vault_only, false) = false then r.video_url
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then r.video_url
    when public.current_user_role() = 'admin' then r.video_url
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then r.video_url
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then r.video_url
    else ''
  end as video_url,
  coalesce(r.view_count, 0) as view_count,
  -- Handle first, else first name only: the clip credit never shows a fan's full name.
  -- Null when the tagged athlete posted it themself (no "Filmed by" on your own clip).
  case
    when r.player_id is not null and up.player_id = r.player_id then null
    else coalesce(
      nullif(btrim(up.username), ''),
      nullif(split_part(btrim(coalesce(up.full_name, '')), ' ', 1), '')
    )
  end as uploader_name,
  public.visible_avatar_url(up.id) as uploader_avatar_url,
  r.media_type,
  r.photo_count,
  (
    select case
      when coalesce(r.is_vault_only, false) = false then ph.image_path
      when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then ph.image_path
      when public.current_user_role() = 'admin' then ph.image_path
      when auth.uid() is not null and r.uploaded_by = (
        select p.id from public.profiles p where p.user_id = auth.uid() limit 1
      ) then ph.image_path
      when auth.uid() is not null and r.player_id is not null and exists (
        select 1 from public.subscriptions s
        where s.subscriber_id = auth.uid()
          and s.athlete_id = r.player_id
          and s.status = 'active'
      ) then ph.image_path
      else ''
    end
    from public.reel_photos ph
    where ph.reel_id = r.id and ph.position = 0
  ) as cover_path
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;


-- get_leaderboards: fans board respects photo audience, hide-from-search and blocks.
create or replace function public.get_leaderboards(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  board_limit constant integer := 10;
  result jsonb;
begin
  select * into bounds from public.spotlight_window(kind);

  with eligible as (
    select r.id, r.title, r.player_id, r.uploaded_by, r.created_at, r.category,
      p.name as player_name, coalesce(nullif(btrim(p.school_name), ''), '') as school_name
    from public.reels r
    join public.players p on p.id = r.player_id
    where r.tag_status = 'confirmed'
      and coalesce(r.is_removed, false) = false
      and coalesce(r.is_flagged, false) = false
      and coalesce(r.is_vault_only, false) = false
      and coalesce(r.is_exclusive, false) = false
  ),
  hype as (
    select v.reel_id, v.user_id, v.kind
    from public.reel_hype_votes v
    join eligible e on e.id = v.reel_id
    where v.created_at::date between bounds.window_start and bounds.window_end
  ),
  views as (
    select w.reel_id, w.viewer_id
    from public.reel_views w
    join eligible e on e.id = w.reel_id
    where w.view_day between bounds.window_start and bounds.window_end
  ),
  reel_scores as (
    select e.*,
      coalesce((select count(*) from hype h where h.reel_id = e.id), 0)::int as hype,
      coalesce((select count(*) from views w where w.reel_id = e.id), 0)::int as views
    from eligible e
  ),
  player_scores as (
    select rs.player_id, max(rs.player_name) as name, max(rs.school_name) as school_name,
      sum(rs.hype)::int as hype, sum(rs.views)::int as views,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'seki'), 0)::int as seki,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'aura'), 0)::int as aura,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'flex'), 0)::int as flex
    from reel_scores rs
    group by rs.player_id
  ),
  school_fans as (
    select e.school_name, h.user_id as fan from hype h join eligible e on e.id = h.reel_id
    union
    select e.school_name, w.viewer_id as fan from views w join eligible e on e.id = w.reel_id
  ),
  school_scores as (
    select rs.school_name,
      sum(rs.hype)::int as hype,
      count(*) filter (where rs.created_at::date between bounds.window_start and bounds.window_end)::int as highlights,
      coalesce((select count(distinct sf.fan) from school_fans sf where sf.school_name = rs.school_name), 0)::int as fans
    from reel_scores rs
    where rs.school_name <> ''
    group by rs.school_name
  ),
  fan_scores as (
    select pr.id as profile_id,
      coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(pr.full_name), ' ', 1), ''), 'Fan') as name,
      case when public.profile_item_visible(pr.id, 'photo') then pr.avatar_url else null end as avatar_url,
      coalesce((select count(*) from hype h where h.user_id = pr.user_id), 0)::int as hype_given,
      coalesce((select count(*) from eligible e where e.uploaded_by = pr.id
        and e.created_at::date between bounds.window_start and bounds.window_end), 0)::int as clips_tagged
    from public.profiles pr
    where (exists (select 1 from hype h where h.user_id = pr.user_id)
      or exists (select 1 from eligible e where e.uploaded_by = pr.id
        and e.created_at::date between bounds.window_start and bounds.window_end))
      -- hidden-from-search and blocked accounts are left off the fans board
      and (not pr.hide_from_search or public.viewer_relationship(pr.id) in ('self', 'admin', 'guardian', 'friend'))
      and public.viewer_relationship(pr.id) <> 'blocked'
  )
  select jsonb_build_object(
    'period_kind', kind,
    'start_date', bounds.window_start,
    'end_date', bounds.window_end,
    'players_hype', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.hype desc, ps.views desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.hype desc, ps.views desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'hype', ps.hype, 'seki', ps.seki, 'aura', ps.aura, 'flex', ps.flex, 'views', ps.views
          ) as row_data
        from player_scores ps
        where ps.hype > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'players_views', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.views desc, ps.hype desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.views desc, ps.hype desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'views', ps.views, 'hype', ps.hype
          ) as row_data
        from player_scores ps
        where ps.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'highlights', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc),
            'reel_id', rs.id, 'title', rs.title, 'category', rs.category,
            'player_id', rs.player_id, 'name', rs.player_name, 'school_name', rs.school_name,
            'views', rs.views, 'hype', rs.hype
          ) as row_data
        from reel_scores rs
        where rs.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'schools', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name),
            'school_name', ss.school_name, 'hype', ss.hype, 'highlights', ss.highlights,
            'fans', ss.fans, 'score', ss.hype + ss.highlights * 10 + ss.fans * 5
          ) as row_data
        from school_scores ss
        where ss.hype + ss.highlights + ss.fans > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'fans', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name),
            'profile_id', fs.profile_id, 'name', fs.name, 'avatar_url', fs.avatar_url,
            'hype_given', fs.hype_given, 'clips_tagged', fs.clips_tagged,
            'score', fs.clips_tagged * 10 + fs.hype_given
          ) as row_data
        from fan_scores fs
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- get_top_filmers: same rules as the fans board.
create or replace function public.get_top_filmers(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
begin
  select * into bounds from public.spotlight_window(kind);

  return coalesce((
    with eligible as (
      select r.id, r.uploaded_by
      from public.reels r
      join public.profiles up on up.id = r.uploaded_by
      where r.tag_status = 'confirmed'
        and not coalesce(r.is_removed, false)
        and not coalesce(r.is_flagged, false)
        and not coalesce(r.is_vault_only, false)
        and (r.player_id is null or up.player_id is distinct from r.player_id)
    ),
    scores as (
      select e.uploaded_by as profile_id,
        count(distinct e.id)::int as clips,
        coalesce(sum((select count(*) from public.reel_views w
          where w.reel_id = e.id and w.view_day between bounds.window_start and bounds.window_end)), 0)::int as views,
        coalesce(sum((select count(*) from public.reel_hype_votes v
          where v.reel_id = e.id and v.created_at::date between bounds.window_start and bounds.window_end)), 0)::int as hype,
        coalesce(sum((select count(*) from public.filmer_props fp
          where fp.reel_id = e.id and fp.created_at::date between bounds.window_start and bounds.window_end)), 0)::int as props
      from eligible e
      group by e.uploaded_by
    ),
    ranked as (
      select s.*, s.views + s.hype * 3 + s.props * 5 as score,
        coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''), 'Filmer') as name,
        case when public.profile_item_visible(pr.id, 'photo') then pr.avatar_url else null end as avatar_url
      from scores s
      join public.profiles pr on pr.id = s.profile_id
      where s.views + s.hype + s.props > 0
        and (not pr.hide_from_search or public.viewer_relationship(pr.id) in ('self', 'admin', 'guardian', 'friend'))
        and public.viewer_relationship(pr.id) <> 'blocked'
    )
    select jsonb_agg(row_data order by rank)
    from (
      select row_number() over (order by rk.score desc, rk.name) as rank,
        jsonb_build_object(
          'rank', row_number() over (order by rk.score desc, rk.name),
          'profile_id', rk.profile_id, 'name', rk.name, 'avatar_url', rk.avatar_url,
          'clips', rk.clips, 'views', rk.views, 'hype', rk.hype, 'props', rk.props, 'score', rk.score
        ) as row_data
      from ranked rk
      order by rank
      limit 10
    ) t
  ), '[]'::jsonb);
end;
$$;

-- get_spotlight_standings: a filmer with no username shows a first name, never a full name.
create or replace function public.get_spotlight_standings(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  leaders jsonb;
begin
  select * into bounds from public.spotlight_window(kind);

  select coalesce(jsonb_agg(ranked.row_data order by ranked.hype desc, ranked.created_at desc), '[]'::jsonb)
    into leaders
  from (
    select
      jsonb_build_object(
        'rank', row_number() over (order by scored.hype desc, scored.created_at desc),
        'player_id', scored.player_id,
        'name', scored.player_name,
        'school_name', scored.school_name,
        'hype', scored.hype,
        'seki', scored.seki,
        'aura', scored.aura,
        'flex', scored.flex,
        'reel_id', scored.reel_id,
        'title', scored.clip_title,
        'shot_by', scored.shot_by
      ) as row_data,
      scored.hype,
      scored.created_at
    from (
      select
        p.id as player_id,
        p.name as player_name,
        p.school_name,
        sum(coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0))::int as hype,
        sum(coalesce(r.seki_count, 0))::int as seki,
        sum(coalesce(r.aura_count, 0))::int as aura,
        sum(coalesce(r.flex_count, 0))::int as flex,
        (
          select hot.id
          from public.reels hot
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as reel_id,
        (
          select hot.title
          from public.reels hot
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as clip_title,
        (
          select coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''))
          from public.reels hot
          left join public.profiles pr on pr.id = hot.uploaded_by
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as shot_by,
        max(r.created_at) as created_at
      from public.reels r
      join public.players p on p.id = r.player_id
      where r.tag_status = 'confirmed'
        and public.athlete_is_varsity_verified(p.id)
        and coalesce(r.is_removed, false) = false
        and coalesce(r.is_vault_only, false) = false
        and coalesce(r.is_flagged, false) = false
        and coalesce(r.category, 'game_play') = 'game_play'
        and coalesce(r.media_type, 'video') = 'video'
        and r.created_at::date between bounds.window_start and bounds.window_end
      group by p.id, p.name, p.school_name
      having sum(coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0)) > 0
    ) scored
  ) ranked;

  return jsonb_build_object(
    'period_kind', kind,
    'start_date', bounds.window_start,
    'end_date', bounds.window_end,
    'leaders', coalesce(leaders, '[]'::jsonb)
  );
end;
$$;

-- get_pending_player_tags: the uploader's first name, not full name.
create or replace function public.get_pending_player_tags()
returns table (
  id uuid,
  title text,
  video_url text,
  player_id uuid,
  player_name text,
  school_name text,
  created_at timestamptz,
  seki_count integer,
  aura_count integer,
  flex_count integer,
  uploader_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid;
  role_name text := public.current_user_role();
begin
  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  return query
  select
    r.id,
    r.title,
    r.video_url,
    r.player_id,
    p.name,
    p.school_name,
    r.created_at,
    coalesce(r.seki_count, 0),
    coalesce(r.aura_count, 0),
    coalesce(r.flex_count, 0),
    coalesce(nullif(split_part(btrim(coalesce(uploader.full_name, '')), ' ', 1), ''), nullif(btrim(uploader.username), ''))
  from public.reels r
  join public.players p on p.id = r.player_id
  left join public.profiles uploader on uploader.id = r.uploaded_by
  where r.tag_status = 'pending'
    and coalesce(r.is_removed, false) = false
    and not (coalesce(r.media_type, 'video') = 'photo_story' and coalesce(r.photo_count, 0) = 0)
    and (
      -- 2026-09 audit follow-up: dropped the `auth.role() = 'anon'` bypass alongside
      -- `can_confirm_player_tag`'s matching fix, above.
      role_name = 'admin'
      or public.can_confirm_player_tag(r.player_id)
    )
  order by r.created_at desc
  limit 40;
end;
$$;

-- get_donations_to_thank: the donor's first name, not full name.
create or replace function public.get_donations_to_thank(target_player_id uuid)
returns table (
  tip_id uuid,
  amount_cents integer,
  created_at timestamptz,
  fan_name text,
  rally_title text,
  thanked_key text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.rally_manager_role(target_player_id) not in ('athlete', 'guardian', 'admin') then
    return;
  end if;
  return query
  select
    t.id,
    t.amount_cents,
    t.created_at,
    coalesce(nullif(split_part(btrim(coalesce(f.full_name, '')), ' ', 1), ''), 'A fan') as fan_name,
    r.title as rally_title,
    dt.message_key as thanked_key
  from public.tips t
  left join public.profiles f on f.user_id = t.fan_id
  left join public.rallies r on r.id = t.rally_id
  left join public.donation_thanks dt on dt.tip_id = t.id
  where t.player_id = target_player_id
    and t.fan_id is not null
  order by t.created_at desc
  limit 50;
end;
$$;

-- 11. Access ---------------------------------------------------------------------------------------------------------

revoke all on table public.friendships from public, anon, authenticated;
revoke all on table public.user_blocks from public, anon, authenticated;
revoke all on table public.friend_request_log from public, anon, authenticated;
grant select on table public.friendships to authenticated;
grant select on table public.user_blocks to authenticated;

drop policy if exists "Parties read friendships" on public.friendships;
create policy "Parties read friendships" on public.friendships
  for select to authenticated
  using (addressee_id = public.my_profile_id() or (requester_id = public.my_profile_id() and status <> 'declined'));

drop policy if exists "Blocker reads own blocks" on public.user_blocks;
create policy "Blocker reads own blocks" on public.user_blocks
  for select to authenticated using (blocker_id = public.my_profile_id());

do $$
declare
  stmt text;
  fn text;
begin
  foreach stmt in array array[
    -- internal helpers: callable from views, policies and other functions; harmless booleans for clients
    'grant execute on function public.my_profile_id() to anon, authenticated, service_role',
    'revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated',
    'grant execute on function public.are_friends(uuid, uuid) to service_role',
    'revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated',
    'grant execute on function public.is_blocked_between(uuid, uuid) to service_role',
    'revoke all on function public.is_guardian_of_profile(uuid) from public, anon, authenticated',
    'grant execute on function public.is_guardian_of_profile(uuid) to service_role',
    'revoke all on function public.viewer_relationship(uuid) from public, anon, authenticated',
    'grant execute on function public.viewer_relationship(uuid) to service_role',
    'grant execute on function public.privacy_default_audience() to anon, authenticated, service_role',
    'grant execute on function public.audience_allows(text, boolean, jsonb, text) to anon, authenticated, service_role',
    'grant execute on function public.visible_avatar_url(uuid) to anon, authenticated, service_role',
    'revoke all on function public.get_public_profiles(uuid[], uuid[], text) from public',
    'grant execute on function public.get_public_profiles(uuid[], uuid[], text) to anon, authenticated, service_role',
    'revoke all on function public.profile_item_visible(uuid, text) from public, anon, authenticated',
    'grant execute on function public.profile_item_visible(uuid, text) to service_role',
    'grant execute on function public.player_hidden_from_viewer(uuid) to anon, authenticated, service_role',
    'grant execute on function public.crew_follow_blocked(uuid) to anon, authenticated, service_role',
    'grant execute on function public.athlete_stats_visible(uuid) to anon, authenticated, service_role',
    'grant execute on function public.claimed_player_ids(uuid[]) to anon, authenticated, service_role',
    'grant execute on function public.get_aura_board(integer) to anon, authenticated, service_role',
    'grant execute on function public.search_local_entities(text, text) to anon, authenticated, service_role',
    'grant execute on function public.friend_requests_enabled() to anon, authenticated, service_role',
    -- guests browse athlete profiles, including Crew counts
    'grant execute on function public.get_crew_graph(uuid) to anon, authenticated, service_role',
    -- signed-in only
    'revoke all on function public.privacy_settings_json(uuid) from public, anon, authenticated',
    'revoke all on function public.apply_privacy_settings(uuid, jsonb) from public, anon, authenticated',
    'revoke all on function public.guard_profiles_privacy() from public, anon, authenticated',
    'revoke all on function public.search_taggable_accounts(text) from public, anon',
    'grant execute on function public.search_taggable_accounts(text) to authenticated, service_role',
    'grant execute on function public.privacy_settings_json(uuid) to service_role',
    'grant execute on function public.apply_privacy_settings(uuid, jsonb) to service_role'
  ] loop
    fn := substring(stmt from 'function (public\.[a-z_]+\([^)]*\))');
    if to_regprocedure(fn) is not null then
      execute stmt;
    end if;
  end loop;
  foreach fn in array array[
    'public.get_my_privacy()', 'public.set_my_privacy(jsonb)', 'public.request_friend(uuid)', 'public.respond_friend(uuid, boolean)',
    'public.remove_friend(uuid)', 'public.list_my_friends()', 'public.block_user(uuid)', 'public.unblock_user(uuid)',
    'public.list_my_blocks()', 'public.admin_get_privacy(uuid)', 'public.admin_reset_privacy(uuid)',
    'public.admin_set_hide_from_search(uuid, boolean)',
    'public.admin_end_friendship(uuid, uuid)', 'public.admin_privacy_report()',
    'public.toggle_crew_follow(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- 13. Safety check for databases with extra policies (staging was built by hand) -------------------------------------
do $$
declare
  extra text;
begin
  select string_agg(tablename || ': ' || policyname, ', ') into extra
  from pg_policies
  where schemaname = 'public' and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL')
    and ((tablename = 'profiles' and policyname not in ('Read own profile or admin', 'Users update own profile', 'Users insert own profile'))
      or (tablename = 'crew_follows' and policyname not in ('Read own or own athlete crew follows', 'Users write own crew follows')));
  if extra is not null then
    raise exception 'Other read policies still open these tables (%). Review and drop them, then re-run.', extra;
  end if;
end;
$$;
