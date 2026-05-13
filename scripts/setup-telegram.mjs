#!/usr/bin/env node
/**
 * Register or update the Telegram bot webhook.
 *
 * Usage:
 *   node scripts/setup-telegram.mjs https://hive-portal-1485.vercel.app
 *
 * Reads TELEGRAM_BOT_TOKEN from .env.local. Optionally also writes a
 * webhook secret (TELEGRAM_WEBHOOK_SECRET) so the route handler can verify
 * incoming requests came from Telegram — passes the secret to Telegram's
 * setWebhook so it sends it back on every request.
 */

import { readFileSync } from "fs";
import { randomBytes } from "crypto";

const base = process.argv[2];
if (!base) {
  console.error("Usage: node scripts/setup-telegram.mjs <https://...>");
  process.exit(1);
}
const webhookUrl = `${base.replace(/\/$/, "")}/api/telegram`;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const token = env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN missing from .env.local");
  process.exit(1);
}

const secret = env.TELEGRAM_WEBHOOK_SECRET ?? randomBytes(24).toString("hex");

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  }),
});

const body = await res.json();
console.log(body);

if (!body.ok) {
  console.error("setWebhook failed");
  process.exit(1);
}

console.log(`\nWebhook set: ${webhookUrl}`);
if (!env.TELEGRAM_WEBHOOK_SECRET) {
  console.log(
    `\nAdd this to .env.local AND to Vercel env vars:\n` +
      `TELEGRAM_WEBHOOK_SECRET=${secret}\n`,
  );
}
