/**
 * The portal operates in Eastern Time at all times, regardless of where the
 * server runs or where the user's browser is. The runtime TZ is pinned in
 * src/instrumentation.ts so server-side `toLocaleString`/`toLocaleDateString`
 * and local Date arithmetic resolve to Eastern; this constant is for the few
 * places that must name the zone explicitly (client components, and the
 * `toISOString`-based "today" math below, which is always UTC otherwise).
 */
export const APP_TIME_ZONE = "America/New_York";

/**
 * Today's date as an ISO "YYYY-MM-DD" string in Eastern Time.
 *
 * Do NOT use `new Date().toISOString().slice(0, 10)` for "today" — toISOString
 * is always UTC, so after ~8pm ET it rolls forward to tomorrow's date. This
 * formats with an explicit Eastern zone so it's correct on any host/browser.
 */
export function todayISO(): string {
  // en-CA renders as "YYYY-MM-DD".
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(
    new Date(),
  );
}

/**
 * Display format for all dates in the app: MM/DD/YY.
 * Input is an ISO date string from Postgres ("YYYY-MM-DD") or a timestamptz.
 * Returns "—" for null/empty input.
 *
 * NOTE: don't use this for <input type="date" value=...> — those must stay
 * ISO. Only use for read-only display.
 */
export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const ten = s.slice(0, 10);
  const parts = ten.split("-");
  if (parts.length !== 3) return s;
  const [y, m, d] = parts;
  if (!y || !m || !d) return s;
  return `${m}/${d}/${y.slice(2)}`;
}
