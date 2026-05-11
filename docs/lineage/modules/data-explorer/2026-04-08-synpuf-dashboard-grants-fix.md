# SynPUF Dashboard / Achilles Reader — Connection & Grants Fix

**Date:** 2026-04-08
**Scope:** `app.sources`, `DynamicConnectionFactory`, `SourceContext`, `AchillesResultReaderService`, PostgreSQL grants on `*_results` and CDM schemas
**Commit:** (pending)

## Problem

The Dashboard reported "No CDM loaded" for the **CMS SynPUF 2.3M** source even though the `synpuf` schema was fully populated with 2.3M persons. Characterization metrics, demographics, and domain record counts all came back empty. Other sources (Acumenus, IRSF-NHS, Pancreas) worked normally.

## Investigation

A systematic trace (Phase 1 — gather evidence, not fixes) surfaced two independent defects stacked on top of each other. Fixing one exposed the next.

### Defect 1 — SynPUF routed to the wrong PostgreSQL host

`app.sources` for all sources had `db_host = NULL` **except** SynPUF, which had:

```
db_host=pgsql.acumenus.net, db_port=5432, db_database=parthenon,
username=smudoshi, password=<encrypted, 200 chars>
```

[`DynamicConnectionFactory::connectionName()`](../../../../backend/app/Services/Database/DynamicConnectionFactory.php#L26) (and [`SourceContext::registerConnections()`](../../../../backend/app/Context/SourceContext.php#L85)) both branch on `db_host`:

- **`db_host` empty** → reuse the named `source_connection` (`omop`, `eunomia`, etc.), which Laravel resolves via `backend/.env` → `DB_HOST=host.docker.internal`.
- **`db_host` set** → build a fresh PDO config targeting that host directly.

SynPUF therefore bypassed the local `omop` connection and tried to reach `pgsql.acumenus.net:5432` (a public host) from inside the PHP container on every Dashboard call. The dynamic PDO either stalled or hit wrong data, leaving the reader with nothing.

Nothing in the daimon rows (`cdm → synpuf`, `results → synpuf_results`, `vocabulary → vocab`) was wrong — the problem was purely the `db_host` discrepancy introduced when the source was first imported from the legacy WebAPI configuration.

### Defect 2 — `synpuf_results` granted only to `claude_dev`

After NULLing SynPUF's `db_host` so it used the `omop` connection like every other source, the Dashboard called `AchillesResultReaderService::getRecordCounts($source)` and failed with:

```
SQLSTATE[42501]: Insufficient privilege: 7
ERROR: permission denied for table achilles_results
(Connection: ctx_results, SQL: select * from "achilles_results" where "analysis_id" in (0, 101, 200, ...))
```

The `omop` connection authenticates as `parthenon_app`. Audit:

| schema | table | owner | `parthenon_app` SELECT |
|---|---|---|---|
| `synpuf_results` | `achilles_analysis` | claude_dev | ❌ |
| `synpuf_results` | `achilles_performance` | claude_dev | ❌ |
| `synpuf_results` | `achilles_results` | claude_dev | ❌ |
| `synpuf_results` | `achilles_results_dist` | claude_dev | ❌ |
| `results` | `achilles_results` | smudoshi | ✅ (full CRUD) |

Four Achilles tables in `synpuf_results` were created by `claude_dev` during a host-side Achilles run (probably via `artisan tinker` or a standalone script rather than through the containerized PHP runtime). Because those tables were owned by `claude_dev`, they received no grants for `parthenon_app` — and because `synpuf_results` had **no `ALTER DEFAULT PRIVILEGES` entry for `claude_dev`**, the grant was never propagated. The same latent bug existed for `results`, `irsf_results`, `pancreas_results`, and `eunomia_results`: whenever a future `claude_dev`-owned table appeared in any of them, it would be invisible to the runtime.

When SynPUF's `db_host` pointed at `pgsql.acumenus.net` with `username=smudoshi`, the dynamic PDO authenticated as the table owner and bypassed this entirely, hiding the grants bug in plain sight.

## Fixes

Three changes applied in the same session — none require a migration because everything lives in `app.sources` and PG catalog state:

### 1. Normalize SynPUF to the local named connection

```sql
UPDATE app.sources
SET db_host   = NULL,
    db_port   = NULL,
    db_database = NULL,
    db_options  = NULL,
    username  = NULL,
    password  = NULL,
    updated_at = NOW()
WHERE source_key = 'SYNPUF';
```

SynPUF now falls through to its named `source_connection = 'omop'` the same way Acumenus, IRSF-NHS, Pancreas, and Eunomia do. `SourceContext::forSource()` registers `ctx_cdm / ctx_results / ctx_vocab` with `search_path` baked in per daimon (`synpuf / synpuf_results / vocab`).

### 2. Backfill missing grants on `synpuf_results`

```sql
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA synpuf_results TO parthenon_app;
GRANT USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA synpuf_results TO parthenon_app;
```

### 3. Uniform default privileges across all `*_results` and CDM schemas

For every existing schema in {`results`, `synpuf_results`, `irsf_results`, `pancreas_results`, `eunomia_results`} set full-CRUD default privileges for both potential future owners (`claude_dev`, `smudoshi`):

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE claude_dev IN SCHEMA <results-schema>
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES TO parthenon_app;

ALTER DEFAULT PRIVILEGES FOR ROLE claude_dev IN SCHEMA <results-schema>
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO parthenon_app;

-- … repeat for smudoshi
```

For every existing CDM/vocab schema in {`omop`, `synpuf`, `irsf`, `pancreas`, `inpatient_ext`, `vocab`} set a **SELECT-only** default privilege — deliberately narrower than the results schemas so this change doesn't widen write access on CDM tables that were previously read-only for `parthenon_app`:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE claude_dev IN SCHEMA <cdm-schema>
  GRANT SELECT ON TABLES TO parthenon_app;

ALTER DEFAULT PRIVILEGES FOR ROLE claude_dev IN SCHEMA <cdm-schema>
  GRANT USAGE, SELECT ON SEQUENCES TO parthenon_app;

-- … repeat for smudoshi
```

The existing `smudoshi → omop` default (`arwdxt` = full CRUD plus REFERENCES/TRIGGER) is left untouched because Acumenus ETL relies on it. The new `claude_dev → omop` default only adds SELECT; it does not widen writes.

## Verification

Ran `AchillesResultReaderService` directly through `php artisan tinker` against SynPUF after each fix:

```
SYNPUF: cdm=synpuf results=synpuf_results vocab=vocab
Record counts:
  person                 2,326,856
  observation_period     2,326,856
  visit_occurrence       2,738,853
  condition_occurrence   185,951,496
  drug_exposure          109,695,947
  procedure_occurrence    75,157,233
  measurement             30,572,208
  observation             19,335,648
  death                      107,644
  drug_era                99,238,625
  condition_era          187,556,388

Demographics:
  Male      1,033,995
  Female    1,292,861

Observation periods:
  median duration: 32 days
  startYearMonth entries: 38
```

All counts agree with the physical `synpuf.*` row counts. No tables left missing `SELECT` for `parthenon_app` across the 11 in-scope schemas (verified with an audit query).

## Why this fix is permanent

1. **The connection routing is now uniform.** Every source uses its named Laravel connection. `db_host` should only be populated for genuine *remote* CDMs (Redshift, Databricks, Snowflake — the cases `DynamicConnectionFactory` was actually designed for). A local schema-isolated CDM should never have `db_host` set.

2. **Default privileges close the recurring bug.** Any future Achilles / DQD / ingestion run that creates tables under `claude_dev` or `smudoshi` ownership in any of the covered schemas will auto-grant to `parthenon_app`. The "containerized runtime role can't read host-created tables" class of bug is defended against.

3. **CDM default privilege scope is intentionally narrow.** SELECT-only on CDM schemas avoids silently widening write access on Pancreas/SynPUF/IRSF, where parthenon_app was historically read-only.

## Related files

- [`backend/app/Services/Database/DynamicConnectionFactory.php`](../../../../backend/app/Services/Database/DynamicConnectionFactory.php)
- [`backend/app/Context/SourceContext.php`](../../../../backend/app/Context/SourceContext.php)
- [`backend/app/Services/Achilles/AchillesResultReaderService.php`](../../../../backend/app/Services/Achilles/AchillesResultReaderService.php)
- [`backend/app/Http/Controllers/Api/V1/AchillesController.php`](../../../../backend/app/Http/Controllers/Api/V1/AchillesController.php)
- [`frontend/src/features/dashboard/pages/DashboardPage.tsx`](../../../../frontend/src/features/dashboard/pages/DashboardPage.tsx)

## Follow-ups

- **`inpatient`, `eunomia` (CDM), `gis` schemas don't exist on this host.** When they are created (Morpheus inpatient migration, Eunomia reload, GIS bootstrap), re-run the default-privileges loop against them.
- **Consider a unit/integration test** that asserts `parthenon_app` has SELECT on every table in every registered source's CDM + results daimon. A dedicated `SourceGrantsTest` would catch this class of bug at CI time.
- **Document the operational rule:** "If you run Achilles / DQD / ingestion from the host instead of the container, grant to `parthenon_app` before finishing." Or, better, forbid host-side runs entirely — always use `docker compose exec php artisan ...`.
