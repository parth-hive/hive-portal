import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { formatDate } from "@/lib/date";
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

export default async function TenantsPage() {
  // Finalize any tenancies whose end_date has passed since the last visit.
  await processExpiredTenancies();

  const supabase = await createClient();
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();

  const { data, error } = await supabase
    .from("tenancies")
    .select(
      `id, monthly_rent, start_date, end_date, tenant_id,
       tenants(id, full_name, email, phone),
       rooms(id, room_number,
             properties(id, building_name, street_address, unit_number)),
       payments(id, amount, paid_on, payment_type)`,
    )
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .returns<Row[]>();

  const rows = data ?? [];

  // Compute paid-this-month totals + portfolio totals
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
    const balance = Number(row.monthly_rent) - paidThisMonth;
    expectedTotal += Number(row.monthly_rent);
    paidTotal += paidThisMonth;
    return { ...row, paidThisMonth, balance };
  });

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
        <Link
          href="/tenants/new"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark"
        >
          Add tenant
        </Link>
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

      {error && <p className="mt-6 text-sm text-red-700">{error.message}</p>}

      {rows.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No active tenants yet. Click <em>Add tenant</em> to assign someone to a
          room.
        </p>
      )}

      {rowsWithStatus.length > 0 && (
        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-warm/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Unit / Room</th>
                <th className="px-5 py-3 text-right font-medium">Monthly</th>
                <th className="px-5 py-3 text-right font-medium">Paid</th>
                <th className="px-5 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithStatus.map((r) => {
                const tenant = one(r.tenants);
                const room = one(r.rooms);
                const p = one(room?.properties ?? null);
                const unitTitle = p
                  ? `${p.building_name?.trim() || p.street_address} Apt ${p.unit_number}`
                  : "—";
                const tenantName = tenant?.full_name ?? "—";
                const isPaid = r.balance <= 0;

                return (
                  <tr
                    key={r.id}
                    className="border-t border-stone/40 transition hover:bg-cream/60"
                  >
                    <td className="px-5 py-4">
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
                    <td className="px-5 py-4 text-ink">
                      <p>{unitTitle}</p>
                      <p className="text-xs text-muted">
                        {room?.room_number ?? ""}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right text-ink">
                      {fmtMoney(Number(r.monthly_rent))}
                    </td>
                    <td className="px-5 py-4 text-right text-ink">
                      {fmtMoney(r.paidThisMonth)}
                    </td>
                    <td className="px-5 py-4 text-right">
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
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
