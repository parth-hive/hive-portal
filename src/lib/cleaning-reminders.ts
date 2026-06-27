import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "@/lib/date";
import { CLEANING_CADENCE_DAYS } from "@/lib/cleaning";
import { one } from "@/lib/relations";
import { sendCleaningReminder, cleaningReminderText } from "@/lib/email";
import { gatherCleaningContext } from "@/lib/cleaning-context";
import { sendSms, toE164 } from "@/lib/sms";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Keep the 35-day cadence rolling. For every unit that has been scheduled at
 * least once (has any cleaning_records) but has no upcoming cleaning, create the
 * next one at the last date + 35, stepped forward to today or later. Units that
 * have never been scheduled are skipped — the operator sets the first date.
 */
export async function runCleaningSchedule(supabase: SupabaseClient) {
  const today = todayISO();
  type Rec = { property_id: string; cleaning_date: string };
  const { data, error } = await supabase
    .from("cleaning_records")
    .select("property_id, cleaning_date")
    .returns<Rec[]>();
  if (error) return { rolled: 0, error: error.message };

  const latest = new Map<string, string>();
  const hasUpcoming = new Set<string>();
  for (const r of data ?? []) {
    if (r.cleaning_date >= today) hasUpcoming.add(r.property_id);
    const cur = latest.get(r.property_id);
    if (!cur || r.cleaning_date > cur) latest.set(r.property_id, r.cleaning_date);
  }

  const inserts: { property_id: string; cleaning_date: string }[] = [];
  for (const [propertyId, last] of latest) {
    if (hasUpcoming.has(propertyId)) continue; // already has a next cleaning
    let next = addDaysISO(last, CLEANING_CADENCE_DAYS);
    while (next < today) next = addDaysISO(next, CLEANING_CADENCE_DAYS);
    inserts.push({ property_id: propertyId, cleaning_date: next });
  }

  if (inserts.length > 0) {
    await supabase.from("cleaning_records").insert(inserts);
  }
  return { rolled: inserts.length };
}

/**
 * Day-before cleaning reminders. For every unit with a cleaning tomorrow, email
 * AND text each assigned (enabled) cleaner the full payload: move-out flag +
 * room, every room's tenant contact, and the leaseholder.
 */
export async function runCleaningReminders(supabase: SupabaseClient) {
  const tomorrow = addDaysISO(todayISO(), 1);

  type CleaningRow = {
    property_id: string;
    kind: string | null;
    rooms: { room_number: string | null } | { room_number: string | null }[] | null;
  };
  const { data: due, error } = await supabase
    .from("cleaning_records")
    .select("property_id, kind, rooms(room_number)")
    .eq("cleaning_date", tomorrow)
    .returns<CleaningRow[]>();
  if (error) return { date: tomorrow, due: 0, emailed: 0, texted: 0, error: error.message };

  const rows = due ?? [];
  if (rows.length === 0) return { date: tomorrow, due: 0, emailed: 0, texted: 0 };

  // One reminder per property; a move-out row wins (so the cleaner is told).
  const byProperty = new Map<string, CleaningRow>();
  for (const r of rows) {
    const cur = byProperty.get(r.property_id);
    if (!cur || (cur.kind !== "move_out" && r.kind === "move_out")) {
      byProperty.set(r.property_id, r);
    }
  }

  type CleanerShape = {
    name: string | null;
    email: string | null;
    phone: string | null;
    enabled: boolean;
  };

  let emailed = 0;
  let texted = 0;
  for (const [propertyId, row] of byProperty) {
    const ctxBase = await gatherCleaningContext(supabase, propertyId);
    if (!ctxBase) continue;
    const isMoveOut = row.kind === "move_out";
    const ctx = {
      ...ctxBase,
      date: tomorrow,
      isMoveOut,
      roomLabel: isMoveOut ? one(row.rooms)?.room_number ?? null : null,
    };

    const { data: links } = await supabase
      .from("property_cleaners")
      .select("cleaners(name, email, phone, enabled)")
      .eq("property_id", propertyId);
    const cleaners = (
      (links ?? []) as { cleaners: CleanerShape | CleanerShape[] | null }[]
    )
      .map((l) => one(l.cleaners))
      .filter((c): c is CleanerShape => !!c && c.enabled !== false);

    for (const c of cleaners) {
      if (c.email) {
        const r = await sendCleaningReminder(c.email, ctx);
        if (r.ok) emailed++;
      }
      const phone = toE164(c.phone);
      if (phone) {
        const r = await sendSms(phone, cleaningReminderText(ctx), {
          type: "cleaning_reminder",
          context: ctx.unitLabel,
        });
        if (r.ok) texted++;
      }
    }
  }

  return { date: tomorrow, due: byProperty.size, emailed, texted };
}
