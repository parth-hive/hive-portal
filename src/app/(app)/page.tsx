import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cleaningScheduleFor, todayISO } from "@/lib/cleaning";

export default async function Dashboard() {
  const supabase = await createClient();
  const today = todayISO();

  const [
    propertyCount,
    roomCount,
    vacantRoomCount,
    upcomingVacancyCount,
    propertyList,
    cleaningRows,
  ] = await Promise.all([
    supabase.from("properties").select("*", { count: "exact", head: true }),
    supabase.from("rooms").select("*", { count: "exact", head: true }),
    supabase
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("status", "available"),
    supabase
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("status", "occupied")
      .gte("available_from", today),
    supabase.from("properties").select("id"),
    supabase
      .from("cleaning_records")
      .select("property_id, cleaning_date")
      .order("cleaning_date", { ascending: false }),
  ]);

  // Compute "cleanings due" = properties with status 'never' or 'overdue'.
  const lastByProperty = new Map<string, string>();
  for (const c of cleaningRows.data ?? []) {
    if (!lastByProperty.has(c.property_id)) {
      lastByProperty.set(c.property_id, c.cleaning_date);
    }
  }
  const cleaningsDue = (propertyList.data ?? []).filter((p) => {
    const s = cleaningScheduleFor(lastByProperty.get(p.id) ?? null, today);
    return s.status === "never" || s.status === "overdue";
  }).length;

  const stats = [
    {
      label: "Properties",
      value: propertyCount.count ?? 0,
      href: "/properties",
    },
    { label: "Rooms", value: roomCount.count ?? 0, href: "/properties" },
    {
      label: "Vacant now",
      value: vacantRoomCount.count ?? 0,
      href: "/vacancies",
    },
    {
      label: "Vacating soon",
      value: upcomingVacancyCount.count ?? 0,
      href: "/vacancies",
    },
    {
      label: "Cleanings due",
      value: cleaningsDue,
      href: "/cleaning",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="border-b border-stone/60 pb-6">
        <h1 className="text-3xl tracking-tight text-ink">
          <span className="font-display text-accent-text">Overview</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          At-a-glance snapshot of your portfolio.
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow"
          >
            <p className="text-xs uppercase tracking-wide text-muted">
              {s.label}
            </p>
            <p className="mt-3 text-4xl font-light text-ink">{s.value}</p>
          </Link>
        ))}
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <Link
          href="/properties"
          className="group rounded-2xl bg-white p-6 shadow-sm transition hover:shadow"
        >
          <p className="text-xs uppercase tracking-wide text-muted">
            Start here
          </p>
          <h2 className="mt-2 text-xl text-ink">
            Add your <span className="font-display text-accent-text">properties</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Each apartment unit and its rooms, amenities, and leaseholder.
          </p>
          <p className="mt-4 text-sm text-accent-text group-hover:text-accent-dark">
            Manage →
          </p>
        </Link>

        <Link
          href="/vacancies"
          className="group rounded-2xl bg-white p-6 shadow-sm transition hover:shadow"
        >
          <p className="text-xs uppercase tracking-wide text-muted">Then</p>
          <h2 className="mt-2 text-xl text-ink">
            Work the <span className="font-display text-accent-text">vacancies</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Listable rooms with copy-paste descriptions, ad tracking, and VA
            priority colors.
          </p>
          <p className="mt-4 text-sm text-accent-text group-hover:text-accent-dark">
            Open →
          </p>
        </Link>
      </section>
    </div>
  );
}
