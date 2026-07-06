-- Utilities audit hardening.
--
-- 1) DB backstop against double-charging a bill's overage: even if two
--    sessions race past the app-level overage_charged_at guard, the second
--    set of 'utility_overage' charges for the same (bill, tenancy) is
--    rejected by this partial unique index.
create unique index tenancy_charges_overage_once
  on tenancy_charges (bill_id, tenancy_id)
  where kind = 'utility_overage';

-- 2) Money column stored to the cent. Extraction summed floats in JS, so
--    totals like 62.370000000000005 were stored verbatim.
alter table utility_bills
  alter column total_amount type numeric(10,2);

-- 3) Tighten credit_allocations.kind: 'broker_fee' was dropped from the
--    ledger (20260626130000) but only tenancy_charges was constrained; an
--    allocation with a dangling kind would desync computeLedger from the
--    running ledger. No such rows exist.
alter table credit_allocations drop constraint credit_allocations_kind_check;
alter table credit_allocations add constraint credit_allocations_kind_check
  check (kind in ('security_deposit', 'late_fee', 'other'));
