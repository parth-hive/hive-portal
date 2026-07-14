import Link from "next/link";
import { formatDate } from "@/lib/date";
import { dismissEndedBalance, undismissEndedBalance } from "./actions";

export type FormerTenantRow = {
  tenancyId: string;
  tenantId: string;
  name: string;
  unitLabel: string | null;
  roomLabel: string | null;
  movedOut: string | null;
  balance: number;
  dismissed: boolean;
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * "Moved out with balance" — departed tenants whose running ledger still
 * shows money owed. Kept visible until an operator dismisses each one
 * (collected outside the system, offset against the deposit, or written
 * off); dismissals are reversible from the collapsed list below.
 */
export function FormerTenants({
  rows,
  canDismiss,
}: {
  rows: FormerTenantRow[];
  canDismiss: boolean;
}) {
  const open = rows.filter((r) => !r.dismissed);
  const dismissed = rows.filter((r) => r.dismissed);
  if (rows.length === 0) return null;

  return (
    <section className="mt-10">
      <header className="flex items-end justify-between gap-3">
        <h2 className="text-xl tracking-tight text-ink">
          Moved out{" "}
          <span className="font-display text-accent-text">with balance</span>
        </h2>
        <span className="text-xs text-muted">
          {open.length} outstanding
          {dismissed.length > 0 ? ` · ${dismissed.length} dismissed` : ""}
        </span>
      </header>

      {open.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white px-6 py-6 text-center text-sm text-muted shadow-sm">
          Nothing outstanding — every remaining balance has been dismissed.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1.5">
          {open.map((r) => (
            <li
              key={r.tenancyId}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tenants/${r.tenantId}`}
                  className="text-ink hover:text-accent-text"
                >
                  {r.name}
                </Link>
                <p className="text-xs text-muted">
                  {[r.unitLabel, r.roomLabel].filter(Boolean).join(" · ") || "—"}
                  {r.movedOut && ` · moved out ${formatDate(r.movedOut)}`}
                </p>
              </div>
              <span className="shrink-0 font-medium tabular-nums text-red-700">
                {fmtMoney(r.balance)}
              </span>
              {canDismiss && (
                <form action={dismissEndedBalance}>
                  <input type="hidden" name="tenancy_id" value={r.tenancyId} />
                  <button
                    type="submit"
                    title="Remove from this list (collected outside the system, offset, or written off). The ledger keeps the history; undo below."
                    className="shrink-0 rounded-full border border-stone bg-white px-3 py-1.5 text-xs font-medium text-muted shadow-sm transition hover:bg-warm hover:text-ink"
                  >
                    Dismiss
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {dismissed.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted hover:text-ink">
            Dismissed ({dismissed.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {dismissed.map((r) => (
              <li
                key={r.tenancyId}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-warm/40 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tenants/${r.tenantId}`}
                    className="text-ink hover:text-accent-text"
                  >
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {[r.unitLabel, r.roomLabel].filter(Boolean).join(" · ") || "—"}
                    {r.movedOut && ` · moved out ${formatDate(r.movedOut)}`}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-muted line-through">
                  {fmtMoney(r.balance)}
                </span>
                {canDismiss && (
                  <form action={undismissEndedBalance}>
                    <input type="hidden" name="tenancy_id" value={r.tenancyId} />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-muted shadow-sm hover:text-ink"
                    >
                      Undo
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
