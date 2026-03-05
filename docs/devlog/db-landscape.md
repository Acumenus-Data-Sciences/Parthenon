# Database Support Landscape & Roadmap

**Author:** Claude Sonnet 4.6
**Date:** 2026-03-04
**Status:** Planning

---

## Context

Parthenon targets the OHDSI research network — 400+ data partners across 70+ countries running
OMOP CDM v5.4. The right question is not "what databases exist?" but **"where does OMOP data
actually live in the real world?"** The answer varies sharply by institution type:

| Institution Type | Common Infrastructure |
|---|---|
| Academic medical centers | SQL Server (Epic/Clarity ETL), PostgreSQL |
| Pharma / CROs | Snowflake, Databricks, Redshift |
| National programs (NIH, NHS, All of Us) | BigQuery, Snowflake |
| Community hospitals | SQL Server, MySQL |
| Veterans Affairs / DoD | SQL Server, Oracle |
| Health tech / startups | PostgreSQL, DuckDB |

The OHDSI R layer (**DatabaseConnector / SqlRender**) is the reference implementation. It currently
supports: PostgreSQL, SQL Server, Oracle, Redshift, BigQuery, Snowflake, Spark, Synapse, DuckDB,
SQLite. Parthenon's dialect support should track this list.

---

## Current State (as of 2026-03-04)

| Dialect | Wizard UI | Laravel Driver | R/SqlRender | Achilles Read |
|---|---|---|---|---|
| PostgreSQL | ✅ Selectable | ✅ pgsql | ✅ postgresql | ✅ |
| Oracle | ✅ Selectable | ⚠️ oci8 (needs ext) | ✅ oracle | ❌ |
| SQL Server | ✅ Selectable | ⚠️ sqlsrv (needs ext) | ✅ sql server | ❌ |
| Redshift | 🔲 Coming soon | ❌ | ✅ redshift | ❌ |
| Snowflake | 🔲 Coming soon | ❌ | ✅ snowflake | ❌ |
| Azure Synapse | 🔲 Coming soon | ❌ | ✅ synapse | ❌ |
| Databricks | 🔲 Coming soon | ❌ | ✅ spark | ❌ |
| BigQuery | 🔲 Coming soon | ❌ | ✅ bigquery | ❌ |
| DuckDB | 🔲 Coming soon | ❌ | ✅ duckdb | ❌ |

> **Note:** Oracle and SQL Server are shown as selectable in the UI but the backend does not yet
> build dynamic connections for them. They require the `oci8` and `sqlsrv` PHP extensions
> respectively, and named entries in `config/database.php`. This is the same gap that affects
> all non-PostgreSQL dialects — see the "Dynamic Connection Architecture" section below.

---

## Tier 1 — Ship Next (High OHDSI Adoption, Clear Demand)

### Amazon Redshift

**Why:** Dominant in pharma RWE. Aetion, Flatiron, IQVIA, and IBM MarketScan all host OMOP on
Redshift. OHDSI network studies routinely execute on Redshift. Estimated ~15% of active OHDSI
network sites.

**Technical profile:**
- PostgreSQL wire-compatible — PHP `pgsql` driver works with host/port override
- Quirks: no DDL in transactions, `DISTSTYLE`/`SORTKEY` on CDM tables, temp table session scope
- SqlRender dialect: `"redshift"` (mature, well-tested)
- Auth: IAM roles or username/password; SSL required
- Schema: same OMOP DDL as PostgreSQL with minor type differences

**Complexity:** Low-Medium. Closest to PostgreSQL of all cloud warehouses.

---

### Snowflake

**Why:** Fastest-growing in life sciences. The All of Us Research Program (1M+ participants),
EHDEN (European federated network), and virtually every pharma company starting a new OMOP CDM
in 2024+ is on Snowflake. Becoming the de facto standard for new deployments.

**Estimated OHDSI adoption:** ~20%+ of active sites by 2026, highest growth rate of any platform.

