"use client";

import { useSearchParams } from "next/navigation";
import { useSetUrlParams } from "@/lib/use-url-param";

/**
 * Sort control shown only while the "Balance due only" filter is active
 * (it renders nothing otherwise, so the page can mount it unconditionally).
 * Cycles ?sort= through balance high→low, low→high, and off (property
 * order); written shallowly — the TenantsExplorer re-sorts client-side.
 */
export function BalanceSort() {
  const searchParams = useSearchParams();
  const setParams = useSetUrlParams();
  const sort = searchParams.get("sort");
  const active = sort === "balance_desc" || sort === "balance_asc";

  if (searchParams.get("owing") !== "1") return null;

  function cycle() {
    if (sort === "balance_desc") {
      setParams({ sort: "balance_asc" });
    } else if (sort === "balance_asc") {
      setParams({ sort: null });
    } else {
      setParams({ sort: "balance_desc" });
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm shadow-sm transition ${
        active
          ? "border-accent bg-accent text-white hover:bg-accent-dark"
          : "border-stone bg-white text-ink hover:bg-warm"
      }`}
    >
      {sort === "balance_desc"
        ? "Balance: high → low"
        : sort === "balance_asc"
          ? "Balance: low → high"
          : "Sort by balance"}
    </button>
  );
}
