-- Agreement email hardening.
--
-- 1. email_log gains the 'outlook' channel: agreement sends from the M365 work
--    account are now audited in email_log alongside Resend and Gmail sends.
alter table public.email_log drop constraint if exists email_log_channel_check;
alter table public.email_log add constraint email_log_channel_check
  check (channel = any (array['resend'::text, 'gmail'::text, 'outlook'::text]));

-- 2. Dedup ledger for Telegram webhook deliveries. Telegram re-delivers an
--    update until it receives a 200, so a bot turn that overruns the function
--    budget gets processed twice — which would re-run the whole agent turn and
--    could, e.g., email a tenant their agreement twice. The webhook claims the
--    update_id here before doing any work and drops duplicate deliveries on
--    the primary-key conflict.
create table if not exists public.telegram_updates (
  update_id bigint primary key,
  chat_id bigint,
  received_at timestamptz not null default now()
);

-- Service-role access only (no policies): the webhook runs with the service
-- key; nothing else needs to read this table.
alter table public.telegram_updates enable row level security;
