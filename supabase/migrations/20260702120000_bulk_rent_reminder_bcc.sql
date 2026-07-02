-- General rent reminders now go out as a single bulk BCC email per channel
-- (Resend for non-NY, Gmail for NY) instead of one email per tenant. Two schema
-- additions support that:
--
--   1. rent_reminder_emails.sms_sent_at — the per-(tenancy, period) row is no
--      longer 1:1 with an email send, so SMS needs its own idempotency marker to
--      stay resumable across the cron's continuation invocations.
--   2. email_queue.bcc_addrs — if a bulk blast is ever deferred over the Resend
--      cap, the BCC recipient list must survive queuing (the to_addr would only
--      be the from-address otherwise).

alter table rent_reminder_emails
  add column if not exists sms_sent_at timestamptz;

alter table email_queue
  add column if not exists bcc_addrs text[];
