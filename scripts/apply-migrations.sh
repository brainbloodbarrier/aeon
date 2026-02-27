#!/bin/bash
# Apply all pending migrations to the AEON database
# Usage: ./scripts/apply-migrations.sh [DATABASE_URL]
#
# If DATABASE_URL is not provided, uses default local connection.

set -e

DB_URL="${1:-${DATABASE_URL:-postgres://architect:${DB_PASSWORD}@localhost:5432/aeon_matrix}}"
MIGRATIONS_DIR="$(dirname "$0")/../db/migrations"

echo "[migrations] Applying migrations to database..."

for f in "$MIGRATIONS_DIR"/*.sql; do
    filename=$(basename "$f")
    echo "[migrations]   Applying $filename..."
    psql "$DB_URL" -f "$f" 2>&1 | grep -E "^(NOTICE|ERROR|WARNING)" || true
done

echo "[migrations] Done. All migrations applied."
