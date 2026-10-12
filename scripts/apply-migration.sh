#!/bin/zsh
# Applies pending schema migrations to the live database (Paul runs this after
# approving a schema change in writing; the AI agents cannot run db:push).
# Generates the migration file from drizzle/schema.ts, then applies it.
# Adds columns only by house rule. Safe to re-run: drizzle skips applied migrations.
set -e
cd "$(dirname "$0")/.."
set -a; source .env; set +a
export DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed 's/{rejectUnauthorized:true}/{"rejectUnauthorized":true}/')
pnpm db:push 2>&1 | sed -E 's#mysql://[^[:space:]]+#mysql://***#g'
echo "MIGRATION DONE"
