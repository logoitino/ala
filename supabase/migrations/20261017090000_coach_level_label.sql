-- Coach-level move (SAFETY-01). Design: docs/engineering/design/COACH_LEVEL_LABEL_DESIGN.md
-- Written 2026-10-16. Not applied anywhere.
-- Adds reels.safety_label and beyond_posts.safety_label (none | coach_level, default none),
-- an append-only audit, admin add/remove with a reason, and an uploader set only on a new upload.
-- A "Risky without a coach" report is stored and never hides the clip.
-- Needs: reels, beyond_posts, reel_reports, reels_feed, beyond_post_json, report_reel, caller_not_age_blocked.
-- Rollback: drop function public.coach_label_desk(); drop function public.set_coach_label(text,uuid,text,text);
--   drop function public.set_own_coach_label(text,uuid,text);
--   drop trigger if exists reels_guard_coach_label on public.reels;
--   drop trigger if exists beyond_posts_guard_coach_label on public.beyond_posts;
--   drop function public.guard_coach_label();
--   alter table public.reels drop column if exists safety_label;
--   alter table public.beyond_posts drop column if exists safety_label;
--   drop table if exists public.safety_label_events;
--   The replaced view and report_reel stay at this definition; restore them from the previous migration if rolling back.

alter table public.reels add column if not exists safety_label text not null default 'none';
alter table public.reels drop constraint if exists reels_safety_label_check;
alter table public.reels add constraint reels_safety_label_check check (safety_label in ('none','coach_level'));

alter table public.beyond_posts add column if not exists safety_label text not null default 'none';
alter table public.beyond_posts drop constraint if exists beyond_posts_safety_label_check;
alter table public.beyond_posts add constraint beyond_posts_safety_label_check check (safety_label in ('none','coach_level'));

create table if not exists public.safety_label_events (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('reel','beyond_post')),
  target_id uuid not null,
  old_label text not null,
  new_label text not null,
  actor_id uuid,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);
alter table public.safety_label_events enable row level security;
drop policy if exists "Admin reads safety label events" on public.safety_label_events;
create policy "Admin reads safety label events" on public.safety_label_events for select to authenticated
  using (public.current_user_role() = 'admin');
drop policy if exists "Closed accounts" on public.safety_label_events;
create policy "Closed accounts" on public.safety_label_events as restrictive for all to authenticated
  using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()));
revoke all on public.safety_label_events from public, anon, authenticated;
grant select on public.safety_label_events to authenticated;

alter table public.reel_reports drop constraint if exists reel_reports_reason_check;
alter table public.reel_reports add constraint reel_reports_reason_check check (
  reason in ('fake_footage','wrong_athlete','impersonation','rights','inappropriate','other','unspecified','coach_level')
);

create or replace function public.guard_coach_label()
returns trigger language plpgsql as $$
begin
  if new.safety_label is distinct from old.safety_label
     and current_setting('tapuai.coach_label', true) is distinct from '1' then
    raise exception 'A coach-level label changes only through review.';
  end if;
  return new;
end $$;
drop trigger if exists reels_guard_coach_label on public.reels;
create trigger reels_guard_coach_label before update on public.reels
  for each row execute function public.guard_coach_label();
drop trigger if exists beyond_posts_guard_coach_label on public.beyond_posts;
create trigger beyond_posts_guard_coach_label before update on public.beyond_posts
  for each row execute function public.guard_coach_label();

