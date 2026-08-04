-- Conform the owner-email RLS checks to the linter-recognized
-- (select auth.jwt()) init-plan form. Same access rules, same
-- once-per-query evaluation; clears the auth_rls_initplan warnings
-- left by the previous migration's whole-expression wrap.

alter policy "owners write credentials (insert)" on public.credentials with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "owners write credentials (update)" on public.credentials using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])) with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "owners write credentials (delete)" on public.credentials using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));

alter policy "ledger admins write allocations (insert)" on public.credit_allocations with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write allocations (update)" on public.credit_allocations using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])) with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write allocations (delete)" on public.credit_allocations using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));

alter policy "owners write profitability_line_items (insert)" on public.profitability_line_items with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "owners write profitability_line_items (update)" on public.profitability_line_items using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])) with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "owners write profitability_line_items (delete)" on public.profitability_line_items using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));

alter policy "ledger admins write charges (insert)" on public.tenancy_charges with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write charges (update)" on public.tenancy_charges using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])) with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write charges (delete)" on public.tenancy_charges using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));

alter policy "ledger admins write rent history (insert)" on public.tenancy_rent_history with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write rent history (update)" on public.tenancy_rent_history using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])) with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write rent history (delete)" on public.tenancy_rent_history using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));

alter policy "ledger admins write payer aliases (insert)" on public.tenant_payer_aliases with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write payer aliases (update)" on public.tenant_payer_aliases using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])) with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write payer aliases (delete)" on public.tenant_payer_aliases using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));

alter policy "ledger admins write overage alerts (insert)" on public.utility_overage_alerts with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write overage alerts (update)" on public.utility_overage_alerts using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com'])) with check (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "ledger admins write overage alerts (delete)" on public.utility_overage_alerts using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));

alter policy "owners read access log" on public.credential_access_log using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "owners read profitability_line_items" on public.profitability_line_items using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
alter policy "owners read telegram chat" on public.telegram_chat_messages using (lower(coalesce(((select auth.jwt()) ->> 'email'), '')) = any (array['vdutta1485@gmail.com', 'parthrudakia@gmail.com']));
