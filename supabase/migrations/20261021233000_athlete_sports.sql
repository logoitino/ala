-- MULTISPORT-01: profile-owned participation and manually chosen primary; recorded stats/media retain their sport.
-- Written locally, not applied. Requires full PRIV-01/MINOR-01 and sport_configs. Rollback is a reviewed forward
-- disable/repair migration retaining entries, career/log/media history. Never collapse records to one mutable sport.
alter table public.profiles add column if not exists athlete_sports_revision integer not null default 0 check (athlete_sports_revision >= 0);
alter table public.profiles add column if not exists athlete_sports_managed boolean not null default false;
create table if not exists public.athlete_sport_entries (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sport text not null check (char_length(sport) between 2 and 40),
  school_id uuid references public.schools_and_teams(id) on delete set null,
  team_name text check (char_length(team_name) <= 120),
  position text not null default '' check (char_length(position) <= 80),
  jersey text not null default '' check (char_length(jersey) <= 12),
  primary key(profile_id, sport)
);
alter table public.athlete_sport_entries enable row level security;
revoke all on public.athlete_sport_entries from public, anon, authenticated;
grant all on public.athlete_sport_entries to service_role;
drop policy if exists "Closed accounts" on public.athlete_sport_entries;
create policy "Closed accounts" on public.athlete_sport_entries as restrictive for all to authenticated
  using(public.caller_not_age_blocked()) with check(public.caller_not_age_blocked());
-- Preserve legacy primary fields without creating additional identities or changing verified school ownership.
insert into public.athlete_sport_entries(profile_id,sport,school_id,team_name,position,jersey)
select p.id,btrim(p.athlete_sport),p.school_id,s.name,left(coalesce(p.athlete_position,''),80),left(coalesce(p.athlete_jersey,''),12)
from public.profiles p left join public.schools_and_teams s on s.id=p.school_id
where not p.athlete_sports_managed and char_length(btrim(coalesce(p.athlete_sport,''))) between 2 and 40
on conflict do nothing;

