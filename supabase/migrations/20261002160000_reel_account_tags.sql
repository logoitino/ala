-- Account tags on a Highlight.
-- Purpose: the uploader can mention up to 3 Tapua'i accounts. The name stays private until that
-- account confirms. Donations still follow the athlete tag (`reels.player_id`), not these mentions.
-- Depends on: public.reels, public.profiles.
-- Rollback:
--   drop function if exists public.confirm_account_tag(uuid, text);
--   drop function if exists public.get_my_account_tags();
--   drop function if exists public.get_reel_account_tags(uuid);
--   drop function if exists public.tag_reel_accounts(uuid, uuid[]);
--   drop function if exists public.search_taggable_accounts(text);
--   drop table if exists public.reel_account_tags;

create table if not exists public.reel_account_tags (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (reel_id, profile_id),
  constraint reel_account_tags_status_check check (status in ('pending', 'confirmed', 'rejected'))
);

create index if not exists reel_account_tags_profile_idx
  on public.reel_account_tags (profile_id, status);

alter table public.reel_account_tags enable row level security;

drop policy if exists "Public read confirmed account tags" on public.reel_account_tags;
create policy "Public read confirmed account tags"
  on public.reel_account_tags for select
  to anon, authenticated
  using (status = 'confirmed');

drop policy if exists "Tagged account and uploader read their tags" on public.reel_account_tags;
create policy "Tagged account and uploader read their tags"
  on public.reel_account_tags for select
  to authenticated
  using (
    profile_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
    or exists (
      select 1 from public.reels r
      where r.id = reel_account_tags.reel_id
        and r.uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
    )
  );

revoke all on table public.reel_account_tags from public, anon, authenticated;
grant select on table public.reel_account_tags to anon, authenticated;

create or replace function public.account_tag_label(target public.profiles)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(btrim(target.username), ''),
    nullif(split_part(btrim(coalesce(target.full_name, '')), ' ', 1), ''),
    'Account'
  );
$$;

create or replace function public.search_taggable_accounts(search_query text)
returns table (id uuid, label text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, public.account_tag_label(p) as label
  from public.profiles p
  where auth.uid() is not null
    and char_length(btrim(coalesce(search_query, ''))) >= 2
    and (
      p.username ilike '%' || btrim(search_query) || '%'
      or p.full_name ilike '%' || btrim(search_query) || '%'
    )
  order by p.username nulls last
  limit 8;
$$;

create or replace function public.tag_reel_accounts(target_reel_id uuid, profile_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  added integer := 0;
  next_id uuid;
begin
  if auth.uid() is null or target_reel_id is null then
    return 0;
  end if;
  select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
  if actor is null then
    return 0;
  end if;
  if not exists (
    select 1 from public.reels r where r.id = target_reel_id and r.uploaded_by = actor
  ) then
    return 0;
  end if;

  foreach next_id in array coalesce(profile_ids, '{}'::uuid[])
  loop
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

create or replace function public.get_reel_account_tags(target_reel_id uuid)
returns table (id uuid, profile_id uuid, label text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.profile_id, public.account_tag_label(p), t.status
  from public.reel_account_tags t
  join public.profiles p on p.id = t.profile_id
  where t.reel_id = target_reel_id
    and (
      t.status = 'confirmed'
      or (
        auth.uid() is not null
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.reels r
            join public.profiles me on me.id = r.uploaded_by
            where r.id = t.reel_id and me.user_id = auth.uid()
          )
        )
      )
    )
  order by t.created_at;
$$;

create or replace function public.get_my_account_tags()
returns table (id uuid, reel_id uuid, reel_title text, label text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.reel_id, coalesce(nullif(btrim(r.title), ''), 'Highlight'), public.account_tag_label(p), t.status
  from public.reel_account_tags t
  join public.profiles p on p.id = t.profile_id
  join public.reels r on r.id = t.reel_id
  where p.user_id = auth.uid()
    and t.status = 'pending'
  order by t.created_at desc;
$$;

create or replace function public.confirm_account_tag(target_tag_id uuid, tag_action text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  action text := lower(btrim(coalesce(tag_action, '')));
  next_status text;
begin
  if auth.uid() is null then
    return 'rejected';
  end if;
  if action not in ('confirm', 'reject') then
    raise exception 'tag_action must be confirm or reject';
  end if;
  next_status := case when action = 'confirm' then 'confirmed' else 'rejected' end;
  update public.reel_account_tags t
  set status = next_status
  from public.profiles p
  where t.id = target_tag_id
    and t.profile_id = p.id
    and p.user_id = auth.uid()
    and t.status = 'pending';
  return next_status;
end;
$$;

revoke all on function public.account_tag_label(public.profiles) from public, anon, authenticated;
revoke all on function public.search_taggable_accounts(text) from public, anon;
revoke all on function public.tag_reel_accounts(uuid, uuid[]) from public, anon;
revoke all on function public.get_reel_account_tags(uuid) from public;
revoke all on function public.get_my_account_tags() from public, anon;
revoke all on function public.confirm_account_tag(uuid, text) from public, anon;

grant execute on function public.search_taggable_accounts(text) to authenticated;
grant execute on function public.tag_reel_accounts(uuid, uuid[]) to authenticated;
grant execute on function public.get_reel_account_tags(uuid) to anon, authenticated;
grant execute on function public.get_my_account_tags() to authenticated;
grant execute on function public.confirm_account_tag(uuid, text) to authenticated;
