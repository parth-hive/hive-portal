/**
 * One-shot migration: copy the standalone hiveboard app's data (old Supabase
 * project) into the portal's board_* tables, remapping assignees/authors to
 * portal auth users by email. Old users without a portal account keep their
 * display name in assigned_label/author_label so history stays readable.
 *
 * Usage:
 *   OLD_SUPABASE_URL=… OLD_SUPABASE_KEY=… npx tsx --env-file=.env.local \
 *     scripts/migrate-hiveboard.ts
 *
 * Refuses to run if board_tasks already has rows (set FORCE=1 to override,
 * which appends — it does not wipe). Prints only counts, never emails/names.
 */

import { createClient } from "@supabase/supabase-js";

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_KEY;
const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error("Missing OLD_SUPABASE_URL/OLD_SUPABASE_KEY or portal env.");
  process.exit(1);
}

type OldUser = {
  id: string;
  name: string | null;
  role: string;
  email: string | null;
  email_notifications: boolean | null;
};

async function main() {
  const oldDb = createClient(OLD_URL!, OLD_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const newDb = createClient(NEW_URL!, NEW_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count } = await newDb
    .from("board_tasks")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0 && !process.env.FORCE) {
    console.error(
      `board_tasks already has ${count} rows — set FORCE=1 to append anyway.`,
    );
    process.exit(1);
  }

  const [{ data: users }, { data: tasks }, { data: comments }, portal] =
    await Promise.all([
      oldDb.from("users").select("id, name, role, email, email_notifications"),
      oldDb.from("tasks").select("*").order("id"),
      oldDb.from("comments").select("*").order("id"),
      newDb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
  if (portal.error) throw new Error(portal.error.message);

  const portalByEmail = new Map(
    portal.data.users
      .filter((u) => u.email)
      .map((u) => [u.email!.trim().toLowerCase(), u.id]),
  );
  const oldUsers = (users ?? []) as OldUser[];
  const oldUserById = new Map(oldUsers.map((u) => [u.id, u]));

  const mapUser = (
    oldId: string | null,
  ): { id: string | null; label: string | null } => {
    if (!oldId) return { id: null, label: null };
    const u = oldUserById.get(oldId);
    const pid = u?.email
      ? portalByEmail.get(u.email.trim().toLowerCase())
      : undefined;
    return pid
      ? { id: pid, label: null }
      : { id: null, label: u?.name || oldId };
  };

  const unmappedOldIds = new Set<string>();
  const taskIdMap = new Map<number | string, string>();
  let insertedTasks = 0;

  for (const t of tasks ?? []) {
    const who = mapUser(t.assigned_to);
    if (!who.id && t.assigned_to) unmappedOldIds.add(t.assigned_to);
    const { data: ins, error } = await newDb
      .from("board_tasks")
      .insert({
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        urgent: !!t.urgent,
        needs_attention: !!t.needs_attention,
        recurring: !!t.recurring,
        recurring_day: t.recurring_day ?? null,
        deadline: t.deadline ?? null,
        assigned_to: who.id,
        assigned_label: who.label,
        last_completed_month: t.last_completed_month ?? null,
        missed_months: t.missed_months ?? [],
        nudge_history: t.nudge_history ?? [],
        // Legacy tasks shouldn't all light up as "New" after the move.
        seen_by_assignee: t.seen_by_assignee ?? true,
        created_at: t.created_at,
        updated_at: t.created_at,
      })
      .select("id")
      .single();
    if (error) throw new Error(`task #${t.id}: ${error.message}`);
    taskIdMap.set(t.id, ins.id);
    insertedTasks++;
  }

  let insertedComments = 0;
  let skippedComments = 0;
  for (const c of comments ?? []) {
    const newTaskId = taskIdMap.get(c.task_id);
    if (!newTaskId) {
      skippedComments++;
      continue;
    }
    const who = mapUser(c.author);
    const { error } = await newDb.from("board_comments").insert({
      task_id: newTaskId,
      author: who.id,
      author_label: who.label,
      text: c.text,
      created_at: c.created_at,
    });
    if (error) throw new Error(`comment ${c.id}: ${error.message}`);
    insertedComments++;
  }

  let prefsUpserted = 0;
  for (const u of oldUsers) {
    const pid = u.email
      ? portalByEmail.get(u.email.trim().toLowerCase())
      : undefined;
    if (!pid) continue;
    const { error } = await newDb.from("board_prefs").upsert(
      { user_id: pid, email_notifications: u.email_notifications !== false },
      { onConflict: "user_id" },
    );
    if (!error) prefsUpserted++;
  }

  console.log(
    JSON.stringify(
      {
        old_users: oldUsers.length,
        portal_users: portal.data.users.length,
        tasks_migrated: insertedTasks,
        comments_migrated: insertedComments,
        comments_skipped: skippedComments,
        prefs_upserted: prefsUpserted,
        old_user_ids_without_portal_account: [...unmappedOldIds],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
