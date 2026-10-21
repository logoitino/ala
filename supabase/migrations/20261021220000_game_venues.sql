-- LOCAL-02: each game carries its own public school/stadium address and arrival note, including away/neutral games.
-- Existing venue names remain compatible; only admins may edit venue details. Legacy operator scoring stays intact.
-- Design/ownership: docs/agents/LOCAL-02.md. Requires games, require_admin_guard() and is_trusted_server()
-- from the canonical schema and 20261013210000_function_access_hardening.sql. Written locally, not applied.
-- Rollback: pause venue editing, then use a forward migration to remove games_venue_guard after Security review.
-- Keep the public venue columns and recorded values; do not discard data or reopen client venue writes silently.

begin;

do $$
begin
  if to_regprocedure('public.require_admin_guard()') is null
     or to_regprocedure('public.is_trusted_server()') is null then
    raise exception 'LOCAL-02 requires trusted admin helpers before game venue changes';
  end if;
end $$;

alter table public.games add column if not exists venue_school text not null default '';
alter table public.games add column if not exists venue_address text not null default '';
alter table public.games add column if not exists venue_notes text not null default '';

comment on column public.games.venue_school is 'Admin-entered public sporting venue school; blank for neutral venues. Never inferred from home_school.';
comment on column public.games.venue_address is 'Admin-entered full public sporting venue address, used only when a fan asks for directions. No fan location.';
comment on column public.games.venue_notes is 'Optional public arrival or parking instructions. Do not enter private athlete, family or operator details.';

-- These bounds also protect direct maintenance SQL when a privileged owner temporarily disables triggers.
alter table public.games drop constraint if exists games_venue_school_length;
alter table public.games add constraint games_venue_school_length check (char_length(venue_school) <= 160);
alter table public.games drop constraint if exists games_venue_address_length;
alter table public.games add constraint games_venue_address_length check (char_length(venue_address) <= 320);
alter table public.games drop constraint if exists games_venue_notes_length;
alter table public.games add constraint games_venue_notes_length check (char_length(venue_notes) <= 400);

-- A trigger protects all REST/RPC writers, including the legacy anon/operator score policy.
-- Definer is needed to invoke the trusted guard without granting clients the internal trigger helper.
create or replace function public.games_venue_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  venue_name_edited boolean;
begin
  venue_name_edited := tg_op = 'INSERT' or new.venue is distinct from old.venue;
  if tg_op = 'UPDATE' then
    -- Score-only updates must preserve even historical whitespace/long venue names exactly.
    if (new.venue, new.venue_school, new.venue_address, new.venue_notes)
       is not distinct from (old.venue, old.venue_school, old.venue_address, old.venue_notes) then
      return new;
    end if;
    if not public.is_trusted_server() then
      perform public.require_admin_guard();
    end if;
  end if;

  -- Historical names are unbounded; changing arrival details must not rewrite or reject an unchanged name.
  if venue_name_edited then
    new.venue := regexp_replace(coalesce(new.venue, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  end if;
  new.venue_school := regexp_replace(coalesce(new.venue_school, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  new.venue_address := regexp_replace(coalesce(new.venue_address, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  new.venue_notes := regexp_replace(coalesce(new.venue_notes, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');

  -- Blank-location legacy operator inserts remain possible; new public location information is admin-owned.
  if tg_op = 'INSERT' and (new.venue <> '' or new.venue_school <> '' or new.venue_address <> '' or new.venue_notes <> '')
     and not public.is_trusted_server() then
    perform public.require_admin_guard();
  end if;

  if (venue_name_edited and char_length(new.venue) > 160) or char_length(new.venue_school) > 160
     or char_length(new.venue_address) > 320 or char_length(new.venue_notes) > 400 then
    raise exception using errcode = '22023', message = 'game_venue_too_long';
  end if;
  return new;
end $$;

drop trigger if exists games_venue_guard on public.games;
create trigger games_venue_guard
  before insert or update on public.games
  for each row execute function public.games_venue_guard();

revoke all on function public.games_venue_guard() from public, anon, authenticated, service_role;

commit;
