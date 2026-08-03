"use client";

import { useState } from "react";

// Amenities shown before collapsing behind "+N more". Keeps every row the
// same height until the user explicitly expands one.
const COLLAPSED_COUNT = 3;

/** Comma-separated amenity list for an inventory row. Collapsed rows show
 *  the first few on one line; "+N more" expands the cell (and the row) in
 *  place. Rendered inside the InlineAmenitiesEdit trigger button, so the
 *  toggle stops propagation to avoid opening the editor. */
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
      className={`mx-auto block max-w-[20rem] text-center text-xs text-ink ${
        expanded ? "whitespace-normal py-1" : "truncate"
      }`}
    >
      {shown.join(", ")}
      {hiddenCount > 0 && (
        <>
          {", "}
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
            className="whitespace-nowrap font-medium text-accent-text transition hover:text-accent-dark"
          >
            {expanded ? "less" : `+${hiddenCount} more`}
          </span>
        </>
      )}
    </span>
  );
}
