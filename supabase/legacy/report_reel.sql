-- Content moderation. Safe to re-run.
-- report_reel(target_reel_id) appends auth.uid() to reels.reported_by and sets is_flagged.

alter table public.reels add column if not exists is_flagged boolean not null default false;
alter table public.reels add column if not exists reported_by uuid[] not null default '{}'::uuid[];

drop function if exists public.report_reel(uuid);

create or replace function public.report_reel(target_reel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter uuid := auth.uid();
  result public.reels%rowtype;
begin
  if reporter is null then
    raise exception 'Sign in to report a highlight.';
  end if;
  update public.reels
  set
    is_flagged = true,
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
    'reported_by', result.reported_by
  );
end;
$$;

grant execute on function public.report_reel(uuid) to authenticated;
