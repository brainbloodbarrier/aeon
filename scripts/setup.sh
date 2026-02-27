#!/bin/bash
# AEON Full Setup — Database + Migrations + Verification
# Usage: ./scripts/setup.sh
#
# Requires: .env file with DB_PASSWORD (and optionally NEO4J_PASSWORD)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check .env
if [ ! -f .env ]; then
    echo "[setup] ERROR: .env file not found. Copy .env.example and set DB_PASSWORD."
    exit 1
fi

source .env

if [ -z "$DB_PASSWORD" ]; then
    echo "[setup] ERROR: DB_PASSWORD not set in .env"
    exit 1
fi

DB_URL="postgres://architect:${DB_PASSWORD}@localhost:5432/aeon_matrix"

# Start Docker
echo "[setup] Starting Docker services..."
docker compose up -d

# Wait for DB
echo "[setup] Waiting for PostgreSQL..."
until docker exec aeon-matrix-db pg_isready -U architect -d aeon_matrix 2>/dev/null; do
    sleep 1
done
echo "[setup] PostgreSQL is ready."

# Apply migrations
echo "[setup] Applying migrations..."
for f in db/migrations/*.sql; do
    filename=$(basename "$f")
    echo "[setup]   $filename"
    docker exec -i aeon-matrix-db psql -U architect -d aeon_matrix < "$f" 2>&1 | grep -E "^(NOTICE|ERROR|WARNING)" || true
done

# Verify personas
echo ""
echo "[setup] Verifying personas..."
PERSONA_COUNT=$(docker exec aeon-matrix-db psql -U architect -d aeon_matrix -t -c "SELECT COUNT(*) FROM personas WHERE soul_hash IS NOT NULL;" | tr -d ' ')
echo "[setup] Personas with soul_hash: $PERSONA_COUNT/25"

if [ "$PERSONA_COUNT" -eq 25 ]; then
    echo "[setup] All personas operational."
else
    echo "[setup] WARNING: Some personas missing soul_hash. Run migration 015 manually."
fi

# Verify tables
TABLE_COUNT=$(docker exec aeon-matrix-db psql -U architect -d aeon_matrix -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" | tr -d ' ')
echo "[setup] Tables in database: $TABLE_COUNT"

echo ""
echo "[setup] AEON is ready."
echo "[setup] DATABASE_URL=$DB_URL"
echo ""
echo "[setup] Next: run 'npm test' to verify, then invoke personas via slash commands."
