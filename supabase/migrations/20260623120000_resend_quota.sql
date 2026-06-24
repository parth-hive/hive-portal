-- Resend free-tier guard.
--
-- Every Resend send funnels through sendViaResend() (src/lib/resend-quota.ts):
-- while under the daily + monthly caps it sends immediately; once a cap is hit
-- the email is parked in email_queue and the daily cron drains the backlog over
-- the following days. Gmail sends are a separate channel and don't count.

-- Distinguish Resend sends from Gmail sends so usage can be metered accurately.
-- Existing rows default to 'resend'; Gmail send paths now tag 'gmail'.
alter table email_log
  add column channel text not null default 'resend'
  check (channel in ('resend', 'gmail'));

create index email_log_channel_idx on email_log (channel, status, created_at desc);

-- Deferred Resend emails. We store the fully-rendered payload so the daily
-- flush just replays it — no need to re-derive recipients or re-render bodies.
create table email_queue (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,            -- EmailType, copied onto email_log when sent
  to_addrs    text[] not null,          -- one or more recipients
  from_addr   text not null,
  reply_to    text,
  subject     text not null,
  text_body   text,
  html_body   text,
  context     text,
  status      text not null default 'pending'
              check (status in ('pending', 'sent', 'failed', 'canceled')),
  attempts    int not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

alter table email_queue enable row level security;

-- Read-only to authenticated users (so a future queue view can list it); all
-- writes happen via the service role, which bypasses RLS.
create policy "authenticated read email_queue"
  on email_queue for select to authenticated using (true);

-- Oldest-pending-first drain order.
create index email_queue_pending_idx
  on email_queue (created_at)
  where status = 'pending';
