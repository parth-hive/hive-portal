import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { formatDate } from "@/lib/date";
import { SearchInput } from "@/components/search-input";
import { processExpiredTenancies } from "./actions";

export const dynamic = "force-dynamic";

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
  monthly_rent: number;
  first_month_rent: number | null;
  start_date: string;
  end_date: string | null;
  tenant_id: string;
  tenants: TenantRel | TenantRel[] | null;
  rooms: RoomRel | RoomRel[] | null;
  payments: {
    id: string;
    amount: number;
    paid_on: string;
    payment_type: string;
  }[];
};


function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function endOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

/**
 * What's owed for a single tenancy in the given calendar month.
 *  • Tenancy starts after this month → 0 (shouldn't happen here since we
 *    only fetch active tenancies, but defensive).
 *  • Starting month AND tenancy has first_month_rent set → use that.
 *  • Otherwise → monthly_rent (full month).
 */
function dueForMonth(
  startDate: string,
  monthlyRent: number,
  firstMonthRent: number | null,
  monthStart: string,
  monthEnd: string,
): number {
  if (startDate > monthEnd) return 0;
  const isStartingMonth = startDate >= monthStart && startDate <= monthEnd;
  if (isStartingMonth && firstMonthRent !== null) {
    return firstMonthRent;
  }
  return monthlyRent;
}

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function TenantsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  // Finalize any tenancies whose end_date has passed since the last visit.
  await processExpiredTenancies();

  const supabase = await createClient();
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();

  const { data, error } = await supabase
    .from("tenancies")
    .select(
      `id, monthly_rent, first_month_rent, start_date, end_date, tenant_id,
       tenants(id, full_name, email, phone),
       rooms(id, room_number,
             properties(id, building_name, street_address, unit_number)),
       payments(id, amount, paid_on, payment_type)`,
    )
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .returns<Row[]>();

  const rows = data ?? [];

  // Compute paid-this-month + due totals + portfolio totals. "Due" is the
  // tenancy's first_month_rent for the starting calendar month (when set)
  // and the regular monthly_rent every other month.
  let expectedTotal = 0;
  let paidTotal = 0;
  const rowsWithStatus = rows.map((row) => {
    const paidThisMonth = (row.payments ?? [])
      .filter(
        (p) =>
          p.payment_type === "rent" &&
          p.paid_on >= monthStart &&
          p.paid_on <= monthEnd,
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const due = dueForMonth(
      row.start_date,
      Number(row.monthly_rent),
      row.first_month_rent !== null ? Number(row.first_month_rent) : null,
      monthStart,
      monthEnd,
    );
    const balance = due - paidThisMonth;
    expectedTotal += due;
    paidTotal += paidThisMonth;
    return { ...row, paidThisMonth, balance, due };
  });

  const visibleRows = query
    ? rowsWithStatus.filter((r) => {
        const tenant = one(r.tenants);
        const room = one(r.rooms);
        const property = one(room?.properties ?? null);
        const haystack = [
          tenant?.full_name,
          tenant?.email,
          tenant?.phone,
          room?.room_number,
          property?.building_name,
          property?.street_address,
          property?.unit_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
    : rowsWithStatus;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone/60 pb-6">
        <div>
          <h1 className="text-3xl tracking-tight text-ink">
            Tenants &amp; <span className="font-display text-accent-text">Rent</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Active tenancies and their rent status for the current month.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/tenants/history"
            className="text-xs uppercase tracking-wide text-muted hover:text-accent-text"
          >
            Past tenants →
          </Link>
          <Link
            href="/tenants/new"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark"
          >
            Add tenant
          </Link>
        </div>
      </header>

      {rows.length > 0 && (
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted">
              Expected this month
            </p>
            <p className="mt-2 text-2xl font-light text-ink">
              {fmtMoney(expectedTotal)}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted">Collected</p>
            <p className="mt-2 text-2xl font-light text-ink">
              {fmtMoney(paidTotal)}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted">Outstanding</p>
            <p className="mt-2 text-2xl font-light text-ink">
              {fmtMoney(expectedTotal - paidTotal)}
            </p>
          </div>
        </section>
      )}

      <div className="mt-6">
        <SearchInput
          placeholder="Search by tenant, email, phone, or unit…"
          ariaLabel="Search tenants"
        />
      </div>

      {error && <p className="mt-6 text-sm text-red-700">{error.message}</p>}

      {rows.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No active tenants yet. Click <em>Add tenant</em> to assign someone to a
          room.
        </p>
      )}

      {rows.length > 0 && visibleRows.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No tenants match &ldquo;{query}&rdquo;.
        </p>
      )}

      {visibleRows.length > 0 && (
        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-warm/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Room</th>
                <th className="px-5 py-3 text-right font-medium">Due</th>
                <th className="px-5 py-3 text-right font-medium">Paid</th>
                <th className="px-5 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group rows by property label. Sort properties alphabetically;
                // tenancies with no room/property go into "Unassigned".
                const groups = new Map<
                  string,
                  typeof visibleRows
                >();
                for (const r of visibleRows) {
                  const room = one(r.rooms);
                  const p = one(room?.properties ?? null);
                  const key = p
                    ? `${p.building_name?.trim() || p.street_address} Apt ${p.unit_number}`
                    : "Unassigned";
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(r);
                }
                const ordered = Array.from(groups.entries()).sort(
                  ([a], [b]) =>
                    a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b),
                );

                return ordered.map(([label, items]) => {
                  const subDue = items.reduce((s, r) => s + r.due, 0);
                  const subPaid = items.reduce((s, r) => s + r.paidThisMonth, 0);
                  const subBalance = subDue - subPaid;
                  return (
                    <PropertyGroup
                      key={label}
                      label={label}
                      items={items}
                      subDue={subDue}
                      subPaid={subPaid}
                      subBalance={subBalance}
                    />
                  );
                });
              })()}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function PropertyGroup({
  label,
  items,
  subDue,
  subPaid,
  subBalance,
}: {
  label: string;
  items: Array<{
    id: string;
    tenant_id: string;
    monthly_rent: number;
    first_month_rent: number | null;
    start_date: string;
    end_date: string | null;
    tenants: TenantRel | TenantRel[] | null;
    rooms: RoomRel | RoomRel[] | null;
    payments: { id: string; amount: number; paid_on: string; payment_type: string }[];
    paidThisMonth: number;
    balance: number;
    due: number;
  }>;
  subDue: number;
  subPaid: number;
  subBalance: number;
}) {
  return (
    <>
      <tr className="border-t border-stone/40 bg-warm/40">
        <td
          colSpan={5}
          className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink/80"
        >
          {label} <span className="text-muted">({items.length})</span>
        </td>
      </tr>
      {items.map((r) => {
        const tenant = one(r.tenants);
        const room = one(r.rooms);
        const tenantName = tenant?.full_name ?? "—";
        const isPaid = r.balance <= 0;
        return (
          <tr
            key={r.id}
            className="border-t border-stone/30 transition hover:bg-cream/60"
          >
            <td className="px-5 py-3">
              <Link
                href={`/tenants/${r.tenant_id}`}
                className="text-ink hover:text-accent-text"
              >
                {tenantName}
              </Link>
              {tenant?.email && (
                <p className="text-xs text-muted">{tenant.email}</p>
              )}
              {r.end_date && (
                <p className="mt-1 text-xs text-accent-text">
                  Ending {formatDate(r.end_date)}
                </p>
              )}
            </td>
            <td className="px-5 py-3 text-ink">
              {room?.room_number ?? "—"}
            </td>
            <td className="px-5 py-3 text-right text-ink tabular-nums">
              {fmtMoney(r.due)}
            </td>
            <td className="px-5 py-3 text-right text-ink">
              {fmtMoney(r.paidThisMonth)}
            </td>
            <td className="px-5 py-3 text-right">
              <span
                className={
                  isPaid
                    ? "rounded-full bg-accent/15 px-2 py-0.5 text-xs uppercase tracking-wide text-accent-text"
                    : "text-ink"
                }
              >
                {isPaid ? "Paid" : fmtMoney(r.balance)}
              </span>
            </td>
          </tr>
        );
      })}
      <tr className="border-t border-stone/40 bg-cream/60 text-sm font-medium">
        <td colSpan={2} className="px-5 py-2 text-right text-muted">
          Subtotal
        </td>
        <td className="px-5 py-2 text-right text-ink tabular-nums">
          {fmtMoney(subDue)}
        </td>
        <td className="px-5 py-2 text-right text-ink tabular-nums">
          {fmtMoney(subPaid)}
        </td>
        <td className="px-5 py-2 text-right text-ink tabular-nums">
          {subBalance <= 0 ? (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs uppercase tracking-wide text-accent-text">
              Paid
            </span>
          ) : (
            fmtMoney(subBalance)
          )}
        </td>
      </tr>
    </>
  );
}
