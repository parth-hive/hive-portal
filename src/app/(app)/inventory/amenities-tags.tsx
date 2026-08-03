"use client";

import { useState } from "react";

// Chips shown before collapsing behind "+N more". Keeps every row the same
// height until the user explicitly expands one.
const COLLAPSED_COUNT = 3;

/** Amenity chips for an inventory row. Collapsed rows show the first few
 *  chips on one line; "+N more" expands the cell (and the row) in place.
 *  Rendered inside the InlineAmenitiesEdit trigger button, so the toggle
 *  stops propagation to avoid opening the editor. */
export function AmenitiesTags({ tags }: { tags: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (tags.length === 0) {
    return <span className="text-xs text-muted">—</span>;
  }

  const shown = expanded ? tags : tags.slice(0, COLLAPSED_COUNT);
  const hiddenCount = tags.length - COLLAPSED_COUNT;

  const toggle = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <span
      className={`mx-auto flex max-w-[20rem] items-center justify-center gap-1 ${
        expanded ? "flex-wrap py-1" : "flex-nowrap overflow-hidden"
      }`}
    >
      {shown.map((t) => (
        <span
          key={t}
          className="whitespace-nowrap rounded-full bg-warm/70 px-2 py-0.5 text-[11px] text-ink"
        >
          {t}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle(e);
            }
          }}
          className="whitespace-nowrap rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-text transition hover:bg-accent/25"
        >
          {expanded ? "less" : `+${hiddenCount} more`}
        </span>
      )}
    </span>
  );
}
