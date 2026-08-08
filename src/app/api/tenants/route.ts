/**
 * Read-only tenant contact API — `GET /api/tenants`.
 *
 * Built for the automated text-responding tool: resolve an inbound sender to
 * a tenant and answer with their unit/room context. Auth is a static bearer
 * token (`TENANTS_API_KEY`) separate from the inventory key — this endpoint
 * returns PII (names, emails, phones), which the inventory API deliberately
 * excludes.
 *
 * Query params:
 *   ?phone=  match a tenant by phone; both sides are normalized to digits
 *            and compared on the last 10, so "+1 (212) 365-4373",
 *            "212-365-4373" and "2123654373" all resolve the same tenant.
 *   ?q=      case-insensitive substring over name and email.
 *
 * Active tenancies only. Docs: /developers (portal, operators) — keep the
 * docs page in sync when this changes.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { one } from "@/lib/relations";
import { requireBearer } from "@/lib/api-auth";
import { unitLabel } from "@/lib/unit-label";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type TenantRel = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};
type PropertyRel = {
  id: string;
  building_name: string | null;
  street_address: string;
  unit_number: string;
};
type RoomRel = {
  id: string;
  room_number: string | null;
  properties: PropertyRel | PropertyRel[] | null;
};
type Row = {
  id: string;
  tenant_id: string;
  start_date: string;
  tenants: TenantRel | TenantRel[] | null;
  rooms: RoomRel | RoomRel[] | null;
};

/** Last 10 digits of a phone-ish string, or null when too short to compare. */
function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export async function GET(req: Request) {
  const denied = requireBearer(req, "TENANTS_API_KEY");
  if (denied) return denied;

  const url = new URL(req.url);
  const phoneParam = url.searchParams.get("phone");
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const { data, error } = await admin()
    .from("tenancies")
    .select(
      `id, tenant_id, start_date,
       tenants(id, full_name, email, phone),
       rooms(id, room_number,
             properties(id, building_name, street_address, unit_number))`,
    )
    .eq("status", "active")
    .returns<Row[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const wantPhone = phoneParam ? phoneKey(phoneParam) : null;
  if (phoneParam && !wantPhone) {
    return NextResponse.json(
      { error: "phone must contain at least 10 digits" },
      { status: 400 },
    );
  }

  const tenants = (data ?? [])
    .map((row) => {
      const t = one(row.tenants);
      const room = one(row.rooms);
      const p = one(room?.properties ?? null);
      if (!t) return null;
      return {
        id: t.id,
        name: t.full_name,
        email: t.email,
        phone: t.phone,
        unit: p ? unitLabel(p) : null,
        room: room?.room_number?.replace(/^room\s+/i, "") || null,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .filter((t) => !wantPhone || phoneKey(t.phone) === wantPhone)
    .filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.email ?? "").toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    as_of: todayISO(),
    count: tenants.length,
    tenants,
  });
}
