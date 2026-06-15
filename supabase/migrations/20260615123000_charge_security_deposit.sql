-- Allow the security deposit to be tracked as a ledger charge (like broker and
-- late fees) rather than only as the fixed tenancies.security_deposit field.
-- The tenancy field stays for reference; the ledger now reads the deposit owed
-- from a 'security_deposit' charge so it shows up as a line in the running
-- balance and can be added on demand.
alter table tenancy_charges drop constraint tenancy_charges_kind_check;
alter table tenancy_charges add constraint tenancy_charges_kind_check
  check (kind in ('security_deposit', 'broker_fee', 'late_fee', 'other'));
