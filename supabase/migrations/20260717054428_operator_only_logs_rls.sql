-- Operator-only logs & notification settings.
--
-- The portal now gates the email log, text log, and notification settings to
-- the two operators (see isOperator in src/lib/access.ts); this enforces the
-- same boundary in the database via the shared is_financial_operator()
-- predicate (audit_log reads are already restricted by it).
--
-- Writes to email_log / sms_log / email_queue are service-role only (email &
-- SMS logging, the queue drain cron, and the master-only clear actions all use
-- the service key, which bypasses RLS), so only the SELECT policies change.

-- email_log: reads → operators only.
drop policy if exists "authenticated read email_log" on public.email_log;
create policy "operators read email_log"
  on public.email_log
  for select to authenticated
  using (public.is_financial_operator());

-- sms_log: reads → operators only.
drop policy if exists "authenticated read sms_log" on public.sms_log;
create policy "operators read sms_log"
  on public.sms_log
  for select to authenticated
  using (public.is_financial_operator());

-- email_queue: only surfaced as the backlog count on the (operator-gated)
-- email-log page — reads → operators only.
drop policy if exists "authenticated read email_queue" on public.email_queue;
create policy "operators read email_queue"
  on public.email_queue
  for select to authenticated
  using (public.is_financial_operator());

-- notification_recipients: writes → operators only (the settings page's server
-- actions run under the user's session). Reads must stay open to every
-- authenticated user — the inventory page joins recipients to build the
-- ads-posted-by tally for all portal users.
drop policy if exists "authenticated write notification_recipients" on public.notification_recipients;
create policy "operators write notification_recipients"
  on public.notification_recipients
  for all to authenticated
  using (public.is_financial_operator())
  with check (public.is_financial_operator());
