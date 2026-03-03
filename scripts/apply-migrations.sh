#!/bin/bash
# Apply all pending migrations to the AEON database
# Usage: ./scripts/apply-migrations.sh [DATABASE_URL]
#
# If DATABASE_URL is not provided, uses default local connection.
# Falls back to docker exec if psql is not installed locally.

set -e

DB_URL="${1:-${DATABASE_URL:-postgres://architect:${DB_PASSWORD}@localhost:5432/aeon_matrix}}"
MIGRATIONS_DIR="$(dirname "$0")/../db/migrations"
DOCKER_CONTAINER="aeon-matrix-db"
DOCKER_USER="architect"
DOCKER_DB="aeon_matrix"

# Determine execution method: local psql or docker exec
if command -v psql >/dev/null 2>&1; then
    MODE="local"
    echo "[migrations] Using local psql"
elif docker exec "$DOCKER_CONTAINER" pg_isready -U "$DOCKER_USER" -d "$DOCKER_DB" >/dev/null 2>&1; then
    MODE="docker"
    echo "[migrations] psql not found locally, using docker exec ($DOCKER_CONTAINER)"
else
    echo "[migrations] ERROR: Cannot connect to database."
    echo "[migrations]   - psql is not installed locally"
    echo "[migrations]   - Docker container '$DOCKER_CONTAINER' is not running"
    echo "[migrations] Install psql or start the container with: docker compose up -d"
    exit 1
fi

echo "[migrations] Applying migrations to database..."

for f in "$MIGRATIONS_DIR"/*.sql; do
    filename=$(basename "$f")
    echo "[migrations]   Applying $filename..."
    if [ "$MODE" = "local" ]; then
        psql "$DB_URL" -f "$f" 2>&1 | grep -E "^(NOTICE|ERROR|WARNING)" || true
    else
        docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_USER" -d "$DOCKER_DB" < "$f" 2>&1 | grep -E "^(NOTICE|ERROR|WARNING)" || true
    fi
done

echo "[migrations] Done. All migrations applied."
