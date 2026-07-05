-- Projects board (ported from the standalone hiveboard app): tasks with a
-- member review workflow, comments, and per-user notification prefs.
-- Assignees are portal auth users; *_label columns carry display-name
-- snapshots for legacy rows whose hiveboard user had no portal account.
-- (Applied live as two steps: board_tasks + board_tasks_fields.)
create table if not exists public.board_tasks (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  title text not null,
  description text,
  status text not null default 'not started'
    check (status in ('not started', 'in progress', 'pending_review', 'completed')),
  urgent boolean not null default false,
  needs_attention boolean not null default false,
  recurring boolean not null default false,
  recurring_day int check (recurring_day between 1 and 31),
  deadline date,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_label text,
  -- Recurring bookkeeping: the "YYYY-MM" cycle last completed, and cycles
  -- that expired uncompleted (write-only audit trail, kept for reporting).
  last_completed_month text,
  missed_months text[] not null default '{}',
  -- Admin nudges sent (pruned to the current day on write; 2/day limit).
  nudge_history timestamptz[] not null default '{}',
  -- Drives the member-facing "New" badge until they open the task.
  seen_by_assignee boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.board_tasks(id) on delete cascade,
  author uuid references auth.users(id) on delete set null,
  author_label text,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.board_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_notifications boolean not null default true
);

create index if not exists board_comments_task_idx on public.board_comments (task_id);
create index if not exists board_tasks_assigned_idx on public.board_tasks (assigned_to);

alter table public.board_tasks enable row level security;
alter table public.board_comments enable row level security;
alter table public.board_prefs enable row level security;

-- Same trust model as the rest of the portal: any authenticated operator can
-- read/write; admin-only actions are enforced in server actions via isMaster.
create policy "authenticated read board tasks"
  on public.board_tasks for select to authenticated using (true);
create policy "authenticated write board tasks"
  on public.board_tasks for all to authenticated using (true) with check (true);

create policy "authenticated read board comments"
  on public.board_comments for select to authenticated using (true);
create policy "authenticated write board comments"
  on public.board_comments for all to authenticated using (true) with check (true);

create policy "authenticated read board prefs"
  on public.board_prefs for select to authenticated using (true);
create policy "authenticated write board prefs"
  on public.board_prefs for all to authenticated using (true) with check (true);
