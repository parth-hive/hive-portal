"use client";

import { useSearchParams } from "next/navigation";
import { useSetUrlParams } from "@/lib/use-url-param";

/**
 * Pill toggle that filters the tenant list down to tenancies with an
 * outstanding balance. Writes ?owing=1 shallowly — the TenantsExplorer reads
 * it and re-filters client-side, no server round trip. Preserves ?q=.
 */
export function BalanceFilter() {
  const searchParams = useSearchParams();
  const setParams = useSetUrlParams();
  const active = searchParams.get("owing") === "1";

  function toggle() {
    // The balance sort only exists inside the owing view.
    setParams(active ? { owing: null, sort: null } : { owing: "1" });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm shadow-sm transition ${
        active
          ? "border-accent bg-accent text-white hover:bg-accent-dark"
          : "border-stone bg-white text-ink hover:bg-warm"
      }`}
    >
      {active ? "✓ " : ""}Balance due only
    </button>
  );
}
