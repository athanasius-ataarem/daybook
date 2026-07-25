#!/usr/bin/env bash
# Nightly pg_dump to a separate disk, 14-day retention.
# Install:  sudo crontab -e   →   15 2 * * * /var/www/daybook/deploy/backup.sh
set -euo pipefail

BACKUP_DIR=/mnt/backup/daybook          # a SEPARATE disk, not the data disk
KEEP_DAYS=14
STAMP=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR"
pg_dump -U daybook -d daybook -Fc -f "$BACKUP_DIR/daybook-$STAMP.dump"
find "$BACKUP_DIR" -name 'daybook-*.dump' -mtime +"$KEEP_DAYS" -delete

# Restore procedure (tested — see README "Backups"):
#   createdb -U daybook daybook_restored
#   pg_restore -U daybook -d daybook_restored /mnt/backup/daybook/daybook-YYYY-MM-DD.dump
#   psql -U daybook -d daybook_restored -c 'SELECT count(*) FROM "Entry"'
# Then repoint DATABASE_URL (or rename databases) and pm2 restart daybook-api.
