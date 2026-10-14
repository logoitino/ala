-- Payout rows: admins write, and a parent reads only their own athlete's (STATE §5 Wave 1 blocker, 2026-10-13).
--
-- Purpose
--   "Admin write disbursements" let any account with the parent role insert, update or delete every payout row,
--   and "Admin read disbursements" let it read them all, not only its own child's (found by RLS_SECURITY during
--   the BOOKS-01 review). Payout rows feed the books (Finance & Books, Money desk), so a parent could change an
--   amount or status for any family. Only admin desks write disbursements in the app (Money, Books); the parent
--   app never does.
--   - Writes: admins only.
--   - Reads: admins, plus the custodial parties for that athlete through custodial_role(player_id) (the guardian
--     and the verified athlete, as for custodial_accounts: the athlete sees every gift and payout). A database
--     without custodial_role (development lacks custodial_money.sql) falls back to admin-only reads.
--
--   - Paid and failed payouts are final (INTERNAL_CONTROLS review; tightened after RLS_SECURITY): status moves only
--     between 'paid' and 'failed' (a bank return), and amount and athlete never change. The books never edit history
--     (BOOKS-01: entries are voided by reversal); a wrong payment is corrected with a new row. Side effect: deleting an
--     athlete who has a paid or failed payout is refused for app roles (the FK would blank player_id), which keeps
--     payout attribution for the books and 1099 review; the SQL Editor can still do it.
--
-- Chain of command: owner → CTO → SECURITY → RLS_SECURITY (owner); reviewed by CUSTODIAL (guardian rules) and
--   INTERNAL_CONTROLS (payout controls, CFO office).
-- Safe to re-run: drop policy if exists / create policy.
-- Applied: written 2026-10-13, not applied anywhere. Apply after 20261013210000_function_access_hardening.sql.
-- Rollback: drop trigger disbursements_paid_final and function disbursements_paid_final(); re-create the two previous policies from schema.sql (`current_user_role() in ('admin', 'parent')`) —
--   not recommended; it reopens every family's payout rows to every parent.

drop policy if exists "Admin write disbursements" on public.disbursements;
drop policy if exists "Admins write disbursements" on public.disbursements;
create policy "Admins write disbursements"
  on public.disbursements for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin read disbursements" on public.disbursements;
drop policy if exists "Custodial parties read disbursements" on public.disbursements;
do $$
begin
  if to_regprocedure('public.custodial_role(uuid)') is not null then
    execute $p$create policy "Custodial parties read disbursements"
      on public.disbursements for select
      to authenticated
      using (public.current_user_role() = 'admin' or public.custodial_role(player_id) is not null)$p$;
  else
    raise notice 'custodial_role is not on this database: payout rows stay admin-read only';
    execute $p$create policy "Custodial parties read disbursements"
      on public.disbursements for select
      to authenticated
      using (public.current_user_role() = 'admin')$p$;
  end if;
end;
$$;

create or replace function public.disbursements_paid_final()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Paid and failed are final states: a payout cannot be moved back to queued to edit it and pay again
  -- (RLS_SECURITY: paid -> failed -> edit -> paid). The Money desk only ever moves queued -> paid | failed.
  if old.status in ('paid', 'failed') and not public.is_trusted_server() then
    if new.status not in ('paid', 'failed') then
      raise exception 'A paid or failed payout cannot go back to %. Record a new payout instead.', new.status;
    end if;
    if new.amount_cents is distinct from old.amount_cents or new.player_id is distinct from old.player_id then
      raise exception 'A paid or failed payout cannot change amount or athlete. Record a correcting payout instead.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists disbursements_paid_final on public.disbursements;
create trigger disbursements_paid_final
  before update on public.disbursements
  for each row execute function public.disbursements_paid_final();

revoke all on function public.disbursements_paid_final() from public, anon, authenticated;
