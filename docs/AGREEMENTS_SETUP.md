# Agreement email drafts — one-time OAuth setup

The portal generates the sublease PDF (via `agreements.hiveny.com`) and stages a
ready-to-review **draft** in the right mailbox. Nothing is sent automatically.

- **New York unit** → no letterhead → draft in **personal Gmail** (`vdutta1485@gmail.com`)
- **Outside New York** → with letterhead → draft in **M365 / Outlook** (`vineet.dutta@hiveny.com`)

PDF generation and the in-portal **Agreements** iframe work without any of this.
Only the draft-creation step needs the OAuth tokens below.

Each account needs a long-lived **refresh token**, obtained once. Put all values in
`.env.local` (local) and in the Vercel project env (production).

```
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=
MS_REFRESH_TOKEN=
```

---

## A. Gmail (personal account — New York drafts)

1. Go to <https://console.cloud.google.com/> → create/select a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **OAuth consent screen** → External → add `vdutta1485@gmail.com` as a **Test user**
   (test mode is fine; refresh tokens for test users stay valid).
4. **Credentials → Create credentials → OAuth client ID → Desktop app.**
   Copy the **Client ID** and **Client secret** → these are `GMAIL_CLIENT_ID` /
   `GMAIL_CLIENT_SECRET`.
5. Get a refresh token (sign in as `vdutta1485@gmail.com`):
   - Easiest: <https://developers.google.com/oauthplayground/>
     - Click the gear (top-right) → check **"Use your own OAuth credentials"** →
       paste the client ID/secret.
     - In **Step 1**, enter the scope `https://www.googleapis.com/auth/gmail.compose`
       → **Authorize APIs** → sign in as the personal account → allow.
     - **Step 2 → Exchange authorization code for tokens** → copy the **Refresh token**
       → that's `GMAIL_REFRESH_TOKEN`.

> Scope must be `gmail.compose` (create drafts). Don't use a read-only scope.

---

## B. Microsoft 365 / Outlook (work account — non-NY drafts)

1. Go to <https://entra.microsoft.com/> → **Identity → Applications → App registrations
   → New registration.**
   - Supported account types: single tenant is fine.
   - **Redirect URI:** Platform = **Web**, value `http://localhost:3000` (only used to
     mint the token once).
   - Copy **Application (client) ID** → `MS_CLIENT_ID`, **Directory (tenant) ID** →
     `MS_TENANT_ID`.
2. **Certificates & secrets → New client secret** → copy the **Value** →
   `MS_CLIENT_SECRET`.
3. **API permissions → Add a permission → Microsoft Graph → Delegated** → add
   **`Mail.ReadWrite`** (stage drafts), **`Mail.Send`** (send immediately —
   non-NY agreement sends + inventory email) and **`offline_access`** → **Grant
   admin consent**.
4. Mint a refresh token (sign in as `vineet.dutta@hiveny.com`):
   - Open this URL in a browser (replace `{TENANT}` and `{CLIENT_ID}`), sign in as the
     work account, approve:
     ```
     https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/authorize?client_id={CLIENT_ID}&response_type=code&redirect_uri=http://localhost:3000&response_mode=query&scope=https://graph.microsoft.com/Mail.ReadWrite%20https://graph.microsoft.com/Mail.Send%20offline_access
     ```
   - You'll be redirected to `http://localhost:3000/?code=...`. Copy the `code` value.
   - Exchange it for tokens (run in a terminal):
     ```bash
     curl -X POST "https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token" \
       -d "client_id={CLIENT_ID}" \
       -d "client_secret={CLIENT_SECRET}" \
       -d "grant_type=authorization_code" \
       -d "redirect_uri=http://localhost:3000" \
       -d "scope=https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access" \
       -d "code=PASTE_CODE_HERE"
     ```
   - Copy `refresh_token` from the JSON response → `MS_REFRESH_TOKEN`.

> Adding `Mail.Send` in the portal is not enough on its own — you must re-mint
> `MS_REFRESH_TOKEN` via the flow above so the new token carries the Send scope.
> Confirm in Telegram with `/diag` (Outlook should read `✅ OK`).

---

## Verify

1. Restart `next dev` (or redeploy) so the env is loaded.
2. From Telegram: *"send a new tenant their agreement"* → answer the bot's questions →
   confirm **New York** → a no-letterhead draft should appear in Gmail.
3. Repeat with a non-NY address → a letterhead draft should appear in Outlook.

If a mailbox isn't configured, the bot relays a clear "Gmail/Outlook is not configured"
message instead of failing silently.
