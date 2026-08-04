"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * Debounced search input that round-trips through the server: writes ?q= via
 * router.replace so the server component re-renders and filters its query.
 * Only for pages whose filtering must stay server-side (reconciliation detail,
 * where q composes with ?filter= status sets and export links). Everything
 * else uses SearchInput, which filters client-side with no network.
 */
export function ServerSearchInput({
  placeholder,
  ariaLabel,
}: {
  placeholder: string;
  ariaLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed === "") {
        next.delete("q");
      } else {
        next.set("q", trimmed);
      }
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className="relative block w-full sm:w-80">
      <span className="sr-only">{ariaLabel}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-full border border-stone bg-white px-4 py-2 pl-9 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 -scale-x-100 text-muted"
      >
        ⌕
      </span>
    </label>
  );
}
