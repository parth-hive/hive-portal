-- Add marketing/listing fields to rooms so vacancies have a ready-to-post
-- description and a Google Drive link for the room's photos.
alter table rooms
  add column marketing_description text,
  add column photos_url text;
