/**
 * Static bearer-token gate for the read-only JSON APIs (same shape as the
 * cron routes' CRON_SECRET check and the inventory API's requireApiKey).
 * Each API family has its own env key so tokens can be shared independently
 * — e.g. INVENTORY_API_KEY holders never gain access to tenant PII.
 */

import { NextResponse } from "next/server";

/** Returns an error response to send, or null when the request is authorized. */
export function requireBearer(
  req: Request,
  envName: string,
): NextResponse | null {
  const expected = process.env[envName];
  if (!expected) {
    return NextResponse.json(
      { error: `${envName} is not configured` },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