**Technical profile:**
- PHP driver: `snowflake-pdo` (Snowflake official PHP PDO driver, installable via composer)
- Connection string: `account`, `warehouse`, `database`, `schema`, `role` params — more than
  host/port/dbname
- Quirks: virtual warehouse auto-suspend breaks long-running queries; temp objects are
  session-scoped views; `TIMESTAMP_NTZ` vs `TIMESTAMP_TZ` matters for OMOP date fields
- SqlRender dialect: `"snowflake"` (well-supported)
- Auth: username/password or key-pair (RSA private key)

**Complexity:** Medium.

---

### Azure Synapse Analytics

**Why:** Microsoft-heavy health systems (Mayo Clinic, Cleveland Clinic, many VA-adjacent networks)
land OMOP in Synapse as part of Azure Health Data Services. Microsoft is actively partnering with
the OHDSI community. If a health system is on Azure, they are likely landing data in Synapse.

**Technical profile:**
- T-SQL compatible — same `sqlsrv` PHP extension as SQL Server
- Distribution keys (`HASH`, `ROUND_ROBIN`) affect query performance but not correctness
- Dedicated SQL pool vs. serverless — OMOP CDM lives in dedicated pool; temp tables work normally
- SqlRender dialect: `"synapse"` (supported)
- Auth: SQL auth or Azure AD; connection string nearly identical to SQL Server

**Complexity:** Low (if SQL Server driver is already installed — same extension, minor config diff).

---

## Tier 2 — 6–12 Months Out (Real Need, Higher Complexity)

### Databricks (Delta Lake / Unity Catalog)

**Why:** Increasingly used for lakehouse OMOP deployments where raw EHR data lands in Delta and
is ETL'd in-place. FDA Sentinel, several CMS programs, and multiple pharma partners use
Databricks. Primary platform for ML-augmented phenotyping (PheWAS, LLM-based cohort definitions).
Natural affinity with Parthenon's AI features.

**Technical profile:**
- SparkSQL dialect via JDBC (Databricks JDBC driver)
- Temp tables require workarounds: CTEs or `CREATE TEMPORARY VIEW` (no `#temp` tables)
- Unity Catalog adds 3-level namespace: `catalog.schema.table`
- PHP: JDBC bridge required (no native PDO); likely routed through the R service
- SqlRender dialect: `"spark"` (supported but some edge cases)
- Auth: personal access token or OAuth M2M

**Complexity:** High. Stateless compute model, no traditional transactions, different session
management. Most practical path: R service handles all SQL translation and execution; PHP only
reads result metadata.

**Strategic value:** Very high — this is where AI/ML meets OMOP.

---

### Google BigQuery

**Why:** The **All of Us Research Program** (NIH, 1M+ participants) runs on BigQuery. Multiple
OHDSI consortium projects target BigQuery. Standard in GCP-contracted academic medical centers.

**Technical profile:**
- Serverless; pricing per byte scanned — accidental full-table scans are expensive
- No persistent connections; each query is an independent HTTP API call
- Naming: `project.dataset.table` (3-level)
- Temp tables: `CREATE TEMPORARY TABLE` creates session-scoped tables in a special dataset
- PHP: `google/cloud-bigquery` composer package (no PDO); requires service account JSON
- SqlRender dialect: `"bigquery"` (supported)
- Auth: service account JSON key file or Workload Identity

**Complexity:** High. Completely different auth/connection model; query costs require guardrails;
no persistent connection pool.

**Strategic value:** High for NIH-funded research; moderate otherwise.

---

### DuckDB

**Why:** The most important underrated option for OHDSI. DuckDB enables a full OMOP CDM **from a
Parquet or CSV file with zero infrastructure**. This is transformational for:

- Local development and testing without spinning up a database server
- Pilot/demo installations for new sites (replace current Eunomia PostgreSQL setup entirely)
- Researchers running analyses on their laptop against a CDM slice
- The OHDSI R ecosystem (Eunomia v2, CDMConnector) is standardizing on DuckDB for testing

