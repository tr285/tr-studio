#!/usr/bin/env bash
# ==============================================================================
# TR STUDIO — Automated PostgreSQL & Media Storage Backup Script
# Usage:
#   ./scripts/backup-db.sh [backup_dir]
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${POSTGRES_DB:-trstudio_db}"
DB_USER="${POSTGRES_USER:-trstudio}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/trstudio_backup_${TIMESTAMP}.sql.gz"

echo "================================================================="
echo " TR STUDIO — Database Backup Starting"
echo " Host: ${DB_HOST}:${DB_PORT} | Database: ${DB_NAME} | User: ${DB_USER}"
echo " Destination: ${BACKUP_FILE}"
echo "================================================================="

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "tr-studio-postgres"; then
    echo "Backing up via Docker container: tr-studio-postgres..."
    docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-trstudio_dev_password_change_me}" tr-studio-postgres \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILE}"
elif command -v pg_dump >/dev/null 2>&1; then
    echo "Backing up via local pg_dump..."
    PGPASSWORD="${POSTGRES_PASSWORD:-trstudio_dev_password_change_me}" pg_dump \
        -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILE}"
else
    echo "Error: Neither docker nor local pg_dump was found." >&2
    exit 1
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Database backup created successfully: ${BACKUP_FILE} (${FILE_SIZE})"
echo "================================================================="
