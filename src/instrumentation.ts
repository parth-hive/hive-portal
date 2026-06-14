/**
 * Pin the server runtime to Eastern Time so every server-rendered date — log
 * timestamps, dashboard labels, anything using toLocaleString/toLocaleDateString
 * or local Date arithmetic — resolves to ET regardless of the host's timezone.
 *
 * Date-only "today" math that goes through toISOString is still UTC by nature;
 * those sites use todayISO() from "@/lib/date" instead.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = "America/New_York";
  }
}
