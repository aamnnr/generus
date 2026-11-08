#!/usr/bin/env bash
# Backup harian database Pantau Generus (data aplikasi + akun login).
# Pasang di crontab user deploy:
#   30 1 * * * /srv/generus/app/deploy/vps/backup.sh >> /srv/generus/backup/backup.log 2>&1
# Pulihkan:  gunzip -c FILE.sql.gz | docker exec -i supabase-db psql -U postgres -d postgres
set -euo pipefail

DIR="${BACKUP_DIR:-/srv/generus/backup}"
KEEP_DAYS="${KEEP_DAYS:-14}"
CONTAINER="${DB_CONTAINER:-supabase-db}"
STAMP="$(date +%Y%m%d-%H%M)"

mkdir -p "$DIR"
# Skema public (data), auth (akun login), dan drizzle (riwayat migrasi).
docker exec "$CONTAINER" pg_dump -U postgres -d postgres \
  --schema=public --schema=auth --schema=drizzle --schema=app \
  --no-owner --no-privileges \
  | gzip > "$DIR/generus-$STAMP.sql.gz"

find "$DIR" -name 'generus-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: generus-$STAMP.sql.gz"

# Opsional: salin ke luar server (sangat disarankan), mis. rclone ke Google Drive:
# rclone copy "$DIR/generus-$STAMP.sql.gz" gdrive:backup-generus/
