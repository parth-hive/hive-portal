-- Financial integrity hardening
--
-- This migration makes the database enforce the same operator boundary as the
-- application, prevents bank-reference adoption, makes reconciliation ledger
-- changes transactional, preserves historical ledger rows, and removes secrets
-- from audit trails.

-- ---------------------------------------------------------------------------
-- Shared authorization predicate. Keep the allowlist in sync with
-- src/lib/access.ts until a real roles table replaces it.
-- ---------------------------------------------------------------------------

create or replace function public.is_financial_operator()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.role() = 'service_role'
    or lower(coalesce(auth.jwt() ->> 'email', '')) = any (
      array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']
    )
$$;

revoke all on function public.is_financial_operator() from public, anon;
grant execute on function public.is_financial_operator() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: raw bank data and financial master data are operator-only to mutate.
-- Ordinary authenticated staff can still record a normal, same-day-or-earlier
-- payment, but cannot forge a bank external_ref, create a refund, or attach a
-- row to a reconciliation run.
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated write tenants" on public.tenants;
create policy "financial operators write tenants"
  on public.tenants for all to authenticated
  using (public.is_financial_operator())
  with check (public.is_financial_operator());

drop policy if exists "authenticated write tenancies" on public.tenancies;
create policy "financial operators write tenancies"
  on public.tenancies for all to authenticated
  using (public.is_financial_operator())
  with check (public.is_financial_operator());

drop policy if exists "authenticated write properties" on public.properties;
create policy "financial operators write properties"
  on public.properties for all to authenticated
  using (public.is_financial_operator())
  with check (public.is_financial_operator());

drop policy if exists "authenticated insert payments" on public.payments;
drop policy if exists "ledger admins update payments" on public.payments;
drop policy if exists "ledger admins delete payments" on public.payments;

create policy "staff insert ordinary payments"
  on public.payments for insert to authenticated
  with check (
    amount > 0
    and paid_on <= current_date
    and payment_type <> 'refund'
    and external_ref is null
    and reconciliation_run_id is null
  );

create policy "financial operators insert payments"
  on public.payments for insert to authenticated
  with check (
    public.is_financial_operator()
    and amount > 0
    and paid_on <= current_date
  );

create policy "financial operators update payments"
  on public.payments for update to authenticated
  using (public.is_financial_operator())
  with check (
    public.is_financial_operator()
    and amount > 0
    and paid_on <= current_date
  );

create policy "financial operators delete payments"
  on public.payments for delete to authenticated
  using (public.is_financial_operator());

drop policy if exists "authenticated write recon runs" on public.reconciliation_runs;
drop policy if exists "authenticated write recon matches" on public.reconciliation_matches;
drop policy if exists "authenticated write recon deposits" on public.reconciliation_deposits;
drop policy if exists "authenticated write reconciliation_reversals" on public.reconciliation_reversals;
drop policy if exists "authenticated write ignored_payers" on public.ignored_payers;
drop policy if exists "authenticated read recon runs" on public.reconciliation_runs;
drop policy if exists "authenticated read recon matches" on public.reconciliation_matches;
drop policy if exists "authenticated read recon deposits" on public.reconciliation_deposits;
drop policy if exists "authenticated read reconciliation_reversals" on public.reconciliation_reversals;
drop policy if exists "authenticated read ignored_payers" on public.ignored_payers;

create policy "financial operators read recon runs"
  on public.reconciliation_runs for select to authenticated
  using (public.is_financial_operator());
create policy "financial operators read recon matches"
  on public.reconciliation_matches for select to authenticated
  using (public.is_financial_operator());
create policy "financial operators read recon deposits"
  on public.reconciliation_deposits for select to authenticated
  using (public.is_financial_operator());
create policy "financial operators read reconciliation_reversals"
  on public.reconciliation_reversals for select to authenticated
  using (public.is_financial_operator());
create policy "financial operators read ignored_payers"
  on public.ignored_payers for select to authenticated
  using (public.is_financial_operator());

create policy "financial operators write recon runs"
  on public.reconciliation_runs for all to authenticated
  using (public.is_financial_operator()) with check (public.is_financial_operator());
create policy "financial operators write recon matches"
  on public.reconciliation_matches for all to authenticated
  using (public.is_financial_operator()) with check (public.is_financial_operator());
create policy "financial operators write recon deposits"
  on public.reconciliation_deposits for all to authenticated
  using (public.is_financial_operator()) with check (public.is_financial_operator());
