/**
 * Lease-ending reminder logic, factored out of a standalone cron so it can be
 * piggy-backed onto the existing daily notification-followups cron (keeping the
 * total cron count within the Vercel Hobby limit).
 *
 * For every active tenancy whose informational `lease_end_date` falls within
 * the next 45 days and hasn't been flagged yet, email the operator a heads-up.
 * `lease_end_reminded_at` is set so it fires once; it's reset to null whenever
 * lease_end_date changes (see setTenancyLeaseEndDate), re-arming the reminder.
 *
 * Purely a notification — it never touches tenancy/room/move-out state.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendLeaseEndReminder } from "@/lib/email";
import { todayISO } from "@/lib/date";
import { one } from "@/lib/relations";

const LEASE_REMINDER_DAYS = 45;
const REMINDER_TO = process.env.LEASE_REMINDER_TO || "vdutta1485@gmail.com";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00").getTime();
  const b = new Date(toIso + "T00:00:00").getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export type LeaseReminderSummary = {
  candidates: number;
  sent: number;
  failed: number;
  errors: Array<{ tenancy_id: string; error: string }>;
};

export async function runLeaseReminders(
  supabase: SupabaseClient,
): Promise<LeaseReminderSummary> {
  const today = todayISO();
  const windowEnd = addDaysISO(today, LEASE_REMINDER_DAYS);

  // Active tenancies entering the 45-day window that haven't been flagged yet.
  const { data: rows } = await supabase
    .from("tenancies")
    .select(
      `id, lease_end_date,
       tenants(full_name),
       rooms(room_number, properties(building_name, street_address, unit_number))`,
    )
    .eq("status", "active")
    .is("lease_end_reminded_at", null)
    .not("lease_end_date", "is", null)
    .gte("lease_end_date", today)
    .lte("lease_end_date", windowEnd);

  type Row = {
    id: string;
    lease_end_date: string;
    tenants: { full_name: string } | { full_name: string }[] | null;
    rooms:
      | {
          room_number: string | null;
          properties:
            | { building_name: string | null; street_address: string; unit_number: string }
            | { building_name: string | null; street_address: string; unit_number: string }[]
            | null;
        }
      | {
          room_number: string | null;
          properties: unknown;
        }[]
      | null;
  };

  const list = (rows ?? []) as Row[];
  const summary: LeaseReminderSummary = {
    candidates: list.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const row of list) {
    // Reserve the slot first so a re-run can't double-send: only proceed if we
    // flipped reminded_at from null to now().
    const stamp = new Date().toISOString();
    const { data: reserved } = await supabase
      .from("tenancies")
      .update({ lease_end_reminded_at: stamp })
      .eq("id", row.id)
      .is("lease_end_reminded_at", null)
      .select("id");
    if (!reserved || reserved.length === 0) continue;

    const tenantName = one(row.tenants)?.full_name ?? "A tenant";
    const room = one(row.rooms) as {
      room_number: string | null;
      properties:
        | { building_name: string | null; street_address: string; unit_number: string }
        | { building_name: string | null; street_address: string; unit_number: string }[]
        | null;
    } | null;
    const property = one(room?.properties ?? null);
    const unitLabel = property
      ? `${property.building_name?.trim() || property.street_address} Apt ${property.unit_number}${
          room?.room_number ? ` · ${room.room_number}` : ""
        }`
      : "their unit";
    const daysUntil = diffDays(today, row.lease_end_date);

    const result = await sendLeaseEndReminder(REMINDER_TO, {
      tenantName,
      unitLabel,
      endDate: row.lease_end_date,
      daysUntil,
    });

    if (result.ok) {
      summary.sent++;
    } else {
      // Roll back the reservation so it retries on the next run.
      await supabase
        .from("tenancies")
        .update({ lease_end_reminded_at: null })
        .eq("id", row.id);
      summary.failed++;
      summary.errors.push({ tenancy_id: row.id, error: result.error });
    }
  }

  return summary;
}
