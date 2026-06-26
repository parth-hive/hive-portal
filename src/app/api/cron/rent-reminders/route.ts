/**
 * Monthly rent-reminder cron — fires on the LAST DAY of each month at 11:00 AM
 * Eastern. We email AND text every active tenant a generic reminder.
 *
 * Vercel cron schedules are UTC and can't express "last day of month" or follow
 * DST, so the route is scheduled daily at both 15:00 and 16:00 UTC (the two UTC
 * times that map to 11 AM ET across EDT/EST) and this handler gates on the
 * actual Eastern wall-clock: it only sends when it's 11 AM ET on the month's
 * last day. The rent_reminder_emails unique (tenancy_id, period_month)
 * constraint still guards against any double-send. Pass ?force=1 to bypass the
 * date/time gate for manual testing.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendRentReminder,
  sendRentReminderGmail,
  REMINDER_TEXT,
} from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function todayMonth(): string {
  return todayISO().slice(0, 7);
}

// Current Eastern-time parts (DST-aware via the IANA zone), used to gate the
// send to 11 AM ET on the last day of the month.
function easternParts(): { year: number; month: number; day: number; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  // hour12:false renders midnight as "24"; normalize to 0.
  const hour = Number(parts.hour) % 24;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
  };
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // Gate: only send at 11 AM ET on the last day of the month (?force=1 skips
  // the gate for manual testing).
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force) {
    const { year, month, day, hour } = easternParts();
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (hour !== 11 || day !== lastDay) {
      return NextResponse.json({
        skipped: true,
        reason: "only runs at 11 AM ET on the last day of the month",
      });
    }
  }

  const supabase = admin();
  const period = todayMonth();
  const today = todayISO();

  // Active tenancies whose tenant has an email and whose move_out_date (if set)
  // is after today.
  const { data: tenancies, error } = await supabase
    .from("tenancies")
    .select(
      `id, tenant_id, move_out_date, status,
       tenants!inner(id, email, phone),
       rooms!inner(properties!inner(is_new_york))`,
    )
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type PropertyRel = { is_new_york: boolean };
  type RoomRel = { properties: PropertyRel | PropertyRel[] | null };
  type Row = {
    id: string;
    tenant_id: string;
    move_out_date: string | null;
    tenants:
      | { id: string; email: string | null; phone: string | null }
      | { id: string; email: string | null; phone: string | null }[]
      | null;
    rooms: RoomRel | RoomRel[] | null;
  };

  const isNewYork = (row: Row): boolean => {
    const room = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms;
    const property = Array.isArray(room?.properties)
      ? room?.properties[0]
      : room?.properties;
    return property?.is_new_york ?? false;
  };

  const rows = (tenancies ?? []) as Row[];
  let sent = 0;
  let queued = 0;
  let skipped = 0;
  let failed = 0;
  let texted = 0;
  const errors: Array<{ tenancy_id: string; error: string }> = [];

  for (const row of rows) {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    const email = tenant?.email?.trim();
    if (!email) {
      skipped++;
      continue;
    }
    if (row.move_out_date && row.move_out_date <= today) {
      skipped++;
      continue;
    }

    // Reserve the slot first — relies on the unique (tenancy_id, period_month)
    // constraint to prevent double-sends from concurrent runs.
    const { error: lockErr } = await supabase
      .from("rent_reminder_emails")
      .insert({
        tenancy_id: row.id,
        tenant_id: row.tenant_id,
        period_month: period,
        email_to: email,
      });
    if (lockErr) {
      // 23505 = unique_violation → already sent this month, skip silently.
      if ((lockErr as { code?: string }).code === "23505") {
        skipped++;
        continue;
      }
      failed++;
      errors.push({ tenancy_id: row.id, error: lockErr.message });
      continue;
    }

    // New York tenants get a plain, unbranded reminder from Vineet's personal
    // Gmail; everyone else goes through the default Resend sender.
    const result = isNewYork(row)
      ? await sendRentReminderGmail(email)
      : await sendRentReminder(email);

    // A deferred (queued) send has no resend_id yet and will go out via the
    // daily queue flush; leave sent_at null so it reads as still-pending.
    const delivered = result.ok && !("queued" in result) ? result : null;
    await supabase
      .from("rent_reminder_emails")
      .update({
        sent_at: delivered ? new Date().toISOString() : null,
        resend_id: delivered ? delivered.id : null,
        error_text: result.ok ? null : result.error,
      })
      .eq("tenancy_id", row.id)
      .eq("period_month", period);

    if (result.ok) {
      if ("queued" in result) queued++;
      else sent++;
    } else {
      failed++;
      errors.push({ tenancy_id: row.id, error: result.error });
    }

    // Also text the tenant the same reminder when a phone is on file and SMS is
    // configured. SMS isn't gated by the email idempotency lock, but the lock
    // above already prevents the whole row from being processed twice a month.
    const phone = tenant?.phone?.trim();
    if (phone) {
      const smsRes = await sendSms(phone, REMINDER_TEXT);
      if (smsRes.ok) texted++;
    }
  }

  return NextResponse.json({
    period,
    total: rows.length,
    sent,
    queued,
    skipped,
    failed,
    texted,
    errors,
  });
}
