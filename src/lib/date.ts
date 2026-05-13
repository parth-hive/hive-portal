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
