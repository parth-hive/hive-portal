/**
 * Brand-aligned skeleton pieces for in-page <Suspense> fallbacks, so page
 * chrome paints instantly while data sections stream in. Same cream/warm
 * palette and animate-pulse treatment as PageLoader, which composes these.
 */

export function KpiRowSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div
      className={`grid animate-pulse gap-4 ${cards === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="h-3 w-24 rounded bg-warm/70" />
          <div className="mt-3 h-7 w-20 rounded-lg bg-warm" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-11 bg-warm/40" />
      <div className="divide-y divide-stone/20">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="h-4 flex-1 rounded bg-warm/80" />
            <div className="hidden h-4 w-24 rounded bg-warm/60 sm:block" />
            <div className="h-4 w-16 rounded bg-warm/60" />
            <div className="h-4 w-16 rounded bg-warm/60" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl bg-white p-5 shadow-sm"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-4 w-40 rounded bg-warm" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-warm/60" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
