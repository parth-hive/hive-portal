-- Audit log for monthly rent-reminder emails. The unique constraint on
-- (tenancy_id, period_month) is the idempotency lock — if the cron retries
-- or someone hits the endpoint manually, we won't double-send for the
-- same calendar month.
create table rent_reminder_emails (
  id            uuid primary key default gen_random_uuid(),
  tenancy_id    uuid not null references tenancies(id) on delete cascade,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  period_month  text not null,                  -- "YYYY-MM"
  email_to      text not null,
  sent_at       timestamptz,                    -- null on failure
  resend_id     text,
  error_text    text,
  created_at    timestamptz not null default now(),
  unique (tenancy_id, period_month)
);

create index rent_reminder_emails_period_idx
  on rent_reminder_emails (period_month);

alter table rent_reminder_emails enable row level security;
create policy "authenticated read rent_reminder_emails"
  on rent_reminder_emails for select to authenticated using (true);
-- writes only happen from the cron handler (service-role); no insert/update
-- policy for authenticated clients.
