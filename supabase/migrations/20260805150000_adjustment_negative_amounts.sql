-- Adjustments can also absorb a small CREDIT residue (tenant rounded a Zelle
-- up to the dollar and the ledger nets a few cents negative). A negative
-- adjustment amount is that mirror image: computeLedger subtracts it from
-- `settled`, nudging the net balance up to exactly $0, and the tenant-page
-- ledger shows it on the charge (debit) side. Every other kind keeps the
-- strict positive-amount rule.

alter table public.tenancy_charges
  drop constraint tenancy_charges_amount_check;
alter table public.tenancy_charges
  add constraint tenancy_charges_amount_check check (
    case when kind = 'adjustment' then amount <> 0 else amount > 0 end
  );
