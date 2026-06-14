-- "Delete listing" flow: when a room is pulled from the Inventory listing
-- because it's been rented, it's flagged pending_tenant. Such rooms drop off
-- the Inventory table and surface on the Add Tenant page as "listings to fill",
-- where the admin enters the new tenant's info (or restores it to inventory).
-- The flag is cleared when a tenancy is created for the room (or on restore).
alter table rooms
  add column pending_tenant boolean not null default false;
