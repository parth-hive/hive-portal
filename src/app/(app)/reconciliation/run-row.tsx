"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Makes a whole reconciliation-run table row clickable, navigating to the run.
 * (A server component can't attach onClick, so the row is a thin client wrapper
 * around the cells, which stay rendered on the server.)
 */
export function RunRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer border-t border-stone/40 transition hover:bg-cream/60"
    >
      {children}
    </tr>
  );
}
