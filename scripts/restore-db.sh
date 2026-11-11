#!/usr/bin/env bash
# ==============================================================================
# TR STUDIO — Automated PostgreSQL Database Restore Script
# Usage:
#   ./scripts/restore-db.sh <backup_file.sql.gz>
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>" >&2
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}" >&2
    exit 1
fi

DB_NAME="${POSTGRES_DB:-trstudio_db}"
DB_USER="${POSTGRES_USER:-trstudio}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

echo "================================================================="
echo " TR STUDIO — Database Restore Starting"
echo " Source: ${BACKUP_FILE}"
echo " Target: ${DB_HOST}:${DB_PORT} / ${DB_NAME} (User: ${DB_USER})"
echo "================================================================="

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "tr-studio-postgres"; then
    echo "Restoring via Docker container: tr-studio-postgres..."
    gunzip -c "${BACKUP_FILE}" | docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD:-trstudio_dev_password_change_me}" \
        tr-studio-postgres psql -U "${DB_USER}" -d "${DB_NAME}"
elif command -v psql >/dev/null 2>&1; then
    echo "Restoring via local psql..."
    PGPASSWORD="${POSTGRES_PASSWORD:-trstudio_dev_password_change_me}" gunzip -c "${BACKUP_FILE}" | \
        psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
else
    echo "Error: Neither docker nor local psql was found." >&2
    exit 1
fi

echo "✅ Database restore completed successfully from: ${BACKUP_FILE}"
echo "================================================================="
