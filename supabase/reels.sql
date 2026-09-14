-- Fan-uploaded Seki plays. Run in the Supabase SQL editor.
-- Storage bucket: game_highlights (public read + insert).

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  title text not null default '',
  player_id uuid references public.players (id) on delete set null,
  game_id uuid references public.games (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.reels add column if not exists video_url text not null default '';
alter table public.reels add column if not exists title text not null default '';
alter table public.reels add column if not exists player_id uuid references public.players (id) on delete set null;
alter table public.reels add column if not exists game_id uuid references public.games (id) on delete set null;
alter table public.reels add column if not exists created_at timestamptz not null default now();
alter table public.reels add column if not exists seki_count integer not null default 0;
alter table public.reels add column if not exists aura_count integer not null default 0;
alter table public.reels add column if not exists flex_count integer not null default 0;
alter table public.reels add column if not exists total_tips_cents integer not null default 0;

alter table public.reels enable row level security;

drop policy if exists "Public read reels" on public.reels;
create policy "Public read reels" on public.reels for select using (true);

drop policy if exists "Public insert reels" on public.reels;
create policy "Public insert reels"
  on public.reels for insert
  with check (true);

drop policy if exists "Public update reels" on public.reels;
create policy "Public update reels"
  on public.reels for update
  using (true)
  with check (true);

grant select, insert, update on public.reels to anon, authenticated;

create or replace function public.increment_reel_hype(target_reel_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.reels%rowtype;
begin
  if hype_kind = 'aura' then
    update public.reels
    set aura_count = coalesce(aura_count, 0) + 1
    where id = target_reel_id
    returning * into result;
  elsif hype_kind = 'flex' then
    update public.reels
    set flex_count = coalesce(flex_count, 0) + 1
    where id = target_reel_id
    returning * into result;
  elsif hype_kind = 'seki' then
    update public.reels
    set seki_count = coalesce(seki_count, 0) + 1
    where id = target_reel_id
    returning * into result;
  else
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  return jsonb_build_object(
    'seki_count', coalesce(result.seki_count, 0),
    'aura_count', coalesce(result.aura_count, 0),
    'flex_count', coalesce(result.flex_count, 0),
    'total_tips_cents', coalesce(result.total_tips_cents, 0)
  );
end;
$$;

create or replace function public.increment_reel_tips(target_reel_id uuid, add_cents integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total integer;
begin
  update public.reels
  set total_tips_cents = coalesce(total_tips_cents, 0) + greatest(coalesce(add_cents, 0), 0)
  where id = target_reel_id
  returning total_tips_cents into new_total;

  return coalesce(new_total, 0);
end;
$$;

grant execute on function public.increment_reel_hype(uuid, text) to anon, authenticated;
grant execute on function public.increment_reel_tips(uuid, integer) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('game_highlights', 'game_highlights', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read game highlights" on storage.objects;
create policy "Public read game highlights"
  on storage.objects for select
  using (bucket_id = 'game_highlights');

drop policy if exists "Public upload game highlights" on storage.objects;
create policy "Public upload game highlights"
  on storage.objects for insert
  with check (bucket_id = 'game_highlights');
