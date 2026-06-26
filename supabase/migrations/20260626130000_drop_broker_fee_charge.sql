-- Remove "broker fee" as a charge kind.
--
-- Broker fees are no longer tracked as their own ledger category (dropped from
-- the UI, the rent ledger, and the ledger download). Tighten the
-- tenancy_charges.kind CHECK so a broker_fee charge can no longer be created.
-- Safe: there are no existing rows with kind = 'broker_fee'.
--
-- Note: the payment_type enum also has a dormant 'broker_fee' value. Postgres
-- can't cleanly DROP an enum value, and nothing uses it, so it's left in place
-- (unreachable from the app).

alter table tenancy_charges drop constraint tenancy_charges_kind_check;
alter table tenancy_charges add constraint tenancy_charges_kind_check
  check (kind in ('security_deposit', 'late_fee', 'other'));
