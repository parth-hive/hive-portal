-- Hard DB-level guarantee for tenant-ledger writes: only the two operators
-- can insert/update/delete ledger charges and credit allocations, no matter
-- how the API is reached. Mirrors canEditLedger() in src/lib/access.ts —
-- keep the two email lists in sync. Reads stay open to all authenticated
-- users (the existing select policies), and the service role (Telegram bot,
-- cron) bypasses RLS as always.

drop policy "authenticated write charges" on tenancy_charges;
create policy "ledger admins write charges" on tenancy_charges
  for all to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  )
  with check (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  );

drop policy "authenticated write allocations" on credit_allocations;
create policy "ledger admins write allocations" on credit_allocations
  for all to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  )
  with check (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  );
