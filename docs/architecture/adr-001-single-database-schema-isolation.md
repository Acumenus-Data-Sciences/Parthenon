# ADR-001: Single Database with Schema Isolation

**Status:** Accepted
**Date:** 2026-03-21
**Decision Makers:** Dr. Sanjay Udoshi

## Context

Parthenon consolidates 15+ OHDSI tools (Atlas, WebAPI, Achilles, DQD, etc.) into a single platform. The traditional OHDSI deployment pattern uses separate PostgreSQL databases for each concern: one for the OMOP CDM vocabulary, one for clinical data, one for results, one for the application, and often more for specialized domains like GIS or demo datasets.

This multi-database approach creates significant operational burden: multiple backup schedules, multiple connection strings, cross-database joins requiring foreign data wrappers or application-level orchestration, and complex Docker Compose configurations with multiple PostgreSQL instances. For a platform intended to be installed with a single command, this complexity is a barrier.

PostgreSQL's native schema mechanism provides namespace isolation within a single database, with the `search_path` session variable controlling which schemas are visible to a given connection.

## Decision

Use a single PostgreSQL database named `parthenon` with all data organized into isolated schemas. Define six Laravel database connections that all point to the same database but set different `search_path` values:

| Connection   | search_path                      | Purpose                                      |
|-------------|----------------------------------|----------------------------------------------|
| `pgsql`     | `app,php`                        | Application tables, Laravel internals         |
| `omop`      | `omop,php`                       | OMOP CDM clinical data + vocabulary           |
| `results`   | `results,php`                    | Achilles/DQD analysis output                  |
| `gis`       | `gis,omop,php`                   | Geospatial tables with CDM cross-reference    |
| `eunomia`   | `eunomia,php`                    | GiBleed demo dataset                          |
| `inpatient` | `inpatient,inpatient_ext,omop`   | Morpheus inpatient CDM + extensions + shared vocab |

All connections share the same `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` environment variables. Schema isolation is enforced purely through `search_path`.

The schemas are:
- **app** -- Users, roles, cohorts, sources, studies, and application-level models
- **php** -- Laravel internals (migrations, jobs, cache, sessions)
- **omop** -- OMOP CDM v5.4 tables and standardized vocabulary (2M+ concepts)
- **results** -- Achilles characterization and DQD output tables
- **gis** -- PostGIS-enabled geospatial extension tables
- **eunomia** -- Eunomia GiBleed synthetic demo dataset
- **eunomia_results** -- Achilles results for the demo dataset
- **inpatient** -- Morpheus inpatient CDM tables (MIMIC-IV derived)
- **inpatient_ext** -- Inpatient extension tables beyond standard OMOP

## Consequences

### Positive
- Single backup command (`pg_dump parthenon`) captures the entire platform state
- Cross-schema JOINs work natively without foreign data wrappers (e.g., GIS queries joining `gis.geographic_location` to `omop.person`)
- One connection pool in PostgreSQL instead of six separate database connection pools
- Simplified Docker Compose: one PostgreSQL container serves all needs
- Single-command restore via `pg_restore` for disaster recovery
- The `inpatient` connection includes `omop` in its search_path, allowing vocabulary reuse without duplicating the 2M+ concept table

### Negative
- A misconfigured `search_path` can cause a model to read from the wrong schema silently -- table names like `person` exist in both `omop` and `eunomia`
- Schema-level `GRANT` management is more nuanced than database-level permissions
- Cannot use different PostgreSQL versions or configurations per domain
- All schemas share the same `pg_hba.conf` authentication rules

### Risks
- If a migration runs against the wrong connection, it could create tables in an unintended schema. Mitigated by explicitly setting `$connection` on every Eloquent model.
- `docker compose restart` does not reload `env_file` -- credential changes require `docker compose up -d` to take effect.
- The `results` connection's `search_path` is dynamically overridden per-request by `AchillesResultReaderService` for multi-source support, which relies on stateless per-request behavior.

## Alternatives Considered

1. **Separate databases per domain** -- The standard OHDSI approach. Rejected because cross-database queries require `dblink` or foreign data wrappers, backup/restore is fragmented, and operational complexity scales with the number of domains.

2. **Single database, single schema** -- All tables in `public`. Rejected because OMOP CDM tables (`person`, `observation`) would collide with application tables, and there is no namespace boundary between clinical and application data.

3. **Multiple PostgreSQL containers** -- One container per domain. Rejected because it multiplies memory usage (each PostgreSQL instance reserves shared buffers), complicates Docker networking, and makes cross-domain queries impossible without application-level orchestration.
