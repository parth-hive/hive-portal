-- =====================================================================
-- Hive Portal initial schema
-- =====================================================================
-- Covers the 11 sheets from the operating file:
--   properties + rooms     <- Inventory, Inventory Data
--   tenants + tenancies    <- Rent Tracker (occupant side)
--   payments               <- Rent Tracker (paid column), Balance Owed
--   cleaning_records       <- Cleaning
--   marketing_channels     <- Facebook Groups
--   posting_log            <- Facebook Groups (posting cadence)
--   credentials            <- Payment_Maintenance Log In, Internet Log In,
--                              Utility Connections, Utilities, Logins
--   credential_access_log  <- audit trail for credentials
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------- Enums ----------
create type room_status as enum ('occupied', 'available', 'reserved', 'maintenance');
create type tenancy_status as enum ('active', 'ended', 'upcoming');
create type payment_type as enum ('rent', 'security_deposit', 'late_fee', 'utility', 'other', 'refund');
create type credential_category as enum (
  'payment_portal',     -- ClickPay, Bilt, AppFolio, etc.
  'maintenance_portal', -- BuildingLink, Avalon Access, Visitt, etc.
  'utility',            -- Coned, water, gas
  'internet',           -- Spectrum, RCN
  'building_login',     -- general building portal logins
  'tool_login',         -- Aircall, Amazon, Buildium, etc.
  'marketing',          -- Facebook, Craigslist account logins
  'other'
);
create type marketing_platform as enum ('facebook', 'craigslist', 'instagram', 'zillow', 'apartments_com', 'other');

-- ---------- leaseholders ----------
-- People the master lease can be in the name of (e.g. Vinny, Nehal, Suman).
-- A property/unit is leased under one of them.
create table leaseholders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- properties (apartment units) ----------
-- A property = one apartment unit. Each property has 3–4 rooms (see rooms table)
-- that are rented individually.
create table properties (
  id                  uuid primary key default gen_random_uuid(),
  building_name       text,                          -- optional, e.g. "MetroVue", "Avalon Midtown West"
  street_address      text not null,                 -- "3516 John F. Kennedy Boulevard"
  unit_number         text not null,                 -- "1001", "24M", "8E"
  cross_street        text,                          -- e.g. "Washington & Wall"
  neighborhood        text,                          -- JSQ, UWS, FiDi, Midtown, etc.
  bedrooms            integer,                       -- total bedrooms in the unit
  bathrooms           numeric(3,1),                  -- e.g. 1, 1.5, 2
  has_gym             boolean not null default false,
  has_elevator        boolean not null default false,
  has_parking         boolean not null default false,
  has_doorman         boolean not null default false,
  laundry_in_building boolean not null default false,
  in_unit_laundry     boolean not null default false,
  amenities_notes     text,
  leaseholder_id      uuid references leaseholders(id) on delete set null, -- whose name the lease is in
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (street_address, unit_number)
);

create index properties_neighborhood_idx on properties (neighborhood);
create index properties_leaseholder_idx on properties (leaseholder_id);

