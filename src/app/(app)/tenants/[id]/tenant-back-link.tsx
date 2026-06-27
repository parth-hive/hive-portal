"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Back link on the tenant profile. Prefers a real browser-back so the page
 *  you came from (e.g. a reconciliation run) is restored at its prior scroll
 *  position, and only falls back to the explicit href on a direct/fresh load. */
export function TenantBackLink({
  fallbackHref,
  label,
}: {
  fallbackHref: string;
  label: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={fallbackHref}
      onClick={(e) => {
        // window.history.length > 1 means we navigated here within the SPA, so
        // back returns to the actual referrer instead of the hardcoded href.
        if (typeof window !== "undefined" && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="text-xs uppercase tracking-wide text-muted hover:text-ink"
    >
      ← {label}
    </Link>
  );
}
