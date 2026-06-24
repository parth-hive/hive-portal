/**
 * Minimal Gmail sender for the personal account (vdutta1485@gmail.com) — used
 * for New York correspondence (agreements + reminders), plain & unbranded,
 * From "Vineet".
 *
 * Sends over SMTP with a Gmail **App Password** (not OAuth) — no consent screen,
 * no token expiry, no redirect dance. Requires 2-Step Verification on the
 * account, then an App Password generated at https://myaccount.google.com/apppasswords.
 *
 * Env: GMAIL_USER (the address), GMAIL_APP_PASSWORD (16-char app password)
 */

import nodemailer from "nodemailer";

// All New York correspondence goes out under this personal identity — display
// name "Vineet", no Hive branding.
function fromHeader(user: string): string {
  return `Vineet <${user}>`;
}

export type DraftInput = {
  to: string;
  subject: string;
  /** Optional HTML body. When omitted, a plain text-only message is sent. */
  html?: string;
  text: string;
  /** Optional attachment (PDF, xlsx, …). Omit for a body-only message. */
  attachment?: { filename: string; base64: string; mimeType?: string };
};

// DraftResult is retained for the Outlook draft flow (graph-mail.ts) which still
// imports it; Gmail no longer creates drafts.
export type DraftResult =
  | { ok: true; draftUrl: string }
  | { ok: false; error: string };

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function config() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return { user, pass };
}

export function gmailConfigured(): boolean {
  return config() !== null;
}

function makeTransport(cfg: { user: string; pass: string }) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

/**
 * Verify the Gmail App Password authenticates over SMTP (i.e. sending will work)
 * WITHOUT sending anything. Used by the Telegram /diag command.
 */
export async function checkGmailAuth(): Promise<{
  configured: boolean;
  ok: boolean;
  error?: string;
}> {
  const cfg = config();
  if (!cfg) return { configured: false, ok: false };
  try {
    await makeTransport(cfg).verify();
    return { configured: true, ok: true };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      error: e instanceof Error ? e.message : "Unknown Gmail error",
    };
  }
}

/**
 * Send a message immediately as the personal account (From "Vineet"). Used for
 * New York agreements and reminders. Plain text by default; multipart with the
 * HTML alternative and/or an attachment when provided.
 */
export async function sendGmailMessage(input: DraftInput): Promise<SendResult> {
  const cfg = config();
  if (!cfg) {
    return {
      ok: false,
      error: "Gmail is not configured (missing GMAIL_USER / GMAIL_APP_PASSWORD).",
    };
  }
  try {
    const info = await makeTransport(cfg).sendMail({
      from: fromHeader(cfg.user),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachment
        ? [
            {
              filename: input.attachment.filename,
              content: Buffer.from(input.attachment.base64, "base64"),
              contentType: input.attachment.mimeType || "application/pdf",
            },
          ]
        : undefined,
    });
    return { ok: true, id: info.messageId || "" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown Gmail error",
    };
  }
}
