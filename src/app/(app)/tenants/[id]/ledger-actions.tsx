"use client";

import { useState, type ReactNode } from "react";
import { ChargeForm } from "./record-charge";
import { PaymentForm } from "./record-payment";

type OpenForm = "charge" | "payment" | null;

/**
 * The Ledger section header: title (server-rendered, passed as `heading`)
 * plus a stable action toolbar. The buttons never move — the open form
 * renders full-width BELOW the header, one at a time, so nothing floats
 * mid-header the way the old swap-the-button-for-the-form layout did.
 */
export function LedgerActions({
  heading,
  exportHref,
  tenancyId,
  tenantId,
  defaultAmount,
  canAddCharge,
}: {
  heading: ReactNode;
  exportHref: string;
  tenancyId: string;
  tenantId: string;
  defaultAmount: number;
  canAddCharge: boolean;
}) {
  const [open, setOpen] = useState<OpenForm>(null);
  const toggle = (form: Exclude<OpenForm, null>) =>
    setOpen((o) => (o === form ? null : form));
  const close = () => setOpen(null);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        {heading}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={exportHref}
            className="rounded-full border border-stone bg-white px-3 py-1.5 text-xs uppercase tracking-wide text-ink hover:bg-warm"
          >
            Download ledger ↓
          </a>
          {canAddCharge && (
            <button
              type="button"
              onClick={() => toggle("charge")}
              aria-expanded={open === "charge"}
              className={`rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition ${
                open === "charge"
                  ? "border-accent bg-warm text-ink"
                  : "border-stone bg-white text-ink hover:bg-warm"
              }`}
            >
              Add charge
            </button>
          )}
          <button
            type="button"
            onClick={() => toggle("payment")}
            aria-expanded={open === "payment"}
            className={`rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm transition ${
              open === "payment"
                ? "bg-accent-dark"
                : "bg-ink hover:bg-accent-dark"
            }`}
          >
            Record payment
          </button>
        </div>
      </header>

      {open === "charge" && (
        <div className="mt-4">
          <ChargeForm
            tenancyId={tenancyId}
            tenantId={tenantId}
            onClose={close}
          />
        </div>
      )}
      {open === "payment" && (
        <div className="mt-4">
          <PaymentForm
            tenancyId={tenancyId}
            tenantId={tenantId}
            defaultAmount={defaultAmount}
            onClose={close}
          />
        </div>
      )}
    </>
  );
}
