-- =====================================================================
-- Row Level Security: single-user app.
-- Policy: only authenticated users can read or write any row.
-- (When more users are added later, swap these for per-user/role checks.)
-- =====================================================================

alter table leaseholders            enable row level security;
alter table properties              enable row level security;
alter table rooms                   enable row level security;
alter table tenants                 enable row level security;
alter table tenancies               enable row level security;
alter table payments                enable row level security;
alter table cleaning_records        enable row level security;
alter table marketing_channels      enable row level security;
alter table posting_log             enable row level security;
alter table credentials             enable row level security;
alter table credential_access_log   enable row level security;

-- leaseholders
create policy "authenticated read leaseholders" on leaseholders for select to authenticated using (true);
create policy "authenticated write leaseholders" on leaseholders for all to authenticated using (true) with check (true);

-- properties
create policy "authenticated read properties" on properties for select to authenticated using (true);
create policy "authenticated write properties" on properties for all to authenticated using (true) with check (true);

-- rooms
create policy "authenticated read rooms" on rooms for select to authenticated using (true);
create policy "authenticated write rooms" on rooms for all to authenticated using (true) with check (true);

-- tenants
create policy "authenticated read tenants" on tenants for select to authenticated using (true);
create policy "authenticated write tenants" on tenants for all to authenticated using (true) with check (true);

-- tenancies
create policy "authenticated read tenancies" on tenancies for select to authenticated using (true);
create policy "authenticated write tenancies" on tenancies for all to authenticated using (true) with check (true);

-- payments
create policy "authenticated read payments" on payments for select to authenticated using (true);
create policy "authenticated write payments" on payments for all to authenticated using (true) with check (true);

-- cleaning_records
create policy "authenticated read cleaning" on cleaning_records for select to authenticated using (true);
create policy "authenticated write cleaning" on cleaning_records for all to authenticated using (true) with check (true);

-- marketing_channels
create policy "authenticated read channels" on marketing_channels for select to authenticated using (true);
create policy "authenticated write channels" on marketing_channels for all to authenticated using (true) with check (true);

-- posting_log
create policy "authenticated read posts" on posting_log for select to authenticated using (true);
create policy "authenticated write posts" on posting_log for all to authenticated using (true) with check (true);

-- credentials
create policy "authenticated read credentials" on credentials for select to authenticated using (true);
create policy "authenticated write credentials" on credentials for all to authenticated using (true) with check (true);

-- credential_access_log
create policy "authenticated read access log" on credential_access_log for select to authenticated using (true);
create policy "authenticated insert access log" on credential_access_log for insert to authenticated with check (true);
