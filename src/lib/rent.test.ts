import { describe, expect, it } from "vitest";
import {
  buildLedgerEntries,
  computeLedger,
  rateForMonthISO,
  type LedgerTenancy,
} from "@/lib/rent";

const tenancy = (overrides: Partial<LedgerTenancy> = {}): LedgerTenancy => ({
  start_date: "2026-06-01",
  move_out_date: null,
  monthly_rent: 1_325,
  first_month_rent: null,
  security_deposit: null,
  ...overrides,
});

describe("rent ledger financial controls", () => {
  it("does not bill a tenancy before its actual start date", () => {
    const ledger = computeLedger(
      tenancy({ start_date: "2026-07-20" }),
      [],
      [],
      [],
      "2026-07-15",
    );

    expect(ledger.rent.owed).toBe(0);
    expect(ledger.netBalance).toBe(0);
    expect(
      buildLedgerEntries(
        tenancy({ start_date: "2026-07-20" }),
        [],
        [],
        "2026-07-15",
      ),
    ).toEqual([]);
  });

  it("keeps future-dated payments and charges out until their date", () => {
    const ledger = computeLedger(
      tenancy(),
      [
        { amount: 1_325, paid_on: "2026-06-05", payment_type: "rent" },
        { amount: 1_325, paid_on: "2026-07-20", payment_type: "rent" },
      ],
      [
        { kind: "late_fee", amount: 50, charged_on: "2026-07-10" },
        { kind: "other", amount: 99, charged_on: "2026-07-20" },
      ],
      [],
      "2026-07-15",
    );

    expect(ledger.rent.owed).toBe(2_650);
    expect(ledger.rent.paid).toBe(1_325);
    expect(ledger.lateFee.owed).toBe(50);
    expect(ledger.other.owed).toBe(0);
    expect(ledger.netBalance).toBe(1_375);
  });

  it("nets refunds against collected cash and shows them as ledger debits", () => {
    const ledger = computeLedger(
      tenancy(),
      [
        { amount: 1_325, paid_on: "2026-06-05", payment_type: "rent" },
        { amount: 200, paid_on: "2026-06-10", payment_type: "refund" },
      ],
      [],
      [],
      "2026-06-30",
    );
    expect(ledger.netBalance).toBe(200);

    const entries = buildLedgerEntries(
      tenancy(),
      [
        {
          id: "rent-payment",
          amount: 1_325,
          paid_on: "2026-06-05",
          payment_type: "rent",
          notes: null,
        },
        {
          id: "refund",
          amount: 200,
          paid_on: "2026-06-10",
          payment_type: "refund",
          notes: null,
        },
      ],
      [],
      "2026-06-30",
    );
    expect(entries.at(-1)).toMatchObject({
      id: "refund",
      charge: 200,
      payment: 0,
      balance: 200,
    });
  });

  it("uses the rate effective in each month without repricing history", () => {
    const changes = [
      { effective_month: "2026-06-01", monthly_rent: 1_325 },
      { effective_month: "2026-08-01", monthly_rent: 1_400 },
    ];

    expect(rateForMonthISO("2026-07-01", 1_400, changes)).toBe(1_325);
    expect(rateForMonthISO("2026-08-01", 1_400, changes)).toBe(1_400);
    expect(
      computeLedger(
        tenancy({ monthly_rent: 1_400 }),
        [],
        [],
        [],
        "2026-08-31",
        changes,
      ).rent.owed,
    ).toBe(4_050);
  });

  it("rounds settled ledgers to exact cents", () => {
    const ledger = computeLedger(
      tenancy({ monthly_rent: 1_325 }),
      [
        { amount: 726.61, paid_on: "2026-06-01", payment_type: "rent" },
        { amount: 598.39, paid_on: "2026-06-02", payment_type: "rent" },
      ],
      [],
      [],
      "2026-06-30",
    );
    expect(ledger.netBalance).toBe(0);
  });
});
