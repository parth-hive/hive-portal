-- Lounge as a building amenity, alongside gym / rooftop / etc.
alter table properties
  add column has_lounge boolean not null default false;
