#!/usr/bin/env bash
# =============================================================================
# AEON Matrix - Test Database Setup
#
# Starts the test PostgreSQL container, waits for it to be ready,
# runs the init schema and all migrations, then exports DATABASE_URL.
#
# Usage:
#   ./scripts/setup-test-db.sh          # setup only
#   source scripts/setup-test-db.sh     # setup + export DATABASE_URL to shell
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TEST_DB_PORT=5433
TEST_DB_USER=architect
TEST_DB_PASS=test_secret
TEST_DB_NAME=aeon_matrix_test
TEST_DB_CONTAINER=aeon-test-db

export DATABASE_URL="postgres://${TEST_DB_USER}:${TEST_DB_PASS}@localhost:${TEST_DB_PORT}/${TEST_DB_NAME}"

echo "[test-db] Starting test database container..."
docker compose -f "$PROJECT_DIR/docker-compose.test.yml" up -d

echo "[test-db] Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker exec "$TEST_DB_CONTAINER" pg_isready -U "$TEST_DB_USER" -d "$TEST_DB_NAME" > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "[test-db] ERROR: PostgreSQL did not become ready in time"
    exit 1
  fi
  sleep 1
done
echo "[test-db] PostgreSQL is ready."

echo "[test-db] Running init schema (001_schema.sql)..."
docker exec -i "$TEST_DB_CONTAINER" psql -U "$TEST_DB_USER" -d "$TEST_DB_NAME" \
  < "$PROJECT_DIR/db/init/001_schema.sql"

echo "[test-db] Running migrations..."
for migration in "$PROJECT_DIR"/db/migrations/*.sql; do
  migration_name="$(basename "$migration")"
  echo "[test-db]   Applying $migration_name..."
  docker exec -i "$TEST_DB_CONTAINER" psql -U "$TEST_DB_USER" -d "$TEST_DB_NAME" \
    < "$migration"
done

echo "[test-db] Test database ready."
echo "[test-db] DATABASE_URL=$DATABASE_URL"
