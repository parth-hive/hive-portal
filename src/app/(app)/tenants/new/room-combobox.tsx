"use client";

import { useMemo, useRef, useState } from "react";

type RoomOption = {
  id: string;
  label: string;
  total_rent: number | null;
};

function optionText(r: RoomOption) {
  return r.total_rent
    ? `${r.label} — $${r.total_rent.toLocaleString()}`
    : r.label;
}

// Searchable room picker: a text input that filters the room list, with a
// hidden room_id input carrying the actual selection to the server action.
export function RoomCombobox({
  rooms,
  defaultRoomId = "",
  name = "room_id",
}: {
  rooms: RoomOption[];
  defaultRoomId?: string;
  name?: string;
}) {
  const initial = rooms.find((r) => r.id === defaultRoomId) ?? null;
  const [query, setQuery] = useState(initial ? optionText(initial) : "");
  const [roomId, setRoomId] = useState(initial?.id ?? "");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    // Once a room is picked the input holds its full label; don't filter on
    // it or the list would collapse to one entry when the user reopens it.
    if (roomId || tokens.length === 0) return rooms;
    return rooms.filter((r) => {
      const hay = optionText(r).toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [rooms, query, roomId]);

  const select = (r: RoomOption | null) => {
    setRoomId(r?.id ?? "");
    setQuery(r ? optionText(r) : "");
    setOpen(false);
  };

  return (
    <div className="relative">
      <input type="hidden" name={name} value={roomId} />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={
          rooms.length ? "Search by building, address, or room…" : "— none —"
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setRoomId(""); // typing invalidates the previous pick
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          // Leaving the field with free text and no pick = no room.
          if (!roomId) setQuery("");
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
            select(filtered[highlighted] ?? null);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-stone bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
      {roomId && (
        <button
          type="button"
          aria-label="Clear room"
          onClick={() => select(null)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-sm text-muted hover:text-ink"
        >
          ×
        </button>
      )}
      {open && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-stone bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No matching rooms.</li>
          )}
          {filtered.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                // mousedown, not click: fires before the input's blur closes
                // the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(r);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full px-3 py-2 text-left text-sm ${
                  i === highlighted
                    ? "bg-accent/10 text-ink"
                    : "text-ink hover:bg-warm"
                }`}
              >
                {optionText(r)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
