"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDate } from "@/lib/date";
import { useDeferredParam, useUrlParamState } from "@/lib/use-url-param";
import { undismissEndedBalance } from "../actions";

export type HistoryRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  email: string | null;
  unit: string;
  room: string;
  start_date: string;
  move_out_date: string | null;
  months: number | null;
  monthly_rent: number;
  total_paid: number;
  dismissed: boolean;
  balance: number;
  /** Lowercased search haystack (name + email + unit + room). */
  haystack: string;
};

function fmtMoney(n: number | null) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDuration(months: number | null) {
  if (months === null) return "—";
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}y` : `${y}y ${m}m`;
}

/** All / With-balance pills, backed by ?bal= in the URL (shallow, no server). */
export function BalanceToggle({ owingCount }: { owingCount: number }) {
  const [bal, setBal] = useUrlParamState("bal");
  const balanceOnly = bal === "1";
  return (
    <div className="flex shrink-0 gap-1.5">
      <button
        type="button"
        onClick={() => setBal("")}
        className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition ${
          balanceOnly
            ? "border border-stone bg-white text-muted hover:bg-warm hover:text-ink"
            : "bg-ink text-white"
        }`}
      >
        All
      </button>
      <button
        type="button"
        onClick={() => setBal("1")}
        className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition ${
          balanceOnly
            ? "bg-ink text-white"
            : "border border-stone bg-white text-muted hover:bg-warm hover:text-ink"
        }`}
      >
        With balance ({owingCount})
      </button>
    </div>
  );
}

export function HistoryExplorer({
  rows,
  admin,
  canUndismiss,
}: {
  rows: HistoryRow[];
  admin: boolean;
  canUndismiss: boolean;
}) {
  const query = useDeferredParam("q").trim().toLowerCase();
  const balanceOnly = useDeferredParam("bal") === "1";

  const { scoped, filtered } = useMemo(() => {
    const scoped = balanceOnly ? rows.filter((r) => r.balance > 0.005) : rows;
    const filtered = query
      ? scoped.filter((r) => r.haystack.includes(query))
      : scoped;
    return { scoped, filtered };
  }, [rows, balanceOnly, query]);

  if (scoped.length === 0) {
    return (
      <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
        {balanceOnly ? "No past tenants owe anything." : "No move-outs yet."}
      </p>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
        No history entries match &ldquo;{query}&rdquo;.
      </p>
    );
  }

  return (
    <section className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone/40">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-warm/60 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Tenant</th>
            <th className="px-3 py-2 font-medium">Unit / Room</th>
            <th className="px-3 py-2 font-medium">Move-in</th>
            <th className="px-3 py-2 font-medium">Move-out</th>
            <th className="px-3 py-2 font-medium">Stay</th>
            <th className="px-3 py-2 text-right font-medium">Monthly</th>
            {admin && (
              <th className="px-3 py-2 text-right font-medium">Total paid</th>
            )}
            <th className="px-3 py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr
              key={r.id}
              className={`border-t border-stone/30 ${i % 2 === 1 ? "bg-cream/40" : "bg-white"} hover:bg-warm/30`}
            >
              <td className="px-3 py-2.5">
                <Link
                  href={`/tenants/${r.tenant_id}`}
                  className="text-ink hover:text-accent-text"
                >
                  {r.tenant_name}
                </Link>
                {r.email && <div className="text-xs text-muted">{r.email}</div>}
              </td>
              <td className="px-3 py-2.5 text-ink">
                {r.unit}
                <div className="text-xs text-muted">{r.room}</div>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-ink">
                {formatDate(r.start_date)}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-ink">
                {formatDate(r.move_out_date)}
              </td>
              <td className="px-3 py-2.5 text-muted">
                {formatDuration(r.months)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                {fmtMoney(r.monthly_rent)}
              </td>
              {admin && (
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                  {fmtMoney(r.total_paid)}
                </td>
              )}
              <td className="px-3 py-2.5 text-right tabular-nums">
                {r.balance > 0.005 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Link
                      href={`/tenants/${r.tenant_id}`}
                      title="Open the ledger to resolve"
                      className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      owes {fmtMoney(r.balance)}
                    </Link>
                    {r.dismissed && (
                      <span
                        className="rounded-full bg-warm px-2 py-0.5 text-xs text-muted"
                        title="Dismissed from the Rent Tracker — the debt is still on the ledger."
                      >
                        dismissed
                      </span>
                    )}
                    {r.dismissed && canUndismiss && (
                      <form action={undismissEndedBalance}>
                        <input type="hidden" name="tenancy_id" value={r.id} />
                        <button
                          type="submit"
                          title="Put this balance back on the Rent Tracker's moved-out list."
                          className="rounded-full bg-white px-2 py-0.5 text-xs text-muted shadow-sm hover:text-ink"
                        >
                          Undo
                        </button>
                      </form>
                    )}
                  </span>
                ) : r.balance < -0.005 ? (
                  <span className="text-xs text-accent-text">
                    {fmtMoney(-r.balance)} credit
                  </span>
                ) : (
                  <span className="text-xs text-muted">Settled</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
