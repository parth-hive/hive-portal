"use client";

import { useUrlParamState } from "@/lib/use-url-param";

/**
 * Debounced search input backed by ?q= in the URL, written shallowly via
 * history.replaceState — typing never triggers a server round trip. Client
 * components on the same page read the param (useDeferredParam) and filter
 * their already-loaded rows.
 */
export function SearchInput({
  placeholder,
  ariaLabel,
}: {
  placeholder: string;
  ariaLabel: string;
}) {
  const [value, setValue] = useUrlParamState("q", { debounceMs: 150 });

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
