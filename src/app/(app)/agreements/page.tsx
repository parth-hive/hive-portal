import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { todayISO } from "@/lib/date";
import { AgreementGenerator, type TenancyPrefill } from "./agreement-generator";

export const metadata = {
  title: "Agreements",
};

export const dynamic = "force-dynamic";

type PropertyRel = {
  building_name: string | null;
  street_address: string;
  unit_number: string;
  is_new_york: boolean;
};
type RoomRel = {
  room_number: string | null;
  properties: PropertyRel | PropertyRel[] | null;
};
type TenantRel = { full_name: string };
type Row = {
  id: string;
  monthly_rent: number;
  security_deposit: number | null;
  start_date: string;
  lease_start_date: string | null;
  lease_end_date: string | null;
  tenants: TenantRel | TenantRel[] | null;
  rooms: RoomRel | RoomRel[] | null;
};

export default async function AgreementsPage() {
  const supabase = await createClient();

  // Active tenancies feed the prefill picker — every field stays editable, so
  // the picker only saves typing; it never constrains what can be generated.
  const { data } = await supabase
    .from("tenancies")
    .select(
      `id, monthly_rent, security_deposit, start_date, lease_start_date, lease_end_date,
       tenants(full_name),
       rooms(room_number, properties(building_name, street_address, unit_number, is_new_york))`,
    )
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .returns<Row[]>();

  const prefills: TenancyPrefill[] = (data ?? []).flatMap((row) => {
    const tenant = one(row.tenants);
    const room = one(row.rooms);
    const property = room ? one(room.properties) : null;
    if (!tenant) return [];
    const address = property
      ? `${property.street_address}${property.unit_number ? `, Apt ${property.unit_number}` : ""}`
      : "";
    const place = property
      ? property.building_name?.trim() || property.street_address
      : "";
    return [
      {
        id: row.id,
        tenantName: tenant.full_name,
        label: `${tenant.full_name}${place ? ` — ${place}` : ""}${room?.room_number ? ` · Room ${room.room_number}` : ""}`,
        propertyAddress: address,
        rent: String(row.monthly_rent),
        securityDeposit: row.security_deposit != null ? String(row.security_deposit) : "",
        leaseStartDate: row.lease_start_date ?? row.start_date,
        leaseEndDate: row.lease_end_date ?? "",
        isNewYork: property?.is_new_york ?? false,
      },
    ];
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="pb-6">
        <h1 className="text-3xl tracking-tight text-ink">
          <span className="font-display text-accent-text">Agreements</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Generate a sublease agreement PDF — built right here in the portal.
          New York units go out plain; everything else includes the Hive
          letterhead.
        </p>
      </header>

      <AgreementGenerator prefills={prefills} defaultAgreementDate={todayISO()} />
    </div>
  );
}
