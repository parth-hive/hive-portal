"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

/**
 * Pill toggle that filters the tenant list down to tenancies with an
 * outstanding balance. Writes ?owing=1 to the URL so the server component
 * can read it and filter; preserves any active ?q= search.
 */
export function BalanceFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const active = searchParams.get("owing") === "1";

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (active) {
      next.delete("owing");
    } else {
      next.set("owing", "1");
    }
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
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