create or replace function public.set_own_coach_label(target_kind text, target_id uuid, label text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_profile_id();
begin
  if me is null then raise exception 'Sign in to mark an advanced move.'; end if;
  if label is distinct from 'coach_level' or target_kind not in ('reel','beyond_post') or target_id is null then
    raise exception 'Check the coach-level label.';
  end if;
  perform set_config('tapuai.coach_label', '1', true);
  if target_kind = 'reel' then
    update public.reels set safety_label = 'coach_level'
     where id = target_id and uploaded_by = me and category = 'train_like_me' and safety_label = 'none'
       and created_at > timezone('utc', now()) - interval '20 minutes';
    if not found then raise exception 'Only the uploader can mark a new Train Like Me clip.'; end if;
  else
    update public.beyond_posts set safety_label = 'coach_level'
     where id = target_id and owner_id = me and category = 'workout' and safety_label = 'none'
       and status in ('draft','pending');
    if not found then raise exception 'Only the uploader can mark a new workout before it is shared.'; end if;
  end if;
  insert into public.safety_label_events(target_kind, target_id, old_label, new_label, actor_id, reason)
  values (target_kind, target_id, 'none', 'coach_level', me, 'uploader');
  return jsonb_build_object('target_kind', target_kind, 'target_id', target_id, 'safety_label', 'coach_level');
end $$;

create or replace function public.set_coach_label(target_kind text, target_id uuid, label text, reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_profile_id(); old text; why text := btrim(coalesce(reason,''));
begin
  if public.current_user_role() is distinct from 'admin' or me is null then raise exception 'An admin reviews coach-level labels.'; end if;
  if target_kind not in ('reel','beyond_post') or target_id is null or label not in ('none','coach_level') or char_length(why) < 8 or char_length(why) > 240 then
    raise exception 'Add a reason of at least 8 characters.';
  end if;
  perform set_config('tapuai.coach_label', '1', true);
  if target_kind = 'reel' then
    select safety_label into old from public.reels where id = target_id for update;
    if old is null then raise exception 'Highlight not found.'; end if;
    update public.reels set safety_label = label where id = target_id;
  else
    select safety_label into old from public.beyond_posts where id = target_id for update;
    if old is null then raise exception 'Beyond post not found.'; end if;
    update public.beyond_posts set safety_label = label where id = target_id;
  end if;
  if old is distinct from label then
    insert into public.safety_label_events(target_kind, target_id, old_label, new_label, actor_id, reason)
    values (target_kind, target_id, old, label, me, why);
  end if;
  return jsonb_build_object('target_kind', target_kind, 'target_id', target_id, 'safety_label', label);
end $$;

create or replace function public.coach_label_desk()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare labelled_reels int; labelled_posts int; open_suggestions int; median_hours numeric; suggestions jsonb; events jsonb;
begin
  if public.current_user_role() is distinct from 'admin' then raise exception 'An admin reviews coach-level labels.'; end if;
  select count(*) into labelled_reels from public.reels where safety_label = 'coach_level';
  select count(*) into labelled_posts from public.beyond_posts where safety_label = 'coach_level';
  select count(*) into open_suggestions from (
    select r.id from public.reels r
    where r.safety_label = 'none' and exists (select 1 from public.reel_reports rr where rr.reel_id = r.id and rr.reason = 'coach_level')
  ) s;
  select percentile_cont(0.5) within group (order by extract(epoch from (reviewed - suggested)) / 3600) into median_hours
  from (
    select e.created_at as reviewed,
      (select min(rr.created_at) from public.reel_reports rr where rr.reel_id = e.target_id and rr.reason = 'coach_level' and rr.created_at <= e.created_at) as suggested
    from public.safety_label_events e
    where e.target_kind = 'reel' and e.created_at >= date_trunc('week', timezone('utc', now()))
  ) reviews where suggested is not null;
  select coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb) into suggestions from (
    select 'reel' as kind, r.id, r.title, (select count(*) from public.reel_reports rr where rr.reel_id = r.id and rr.reason = 'coach_level') as reports
    from public.reels r
    where r.safety_label = 'none' and exists (select 1 from public.reel_reports rr where rr.reel_id = r.id and rr.reason = 'coach_level')
    order by r.created_at desc limit 50
  ) q;
  select coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb) into events from (
    select e.id, e.target_kind, e.target_id, e.old_label, e.new_label, e.actor_id, e.reason, e.created_at
    from public.safety_label_events e order by e.created_at desc limit 50
  ) q;
  return jsonb_build_object(
    'labelled_reels', labelled_reels,
    'labelled_posts', labelled_posts,
    'open_suggestions', open_suggestions,
    'median_review_hours', median_hours,
    'suggestions', suggestions,
    'events', events
  );
end $$;

