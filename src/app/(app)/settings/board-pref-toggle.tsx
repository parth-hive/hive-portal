"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setBoardEmailPref } from "../projects/actions";

/** Per-user email toggle for Projects board notifications. */
export function BoardPrefToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm text-ink">Project email notifications</span>
        <span className="block text-xs text-muted">
          Assignments, reviews, comments, nudges, and deadline reminders from
          the Projects tab.
        </span>
      </span>
      <input
        type="checkbox"
        checked={enabled}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setEnabled(next);
          startTransition(async () => {
            const r = await setBoardEmailPref(next);
            if (r?.error) {
              setEnabled(!next);
              toast.error(r.error);
            } else if (r?.success) {
              toast.success(r.success);
            }
          });
        }}
        className="h-5 w-9 accent-accent"
      />
    </label>
  );
}