-- ---------- rooms (rented individually within a property) ----------
create table rooms (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references properties(id) on delete cascade,
  room_number         text,                          -- "Room 1", "Room 2", or any label
  has_ac              boolean not null default false,
  has_private_bathroom boolean not null default false,
  base_rent           numeric(10,2),                 -- room rent without bundle fee
  bundle_fee          numeric(10,2) default 125,     -- utilities + wi-fi + maid + amenities
  total_rent          numeric(10,2) generated always as (
                        coalesce(base_rent, 0) + coalesce(bundle_fee, 0)
                      ) stored,
  status              room_status not null default 'available',
  available_from      date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index rooms_property_idx on rooms (property_id);
create index rooms_status_idx on rooms (status);

-- ---------- tenants ----------
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- tenancies ----------
create table tenancies (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references rooms(id) on delete restrict,
  tenant_id           uuid not null references tenants(id) on delete restrict,
  start_date          date not null,
  end_date            date,
  monthly_rent        numeric(10,2) not null,         -- rent + bundle as agreed at lease
  security_deposit    numeric(10,2),
  status              tenancy_status not null default 'active',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index tenancies_room_idx on tenancies (room_id);
create index tenancies_tenant_idx on tenancies (tenant_id);
create index tenancies_status_idx on tenancies (status);

-- ---------- payments ----------
create table payments (
  id              uuid primary key default gen_random_uuid(),
  tenancy_id      uuid not null references tenancies(id) on delete cascade,
  paid_on         date not null,
  amount          numeric(10,2) not null,
  payment_type    payment_type not null default 'rent',
  method          text,                               -- Zelle, ClickPay, Bilt, check, etc.
  notes           text,
  created_at      timestamptz not null default now()
);

create index payments_tenancy_idx on payments (tenancy_id);
create index payments_paid_on_idx on payments (paid_on);

-- ---------- cleaning_records ----------
create table cleaning_records (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references properties(id) on delete cascade,
  cleaning_date   date not null,
  assigned_to     text,                               -- "Vinny" / "Nehal" / cleaner name
  notes           text,
  created_at      timestamptz not null default now()
);

create index cleaning_property_idx on cleaning_records (property_id);
create index cleaning_date_idx on cleaning_records (cleaning_date desc);

-- ---------- marketing_channels ----------
create table marketing_channels (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,             -- "NYC Apartments for Rent"
  platform                marketing_platform not null default 'facebook',
  url                     text,
  posting_cadence_days    integer,                   -- 3 = post every 3 days
  active                  boolean not null default true,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------- posting_log ----------
create table posting_log (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references marketing_channels(id) on delete cascade,
  posted_at   timestamptz not null default now(),
  ad_url      text,
  notes       text
);

create index posting_log_channel_idx on posting_log (channel_id);
create index posting_log_posted_at_idx on posting_log (posted_at desc);

-- ---------- credentials ----------
-- Stores creds for utility/internet/portal/general tool logins.
-- For v1 the password column is plain text (under Supabase's at-rest encryption + RLS).
-- Future enhancement: pgsodium / pgcrypto column-level encryption with key from Supabase Vault.
create table credentials (
  id                  uuid primary key default gen_random_uuid(),
  category            credential_category not null,
  service_name        text not null,                 -- "Spectrum", "ClickPay", "BoA", "Aircall"
  property_id         uuid references properties(id) on delete set null,
  username            text,
  password            text,                          -- TODO Phase 5.5: encrypt
  login_url           text,
  account_number      text,
  owner_label         text,                          -- which email/identity it's under
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index credentials_category_idx on credentials (category);
create index credentials_property_idx on credentials (property_id);

-- ---------- credential_access_log ----------
create table credential_access_log (
  id              uuid primary key default gen_random_uuid(),
  credential_id   uuid not null references credentials(id) on delete cascade,
  accessed_by     uuid references auth.users(id),
  accessed_at     timestamptz not null default now(),
  action          text                                -- 'view', 'reveal', 'copy', 'edit'
);

create index credential_access_log_cred_idx on credential_access_log (credential_id);
create index credential_access_log_at_idx on credential_access_log (accessed_at desc);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_leaseholders_updated_at
  before update on leaseholders
  for each row execute function set_updated_at();

create trigger trg_properties_updated_at
  before update on properties
  for each row execute function set_updated_at();

create trigger trg_rooms_updated_at
  before update on rooms
  for each row execute function set_updated_at();

create trigger trg_tenants_updated_at
  before update on tenants
  for each row execute function set_updated_at();

create trigger trg_tenancies_updated_at
  before update on tenancies
  for each row execute function set_updated_at();

create trigger trg_marketing_channels_updated_at
  before update on marketing_channels
  for each row execute function set_updated_at();

create trigger trg_credentials_updated_at
  before update on credentials
  for each row execute function set_updated_at();

-- ---------- helpers ----------
-- Build a single display label for a unit.
create or replace function property_display_name(
  building_name  text,
  street_address text,
  unit_number    text
) returns text language sql immutable as $$
  select coalesce(nullif(trim(building_name), ''), street_address)
    || ' Apt ' || unit_number;
$$;

-- ---------- Helpful views ----------

-- Current tenant per room (most recent active tenancy) with property context.
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
  t.end_date,
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

-- Outstanding balance per active tenancy for the current calendar month
create view v_current_month_status as
with month_bounds as (
  select date_trunc('month', current_date)::date as month_start,
         (date_trunc('month', current_date) + interval '1 month - 1 day')::date as month_end
),
paid_this_month as (
  select tenancy_id, sum(amount) as paid
  from payments, month_bounds
  where paid_on between month_start and month_end
    and payment_type = 'rent'
  group by tenancy_id
)
select
  t.id            as tenancy_id,
  t.room_id,
  t.tenant_id,
  ten.full_name   as tenant_name,
  ten.email       as tenant_email,
  property_display_name(p.building_name, p.street_address, p.unit_number) as property_name,
  r.room_number,
  t.monthly_rent,
  coalesce(ptm.paid, 0) as paid_this_month,
  t.monthly_rent - coalesce(ptm.paid, 0) as balance_due
from tenancies t
join tenants ten on ten.id = t.tenant_id
join rooms r on r.id = t.room_id
join properties p on p.id = r.property_id
left join paid_this_month ptm on ptm.tenancy_id = t.id
where t.status = 'active';
