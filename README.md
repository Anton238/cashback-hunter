# Cashback Hunter

PWA for aggregating bank cashback rates. Upload screenshots, enter categories and percentages, view best rates per category.

## Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS, PWA (Workbox), Dexie (IndexedDB), Tesseract.js (OCR)
- **Backend**: Cloudflare Workers, Hono, D1

## Setup

### 1. Cloudflare

- Create a [Cloudflare](https://dash.cloudflare.com) account.
- Create a D1 database: Workers & Pages → D1 → Create database → name `cashback-hunter`. Copy the database ID.
- Run migrations:
  ```bash
  cd worker && npx wrangler d1 execute cashback-hunter --file=src/db/schema.sql --remote
  ```
- In `worker/wrangler.toml` set `database_id` under `[[d1_databases]]` to your D1 database ID.

### 2. VAPID keys (for push notifications)

```bash
npx web-push generate-vapid-keys
```

Add the keys as Worker secrets:

```bash
cd worker && npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT   # e.g. mailto:you@example.com
```

### 3. Deploy

- **Frontend (Cloudflare Pages)**: Dashboard → Workers & Pages → Create application → Pages → Connect to Git. Select repo, production branch `main`. Build: **Build command** `npm run build`, **Build output directory** `dist`. (Root directory left empty — app is at repo root.) Add env var `VITE_API_URL` = your Worker URL if the app is not on the same origin.
- **Worker (GitHub Actions)**: In the repo → Settings → Secrets and variables → Actions, add secrets `CF_API_TOKEN` (Cloudflare API token with Workers edit) and `CF_ACCOUNT_ID`. Push to `main` or `master` to run the workflow and deploy the worker.

### 4. Local development

```bash
npm install
cd worker && npm install && cd ..
npm run dev          # frontend at http://localhost:5173
cd worker && npx wrangler dev   # API at http://localhost:8787
```

Set `VITE_API_URL=http://localhost:8787` in `.env` so the frontend proxies to the local worker, or rely on Vite proxy (already configured for `/api`).

## PWA icons

Add `public/icons/icon-192.png` and `public/icons/icon-512.png` for the install prompt. Optional: use [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) or any 192×192 and 512×512 PNG.

## Environment

- `VITE_API_URL`: API base URL (optional; defaults to `/api` for same-origin or proxy).

Worker (wrangler.toml / secrets): `FRONTEND_ORIGIN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
