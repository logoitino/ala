-- Fan suggestions / bugs for the admin control plane. Safe to re-run.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid,
  body text not null,
  kind text not null default 'suggestion',
  surface text not null default 'other',
  status text not null default 'new',
  runtime_path text not null default '',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_feedback add column if not exists author_id uuid;
alter table public.app_feedback add column if not exists body text not null default '';
alter table public.app_feedback add column if not exists kind text not null default 'suggestion';
alter table public.app_feedback add column if not exists surface text not null default 'other';
alter table public.app_feedback add column if not exists status text not null default 'new';
alter table public.app_feedback add column if not exists runtime_path text not null default '';
alter table public.app_feedback add column if not exists admin_note text not null default '';
alter table public.app_feedback add column if not exists created_at timestamptz not null default now();
alter table public.app_feedback add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_kind_check
    check (kind in ('suggestion', 'bug', 'look', 'other'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_surface_check
    check (surface in ('home', 'local', 'spotlight', 'drip', 'profile', 'other'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_status_check
    check (status in ('new', 'reviewing', 'planned', 'shipping', 'shipped', 'declined'));
exception
  when duplicate_object then null;
end $$;

create index if not exists app_feedback_status_created_at_idx
  on public.app_feedback (status, created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists "Anyone insert app feedback" on public.app_feedback;
create policy "Anyone insert app feedback"
  on public.app_feedback for insert
  with check (true);

drop policy if exists "Admin read app feedback" on public.app_feedback;
create policy "Admin read app feedback"
  on public.app_feedback for select
  using (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop policy if exists "Admin write app feedback" on public.app_feedback;
create policy "Admin write app feedback"
  on public.app_feedback for update
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

create or replace function public.submit_app_feedback(
  p_body text,
  p_kind text default 'suggestion',
  p_surface text default 'other'
)
returns public.app_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  kind_n text := lower(btrim(coalesce(p_kind, 'suggestion')));
  surface_n text := lower(btrim(coalesce(p_surface, 'other')));
  body_n text := btrim(coalesce(p_body, ''));
  result public.app_feedback;
begin
  if length(body_n) < 8 then
    raise exception 'Tell us a bit more — at least a short sentence.';
  end if;
  if kind_n not in ('suggestion', 'bug', 'look', 'other') then
    kind_n := 'suggestion';
  end if;
  if surface_n not in ('home', 'local', 'spotlight', 'drip', 'profile', 'other') then
    surface_n := 'other';
  end if;

  insert into public.app_feedback (author_id, body, kind, surface, status)
  values (auth.uid(), body_n, kind_n, surface_n, 'new')
  returning * into result;

  return result;
end;
$$;

create or replace function public.get_app_feedback()
returns setof public.app_feedback
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.app_feedback
  order by
    case status
      when 'new' then 0
      when 'reviewing' then 1
      when 'planned' then 2
      when 'shipping' then 3
      else 4
    end,
    created_at desc
  limit 80;
$$;

create or replace function public.triage_app_feedback(
  target_id uuid,
  next_status text,
  next_note text default '',
  next_runtime_path text default ''
)
returns public.app_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  status_n text := lower(btrim(coalesce(next_status, '')));
  result public.app_feedback;
begin
  if status_n not in ('new', 'reviewing', 'planned', 'shipping', 'shipped', 'declined') then
    raise exception 'Unknown feedback status %', next_status;
  end if;

  update public.app_feedback
  set
    status = status_n,
    admin_note = coalesce(next_note, admin_note),
    runtime_path = coalesce(next_runtime_path, runtime_path),
    updated_at = timezone('utc', now())
  where id = target_id
  returning * into result;

  if result.id is null then
    raise exception 'Feedback not found.';
  end if;

  return result;
end;
$$;

grant select, insert, update on public.app_feedback to anon, authenticated;
grant execute on function public.submit_app_feedback(text, text, text) to anon, authenticated;
grant execute on function public.get_app_feedback() to anon, authenticated;
grant execute on function public.triage_app_feedback(uuid, text, text, text) to anon, authenticated;
