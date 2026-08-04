-- Soft-delete for properties with payment history: "deleting" such a
-- property retires it instead of refusing. Archived properties keep all
-- rooms/tenancies/ledgers for the books, disappear from the Rent Tracker's
-- vacant groups, inventory, cleaning, and the properties list, and surface
-- on the Past Tenants page under their property group.
alter table public.properties
  add column if not exists archived_at timestamptz;
