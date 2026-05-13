"use client";

import { useTransition } from "react";
import { setListingAction } from "./actions";
import {
  ACTION_LABELS,
  ACTION_ORDER,
  ACTION_PILL,
  type Action,
} from "./constants";

export function ListingActionSelector({
  roomId,
  current,
}: {
  roomId: string;
  current: Action;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Action;
        startTransition(async () => {
          await setListingAction(roomId, next);
        });
      }}
      className={`cursor-pointer appearance-none rounded-full border px-3 py-1 pr-7 text-xs font-medium uppercase tracking-wide transition disabled:opacity-60 ${ACTION_PILL[current]}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='currentColor' stroke-width='1.5'%3E%3Cpath d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.5rem center",
        backgroundSize: "0.6rem",
      }}
    >
      {ACTION_ORDER.map((a) => (
        <option key={a} value={a}>
          {ACTION_LABELS[a]}
        </option>
      ))}
    </select>
  );
}
