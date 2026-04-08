# Deploying to Vercel

The Next.js app lives at `apps/web/`. Vercel must be pointed at that subdirectory.

---

## Prerequisites

- A Vercel account (free tier works)
- A hosted PostgreSQL database — Neon or Supabase (both have free tiers)
- The database must already have the schema applied (see Step 1)

---

## Step 1 — Provision the database

### Option A: Neon

1. Create a project at <https://neon.tech>.
2. Copy **two** connection strings from the Neon dashboard:
   - **Pooled endpoint** (pgBouncer) → `DATABASE_URL`
   - **Direct endpoint** (non-pooled) → `DIRECT_URL`
3. Apply the Prisma schema:
   ```bash
   cd apps/web
   # Requires DIRECT_URL to be set in your local .env.local
   npx prisma db push
   ```
4. Run the ETL to populate the database (see `etl/README.md`).

### Option B: Supabase

1. Create a project at <https://supabase.com>.
2. Go to **Project Settings → Database → Connection string**:
   - **Transaction pooler** (port 6543) → `DATABASE_URL`
   - **Direct connection** (port 5432) → `DIRECT_URL`
3. Apply the schema and seed data as above.

---

## Step 2 — Import the project into Vercel

1. Push the repo to GitHub (if not already done).
2. In the Vercel dashboard click **Add New → Project** and import the repo.
3. **Critical:** In the "Configure Project" screen set:
   - **Root Directory:** `apps/web`
4. Vercel will auto-detect Next.js. Leave framework preset as **Next.js**.
5. Do **not** click Deploy yet — add environment variables first.

---

## Step 3 — Set environment variables in Vercel

Go to **Project → Settings → Environment Variables** and add:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` (pooled) | Required — see Step 1 |
| `DIRECT_URL` | `postgresql://...` (direct) | Required for Prisma Migrate |
| `NEXT_PUBLIC_API_BASE` | `https://your-project.vercel.app` | Server Components use this to call internal API routes. Set to your actual Vercel URL (no trailing slash). |

> **`NEXT_PUBLIC_API_BASE`** is needed because several pages are Server Components
> that call the internal `/api/*` routes via `fetch`. In the browser a relative
> path works fine; on the server an absolute URL is required.
>
> You can find your deployment URL in the Vercel dashboard after the first deploy.
> If you use a custom domain, set it to that domain instead.

Optional variables (leave unset if unused):

| Variable | Notes |
|---|---|
| `NEXT_TELEMETRY_DISABLED` | Set to `1` to disable Next.js telemetry (already set in `vercel.json`) |

---

## Step 4 — Deploy

Click **Deploy**. Vercel will run:

```
npm ci
npm run build   # → prisma generate && next build
```

The `postinstall` hook ensures the Prisma client is generated after `npm ci`.
The `build` script regenerates it before `next build` as a safety net.

Expected output ends with:
```
✓ Compiled successfully
✓ Generating static pages (N/N)
```

---

## Step 5 — Post-deploy verification

Visit the following URLs (replace with your actual domain):

| URL | Expected |
|---|---|
| `/` | Landing page loads |
| `/api/metrics/summary` | JSON with `totalProjects`, etc. |
| `/api/projects?limit=5` | JSON with paginated project list |
| `/dashboard` | Dashboard page loads with data |

If `/api/metrics/summary` returns `404 Summary metrics not yet computed`, the ETL
has not been run yet — run it against the production database.

---

## Redeployments and schema changes

- **Schema changes:** run `npx prisma db push` (using `DIRECT_URL`) locally against
  the production database before deploying the new code.
- **ETL updates:** redeploy the ETL container or run it manually from your machine
  pointing at the production `DATABASE_URL`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails: `Environment variable not found: DIRECT_URL` | `DIRECT_URL` not set in Vercel env vars | Add it (see Step 3) |
| Build fails: `Cannot find module '@prisma/client'` | `postinstall` not running | Ensure package.json has `"postinstall": "prisma generate"` |
| Runtime error: `Can't reach database server` | `DATABASE_URL` wrong or DB not running | Verify connection string in Vercel env vars |
| Pages return empty data | ETL not run | Run the ETL pipeline against the production DB |
| Server Component fetch fails | `NEXT_PUBLIC_API_BASE` not set | Set it to your Vercel deployment URL |
