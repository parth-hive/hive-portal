-- Flat monthly unit costs used by the Profitability grid (mirrors the
-- operator's spreadsheet: internet, cleaning service, and renter's insurance
-- are steady per-month figures per unit).
alter table public.properties
  add column if not exists internet_monthly numeric,
  add column if not exists cleaning_fee_monthly numeric,
  add column if not exists insurance_monthly numeric;
