"use client";

import { useActionState, useState } from "react";
import {
  updateCredential,
  deleteCredential,
  logCredentialAccess,
  type CredentialFormState,
} from "./actions";
import { CredentialFields } from "./credential-fields";
import { CATEGORY_LABELS, type PropertyOption } from "./constants";
import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Enums"]["credential_category"];

export type CredentialRowData = {
  id: string;
  category: Category;
  service_name: string;
  property_id: string | null;
  property_label: string | null;
  username: string | null;
  password: string | null;
  login_url: string | null;
  account_number: string | null;
  owner_label: string | null;
  notes: string | null;
};

const CATEGORY_PILL: Record<Category, string> = {
  payment_portal: "bg-accent/15 text-accent-text",
  maintenance_portal: "bg-warm text-ink/70",
  utility: "bg-stone/40 text-ink/70",
  internet: "bg-accent/10 text-accent-text",
  building_login: "bg-warm text-ink/70",
  tool_login: "bg-stone/40 text-ink/70",
  marketing: "bg-accent/15 text-accent-text",
  other: "bg-warm text-ink/70",
};

function maskPassword(p: string | null) {
  if (!p) return "—";
  return "•".repeat(Math.min(p.length, 12));
}

export function CredentialRow({
  credential,
  properties,
}: {
  credential: CredentialRowData;
  properties: PropertyOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const boundUpdate = updateCredential.bind(null, credential.id) as (
    state: CredentialFormState,
    formData: FormData,
  ) => Promise<CredentialFormState>;
  const [state, editAction, pending] = useActionState<
    CredentialFormState,
    FormData
  >(boundUpdate, undefined);

  async function copy(field: "username" | "password" | "account_number", value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(null), 1200);
      if (field === "password") {
        await logCredentialAccess(credential.id, "copy");
      }
    } catch {
      // Clipboard may be blocked; silently skip.
    }
  }

  async function toggleReveal() {
    if (!revealed) {
      await logCredentialAccess(credential.id, "reveal");
    }
    setRevealed((r) => !r);
  }

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
            Editing {credential.service_name}
          </p>
          <div className="mt-3">
            <CredentialFields initial={credential} properties={properties} />
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
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base text-ink">{credential.service_name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${CATEGORY_PILL[credential.category]}`}
            >
              {CATEGORY_LABELS[credential.category]}
            </span>
            {credential.property_label && (
              <span className="text-xs text-muted">
                · {credential.property_label}
              </span>
            )}
            {credential.owner_label && (
              <span className="text-xs text-muted">
                · {credential.owner_label}
              </span>
            )}
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
          <form action={deleteCredential}>
            <input type="hidden" name="id" value={credential.id} />
            <button
              type="submit"
              onClick={(e) => {
                if (
                  !confirm(
                    `Delete the "${credential.service_name}" credential? This cannot be undone.`,
                  )
                ) {
                  e.preventDefault();
                }
              }}
              className="text-xs uppercase tracking-wide text-muted hover:text-red-700"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        {credential.username && (
          <>
            <dt className="text-xs uppercase tracking-wide text-muted">User</dt>
            <dd className="flex items-center gap-2 text-ink">
              <span className="break-all">{credential.username}</span>
              <CopyChip
                onClick={() => copy("username", credential.username)}
                copied={copied === "username"}
              />
            </dd>
          </>
        )}
        {credential.password && (
          <>
            <dt className="text-xs uppercase tracking-wide text-muted">Pass</dt>
            <dd className="flex items-center gap-2 text-ink">
              <span className="break-all font-mono text-sm">
                {revealed ? credential.password : maskPassword(credential.password)}
              </span>
              <button
                type="button"
                onClick={toggleReveal}
                className="text-xs uppercase tracking-wide text-muted hover:text-accent-text"
              >
                {revealed ? "Hide" : "Reveal"}
              </button>
              <CopyChip
                onClick={() => copy("password", credential.password)}
                copied={copied === "password"}
              />
            </dd>
          </>
        )}
        {credential.account_number && (
          <>
            <dt className="text-xs uppercase tracking-wide text-muted">Acct #</dt>
            <dd className="flex items-center gap-2 text-ink">
              <span className="break-all">{credential.account_number}</span>
              <CopyChip
                onClick={() =>
                  copy("account_number", credential.account_number)
                }
                copied={copied === "account_number"}
              />
            </dd>
          </>
        )}
        {credential.login_url && (
          <>
            <dt className="text-xs uppercase tracking-wide text-muted">Link</dt>
            <dd>
              <a
                href={credential.login_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-accent-text hover:text-accent-dark"
              >
                Open portal ↗
              </a>
            </dd>
          </>
        )}
        {credential.notes && (
          <>
            <dt className="text-xs uppercase tracking-wide text-muted">Notes</dt>
            <dd className="text-muted">{credential.notes}</dd>
          </>
        )}
      </dl>
    </li>
  );
}

function CopyChip({
  onClick,
  copied,
}: {
  onClick: () => void;
  copied: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide transition ${
        copied
          ? "bg-accent/15 text-accent-text"
          : "text-muted hover:text-accent-text"
      }`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
