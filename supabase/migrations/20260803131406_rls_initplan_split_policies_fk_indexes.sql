-- Performance pass from the Supabase advisors:
-- 1. RLS auth checks wrapped in scalar subselects so Postgres evaluates
--    them once per query (init-plan) instead of once per row.
-- 2. FOR ALL write policies split into insert/update/delete so SELECTs
--    stop evaluating two permissive policies per row (the read policy
--    already grants SELECT on these tables).
-- 3. Covering indexes for all unindexed foreign keys.
-- No access rules change: same actors can do exactly the same things.

-- ---- 1+2: split owner/operator FOR ALL write policies ----

drop policy "authenticated write agreement addresses" on public.agreement_addresses;
create policy "authenticated write agreement addresses (insert)" on public.agreement_addresses
  for insert to authenticated with check (true);
create policy "authenticated write agreement addresses (update)" on public.agreement_addresses
  for update to authenticated using (true) with check (true);
create policy "authenticated write agreement addresses (delete)" on public.agreement_addresses
  for delete to authenticated using (true);

drop policy "authenticated write board comments" on public.board_comments;
create policy "authenticated write board comments (insert)" on public.board_comments
  for insert to authenticated with check (true);
create policy "authenticated write board comments (update)" on public.board_comments
  for update to authenticated using (true) with check (true);
create policy "authenticated write board comments (delete)" on public.board_comments
  for delete to authenticated using (true);

drop policy "authenticated write board prefs" on public.board_prefs;
create policy "authenticated write board prefs (insert)" on public.board_prefs
  for insert to authenticated with check (true);
create policy "authenticated write board prefs (update)" on public.board_prefs
  for update to authenticated using (true) with check (true);
create policy "authenticated write board prefs (delete)" on public.board_prefs
  for delete to authenticated using (true);

drop policy "authenticated write board tasks" on public.board_tasks;
create policy "authenticated write board tasks (insert)" on public.board_tasks
  for insert to authenticated with check (true);
create policy "authenticated write board tasks (update)" on public.board_tasks
  for update to authenticated using (true) with check (true);
create policy "authenticated write board tasks (delete)" on public.board_tasks
  for delete to authenticated using (true);

drop policy "authenticated write cleaners" on public.cleaners;
create policy "authenticated write cleaners (insert)" on public.cleaners
  for insert to authenticated with check (true);
create policy "authenticated write cleaners (update)" on public.cleaners
  for update to authenticated using (true) with check (true);
create policy "authenticated write cleaners (delete)" on public.cleaners
  for delete to authenticated using (true);

drop policy "authenticated write cleaning" on public.cleaning_records;
create policy "authenticated write cleaning (insert)" on public.cleaning_records
  for insert to authenticated with check (true);
create policy "authenticated write cleaning (update)" on public.cleaning_records
  for update to authenticated using (true) with check (true);
create policy "authenticated write cleaning (delete)" on public.cleaning_records
  for delete to authenticated using (true);

drop policy "authenticated write leaseholders" on public.leaseholders;
create policy "authenticated write leaseholders (insert)" on public.leaseholders
  for insert to authenticated with check (true);
create policy "authenticated write leaseholders (update)" on public.leaseholders
  for update to authenticated using (true) with check (true);
create policy "authenticated write leaseholders (delete)" on public.leaseholders
  for delete to authenticated using (true);

drop policy "authenticated write channels" on public.marketing_channels;
create policy "authenticated write channels (insert)" on public.marketing_channels
  for insert to authenticated with check (true);
create policy "authenticated write channels (update)" on public.marketing_channels
  for update to authenticated using (true) with check (true);
create policy "authenticated write channels (delete)" on public.marketing_channels
  for delete to authenticated using (true);

drop policy "authenticated write posts" on public.posting_log;
create policy "authenticated write posts (insert)" on public.posting_log
  for insert to authenticated with check (true);
create policy "authenticated write posts (update)" on public.posting_log
  for update to authenticated using (true) with check (true);
create policy "authenticated write posts (delete)" on public.posting_log
  for delete to authenticated using (true);

drop policy "authenticated write property_cleaners" on public.property_cleaners;
create policy "authenticated write property_cleaners (insert)" on public.property_cleaners
  for insert to authenticated with check (true);
create policy "authenticated write property_cleaners (update)" on public.property_cleaners
  for update to authenticated using (true) with check (true);
create policy "authenticated write property_cleaners (delete)" on public.property_cleaners
  for delete to authenticated using (true);

drop policy "authenticated write room_ads" on public.room_ads;
create policy "authenticated write room_ads (insert)" on public.room_ads
  for insert to authenticated with check (true);
create policy "authenticated write room_ads (update)" on public.room_ads
  for update to authenticated using (true) with check (true);
create policy "authenticated write room_ads (delete)" on public.room_ads
  for delete to authenticated using (true);

