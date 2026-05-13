"use client";

import { deleteRun } from "../actions";

export function DeleteRunButton({ id, label }: { id: string; label: string }) {
  return (
    <form action={deleteRun}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={(e) => {
          if (
            !confirm(
              `Delete the ${label} reconciliation run? Payments created by this run will also be removed. This cannot be undone.`,
            )
          ) {
            e.preventDefault();
          }
        }}
        className="text-xs uppercase tracking-wide text-muted hover:text-red-700"
      >
        Delete run
      </button>
    </form>
  );
}
