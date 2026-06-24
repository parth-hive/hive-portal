"use client";

import { useState, useTransition } from "react";
import {
  setRoomAdUrl,
  setRoomAvailableFrom,
  setRoomBaseRent,
  setRoomPhotosUrl,
  setRoomServicesFee,
} from "./actions";

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

function MoneyCellEditor({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (n: number) => Promise<unknown>;
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
        {fmtMoney(value)}
      </button>
    );
  }

  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await onCommit(n);
      setEditing(false);
    });
  };

  return (
    <input
      type="number"
      min={0}
      step={1}
      autoFocus
      defaultValue={value ?? ""}
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
      className="w-20 rounded border border-accent bg-white px-1.5 py-0.5 text-right tabular-nums text-ink focus:outline-none"
    />
  );
}

export function InlineBaseRentEdit({
  roomId,
  value,
}: {
  roomId: string;
  value: number | null;
}) {
  return (
    <MoneyCellEditor
      value={value}
      onCommit={async (n) => {
        await setRoomBaseRent(roomId, n);
      }}
    />
  );
}

export function InlineServicesEdit({
  roomId,
  value,
}: {
  roomId: string;
  value: number | null;
}) {
  return (
    <MoneyCellEditor
      value={value}
      onCommit={async (n) => {
        await setRoomServicesFee(roomId, n);
      }}
    />
  );
}

export function InlinePhotosEdit({
  roomId,
  url,
}: {
  roomId: string;
  url: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const commit = (value: string) => {
    startTransition(async () => {
      await setRoomPhotosUrl(roomId, value.trim() || null);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <input
        type="url"
        autoFocus
        defaultValue={url ?? ""}
        placeholder="https://drive.google.com/…"
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
        className="w-48 rounded border border-accent bg-white px-1.5 py-0.5 text-[12px] text-ink focus:outline-none"
      />
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${pending ? "opacity-60" : ""}`}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-stone bg-white px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink hover:bg-warm"
        >
          Open ↗
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide text-accent-text hover:bg-warm"
      >
        {url ? "Edit" : "+ Add"}
      </button>
    </div>
  );
}

export function InlineAdEdit({
  roomId,
  url,
}: {
  roomId: string;
  url: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const commit = (value: string) => {
    startTransition(async () => {
      await setRoomAdUrl(roomId, value.trim() || null);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <input
        type="url"
        autoFocus
        defaultValue={url ?? ""}
        placeholder="https://…"
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
        className="w-48 rounded border border-accent bg-white px-1.5 py-0.5 text-[12px] text-ink focus:outline-none"
      />
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${pending ? "opacity-60" : ""}`}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-900 hover:bg-green-200"
        >
          Live ↗
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide text-accent-text hover:bg-warm"
      >
        {url ? "Edit" : "+ Add"}
      </button>
    </div>
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
