import { InventoryApiDocs } from "@/components/docs/inventory-api-docs";

export const metadata = {
  title: "Inventory API — Hive",
  description:
    "Read-only JSON API for Hive's current room inventory: authentication, endpoints, and response shapes.",
};

/**
 * Public reference for the read-only inventory API
 * (`GET /api/inventory`, `GET /api/inventory/[roomId]`). No login required —
 * "/docs" is whitelisted in src/lib/supabase/proxy.ts. The content itself is
 * shared with the portal's Developers tab (/developers).
 */
export default function InventoryApiDocsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="border-b border-stone/60 pb-4">
        <p className="text-xs uppercase tracking-wide text-muted">
          Hive / API reference
        </p>
        <h1 className="mt-1 text-3xl tracking-tight text-ink">
          <span className="font-display text-accent-text">Inventory API</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Read-only JSON API over Hive&apos;s current room inventory — rooms
          available now, or occupied with a scheduled move-out — with core
          listing data only. Tenant names, ads, and listing actions are never
          included.
        </p>
      </header>
      <InventoryApiDocs />
    </div>
  );
}
