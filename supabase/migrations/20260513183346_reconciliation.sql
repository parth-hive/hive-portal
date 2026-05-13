-- =====================================================================
-- Rent reconciliation
-- =====================================================================
-- Each run: a month + the uploaded bank statement + other-payments file.
-- Each match: one tenant × one run, with expected vs actual rent.
-- Payments created from matches reference their run so re-runs can replace
-- the prior result cleanly.

-- The name a tenant appears as on bank deposits (e.g. "JANE DOE" on Zelle).
-- Used as the join key during reconciliation. Defaults to full_name on first
-- run if left blank.
alter table tenants
  add column pays_as text;

-- One reconciliation run.
create table reconciliation_runs (
  id                          uuid primary key default gen_random_uuid(),
  month                       date not null,                   -- e.g. 2026-04-01 means April 2026
  bank_statement_path         text,
  other_payments_path         text,
  total_expected              numeric(12,2) default 0,
  total_actual                numeric(12,2) default 0,
  match_count                 integer default 0,
  mismatch_count              integer default 0,
  missing_count               integer default 0,
  unmatched_deposits          jsonb,                           -- bank rows that didn't match a tenant
  notes                       text,
  created_at                  timestamptz not null default now()
);

create index reconciliation_runs_month_idx
  on reconciliation_runs (month desc);

-- One row per active tenant in a run.
create table reconciliation_matches (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references reconciliation_runs(id) on delete cascade,
  tenancy_id      uuid references tenancies(id) on delete set null,
  tenant_id       uuid references tenants(id) on delete set null,
  tenant_name     text,
  pays_as         text,
  property_label  text,
  room_label      text,
  expected_rent   numeric(12,2),
  actual_amount   numeric(12,2),
  difference      numeric(12,2),
  status          text check (status in ('match', 'mismatch', 'missing')),
  created_at      timestamptz not null default now()
);

create index reconciliation_matches_run_idx
  on reconciliation_matches (run_id);

-- Link payment records back to the run that created them, so re-running
-- reconciliation can replace prior payments cleanly.
alter table payments
  add column reconciliation_run_id uuid references reconciliation_runs(id)
    on delete set null;

create index payments_reconciliation_run_idx
  on payments (reconciliation_run_id);

-- RLS
alter table reconciliation_runs    enable row level security;
alter table reconciliation_matches enable row level security;

create policy "authenticated read recon runs"
  on reconciliation_runs for select to authenticated using (true);
create policy "authenticated write recon runs"
  on reconciliation_runs for all to authenticated using (true) with check (true);

create policy "authenticated read recon matches"
  on reconciliation_matches for select to authenticated using (true);
create policy "authenticated write recon matches"
  on reconciliation_matches for all to authenticated using (true) with check (true);

-- Storage bucket for the uploaded source files (audit trail).
insert into storage.buckets (id, name, public, file_size_limit)
values ('reconciliation', 'reconciliation', false, 20971520) -- 20 MB
on conflict (id) do nothing;

drop policy if exists "authenticated read reconciliation" on storage.objects;
create policy "authenticated read reconciliation"
  on storage.objects for select to authenticated
  using (bucket_id = 'reconciliation');

drop policy if exists "authenticated write reconciliation" on storage.objects;
create policy "authenticated write reconciliation"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'reconciliation');

drop policy if exists "authenticated delete reconciliation" on storage.objects;
create policy "authenticated delete reconciliation"
  on storage.objects for delete to authenticated
  using (bucket_id = 'reconciliation');
