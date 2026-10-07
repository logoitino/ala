-- Upload rights confirmation + report reasons.
-- Design: docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md §6, plus music / logo / broadcast reports.
-- Depends on public.reels, public.profiles, public.players, public.custodial_accounts.
--
-- A clip leaves the public feed (is_flagged) when:
--   the tagged athlete or their guardian reports it, or
--   the reason is fake footage, impersonation, or music/logo/broadcast, or
--   three separate accounts have reported it.
-- One rival report of "other" no longer hides a real clip.
--
-- Rollback:
--   drop function if exists public.report_reel(uuid, text);
--   -- then restore the previous one-argument report_reel from supabase/report_reel.sql
--   drop table if exists public.reel_reports;
--   alter table public.reels drop column if exists rights_version;
--   alter table public.reels drop column if exists attested_at;

alter table public.reels add column if not exists attested_at timestamptz;
alter table public.reels add column if not exists rights_version text;

create table if not exists public.reel_reports (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  reporter_id uuid not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (reel_id, reporter_id),
  constraint reel_reports_reason_check check (
    reason in (
      'fake_footage',
      'wrong_athlete',
      'impersonation',
      'rights',
      'inappropriate',
      'other',
      'unspecified'
    )
  )
);

create index if not exists reel_reports_reel_idx on public.reel_reports (reel_id);

alter table public.reel_reports enable row level security;

drop policy if exists "Admin reads reel reports" on public.reel_reports;
create policy "Admin reads reel reports"
  on public.reel_reports for select
  to authenticated
  using (public.current_user_role() = 'admin');

revoke all on public.reel_reports from anon, authenticated;
grant select on public.reel_reports to authenticated;

create or replace function public.report_reel(target_reel_id uuid, report_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter uuid := auth.uid();
  reason text := coalesce(nullif(trim(report_reason), ''), 'unspecified');
  result public.reels%rowtype;
  report_count integer := 0;
  hides_now boolean := false;
begin
  if reporter is null then
    raise exception 'Sign in to report a highlight.';
  end if;
  if reason not in (
    'fake_footage', 'wrong_athlete', 'impersonation', 'rights', 'inappropriate', 'other', 'unspecified'
  ) then
    raise exception 'Pick a report reason.';
  end if;

  insert into public.reel_reports (reel_id, reporter_id, reason)
  values (target_reel_id, reporter, reason)
  on conflict (reel_id, reporter_id) do update
    set reason = excluded.reason;

  select count(*)::integer into report_count
  from public.reel_reports
  where reel_id = target_reel_id;

  select exists (
    select 1
    from public.reels r
    join public.profiles me on me.user_id = reporter
    where r.id = target_reel_id
      and (
        me.player_id = r.player_id
        or exists (
          select 1 from public.custodial_accounts ca
          where ca.player_id = r.player_id and ca.guardian_id = me.id
        )
        or exists (
          select 1 from public.players pl
          where pl.id = r.player_id and pl.guardian_id = me.id
        )
      )
  ) into hides_now;

  if reason in ('fake_footage', 'impersonation', 'rights') then
    hides_now := true;
  end if;

  update public.reels
  set
    is_flagged = hides_now or report_count >= 3 or coalesce(is_flagged, false),
    reported_by = case
      when coalesce(reported_by, '{}'::uuid[]) @> array[reporter] then coalesce(reported_by, '{}'::uuid[])
      else array_append(coalesce(reported_by, '{}'::uuid[]), reporter)
    end
  where id = target_reel_id
  returning * into result;

  if result.id is null then
    raise exception 'Highlight not found.';
  end if;

  return jsonb_build_object(
    'id', result.id,
    'is_flagged', result.is_flagged,
    'reported_by', result.reported_by,
    'reason', reason,
    'report_count', report_count
  );
end;
$$;

create or replace function public.report_reel(target_reel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.report_reel(target_reel_id, 'unspecified');
end;
$$;

revoke all on function public.report_reel(uuid, text) from public, anon;
revoke all on function public.report_reel(uuid) from public, anon;
grant execute on function public.report_reel(uuid, text) to authenticated;
grant execute on function public.report_reel(uuid) to authenticated;
