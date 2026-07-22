"use client";

import { useActionState, useState } from "react";
import { addManualBill, type UploadState } from "./actions";
import { useFormToast } from "@/components/use-form-toast";
import type { UnitOpt } from "./bill-utils";

const TYPE_OPTIONS = [
  ["electric", "Electric"],
  ["gas", "Gas"],
  ["water", "Water"],
  ["internet", "Internet"],
  ["trash", "Trash"],
  ["other", "Other"],
] as const;

const fieldInput =
  "rounded-lg border border-stone bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const fieldLabel = "text-xs font-medium uppercase tracking-wide text-muted";

/**
 * Manual bill entry — for providers whose statements the extractor can't
 * read, or when only a screenshot exists. The screenshot is stored as the
 * bill's statement, same bucket and viewer as extracted uploads.
 */
export function ManualBillForm({ units }: { units: UnitOpt[] }) {
  const [open, setOpen] = useState(false);
  // Bumped after each successful save so the remounted form starts blank.
  const [resetKey, setResetKey] = useState(0);
  const [state, action, pending] = useActionState<UploadState, FormData>(
    async (prev, formData) => {
      const result = await addManualBill(prev, formData);
      if (result?.success) {
        setResetKey((k) => k + 1);
        setOpen(false);
      }
      return result;
    },
    undefined,
  );
  useFormToast({ pending, state, successMessage: "Bill logged" });

  if (!open) {
    return (
      <p className="mt-2 text-center text-xs text-muted">
        Statement won&apos;t scan?{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-accent-text hover:underline"
        >
          Enter a bill manually
        </button>
      </p>
    );
  }

  return (
    <form
      key={resetKey}
      action={action}
      className="mt-3 rounded-2xl bg-white p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Enter a bill manually
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs uppercase tracking-wide text-muted hover:text-accent-text"
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Unit</span>
          <select name="property_id" required defaultValue="" className={fieldInput}>
            <option value="" disabled>
              Pick a unit…
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Utility type</span>
          <select name="utility_type" required defaultValue="" className={fieldInput}>
            <option value="" disabled>
              Pick a type…
            </option>
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Billing period start</span>
          <input type="date" name="period_start" required className={fieldInput} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Billing period end</span>
          <input type="date" name="period_end" required className={fieldInput} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Amount</span>
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="$123.45"
            className={fieldInput}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Bill screenshot</span>
          <input
            type="file"
            name="screenshot"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-warm file:px-3 file:py-2 file:text-sm file:text-ink hover:file:bg-stone/40"
          />
          <span className="text-xs text-muted">
            Stored as the bill&apos;s statement — PDF or photo, up to 20 MB.
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Log bill"}
      </button>
    </form>
  );
}
