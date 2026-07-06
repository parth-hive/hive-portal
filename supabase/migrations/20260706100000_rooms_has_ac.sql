-- Room-level AC flag (e.g. a window unit in that specific room).
-- Distinct from the unit-level "Central A/C" amenity on properties.
alter table public.rooms
  add column has_ac boolean not null default false;
