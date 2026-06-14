-- Rename the operational tenancy end date to `move_out_date` for clarity —
-- it's the date the tenant actually vacates (drives status / inventory /
-- move-out cleaning), distinct from the informational `lease_end_date`.
-- v_room_occupancy selects this column, so recreate it to expose the new name.
drop view if exists v_room_occupancy;

alter table tenancies rename column end_date to move_out_date;

create view v_room_occupancy as
select
  r.id                as room_id,
  r.property_id,
  r.room_number,
  r.has_ac,
  r.has_private_bathroom,
  r.status            as room_status,
  r.total_rent,
  r.available_from,
  p.building_name,
  p.street_address,
  p.unit_number,
  property_display_name(p.building_name, p.street_address, p.unit_number) as property_name,
  p.neighborhood,
  t.id                as tenancy_id,
  t.tenant_id,
  ten.full_name       as tenant_name,
  ten.email           as tenant_email,
  ten.phone           as tenant_phone,
  t.monthly_rent      as tenancy_rent,
  t.start_date,
  t.move_out_date,
  t.status            as tenancy_status
from rooms r
join properties p on p.id = r.property_id
left join lateral (
  select * from tenancies
  where room_id = r.id and status = 'active'
  order by start_date desc
  limit 1
) t on true
left join tenants ten on ten.id = t.tenant_id;
