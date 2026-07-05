"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/searchable-select";
import { assignBillProperty, deleteBill, getStatementUrl } from "./actions";

export type UnitOpt = { id: string; label: string };

export type BillRow = {
  id: string;
  property_id: string | null;
  provider: string | null;
  utility_type: string;
  account_number: string | null;
  service_address: string | null;
  statement_date: string | null;
  period_start: string | null;
  period_end: string | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  utility_bill_charges: {
    id: string;
    kind: "current" | "late_fee" | "other";
    description: string | null;
    amount: number;
  }[];
};

const TYPE_LABEL: Record<string, string> = {
  electric: "Electric",
  gas: "Gas",
  water: "Water",
  internet: "Internet",
  trash: "Trash",
  other: "Other",
};

const fmtMoney = (n: number) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

/**
 * The month a bill belongs to: the calendar month holding the majority of
 * the billing period's days (Apr 7 – May 6 → April). Ties go to the earlier
 * month. Falls back to the statement date, then the upload date.
 */
function billMonth(b: BillRow): string {
  if (b.period_start && b.period_end && b.period_end >= b.period_start) {
    const days = new Map<string, number>();
    const d = new Date(`${b.period_start.slice(0, 10)}T12:00:00Z`);
    const end = new Date(`${b.period_end.slice(0, 10)}T12:00:00Z`);
    // Billing periods are ~1 month; walking the days is simple and exact.
    for (let i = 0; i < 400 && d <= end; i++) {
      const key = d.toISOString().slice(0, 7);
      days.set(key, (days.get(key) ?? 0) + 1);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    let best = "";
    let bestCount = -1;
    for (const [key, count] of days) {
      if (count > bestCount || (count === bestCount && key < best)) {
        best = key;
        bestCount = count;
      }
    }
    if (best) return best;
  }
  const anchor = b.period_start ?? b.statement_date ?? b.created_at;
  return anchor.slice(0, 7);
}

const monthLabel = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function BillsLog({ bills, units }: { bills: BillRow[]; units: UnitOpt[] }) {
  const [filter, setFilter] = useState("");
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const unitName = useMemo(
    () => new Map(units.map((u) => [u.id, u.label])),
    [units],
  );

  const visible = filter
    ? bills.filter((b) =>
        filter === "unmatched" ? !b.property_id : b.property_id === filter,
      )
    : bills;

  // Month groups (newest first), each holding unit groups (alphabetical,
  // unmatched last).
  const months = useMemo(() => {
    const byMonth = new Map<string, BillRow[]>();
    for (const b of visible) {
      const m = billMonth(b);
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(b);
    }
    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, rows]) => {
        const byUnit = new Map<string, BillRow[]>();
        for (const b of rows) {
          const key = b.property_id ?? "unmatched";
          if (!byUnit.has(key)) byUnit.set(key, []);
          byUnit.get(key)!.push(b);
        }
        const unitGroups = [...byUnit.entries()]
          .map(([key, groupBills]) => ({
            key,
            label:
              key === "unmatched"
                ? "⚠ Unmatched"
                : unitName.get(key) ?? "Unit",
            bills: groupBills,
            total: groupBills.reduce((s, b) => s + Number(b.total_amount), 0),
          }))
          .sort((a, b) =>
            a.key === "unmatched" ? 1 : b.key === "unmatched" ? -1 : a.label.localeCompare(b.label),
          );
        return {
          month,
          bills: rows,
          unitGroups,
          total: rows.reduce((s, b) => s + Number(b.total_amount), 0),
        };
      });
  }, [visible, unitName]);

  const total = visible.reduce((s, b) => s + Number(b.total_amount), 0);
  const hasUnmatched = bills.some((b) => !b.property_id);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl tracking-tight text-ink">
          Expense <span className="font-display text-accent-text">log</span>
        </h2>
        <span className="text-sm tabular-nums text-muted">
          {visible.length} bill{visible.length === 1 ? "" : "s"} · {fmtMoney(total)}
        </span>
        <SearchableSelect
          className="ml-auto w-64"
          options={units}
          pinned={[
            { id: "", label: "All units" },
            ...(hasUnmatched ? [{ id: "unmatched", label: "⚠ Unmatched" }] : []),
          ]}
          value={filter}
          onSelect={setFilter}
          placeholder="Search units…"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {months.map(({ month, bills: monthBills, unitGroups, total: monthTotal }) => {
          const open = openMonths.has(month);
          return (
            <div key={month} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setOpenMonths((prev) => {
                    const next = new Set(prev);
                    if (next.has(month)) next.delete(month);
                    else next.add(month);
                    return next;
                  })
                }
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-warm/40"
              >
                <span className="text-muted">{open ? "▾" : "▸"}</span>
                <span className="text-base font-medium text-ink">
                  {monthLabel(month)}
                </span>
                <span className="text-xs text-muted">
                  {monthBills.length} bill{monthBills.length === 1 ? "" : "s"} ·{" "}
                  {unitGroups.length} unit{unitGroups.length === 1 ? "" : "s"}
                </span>
                <span className="ml-auto text-base font-semibold tabular-nums text-ink">
                  {fmtMoney(monthTotal)}
                </span>
              </button>

              {open && (
                <div className="flex flex-col gap-4 border-t border-stone/40 bg-cream/40 px-4 py-4">
                  {unitGroups.map((g) => (
                    <div key={g.key}>
                      <div className="flex items-center justify-between px-1 pb-2">
                        <span
                          className={`text-xs font-medium uppercase tracking-wide ${
                            g.key === "unmatched" ? "text-amber-800" : "text-muted"
                          }`}
                        >
                          {g.label}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-ink/80">
                          {fmtMoney(g.total)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {g.bills.map((b) => (
                          <BillCard key={b.id} bill={b} units={units} unitName={unitName} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {months.length === 0 && (
          <p className="rounded-2xl bg-white px-6 py-14 text-center text-sm text-muted shadow-sm">
            No utility bills logged yet — drop a statement above to start.
          </p>
        )}
      </div>
    </div>
  );
}

function BillCard({
  bill,
  units,
  unitName,
}: {
  bill: BillRow;
  units: UnitOpt[];
  unitName: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const extras = bill.utility_bill_charges.filter((c) => c.kind !== "current");

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div
        className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {bill.property_id ? (
              unitName.get(bill.property_id) ?? "Unit"
            ) : (
              <span className="text-amber-800">⚠ Unmatched unit</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {[TYPE_LABEL[bill.utility_type] ?? bill.utility_type, bill.provider]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-xs text-muted">
          <p>
            {bill.period_start || bill.period_end
              ? `${fmtDate(bill.period_start)} – ${fmtDate(bill.period_end)}`
              : `Statement ${fmtDate(bill.statement_date)}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {extras.length > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              +{extras.length} fee{extras.length === 1 ? "" : "s"}
            </span>
          )}
          <span className="text-base font-semibold tabular-nums text-ink">
            {fmtMoney(bill.total_amount)}
          </span>
          <span className="text-muted">{open ? "▾" : "▸"}</span>
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-stone/40 pt-4">
          <table className="w-full text-sm">
            <tbody>
              {bill.utility_bill_charges.map((c) => (
                <tr key={c.id}>
                  <td className="py-1 pr-3">
                    <span
                      className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        c.kind === "current"
                          ? "border-stone bg-warm/60 text-ink/70"
                          : c.kind === "late_fee"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {c.kind === "current" ? "usage" : c.kind.replace("_", " ")}
                    </span>
                    <span className="text-ink/80">{c.description ?? "—"}</span>
                  </td>
                  <td className="py-1 text-right tabular-nums text-ink">
                    {fmtMoney(c.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(bill.service_address || bill.account_number || bill.notes) && (
            <p className="mt-3 text-xs text-muted">
              {[
                bill.service_address,
                bill.account_number ? `Acct ${bill.account_number}` : null,
                bill.notes,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <SearchableSelect
              className="w-64"
              options={units}
              pinned={[{ id: "", label: "— no unit —" }]}
              value={bill.property_id ?? ""}
              disabled={pending}
              placeholder="Search units…"
              onSelect={(id) =>
                startTransition(async () => {
                  const r = await assignBillProperty(bill.id, id || null);
                  if (r?.error) toast.error(r.error);
                  else
                    toast.success(
                      id
                        ? "Bill reassigned — future statements from this account will match automatically."
                        : "Bill unassigned.",
                    );
                })
              }
            />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await getStatementUrl(bill.id);
                  if (r.error) toast.error(r.error);
                  else if (r.url) window.open(r.url, "_blank");
                })
              }
              className="rounded-full border border-stone bg-white px-3 py-1 font-medium uppercase tracking-wide text-muted hover:text-accent-text"
            >
              View statement
            </button>
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rounded-full border border-stone bg-white px-3 py-1 font-medium uppercase tracking-wide text-muted hover:text-red-700"
              >
                Delete
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteBill(bill.id);
                      if (r?.error) toast.error(r.error);
                      else toast.success("Bill deleted.");
                    })
                  }
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-semibold text-red-700 hover:bg-red-100"
                >
                  {pending ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
