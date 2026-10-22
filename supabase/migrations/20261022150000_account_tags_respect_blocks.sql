-- Account tags respect blocks (workstream 4 RLS review of 20261002160000).
--
-- Threat: block_user removes pending mentions only at the moment of blocking, and search hides blocked accounts, but
-- tag_reel_accounts accepted any profile id, so a blocked person could keep sending new tag requests by id.
-- Now a profile in a block with the uploader (either direction) is skipped silently; the blocked person is not told,
-- as elsewhere in PRIV-01. Also pins search_path to '' (every reference is already qualified). Body otherwise
-- identical to 20261002160000.
--
-- Applied: not yet. Replay: scripts/replay/account-tags-replay.mjs.
-- Rollback: re-run tag_reel_accounts from 20261002160000_reel_account_tags.sql.

create or replace function public.tag_reel_accounts(target_reel_id uuid, profile_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  added integer := 0;
  next_id uuid;
begin
  if auth.uid() is null or target_reel_id is null then
    raise exception 'Sign in before tagging accounts' using errcode = '42501';
  end if;
  select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
  if actor is null then
    raise exception 'An account is required to tag accounts' using errcode = '42501';
  end if;
  -- Lock the owned reel before counting: concurrent calls cannot each consume the last slot.
  perform 1 from public.reels r
  where r.id = target_reel_id and r.uploaded_by = actor
  for update;
  if not found then
    raise exception 'Only the uploader may tag accounts on this Highlight' using errcode = '42501';
  end if;

  foreach next_id in array coalesce(profile_ids, '{}'::uuid[])
  loop
    continue when public.is_blocked_between(actor, next_id);
    exit when (
      select count(*) from public.reel_account_tags t
      where t.reel_id = target_reel_id and t.status <> 'rejected'
    ) >= 3;
    insert into public.reel_account_tags (reel_id, profile_id, status)
    values (target_reel_id, next_id, 'pending')
    on conflict (reel_id, profile_id) do nothing;
    if found then
      added := added + 1;
    end if;
  end loop;
  return added;
end;
$$;
