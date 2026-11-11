# TR STUDIO — Database & Media Backup / Recovery Guide

This runbook describes backup creation, verification, and disaster recovery procedures for TR STUDIO.

---

## 1. Automated Database Backup

TR STUDIO includes an automated backup script in `scripts/backup-db.sh` supporting both Docker containerized environments and direct PostgreSQL installations.

### Executing a Backup

```bash
# Creates a timestamped gzipped SQL backup in ./backups/
./scripts/backup-db.sh ./backups
```

### Backup Artifact

Backups are saved as:
`./backups/trstudio_backup_<YYYYMMDD_HHMMSS>.sql.gz`

The archive contains:
- Schema definitions (Alembic migration state, indexes, tables, foreign keys)
- Users, authentication credentials, and session state
- Projects, stories, screenplay nodes, and scenes
- Characters, expressions, poses, and outfits
- Environments, worlds, variations, and asset assignments
- Animation documents, keyframe tracks, and camera configurations
- Dialogue entries, narration entries, and audio metadata
- Render jobs and video output records

---

## 2. Restoring from a Backup

To restore an existing database from a `.sql.gz` backup archive:

```bash
# Usage: ./scripts/restore-db.sh <path_to_backup_file>
./scripts/restore-db.sh ./backups/trstudio_backup_20261111_103008.sql.gz
```

The script automatically detects whether the database runs inside Docker (`tr-studio-postgres`) or directly via local `psql`, validates the archive, and restores all tables cleanly.

---

## 3. Media Asset Persistence & Backup

In Docker environments, media files (character sprites, environment art, audio files, and exported MP4 videos) are stored in the persistent volume `tr_studio_storage` (mounted to `/storage` in the container).

### Backing Up Media Assets

```bash
# Backup container storage volume to a local tar archive
docker run --rm \
  -v tr-studio_tr_studio_storage:/storage \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/trstudio_storage_$(date +%Y%m%d_%H%M%S).tar.gz -C /storage .
```

### Restoring Media Assets

```bash
# Restore local tar archive back into container storage volume
docker run --rm \
  -v tr-studio_tr_studio_storage:/storage \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /storage && tar xzf /backup/<storage_archive.tar.gz>"
```

---

## 4. Disaster Recovery Checklist

1. Deploy target database instance with correct credentials matching `.env`.
2. Run `./scripts/restore-db.sh <backup_file.sql.gz>`.
3. Restore media volume to `/storage`.
4. Run `alembic upgrade head` inside backend to confirm all migrations match.
5. Hit `GET /health` and verify all subsystems report `"connected"` / `"writable"`.
