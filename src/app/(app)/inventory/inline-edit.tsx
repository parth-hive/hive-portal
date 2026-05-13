"use client";

import { useState, useTransition } from "react";
import { setRoomAvailableFrom, setRoomTotalRent } from "./actions";

function fmtMoney(n: number | null) {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toLocaleString()}`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  const ten = s.slice(0, 10);
  const [y, m, d] = ten.split("-");
  if (!y || !m || !d) return s;
  return `${m}/${d}/${y.slice(2)}`;
}

const cellButton =
  "w-full rounded px-1.5 py-0.5 text-left hover:bg-warm/60 focus:outline-none focus:ring-1 focus:ring-accent";

export function InlineRentEdit({
  roomId,
  totalRent,
}: {
  roomId: string;
  totalRent: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${cellButton} text-right tabular-nums text-ink ${pending ? "opacity-60" : ""}`}
      >
        {fmtMoney(totalRent)}
      </button>
    );
  }

  const commit = (value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await setRoomTotalRent(roomId, n);
      setEditing(false);
    });
  };

  return (
    <input
      type="number"
      min={0}
      step={1}
      autoFocus
      defaultValue={totalRent ?? ""}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          setEditing(false);
        }
      }}
      className="w-24 rounded border border-accent bg-white px-1.5 py-0.5 text-right tabular-nums text-ink focus:outline-none"
    />
  );
}

export function InlineDateEdit({
  roomId,
  date,
}: {
  roomId: string;
  date: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${cellButton} tabular-nums text-ink ${pending ? "opacity-60" : ""}`}
      >
        {fmtDate(date)}
      </button>
    );
  }

  const commit = (value: string) => {
    startTransition(async () => {
      await setRoomAvailableFrom(roomId, value || null);
      setEditing(false);
    });
  };

  return (
    <input
      type="date"
      autoFocus
      defaultValue={date?.slice(0, 10) ?? ""}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          setEditing(false);
        }
      }}
      className="w-36 rounded border border-accent bg-white px-1.5 py-0.5 tabular-nums text-ink focus:outline-none"
    />
  );
}
