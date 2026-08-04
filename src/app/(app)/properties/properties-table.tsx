"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDeferredParam } from "@/lib/use-url-param";

export type PropertyDisplayRow = {
  id: string;
  title: string;
  buildingName: string | null;
  streetAddress: string;
  unitNumber: string;
  neighborhood: string | null;
  totalRooms: number;
  vacantRooms: number;
  leaseholderName: string | null;
  /** Lowercased search haystack, precomputed on the server. */
  haystack: string;
};

export function PropertiesTable({ rows }: { rows: PropertyDisplayRow[] }) {
  const query = useDeferredParam("q").trim().toLowerCase();

  const properties = useMemo(
    () => (query ? rows.filter((p) => p.haystack.includes(query)) : rows),
    [rows, query],
  );

  if (rows.length === 0) {
    return (
      <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
        No properties yet. Click <em>Add property</em> to enter your first unit.
      </p>
    );
  }

  if (properties.length === 0) {
    return (
      <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
        No properties match &ldquo;{query}&rdquo;.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone/40">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="sticky top-0 z-10 bg-warm/60 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Unit</th>
            <th className="px-3 py-2 font-medium">Neighborhood</th>
            <th className="px-3 py-2 text-right font-medium">Rooms</th>
            <th className="px-3 py-2 text-right font-medium">Vacant</th>
            <th className="px-3 py-2 font-medium">Leaseholder</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p, i) => (
            <tr
              key={p.id}
              className={`border-t border-stone/30 ${i % 2 === 1 ? "bg-cream/40" : "bg-white"} hover:bg-warm/30`}
            >
              <td className="px-3 py-2.5">
                <Link
                  href={`/properties/${p.id}`}
                  className="text-ink hover:text-accent-text"
                >
                  {p.title}{" "}
                  <span className="text-muted">Apt {p.unitNumber}</span>
                </Link>
                {p.buildingName && (
                  <div className="text-xs text-muted">{p.streetAddress}</div>
                )}
              </td>
              <td className="px-3 py-2.5 text-ink">
                {p.neighborhood ?? <span className="text-muted">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                {p.totalRooms}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {p.vacantRooms > 0 ? (
                  <span className="text-accent-text">{p.vacantRooms}</span>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-ink">
                {p.leaseholderName ?? <span className="text-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
