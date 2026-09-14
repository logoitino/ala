-- Community cheer polls. Safe to re-run.

create table if not exists public.cheer_polls (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  home_label text not null,
  away_label text not null,
  home_votes integer not null default 0,
  away_votes integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.cheer_polls enable row level security;

drop policy if exists "Public read cheer polls" on public.cheer_polls;
create policy "Public read cheer polls" on public.cheer_polls for select using (true);

drop function if exists public.cast_cheer_vote(text, text, text);

create or replace function public.cast_cheer_vote(
  poll_slug text,
  side text,
  previous_side text default null,
  home_name text default 'Westlake Thunder',
  away_name text default 'Lone Peak Knights'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.cheer_polls%rowtype;
begin
  if side not in ('home', 'away') then
    raise exception 'Invalid cheer side %', side;
  end if;

  insert into public.cheer_polls (slug, home_label, away_label, home_votes, away_votes)
  values (
    poll_slug,
    coalesce(nullif(btrim(home_name), ''), 'Westlake Thunder'),
    coalesce(nullif(btrim(away_name), ''), 'Lone Peak Knights'),
    0,
    0
  )
  on conflict (slug) do nothing;

  if previous_side in ('home', 'away') and previous_side is distinct from side then
    if previous_side = 'home' then
      update public.cheer_polls
      set home_votes = greatest(coalesce(home_votes, 0) - 1, 0), updated_at = now()
      where slug = poll_slug;
    else
      update public.cheer_polls
      set away_votes = greatest(coalesce(away_votes, 0) - 1, 0), updated_at = now()
      where slug = poll_slug;
    end if;
  end if;

  if side = 'home' then
    update public.cheer_polls
    set home_votes = coalesce(home_votes, 0) + 1, updated_at = now()
    where slug = poll_slug
    returning * into result;
  else
    update public.cheer_polls
    set away_votes = coalesce(away_votes, 0) + 1, updated_at = now()
    where slug = poll_slug
    returning * into result;
  end if;

  return jsonb_build_object(
    'home_votes', coalesce(result.home_votes, 0),
    'away_votes', coalesce(result.away_votes, 0)
  );
end;
$$;

grant select on public.cheer_polls to anon, authenticated;
grant execute on function public.cast_cheer_vote(text, text, text, text, text) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.cheer_polls;
exception
  when duplicate_object then null;
end $$;

insert into public.cheer_polls (slug, home_label, away_label, home_votes, away_votes)
values ('westlake-lone-peak', 'Westlake Thunder', 'Lone Peak Knights', 124, 98)
on conflict (slug) do nothing;
