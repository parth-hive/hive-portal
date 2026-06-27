import type { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/relations";

export type CleaningOccupant = {
  room_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  vacated: boolean;
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

  // One contact per room: rows are newest-first, so the first seen per room is
  // the latest tenancy; only override it when a later row is the active one.
  const chosenByRoom = new Map<string, TenantRow>();
  for (const r of tenancyRows ?? []) {
    if (!one(r.tenants)) continue;
    const cur = chosenByRoom.get(r.room_id);
    if (!cur || (cur.status !== "active" && r.status === "active")) {
      chosenByRoom.set(r.room_id, r);
    }
  }

  const occupants: CleaningOccupant[] = [...chosenByRoom.values()]
    .map((r) => {
      const room = one(r.rooms);
      const tenant = one(r.tenants);
      if (!tenant) return null;
      return {
        room_number: room?.room_number ?? null,
        full_name: tenant.full_name,
        email: tenant.email,
        phone: tenant.phone,
        vacated: r.status !== "active",
      };
    })
    .filter((x): x is CleaningOccupant => x !== null)
    .sort((a, b) => (a.room_number ?? "").localeCompare(b.room_number ?? ""));

  return { unitLabel, leaseholderName, occupants };
}
