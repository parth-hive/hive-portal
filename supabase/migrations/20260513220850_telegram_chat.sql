-- Per-Telegram-chat conversation history for the ops bot.
-- One row per turn. Auto-expires anything older than 7 days so the table
-- stays small and the prompt context doesn't drag in stale state.

create table telegram_chat_messages (
  id          bigserial primary key,
  chat_id     bigint not null,
  role        text not null check (role in ('user', 'assistant')),
  content     jsonb not null,           -- array of Anthropic content blocks
  created_at  timestamptz not null default now()
);

create index telegram_chat_messages_chat_idx
  on telegram_chat_messages (chat_id, created_at);

-- RLS: only authenticated users (no anonymous access). The bot uses the
-- service-role key so RLS is bypassed for it.
alter table telegram_chat_messages enable row level security;
create policy "authenticated read telegram chat"
  on telegram_chat_messages for select to authenticated using (true);
create policy "authenticated write telegram chat"
  on telegram_chat_messages for all to authenticated using (true) with check (true);
