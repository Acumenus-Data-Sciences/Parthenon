#!/usr/bin/env bash
# Archive one WAL segment from the host PostgreSQL cluster to md0.
#
# Intended for PostgreSQL archive_command:
#   /home/smudoshi/Github/Parthenon/scripts/pg-host-archive-wal.sh "%p" "%f"

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <wal-source-path> <wal-file-name>" >&2
  exit 64
fi

SOURCE_PATH="$1"
WAL_FILE="$2"
ARCHIVE_ROOT="${PG_WAL_ARCHIVE_DIR:-/mnt/md0/postgres-backups/wal}"
TARGET_PATH="$ARCHIVE_ROOT/$WAL_FILE"
TMP_PATH="$TARGET_PATH.part"

umask 077
mkdir -p "$ARCHIVE_ROOT"

if [ -f "$TARGET_PATH" ]; then
  exit 0
fi

cp "$SOURCE_PATH" "$TMP_PATH"
mv "$TMP_PATH" "$TARGET_PATH"
