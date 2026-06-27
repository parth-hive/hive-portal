"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveUpcomingDate } from "./actions";

/** Inline-editable upcoming cleaning date. Picking a date saves it (insert or
 *  update); clearing it removes that scheduled cleaning. */
export function EditableDate({
  propertyId,
  recordId,
  date,
  assignedTo,
}: {
  propertyId: string;
  recordId: string | null;
  date: string | null;
  assignedTo: string | null;
}) {
  const [value, setValue] = useState(date ?? "");
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    const fd = new FormData();
    fd.set("property_id", propertyId);
    if (recordId) fd.set("record_id", recordId);
    fd.set("cleaning_date", next);
    if (assignedTo) fd.set("assigned_to", assignedTo);
    startTransition(async () => {
      const r = await saveUpcomingDate(fd);
      if (r?.error) {
        toast.error(r.error);
        setValue(date ?? ""); // revert on failure
      } else {
        toast.success(next ? "Date saved" : "Date cleared");
      }
    });
  }

  return (
    <input
      type="date"
      value={value}
      disabled={pending}
      onChange={(e) => {
        setValue(e.target.value);
        save(e.target.value);
      }}
      className="rounded-lg border border-stone bg-white px-2.5 py-1.5 text-sm tabular-nums text-ink focus:border-accent focus:outline-none disabled:opacity-50"
    />
  );
}