drop policy "authenticated write room_change_events" on public.room_change_events;
create policy "authenticated write room_change_events (insert)" on public.room_change_events
  for insert to authenticated with check (true);
create policy "authenticated write room_change_events (update)" on public.room_change_events
  for update to authenticated using (true) with check (true);
create policy "authenticated write room_change_events (delete)" on public.room_change_events
  for delete to authenticated using (true);

drop policy "authenticated write rooms" on public.rooms;
create policy "authenticated write rooms (insert)" on public.rooms
  for insert to authenticated with check (true);
create policy "authenticated write rooms (update)" on public.rooms
  for update to authenticated using (true) with check (true);
create policy "authenticated write rooms (delete)" on public.rooms
  for delete to authenticated using (true);

drop policy "authenticated write utility hints" on public.utility_unit_hints;
create policy "authenticated write utility hints (insert)" on public.utility_unit_hints
  for insert to authenticated with check (true);
create policy "authenticated write utility hints (update)" on public.utility_unit_hints
  for update to authenticated using (true) with check (true);
create policy "authenticated write utility hints (delete)" on public.utility_unit_hints
  for delete to authenticated using (true);

drop policy "financial operators write ignored_payers" on public.ignored_payers;
create policy "financial operators write ignored_payers (insert)" on public.ignored_payers
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write ignored_payers (update)" on public.ignored_payers
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write ignored_payers (delete)" on public.ignored_payers
  for delete to authenticated using ((select is_financial_operator()));

drop policy "operators write notification_recipients" on public.notification_recipients;
create policy "operators write notification_recipients (insert)" on public.notification_recipients
  for insert to authenticated with check ((select is_financial_operator()));
create policy "operators write notification_recipients (update)" on public.notification_recipients
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "operators write notification_recipients (delete)" on public.notification_recipients
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write properties" on public.properties;
create policy "financial operators write properties (insert)" on public.properties
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write properties (update)" on public.properties
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write properties (delete)" on public.properties
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write recon deposits" on public.reconciliation_deposits;
create policy "financial operators write recon deposits (insert)" on public.reconciliation_deposits
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write recon deposits (update)" on public.reconciliation_deposits
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write recon deposits (delete)" on public.reconciliation_deposits
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write recon matches" on public.reconciliation_matches;
create policy "financial operators write recon matches (insert)" on public.reconciliation_matches
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write recon matches (update)" on public.reconciliation_matches
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write recon matches (delete)" on public.reconciliation_matches
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write reconciliation_reversals" on public.reconciliation_reversals;
create policy "financial operators write reconciliation_reversals (insert)" on public.reconciliation_reversals
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write reconciliation_reversals (update)" on public.reconciliation_reversals
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write reconciliation_reversals (delete)" on public.reconciliation_reversals
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write recon runs" on public.reconciliation_runs;
create policy "financial operators write recon runs (insert)" on public.reconciliation_runs
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write recon runs (update)" on public.reconciliation_runs
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write recon runs (delete)" on public.reconciliation_runs
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write rent reminder batches" on public.rent_reminder_batches;
create policy "financial operators write rent reminder batches (insert)" on public.rent_reminder_batches
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write rent reminder batches (update)" on public.rent_reminder_batches
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write rent reminder batches (delete)" on public.rent_reminder_batches
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write tenancies" on public.tenancies;
create policy "financial operators write tenancies (insert)" on public.tenancies
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write tenancies (update)" on public.tenancies
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write tenancies (delete)" on public.tenancies
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write tenants" on public.tenants;
create policy "financial operators write tenants (insert)" on public.tenants
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write tenants (update)" on public.tenants
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write tenants (delete)" on public.tenants
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write utility charges" on public.utility_bill_charges;
create policy "financial operators write utility charges (insert)" on public.utility_bill_charges
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write utility charges (update)" on public.utility_bill_charges
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write utility charges (delete)" on public.utility_bill_charges
  for delete to authenticated using ((select is_financial_operator()));

drop policy "financial operators write utility bills" on public.utility_bills;
create policy "financial operators write utility bills (insert)" on public.utility_bills
  for insert to authenticated with check ((select is_financial_operator()));
create policy "financial operators write utility bills (update)" on public.utility_bills
  for update to authenticated using ((select is_financial_operator())) with check ((select is_financial_operator()));
create policy "financial operators write utility bills (delete)" on public.utility_bills
  for delete to authenticated using ((select is_financial_operator()));

drop policy "owners write credentials" on public.credentials;
create policy "owners write credentials (insert)" on public.credentials
  for insert to authenticated with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "owners write credentials (update)" on public.credentials
  for update to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']))) with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "owners write credentials (delete)" on public.credentials
  for delete to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));

