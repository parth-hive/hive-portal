-- Small-balance write-off as a first-class ledger kind. An 'adjustment'
-- charge is a credit line like 'settlement': computeLedger subtracts it from
-- the net balance and the tenant-page ledger shows it on the payment side.
-- Posted automatically by the balance-reminder passes (month-end cron and the
-- manual "Send balance reminders" action) when a tenant's residual balance is
-- under $5 — the residue is forgiven and the account treated as settled
-- instead of sending a dunning email over pocket change.

alter table public.tenancy_charges
  drop constraint tenancy_charges_kind_check;
alter table public.tenancy_charges
  add constraint tenancy_charges_kind_check check (
    kind = any (
      array[
        'security_deposit'::text,
        'late_fee'::text,
        'utility_overage'::text,
        'other'::text,
        'settlement'::text,
        'adjustment'::text
      ]
    )
  );
