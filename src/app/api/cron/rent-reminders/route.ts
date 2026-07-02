/**
 * Monthly rent-reminder cron — fires on the LAST DAY of each month at 11:00 AM
 * Eastern. Every active tenant (no move-out scheduled) gets a generic reminder.
 *
 * Email goes out as TWO bulk BCC blasts, not one email per tenant: one Resend
 * email for non-NY tenants, one unbranded Gmail for NY, everyone in BCC so they
 * can't see each other. SMS can't be BCC'd, so texts stay one-per-tenant and
 * time-budgeted (see the SMS phase). The rent_reminder_emails unique
 * (tenancy_id, period_month) row is the idempotency record for both channels
 * (sms_sent_at tracks the text separately).
 *
 * Vercel cron schedules are UTC and can't express "last day of month" or follow
 * DST, so the route is scheduled daily at both 15:00 and 16:00 UTC (the two UTC
 * times that map to 11 AM ET across EDT/EST) and this handler gates on the
 * actual Eastern wall-clock: it only sends when it's 11 AM ET on the month's
 * last day. Pass ?force=1 to bypass the date/time gate for manual testing.
 */

import { NextResponse, type NextRequest, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendRentReminderBulk,
  sendRentReminderGmailBulk,
  REMINDER_TEXT,
  type BulkSendResult,
} from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sending is strictly serial (~2s/tenant across the lock write, Resend/Gmail
// call, row update and Zoom SMS), so a full roster can't finish inside one
// 60s Vercel invocation. We process for at most this long, then hand the rest
// to a fresh invocation (see below). Kept well under maxDuration so we always
// stop *between* tenants and never get hard-killed mid-send, which would leave
// a reserved-but-unsent lock row behind.
const BUDGET_MS = 45_000;
// Safety backstop against a runaway continuation chain; the work terminates on
// its own once every eligible tenancy has a row for the period.
const MAX_CONTINUATIONS = 25;

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
  // the gate for manual testing and for our own continuation calls).
  const force = req.nextUrl.searchParams.get("force") === "1";
  const contCount = Number(req.nextUrl.searchParams.get("cont") ?? "0") || 0;
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
  // period defaults to the current month; a manual ?period=YYYY-MM override is
  // honoured only under ?force=1 (e.g. to backfill a run that timed out). It is
  // just the idempotency key on rent_reminder_emails — the copy itself is
  // month-agnostic.
  const periodParam = req.nextUrl.searchParams.get("period");
  const period =
    force && periodParam && /^\d{4}-\d{2}$/.test(periodParam)
      ? periodParam
      : todayMonth();
  // Active tenancies whose tenant has an email and who have no move-out set
  // (a scheduled move-out, past or future, is filtered out per-row below).
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

  // Rows already written for this period tell us who's been emailed (email
  // idempotency, per tenancy) and who's been texted (sms_sent_at). A continued
  // invocation uses these to avoid re-sending either channel.
  const { data: existingRows } = await supabase
    .from("rent_reminder_emails")
    .select("tenancy_id, sms_sent_at")
    .eq("period_month", period);
  const alreadyEmailed = new Set(
    (existingRows ?? []).map((r: { tenancy_id: string }) => r.tenancy_id),
  );
  const alreadyTexted = new Set(
    (existingRows ?? [])
      .filter((r: { sms_sent_at: string | null }) => r.sms_sent_at != null)
      .map((r: { tenancy_id: string }) => r.tenancy_id),
  );

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

  // Eligible = active tenant with an email and no move-out scheduled. A set
  // move_out_date (past or future) drops them from the general reminder; balance
  // reminders, gated on an actual balance, still go out separately.
  type Eligible = {
    tenancyId: string;
    tenantId: string;
    email: string;
    phone: string | null;
    isNY: boolean;
  };
  let skipped = 0;
  const eligible: Eligible[] = [];
  for (const row of (tenancies ?? []) as Row[]) {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    const email = tenant?.email?.trim();
    if (!email || row.move_out_date) {
      skipped++;
      continue;
    }
    eligible.push({
      tenancyId: row.id,
      tenantId: row.tenant_id,
      email,
      phone: tenant?.phone?.trim() || null,
      isNY: isNewYork(row),
    });
  }

  let sent = 0;
  let queued = 0;
  let failed = 0;
  let texted = 0;
  let remaining = 0;
  const errors: Array<{ tenancy_id: string; error: string }> = [];

  // --- Email phase: two bulk BCC blasts, sent once per period ----------------
  // Reserve a per-(tenancy, period) row for everyone not yet emailed. Upsert
  // with ignoreDuplicates so a concurrent/continued invocation that already
  // reserved a tenant gets that row back as *not* inserted — we only blast the
  // rows WE inserted, so the email can never go out twice.
  const toReserve = eligible.filter((e) => !alreadyEmailed.has(e.tenancyId));
  let reserved: Eligible[] = [];
  if (toReserve.length) {
    const { data: inserted, error: reserveErr } = await supabase
      .from("rent_reminder_emails")
      .upsert(
        toReserve.map((e) => ({
          tenancy_id: e.tenancyId,
          tenant_id: e.tenantId,
          period_month: period,
          email_to: e.email,
        })),
        { onConflict: "tenancy_id,period_month", ignoreDuplicates: true },
      )
      .select("tenancy_id");
    if (reserveErr) {
      return NextResponse.json({ error: reserveErr.message }, { status: 500 });
    }
    const insertedIds = new Set(
      (inserted ?? []).map((r: { tenancy_id: string }) => r.tenancy_id),
    );
    reserved = toReserve.filter((e) => insertedIds.has(e.tenancyId));
  }

  // Stamp the reserved rows with the blast's outcome. At current roster size a
  // channel is a single chunk, so the batch result maps 1:1 onto these rows: all
  // delivered → sent_at now; wholly failed → error_text; wholly queued → left
  // pending (sent_at null) for the daily queue flush to deliver.
  const markRows = async (group: Eligible[], r: BulkSendResult) => {
    if (!group.length) return;
    const patch =
      r.attempted > 0 && r.failed === r.attempted
        ? { error_text: r.errors[0] ?? "send failed" }
        : r.sent > 0
          ? { sent_at: new Date().toISOString() }
          : null; // fully queued → stays pending until the flush
    if (!patch) return;
    await supabase
      .from("rent_reminder_emails")
      .update(patch)
      .in(
        "tenancy_id",
        group.map((e) => e.tenancyId),
      )
      .eq("period_month", period);
  };

  const tally = (r: BulkSendResult, label: string) => {
    sent += r.sent;
    queued += r.queued;
    failed += r.failed;
    if (r.errors.length) {
      errors.push({ tenancy_id: label, error: r.errors.join("; ") });
    }
  };

  // Non-NY → one Resend BCC blast; NY → one unbranded Gmail BCC blast.
  const reservedNonNY = reserved.filter((e) => !e.isNY);
  if (reservedNonNY.length) {
    const r = await sendRentReminderBulk(reservedNonNY.map((e) => e.email));
    tally(r, "resend_bulk");
    await markRows(reservedNonNY, r);
  }
  const reservedNY = reserved.filter((e) => e.isNY);
  if (reservedNY.length) {
    const r = await sendRentReminderGmailBulk(reservedNY.map((e) => e.email));
    tally(r, "gmail_bulk");
    await markRows(reservedNY, r);
  }

  // --- SMS phase: still one text per tenant, resumable across invocations ----
  // A text can't be BCC'd, so this stays serial and time-budgeted. Each success
  // sets sms_sent_at so a continuation never re-texts the same tenant; whoever's
  // left when the budget runs out is handed to a fresh invocation below.
  const startedAt = Date.now();
  for (const e of eligible) {
    if (!e.phone || alreadyTexted.has(e.tenancyId)) continue;
    if (Date.now() - startedAt > BUDGET_MS) {
      remaining++;
      continue;
    }
    const smsRes = await sendSms(e.phone, REMINDER_TEXT, {
      type: "rent_reminder",
      context: e.email,
    });
    if (smsRes.ok) {
      texted++;
      await supabase
        .from("rent_reminder_emails")
        .update({ sms_sent_at: new Date().toISOString() })
        .eq("tenancy_id", e.tenancyId)
        .eq("period_month", period);
    }
  }

  // Anyone still unsent when the budget ran out gets picked up by a fresh
  // invocation. We fire it *after* the response so the current function can
  // return promptly; the child runs on its own clean 60s clock. force=1 skips
  // the date gate, and period is pinned so every chunk shares one idempotency
  // key even if the chain crosses a month/day boundary.
  let continued = false;
  if (remaining > 0 && contCount < MAX_CONTINUATIONS) {
    const next = new URL(req.nextUrl.pathname, req.nextUrl.origin);
    next.searchParams.set("force", "1");
    next.searchParams.set("period", period);
    next.searchParams.set("cont", String(contCount + 1));
    const headers: Record<string, string> = expected
      ? { authorization: `Bearer ${expected}` }
      : {};
    continued = true;
    after(async () => {
      try {
        await fetch(next.toString(), { headers });
      } catch {
        // Best-effort; a missed continuation just leaves rows for the next
        // scheduled run or a manual re-trigger to finish.
      }
    });
  }

  return NextResponse.json({
    period,
    total: eligible.length,
    sent,
    queued,
    skipped,
    failed,
    texted,
    remaining,
    continued,
    cont: contCount,
    errors,
  });
}