create policy "financial operators write reconciliation_reversals"
  on public.reconciliation_reversals for all to authenticated
  using (public.is_financial_operator()) with check (public.is_financial_operator());
create policy "financial operators write ignored_payers"
  on public.ignored_payers for all to authenticated
  using (public.is_financial_operator()) with check (public.is_financial_operator());

drop policy if exists "authenticated write utility bills" on public.utility_bills;
drop policy if exists "authenticated write utility charges" on public.utility_bill_charges;
create policy "financial operators write utility bills"
  on public.utility_bills for all to authenticated
  using (public.is_financial_operator()) with check (public.is_financial_operator());
create policy "financial operators write utility charges"
  on public.utility_bill_charges for all to authenticated
  using (public.is_financial_operator()) with check (public.is_financial_operator());

drop policy if exists "authenticated write rent_reminder_batches" on public.rent_reminder_batches;
create policy "financial operators write rent reminder batches"
  on public.rent_reminder_batches for all to authenticated
  using (public.is_financial_operator()) with check (public.is_financial_operator());

drop policy if exists "authenticated read reconciliation" on storage.objects;
drop policy if exists "authenticated write reconciliation" on storage.objects;
drop policy if exists "ledger admins delete reconciliation" on storage.objects;
create policy "financial operators read reconciliation"
  on storage.objects for select to authenticated
  using (bucket_id = 'reconciliation' and public.is_financial_operator());
create policy "financial operators write reconciliation"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'reconciliation' and public.is_financial_operator());
create policy "financial operators delete reconciliation"
  on storage.objects for delete to authenticated
  using (bucket_id = 'reconciliation' and public.is_financial_operator());

drop policy if exists "authenticated read utilities" on storage.objects;
drop policy if exists "authenticated write utilities" on storage.objects;
drop policy if exists "authenticated delete utilities" on storage.objects;
create policy "financial operators read utilities"
  on storage.objects for select to authenticated
  using (bucket_id = 'utilities' and public.is_financial_operator());
create policy "financial operators write utilities"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'utilities' and public.is_financial_operator());
create policy "financial operators delete utilities"
  on storage.objects for delete to authenticated
  using (bucket_id = 'utilities' and public.is_financial_operator());

-- Audit and bot activity may contain highly sensitive operational context.
drop policy if exists "authenticated read audit_log" on public.audit_log;
create policy "financial operators read audit log"
  on public.audit_log for select to authenticated
  using (public.is_financial_operator());

drop policy if exists "authenticated read telegram_activity_log" on public.telegram_activity_log;
create policy "financial operators read telegram activity log"
  on public.telegram_activity_log for select to authenticated
  using (public.is_financial_operator());

-- Application roles may append/read these trails but cannot rewrite history.
-- Database-owner migrations retain the ability to perform governed retention.
revoke update, delete on public.audit_log
  from anon, authenticated, service_role;
revoke update, delete on public.telegram_activity_log
  from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Constraints and preservation rules. NOT VALID checks protect new writes
-- without making deployment depend on pre-existing cleanup.
-- ---------------------------------------------------------------------------

alter table public.tenancies
  add constraint tenancies_monthly_rent_positive check (monthly_rent > 0) not valid,
  add constraint tenancies_first_month_rent_nonnegative
    check (first_month_rent is null or first_month_rent >= 0) not valid,
  add constraint tenancies_security_deposit_nonnegative
    check (security_deposit is null or security_deposit >= 0) not valid,
  add constraint tenancies_move_out_ordered
    check (move_out_date is null or move_out_date >= start_date) not valid,
  add constraint tenancies_lease_dates_ordered
    check (
      lease_start_date is null or lease_end_date is null
      or lease_end_date >= lease_start_date
    ) not valid;

alter table public.properties
  add constraint properties_unit_rent_nonnegative
    check (unit_rent is null or unit_rent >= 0) not valid,
  add constraint properties_amenity_fees_nonnegative
    check (amenity_fees_yearly is null or amenity_fees_yearly >= 0) not valid,
  add constraint properties_misc_fees_nonnegative
    check (misc_fees_yearly is null or misc_fees_yearly >= 0) not valid,
  add constraint properties_internet_nonnegative
    check (internet_monthly is null or internet_monthly >= 0) not valid,
  add constraint properties_cleaning_fee_nonnegative
    check (cleaning_fee_monthly is null or cleaning_fee_monthly >= 0) not valid,
  add constraint properties_insurance_nonnegative
    check (insurance_monthly is null or insurance_monthly >= 0) not valid,
  add constraint properties_lease_dates_ordered
    check (
      unit_lease_start is null or unit_lease_end is null
      or unit_lease_end >= unit_lease_start
    ) not valid;

