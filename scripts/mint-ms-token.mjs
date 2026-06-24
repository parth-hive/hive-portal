#!/usr/bin/env node
/**
 * Mint a Microsoft Graph refresh token for the Outlook work mailbox, end to end
 * — no fragile copy/paste of long URLs or auth codes.
 *
 * It reads MS_CLIENT_ID / MS_TENANT_ID / MS_CLIENT_SECRET from .env.local (then
 * .env), opens the Microsoft sign-in page, catches the redirect on a temporary
 * localhost:3000 listener, exchanges the code, and prints the refresh_token.
 *
 * Prereq: the app registration must already have delegated Mail.ReadWrite,
 * Mail.Send and offline_access added + admin-consented (this requests the
 * `.default` scope, i.e. everything consented on the app).
 *
 * Usage:
 *   node scripts/mint-ms-token.mjs
 * Then sign in as vineet.dutta@hiveny.com in the browser window that opens.
 */

import { readFileSync } from "fs";
import { createServer } from "http";
import { spawn } from "child_process";

const REDIRECT_URI = "http://localhost:3000";
// `.default` pulls every Graph permission consented on the app (incl. Mail.Send),
// but offline_access is an Azure AD/OIDC scope — NOT a Graph resource scope — so
// it must be requested explicitly or no refresh_token is returned. (offline_access
// is one of the few scopes you're allowed to combine with `.default`.)
const SCOPE = "https://graph.microsoft.com/.default offline_access";

// ---- Load env from .env.local then .env (later files don't override earlier) -
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
          // Strip optional surrounding quotes.
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

const CLIENT_ID = env.MS_CLIENT_ID;
const TENANT_ID = env.MS_TENANT_ID;
const CLIENT_SECRET = env.MS_CLIENT_SECRET;

const missing = ["MS_CLIENT_ID", "MS_TENANT_ID", "MS_CLIENT_SECRET"].filter(
  (k) => !env[k],
);
if (missing.length) {
  console.error(
    `Missing ${missing.join(", ")} in .env.local / .env. Fill them in first.`,
  );
  process.exit(1);
}

const authUrl =
  `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_mode=query` +
  `&scope=${encodeURIComponent(SCOPE)}`;

function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
    /* fall back to manual */
  }
}

async function exchange(code) {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        code,
      }),
    },
  );
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
    const desc = url.searchParams.get("error_description") || "";
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Auth error: ${err}\n\n${desc}`);
    console.error(`\n❌ Auth error: ${err}\n${desc}`);
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
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h2>✅ Done — refresh token minted.</h2><p>Back to your terminal; you can close this tab.</p>",
    );
    console.log("\n✅ Success. Set this in your env (Vercel + .env.local):\n");
    console.log(`MS_REFRESH_TOKEN=${tokens.refresh_token}\n`);
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
  console.log("Opening the Microsoft sign-in page in your browser...");
  console.log("Sign in as the work mailbox (vineet.dutta@hiveny.com).\n");
  console.log("If it doesn't open automatically, paste this URL yourself:\n");
  console.log(authUrl + "\n");
  openBrowser(authUrl);
});
