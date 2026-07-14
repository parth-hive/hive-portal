-- "Moved out with balance" (Rent Tracker): a departed tenant's outstanding
-- balance stays listed until an operator dismisses it (collected outside the
-- system, offset, or written off). Dismissal is per-tenancy and reversible.
alter table public.tenancies
  add column if not exists balance_dismissed_at timestamptz,
  add column if not exists balance_dismissed_by text;
