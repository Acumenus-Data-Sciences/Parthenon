---
slug: hades-12-dialect-coverage
title: "Full HADES Parity: Parthenon Now Supports All 12 OHDSI Database Dialects"
authors: [mudoshi, claude]
tags: [ohdsi, hades, database, sql, architecture, interoperability]
date: 2026-03-25
---

One of OHDSI's greatest strengths is database agnosticism. The HADES ecosystem — via SqlRender and DatabaseConnector — lets researchers write analyses once and run them against SQL Server, PostgreSQL, Oracle, Snowflake, BigQuery, and seven other platforms without modification. Today, Parthenon achieved full parity with that capability: all 12 HADES-supported database dialects are now covered across both the PHP SQL translator and the R runtime.

<!-- truncate -->

## Why This Matters

OMOP CDM databases live everywhere. Academic medical centers often run Oracle or SQL Server. Cloud-native organizations are increasingly moving to Snowflake or BigQuery. Federated networks span multiple database platforms simultaneously. If you're building a platform that replaces Atlas and WebAPI, you can't afford to be PostgreSQL-only in your SQL rendering — even if your internal database is PostgreSQL.

Parthenon has always used PostgreSQL as its production database, but the SQL translation layer is critical for two capabilities:

1. **Query Library rendering** — OHDSI's standard SQL templates are written in T-SQL (SQL Server syntax). When a researcher executes a query from the library, it gets translated to the target source's dialect at render time.

2. **Federated analysis** — Each `Source` in Parthenon can point to a different database with its own dialect. A study might pull cohorts from a local PostgreSQL CDM, run against a collaborator's Snowflake warehouse, and compare with results from an Oracle-backed registry. The `HadesBridgeService` handles the connection abstraction; the SQL translator handles the syntax.

## The 12 Dialects

OHDSI's SqlRender package (the canonical R/Java SQL translation layer) supports these 12 database platforms:

| # | Dialect | SQL Family | Typical Deployment |
|---|---------|-----------|-------------------|
| 1 | **SQL Server** | T-SQL (canonical source) | Enterprise on-prem, Azure SQL |
| 2 | **PostgreSQL** | ANSI SQL | Academic, cloud, Parthenon internal |
| 3 | **Oracle** | PL/SQL | Large health systems, pharma |
| 4 | **Redshift** | PostgreSQL variant | AWS data warehouses |
| 5 | **Snowflake** | ANSI SQL variant | Cloud analytics |
| 6 | **BigQuery** | GoogleSQL | Google Cloud OMOP deployments |
| 7 | **Azure Synapse** | T-SQL variant | Microsoft cloud OLAP |
| 8 | **Spark / Databricks** | SparkSQL | Big data / lakehouse |
| 9 | **Apache Hive** | HiveQL | Hadoop ecosystems |
| 10 | **Apache Impala** | Impala SQL | Hadoop real-time queries |
| 11 | **IBM Netezza** | PostgreSQL variant | Enterprise data warehouses |
| 12 | **DuckDB** | PostgreSQL variant | Embedded analytics, local dev |

## Parthenon's Two Translation Layers

Parthenon translates OHDSI SQL in two places, each serving a different part of the stack:

### PHP: `OhdsiSqlTranslator`

The PHP translator (`backend/app/Services/SqlRenderer/OhdsiSqlTranslator.php`) handles server-side SQL rendering for the Query Library, Achilles analysis templates, and any custom SQL that needs to target a non-PostgreSQL source. It converts T-SQL constructs — `DATEADD`, `DATEDIFF`, `GETDATE()`, `CHARINDEX`, `LEN`, `ISNULL`, `COUNT_BIG`, `CONVERT`, `TOP N`, `DATEFROMPARTS` — into dialect-appropriate equivalents.

