-- Unit-level lease terms on the property: what the unit itself rents for,
-- the master-lease window, and recurring per-year fees.
alter table public.properties
  add column if not exists unit_rent numeric,
  add column if not exists unit_lease_start date,
  add column if not exists unit_lease_end date,
  add column if not exists amenity_fees_yearly numeric,
  add column if not exists misc_fees_yearly numeric;
