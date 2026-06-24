#!/usr/bin/env node
/**
 * Mint a Gmail refresh token for the personal mailbox, end to end — no fragile
 * copy/paste of long URLs or auth codes.
 *
 * Reads GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET from .env.local (then .env), opens
 * the Google sign-in page, catches the redirect on a temporary localhost:3000
 * listener, exchanges the code, and prints the refresh_token.
 *
 * Prereqs:
 *   - OAuth client is type "Desktop app" (loopback redirect is allowed).
 *   - Scope gmail.compose (create drafts + send) is on the consent screen.
 *   - To avoid the 7-day expiry of test-mode tokens, set the OAuth consent
 *     screen to "In production" (Publish app) before minting.
 *
 * Usage:
 *   node scripts/mint-gmail-token.mjs
 * Then sign in as vdutta1485@gmail.com in the browser window that opens.
 */

import { readFileSync } from "fs";
import { createServer } from "http";
import { spawn } from "child_process";

const REDIRECT_URI = "http://localhost:3000";
const SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ---- Load env from .env then .env.local (.env.local wins) -------------------
function loadEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          const key = l.slice(0, i).trim();
          let val = l.slice(i + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          return [key, val];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };

const CLIENT_ID = env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = env.GMAIL_CLIENT_SECRET;

const missing = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET"].filter(
  (k) => !env[k],
);
if (missing.length) {
  console.error(
    `Missing ${missing.join(", ")} in .env.local / .env. Fill them in first.`,
  );
  process.exit(1);
}

const authUrl =
  `${AUTH_URL}` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  // access_type=offline + prompt=consent force Google to return a refresh_token
  // (and a fresh one) even on re-authorization.
  `&access_type=offline&prompt=consent`;

function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    spawn(cmd, [url], {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    }).unref();
  } catch {
    /* fall back to manual */
  }
}

async function exchange(code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  return data;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/") {
    res.writeHead(404).end();
    return;
  }
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (err) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Auth error: ${err}`);
    console.error(`\n❌ Auth error: ${err}`);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("No ?code in callback.");
    return;
  }

  try {
    const tokens = await exchange(code);
    if (!tokens.refresh_token) {
      throw new Error(
        "No refresh_token returned. Revoke prior access at " +
          "https://myaccount.google.com/permissions and retry (prompt=consent is set).",
      );
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h2>✅ Done — refresh token minted.</h2><p>Back to your terminal; you can close this tab.</p>",
    );
    console.log("\n✅ Success. Set this in your env (Vercel + .env.local):\n");
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    if (tokens.scope) console.log(`(scopes: ${tokens.scope})`);
    console.log("\nThen redeploy and run /diag in Telegram to confirm.");
    server.close();
    process.exit(0);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(String(e));
    console.error(`\n❌ ${e}`);
    server.close();
    process.exit(1);
  }
});

server.listen(3000, () => {
  console.log("Listening on http://localhost:3000 for the OAuth redirect.\n");
  console.log("Opening the Google sign-in page in your browser...");
  console.log("Sign in as the personal mailbox (vdutta1485@gmail.com).\n");
  console.log("If it doesn't open automatically, paste this URL yourself:\n");
  console.log(authUrl + "\n");
  openBrowser(authUrl);
});
