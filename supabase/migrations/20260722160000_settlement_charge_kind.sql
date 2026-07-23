-- Move-out settlement as a first-class ledger kind. A 'settlement' charge is
-- a credit line: computeLedger subtracts it from the net balance, and the
-- tenant-page ledger shows it on the payment side. Posted by the rent
-- tracker's "Settle" button for moved-out tenants (deposit applied toward
-- the balance, remainder written off), bringing the ledger to exactly $0
-- without fabricating a payment (amounts stay > 0; collections analytics
-- only count payment rows, so settlements never inflate money received).

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
        'settlement'::text
      ]
    )
  );
