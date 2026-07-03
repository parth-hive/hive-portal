-- Restructure amenities into two curated lists on properties:
--   unit_amenities     (High-Speed WiFi, Central A/C, In-Unit Washer/Dryer,
--                       Fully Equipped Kitchen, Smart TV, Dishwasher)
--   building_amenities (24/7 Doorman, Fitness Center, Rooftop Terrace,
--                       Package Room, Laundry Room, Elevator, Courtyard,
--                       Parking Garage, Swimming Pool)
-- Replaces the per-flag boolean columns; rooms keep has_private_bathroom
-- (a room attribute, not an amenity). rooms.has_ac moves up to the unit
-- as 'Central A/C'.

alter table properties
  add column unit_amenities text[] not null default '{}',
  add column building_amenities text[] not null default '{}';

-- Backfill from the legacy boolean flags, in canonical list order.
update properties p set
  unit_amenities = array_remove(array[
    case when exists (
      select 1 from rooms r where r.property_id = p.id and r.has_ac
    ) then 'Central A/C' end,
    case when p.in_unit_laundry then 'In-Unit Washer/Dryer' end
  ], null),
  building_amenities = array_remove(array[
    case when p.has_doorman then '24/7 Doorman' end,
    case when p.has_gym then 'Fitness Center' end,
    case when p.has_rooftop then 'Rooftop Terrace' end,
    case when p.laundry_in_building then 'Laundry Room' end,
    case when p.has_elevator then 'Elevator' end,
    case when p.has_parking then 'Parking Garage' end
  ], null);

-- 'Lounge' has no slot in the new taxonomy; keep it in the free-text notes.
update properties
set amenities_notes = nullif(concat_ws('; ', amenities_notes, 'Lounge'), '')
where has_lounge
  and (amenities_notes is null or amenities_notes not ilike '%lounge%');

alter table properties
  drop column has_gym,
  drop column has_elevator,
  drop column has_parking,
  drop column has_doorman,
  drop column has_rooftop,
  drop column has_lounge,
  drop column laundry_in_building,
  drop column in_unit_laundry;

-- v_room_occupancy selects rooms.has_ac; recreate it without the column.
drop view if exists v_room_occupancy;

alter table rooms drop column has_ac;

create view v_room_occupancy as
select
  r.id                as room_id,
  r.property_id,
  r.room_number,
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
