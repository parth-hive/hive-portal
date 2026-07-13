/**
 * Daily ops cron (path name is historical — it used to also send 24h
 * room-change follow-up emails, since retired; room changes now get only the
 * immediate notification from updateRoomsWithNotification):
 *   1. drain the deferred Resend email queue (FIFO, backlog first),
 *   2. send due 45-day lease-ending heads-ups,
 *   3. roll the 35-day cleaning cadence forward,
 *   4. roll board recurring cycles + email deadline reminders.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runLeaseReminders } from "@/lib/lease-reminders";
import { runCleaningSchedule } from "@/lib/cleaning-reminders";
import { flushEmailQueue } from "@/lib/resend-quota";
import { processBoardDeadlines } from "@/lib/board";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = admin();

  // Drain any Resend emails deferred on earlier days FIRST, so backlog gets
  // first claim on today's free-tier budget (FIFO). Today's own sends below run
  // through the same chokepoint and re-queue if they then exceed the cap.
  const flush = await flushEmailQueue(supabase);

  // Send any due 45-day lease-ending heads-ups.
  const lease = await runLeaseReminders(supabase);

  // Roll the 35-day cadence forward (create the next cleaning for any unit whose
  // upcoming date has passed). Cleaners are notified only on move-out and manual
  // schedule changes (debounced via /api/cron/cleaner-changes) — no weekly digest.
  const cleaningSchedule = await runCleaningSchedule(supabase);

  // Projects board: roll expired recurring cycles and email tomorrow/overdue
  // deadline reminders. Runs once daily by design (overdue reminders repeat
  // each day until resolved — no dedup needed).
  const board = await processBoardDeadlines(supabase).catch((e) => ({
    error: e instanceof Error ? e.message : "board failed",
  }));

  return NextResponse.json({ lease, cleaningSchedule, flush, board });
}
