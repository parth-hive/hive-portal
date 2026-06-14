"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteListing } from "./actions";

/**
 * Red bin that pulls a room's listing off Inventory and queues it on the Add
 * Tenant page as a "listing to fill". Reversible there.
 */
export function DeleteListingButton({
  roomId,
  label,
}: {
  roomId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !confirm(
        `Delete the listing for ${label}? It moves to the Add Tenant page to be filled in. You can restore it there.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteListing(roomId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Delete listing"
      title="Delete listing"
      className="rounded-md p-1.5 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  );
}
