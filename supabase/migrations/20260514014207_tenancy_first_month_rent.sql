-- Optional override for the first month's rent when a tenant moves in
-- mid-month. If set, /tenants displays this as the "due" amount for the
-- starting calendar month only. Every subsequent month uses monthly_rent.
alter table tenancies
  add column first_month_rent numeric(10, 2);
