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

grant execute on function public.set_player_vault_locked(uuid, boolean) to anon, authenticated;
