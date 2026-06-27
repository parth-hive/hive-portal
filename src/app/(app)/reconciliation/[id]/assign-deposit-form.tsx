"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignUnmatchedDeposit } from "../actions";

export type AssignTenantOption = { tenancyId: string; label: string };

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-");
  return y && m && d ? `${m}/${d}/${y.slice(2)}` : s;
}

/** One unmatched deposit with an inline "assign to tenant" control. Assigning
 *  records the bank's payer name as that tenant's pays_as so it matches now and
 *  on every future statement. */
export function AssignDepositForm({
  runId,
  payerKey,
  label,
  amount,
  date,
  tenants,
}: {
  runId: string;
  payerKey: string;
  label: string;
  amount: number;
  date: string | null;
  tenants: AssignTenantOption[];
}) {
  const [tenancyId, setTenancyId] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = useMemo(
    () => tenants.find((t) => t.tenancyId === tenancyId)?.label ?? "",
    [tenants, tenancyId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => t.label.toLowerCase().includes(q));
  }, [tenants, query]);

  // Close the dropdown when clicking outside the control.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Reset/clamp the highlighted row whenever the filtered list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Keep the highlighted row visible while arrow-keying through a long list.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function pick(t: AssignTenantOption) {
    setTenancyId(t.tenancyId);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault();
        pick(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  function assign() {
    if (!tenancyId) {
      toast.error("Pick a tenant to assign this deposit to.");
      return;
    }
    const fd = new FormData();
    fd.set("run_id", runId);
    fd.set("payer_key", payerKey);
    fd.set("tenancy_id", tenancyId);
    startTransition(async () => {
      const res = await assignUnmatchedDeposit(undefined, fd);
      if (res?.error) toast.error(res.error);
      else toast.success(res?.success ?? "Assigned.");
    });
  }

  const dateLabel = fmtDate(date);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg bg-cream/60 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-ink">{label}</p>
        {dateLabel && <p className="text-xs text-muted">{dateLabel}</p>}
      </div>
      <span className="shrink-0 font-medium text-ink tabular-nums">
        {fmtMoney(amount)}
      </span>
      <div ref={boxRef} className="relative w-[14rem] shrink-0">
        <input
          type="text"
          value={open ? query : selectedLabel}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          disabled={pending}
          placeholder="Assign to…"
          role="combobox"
          aria-expanded={open}
          aria-controls="assign-tenant-list"
          className="w-full rounded-lg border border-stone bg-white px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        {tenancyId && !open && (
          <button
            type="button"
            onClick={() => {
              setTenancyId("");
              setQuery("");
            }}
            disabled={pending}
            aria-label="Clear selection"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            ×
          </button>
        )}
        {open && (
          <ul
            id="assign-tenant-list"
            ref={listRef}
            role="listbox"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-lg border border-stone bg-white py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted">No matches</li>
            ) : (
              filtered.map((t, i) => (
                <li key={t.tenancyId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onClick={() => pick(t)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`block w-full truncate px-2 py-1.5 text-left text-sm text-ink ${
                      i === activeIndex ? "bg-cream" : ""
                    } ${t.tenancyId === tenancyId ? "font-medium" : ""}`}
                  >
                    {t.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={assign}
        disabled={pending || !tenancyId}
        className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-50"
      >
        {pending ? "Assigning…" : "Assign"}
      </button>
    </li>
  );
}
