/**
 * Loads the two ledger side tables (ad-hoc charges + credit allocations) and
 * groups them by tenancy id, so callers can hand each tenancy's rows to
 * {@link computeLedger}. Both tables are small (a handful of rows per tenancy),
 * so a single fetch of each is cheaper than per-tenancy round-trips.
 *
 * Accessed via `as any` because the two tables post-date the generated
 * Supabase types (same pattern as `rent_reminder_batches`).
 */

import type { createClient } from "@/lib/supabase/server";
import type { LedgerAllocation, LedgerCharge, RentChange } from "@/lib/rent";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Full charge row: the extra columns beyond what {@link computeLedger} needs
 * let callers also build line-by-line ledger entries (balance-reminder
 * breakdowns) and trace a utility overcharge back to its uploaded bill.
 */
export type LedgerChargeRow = LedgerCharge & {
  id: string;
  tenancy_id: string;
  charged_on: string;
  note: string | null;
  bill_id: string | null;
};

export type LedgerSidecars = {
  charges: Map<string, LedgerChargeRow[]>;
  allocations: Map<string, LedgerAllocation[]>;
  /** Rent-rate changes per tenancy — rent edits reprice future months only. */
  rentChanges: Map<string, RentChange[]>;
};

function groupByTenancy<T extends { tenancy_id: string }>(
  rows: T[] | null | undefined,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows ?? []) {
    const list = map.get(r.tenancy_id);
    if (list) list.push(r);
    else map.set(r.tenancy_id, [r]);
  }
  return map;
}

export async function fetchLedgerSidecars(
  supabase: SupabaseServer,
): Promise<LedgerSidecars> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: charges }, { data: allocations }, { data: rentChanges }] =
    await Promise.all([
      sb
        .from("tenancy_charges")
        .select("id, tenancy_id, kind, amount, charged_on, note, bill_id"),
      sb.from("credit_allocations").select("tenancy_id, kind, amount"),
      sb
        .from("tenancy_rent_history")
        .select("tenancy_id, effective_month, monthly_rent"),
    ]);
  return {
    charges: groupByTenancy<LedgerChargeRow>(charges),
    allocations: groupByTenancy<LedgerAllocation & { tenancy_id: string }>(
      allocations,
    ),
    rentChanges: groupByTenancy<RentChange & { tenancy_id: string }>(
      rentChanges,
    ),
  };
}
