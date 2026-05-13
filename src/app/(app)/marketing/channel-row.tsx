"use client";

import { useActionState, useState } from "react";
import {
  updateChannel,
  deleteChannel,
  type ChannelFormState,
} from "./actions";
import { ChannelFields } from "./channel-fields";
import { PLATFORM_LABELS, PLATFORM_PILL, type Platform } from "./constants";

export type ChannelRowData = {
  id: string;
  name: string;
  platform: Platform;
  url: string | null;
};

export function ChannelRow({ channel }: { channel: ChannelRowData }) {
  const [editing, setEditing] = useState(false);

  const boundUpdate = updateChannel.bind(null, channel.id) as (
    state: ChannelFormState,
    formData: FormData,
  ) => Promise<ChannelFormState>;
  const [state, editAction, pending] = useActionState<
    ChannelFormState,
    FormData
  >(boundUpdate, undefined);

  if (editing) {
    return (
      <li className="rounded-2xl bg-white p-5 shadow-sm">
        <form
          action={async (fd) => {
            const result = await editAction(fd);
            if (result === undefined) setEditing(false);
            return result;
          }}
        >
          <p className="text-xs uppercase tracking-wide text-muted">
            Editing {channel.name}
          </p>
          <div className="mt-3">
            <ChannelFields initial={channel} />
          </div>
          {state?.error && (
            <p className="mt-3 text-sm text-red-700">{state.error}</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-dark disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs uppercase tracking-wide text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {channel.url ? (
            <a
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base text-ink hover:text-accent-text"
            >
              {channel.name} ↗
            </a>
          ) : (
            <span className="text-base text-ink">{channel.name}</span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${PLATFORM_PILL[channel.platform]}`}
          >
            {PLATFORM_LABELS[channel.platform]}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs uppercase tracking-wide text-muted hover:text-accent-text"
        >
          Edit
        </button>
        <form action={deleteChannel}>
          <input type="hidden" name="id" value={channel.id} />
          <button
            type="submit"
            onClick={(e) => {
              if (!confirm(`Delete channel "${channel.name}"?`)) {
                e.preventDefault();
              }
            }}
            className="text-xs uppercase tracking-wide text-muted hover:text-red-700"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
