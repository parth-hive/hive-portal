import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { formatDate } from "@/lib/date";
import { processExpiredTenancies } from "../tenants/actions";
import { CopyListing } from "./copy-listing";
import { ListingActionSelector } from "./listing-action";
import {
  ACTION_BORDER,
  ACTION_TINT,
  ACTION_LABELS,
  ACTION_ORDER,
  ACTION_SWATCH,
  type Action,
} from "./constants";

export const dynamic = "force-dynamic";

type PropertyRel = {
  id: string;
  building_name: string | null;
  street_address: string;
  unit_number: string;
  neighborhood: string | null;
};

type TenantRel = { full_name: string };
type TenancyRel = {
  status: "active" | "ended" | "upcoming";
  start_date: string;
  end_date: string | null;
  tenants: TenantRel | TenantRel[] | null;
};

type Row = {
  id: string;
  room_number: string | null;
  total_rent: number | null;
  available_from: string | null;
  status: "occupied" | "available" | "reserved" | "maintenance";
  marketing_description: string | null;
  photos_url: string | null;
  listing_action: Action;
  ad_url: string | null;
  ad_boosted: boolean;
  properties: PropertyRel | PropertyRel[] | null;
  tenancies: TenancyRel[] | null;
};

function fmtMoney(n: number | null) {
  if (n === null) return "—";
  return `$${n.toLocaleString()}`;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

type FilterKey =
  | "now"
  | "upcoming"
  | "no_ad"
  | "boosted"
  | "new_ad"
  | "update_price_or_date"
  | "delete_listing"
  | "boost_post"
  | "priority";

function isFilterKey(v: string | undefined): v is FilterKey {
  return (
    v === "now" ||
    v === "upcoming" ||
    v === "no_ad" ||
    v === "boosted" ||
    v === "new_ad" ||
    v === "update_price_or_date" ||
    v === "delete_listing" ||
    v === "boost_post" ||
    v === "priority"
  );
}

function matchesFilter(r: Row, filter: FilterKey, today: string) {
  switch (filter) {
    case "now":
      return (
        r.status === "available" &&
        (!r.available_from || r.available_from <= today)
      );
    case "upcoming":
      return (
        r.status === "occupied" ||
        (r.available_from !== null && r.available_from > today)
      );
    case "no_ad":
      return !r.ad_url;
    case "boosted":
      return r.ad_boosted;
    default:
      return r.listing_action === filter;
  }
}

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function VacanciesPage({ searchParams }: PageProps) {
  await processExpiredTenancies();

  const params = await searchParams;
  const activeFilter = isFilterKey(params.filter) ? params.filter : null;

  const supabase = await createClient();
  const today = todayStr();
  const { data, error } = await supabase
    .from("rooms")
    .select(
      `id, room_number, total_rent, available_from, status,
       marketing_description, photos_url, listing_action, ad_url, ad_boosted,
       properties(id, building_name, street_address, unit_number, neighborhood),
       tenancies(status, start_date, end_date, tenants(full_name))`,
    )
    .or(
      `status.eq.available,and(status.eq.occupied,available_from.gte.${today})`,
    )
    .order("available_from", { ascending: true, nullsFirst: true })
    .returns<Row[]>();

  const rooms = data ?? [];

  const counts = {
    total: rooms.length,
    now: rooms.filter((r) => matchesFilter(r, "now", today)).length,
    upcoming: rooms.filter((r) => matchesFilter(r, "upcoming", today)).length,
    no_ad: rooms.filter((r) => !r.ad_url).length,
    boosted: rooms.filter((r) => r.ad_boosted).length,
    by_action: Object.fromEntries(
      ACTION_ORDER.map((a) => [
        a,
        rooms.filter((r) => r.listing_action === a).length,
      ]),
    ) as Record<Action, number>,
  };

  const filtered = activeFilter
    ? rooms.filter((r) => matchesFilter(r, activeFilter, today))
    : rooms;

  const filteredNow = filtered.filter(
    (r) => r.status === "available" && (!r.available_from || r.available_from <= today),
  );
  const filteredUpcoming = filtered.filter(
    (r) =>
      r.status === "occupied" ||
      (r.available_from !== null && r.available_from > today),
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="border-b border-stone/60 pb-6">
        <h1 className="text-3xl tracking-tight text-ink">
          <span className="font-display text-accent-text">Vacancies</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Rooms you can list right now — available today, and scheduled to open
          up.
        </p>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total"
          value={counts.total}
          href="/vacancies"
          active={activeFilter === null}
        />
        <KpiCard
          label="Available now"
          value={counts.now}
          href={activeFilter === "now" ? "/vacancies" : "/vacancies?filter=now"}
          active={activeFilter === "now"}
          accent="bg-accent text-white"
        />
        <KpiCard
          label="Scheduled"
          value={counts.upcoming}
          href={
            activeFilter === "upcoming"
              ? "/vacancies"
              : "/vacancies?filter=upcoming"
          }
          active={activeFilter === "upcoming"}
          accent="bg-ink text-white"
        />
        <KpiCard
          label="No ad yet"
          value={counts.no_ad}
          href={
            activeFilter === "no_ad" ? "/vacancies" : "/vacancies?filter=no_ad"
          }
          active={activeFilter === "no_ad"}
          accent="bg-red-100 text-red-900"
        />
        <KpiCard
          label="Boosted"
          value={counts.boosted}
          href={
            activeFilter === "boosted"
              ? "/vacancies"
              : "/vacancies?filter=boosted"
          }
          active={activeFilter === "boosted"}
          accent="bg-orange-100 text-orange-900"
        />
      </section>

      <ul className="mt-4 flex flex-wrap gap-2">
        {ACTION_ORDER.map((a) => {
          const isActive = activeFilter === a;
          return (
            <li key={a}>
              <Link
                href={isActive ? "/vacancies" : `/vacancies?filter=${a}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                  isActive
                    ? "border-ink bg-ink text-white"
                    : "border-stone bg-white text-ink hover:bg-warm"
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${ACTION_SWATCH[a]}`}
                />
                {ACTION_LABELS[a]} ({counts.by_action[a]})
              </Link>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-6 text-sm text-red-700">{error.message}</p>}

      {rooms.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No rooms to list right now. A room appears here when its status is
          <em> Available </em>or when an active tenancy is scheduled to end.
        </p>
      )}

      {rooms.length > 0 && filtered.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No vacancies match this filter.{" "}
          <Link href="/vacancies" className="text-accent-text">
            Clear filter
          </Link>
          .
        </p>
      )}

      {filteredNow.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-muted">
            Available now ({filteredNow.length})
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredNow.map((r) => (
              <VacancyCard key={r.id} room={r} now />
            ))}
          </ul>
        </section>
      )}

      {filteredUpcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-muted">
            Upcoming ({filteredUpcoming.length})
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredUpcoming.map((r) => (
              <VacancyCard key={r.id} room={r} now={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  href,
  active,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  active: boolean;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl p-4 shadow-sm transition ${
        active
          ? "bg-ink text-white ring-2 ring-ink"
          : "bg-white hover:shadow"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-xs uppercase tracking-wide ${active ? "text-white/70" : "text-muted"}`}
        >
          {label}
        </p>
        {accent && !active && (
          <span className={`h-2 w-2 rounded-full ${accent.split(" ")[0]}`} />
        )}
      </div>
      <p
        className={`mt-2 text-3xl font-light ${active ? "text-white" : "text-ink"}`}
      >
        {value}
      </p>
    </Link>
  );
}

function VacancyCard({ room, now }: { room: Row; now: boolean }) {
  const p = one(room.properties);
  const unitTitle = p
    ? `${p.building_name?.trim() || p.street_address} Apt ${p.unit_number}`
    : "—";

  // Pick the most relevant tenancy for context:
  //   - If currently occupied with a scheduled future end → that active one (outgoing).
  //   - Otherwise the most recent ended tenancy (previous occupant).
  const tenancies = (room.tenancies ?? [])
    .slice()
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  const activeOutgoing = tenancies.find(
    (t) => t.status === "active" && t.end_date,
  );
  const previous = tenancies.find((t) => t.status === "ended");
  const featured = activeOutgoing ?? previous;
  const featuredTenantName = featured
    ? one(featured.tenants)?.full_name ?? null
    : null;
  const featuredLabel = activeOutgoing ? "Outgoing" : "Previous";

  return (
    <li
      className={`rounded-xl border-l-4 ${ACTION_BORDER[room.listing_action]} ${ACTION_TINT[room.listing_action]} p-4 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted">
            {p?.neighborhood ?? "—"}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-medium text-ink">
            <Link
              href={`/vacancies/${room.id}`}
              className="hover:text-accent-text"
            >
              {unitTitle}
            </Link>
          </h3>
          <p className="text-xs text-muted">{room.room_number ?? "Room"}</p>
          {featuredTenantName && (
            <p className="mt-1 text-[11px] text-muted">
              <span className="uppercase tracking-wide">{featuredLabel}:</span>{" "}
              <span className="text-ink">{featuredTenantName}</span>
            </p>
          )}
        </div>
        <ListingActionSelector
          roomId={room.id}
          current={room.listing_action}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-medium text-ink">
            {fmtMoney(room.total_rent)}
          </span>
          <span className="text-[10px] text-muted">/mo</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            now ? "bg-accent text-white" : "bg-ink text-white"
          }`}
        >
          <span className="opacity-80">
            {now ? "Avail." : "Avail."}
          </span>
          {room.available_from && <span>{formatDate(room.available_from)}</span>}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {room.ad_url ? (
          <a
            href={room.ad_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-900 hover:bg-green-200"
          >
            Ad ↗
          </a>
        ) : (
          <span className="rounded-full border border-stone bg-white px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
            No ad
          </span>
        )}
        {room.ad_boosted && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-900">
            ✓ Boost
          </span>
        )}
        {room.marketing_description && (
          <CopyListing text={room.marketing_description} />
        )}
        {room.photos_url && (
          <a
            href={room.photos_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-stone bg-white px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink hover:bg-warm"
          >
            Photos ↗
          </a>
        )}
        <Link
          href={`/vacancies/${room.id}`}
          className="ml-auto text-[11px] uppercase tracking-wide text-muted hover:text-accent-text"
        >
          Open →
        </Link>
      </div>
    </li>
  );
}
