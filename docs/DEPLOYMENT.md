# Deployment Guide — Vercel + Neon + Upstash

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     Vercel                          │
│  ┌─────────────┐      ┌──────────────────────────┐  │
│  │  Next.js    │      │   API Routes             │  │
│  │  Frontend   │ ───▶ │ /api/generate            │  │
│  │  (React)    │      │ /api/classify            │  │
│  └─────────────┘      │ /api/workspace/settings  │  │
│                       └──────────┬───────────────┘  │
└──────────────────────────────────┼──────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               │                   │                   │
               ▼                   ▼                   ▼
        ┌─────────────┐   ┌───────────────┐   ┌───────────────┐
        │    Neon     │   │   Upstash     │   │  AI Providers │
        │  PostgreSQL │   │    Redis      │   │ OpenAI/Claude │
        │ (DB + keys) │   │  (AI cache)   │   │  DeepSeek/... │
        └─────────────┘   └───────────────┘   └───────────────┘
```

---

## Step-by-Step Deployment

### Step 1 — Set Up Neon PostgreSQL

1. Go to [console.neon.tech](https://console.neon.tech) and sign up / log in
2. Click **New Project** → name it `ai-ui-engine`
3. Choose your region (pick one closest to `iad1` — US East)
4. Once created, go to **Connection Details**
5. Switch the dropdown to **Prisma**
6. Copy the two connection strings:
   - `DATABASE_URL` → the one with `?pgbouncer=true`
   - `DIRECT_URL` → the one without pgbouncer

### Step 2 — Set Up Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com) and sign up
2. Click **Create Database**
3. Name it `ai-ui-cache`, select **Global** region
4. Once created, click the **REST API** tab
5. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### Step 3 — Run Database Migration Locally

```bash
# 1. Add your Neon credentials to .env.local
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# 2. Generate Prisma client
npx prisma generate

# 3. Run migrations against Neon
npx prisma migrate deploy

# 4. Verify tables exist
npx prisma studio
```

### Step 4 — Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repository
4. **Framework Preset**: Next.js (auto-detected)
5. Add **all environment variables** from `docs/ENV_SETUP.md`
6. Click **Deploy**

> Vercel automatically runs `npx prisma generate && next build` (from `vercel.json`)

### Step 5 — Post-Deploy Verification

```bash
# Test workspace settings API
curl https://your-app.vercel.app/api/workspace/settings

# Test generation (should return 200)
curl -X POST https://your-app.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Build a login form"}'
```

---

## Continuous Deployment

Every push to `main` triggers a Vercel deploy automatically.

For database schema changes:
```bash
# Create a new migration
npx prisma migrate dev --name your_change_name

# Preview deploy will run with new migration
# Or manually: npx prisma migrate deploy
```

---

## Environment Variables Checklist

Before deploying, verify all variables are set in Vercel dashboard:

- [ ] `DATABASE_URL` (Neon pooled)
- [ ] `DIRECT_URL` (Neon direct)
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] `ENCRYPTION_SECRET` (32 chars)
- [ ] At least one AI provider key (`OPENAI_API_KEY` recommended)

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `PrismaClientInitializationError` | Wrong `DATABASE_URL` | Check Neon is using pgbouncer URL |
| `Invalid environment variables` | Missing `DIRECT_URL` | Add direct URL separately |
| `Cache miss on every request` | Missing Upstash vars | Add `UPSTASH_REDIS_REST_*` to Vercel |
| `Encryption error on key save` | Wrong `ENCRYPTION_SECRET` | Must be exactly 32 chars |
| `Build failed: prisma not found` | `vercel.json` buildCommand | Ensure `vercel.json` is committed |