create or replace function public.get_athlete_sports(p_profile_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.profiles;rel text;school_ok boolean;stats_ok boolean;items jsonb;begin
 select * into p from public.profiles where id=coalesce(p_profile_id,public.my_profile_id());
 if not found then return null;end if;
 rel:=public.viewer_relationship(p.id);
 -- Supervising guardians have summary rights only; the existing guardian-on-record relationship owns full reads.
 if not public.caller_not_age_blocked() or p.age_blocked_at is not null or rel='blocked'
   or (p.account_private and rel not in('self','admin','guardian','friend'))
   or (public.is_minor_band(public.profile_age_band(p.id)) and rel not in('self','admin','guardian','friend') and not public.minor_has_consent(p.id,'public_profile')) then return null;end if;
 school_ok:=public.profile_item_visible(p.id,'school');stats_ok:=public.profile_item_visible(p.id,'stats');
 select coalesce(jsonb_agg(jsonb_build_object('sport',e.sport,'school_id',case when school_ok then e.school_id end,
   'team_name',case when school_ok then e.team_name end,'position',case when stats_ok then e.position else '' end,
   'jersey',case when stats_ok and school_ok then e.jersey else '' end) order by e.sport),'[]'::jsonb)
 into items from public.athlete_sport_entries e where e.profile_id=p.id;
 return jsonb_build_object('profile_id',p.id,'primary_sport',nullif(btrim(p.athlete_sport),''),'revision',p.athlete_sports_revision,'sports',items);
end;$$;

create or replace function public.set_athlete_sports(p_profile_id uuid,p_primary_sport text,p_sports jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles;e jsonb;canonical text;primary_name text;seen text[]:='{}';normalized jsonb:='[]';school uuid;team text;pos text;jersey_text text;begin
 if auth.uid() is null or auth.role() is distinct from 'authenticated' or not public.caller_not_age_blocked() then raise exception 'ATHLETE_SPORTS_ACCESS';end if;
 select * into p from public.profiles where id=p_profile_id for update;
 if not found or p.age_blocked_at is not null or not (public.current_user_role()='admin' or (p.user_id=auth.uid() and (p.role='athlete' or 'athlete'=any(coalesce(p.roles,'{}'))))) then raise exception 'ATHLETE_SPORTS_ACCESS';end if;
 if p_expected_revision is null or p_expected_revision<>p.athlete_sports_revision then raise exception 'ATHLETE_SPORTS_REVISION_CONFLICT';end if;
 if jsonb_typeof(p_sports) is distinct from 'array' or jsonb_array_length(p_sports) not between 1 and 16 then raise exception 'ATHLETE_SPORTS_LIST';end if;
 for e in select value from jsonb_array_elements(p_sports) loop
  if jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e->'sport') is distinct from 'string' then raise exception 'ATHLETE_SPORTS_ENTRY';end if;
  select s.sport into canonical from public.sport_configs s where lower(s.sport)=lower(btrim(e->>'sport')) and s.is_active limit 1;
  -- An inactive historical entry may be retained/corrected, but cannot create a new participation.
  if canonical is null then select s.sport into canonical from public.athlete_sport_entries s where s.profile_id=p.id and lower(s.sport)=lower(btrim(e->>'sport'));end if;
  if canonical is null or lower(canonical)=any(seen) then raise exception 'ATHLETE_SPORTS_INVALID_SPORT';end if;
  seen:=array_append(seen,lower(canonical));
  if lower(canonical)=lower(btrim(p_primary_sport)) then primary_name:=canonical;end if;
  if (e ? 'school_id' and jsonb_typeof(e->'school_id') not in('string','null')) or (e ? 'team_name' and jsonb_typeof(e->'team_name') not in('string','null'))
    or (e ? 'position' and jsonb_typeof(e->'position')<>'string') or (e ? 'jersey' and jsonb_typeof(e->'jersey')<>'string') then raise exception 'ATHLETE_SPORTS_ENTRY';end if;
  school:=nullif(e->>'school_id','')::uuid;
  if school is not null and not exists(select 1 from public.schools_and_teams where id=school) then raise exception 'ATHLETE_SPORTS_SCHOOL';end if;
  team:=nullif(btrim(e->>'team_name'),'');pos:=btrim(coalesce(e->>'position',''));jersey_text:=btrim(coalesce(e->>'jersey',''));
  if char_length(team)>120 or char_length(pos)>80 or char_length(jersey_text)>12 then raise exception 'ATHLETE_SPORTS_ENTRY';end if;
  normalized:=normalized||jsonb_build_array(jsonb_build_object('sport',canonical,'school_id',school,'team_name',team,'position',pos,'jersey',jersey_text));
 end loop;
 if primary_name is null then raise exception 'ATHLETE_SPORTS_PRIMARY';end if;
 delete from public.athlete_sport_entries where profile_id=p.id;
 insert into public.athlete_sport_entries(profile_id,sport,school_id,team_name,position,jersey)
 select p.id,x.sport,x.school_id,x.team_name,x.position,x.jersey from jsonb_to_recordset(normalized) as x(sport text,school_id uuid,team_name text,position text,jersey text);
 perform set_config('app.athlete_sports_write','on',true);
 update public.profiles set athlete_sport=primary_name,athlete_position=x.position,athlete_jersey=x.jersey,athlete_sports_revision=athlete_sports_revision+1,athlete_sports_managed=true
 from jsonb_to_recordset(normalized) as x(sport text,position text,jersey text) where id=p.id and x.sport=primary_name;
 perform set_config('app.athlete_sports_write','off',true);
 return public.get_athlete_sports(p.id);
end;$$;

create or replace function public.admin_list_athlete_sports(p_search text default '',p_limit integer default 40)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'admin' then raise exception 'ATHLETE_SPORTS_ACCESS';end if;
 return coalesce((select jsonb_agg(snap||jsonb_build_object('full_name',full_name,'username',username,'player_id',player_id)) from (
 select public.get_athlete_sports(p.id) as snap,p.full_name,p.username,p.player_id from public.profiles p
 where (p.role='athlete' or 'athlete'=any(coalesce(p.roles,'{}'))) and p.age_blocked_at is null
 and (coalesce(p_search,'')='' or position(lower(left(p_search,100)) in lower(coalesce(p.full_name,'')||' '||coalesce(p.username,'')))>0)
 order by p.full_name,p.id limit greatest(1,least(coalesce(p_limit,40),40))) q),'[]'::jsonb);
end;$$;

-- Old onboarding remains valid at revision zero; opting in makes sport identity/credentials RPC-owned.
create or replace function public.guard_profile_athlete_sports()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('app.athlete_sports_write',true)='on' then return new;end if;
 if new.athlete_sports_revision is distinct from old.athlete_sports_revision or new.athlete_sports_managed is distinct from old.athlete_sports_managed or
 (old.athlete_sports_managed and (new.athlete_sport,new.athlete_position,new.athlete_jersey) is distinct from (old.athlete_sport,old.athlete_position,old.athlete_jersey)) then raise exception 'ATHLETE_SPORTS_USE_CONTROL';end if;
 if not old.athlete_sports_managed and (new.athlete_sport,new.athlete_position,new.athlete_jersey,new.school_id) is distinct from (old.athlete_sport,old.athlete_position,old.athlete_jersey,old.school_id) then new.athlete_sports_revision:=old.athlete_sports_revision+1;end if;
 return new;
end;$$;
drop trigger if exists profiles_athlete_sports_guard on public.profiles;
create trigger profiles_athlete_sports_guard before update on public.profiles for each row execute function public.guard_profile_athlete_sports();
create or replace function public.sync_legacy_athlete_sport()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.athlete_sports_managed or current_setting('app.athlete_sports_write',true)='on' then return new;end if;
 delete from public.athlete_sport_entries where profile_id=new.id;
 if char_length(btrim(coalesce(new.athlete_sport,''))) between 2 and 40 then
  insert into public.athlete_sport_entries(profile_id,sport,school_id,team_name,position,jersey)
  values(new.id,btrim(new.athlete_sport),new.school_id,(select name from public.schools_and_teams where id=new.school_id),left(coalesce(new.athlete_position,''),80),left(coalesce(new.athlete_jersey,''),12));
 end if;return new;
end;$$;
drop trigger if exists profiles_athlete_sports_legacy on public.profiles;
create trigger profiles_athlete_sports_legacy after insert or update of athlete_sport,school_id,athlete_position,athlete_jersey on public.profiles for each row execute function public.sync_legacy_athlete_sport();

-- A current one-row career record may have overwritten an older sport. Preserve untagged legacy logs
-- as unknown; staff classify the original row explicitly, never infer history from a mutable current record.
alter table public.athlete_game_logs add column if not exists sport text;
do $$ begin
 if exists(select 1 from pg_constraint where conrelid='public.athlete_career_stats'::regclass and contype='p' and array_length(conkey,1)=1) then
  alter table public.athlete_career_stats drop constraint athlete_career_stats_pkey;
  alter table public.athlete_career_stats add primary key(player_id,sport);
 end if;
end;$$;
create index if not exists athlete_game_logs_player_sport_date_idx on public.athlete_game_logs(player_id,sport,played_on desc);

create or replace function public.admin_upsert_athlete_career_stats(
  p_player_id uuid,
  p_sport text,
  p_games_played integer,
  p_scoring_value integer,
  p_volume_value integer,
  p_mvp_badges integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'admin' then raise exception 'Admin access required';end if;
  if p_player_id is null or not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Choose an athlete.';
  end if;
  if not exists(select 1 from public.sport_configs where sport=btrim(p_sport) and is_active) and not exists(select 1 from public.athlete_career_stats where player_id=p_player_id and sport=btrim(p_sport)) then raise exception 'Choose a recorded or active sport.';end if;
  if least(coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0)) < 0
     or greatest(coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0)) > 100000 then
    raise exception 'Stats must be between 0 and 100,000.';
  end if;
  insert into public.athlete_career_stats (player_id, sport, games_played, scoring_value, volume_value, mvp_badges, updated_at)
  values (p_player_id, btrim(p_sport), coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0), now())
  on conflict (player_id,sport) do update set
    games_played = excluded.games_played, scoring_value = excluded.scoring_value,
    volume_value = excluded.volume_value, mvp_badges = excluded.mvp_badges, updated_at = now();
