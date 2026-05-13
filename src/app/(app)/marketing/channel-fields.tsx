"use client";

import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  type Platform,
} from "./constants";

type Initial = {
  name?: string | null;
  platform?: Platform;
  url?: string | null;
};

const fieldLabel = "text-xs font-medium uppercase tracking-wide text-muted";
const fieldInput =
  "rounded-lg border border-stone bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

export function ChannelFields({ initial }: { initial?: Initial }) {
  const v = initial ?? {};
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Channel name *</span>
        <input
          type="text"
          name="name"
          defaultValue={v.name ?? ""}
          required
          className={fieldInput}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Platform</span>
        <select
          name="platform"
          defaultValue={v.platform ?? "facebook"}
          className={fieldInput}
        >
          {PLATFORM_ORDER.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={fieldLabel}>URL</span>
        <input
          type="url"
          name="url"
          defaultValue={v.url ?? ""}
          placeholder="https://www.facebook.com/groups/…"
          className={fieldInput}
        />
      </label>
    </div>
  );
}
