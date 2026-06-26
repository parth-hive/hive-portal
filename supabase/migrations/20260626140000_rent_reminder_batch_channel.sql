-- Track which channel a balance-reminder batch went out on, so the Rent Tracker
-- can show "last sent" separately for emails vs texts.
--
-- 'email' | 'sms' | 'both'. Existing balance batches pre-date SMS, so they were
-- email-only — the default backfills them as 'email'.

alter table rent_reminder_batches
  add column channel text not null default 'email'
  check (channel in ('email', 'sms', 'both'));
