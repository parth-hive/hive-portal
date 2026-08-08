import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isOperator } from "@/lib/access";
import { TenantsApiDocs } from "@/components/docs/tenants-api-docs";
import { InventoryApiDocs } from "@/components/docs/inventory-api-docs";

export const metadata = {
  title: "Developers — Hive Portal",
};

/**
 * Operator-only API reference hub: the tenant contact API (built for the
 * automated text-responder) and the inventory API. Content components live
 * in src/components/docs/ and are shared with the public docs site.
 */
export default async function DevelopersPage() {
  const user = await getSessionUser();
  if (!isOperator(user?.email)) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="border-b border-stone/60 pb-4">
        <h1 className="text-3xl tracking-tight text-ink">
          <span className="font-display text-accent-text">Developers</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Read-only JSON APIs for internal tools and scripts. Keys live in the
          server environment (<code className="font-mono">TENANTS_API_KEY</code>,{" "}
          <code className="font-mono">INVENTORY_API_KEY</code>) and are never
          shown here — each API has its own key so tokens can be shared
          independently.
        </p>
      </header>

      <h2 className="mt-10 text-2xl tracking-tight text-ink">
        Tenants <span className="font-display text-accent-text">API</span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        Tenant contact info — name, email, phone, unit, room — for active
        tenancies. Returns PII; its key is separate from the inventory
        key on purpose.
      </p>
      <TenantsApiDocs />

      <h2 className="mt-14 text-2xl tracking-tight text-ink">
        Inventory <span className="font-display text-accent-text">API</span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        Rooms currently in inventory with core listing data (no tenant data).
        Also documented publicly at{" "}
        <Link
          href="/docs/inventory-api"
          className="text-accent-text underline decoration-accent/40 underline-offset-2 hover:text-accent-dark"
        >
          /docs/inventory-api
        </Link>
        .
      </p>
      <InventoryApiDocs />
    </div>
  );
}
