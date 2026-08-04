-- audit_log's read policy was missed by 20260803131406's init-plan pass:
-- the STABLE is_financial_operator() was re-evaluated per row (110k rows,
-- ~1.3s per full scan). Wrap it in a scalar subquery so it runs once.
alter policy "financial operators read audit log" on public.audit_log
  using ((select is_financial_operator()));

-- The audit-log screen filters by table_name and orders by created_at desc;
-- this composite serves that in one index pass. It subsumes the single-column
-- table_name index, which is dropped to keep insert overhead flat.
create index audit_log_table_name_created_at_idx
  on public.audit_log (table_name, created_at desc);

drop index if exists public.audit_log_table_name_idx;
