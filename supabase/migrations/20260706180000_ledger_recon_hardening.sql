-- Ledger & reconciliation audit hardening.

-- 1) payments: any authenticated user may still RECORD a payment (staff
--    workflow), but updating or deleting payment rows — which rewrites a
--    tenant's balance — is restricted to the two operators, mirroring the
--    tenancy_charges policy. Keep the email list in sync with
--    canEditLedger() in src/lib/access.ts.
drop policy "authenticated write payments" on payments;
create policy "authenticated insert payments" on payments
  for insert to authenticated with check (true);
create policy "ledger admins update payments" on payments
  for update to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  )
  with check (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  );
create policy "ledger admins delete payments" on payments
  for delete to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  );

-- 2) payments.amount had no positivity constraint (tenancy_charges has one);
--    a zero/negative payment inserted API-side would silently skew balances.
alter table payments add constraint payments_amount_positive
  check (amount > 0);

-- 3) utility_overage_alerts: the app gates acknowledgment to ledger admins,
--    but the write policy was open to all authenticated users.
drop policy "authenticated write overage alerts" on utility_overage_alerts;
create policy "ledger admins write overage alerts" on utility_overage_alerts
  for all to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  )
  with check (
    lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  );

-- 4) Raw bank statements (reconciliation bucket) could be DELETED by any
--    authenticated user, destroying the audit trail. Deletion is now
--    operator-only; read/upload stay open (any user may create a run).
drop policy "authenticated delete reconciliation" on storage.objects;
create policy "ledger admins delete reconciliation"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reconciliation'
    and lower(coalesce(auth.jwt() ->> 'email', ''))
      in ('vdutta1485@gmail.com', 'parthrudakia@gmail.com')
  );
