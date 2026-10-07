-- =============================================================================================
-- School badge — the school's crest on a school-confirmed athlete's profile
-- =============================================================================================
-- Design: docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md §10 (owner request 2026-09-29).
--
-- What changes:
--   1. schools_and_teams gets logo_url and two brand colours, set only by a Tapua'i admin
--      (admin_set_school_branding). No logo → the app draws a monogram shield in the colours.
--   2. athlete_school_badge(player_id) returns the crest data ONLY when the school (or an admin)
--      confirmed that athlete. The app never builds the badge from profile fields a user can
--      edit, so a fan account cannot make one appear.
--   3. Display names can no longer contain check-mark characters (✓ ✔ ☑ ✅), which a fan could
--      use to imitate the badge. NOT VALID: existing names are left alone.
--
-- Roll back:
--   drop function public.athlete_school_badge(uuid);
--   drop function public.admin_set_school_branding(uuid, text, text, text);
--   alter table public.profiles drop constraint profiles_name_no_check_marks;
-- The new columns are additive and can stay.
-- =============================================================================================

alter table public.schools_and_teams add column if not exists logo_url text;
alter table public.schools_and_teams add column if not exists color_primary text;
alter table public.schools_and_teams add column if not exists color_secondary text;

do $$
begin
  alter table public.schools_and_teams
    add constraint schools_and_teams_branding_check
    check (
      (logo_url is null or logo_url ~ '^https://')
      and (color_primary is null or color_primary ~ '^#[0-9A-Fa-f]{6}$')
      and (color_secondary is null or color_secondary ~ '^#[0-9A-Fa-f]{6}$')
    );
exception
  when duplicate_object then null;
end $$;

create or replace function public.admin_set_school_branding(
  target_school_id uuid,
  new_logo_url text default null,
  new_color_primary text default null,
  new_color_secondary text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_db() then
    raise exception 'Only Tapua''i admins can set school branding';
  end if;
  update public.schools_and_teams
  set
    logo_url = nullif(btrim(new_logo_url), ''),
    color_primary = nullif(btrim(new_color_primary), ''),
    color_secondary = nullif(btrim(new_color_secondary), '')
  where id = target_school_id;
  if not found then
    raise exception 'Unknown school';
  end if;
end;
$$;

revoke all on function public.admin_set_school_branding(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_school_branding(uuid, text, text, text) to authenticated;

-- Null unless a school-confirmed account is linked to this player row. confirmed_by is the
-- staff role only ('athletic_director' | 'coach' | 'tapuai'), never the staff member's name.
create or replace function public.athlete_school_badge(target_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  school public.schools_and_teams%rowtype;
  req public.verification_requests%rowtype;
  staff text;
begin
  select * into me
  from public.profiles p
  where p.player_id = target_player_id
    and p.verification_status = 'verified'
    and coalesce(p.is_verified, false)
  limit 1;
  if me.id is null or me.school_id is null then
    return null;
  end if;
  select * into school from public.schools_and_teams where id = me.school_id;
  if school.id is null then
    return null;
  end if;
  select * into req
  from public.verification_requests v
  where v.requester_user_id = me.id and v.status = 'approved'
  order by v.decided_at desc nulls last, v.created_at desc
  limit 1;
  if req.confirmer_id is not null then
    select c.staff_role into staff from public.school_confirmers c where c.id = req.confirmer_id;
  end if;

  return jsonb_build_object(
    'school_id', school.id,
    'school_name', school.name,
    'mascot', nullif(school.mascot, ''),
    'logo_url', school.logo_url,
    'color_primary', school.color_primary,
    'color_secondary', school.color_secondary,
    'confirmed_at', coalesce(req.decided_at, req.created_at),
    'confirmed_by', coalesce(staff, 'tapuai')
  );
end;
$$;

grant execute on function public.athlete_school_badge(uuid) to anon, authenticated;

do $$
begin
  alter table public.profiles
    add constraint profiles_name_no_check_marks
    check (
      coalesce(full_name, '') !~ '[✓✔☑✅]'
      and coalesce(username, '') !~ '[✓✔☑✅]'
    ) not valid;
exception
  when duplicate_object then null;
end $$;