alter table public.payments
  add constraint payments_not_future_dated check (paid_on <= current_date) not valid;

alter table public.reconciliation_runs
  add constraint reconciliation_runs_month_first_day
    check (month = date_trunc('month', month)::date) not valid;
alter table public.reconciliation_deposits
  add constraint reconciliation_deposits_amount_positive check (amount > 0) not valid,
  add constraint reconciliation_deposits_date_required check (deposit_date is not null) not valid;
alter table public.reconciliation_reversals
  add constraint reconciliation_reversals_amount_positive check (amount > 0) not valid,
  add constraint reconciliation_reversals_date_required check (deposit_date is not null) not valid;

create unique index if not exists rent_reminder_batches_late_fee_month_unique
  on public.rent_reminder_batches (kind, period_month)
  where kind = 'late_fee';

-- Preserve any historical duplicate imports, but serialize and reject every
-- new duplicate external reference within a run (including concurrent inserts).
create or replace function public.reject_duplicate_reconciliation_deposit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
     and new.run_id = old.run_id
     and new.external_ref = old.external_ref then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(new.run_id::text || ':' || new.external_ref, 0)
  );
  if exists (
    select 1 from public.reconciliation_deposits
     where run_id = new.run_id
       and external_ref = new.external_ref
       and id <> new.id
  ) then
    raise exception 'duplicate reconciliation deposit external reference';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_duplicate_reconciliation_deposit()
  from public, anon, authenticated;
drop trigger if exists reject_duplicate_reconciliation_deposit
  on public.reconciliation_deposits;
create trigger reject_duplicate_reconciliation_deposit
  before insert or update of run_id, external_ref on public.reconciliation_deposits
  for each row execute function public.reject_duplicate_reconciliation_deposit();

-- A stable key makes manual and automatic late-fee inserts share the same
-- concurrency backstop without deleting any pre-existing duplicate rows.
alter table public.tenancy_charges add column if not exists dedupe_key text;
with ranked as (
  select id,
         row_number() over (
           partition by tenancy_id, extract(year from charged_on), extract(month from charged_on)
           order by created_at, id
         ) as rn
    from public.tenancy_charges
   where kind = 'late_fee'
)
update public.tenancy_charges c
   set dedupe_key = 'late_fee:' || to_char(c.charged_on, 'YYYY-MM')
  from ranked r
 where c.id = r.id and r.rn = 1 and c.dedupe_key is null;
create unique index if not exists tenancy_charges_dedupe_key_unique
  on public.tenancy_charges (tenancy_id, dedupe_key)
  where dedupe_key is not null;
create or replace function public.set_tenancy_charge_dedupe_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'late_fee' then
    new.dedupe_key := 'late_fee:' || to_char(new.charged_on, 'YYYY-MM');
  else
    new.dedupe_key := null;
  end if;
  return new;
end;
$$;
revoke all on function public.set_tenancy_charge_dedupe_key()
  from public, anon, authenticated;
drop trigger if exists set_tenancy_charge_dedupe_key on public.tenancy_charges;
create trigger set_tenancy_charge_dedupe_key
  before insert or update of kind, charged_on on public.tenancy_charges
  for each row execute function public.set_tenancy_charge_dedupe_key();

alter table public.tenancy_charges
  drop constraint if exists tenancy_charges_tenancy_id_fkey,
  add constraint tenancy_charges_tenancy_id_fkey
    foreign key (tenancy_id) references public.tenancies(id) on delete restrict;
alter table public.credit_allocations
  drop constraint if exists credit_allocations_tenancy_id_fkey,
  add constraint credit_allocations_tenancy_id_fkey
    foreign key (tenancy_id) references public.tenancies(id) on delete restrict;
