-- Fan-first Open Vault. Safe to re-run.
-- is_vault_only defaults false (public feed). toggle_reel_vault_status flips it
-- and keeps is_exclusive in lockstep for older clients.

alter table public.reels add column if not exists is_exclusive boolean not null default false;
alter table public.reels add column if not exists is_vault_only boolean not null default false;

update public.reels
set is_vault_only = true
where coalesce(is_exclusive, false) = true
  and coalesce(is_vault_only, false) = false;

drop function if exists public.toggle_reel_vault_status(uuid);

create or replace function public.toggle_reel_vault_status(target_reel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  next_vault boolean;
begin
  if actor is null then
    raise exception 'Sign in to change vault status.';
  end if;

  update public.reels
  set
    is_vault_only = not coalesce(is_vault_only, is_exclusive, false),
    is_exclusive = not coalesce(is_vault_only, is_exclusive, false)
  where id = target_reel_id
  returning is_vault_only into next_vault;

  if next_vault is null then
    raise exception 'Highlight not found.';
  end if;

  return next_vault;
end;
$$;

grant execute on function public.toggle_reel_vault_status(uuid) to anon, authenticated;
