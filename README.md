# Hive Portal

Internal operations portal for Hive co-living: tenants & rent, properties/rooms, inventory & listings, cleaning, bank reconciliation, lease agreements, and stored credentials.

Built with Next.js 16 (App Router) + React 19, TypeScript, Tailwind v4, and Supabase (Postgres + Auth + RLS).

> **Working on this codebase?** Read [`AGENTS.md`](./AGENTS.md) first — it documents the architecture, conventions, and the Hive brand/UI tokens. UI must visually align with [hiveny.com](https://hiveny.com).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

See [`.env.example`](./.env.example) for the full list.

**Required** (the app won't boot without these):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Feature-gated** (only needed for the corresponding feature):

- Email — `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO`
- Agreement drafts — Gmail (`GMAIL_*`) and Microsoft Graph (`MS_*`)
- Telegram ops bot — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOWED_TELEGRAM_USER_IDS`, `ANTHROPIC_API_KEY`
- Cron routes — `CRON_SECRET`
- `NEXT_PUBLIC_SITE_URL`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Apply Supabase migrations (`supabase db push`) |
| `npm run db:types` | Regenerate `src/lib/supabase/types.ts` from the linked project |

## Project structure

- `src/app/(app)/**` — the authenticated portal, one folder per feature (tenants, properties, inventory, cleaning, reconciliation, agreements, credentials, reports, settings).
- `src/app/api/**` — Telegram webhook and Vercel cron routes.
- `src/lib/**` — domain logic (rent ledger, agreements, email, notifications, reconciliation, analytics) and the Supabase clients.
- `supabase/migrations/**` — timestamped SQL migrations.

See [`AGENTS.md`](./AGENTS.md) for the full architecture breakdown and conventions.

## Database

The schema lives in `supabase/migrations/`. After changing it:

```bash
npm run db:push     # apply migrations to the linked project
npm run db:types    # regenerate the TypeScript types (never edit types.ts by hand)
```

## Deployment

Deployed on Vercel. Cron routes (`/api/cron/*`) are guarded by `CRON_SECRET`; the server runtime is pinned to `America/New_York` (see `src/instrumentation.ts`).
