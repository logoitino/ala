-- Drop the open "Public Update Profiles" policy (STATE §5, internal-testing hole 3; development only).
--
-- Threat: UPDATE using (true) let any caller rewrite any profile row (name, bio, username, avatar, privacy settings).
-- Owners keep their own edits through "Users update own profile" (user_id = auth.uid() or admin) from schema.sql.
-- Staging never had this policy; the drop is a no-op there.
--
-- Applied: development and staging 2026-10-22 (Claude Code). Replay: scripts/replay/profile-update-replay.mjs.
-- Rollback: create policy "Public Update Profiles" on public.profiles for update using (true);

drop policy if exists "Public Update Profiles" on public.profiles;
