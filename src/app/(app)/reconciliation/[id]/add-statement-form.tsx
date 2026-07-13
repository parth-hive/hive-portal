"use client";

import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";
import { addStatementToRun, type AddStatementState } from "../actions";

/**
 * "Add statement" disclosure: pick another bank export (an overlapping or
 * later download, a second account) and its deposits are appended to this
 * run — rows the run already has are skipped — then the matches re-derive.
 * On an already-posted run the new matched deposits post to the ledger
 * immediately. Sits with the header actions; collapsed by default.
 */
export function AddStatementForm({
  runId,
  posted = false,
}: {
  runId: string;
  posted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // The wrapper toasts the outcome and closes on success inside the action
  // dispatch itself, instead of watching pending/state from an effect.
  const [, action, pending] = useActionState<AddStatementState, FormData>(
    async (prev, formData) => {
      const result = await addStatementToRun(prev, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(result?.success ?? "Statement added");
        formRef.current?.reset();
        setOpen(false);
      }
      return result;
    },
    undefined,
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full border border-stone bg-white px-4 py-2 text-sm text-ink shadow-sm hover:bg-warm"
      >
        {open ? "× Cancel" : "+ Add statement"}
      </button>
      {open && (
        <form
          ref={formRef}
          action={action}
          className="absolute right-0 top-full z-30 mt-2 flex w-80 flex-col gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-stone/40"
        >
          <input type="hidden" name="run_id" value={runId} />
          <p className="text-xs text-muted">
            Upload another bank export for this run. Deposits already in the
            run are skipped, everything else is matched in.
            {posted &&
              " This run is posted, so new matched deposits go straight to the ledger."}
          </p>
          <input
            type="file"
            name="bank_statement"
            required
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="rounded-lg border border-stone bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-accent-dark"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-50"
          >
            {pending ? "Matching…" : "Add & re-match"}
          </button>
        </form>
      )}
    </div>
  );
}
