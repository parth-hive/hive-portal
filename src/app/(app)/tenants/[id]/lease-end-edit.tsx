"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTenancyLeaseEndDate } from "../actions";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Inline editor for a tenancy's informational lease end date. */
export function LeaseEndEdit({
  tenancyId,
  tenantId,
  value,
}: {
  tenancyId: string;
  tenantId: string;
  value: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function commit(next: string) {
    startTransition(async () => {
      await setTenancyLeaseEndDate(tenancyId, tenantId, next || null);
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={value ?? ""}
        disabled={pending}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value);
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className="rounded-lg border border-accent bg-white px-2 py-1 text-sm text-ink focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`rounded px-1.5 py-0.5 text-left text-ink hover:bg-warm/60 focus:outline-none focus:ring-1 focus:ring-accent ${
        pending ? "opacity-60" : ""
      }`}
    >
      {value ? (
        fmtDate(value)
      ) : (
        <span className="text-accent-text">+ Set date</span>
      )}
    </button>
  );
}
