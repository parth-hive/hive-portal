import Link from "next/link";
import { formatDate } from "@/lib/date";
import { dismissEndedBalance, settleEndedBalance } from "./actions";

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
 * shows money owed. Each appears here exactly once, until the operator acts:
 *   Settle  — posts a settlement credit (deposit applied, remainder written
 *             off) so the ledger nets to $0.
 *   Dismiss — hides the row here; the debt stays on the ledger and remains
 *             visible (with an Undo) on the Tenant history page.
 */
export function FormerTenants({
  rows,
  canDismiss,
}: {
  rows: FormerTenantRow[];
  canDismiss: boolean;
}) {
  const open = rows.filter((r) => !r.dismissed);
  const dismissedCount = rows.length - open.length;
  if (open.length === 0) return null;

  return (
    <section className="mt-10">
      <header className="flex items-end justify-between gap-3">
        <h2 className="text-xl tracking-tight text-ink">
          Moved out{" "}
          <span className="font-display text-accent-text">with balance</span>
        </h2>
        <span className="text-xs text-muted">
          {open.length} outstanding
          {dismissedCount > 0 ? (
            <>
              {" · "}
              <Link
                href="/tenants/history?bal=1"
                className="underline-offset-2 hover:text-ink hover:underline"
              >
                {dismissedCount} dismissed in history
              </Link>
            </>
          ) : null}
        </span>
      </header>

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
              <>
                <form action={settleEndedBalance}>
                  <input type="hidden" name="tenancy_id" value={r.tenancyId} />
                  <button
                    type="submit"
                    title="Post a settlement to the ledger: the security deposit is applied toward the balance and the rest written off, netting the ledger to $0. Undo by deleting the Settlement line on the tenant's ledger."
                    className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-ink/80"
                  >
                    Settle
                  </button>
                </form>
                <form action={dismissEndedBalance}>
                  <input type="hidden" name="tenancy_id" value={r.tenancyId} />
                  <button
                    type="submit"
                    title="Hide from this list without touching the ledger — the balance stays visible on the tenant's ledger and in Tenant history (undo there)."
                    className="shrink-0 rounded-full border border-stone bg-white px-3 py-1.5 text-xs font-medium text-muted shadow-sm transition hover:bg-warm hover:text-ink"
                  >
                    Dismiss
                  </button>
                </form>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
