#!/usr/bin/env bash
# scripts/deploy-setup.sh
# Run this ONCE after cloning to set up the Neon database.
# Requires DATABASE_URL and DIRECT_URL to be set in .env.local

set -e

echo "🔄  Generating Prisma client..."
npx prisma generate

echo "🗄️   Running database migrations against Neon..."
npx prisma migrate deploy

echo "✅  Done! Database is ready."
echo ""
echo "Next steps:"
echo "  1. npm run dev          → start local dev server"
echo "  2. Push to GitHub       → Vercel auto-deploys"
