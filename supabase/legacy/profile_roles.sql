-- Dual Fan/Athlete capability on profiles. Safe to re-run.

alter table public.profiles
  add column if not exists roles text[] not null default array['fan']::text[];

update public.profiles
set roles = array[role]::text[]
where cardinality(coalesce(roles, array[]::text[])) = 0
  and role is not null;

update public.profiles
set roles = (
  select array_agg(distinct r)
  from unnest(roles || array[role]::text[]) as r
)
where role is not null
  and not (role = any(roles));

update public.profiles
set roles = (
  select array_agg(distinct r)
  from unnest(roles || array['fan']::text[]) as r
)
where role = 'athlete'
  and not ('fan' = any(roles));
