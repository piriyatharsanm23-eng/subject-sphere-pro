#!/usr/bin/env bash
# One-shot data migration: Lovable Cloud project -> external Supabase project.
#
# Schema is already applied on the external project (all files in
# supabase/migrations were replayed there). This script copies only DATA:
#   1. auth.users + auth.identities  (keeps existing passwords/logins)
#   2. every public table            (semesters, subjects, materials, ...)
#   3. storage objects               (learning-materials + avatars buckets)
#
# Requires (already stored as project secrets):
#   SUPABASE_DB_URL                     source Postgres connection string
#   EXTERNAL_SUPABASE_DB_URL            target Postgres connection string
#   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
#   EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_SERVICE_ROLE_KEY
#
# The source project must be AWAKE (not paused) when this runs.
set -euo pipefail

SRC="${SUPABASE_DB_URL:?missing SUPABASE_DB_URL}"
DST="${EXTERNAL_SUPABASE_DB_URL:?missing EXTERNAL_SUPABASE_DB_URL}"
WORK="${TMPDIR:-/tmp}/studyhub-migration"
mkdir -p "$WORK"

echo "==> 1/3 auth users (passwords preserved)"
pg_dump "$SRC" --data-only --no-owner --no-privileges \
  -t auth.users -t auth.identities > "$WORK/auth.sql"
psql "$DST" -v ON_ERROR_STOP=1 -f "$WORK/auth.sql"

echo "==> 2/3 public tables"
pg_dump "$SRC" --data-only --no-owner --no-privileges \
  --disable-triggers -n public > "$WORK/public.sql"
psql "$DST" -v ON_ERROR_STOP=1 -f "$WORK/public.sql"

echo "==> 3/3 storage files"
python3 "$(dirname "$0")/copy-storage.py"

echo "Migration complete."
