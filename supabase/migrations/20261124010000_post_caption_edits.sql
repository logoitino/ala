-- POST-EDIT-01: constrain author caption edits to the current account and content version.
-- Applied: local source only. Roll back author editing by revoking the two RPC grants;
-- the previously stored caption and existing moderation decisions are not undone.

create or replace function public.edit_reel_caption(
  expected_actor_id uuid, reel_id uuid, expected_caption text, new_caption text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  locked public.reels%rowtype;
  v_caption text := btrim(new_caption, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated' then
    raise exception 'Sign in to edit this description.' using errcode = '42501';
  end if;
  -- Hold the actor row for the same write transaction so account closure cannot race the edit.
  select p.id into actor from public.profiles p
  where p.user_id = auth.uid() and p.age_blocked_at is null
  for share;
  if actor is null or actor is distinct from expected_actor_id then
    raise exception 'Your account changed. Reopen this editor.' using errcode = '42501';
  end if;
  if public.profile_age_band(actor) in ('under_13', 'not_given') then
    raise exception 'This account cannot edit descriptions.' using errcode = '42501';
  end if;
  if v_caption is null or char_length(v_caption) not between 1 and 120 then
    raise exception 'Enter a description of 1 to 120 characters.' using errcode = '22023';
  end if;

  select r.* into locked from public.reels r
  where r.id = reel_id and r.uploaded_by = actor and r.is_removed is false and r.is_flagged is false
  for update;
  if not found then
    raise exception 'This Highlight cannot be edited.' using errcode = '42501';
  end if;
  if locked.title collate pg_catalog."C" is distinct from expected_caption collate pg_catalog."C" then
    raise exception 'This description changed. Refresh and reopen the editor.' using errcode = '40001';
  end if;

  if locked.title collate pg_catalog."C" is distinct from v_caption collate pg_catalog."C" then
    update public.reels r set title = v_caption where r.id = locked.id
    returning r.* into locked;
  end if;
  return jsonb_build_object('id', locked.id, 'caption', locked.title);
end;
$$;

create or replace function public.beyond_edit_caption(
  expected_actor_id uuid, post_id uuid, expected_revision integer, new_caption text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  locked public.beyond_posts%rowtype;
  v_caption text := btrim(new_caption, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
begin
  actor := public.beyond_actor(expected_actor_id);
  -- Serialize with the existing contribution switch, including general runtime publication.
  perform 1 from public.app_runtime_config c where c.id = 'default' for share;
  if not public.beyond_enabled() or not public.beyond_owner_open(actor) then
    raise exception 'Beyond the Game is not switched on for this account.' using errcode = '42501';
  end if;
  if v_caption is null or char_length(v_caption) not between 1 and 240 then
    raise exception 'Enter a description of 1 to 240 characters.' using errcode = '22023';
  end if;

  select p.* into locked from public.beyond_posts p
  where p.id = post_id and p.owner_id = actor and p.owner_user_id = auth.uid()
    and p.status in ('pending', 'approved')
  for update;
  if not found then
    raise exception 'This Beyond post cannot be edited.' using errcode = '42501';
  end if;
  if locked.revision is distinct from expected_revision then
    raise exception 'This post changed. Refresh and reopen the editor.' using errcode = '40001';
  end if;
  if locked.caption collate pg_catalog."C" is distinct from v_caption collate pg_catalog."C" then
    -- An earlier approval covered the previous text. Keep the separate admin history, but
    -- clear the old decision from the now-pending row and force any stale reviewer to refresh.
    update public.beyond_posts p
    set caption = v_caption, status = 'pending', revision = p.revision + 1,
        reviewed_at = null, reviewer_id = null, review_reason = null
    where p.id = locked.id;
  end if;
  return public.beyond_post_json(locked.id);
end;
$$;

-- Supabase's default grants include every API role. Only authenticated authors reach these RPCs.
revoke all on function public.edit_reel_caption(uuid, uuid, text, text),
  public.beyond_edit_caption(uuid, uuid, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.edit_reel_caption(uuid, uuid, text, text),
  public.beyond_edit_caption(uuid, uuid, integer, text) to authenticated;

-- Keep the existing admin title/category edit (and uploads) during the migration. Direct
-- participant title changes would otherwise bypass the version and moderation checks above.
-- Use the invoker's effective DB role to distinguish PostgREST table writes from the checked
-- SECURITY DEFINER RPC. A JWT admin claim alone cannot stand in for the existing admin policy.
create or replace function public.guard_reel_caption_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.title collate pg_catalog."C" is distinct from new.title collate pg_catalog."C"
    and current_user in ('anon', 'authenticated')
    and (current_user <> 'authenticated'
      or auth.role() is distinct from 'authenticated'
      or public.my_profile_id() is null
      or public.current_user_role() is distinct from 'admin') then
    raise exception 'Edit the description through its editor.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_reel_caption_edit() from public, anon, authenticated, service_role;
drop trigger if exists reels_guard_caption_edit on public.reels;
create trigger reels_guard_caption_edit before update of title on public.reels
for each row execute function public.guard_reel_caption_edit();