**Technical profile:**
- File-based or in-memory; no server, no port, no auth
- PHP: `duckdb-php` (community extension) or route through R service (Eunomia v2 uses DuckDB)
- SqlRender dialect: `"duckdb"` (supported, used in OHDSI test suites)
- Connection "string": a file path (e.g. `/data/eunomia.duckdb`) or `:memory:`
- Full OMOP DDL compatibility; fast columnar execution on local files

**Complexity:** Medium. Very different deployment model (file vs. network) but SQL is standard.

**Strategic value:** Extremely high for onboarding, demos, and developer experience.

---

## Tier 3 — Monitor, Don't Build Yet

### MySQL / MariaDB
Laravel supports it natively and many smaller health systems run MySQL. However, OMOP CDM on
MySQL lacks full SqlRender support, has `BIGINT`/`INT` schema mismatches, and serious OMOP users
rarely run MySQL in production. Revisit if community demand materializes.

### IBM Netezza / Teradata
Legacy enterprise installations (some VA/DoD). OHDSI had historical support. Both platforms are
in secular decline — Netezza is being sunset by IBM. Low ROI.

### Microsoft Fabric (OneLake)
Microsoft's next-generation unified lakehouse. Several health systems are evaluating. Too early —
still maturing. Synapse support covers the overlap for now. Revisit in 12–18 months.

### Hive / Impala
OHDSI had Impala support (deprecated). CDH clusters are being replaced by Spark/Databricks.
No new OMOP deployments. Skip.

---

## The Architecture Gap: Dynamic Connection Provisioning

The current wizard asks for a "Laravel connection name" — this **forces sysadmins to edit
`config/database.php` before the UI wizard can work**, which undermines the wizard's purpose
entirely. Every non-PostgreSQL dialect compounds this problem.

**The right architecture** (how Atlas WebAPI works):

Store enough metadata in the `sources` table to build a PDO connection at runtime:

```
sources table additions:
  db_host          varchar
  db_port          integer
  db_database      varchar
  db_username      varchar
  db_password      text (encrypted)
  db_options       jsonb  -- warehouse, role, account, project, etc.
```

A `DynamicConnectionFactory` service reads these fields and calls
`DB::purge() / DB::extend()` to register a named connection on the fly, then routes CDM queries
through it. The `source_connection` field becomes optional (falls back to dynamic).

This eliminates the "edit a PHP config file" step entirely and enables:
- Adding a Snowflake source without a code deploy
- Rotating credentials through the UI
- Connection-per-request isolation for multi-tenant safety

---

## Implementation Order Summary

```
Phase DB-1 (Tier 1 — next sprint):
  1. Dynamic connection factory (prerequisite for everything)
  2. SQL Server + Oracle — complete what the UI already promises
  3. Amazon Redshift — lowest lift, reuses pgsql driver
  4. Snowflake — highest demand, dedicate effort
  5. Azure Synapse — reuses SQL Server driver

Phase DB-2 (Tier 2 — 6–12 months):
  6. DuckDB — via R service bridge initially, then native
  7. BigQuery — via service account JSON + google/cloud-bigquery
  8. Databricks — R-service-mediated execution only initially

Phase DB-3 (Tier 3 — as needed):
  9. Microsoft Fabric (when GA/stable)
  10. MySQL (if community demand)
```

---

## References

- [OHDSI DatabaseConnector](https://github.com/OHDSI/DatabaseConnector) — supported dialects
- [OHDSI SqlRender](https://github.com/OHDSI/SqlRender) — SQL translation engine
- [All of Us BigQuery OMOP](https://support.researchallofus.org/hc/en-us/articles/360039170491)
- [EHDEN Snowflake deployments](https://www.ehden.eu/)
- [Eunomia v2 / DuckDB](https://github.com/darwin-eu-dev/CDMConnector)
- [Snowflake PHP PDO driver](https://github.com/snowflakedb/pdo_snowflake)
