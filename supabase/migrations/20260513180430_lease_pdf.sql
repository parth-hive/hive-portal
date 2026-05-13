-- Lease PDF stored in Supabase Storage; tenancy holds the object path.
alter table tenancies
  add column lease_pdf_path text;

-- Private bucket for lease PDFs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leases',
  'leases',
  false,
  20971520,                          -- 20 MB
  array['application/pdf']
)
on conflict (id) do nothing;

-- RLS on storage.objects is enabled by default in Supabase.
-- Allow any authenticated user to read/write objects in the `leases` bucket
-- (matches the single-user model used elsewhere in this schema).

drop policy if exists "authenticated read leases" on storage.objects;
create policy "authenticated read leases"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'leases');

drop policy if exists "authenticated write leases" on storage.objects;
create policy "authenticated write leases"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'leases');

drop policy if exists "authenticated update leases" on storage.objects;
create policy "authenticated update leases"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'leases')
  with check (bucket_id = 'leases');

drop policy if exists "authenticated delete leases" on storage.objects;
create policy "authenticated delete leases"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'leases');
