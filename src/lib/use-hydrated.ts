"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * False during SSR and the hydration render, true on the client afterwards.
 * The lint-clean replacement for the `useEffect(() => setMounted(true), [])`
 * pattern — used to gate portals and other client-only rendering.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
