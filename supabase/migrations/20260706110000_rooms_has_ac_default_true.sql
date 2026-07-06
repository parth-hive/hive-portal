-- Every room in the portfolio has AC, so new rooms should start with it on.
alter table public.rooms
  alter column has_ac set default true;
