/**
 * Month-end small-balance write-off.
 *
 * A residual balance under {@link SMALL_BALANCE_WRITE_OFF_MAX} isn't worth
 * chasing: both balance-reminder paths (the month-end cron and the manual
 * "Send balance reminders" action) call this before sending, posting an
 * 'adjustment' credit for the exact residue so the ledger settles to $0 and
 * the tenant gets the ordinary clean-account reminder instead of a dun.
 *
 * The adjustment is an ordinary tenancy_charges row, so it shows on the
 * tenant's ledger as a deletable "Adjustment" credit line and computeLedger
 * nets it out exactly like a settlement.
 */

import { SMALL_BALANCE_WRITE_OFF_MAX } from "@/lib/rent";

// Both the cookie-session server client and the service-role client satisfy
// this (same pattern as balance-detail.ts); tenancy_charges post-dates the
// generated types anyway.
type ChargeCapableClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
};

/** True when a positive balance is small enough to write off, not remind on. */
export function isSmallBalance(balance: number): boolean {
  return balance > 0.005 && balance < SMALL_BALANCE_WRITE_OFF_MAX;
}

/**
 * Post the 'adjustment' credit that settles a small balance. Returns false
 * (after logging) if the insert failed — callers still skip the balance
 * reminder either way, so a failed write-off is retried by the next run
 * rather than turning into a dunning email over pocket change.
 */
export async function writeOffSmallBalance(
  supabase: ChargeCapableClient,
  tenancyId: string,
  balance: number,
  todayIso: string,
): Promise<boolean> {
  const { error } = await supabase.from("tenancy_charges").insert({
    tenancy_id: tenancyId,
    kind: "adjustment",
    amount: Math.round(balance * 100) / 100,
    charged_on: todayIso,
    note: `Small balance write-off (under $${SMALL_BALANCE_WRITE_OFF_MAX})`,
  });
  if (error) {
    console.error(
      "[small-balance] write-off failed:",
      tenancyId,
      error.message,
    );
    return false;
  }
  return true;
}
