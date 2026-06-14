-- Informational lease end date on a tenancy (the contractual end), shown next
-- to the start date in the tenant profile. Deliberately SEPARATE from the
-- operational `end_date` column (which drives move-out / inventory / cleaning).
-- It is used only to fire a 45-day "lease ending" reminder email.
--
-- lease_end_reminded_at records when that reminder was sent so it fires once;
-- it is reset to null whenever lease_end_date changes, re-arming the reminder.
alter table tenancies
  add column lease_end_date date,
  add column lease_end_reminded_at timestamptz;
