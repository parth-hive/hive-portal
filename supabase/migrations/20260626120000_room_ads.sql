-- Multiple ads per room.
--
-- Previously each room held a single ad on the rooms table itself
-- (rooms.ad_url + ad_posted_by + ad_boosted). Now several people can each post
-- their own ad URL for the SAME listing: every ad is its own row in room_ads and
-- counts toward its poster's tally (two ads by one person on one room = two).
-- The "boosted" concept was dropped (the boost_post listing_action is separate
-- and unaffected).
--
-- This is the additive ("expand") half of the change: create the table and
-- backfill existing single ads. The legacy rooms.ad_url / ad_posted_by /
-- ad_boosted columns are intentionally left in place but dormant (no longer read
-- or written by the app); a later migration can drop them once this is deployed.

create table room_ads (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms (id) on delete cascade,
  url        text not null,
  -- Snapshot of whoever saved the URL (display name, else email) — matches the
  -- old rooms.ad_posted_by semantics. Nullable for ads with no resolvable poster.
  posted_by  text,
  created_at timestamptz not null default now()
);

create index room_ads_room_idx on room_ads (room_id);
-- The inventory poster tally / filter groups ads by lowercased poster.
create index room_ads_posted_by_idx on room_ads (lower(posted_by));

alter table room_ads enable row level security;

-- Mirror the rooms policies: authenticated users read and write; the service
-- role bypasses RLS for background work.
create policy "authenticated read room_ads"
  on room_ads for select to authenticated using (true);
create policy "authenticated write room_ads"
  on room_ads for all to authenticated using (true) with check (true);

-- Backfill: migrate each room's existing single ad into a row.
insert into room_ads (room_id, url, posted_by)
select
  id,
  btrim(ad_url),
  nullif(btrim(coalesce(ad_posted_by, '')), '')
from rooms
where ad_url is not null and btrim(ad_url) <> '';
