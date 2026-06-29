import type { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/relations";

export type CleaningOccupant = {
  room_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  // current = active tenant, vacated = moved out (ended), upcoming = assigned
  // but not yet moved in.
  status: "current" | "vacated" | "upcoming";
};

export type CleaningUnitContext = {
  unitLabel: string;
  leaseholderName: string | null;
  occupants: CleaningOccupant[];
};

/**
 * Gathers everything a cleaner needs for a unit: the label, the leaseholder,
 * and one contact per room (the current tenant, or the last tenant who vacated
 * it). Shared by the day-before reminders and the move-out notices.
 */
export async function gatherCleaningContext(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<CleaningUnitContext | null> {
  type LeaseholderShape = { name: string };
  type PropertyRow = {
    building_name: string | null;
    street_address: string;
    unit_number: string;
    leaseholders: LeaseholderShape | LeaseholderShape[] | null;
  };
  const { data: prop } = await supabase
    .from("properties")
    .select("building_name, street_address, unit_number, leaseholders(name)")
    .eq("id", propertyId)
    .maybeSingle<PropertyRow>();
  if (!prop) return null;

  const unitLabel = `${prop.building_name?.trim() || prop.street_address} Apt ${prop.unit_number}`;
  const leaseholderName = one(prop.leaseholders)?.name ?? null;

  type TenantRow = {
    status: string;
    start_date: string;
    room_id: string;
    rooms: { room_number: string | null } | { room_number: string | null }[] | null;
    tenants:
      | { full_name: string; email: string | null; phone: string | null }
      | { full_name: string; email: string | null; phone: string | null }[]
      | null;
  };
  const { data: tenancyRows } = await supabase
    .from("tenancies")
    .select(
      "status, start_date, room_id, rooms!inner(room_number, property_id), tenants(full_name, email, phone)",
    )
    .eq("rooms.property_id", propertyId)
    .order("start_date", { ascending: false })
    .returns<TenantRow[]>();

  // Per room, surface everyone relevant to a cleaner: the current (active)
  // tenant, or — if the room is empty — the one who just moved out (ended),
  // plus any upcoming tenant who's been assigned but hasn't moved in yet.
  const byRoom = new Map<string, TenantRow[]>();
  for (const r of tenancyRows ?? []) {
    if (!one(r.tenants)) continue;
    const arr = byRoom.get(r.room_id) ?? [];
    arr.push(r);
    byRoom.set(r.room_id, arr);
  }

  const occupants: CleaningOccupant[] = [];
  for (const rows of byRoom.values()) {
    const actives = rows.filter((r) => r.status === "active");
    const upcomings = rows
      .filter((r) => r.status === "upcoming")
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const endeds = rows
      .filter((r) => r.status === "ended")
      .sort((a, b) => b.start_date.localeCompare(a.start_date));

    const chosen: { row: TenantRow; status: CleaningOccupant["status"] }[] = [];
    if (actives.length > 0) {
      for (const r of actives) chosen.push({ row: r, status: "current" });
    } else if (endeds.length > 0) {
      chosen.push({ row: endeds[0], status: "vacated" });
    }
    for (const r of upcomings) chosen.push({ row: r, status: "upcoming" });

    for (const { row, status } of chosen) {
      const room = one(row.rooms);
      const tenant = one(row.tenants);
      if (!tenant) continue;
      occupants.push({
        room_number: room?.room_number ?? null,
        full_name: tenant.full_name,
        email: tenant.email,
        phone: tenant.phone,
        status,
      });
    }
  }
  occupants.sort((a, b) => (a.room_number ?? "").localeCompare(b.room_number ?? ""));

  return { unitLabel, leaseholderName, occupants };
}
