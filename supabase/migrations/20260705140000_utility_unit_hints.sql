-- Operator-confirmed statement→unit mappings. Written when a bill is
-- manually assigned to a unit; consulted before trusting the model's match
-- so the same account/address never lands unmatched (or mismatched) twice.
create table if not exists public.utility_unit_hints (
  key text primary key, -- normalized "acct:<digits>" or "addr:<alnum address>"
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.utility_unit_hints enable row level security;
create policy "authenticated read utility hints"
  on public.utility_unit_hints for select to authenticated using (true);
create policy "authenticated write utility hints"
  on public.utility_unit_hints for all to authenticated using (true) with check (true);

-- Due date isn't tracked on the utilities log.
alter table public.utility_bills drop column if exists due_date;
