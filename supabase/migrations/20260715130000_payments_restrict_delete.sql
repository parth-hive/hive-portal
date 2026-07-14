-- Financial records must outlive the entities they describe. Payments used
-- to CASCADE from tenancies (which themselves cascade from tenants and
-- rooms), so deleting a tenant/room/property silently destroyed payment
-- history and rewrote past reporting. RESTRICT makes any delete that would
-- orphan payments fail instead — end the tenancy, don't erase the money.
alter table public.payments
  drop constraint if exists payments_tenancy_id_fkey;
alter table public.payments
  add constraint payments_tenancy_id_fkey
  foreign key (tenancy_id) references public.tenancies(id) on delete restrict;
