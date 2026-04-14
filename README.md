# Nika birthday guest book (Vercel)

Next.js app: guests leave a **text message**, **voice note** (uploaded as audio), or **photo**. Rows are stored in **Neon Postgres**; media files go to **Vercel Blob**. The home hero uses **`public/nika-young.png`** and **`public/nika-now.png`** with a gentle crossfade animation.

## Prerequisites

- [Vercel](https://vercel.com) account
- [Neon](https://neon.tech) database (easiest: add the **Neon** integration on the Vercel project — sets `DATABASE_URL`)
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store on the same project (sets `BLOB_READ_WRITE_TOKEN`)

Use a **dedicated** Neon database and Blob store for this project (do not share a guest book database with another site unless you want combined entries).

## One-time database setup

1. Open the Neon SQL editor for your database.
2. Paste and run everything in [`schema.sql`](schema.sql).

## Local development

```bash
cd /path/to/nika-birthday-site   # this repo root
cp .env.example .env.local
# Fill DATABASE_URL, BLOB_READ_WRITE_TOKEN, and NIKA_ADMIN_SECRET (optional locally)
npm install
npm run dev
```

Open [http://127.0.0.1:3040](http://127.0.0.1:3040). Mic recording needs a **secure context** (HTTPS or `localhost`).

## Deploy on Vercel

1. **New Project** → import this Git repo (e.g. **`nika-birthday-site`**).
2. Set the Vercel **project name** to **`nika`** if you want the default URL **`https://nika.vercel.app`** (slug must be available on your account).
3. Leave **Root Directory** as **`.`** (repository root — this app is the whole repo).
4. Connect **database + file storage** (next section).
5. Redeploy after env vars exist.

## Connect database and Blob (step by step)

Do this in the Vercel dashboard for **this** Next.js project.

### A. Link Postgres (Neon) to this app

The app reads **`DATABASE_URL`** or **`POSTGRES_URL`** (whichever Vercel sets when you connect Neon / Vercel Postgres).

1. Open Vercel → your deployed Next.js project for this app.
2. Go to **Storage** → create or select your **Postgres** / Neon store.
3. **Connect** / **Link** that database to **this** project.  
   - If the DB was created under another Vercel project, use that store’s **Connect project** flow, **or** copy the **connection string** and add **`DATABASE_URL`** manually under **Settings → Environment Variables**.
4. Confirm **`DATABASE_URL`** or **`POSTGRES_URL`** exists for **Production** (and Preview if you use preview URLs). This app checks both.

### B. Create tables (schema)

Pick one:

- **Neon / SQL editor (easiest):** open your database in Neon → **SQL Editor** → paste all of [`schema.sql`](schema.sql) → **Run**.

- **CLI from your machine** (needs `DATABASE_URL` in the environment):

  ```bash
  cd /path/to/nika-birthday-site
  # Optional: pull env from Vercel (requires Vercel CLI + logged in)
  vercel env pull .env.local
  export $(grep -v '^#' .env.local | xargs)   # macOS/Linux; or paste DATABASE_URL manually
  npm run db:apply-schema
  ```

  Or one-shot: `DATABASE_URL="postgresql://…" npm run db:apply-schema`

### C. Vercel Blob — voice + photos

1. Project → **Storage** → **Blob** → **Create store** (or connect existing).
2. Link the store to this project. Vercel adds **`BLOB_READ_WRITE_TOKEN`** automatically for server uploads.

Without Blob, `POST /api/entries/media` returns 503 (“Blob storage not configured”).

### D. Redeploy

**Deployments** → open the latest deployment → **⋯** → **Redeploy** (uncheck “Use existing Build Cache” if env vars were just added).

Visit the production URL again; the yellow “Database unavailable” banner should disappear once `DATABASE_URL` + `schema.sql` are correct.

### E. Analytics (page views)

The app includes [`@vercel/analytics`](https://vercel.com/docs/analytics) and `<Analytics />` in the root layout.

1. Project → **Analytics** tab → enable **Web Analytics** for the project (if asked).
2. Deploy the latest code, then open the live site and click around; data can take ~30s to appear. Disable ad blockers when testing.

Analytics only measures traffic — it does **not** replace Postgres or Blob for saving messages.

## Environment variables

| Name | Purpose |
|------|---------|
| `DATABASE_URL` or `POSTGRES_URL` | Neon / Vercel Postgres connection string (app checks both) |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Blob store (server uploads) |
| `NIKA_ADMIN_SECRET` | At least 8 characters; unlocks `/nika/admin?secret=…` (full entry list) |

### Blob token troubleshooting

- **Treat the token like a password.** If it was pasted into chat, a ticket, or git, **rotate it**: Vercel → your project → **Storage** → Blob store → create/regenerate token, update **`BLOB_READ_WRITE_TOKEN`**, then **Redeploy**.
- **Scope:** The variable must exist on the **same Vercel project** as the deployment (often **Production** and **Preview**). A token in `.env.local` on your laptop does **not** apply to `*.vercel.app` until you add it in the dashboard (or `vercel env add`).
- **Value:** Paste **only** the token string (starts with `vercel_blob_rw_`). Do **not** wrap it in `"` quotes in the Vercel UI — if the value accidentally includes quote characters, uploads will fail until you remove them (the server strips one pair of surrounding quotes, but fix it in the dashboard anyway).
- **After any env change:** **Redeploy** (Deployments → ⋯ → Redeploy).
- **Exact error:** After deploy, try an upload again — the alert should show a specific message (Blob vs DB vs form parse). **Vercel → project → Logs** while reproducing shows the stack trace.

See [`.env.example`](.env.example).

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stats` | Public: unique people, totals, next goal, progress % |
| `GET` | `/api/entries` | List entries (newest first, cap 200) |
| `POST` | `/api/entries/message` | JSON `{ "name", "text" }` |
| `POST` | `/api/entries/media` | `multipart/form-data`: `kind` = `voice` \| `photo`, `name`, `file` |

## Public vs admin

- **Home page** shows only **how many distinct names** have participated, **total submissions**, a **progress bar**, and **next goal** (10 → 25 → 50 → 100 → 250 → 500 → 1000, then +500).
- **`/nika/admin?secret=…`** lists every message, voice, and photo (newest first). Set **`NIKA_ADMIN_SECRET`** in Vercel (8+ chars), redeploy, then bookmark `https://YOUR_DOMAIN/nika/admin?secret=YOUR_SECRET`. Anyone with the URL can see all entries — keep it private.

## Notes

- There is **no auth** on the main guest book; add rate limiting, CAPTCHA, or admin moderation before a wide public launch.
- **Hero photos:** replace [`public/nika-young.png`](public/nika-young.png) and [`public/nika-now.png`](public/nika-now.png), or edit paths in [`components/GuestBook.tsx`](components/GuestBook.tsx).
