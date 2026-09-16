-- In-app Terms / NIL / minor-safety acknowledgement on profiles. Safe to re-run.

alter table public.profiles
  add column if not exists legal_terms_accepted_at timestamptz;

alter table public.profiles
  add column if not exists legal_terms_version text;
