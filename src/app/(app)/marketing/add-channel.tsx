"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addChannel, type ChannelFormState } from "./actions";
import { ChannelFields } from "./channel-fields";

export function AddChannel() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);

  const [state, action, pending] = useActionState<
    ChannelFormState,
    FormData
  >(addChannel, undefined);

  useEffect(() => {
    if (submitting.current && !pending) {
      submitting.current = false;
      if (state === undefined) {
        formRef.current?.reset();
        setOpen(false);
      }
    }
  }, [pending, state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark"
      >
        Add channel
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={() => {
        submitting.current = true;
      }}
      className="rounded-2xl bg-white p-6 shadow-sm"
    >
      <p className="text-xs uppercase tracking-wide text-muted">New channel</p>
      <div className="mt-4">
        <ChannelFields />
      </div>
      {state?.error && (
        <p className="mt-3 text-sm text-red-700">{state.error}</p>
      )}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-dark disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs uppercase tracking-wide text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
