/**
 * Recording rent-rate changes in `tenancy_rent_history` — the mechanism that
 * makes a monthly-rent edit apply to FUTURE months only. Every code path that
 * writes `tenancies.monthly_rent` must call {@link recordRentChange} first, or
 * the ledger (and everything downstream) retroactively reprices past months.
 *
 * Accessed via `as any` because the table post-dates the generated Supabase
 * types (same pattern as rent-data.ts).
 */

import { todayISO } from "@/lib/date";

// Accepts either the user-scoped server client or the service-role admin
// client — both expose the same query builder surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

/**
 * Records a rent change effective the month of `effectiveFrom` (typically the
 * renewed lease's start date; defaults to today), backfilling the original
 * rate as a baseline the first time so past months keep billing what they
 * billed. The effective month may never precede the current month — that
 * would reprice rent already posted to the ledger. No-op when the rate isn't
 * actually changing. Call BEFORE updating `tenancies.monthly_rent` (the
 * baseline reads the pre-change rate).
 */
export async function recordRentChange(
  supabase: AnySupabase,
  tenancyId: string,
  newRate: number,
  effectiveFrom?: string,
): Promise<{ error?: string }> {
  const { data: cur } = await supabase
    .from("tenancies")
    .select("monthly_rent, start_date")
    .eq("id", tenancyId)
    .single();
  if (!cur || Number(cur.monthly_rent) === newRate) return {};

  const thisMonth = `${todayISO().slice(0, 7)}-01`;
  const effectiveMonth = `${(effectiveFrom ?? todayISO()).slice(0, 7)}-01`;
  if (effectiveMonth < thisMonth)
    return {
      error:
        "The new rent can't start in a past month — rent already posted to the ledger would change.",
    };

  const { count } = await supabase
    .from("tenancy_rent_history")
    .select("id", { count: "exact", head: true })
    .eq("tenancy_id", tenancyId);
  if (!count) {
    const baseline = `${cur.start_date.slice(0, 7)}-01`;
    if (baseline < effectiveMonth) {
      await supabase.from("tenancy_rent_history").insert({
        tenancy_id: tenancyId,
        effective_month: baseline,
        monthly_rent: Number(cur.monthly_rent),
      });
    }
  }
  const { error } = await supabase.from("tenancy_rent_history").upsert(
    {
      tenancy_id: tenancyId,
      effective_month: effectiveMonth,
      monthly_rent: newRate,
    },
    { onConflict: "tenancy_id,effective_month" },
  );
  return error ? { error: error.message } : {};
}
