"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createCredential,
  type CredentialFormState,
} from "./actions";
import { CredentialFields } from "./credential-fields";
import type { PropertyOption } from "./constants";

export function AddCredential({
  properties,
}: {
  properties: PropertyOption[];
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);

  const [state, action, pending] = useActionState<
    CredentialFormState,
    FormData
  >(createCredential, undefined);

  // After a real submit completes successfully (state stays undefined),
  // reset the form and close. The ref prevents closing on the initial mount
  // when state is also undefined.
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
        Add credential
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
      <p className="text-xs uppercase tracking-wide text-muted">
        New credential
      </p>
      <div className="mt-4">
        <CredentialFields properties={properties} />
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
