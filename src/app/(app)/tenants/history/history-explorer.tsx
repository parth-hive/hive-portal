"use client";

import { useMemo } from "react";
import { useDeferredParam, useUrlParamState } from "@/lib/use-url-param";
import {
  HistoryGroups,
  type HistoryGroup,
  type HistoryRow,
} from "./history-groups";

export type { HistoryRow };

/** All / With-balance pills, backed by ?bal= in the URL (shallow, no server). */
export function BalanceToggle({ owingCount }: { owingCount: number }) {
  const [bal, setBal] = useUrlParamState("bal");
  const balanceOnly = bal === "1";
  return (
    <div className="flex shrink-0 gap-1.5">
      <button
        type="button"
        onClick={() => setBal("")}
        className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition ${
          balanceOnly
            ? "border border-stone bg-white text-muted hover:bg-warm hover:text-ink"
            : "bg-ink text-white"
        }`}
      >
        All
      </button>
      <button
        type="button"
        onClick={() => setBal("1")}
        className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition ${
          balanceOnly
            ? "bg-ink text-white"
            : "border border-stone bg-white text-muted hover:bg-warm hover:text-ink"
        }`}
      >
        With balance ({owingCount})
      </button>
    </div>
  );
}

/** Client-side filter over the full move-out history, grouped by property in
 *  the Rent Tracker's style — retired ("deleted") properties included, each
 *  past tenant under their unit. Reads ?q= and ?bal= from the URL, so typing
 *  re-filters instantly with zero server round trips. */
export function HistoryExplorer({
  rows,
  admin,
  canUndismiss,
}: {
  rows: HistoryRow[];
  admin: boolean;
  canUndismiss: boolean;
}) {
  const query = useDeferredParam("q").trim().toLowerCase();
  const balanceOnly = useDeferredParam("bal") === "1";

  const groups: HistoryGroup[] = useMemo(() => {
    const visible = rows.filter((r) => {
      if (balanceOnly && r.balance <= 0.005) return false;
      if (!query) return true;
      return r.haystack.includes(query);
    });

    const map = new Map<string, HistoryGroup>();
    for (const r of visible) {
      let g = map.get(r.groupLabel);
      if (!g) {
        g = {
          label: r.groupLabel,
          propertyId: r.propertyId,
          archived: r.archived,
          rows: [],
          subBalance: 0,
          subPaid: 0,
        };
        map.set(r.groupLabel, g);
      }
      g.rows.push(r);
      g.subBalance += r.balance;
      g.subPaid += r.total_paid;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.label === "Unassigned"
        ? 1
        : b.label === "Unassigned"
          ? -1
          : a.label.localeCompare(b.label),
    );
    // Rows keep the server's most-recent-move-out-first order within groups.
  }, [rows, balanceOnly, query]);

  if (groups.length === 0) {
    return (
      <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
        {balanceOnly && !query
          ? "No past tenants owe anything."
          : query
            ? `No history entries match “${query}”.`
            : "No move-outs yet."}
      </p>
    );
  }

  return (
    // key forces a remount when the filter toggles so the expand/collapse
    // state re-initializes (collapsed by default, expanded when owing-only) —
    // same interaction as the Rent Tracker.
    <HistoryGroups
      key={balanceOnly ? "owing" : "all"}
      groups={groups}
      admin={admin}
      canUndismiss={canUndismiss}
      defaultExpanded={balanceOnly}
    />
  );
}