end;
$$;

create or replace function public.admin_add_athlete_game_log(
  p_player_id uuid,
  p_played_on date,
  p_opponent_school text,
  p_stat_line text,
  p_scoring_value integer,
  p_volume_value integer,
  p_sport text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  log_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'admin' then raise exception 'Admin access required';end if;
  if not exists(select 1 from public.sport_configs where sport=btrim(p_sport) and is_active) and not exists(select 1 from public.athlete_career_stats where player_id=p_player_id and sport=btrim(p_sport)) then raise exception 'Choose a recorded or active sport.';end if;
  if p_player_id is null or not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Choose an athlete.';
  end if;
  if p_played_on is null or p_played_on > current_date or p_played_on < date '2000-01-01' then
    raise exception 'Choose the game date (not in the future).';
  end if;
  if char_length(coalesce(p_stat_line, '')) > 120 or char_length(coalesce(p_opponent_school, '')) > 120 then
    raise exception 'Keep the opponent and stat line under 120 characters.';
  end if;
  if least(coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0)) < 0 or greatest(coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0)) > 10000 then
    raise exception 'Game stats must be between 0 and 10,000.';
  end if;
  insert into public.athlete_game_logs (player_id, played_on, opponent_school, stat_line, scoring_value, volume_value,sport)
  values (p_player_id, p_played_on, btrim(coalesce(p_opponent_school, '')), btrim(coalesce(p_stat_line, '')), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0),btrim(p_sport))
  returning id into log_id;
  return log_id;
