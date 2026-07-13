"use client";

import { useId, useMemo, useState } from "react";

export type SelectOption = { id: string; label: string };

/**
 * Searchable dropdown: a text input that word-filters the option list, with
 * the actual selection reported through onSelect. Options with special ids
 * (e.g. "" for "all") are pinned and always shown.
 */
export function SearchableSelect({
  options,
  pinned = [],
  value,
  onSelect,
  placeholder = "Search…",
  disabled = false,
  className = "",
}: {
  options: SelectOption[];
  /** Always-visible entries shown above the filtered list (All, None, …). */
  pinned?: SelectOption[];
  value: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected =
    [...pinned, ...options].find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listId = useId();

  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches =
      tokens.length === 0
        ? options
        : options.filter((o) => {
            const hay = o.label.toLowerCase();
            return tokens.every((t) => hay.includes(t));
          });
    return [...(tokens.length === 0 ? pinned : []), ...matches];
  }, [options, pinned, query]);

  const choose = (o: SelectOption) => {
    onSelect(o.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : selected?.label ?? ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (filtered[highlighted]) choose(filtered[highlighted]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-stone bg-white px-3 py-1.5 text-sm text-ink placeholder:text-ink focus:border-accent focus:outline-none disabled:opacity-50"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-lg border border-stone bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No matches.</li>
          )}
          {filtered.map((o, i) => (
            <li key={o.id || `pinned-${o.label}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // mousedown, not click: fires before the input's blur.
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full px-3 py-1.5 text-left text-sm ${
                  i === highlighted ? "bg-accent/10 text-ink" : "text-ink hover:bg-warm"
                } ${o.id === value ? "font-medium" : ""}`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
