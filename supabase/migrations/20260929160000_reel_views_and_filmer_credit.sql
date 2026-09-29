-- =============================================================================================
-- Highlight views on profiles + credit for the fan who filmed the clip
-- =============================================================================================
-- Owner request 2026-09-29: every clip keeps its own Seki / Aura / Flex and views from other
-- accounts, "the same feeling as other social platforms" — hype on the clip, views on the
-- athlete's page — and fans who upload get visible credit.
--
-- What changes:
--   1. reels_feed gains view_count, uploader_name, uploader_avatar_url (appended, so existing
--      readers are unaffected). Views were already counted by record_reel_view (one per signed-in
--      viewer per clip per day, never the uploader or tagged athlete) but no client could read them.
--      The app now counts a view only after 3 s of real playback (lib/leaderboards.ts VIEW_PLAY_MS).
--   2. athlete_highlight_views(player): total counted views on that athlete's confirmed clips —
--      the number on their profile.
--   3. filmer_stats(profile): clips a fan filmed that the athlete confirmed, and their total views
--      and hype. Credit only; no money.
--
-- Roll back:
--   drop function public.filmer_stats(uuid); drop function public.athlete_highlight_views(uuid);
--   then re-create reels_feed from schema.sql's "2026-09 audit (paywall bypass)" block (drop view
--   first — create or replace cannot remove columns).
-- =============================================================================================

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
  up.avatar_url as uploader_avatar_url
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;

grant select on public.reels_feed to anon, authenticated;

create or replace function public.athlete_highlight_views(target_player_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(r.view_count), 0)::integer
  from public.reels r
  where r.player_id = target_player_id
    and r.tag_status = 'confirmed'
    and not coalesce(r.is_removed, false);
$$;

grant execute on function public.athlete_highlight_views(uuid) to anon, authenticated;

create or replace function public.filmer_stats(target_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clips', count(*)::integer,
    'views', coalesce(sum(r.view_count), 0)::integer,
    'hype', coalesce(sum(r.seki_count + r.aura_count + r.flex_count), 0)::integer
  )
  from public.reels r
  where r.uploaded_by = target_profile_id
    and r.tag_status = 'confirmed'
    and not coalesce(r.is_removed, false);
$$;

grant execute on function public.filmer_stats(uuid) to anon, authenticated;
