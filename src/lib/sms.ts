/**
 * SMS sender — Zoom Phone SMS API.
 *
 * Texts go out from a Zoom Phone number that has SMS enabled, authenticated
 * with a Server-to-Server OAuth app. Two-step: mint a short-lived access token
 * (account_credentials grant, Basic-auth client id/secret), then POST the
 * message to /v2/phone/sms/messages.
 *
 * Env:
 *   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET  — the S2S OAuth app
 *   ZOOM_SMS_FROM                                        — sending number, E.164 (+1…)
 *
 * The S2S app needs the `phone_sms:write:admin` scope and the sending number
 * must have SMS enabled in Zoom Phone.
 *
 * NOTE: Zoom's send-SMS request body is documented behind a JS-rendered
 * reference; the payload below matches the published shape (sender +
 * to_members + message). If a 400 comes back, the field names are the first
 * thing to adjust — they're isolated in sendSms() for exactly that reason.
 */

const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_SMS_URL = "https://api.zoom.us/v2/phone/sms/messages";

export type SmsResult = { ok: true } | { ok: false; error: string };

function config() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const from = process.env.ZOOM_SMS_FROM;
  if (!accountId || !clientId || !clientSecret || !from) return null;
  return { accountId, clientId, clientSecret, from };
}

export function smsConfigured(): boolean {
  return config() !== null;
}

/**
 * Normalize a phone number to a US/Canada (+1) E.164 number, or return null to
 * SKIP it. We only text +1 numbers:
 *   - No "+": assume +1 — bare 10 digits → +1XXXXXXXXXX, 11 digits starting
 *     with 1 → +1…
 *   - Explicit "+1…": kept.
 *   - Any other explicit "+" country code (e.g. +44, +91): null → skipped.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    // An explicit country code is present — only +1 (US/Canada) is allowed;
    // anything else is intentionally skipped.
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Cache the S2S access token across calls in a warm process (Zoom tokens last
// ~1h); refresh a minute early to avoid edge-of-expiry failures.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("SMS is not configured (missing ZOOM_* env).");

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(
    "base64",
  );
  const res = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(cfg.accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Zoom token request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Zoom token response had no access_token.");
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

/**
 * Send one SMS. Returns { ok:false } (never throws) so a failed text never
 * blocks the email reminder it accompanies.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const cfg = config();
  if (!cfg) return { ok: false, error: "SMS is not configured (missing ZOOM_* env)." };

  const toNumber = toE164(to);
  if (!toNumber) return { ok: false, error: `Unusable phone number: ${to}` };
  // Zoom wants both numbers in E.164; normalize the configured sender too.
  const fromNumber = toE164(cfg.from) ?? cfg.from;

  try {
    const token = await accessToken();
    const res = await fetch(ZOOM_SMS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { phone_number: fromNumber },
        to_members: [{ phone_number: toNumber }],
        message: body,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Zoom SMS failed (${res.status}): ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown SMS error" };
  }
}