The translation groups dialects by SQL family:
- **PostgreSQL family** (PostgreSQL, Redshift, Netezza, DuckDB) — `INTERVAL` arithmetic, `EXTRACT`, `POSITION`, `COALESCE`, `LIMIT`
- **Oracle** — `ADD_MONTHS`, `MONTHS_BETWEEN`, `TRUNC(SYSDATE)`, `FETCH FIRST N ROWS ONLY`
- **BigQuery** — `DATE_ADD`/`DATE_DIFF` with interval syntax, `CURRENT_DATE()`
- **Snowflake** — Native `DATEADD`/`DATEDIFF` (same names, different argument order from T-SQL)
- **Spark family** (Spark, Hive, Impala) — `DATE_ADD` with interval syntax
- **T-SQL family** (SQL Server, Synapse) — pass-through (canonical format)

### R Runtime: `connection.R`

The Darkstar R runtime (`r-runtime/R/connection.R`) wraps OHDSI's `DatabaseConnector` package, which handles JDBC connections to all supported platforms. When Parthenon dispatches a HADES analysis (CohortMethod, PatientLevelPrediction, SCCS), the `HadesBridgeService` translates the `Source` model into a connection spec that the R runtime uses to create a `DatabaseConnector::connectionDetails` object. SqlRender handles the SQL translation natively within R.

## Adding DuckDB: A Three-Line Change

The gap we closed today was DuckDB — supported in the R runtime's `DatabaseConnector` but missing from the PHP translator. The fix was anticlimactic:

```php
// In the match expression:
'duckdb' => $this->toPostgresql($sql),

// In the supported dialects list:
'duckdb',
```

DuckDB's SQL dialect is effectively PostgreSQL-compatible. It supports `EXTRACT`, `CURRENT_DATE`, `INTERVAL` arithmetic, `LIMIT`, `COALESCE`, `LENGTH`, `POSITION`, and `CAST` — all the constructs our PostgreSQL translator already handles. No new translation methods, no edge cases, no special handling.

This is by design. DuckDB was built as an embeddable analytical database with a familiar SQL interface. For OHDSI use cases — particularly local development, testing, and lightweight CDM exploration — DuckDB is an excellent option: it runs in-process, requires no server, and handles analytical workloads efficiently.

## Dialect Coverage Matrix

Here's the final state of dialect coverage across Parthenon's stack:

| Dialect | PHP Translator | R Runtime | Source UI | Status |
|---------|:-:|:-:|:-:|--------|
| PostgreSQL | Yes | Yes | Yes | Production-tested |
| SQL Server | Yes | Yes | Yes | Translated, untested at scale |
| Oracle | Yes | Yes | Yes | Translated, untested at scale |
| Redshift | Yes | Yes | Yes | Translated, untested at scale |
| Snowflake | Yes | Yes | Yes | Translated, untested at scale |
| BigQuery | Yes | Yes | Yes | Translated, untested at scale |
| Synapse | Yes | Yes | Yes | Pass-through (T-SQL) |
| Spark | Yes | Yes | Yes | Translated, untested at scale |
| Hive | Yes | Yes | Yes | Translated, untested at scale |
| Impala | Yes | Yes | Yes | Translated, untested at scale |
| Netezza | Yes | Yes | Yes | Translated, untested at scale |
| DuckDB | Yes | Yes | Yes | **New today** |

## What's Next

Full dialect coverage is table stakes for OHDSI platform interoperability, but coverage and correctness are different things. The next steps are:

1. **Integration testing** — We need to validate the PHP translator against real CDM queries on at least SQL Server and Oracle, the two most common non-PostgreSQL OMOP deployments in clinical research networks.

2. **Federated study execution** — With the connection plumbing in place, the goal is to demonstrate a study that federates across two different database platforms within Parthenon's study execution framework.

3. **DuckDB for local development** — DuckDB could replace the PostgreSQL dependency for developers who want to run Parthenon locally without a full database server. A lightweight CDM loader that writes to a DuckDB file would dramatically simplify onboarding.

The OHDSI ecosystem's commitment to database agnosticism is one of its strongest differentiators. Parthenon now fully inherits that capability — 12 dialects, two translation layers, one unified research platform.