alter table public.tenancy_rent_history
  drop constraint if exists tenancy_rent_history_tenancy_id_fkey,
  add constraint tenancy_rent_history_tenancy_id_fkey
    foreign key (tenancy_id) references public.tenancies(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Audit redaction and coverage.
-- ---------------------------------------------------------------------------

create or replace function public.audit_log_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_changed_cols text[];
  v_before jsonb;
  v_after jsonb;
  v_record_id text;
begin
  begin v_user_id := auth.uid(); exception when others then v_user_id := null; end;
  begin v_user_email := auth.jwt() ->> 'email'; exception when others then v_user_email := null; end;

  if TG_OP = 'INSERT' then
    v_after := to_jsonb(NEW);
    v_record_id := v_after ->> 'id';
  elsif TG_OP = 'UPDATE' then
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_record_id := v_after ->> 'id';
  else
    v_before := to_jsonb(OLD);
    v_record_id := v_before ->> 'id';
  end if;

  -- Never copy credential material into a second table. Historical rows are
  -- scrubbed below as well.
  if TG_TABLE_NAME = 'credentials' then
    v_before := v_before - array['password', 'password_cipher'];
    v_after := v_after - array['password', 'password_cipher'];
  end if;

  if TG_OP = 'UPDATE' then
    select array_agg(key)
      into v_changed_cols
      from jsonb_each(v_before) old_kv
      join jsonb_each(v_after) new_kv using (key)
     where old_kv.value is distinct from new_kv.value;
    if v_changed_cols is null then return NEW; end if;
  end if;

  insert into public.audit_log(
    user_id, user_email, action, table_name, record_id,
    before_data, after_data, changed_columns
  ) values (
    v_user_id, v_user_email, lower(TG_OP), TG_TABLE_NAME, v_record_id,
    v_before, v_after, v_changed_cols
  );
  return coalesce(NEW, OLD);
end;
$$;

update public.audit_log
   set before_data = before_data - array['password', 'password_cipher'],
       after_data = after_data - array['password', 'password_cipher']
 where table_name = 'credentials';

-- Redact every row in a turn that invoked the credential-retrieval tool.
with sensitive_turns as (
  select distinct turn_id
    from public.telegram_activity_log
   where tool_name = 'get_credentials' and turn_id is not null
)
update public.telegram_activity_log l
   set text = '[sensitive credential turn redacted]',
       detail = jsonb_build_object('redacted', true)
 where l.turn_id in (select turn_id from sensitive_turns);

update public.telegram_chat_messages
   set content = '[{"type":"text","text":"[historical credential response redacted]"}]'::jsonb
 where content::text ilike '%password%'
    or content::text ilike '%get_credentials%';

drop trigger if exists audit_reconciliation_reversals on public.reconciliation_reversals;
create trigger audit_reconciliation_reversals
  after insert or update or delete on public.reconciliation_reversals
  for each row execute function public.audit_log_trigger();
drop trigger if exists audit_ignored_payers on public.ignored_payers;
create trigger audit_ignored_payers
  after insert or update or delete on public.ignored_payers
  for each row execute function public.audit_log_trigger();
drop trigger if exists audit_profitability_line_items on public.profitability_line_items;
create trigger audit_profitability_line_items
  after insert or update or delete on public.profitability_line_items
  for each row execute function public.audit_log_trigger();
drop trigger if exists audit_rent_reminder_batches on public.rent_reminder_batches;
create trigger audit_rent_reminder_batches
  after insert or update or delete on public.rent_reminder_batches
  for each row execute function public.audit_log_trigger();

-- ---------------------------------------------------------------------------
-- Atomic rent changes.
-- ---------------------------------------------------------------------------

create or replace function public.update_tenancy_rent(
  p_tenancy_id uuid,
  p_new_rate numeric,
  p_effective_from date,
  p_lease_start date,
  p_lease_end date
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_current public.tenancies%rowtype;
  v_effective_month date;
  v_baseline_month date;
begin
  if not public.is_financial_operator() then raise exception 'forbidden'; end if;
  if p_new_rate is null or p_new_rate <= 0 then raise exception 'rent must be positive'; end if;
  if p_effective_from is null or p_lease_start is null or p_lease_end is null
     or p_lease_end <= p_lease_start then
    raise exception 'invalid lease dates';
  end if;

  select * into v_current from public.tenancies where id = p_tenancy_id for update;
  if not found then raise exception 'tenancy not found'; end if;

  v_effective_month := date_trunc('month', p_effective_from)::date;
  v_baseline_month := date_trunc('month', v_current.start_date)::date;

  if v_current.monthly_rent is distinct from p_new_rate then
    if not exists (
      select 1 from public.tenancy_rent_history where tenancy_id = p_tenancy_id
    ) and v_baseline_month < v_effective_month then
      insert into public.tenancy_rent_history(tenancy_id, effective_month, monthly_rent)
      values (p_tenancy_id, v_baseline_month, v_current.monthly_rent)
      on conflict (tenancy_id, effective_month) do nothing;
    end if;

    insert into public.tenancy_rent_history(tenancy_id, effective_month, monthly_rent)
    values (p_tenancy_id, v_effective_month, p_new_rate)
    on conflict (tenancy_id, effective_month)
    do update set monthly_rent = excluded.monthly_rent;
  end if;

  update public.tenancies
     set monthly_rent = p_new_rate,
         lease_start_date = p_lease_start,
         lease_end_date = p_lease_end,
         lease_end_reminded_at = null,
         lease_end_reminded_30_at = null
   where id = p_tenancy_id;
end;
$$;

revoke all on function public.update_tenancy_rent(uuid, numeric, date, date, date) from public, anon;
grant execute on function public.update_tenancy_rent(uuid, numeric, date, date, date)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Atomic reconciliation posting/unposting/deletion.
-- ---------------------------------------------------------------------------

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
    if v_deposit.deposit_date is null
       or date_trunc('month', v_deposit.deposit_date)::date <> v_run.month
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

create or replace function public.unpost_reconciliation_run(p_run_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare v_payment_ids uuid[];
begin
  if not public.is_financial_operator() then raise exception 'forbidden'; end if;
  perform 1 from public.reconciliation_runs where id = p_run_id for update;
  if not found then raise exception 'reconciliation run not found'; end if;

  select array_agg(distinct payment_id) into v_payment_ids
    from public.reconciliation_deposits
   where run_id = p_run_id and payment_id is not null;

  update public.reconciliation_deposits set payment_id = null where run_id = p_run_id;
  if v_payment_ids is not null then
    delete from public.payments p
     where p.id = any(v_payment_ids)
       and not exists (
         select 1 from public.reconciliation_deposits d where d.payment_id = p.id
       );
  end if;
  update public.reconciliation_runs set posted_at = null where id = p_run_id;
end;
$$;

create or replace function public.delete_reconciliation_run(p_run_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role'
     and lower(coalesce(auth.jwt() ->> 'email', '')) <> 'vdutta1485@gmail.com' then
    raise exception 'forbidden';
  end if;
  perform public.unpost_reconciliation_run(p_run_id);
  delete from public.reconciliation_runs where id = p_run_id;
end;
$$;

create or replace function public.replace_reconciliation_snapshot(
  p_run_id uuid,
  p_matches jsonb,
  p_deposit_assignments jsonb,
  p_unmatched jsonb,
  p_total_expected numeric,
  p_total_actual numeric,
  p_match_count integer,
  p_mismatch_count integer,
  p_missing_count integer,
  p_post_payments boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_run public.reconciliation_runs%rowtype;
  v_removed_payment_ids uuid[];
begin
  if not public.is_financial_operator() then raise exception 'forbidden'; end if;
  select * into v_run from public.reconciliation_runs where id = p_run_id for update;
  if not found then raise exception 'reconciliation run not found'; end if;
  if v_run.posted_at is not null and not p_post_payments then
    raise exception 'posted reconciliation snapshots are immutable';
  end if;

  update public.reconciliation_deposits set tenancy_id = null where run_id = p_run_id;
  update public.reconciliation_deposits d
     set tenancy_id = a.tenancy_id
    from jsonb_to_recordset(coalesce(p_deposit_assignments, '[]'::jsonb))
      as a(payer_key text, tenancy_id uuid)
   where d.run_id = p_run_id and d.payer_key = a.payer_key;

  if p_post_payments then
    select array_agg(distinct payment_id) into v_removed_payment_ids
      from public.reconciliation_deposits
     where run_id = p_run_id and tenancy_id is null and payment_id is not null;
    update public.reconciliation_deposits
       set payment_id = null
     where run_id = p_run_id and tenancy_id is null;
    if v_removed_payment_ids is not null then
      delete from public.payments p
       where p.id = any(v_removed_payment_ids)
         and not exists (
           select 1 from public.reconciliation_deposits d where d.payment_id = p.id
         );
    end if;
  end if;

  delete from public.reconciliation_matches where run_id = p_run_id;
  insert into public.reconciliation_matches(
    run_id, tenancy_id, tenant_id, tenant_name, pays_as, property_label,
    room_label, expected_rent, actual_amount, difference, status
  )
  select p_run_id, x.tenancy_id, x.tenant_id, x.tenant_name, x.pays_as,
         x.property_label, x.room_label, x.expected_rent, x.actual_amount,
         x.difference, x.status
    from jsonb_to_recordset(coalesce(p_matches, '[]'::jsonb)) as x(
      tenancy_id uuid, tenant_id uuid, tenant_name text, pays_as text,
      property_label text, room_label text, expected_rent numeric,
      actual_amount numeric, difference numeric, status text
    );

  update public.reconciliation_runs
     set total_expected = p_total_expected,
         total_actual = p_total_actual,
         match_count = p_match_count,
         mismatch_count = p_mismatch_count,
         missing_count = p_missing_count,
         unmatched_deposits = p_unmatched
   where id = p_run_id;

  if p_post_payments then perform public.post_reconciliation_run(p_run_id); end if;
end;
$$;

revoke all on function public.post_reconciliation_run(uuid) from public, anon;
revoke all on function public.unpost_reconciliation_run(uuid) from public, anon;
revoke all on function public.delete_reconciliation_run(uuid) from public, anon;
revoke all on function public.replace_reconciliation_snapshot(
  uuid, jsonb, jsonb, jsonb, numeric, numeric, integer, integer, integer, boolean
) from public, anon;
grant execute on function public.post_reconciliation_run(uuid) to authenticated, service_role;
grant execute on function public.unpost_reconciliation_run(uuid) to authenticated, service_role;
grant execute on function public.delete_reconciliation_run(uuid) to authenticated, service_role;
grant execute on function public.replace_reconciliation_snapshot(
  uuid, jsonb, jsonb, jsonb, numeric, numeric, integer, integer, integer, boolean
) to authenticated, service_role;

-- Resolve a reversal and write its refund as one transaction. Existing
-- external references are adopted only when every financial field agrees.
create or replace function public.resolve_reconciliation_reversal(
  p_reversal_id uuid,
  p_mode text,
  p_resolved_by text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_reversal public.reconciliation_reversals%rowtype;
  v_suspect public.payments%rowtype;
  v_existing public.payments%rowtype;
  v_refund_id uuid;
begin
  if not public.is_financial_operator() then raise exception 'forbidden'; end if;
  if p_mode not in ('refund', 'dismiss') then raise exception 'invalid mode'; end if;

  select * into v_reversal
    from public.reconciliation_reversals
   where id = p_reversal_id
   for update;
  if not found then raise exception 'reversal not found'; end if;
  if v_reversal.resolved_at is not null then
    return jsonb_build_object(
      'run_id', v_reversal.run_id,
      'amount', v_reversal.amount,
      'already_resolved', true
    );
  end if;

  if p_mode = 'refund' then
    if v_reversal.suspect_payment_id is null then
      raise exception 'no matching posted payment found for this reversal';
    end if;
    select * into v_suspect
      from public.payments
     where id = v_reversal.suspect_payment_id
     for update;
    if not found then raise exception 'the suspected payment no longer exists'; end if;
    if v_reversal.deposit_date is null or v_reversal.deposit_date > current_date then
      raise exception 'reversal has an invalid refund date';
    end if;

    select * into v_existing
      from public.payments
     where external_ref = v_reversal.external_ref
     for update;
    if found then
      if v_existing.payment_type <> 'refund'
         or v_existing.tenancy_id <> v_suspect.tenancy_id
         or v_existing.amount <> v_reversal.amount
         or v_existing.paid_on <> v_reversal.deposit_date then
        raise exception 'reversal external reference conflicts with an existing payment';
      end if;
      v_refund_id := v_existing.id;
    else
      insert into public.payments(
        tenancy_id, paid_on, amount, payment_type, method, notes, external_ref
      ) values (
        v_suspect.tenancy_id,
        v_reversal.deposit_date,
        v_reversal.amount,
        'refund',
        'Reconciliation',
        'Zelle reversal (' || left(v_reversal.raw_description, 120) || ')',
        v_reversal.external_ref
      ) returning id into v_refund_id;
    end if;
  end if;

  update public.reconciliation_reversals
     set resolved_at = now(),
         resolved_by = p_resolved_by,
         resolution = case when p_mode = 'refund' then 'refunded' else 'dismissed' end,
         refund_payment_id = v_refund_id
   where id = p_reversal_id;

  return jsonb_build_object(
    'run_id', v_reversal.run_id,
    'amount', v_reversal.amount,
    'already_resolved', false,
    'refund_payment_id', v_refund_id
  );
end;
$$;

revoke all on function public.resolve_reconciliation_reversal(uuid, text, text)
  from public, anon;
grant execute on function public.resolve_reconciliation_reversal(uuid, text, text)
  to authenticated, service_role;
