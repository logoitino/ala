-- One Seki / Aura / Flex per signed-in fan per Highlight. Safe to re-run.
create table if not exists public.reel_hype_votes (
  user_id uuid not null,
  reel_id uuid not null references public.reels (id) on delete cascade,
  kind text not null check (kind in ('seki', 'aura', 'flex')),
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id, kind)
);

create index if not exists reel_hype_votes_reel_id_idx on public.reel_hype_votes (reel_id);

alter table public.reel_hype_votes enable row level security;

drop policy if exists "Fans read own reel hype votes" on public.reel_hype_votes;
create policy "Fans read own reel hype votes"
  on public.reel_hype_votes for select
  using (auth.uid() = user_id);

drop policy if exists "Fans insert own reel hype votes" on public.reel_hype_votes;
create policy "Fans insert own reel hype votes"
  on public.reel_hype_votes for insert
  with check (auth.uid() = user_id);

grant select, insert on public.reel_hype_votes to authenticated;

create or replace function public.increment_reel_hype(target_reel_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.reels%rowtype;
  viewer uuid := auth.uid();
  applied boolean := true;
begin
  if hype_kind not in ('aura', 'flex', 'seki') then
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  if viewer is not null then
    begin
      insert into public.reel_hype_votes (user_id, reel_id, kind)
      values (viewer, target_reel_id, hype_kind);
    exception
      when unique_violation then
        applied := false;
    end;
  end if;

  if applied then
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
    else
      update public.reels
      set seki_count = coalesce(seki_count, 0) + 1
      where id = target_reel_id
      returning * into result;
    end if;
  else
    select * into result from public.reels where id = target_reel_id;
  end if;

  return jsonb_build_object(
    'seki_count', coalesce(result.seki_count, 0),
    'aura_count', coalesce(result.aura_count, 0),
    'flex_count', coalesce(result.flex_count, 0),
    'total_tips_cents', coalesce(result.total_tips_cents, 0),
    'applied', applied
  );
end;
$$;

grant execute on function public.increment_reel_hype(uuid, text) to anon, authenticated;
