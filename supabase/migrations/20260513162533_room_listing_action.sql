-- Listing action / VA work-priority flag per room.
-- Default: new_ad (blue) — every fresh room/vacancy starts here.
create type listing_action as enum (
  'new_ad',
  'update_price_or_date',
  'delete_listing',
  'boost_post',
  'priority'
);

alter table rooms
  add column listing_action listing_action not null default 'new_ad';
