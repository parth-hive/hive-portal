-- Ad post tracking per room: the URL of the live ad and whether it's boosted.
alter table rooms
  add column ad_url text,
  add column ad_boosted boolean not null default false;
