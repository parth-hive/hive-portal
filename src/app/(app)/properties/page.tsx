import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { SearchInput } from "@/components/search-input";

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

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function PropertiesPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, building_name, street_address, unit_number, cross_street, neighborhood, bedrooms, leaseholders(name), rooms(id, status)",
    )
    .order("street_address", { ascending: true })
    .order("unit_number", { ascending: true })
    .returns<PropertyRow[]>();

  const all = data ?? [];
  const properties = query
    ? all.filter((p) => {
        const haystack = [
          p.building_name,
          p.street_address,
          p.unit_number,
          p.cross_street,
          p.neighborhood,
          one(p.leaseholders)?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
    : all;

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

      {error && <p className="mt-6 text-sm text-red-700">{error.message}</p>}

      {all.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No properties yet. Click <em>Add property</em> to enter your first unit.
        </p>
      )}

      {all.length > 0 && properties.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No properties match &ldquo;{query}&rdquo;.
        </p>
      )}

      {properties.length > 0 && (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {properties.map((p) => {
            const totalRooms = p.rooms?.length ?? 0;
            const vacantRooms =
              p.rooms?.filter((r) => r.status === "available").length ?? 0;
            const title =
              p.building_name?.trim() ||
              `${p.street_address}`;
            return (
              <li key={p.id}>
                <Link
                  href={`/properties/${p.id}`}
                  className="block rounded-2xl bg-white p-6 shadow-sm transition hover:shadow"
                >
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {p.neighborhood ?? "—"}
                  </p>
                  <h2 className="mt-1 text-lg text-ink">
                    {title}{" "}
                    <span className="text-muted">Apt {p.unit_number}</span>
                  </h2>
                  {p.building_name && (
                    <p className="mt-0.5 text-xs text-muted">
                      {p.street_address}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span>
                      {totalRooms} room{totalRooms === 1 ? "" : "s"}
                    </span>
                    {vacantRooms > 0 && (
                      <span className="text-accent-text">
                        {vacantRooms} vacant
                      </span>
                    )}
                    {one(p.leaseholders)?.name && (
                      <span>Lease: {one(p.leaseholders)?.name}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
