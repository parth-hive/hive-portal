"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * URL-backed filter state written shallowly via history.replaceState, so
 * updating it never triggers a server render. Next syncs useSearchParams
 * with native history calls, which lets other client components on the page
 * read the same param and re-filter instantly.
 */
export function useUrlParamState(
  key: string,
  opts?: { debounceMs?: number },
): [string, (next: string) => void] {
  const debounceMs = opts?.debounceMs ?? 0;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(key) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const write = useCallback(
    (next: string) => {
      const params = new URLSearchParams(window.location.search);
      const trimmed = next.trim();
      if (trimmed === "") {
        params.delete(key);
      } else {
        params.set(key, trimmed);
      }
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [key, pathname],
  );

  const set = useCallback(
    (next: string) => {
      setValue(next);
      if (timer.current) clearTimeout(timer.current);
      if (debounceMs > 0) {
        timer.current = setTimeout(() => write(next), debounceMs);
      } else {
        write(next);
      }
    },
    [debounceMs, write],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return [value, set];
}

/**
 * Shallow multi-param writer for toggle/sort controls that read their active
 * state straight from useSearchParams. Pass null/"" to delete a param.
 */
export function useSetUrlParams(): (
  updates: Record<string, string | null>,
) => void {
  const pathname = usePathname();
  return useCallback(
    (updates) => {
      const params = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );
}

/** Deferred read of a URL param, for components that filter big lists by it. */
export function useDeferredParam(key: string): string {
  const searchParams = useSearchParams();
  return useDeferredValue(searchParams.get(key) ?? "");
}
