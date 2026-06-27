-- Unified log of every outbound SMS the portal sends (Zoom Phone), so Admin
-- Settings can show a filterable history mirroring the email log.
--   type      — what the text was for (rent_reminder, rent_balance,
--               cleaning_reminder, manual).
--   context   — free-form tag (the unit, the rent period, the tenant, etc.).
-- Rows are written by the logSms() helper using the service role, so no write
-- policy is needed; authenticated users may read.
create table sms_log (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  recipient   text not null,
  body        text,
  status      text not null check (status in ('sent', 'failed')),
  error       text,
  context     text,
  channel     text not null default 'zoom',
  created_at  timestamptz not null default now()
);

alter table sms_log enable row level security;
create policy "authenticated read sms_log"
  on sms_log for select to authenticated using (true);

create index sms_log_created_at_idx on sms_log (created_at desc);
create index sms_log_type_idx on sms_log (type, created_at desc);
