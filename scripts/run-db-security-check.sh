#!/usr/bin/env bash
# Runs scripts/db-security-check.sql against the local Supabase database, or against DATABASE_URL
# (what CI sets). Uses psql if it is installed, otherwise the local database container.
set -euo pipefail
cd "$(dirname "$0")/.."

file=scripts/db-security-check.sql
url="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if command -v psql >/dev/null 2>&1; then
  psql "$url" -v ON_ERROR_STOP=1 -f "$file"
else
  container=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n 1 || true)
  if [ -z "$container" ]; then
    echo "No local database found. Start it with: npx supabase start" >&2
    exit 2
  fi
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file"
fi
