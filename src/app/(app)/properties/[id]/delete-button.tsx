"use client";

import { deleteProperty } from "../actions";

type Props = { id: string; label: string };

export function DeletePropertyButton({ id, label }: Props) {
  return (
    <form action={deleteProperty}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs uppercase tracking-wide text-muted hover:text-red-700"
        onClick={(e) => {
          if (
            !confirm(
              `Delete property "${label}"? Its rooms will also be deleted. This cannot be undone.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        Delete this property
      </button>
    </form>
  );
}
