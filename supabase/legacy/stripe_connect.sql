-- Stripe Connect Express flags on profiles. Safe to re-run.

alter table public.profiles
  add column if not exists stripe_connect_id text;

alter table public.profiles
  add column if not exists stripe_onboarding_complete boolean not null default false;

alter table public.profiles
  add column if not exists payouts_enabled boolean not null default false;
