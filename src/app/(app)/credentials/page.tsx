import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { AddCredential } from "./add-credential";
import {
  CredentialRow,
  type CredentialRowData,
} from "./credential-row";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type PropertyOption,
} from "./constants";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type Category = Database["public"]["Enums"]["credential_category"];

type PropertyRel = {
  building_name: string | null;
  street_address: string;
  unit_number: string;
};

type Row = {
  id: string;
  category: Category;
  service_name: string;
  property_id: string | null;
  username: string | null;
  password: string | null;
  login_url: string | null;
  account_number: string | null;
  owner_label: string | null;
  notes: string | null;
  properties: PropertyRel | PropertyRel[] | null;
};

function propertyLabel(p: PropertyRel) {
  return `${p.building_name?.trim() || p.street_address} Apt ${p.unit_number}`;
}

export default async function CredentialsPage() {
  const supabase = await createClient();

  const [{ data: credentials }, { data: properties }] = await Promise.all([
    supabase
      .from("credentials")
      .select(
        `id, category, service_name, property_id, username, password,
         login_url, account_number, owner_label, notes,
         properties(building_name, street_address, unit_number)`,
      )
      .order("service_name", { ascending: true })
      .returns<Row[]>(),
    supabase
      .from("properties")
      .select("id, building_name, street_address, unit_number")
      .order("street_address", { ascending: true }),
  ]);

  const propertyOptions: PropertyOption[] = (properties ?? []).map((p) => ({
    id: p.id,
    label: `${p.building_name?.trim() || p.street_address} Apt ${p.unit_number}`,
  }));

  const rows: CredentialRowData[] = (credentials ?? []).map((c) => {
    const p = one(c.properties);
    return {
      id: c.id,
      category: c.category,
      service_name: c.service_name,
      property_id: c.property_id,
      property_label: p ? propertyLabel(p) : null,
      username: c.username,
      password: c.password,
      login_url: c.login_url,
      account_number: c.account_number,
      owner_label: c.owner_label,
      notes: c.notes,
    };
  });

  const grouped = new Map<Category, CredentialRowData[]>();
  for (const c of CATEGORY_ORDER) grouped.set(c, []);
  for (const r of rows) grouped.get(r.category)?.push(r);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone/60 pb-6">
        <div>
          <h1 className="text-3xl tracking-tight text-ink">
            <span className="font-display text-accent-text">Credentials</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            All logins and account numbers in one place. Per-property credentials
            also surface on each property&apos;s detail page.
          </p>
        </div>
        <AddCredential properties={propertyOptions} />
      </header>

      {rows.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No credentials yet. Click <em>Add credential</em> to enter one.
        </p>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat} className="mt-10">
            <h2 className="text-xs uppercase tracking-wide text-muted">
              {CATEGORY_LABELS[cat]} ({items.length})
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((c) => (
                <CredentialRow
                  key={c.id}
                  credential={c}
                  properties={propertyOptions}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
