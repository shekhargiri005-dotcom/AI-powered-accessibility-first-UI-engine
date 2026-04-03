# Environment Variables — Setup Guide

## Local Development (`.env.local`)

Copy this file to `.env.local` and fill in the values.

```bash
# ── Database (Neon PostgreSQL) ──────────────────────────────────────────────────
# Get from: https://console.neon.tech → Your project → Connection Details
# Select "Prisma" connection string format
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# ── Redis Cache (Upstash) ───────────────────────────────────────────────────────
# Get from: https://console.upstash.com → Create Database → REST API
# (Leave empty in local dev to use the in-memory cache instead)
UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"

# ── Security ────────────────────────────────────────────────────────────────────
# MUST be exactly 32 characters.
# Generate: node -e "console.log(require('crypto').randomBytes(24).toString('base64').slice(0,32))"
ENCRYPTION_SECRET="replace_with_32_char_random_secret!"

# ── AI Provider API Keys (server-side fallback keys) ───────────────────────────
# These are used when a user has NOT saved their own key via Workspace Settings.
# All are optional — the system falls back to Ollama if none are set.
OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-..."
DEEPSEEK_API_KEY="sk-..."
GOOGLE_API_KEY="AIzaSy..."

# ── Ollama (local inference) ────────────────────────────────────────────────────
# Only needed if you run Ollama locally. Defaults to http://localhost:11434/v1
# OLLAMA_BASE_URL="http://localhost:11434/v1"

# ── AI Model Overrides (optional) ──────────────────────────────────────────────
# Override which model is used for each pipeline stage
# CLASSIFIER_MODEL="gpt-4o-mini"
# THINKING_MODEL="gpt-4o-mini"
# REVIEW_MODEL="gpt-4o"
# REPAIR_MODEL="gpt-4o"
```

---

## Vercel Production Environment Variables

Add these in: **Vercel Dashboard → Your Project → Settings → Environment Variables**

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon console → Connection Details → Prisma string |
| `DIRECT_URL` | ✅ | Neon console → Connection Details → Direct string |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash console → REST API tab |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash console → REST API tab |
| `ENCRYPTION_SECRET` | ✅ | Generate: `openssl rand -base64 24 \| cut -c1-32` |
| `OPENAI_API_KEY` | Optional | platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Optional | console.anthropic.com/keys |
| `DEEPSEEK_API_KEY` | Optional | platform.deepseek.com |
| `GOOGLE_API_KEY` | Optional | aistudio.google.com/apikey |

---

## Generating `ENCRYPTION_SECRET`

Run this in your terminal (any OS):
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64').slice(0,32))"
```
Paste the output as your `ENCRYPTION_SECRET`. **Never commit this to git.**

---

## Neon Setup Steps

1. Go to [console.neon.tech](https://console.neon.tech) → Create a project
2. Copy the **Prisma** connection string → paste as `DATABASE_URL`
3. Copy the **Direct** connection string → paste as `DIRECT_URL`
4. Run locally: `npx prisma migrate deploy`
5. Verify: `npx prisma studio` → should show `WorkspaceSettings` and `UsageLog` tables

## Upstash Setup Steps

1. Go to [console.upstash.com](https://console.upstash.com) → Create Database
2. Choose **Global** region for lowest latency
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the REST API tab
4. Add both to Vercel environment variables
