-- Optional gender on the tenant profile (male / female / other).
alter table tenants
  add column gender text check (gender in ('male', 'female', 'other'));
