---
slug: dev-diary-2026-03-14-db-consolidation
title: "Database Consolidation: Eliminating the Docker Data Loss Risk"
authors: [mudoshi, claude]
tags: [development, infrastructure, database, reliability, docker]
date: 2026-03-14
---

After losing app data to an accidental Docker volume wipe and spending 24 hours restoring it, we hardened the database architecture to eliminate this class of failure entirely. The Docker PostgreSQL container is no longer the source of truth for anything — the host PostgreSQL instance owns all persistent data, and automated backups run every 6 hours.

<!-- truncate -->

<div style={{borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem'}}>
  <img src="/docs/img/acumenus.png" alt="Acumenus Data Sciences" style={{width: '100%', display: 'block'}} />
</div>

## The Problem

Parthenon's dev environment had a split-brain database topology:

- **Host PostgreSQL 17** (`pgsql.acumenus.net:5432/ohdsi`) — OMOP CDM data, vocabulary, GIS, Achilles results
- **Docker PostgreSQL 16** (`postgres:5432/parthenon`) — app tables (studies, cohorts, concept sets), Eunomia demo data

The Laravel `.env` had already been migrated to point at the host DB, so the PHP app was writing studies and cohorts to the host. But other services (python-ai, r-runtime) still had hardcoded `DATABASE_URL` strings pointing at the Docker container. And the Docker postgres data lived in a **named volume** — one `docker compose down -v` and it's gone.

We discovered this the hard way. The AFib anticoagulation study (7 concept sets, 4 cohorts, 4 analyses, Study #42) was rebuilt from the devlog, and then 10 more comparative effectiveness studies were created. All of them went to the host DB safely — but only because the `.env` happened to be pointing there. Other services were still at risk.

## What Changed

### 1. Bind Mount Replaces Named Volume

```yaml
# Before: named volume — destroyed by `docker compose down -v`
volumes:
  - postgres-data:/var/lib/postgresql/data

# After: host bind mount — survives everything
volumes:
  - ${POSTGRES_DATA_DIR:-/home/smudoshi/parthenon-pgdata}:/var/lib/postgresql/data
```

The existing Docker postgres data was copied to the bind mount path before the switch. Zero data loss.

### 2. All Services Point to Host DB

The python-ai and r-runtime containers now connect to the host PostgreSQL via `host.docker.internal`:

```yaml
# python-ai
- DATABASE_URL=postgresql://smudoshi:acumenus@host.docker.internal:5432/ohdsi

# r-runtime
- DATABASE_URL=postgresql://smudoshi:acumenus@host.docker.internal:5432/ohdsi
```

The PHP container was already pointing to the host via the `.env` file (`DB_HOST=pgsql.acumenus.net`). The fhir-to-cdm container was already using `host.docker.internal`. Now all four data-writing services agree on the same database.

### 3. Automated Backups Every 6 Hours

New script `scripts/backup-app-db.sh` dumps the `app` schema from the host PostgreSQL:

```bash
# Runs via cron at 00:00, 06:00, 12:00, 18:00
0 */6 * * * /home/smudoshi/Github/Parthenon/scripts/backup-app-db.sh
```

- Produces gzipped SQL files in `backups/`
- Auto-prunes to keep last 20 backups
- Uses local socket (no password prompt)
- First backup: 1.3 MB compressed (52 studies, 45 concept sets, 52 cohorts)

### 4. Docker Postgres Kept for Compatibility

The Docker postgres container still runs — it's needed for the Eunomia demo dataset loader and as a health check dependency for other services. But it's no longer the source of truth for any persistent data. The `docker_pg` connection in `database.php` remains available for the `db:sync` command if ever needed as a one-time migration tool.

## What Was NOT Changed

- **`.env` file** — already correctly pointed to host DB
- **PHP container** — already used host DB via `.env` overrides
- **fhir-to-cdm** — already used `host.docker.internal`
- **Health check dependencies** — services still wait for Docker postgres to be healthy
- **Eunomia demo flow** — still works, loads into Docker postgres

## Verification

After all changes:
- Docker postgres starts successfully on bind mount
- App authenticates via production URL
- Host DB contains all 52 studies, 45 concept sets, 52 cohorts
- Backup script produces valid 1.3 MB compressed dump
- Cron job installed and verified

## The Rule Going Forward

> **One database, one source of truth.** The host PostgreSQL at `pgsql.acumenus.net:5432/ohdsi` owns all persistent data. Docker postgres is disposable infrastructure. Backups run automatically. `docker compose down -v` is no longer a catastrophe.
