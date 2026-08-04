import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { SearchInput } from "@/components/search-input";
import { TableSkeleton } from "@/components/section-skeletons";
import { PropertiesTable, type PropertyDisplayRow } from "./properties-table";

export const dynamic = "force-dynamic";

type LeaseholderRel = { name: string };
type PropertyRow = {
  id: string;
  building_name: string | null;
  street_address: string;
  unit_number: string;
  cross_street: string | null;
  neighborhood: string | null;
  bedrooms: number | null;
  leaseholders: LeaseholderRel | LeaseholderRel[] | null;
  rooms: { id: string; status: string }[];
};

async function PropertiesSection() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, building_name, street_address, unit_number, cross_street, neighborhood, bedrooms, leaseholders(name), rooms(id, status)",
    )
    // Retired properties live on the Past Tenants page, not here.
    .is("archived_at", null)
    .order("street_address", { ascending: true })
    .order("unit_number", { ascending: true })
    .returns<PropertyRow[]>();

  if (error) {
    return <p className="mt-6 text-sm text-red-700">{error.message}</p>;
  }

  const rows: PropertyDisplayRow[] = (data ?? []).map((p) => {
    const leaseholderName = one(p.leaseholders)?.name ?? null;
    return {
      id: p.id,
      title: p.building_name?.trim() || p.street_address,
      buildingName: p.building_name,
      streetAddress: p.street_address,
      unitNumber: p.unit_number,
      neighborhood: p.neighborhood,
      totalRooms: p.rooms?.length ?? 0,
      vacantRooms: p.rooms?.filter((r) => r.status === "available").length ?? 0,
      leaseholderName,
      haystack: [
        p.building_name,
        p.street_address,
        p.unit_number,
        p.cross_street,
        p.neighborhood,
        leaseholderName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  return <PropertiesTable rows={rows} />;
}

export default function PropertiesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone/60 pb-6">
        <div>
          <h1 className="text-3xl tracking-tight text-ink">
            <span className="font-display text-accent-text">Properties</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Each apartment unit you manage, with its rooms.
          </p>
        </div>
        <Link
          href="/properties/new"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark"
        >
          Add property
        </Link>
      </header>

      <div className="mt-6">
        <SearchInput
          placeholder="Search by address, unit, neighborhood, leaseholder…"
          ariaLabel="Search properties"
        />
      </div>

      <Suspense
        fallback={
          <div className="mt-6">
            <TableSkeleton />
          </div>
        }
      >
        <PropertiesSection />
      </Suspense>
    </div>
  );
}
