"use client";

import { useActionState } from "react";
import { setRoomAd, type AdFormState } from "../actions";

const fieldLabel = "text-xs font-medium uppercase tracking-wide text-muted";
const fieldInput =
  "rounded-lg border border-stone bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

export function AdEdit({
  roomId,
  adUrl,
}: {
  roomId: string;
  adUrl: string | null;
}) {
  const bound = setRoomAd.bind(null, roomId) as (
    state: AdFormState,
    formData: FormData,
  ) => Promise<AdFormState>;
  const [state, action, pending] = useActionState<AdFormState, FormData>(
    bound,
    undefined,
  );

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Ad post
        </h2>
        {adUrl && (
          <a
            href={adUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-stone bg-white px-3 py-1 text-xs uppercase tracking-wide text-ink hover:bg-warm"
          >
            Open ad ↗
          </a>
        )}
      </div>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Ad URL</span>
          <input
            type="url"
            name="ad_url"
            defaultValue={adUrl ?? ""}
            placeholder="https://www.facebook.com/marketplace/item/…"
            className={fieldInput}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-dark disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {state?.error && (
        <p className="mt-3 text-sm text-red-700">{state.error}</p>
      )}
    </div>
  );
}
