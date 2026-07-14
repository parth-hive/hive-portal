-- Payers whose bank deposits are NOT rent (personal transfers, other
-- ventures). Ignored payer keys are excluded from every run's unmatched
-- list — the counterpart of tenant_payer_aliases, which attributes a payer
-- to a tenant. Keyed by the same normalized payer key the matcher uses.
create table if not exists public.ignored_payers (
  payer_key text primary key,
  display_name text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.ignored_payers enable row level security;
create policy "authenticated read ignored_payers"
  on public.ignored_payers for select to authenticated using (true);
create policy "authenticated write ignored_payers"
  on public.ignored_payers for all to authenticated
  using (true) with check (true);
