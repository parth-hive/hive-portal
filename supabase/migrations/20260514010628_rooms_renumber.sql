-- Normalize every existing room's label as "Room 1", "Room 2", ... within
-- its property, ordered by created_at. Replaces ad-hoc labels (Master, A,
-- etc.) with the sequential scheme used going forward.
with numbered as (
  select id,
         'Room ' || row_number() over (
           partition by property_id order by created_at, id
         ) as new_label
  from rooms
)
update rooms r
   set room_number = n.new_label
  from numbered n
 where r.id = n.id;