drop policy "ledger admins write allocations" on public.credit_allocations;
create policy "ledger admins write allocations (insert)" on public.credit_allocations
  for insert to authenticated with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write allocations (update)" on public.credit_allocations
  for update to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']))) with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write allocations (delete)" on public.credit_allocations
  for delete to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));

drop policy "owners write profitability_line_items" on public.profitability_line_items;
create policy "owners write profitability_line_items (insert)" on public.profitability_line_items
  for insert to authenticated with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "owners write profitability_line_items (update)" on public.profitability_line_items
  for update to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']))) with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "owners write profitability_line_items (delete)" on public.profitability_line_items
  for delete to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));

drop policy "ledger admins write charges" on public.tenancy_charges;
create policy "ledger admins write charges (insert)" on public.tenancy_charges
  for insert to authenticated with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write charges (update)" on public.tenancy_charges
  for update to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']))) with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write charges (delete)" on public.tenancy_charges
  for delete to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));

drop policy "ledger admins write rent history" on public.tenancy_rent_history;
create policy "ledger admins write rent history (insert)" on public.tenancy_rent_history
  for insert to authenticated with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write rent history (update)" on public.tenancy_rent_history
  for update to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']))) with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write rent history (delete)" on public.tenancy_rent_history
  for delete to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));

drop policy "ledger admins write payer aliases" on public.tenant_payer_aliases;
create policy "ledger admins write payer aliases (insert)" on public.tenant_payer_aliases
  for insert to authenticated with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write payer aliases (update)" on public.tenant_payer_aliases
  for update to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']))) with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write payer aliases (delete)" on public.tenant_payer_aliases
  for delete to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));

drop policy "ledger admins write overage alerts" on public.utility_overage_alerts;
create policy "ledger admins write overage alerts (insert)" on public.utility_overage_alerts
  for insert to authenticated with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write overage alerts (update)" on public.utility_overage_alerts
  for update to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']))) with check ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
create policy "ledger admins write overage alerts (delete)" on public.utility_overage_alerts
  for delete to authenticated using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));

-- ---- 1: wrap remaining per-row auth checks (policies kept as-is) ----

alter policy "owners read access log" on public.credential_access_log using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
alter policy "owners read profitability_line_items" on public.profitability_line_items using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
alter policy "owners read telegram chat" on public.telegram_chat_messages using ((select lower(coalesce(auth.jwt() ->> 'email', '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])));
alter policy "financial operators read ignored_payers" on public.ignored_payers using ((select is_financial_operator()));
alter policy "financial operators read recon deposits" on public.reconciliation_deposits using ((select is_financial_operator()));
alter policy "financial operators read recon matches" on public.reconciliation_matches using ((select is_financial_operator()));
alter policy "financial operators read reconciliation_reversals" on public.reconciliation_reversals using ((select is_financial_operator()));
alter policy "financial operators read recon runs" on public.reconciliation_runs using ((select is_financial_operator()));

alter policy "financial operators delete payments" on public.payments
  using ((select is_financial_operator()));
alter policy "financial operators insert payments" on public.payments
  with check ((select is_financial_operator()) and (amount > (0)::numeric) and (paid_on <= current_date));
alter policy "financial operators update payments" on public.payments
  using ((select is_financial_operator()))
  with check ((select is_financial_operator()) and (amount > (0)::numeric) and (paid_on <= current_date));

-- ---- 3: covering indexes for unindexed foreign keys ----

create index if not exists agreement_requests_assigned_tenancy_id_idx on public.agreement_requests (assigned_tenancy_id);
create index if not exists agreement_requests_property_id_idx on public.agreement_requests (property_id);
create index if not exists board_comments_author_idx on public.board_comments (author);
create index if not exists credential_access_log_accessed_by_idx on public.credential_access_log (accessed_by);
create index if not exists reconciliation_deposits_payment_id_idx on public.reconciliation_deposits (payment_id);
create index if not exists reconciliation_matches_tenancy_id_idx on public.reconciliation_matches (tenancy_id);
create index if not exists reconciliation_matches_tenant_id_idx on public.reconciliation_matches (tenant_id);
create index if not exists reconciliation_reversals_refund_payment_id_idx on public.reconciliation_reversals (refund_payment_id);
create index if not exists reconciliation_reversals_suspect_payment_id_idx on public.reconciliation_reversals (suspect_payment_id);
create index if not exists rent_reminder_emails_tenant_id_idx on public.rent_reminder_emails (tenant_id);
create index if not exists room_change_events_room_id_idx on public.room_change_events (room_id);
create index if not exists utility_overage_alerts_bill_id_idx on public.utility_overage_alerts (bill_id);
create index if not exists utility_overage_alerts_tenancy_id_idx on public.utility_overage_alerts (tenancy_id);
create index if not exists utility_unit_hints_property_id_idx on public.utility_unit_hints (property_id);
