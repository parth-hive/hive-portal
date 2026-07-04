"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTenancyRentAmount } from "../actions";

/** Inline editor for a tenancy's monthly or prorated-first-month rent. */
export function RentAmountEdit({
  field,
  tenancyId,
  tenantId,
  value,
}: {
  field: "monthly_rent" | "first_month_rent";
  tenancyId: string;
  tenantId: string;
  value: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  // Monthly rent is required; the prorated amount may be cleared, which
  // means the starting month is charged the full monthly rent.
  const clearable = field === "first_month_rent";

  function commit(next: string) {
    const raw = next.trim();
    if (!clearable && raw === "") {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await setTenancyRentAmount(
        tenancyId,
        tenantId,
        field,
        raw === "" ? null : raw,
      );
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        type="number"
        min="0"
        step="1"
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
        className="w-28 rounded-lg border border-accent bg-white px-2 py-1 text-sm text-ink focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`-mx-1.5 -my-0.5 rounded px-1.5 py-0.5 text-left text-ink hover:bg-warm/60 focus:outline-none focus:ring-1 focus:ring-accent ${
        pending ? "opacity-60" : ""
      }`}
    >
      {value !== null ? (
        `$${Number(value).toLocaleString()}`
      ) : (
        <span className="text-accent-text">+ Set amount</span>
      )}
    </button>
  );
}
