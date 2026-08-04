/**
 * Brand-aligned skeleton shown instantly on every in-app navigation (via the
 * shared `(app)/loading.tsx` Suspense boundary) while the server page streams
 * in. Mirrors the common page shape — header, a row of stat cards, and a table
 * block — so it reads as the real screen warming up rather than a blank wait.
 *
 * Uses Tailwind's built-in `animate-pulse` and the cream/warm palette so it
 * blends with the surrounding shell.
 */
import { KpiRowSkeleton, TableSkeleton } from "./section-skeletons";

export function PageLoader() {
  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {/* Header: title + subtitle, with a primary-action chip on the right. */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone/40 pb-6">
        <div className="space-y-3">
          <div className="h-7 w-56 rounded-lg bg-warm" />
          <div className="h-3 w-72 max-w-full rounded bg-warm/70" />
        </div>
        <div className="h-9 w-28 rounded-full bg-warm" />
      </div>

      <div className="mt-6">
        <KpiRowSkeleton />
      </div>

      <div className="mt-6">
        <TableSkeleton />
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
