-- Track who posted a room's ad. Whoever saves the ad URL is recorded as the
-- poster (snapshot of their display name at save time). Cleared when the URL
-- is removed.
alter table rooms
  add column ad_posted_by text;
