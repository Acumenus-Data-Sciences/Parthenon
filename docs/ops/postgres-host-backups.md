# Host PostgreSQL Backup Strategy

This runbook applies to the localhost PostgreSQL 17 cluster that stores the large `parthenon` database.

## Goals

- Stop taking whole-database logical dumps every 6 hours.
- Use PostgreSQL-native physical backups for cluster-scale recovery.
- Use WAL archiving for near-hourly or near-real-time recovery points.
- Keep small logical dumps for business-critical schemas such as `app`.

## Storage Layout

- Base backups: `/mnt/md0/postgres-backups/base`
- WAL archive: `/mnt/md0/postgres-backups/wal`
- Logical dumps: `/mnt/md0/postgres-backups/logical`

`/mnt/md0` is local staging only. Copy backup artifacts off-host for real disaster recovery.

## PostgreSQL Settings

Applied through `ALTER SYSTEM`:

```sql
ALTER SYSTEM SET archive_mode = 'on';
ALTER SYSTEM SET archive_command = '/home/smudoshi/Github/Parthenon/scripts/pg-host-archive-wal.sh "%p" "%f"';
ALTER SYSTEM SET archive_timeout = '300s';
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = '10';
```

`archive_mode` requires a PostgreSQL restart before WAL archiving becomes active.

## Scripts

- `scripts/pg-host-archive-wal.sh`
  Called by PostgreSQL `archive_command`.
- `scripts/pg-host-basebackup.sh`
  Creates a compressed physical base backup using `pg_basebackup`.
- `scripts/pg-host-logical-backup.sh`
  Dumps critical small schemas such as `app`.
- `scripts/pg-host-prune-backups.sh`
  Prunes older base backups and old WAL files.

## Cron Schedule

Recommended user crontab entries for `smudoshi`:

```cron
23 2 * * * /home/smudoshi/Github/Parthenon/scripts/pg-host-basebackup.sh >> /tmp/parthenon-pg-basebackup.log 2>&1
53 2 * * * /home/smudoshi/Github/Parthenon/scripts/pg-host-prune-backups.sh >> /tmp/parthenon-pg-prune.log 2>&1
17 6,14,22 * * * /home/smudoshi/Github/Parthenon/scripts/pg-host-logical-backup.sh >> /tmp/parthenon-pg-logical.log 2>&1
```

This replaces the old `db-backup.sh` every-6-hours full logical dump job.

Authentication for the host-side jobs should come from `~/.pgpass`, not from inline passwords in the scripts.

## Restore Outline

1. Stop PostgreSQL.
2. Move the current data directory aside.
3. Extract a chosen base backup into a fresh data directory.
4. Add `restore_command` pointing at the WAL archive.
5. Create `recovery.signal`.
6. Start PostgreSQL and allow WAL replay to the target time.

Example `restore_command`:

```conf
restore_command = 'cp /mnt/md0/postgres-backups/wal/%f %p'
```

For point-in-time recovery:

```conf
recovery_target_time = '2026-03-30 15:30:00-04'
```

## Validation

After restart, confirm archiving is active:

```sql
SHOW archive_mode;
SHOW archive_command;
SELECT archived_count, failed_count, last_archived_wal
FROM pg_stat_archiver;
```

Base backup validation:

```bash
ls -lah /mnt/md0/postgres-backups/base/latest
```

Logical dump validation:

```bash
ls -lah /mnt/md0/postgres-backups/logical
```