end;
$$;

-- The legacy six-argument writer works only for a single unambiguous recorded participation/career sport.
create or replace function public.admin_add_athlete_game_log(p_player_id uuid,p_played_on date,p_opponent_school text,p_stat_line text,p_scoring_value integer,p_volume_value integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare chosen text;count_sports integer;begin
 if auth.uid() is null or public.current_user_role() is distinct from 'admin' then raise exception 'Admin access required';end if;
 select count(*),min(sport) into count_sports,chosen from (
 select sport from public.athlete_career_stats where player_id=p_player_id union
 select e.sport from public.athlete_sport_entries e join public.profiles p on p.id=e.profile_id where p.player_id=p_player_id) q;
 if count_sports<>1 then raise exception 'ATHLETE_STATS_CHOOSE_SPORT';end if;
 return public.admin_add_athlete_game_log(p_player_id,p_played_on,p_opponent_school,p_stat_line,p_scoring_value,p_volume_value,chosen);
end;$$;

-- The uploaded sport is a recorded annotation. Legacy null is never inferred from a mutable profile primary.
alter table public.reels add column if not exists sport text check (sport is null or char_length(sport) between 2 and 40);
-- Existing column grants are explicit; the validated annotation needs its own insert/correction grant.
grant insert(sport),update(sport) on public.reels to authenticated;
create or replace function public.guard_reel_recorded_sport()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (TG_OP='INSERT' and new.sport is not null) or (TG_OP='UPDATE' and new.sport is distinct from old.sport) then
  if auth.uid() is null or not public.caller_not_age_blocked() or not (public.current_user_role()='admin' or new.uploaded_by=public.my_profile_id()) then raise exception 'REEL_SPORT_ACCESS';end if;
  if TG_OP='UPDATE' and public.current_user_role() is distinct from 'admin' then raise exception 'REEL_SPORT_RECORDED';end if;
  if new.sport is not null and not exists(select 1 from public.sport_configs where sport=new.sport and is_active) then raise exception 'REEL_SPORT_INVALID';end if;
 end if;return new;
end;$$;
drop trigger if exists reels_recorded_sport_guard on public.reels;
create trigger reels_recorded_sport_guard before insert or update on public.reels for each row execute function public.guard_reel_recorded_sport();

-- Keep the latest tag, avatar and Vault CASE expressions unchanged; append only recorded sport.
create or replace view public.reels_feed as
select
  r.id,
  r.title,
  -- A pending tag names the athlete only to the uploader, the athlete, their guardian and admins; a rejected tag names
  -- nobody (PRIV-01 stage 2, MINOR_SAFETY): a stranger's clip must not show a private athlete before they agree.
  case
    when r.tag_status = 'rejected' and public.current_user_role() is distinct from 'admin' then null
    when r.tag_status = 'pending' and not public.tag_party(r.uploaded_by, r.player_id) then null
    else r.player_id
  end as player_id,
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
  -- A blocked uploader's quiet rejection and a real decline look the same (see reels_apply_tag_defaults).
  r.tag_status,
  -- Who decided, and when, only on an approved tag (a decline must not reveal the athlete or guardian).
  case when r.tag_status = 'confirmed' or public.current_user_role() = 'admin' then r.tag_confirmed_at else null end as tag_confirmed_at,
  case when r.tag_status = 'confirmed' or public.current_user_role() = 'admin' then r.tag_confirmed_by else null end as tag_confirmed_by,
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
  ) as cover_path,
  r.safety_label,
  r.sport
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;

