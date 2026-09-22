-- Athlete master Vault lock. Safe to re-run.
-- vault_locked default true: fans must subscribe to watch Vault clips.
-- The athlete can Open Vault 🌐 anytime, then Lock Vault 🔒 again.

alter table public.players add column if not exists vault_locked boolean not null default true;

drop function if exists public.set_player_vault_locked(uuid, boolean);

create or replace function public.set_player_vault_locked(target_player_id uuid, is_locked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  next_locked boolean;
begin
  if actor is null then
    raise exception 'Sign in to lock or open the Vault.';
  end if;

  -- 2026-09 audit follow-up: ownership check — see schema.sql for the full comment. Either the
  -- athlete managing their own claimed row, or school staff/admin.
  if not (
    public.current_user_role() in ('booster', 'admin', 'operator')
    or exists (
      select 1 from public.profiles p
      where p.user_id = actor
        and p.player_id = target_player_id
    )
  ) then
    raise exception 'Only the athlete, school staff, or admin may lock or open a Vault.';
  end if;

  update public.players
  set vault_locked = coalesce(is_locked, true)
  where id = target_player_id
  returning vault_locked into next_locked;

  if next_locked is null then
    raise exception 'Athlete not found.';
  end if;

  return next_locked;
end;
$$;

grant execute on function public.set_player_vault_locked(uuid, boolean) to authenticated;
