-- Compat: hosted projects that grew `is_verified_athlete` before canonical `profiles.is_verified`.
-- Safe to re-run. Expo People + Next /people read either column.

alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists is_verified_athlete boolean not null default false;
alter table public.profiles add column if not exists spirit_points integer not null default 0;

update public.profiles
set is_verified = true
where coalesce(is_verified, false) = false
  and (
    coalesce(is_verified_athlete, false) = true
    or coalesce(verification_status, '') = 'verified'
  );
