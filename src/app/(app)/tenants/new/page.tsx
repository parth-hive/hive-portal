import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { AddTenantForm } from "./add-tenant-form";

export const dynamic = "force-dynamic";

type PropertyRel = {
  building_name: string | null;
  street_address: string;
  unit_number: string;
};
type RoomRow = {
  id: string;
  room_number: string | null;
  total_rent: number | null;
  properties: PropertyRel | PropertyRel[] | null;
};

export default async function NewTenantPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select(
      "id, room_number, total_rent, properties(building_name, street_address, unit_number)",
    )
    .eq("status", "available")
    .order("available_from", { ascending: true, nullsFirst: false })
    .returns<RoomRow[]>();

  const rooms = (data ?? []).map((r) => {
    const p = one(r.properties);
    const unitTitle = p
      ? `${p.building_name?.trim() || p.street_address} Apt ${p.unit_number}`
      : "—";
    return {
      id: r.id,
      label: `${unitTitle} · ${r.room_number ?? "Room"}`,
      total_rent: r.total_rent,
    };
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="border-b border-stone/60 pb-6">
        <Link
          href="/tenants"
          className="text-xs uppercase tracking-wide text-muted hover:text-ink"
        >
          ← Tenants &amp; Rent
        </Link>
        <h1 className="mt-2 text-3xl tracking-tight text-ink">
          Add a <span className="font-display text-accent-text">tenant</span>
        </h1>
      </header>

      <div className="mt-8">
        <AddTenantForm rooms={rooms} />
      </div>
    </div>
  );
}