revoke all on function public.get_athlete_sports(uuid) from public,anon,authenticated;
revoke all on function public.set_athlete_sports(uuid,text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.admin_list_athlete_sports(text,integer) from public,anon,authenticated;
grant execute on function public.get_athlete_sports(uuid) to anon,authenticated;
grant execute on function public.set_athlete_sports(uuid,text,jsonb,integer) to authenticated;
grant execute on function public.admin_list_athlete_sports(text,integer) to authenticated;
revoke all on function public.admin_add_athlete_game_log(uuid,date,text,text,integer,integer,text) from public,anon;
grant execute on function public.admin_add_athlete_game_log(uuid,date,text,text,integer,integer,text) to authenticated;
revoke all on function public.guard_profile_athlete_sports(),public.sync_legacy_athlete_sport(),public.guard_reel_recorded_sport() from public,anon,authenticated;

-- Catalog context counts every currently recorded participation, including secondary sports without career totals.
create or replace function public.admin_athlete_sport_usage()
returns table(sport text,athletes bigint) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'admin' or not public.caller_not_age_blocked() then raise exception 'ATHLETE_SPORTS_ACCESS';end if;
 return query select e.sport,count(distinct e.profile_id) from public.athlete_sport_entries e join public.profiles p on p.id=e.profile_id
 where p.age_blocked_at is null and (p.role='athlete' or 'athlete'=any(coalesce(p.roles,'{}'))) group by e.sport;
end;$$;
revoke all on function public.admin_athlete_sport_usage() from public,anon,authenticated;
grant execute on function public.admin_athlete_sport_usage() to authenticated;

-- Bounded admin repairs retain original media/log identity and use null-safe expected-sport comparisons.
create or replace function public.admin_get_highlight_sport(p_reel_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.reels;begin
 if auth.uid() is null or public.current_user_role() is distinct from 'admin' or not public.caller_not_age_blocked() then raise exception 'ATHLETE_SPORTS_ACCESS';end if;
 select * into r from public.reels where id=p_reel_id;
 if not found then raise exception 'HIGHLIGHT_NOT_FOUND';end if;
 return jsonb_build_object('id',r.id,'sport',r.sport);
end;$$;
create or replace function public.admin_set_highlight_sport(p_reel_id uuid,p_sport text,p_expected_sport text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reels;begin
 if auth.uid() is null or public.current_user_role() is distinct from 'admin' or not public.caller_not_age_blocked() then raise exception 'ATHLETE_SPORTS_ACCESS';end if;
 select * into r from public.reels where id=p_reel_id for update;
 if not found then raise exception 'HIGHLIGHT_NOT_FOUND';end if;
 if r.sport is distinct from p_expected_sport then raise exception 'HIGHLIGHT_SPORT_CONFLICT';end if;
 if p_sport is not null and not exists(select 1 from public.sport_configs where sport=btrim(p_sport) and is_active) then raise exception 'REEL_SPORT_INVALID';end if;
 update public.reels set sport=case when p_sport is null then null else btrim(p_sport) end where id=r.id;
 return public.admin_get_highlight_sport(r.id);
end;$$;
create or replace function public.admin_list_unassigned_athlete_logs(p_player_id uuid,p_limit integer default 20)
returns setof public.athlete_game_logs language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'admin' or not public.caller_not_age_blocked() then raise exception 'ATHLETE_SPORTS_ACCESS';end if;
 return query select * from public.athlete_game_logs where player_id=p_player_id and sport is null order by played_on desc,id limit greatest(1,least(coalesce(p_limit,20),20));
end;$$;
create or replace function public.admin_set_athlete_game_log_sport(p_log_id uuid,p_player_id uuid,p_sport text,p_expected_sport text)
returns public.athlete_game_logs language plpgsql security definer set search_path='' as $$
declare r public.athlete_game_logs;begin
 if auth.uid() is null or public.current_user_role() is distinct from 'admin' or not public.caller_not_age_blocked() then raise exception 'ATHLETE_SPORTS_ACCESS';end if;
 select * into r from public.athlete_game_logs where id=p_log_id and player_id=p_player_id for update;
 if not found then raise exception 'ATHLETE_LOG_NOT_FOUND';end if;
 if r.sport is distinct from p_expected_sport then raise exception 'ATHLETE_LOG_SPORT_CONFLICT';end if;
 if not exists(select 1 from public.sport_configs where sport=btrim(p_sport) and is_active) then raise exception 'ATHLETE_LOG_SPORT_INVALID';end if;
 update public.athlete_game_logs set sport=btrim(p_sport) where id=r.id returning * into r;
 return r;
end;$$;
revoke all on function public.admin_get_highlight_sport(uuid),public.admin_set_highlight_sport(uuid,text,text),public.admin_list_unassigned_athlete_logs(uuid,integer),public.admin_set_athlete_game_log_sport(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_get_highlight_sport(uuid),public.admin_set_highlight_sport(uuid,text,text),public.admin_list_unassigned_athlete_logs(uuid,integer),public.admin_set_athlete_game_log_sport(uuid,uuid,text,text) to authenticated;