revoke all on function public.guard_coach_label() from public, anon, authenticated;
revoke all on function public.set_own_coach_label(text, uuid, text) from public, anon;
revoke all on function public.set_coach_label(text, uuid, text, text) from public, anon;
revoke all on function public.coach_label_desk() from public, anon;
grant execute on function public.set_own_coach_label(text, uuid, text) to authenticated;
grant execute on function public.set_coach_label(text, uuid, text, text) to authenticated;
grant execute on function public.coach_label_desk() to authenticated;


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
  r.safety_label
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;

create or replace function public.beyond_post_json(target uuid,admin_detail boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.beyond_posts;result jsonb;begin
 select * into p from public.beyond_posts where id=target;
 if not found then return null;end if;
 result:=jsonb_build_object('id',p.id,'creator_id',p.owner_id,'category',p.category,'caption',p.caption,'audience',p.audience,'status',p.status,'revision',p.revision,'created_at',p.created_at,'submitted_at',p.submitted_at,'rights_version',p.rights_version,'safety_version',p.safety_version,'safety_label',coalesce(p.safety_label,'none'),'attested_at',p.attested_at,'cleanup',p.cleanup,'media',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'position',m.position,'kind',m.kind,'path',m.path,'mime',m.mime,'bytes',m.bytes,'width',m.width,'height',m.height,'duration_ms',m.duration_ms) order by m.position) from public.beyond_media m where m.post_id=p.id),'[]'));
 if admin_detail or public.my_profile_id()=p.owner_id then result:=result||jsonb_build_object('review_reason',p.review_reason,'reviewed_at',p.reviewed_at,'cleanup_checked_at',p.cleanup_checked_at);end if;
 if admin_detail then result:=result||jsonb_build_object('report_count',(select count(*) from public.beyond_reports r where r.post_id=p.id));end if;
 return result;end$$;

create or replace function public.report_reel(target_reel_id uuid, report_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter uuid := auth.uid();
  reason text := coalesce(nullif(trim(report_reason), ''), 'unspecified');
  result public.reels%rowtype;
  report_count integer := 0;
  hides_now boolean := false;
begin
  if reporter is null then
    raise exception 'Sign in to report a highlight.';
  end if;
  if reason not in (
    'fake_footage', 'wrong_athlete', 'impersonation', 'rights', 'inappropriate', 'other', 'unspecified', 'coach_level'
  ) then
    raise exception 'Pick a report reason.';
  end if;

  insert into public.reel_reports (reel_id, reporter_id, reason)
  values (target_reel_id, reporter, reason)
  on conflict (reel_id, reporter_id) do update
    set reason = excluded.reason;

  -- A coach-level suggestion never hides the clip and does not count toward the three-report hide.
  select count(*)::integer into report_count
  from public.reel_reports
  where reel_id = target_reel_id and reason is distinct from 'coach_level';

  if reason = 'coach_level' then
    update public.reels
    set reported_by = case
      when coalesce(reported_by, '{}'::uuid[]) @> array[reporter] then coalesce(reported_by, '{}'::uuid[])
      else array_append(coalesce(reported_by, '{}'::uuid[]), reporter)
    end
    where id = target_reel_id
    returning * into result;
  else
    select exists (
      select 1
      from public.reels r
      join public.profiles me on me.user_id = reporter
      where r.id = target_reel_id
        and (
          me.player_id = r.player_id
          or exists (
            select 1 from public.custodial_accounts ca
            where ca.player_id = r.player_id and ca.guardian_id = me.id
          )
          or exists (
            select 1 from public.players pl
            where pl.id = r.player_id and pl.guardian_id = me.id
          )
        )
    ) into hides_now;

    if reason in ('fake_footage', 'impersonation', 'rights') then
      hides_now := true;
    end if;

    update public.reels
    set
      is_flagged = hides_now or report_count >= 3 or coalesce(is_flagged, false),
      reported_by = case
        when coalesce(reported_by, '{}'::uuid[]) @> array[reporter] then coalesce(reported_by, '{}'::uuid[])
        else array_append(coalesce(reported_by, '{}'::uuid[]), reporter)
      end
    where id = target_reel_id
    returning * into result;
  end if;

  if result.id is null then
    raise exception 'Highlight not found.';
  end if;

  return jsonb_build_object(
    'id', result.id,
    'is_flagged', result.is_flagged,
    'reported_by', result.reported_by,
    'reason', reason,
    'report_count', report_count
  );
end;
$$;
