-- The 20260716 hardening required every matched deposit's date to fall inside
-- the run's calendar month. But rent for a month is routinely paid in the last
-- days of the prior month (the July run legitimately holds matched deposits
-- dated 6/29–6/30, posted before the check existed), so every recompute of
-- such a run — including folding in an added statement — raised
-- 'invalid posting date' and left new deposits stranded outside the snapshot.
--
-- Accept deposits from the 25th of the prior month through the end of the run
-- month; keep the null / future-date rejections.

create or replace function public.post_reconciliation_run(p_run_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_run public.reconciliation_runs%rowtype;
  v_deposit record;
  v_payment public.payments%rowtype;
  v_payment_id uuid;
  v_expected_to_post integer;
begin
  if not public.is_financial_operator() then raise exception 'forbidden'; end if;
  select * into v_run from public.reconciliation_runs where id = p_run_id for update;
  if not found then raise exception 'reconciliation run not found'; end if;

  select coalesce(match_count, 0) + coalesce(mismatch_count, 0)
    into v_expected_to_post from public.reconciliation_runs where id = p_run_id;
  if v_expected_to_post > 0 and not exists (
    select 1 from public.reconciliation_deposits
     where run_id = p_run_id and tenancy_id is not null
  ) then
    raise exception 'reconciliation run is corrupt: matched tenants have no deposits';
  end if;

  for v_deposit in
    select * from public.reconciliation_deposits
     where run_id = p_run_id and tenancy_id is not null
     order by id for update
  loop
    -- Rent is often paid a few days early, so a run for month M accepts
    -- deposits from the 25th of M-1 through the end of M (never future).
    if v_deposit.deposit_date is null
       or v_deposit.deposit_date < (v_run.month - interval '6 days')::date
       or v_deposit.deposit_date >= (v_run.month + interval '1 month')::date
       or v_deposit.deposit_date > current_date then
      raise exception 'deposit % has an invalid posting date', v_deposit.external_ref;
    end if;

    select * into v_payment
      from public.payments
     where external_ref = v_deposit.external_ref
     for update;

    if found then
      if v_payment.amount <> v_deposit.amount
         or v_payment.paid_on <> v_deposit.deposit_date
         or v_payment.payment_type <> 'rent' then
        raise exception 'external reference % conflicts with an existing payment',
          v_deposit.external_ref;
      end if;
      v_payment_id := v_payment.id;
      if v_payment.tenancy_id is distinct from v_deposit.tenancy_id then
        update public.payments
           set tenancy_id = v_deposit.tenancy_id
         where id = v_payment_id;
      end if;
    else
      insert into public.payments(
        tenancy_id, paid_on, amount, payment_type, method, notes,
        reconciliation_run_id, external_ref
      ) values (
        v_deposit.tenancy_id, v_deposit.deposit_date, v_deposit.amount,
        'rent', 'Reconciliation',
        'Posted from recon (' || v_deposit.external_ref || ')',
        p_run_id, v_deposit.external_ref
      ) returning id into v_payment_id;
    end if;

    update public.reconciliation_deposits
       set payment_id = v_payment_id
     where id = v_deposit.id;
  end loop;

  if exists (
    select 1 from public.reconciliation_deposits
     where run_id = p_run_id and tenancy_id is not null and payment_id is null
  ) then
    raise exception 'not every matched deposit was linked to a payment';
  end if;

  update public.reconciliation_runs set posted_at = now() where id = p_run_id;
end;
$$;
