-- Athlete conversion + active view. Safe to re-run.

alter table public.profiles
  add column if not exists active_role text not null default 'fan';

update public.profiles
set active_role = 'athlete'
where role = 'athlete'
  and coalesce(active_role, 'fan') <> 'athlete';

drop function if exists public.add_user_role(text);

create or replace function public.add_user_role(new_role text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  next_roles text[];
  normalized text;
begin
  normalized := lower(btrim(coalesce(new_role, '')));
  if normalized = '' then
    raise exception 'role required';
  end if;

  update public.profiles
  set
    roles = (
      select coalesce(array_agg(distinct r), array[normalized]::text[])
      from unnest(
        coalesce(roles, array[]::text[])
        || array[normalized]::text[]
        || case when normalized = 'athlete' then array['fan']::text[] else array[]::text[] end
      ) as r
    ),
    role = case when normalized = 'athlete' then 'athlete' else role end,
    active_role = case
      when normalized = 'athlete' then 'athlete'
      when normalized in ('fan', 'athlete') then normalized
      else coalesce(nullif(active_role, ''), 'fan')
    end
  where user_id = auth.uid()
  returning roles into next_roles;

  return next_roles;
end;
$$;

grant execute on function public.add_user_role(text) to anon, authenticated;
