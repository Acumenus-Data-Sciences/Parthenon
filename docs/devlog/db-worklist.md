# Database Expansion Worklist

**Created:** 2026-03-04
**Reference:** [db-landscape.md](./db-landscape.md)
**Scope:** Enable all Tier 1 databases + lay groundwork for Tier 2

---

## Phase DB-1 — Tier 1 (Current Sprint)

### DB-1.1 — Dynamic Connection Factory ⚠️ PREREQUISITE

Everything else depends on this. The current architecture requires a named entry in
`config/database.php` for every source. This task replaces that with runtime-provisioned
connections built from `sources` table metadata.

**Backend tasks:**

- [ ] Add migration: new columns on `sources` table
  ```sql
  db_host          varchar(255)  nullable
  db_port          smallint      nullable
  db_database      varchar(255)  nullable
  db_username      varchar(255)  nullable
  db_password      text          nullable  -- use Laravel encrypted cast
  db_options       text          nullable  -- encrypted JSON: warehouse, role, account, project, etc.
  ```
- [ ] Create `App\Services\DynamicConnectionFactory` service
  - `make(Source $source): string` — returns a unique connection name
  - Calls `DB::purge($name)` then `config(['database.connections.'.$name => [...]])` then returns `$name`
  - Supports dialects: `postgresql`, `sqlserver`, `oracle`, `redshift`, `snowflake`, `synapse`
  - Falls back to `source_connection` (existing named config) if `db_host` is null
- [ ] Update `StoreSourceRequest` and `UpdateSourceRequest` to accept new fields
- [ ] Update `SourceResource` to include new fields (mask `db_password`)
- [ ] Update `AchillesResultReaderService::setSchemaForSource()` to use factory instead of
  hardcoded connection names
- [ ] Update `CdmModel` base class connection resolution to use factory
- [ ] Add `POST /api/v1/sources/test-connection` endpoint
  - Accepts same payload as store; attempts a `SELECT 1` via the dynamic connection
  - Returns `{ success: bool, latency_ms: int, error: string|null }`
  - No auth required beyond `auth:sanctum` + `role:admin`

**Frontend tasks:**

- [ ] Expand wizard Step 2 (Connection) with new fields:
  - Host, Port, Database Name, Username, Password (masked) inputs
  - `db_options` as a key-value editor (for warehouse, role, account, etc.)
  - Toggle: "Use named Laravel connection" vs "Enter credentials directly"
  - "Test Connection" button (calls the new endpoint, shows latency or error inline)
- [ ] Update `SourcesListPage` expanded detail to show host/database (never password)
- [ ] Update `sourcesApi.ts` types for new fields

---

### DB-1.2 — SQL Server Support

UI already shows SQL Server as selectable. Backend does not handle it. Gap to close:

**Docker / infrastructure:**

- [ ] Add `sqlsrv` and `pdo_sqlsrv` PHP extensions to `docker/php/Dockerfile`
  - Install `msodbcsql18` (Microsoft ODBC driver) + `unixODBC-dev` first
  - Use `pecl install sqlsrv pdo_sqlsrv`
  - Add `extension=pdo_sqlsrv.so` to `php.ini`
- [ ] Add `sqlserver` connection template to `DynamicConnectionFactory`:
  ```php
  'driver'   => 'sqlsrv',
  'host'     => $source->db_host,
  'port'     => $source->db_port ?? 1433,
  'database' => $source->db_database,
  'username' => $source->db_username,
  'password' => decrypt($source->db_password),
  'charset'  => 'utf8',
  'prefix'   => '',
  'encrypt'  => 'yes',
  'trust_server_certificate' => false,
  ```

**Backend:**

- [ ] Map dialect `sqlserver` → SqlRender dialect `"sql server"` in R service proxy
- [ ] Verify `AchillesResultReaderService` SQL is ANSI-compatible (no PostgreSQL-specific syntax)
  - Known risk: `ILIKE` → `LIKE` (case insensitive), interval arithmetic, `::` casts
  - Audit and parameterize any dialect-specific SQL through SqlRender

**Testing:**

- [ ] Spin up `mcr.microsoft.com/mssql/server:2022-latest` in `docker-compose.yml` as optional
  dev service (`profiles: [sqlserver]`)
- [ ] Load Eunomia GiBleed into SQL Server test instance
- [ ] Verify Achilles result reads, cohort generation returns correct row counts

---

### DB-1.3 — Oracle Support

Similar to SQL Server — UI selectable, backend unimplemented.

**Docker / infrastructure:**

- [ ] Add `oci8` PHP extension to `docker/php/Dockerfile`
  - Install Oracle Instant Client (Basic + SDK) from Oracle's yum repo or zip
  - `pecl install oci8` with `instantclient,/usr/lib/oracle/21/client64/lib`
  - ⚠️ Oracle Instant Client requires accepting Oracle license — document this for users
- [ ] Add `oracle` connection template to `DynamicConnectionFactory`:
  ```php
  'driver'   => 'oci8',        // or use yajra/laravel-oci8 package
  'host'     => $source->db_host,
  'port'     => $source->db_port ?? 1521,
  'database' => $source->db_database,  // SID or service name
  'username' => $source->db_username,
  'password' => decrypt($source->db_password),
  'charset'  => 'AL32UTF8',
  ```
- [ ] Evaluate `yajra/laravel-oci8` composer package vs. raw `oci8` PDO driver

**Backend:**

- [ ] Map dialect `oracle` → SqlRender dialect `"oracle"`
- [ ] Audit result-reader SQL for Oracle incompatibilities:
  - `LIMIT` / `OFFSET` → `FETCH FIRST n ROWS ONLY` / `ROWNUM`
  - `SERIAL` / sequences vs `IDENTITY`
  - Schema quoting: Oracle uses uppercase identifiers by default

**Testing:**

- [ ] Oracle Express Edition (`container-registry.oracle.com/database/express:21.3.0-xe`) as
  optional dev service
- [ ] Load Eunomia GiBleed, validate basic CDM queries

---

### DB-1.4 — Amazon Redshift

Lowest-lift Tier 1 addition — reuses the `pgsql` PHP driver with endpoint override.

**Infrastructure:**

- [ ] Add `redshift` connection template to `DynamicConnectionFactory`:
  ```php
  'driver'   => 'pgsql',
  'host'     => $source->db_host,     // e.g. cluster.xxxx.us-east-1.redshift.amazonaws.com
  'port'     => $source->db_port ?? 5439,
  'database' => $source->db_database,
  'username' => $source->db_username,
  'password' => decrypt($source->db_password),
  'charset'  => 'utf8',
  'sslmode'  => 'require',
  ```
  No new PHP extension needed — pgsql driver already installed.

**Backend:**

- [ ] Map dialect `redshift` → SqlRender dialect `"redshift"`
- [ ] Audit result-reader SQL for Redshift incompatibilities:
  - `SERIAL` columns not supported — use `IDENTITY(1,1)` or skip on read-only path
  - `pg_catalog` schema queries don't work on Redshift — avoid in introspection
  - `ILIKE`, `SIMILAR TO` work; `RETURNING` clause does not
- [ ] Redshift does not support `SET search_path` per-transaction in the same way — verify
  `AchillesResultReaderService` schema-switching works; may need `SET search_path TO schema`
  as session-level SET

**Frontend:**

- [ ] Unlock Redshift in `DatabaseStep.tsx` — move from "Coming soon" to "Supported"
- [ ] Add Redshift-specific `db_options` hint: "Cluster identifier (optional)"

**Testing:**

- [ ] No local Docker option for Redshift — use AWS free tier test cluster or mock with
  PostgreSQL (acceptable for CI; note dialect differences)
- [ ] Document Redshift IAM auth as future enhancement (current: username/password only)

---

### DB-1.5 — Snowflake

Highest business value. Requires new PHP driver.

**Infrastructure:**

- [ ] Add `snowflake-pdo` to `docker/php/Dockerfile`:
  ```dockerfile
  RUN cd /tmp && \
      curl -L https://sfc-repo.snowflakecomputing.com/odbc/linux/latest/snowflake-odbc-*.x86_64.rpm -o sf.rpm && \
      alien --install sf.rpm && \
      pecl install pdo_snowflake && \
      echo "extension=pdo_snowflake.so" > /usr/local/etc/php/conf.d/snowflake.ini
  ```
  Alternative: use the official `snowflakedb/pdo_snowflake` PECL package.
- [ ] Add `snowflake` connection template to `DynamicConnectionFactory`:
  ```php
  'driver'   => 'snowflake',
  'host'     => $options['account'].'.snowflakecomputing.com',
  'database' => $source->db_database,
  'username' => $source->db_username,
  'password' => decrypt($source->db_password),
  'warehouse'=> $options['warehouse'],
  'schema'   => $options['schema'] ?? 'PUBLIC',
  'role'     => $options['role'] ?? null,
  ```
  The `db_options` JSON holds `account`, `warehouse`, `role`.

**Backend:**

- [ ] Map dialect `snowflake` → SqlRender dialect `"snowflake"`
- [ ] Audit result-reader SQL:
  - `ILIKE` → Snowflake supports it ✓
  - `TIMESTAMP` precision defaults differ — OMOP uses `DATE` and `DATETIME` columns
  - Temp table syntax: `CREATE TEMPORARY TABLE` works but scope is session
  - `QUALIFY` window function clause available — don't rely on it in shared SQL
- [ ] Snowflake session parameters: set `TIMEZONE`, `DATE_OUTPUT_FORMAT` on connection open

**Frontend:**

- [ ] Unlock Snowflake in `DatabaseStep.tsx`
- [ ] Add Snowflake-specific fields to wizard Step 2:
  - Account identifier (e.g. `xy12345.us-east-1`)
  - Warehouse name
  - Role (optional)
  - These go into `db_options`

**Testing:**

- [ ] Snowflake 30-day free trial account for CI/integration testing
- [ ] Load Eunomia GiBleed via `COPY INTO` from S3/GCS staging
- [ ] Validate Achilles result reads and source selector

---

### DB-1.6 — Azure Synapse Analytics

Reuses SQL Server driver — mostly config and SqlRender mapping.

**Infrastructure:**

- [ ] Depends on DB-1.2 (SQL Server `sqlsrv` extension already installed)
- [ ] Add `synapse` connection template to `DynamicConnectionFactory`:
  ```php
  'driver'    => 'sqlsrv',
  'host'      => $source->db_host,    // workspace.sql.azuresynapse.net
  'port'      => $source->db_port ?? 1433,
  'database'  => $source->db_database,
  'username'  => $source->db_username,
  'password'  => decrypt($source->db_password),
  'encrypt'   => 'yes',
  'trust_server_certificate' => false,
  ```

**Backend:**

- [ ] Map dialect `synapse` → SqlRender dialect `"synapse"`
- [ ] Note: Synapse Dedicated SQL Pool does not support all T-SQL — no `MERGE`, limited
  `CREATE TABLE AS SELECT`. Audit result-reader for these.
- [ ] Synapse does not support `TRANSACTION` around DDL. Keep result reads as pure SELECTs (already the case).

**Frontend:**

- [ ] Unlock Synapse in `DatabaseStep.tsx` — rename displayed card from "Coming soon"
- [ ] Add icon: Azure Synapse has a distinct icon from generic SQL Server — download from
  Simple Icons or Azure icon set

**Testing:**

- [ ] Azure Synapse serverless SQL pool is free; use for CI
- [ ] Dedicated pool testing requires a paid Azure subscription — optional

---

## Phase DB-2 — Tier 2 (6–12 Months)

> Detailed tasks TBD based on Phase DB-1 learnings. High-level scope:

### DB-2.1 — DuckDB
- [ ] Route through R service (`DatabaseConnector::connect()` with DuckDB driver) for all SQL
- [ ] Add `duckdb` file-path connection type (no host/port — just a file path field)
- [ ] Enable Eunomia v2 DuckDB files as drop-in replacement for current PostgreSQL Eunomia source
- [ ] Explore replacing `docker/postgres` Eunomia container with in-process DuckDB

### DB-2.2 — Google BigQuery
- [ ] Add `google/cloud-bigquery` composer package
- [ ] Build `BigQueryConnection` adapter implementing Laravel's `Connection` interface
- [ ] Handle service account JSON upload/storage (encrypted in `db_options`)
- [ ] Add per-query cost estimation guard (warn if estimated bytes > threshold)

### DB-2.3 — Databricks
- [ ] Route all SQL through R service — PHP side only reads result metadata
- [ ] Add JDBC connection config passthrough to R service API
- [ ] Handle Unity Catalog 3-level namespace in schema qualifier fields
- [ ] Personal access token auth via `db_options`

---

## Cross-Cutting Work (All Phases)

### Connection Test UX
- [ ] "Test Connection" button in wizard Step 2 (`POST /api/v1/sources/test-connection`)
- [ ] Show latency badge and dialect-specific diagnostics (schema exists, CDM tables present)
- [ ] Surface common errors with actionable messages (wrong port, SSL required, bad credentials)

### Wizard Step 2 — Dialect-Aware Fields
- [ ] When dialect changes, dynamically show/hide relevant fields:
  - PostgreSQL/Redshift: host, port, database, username, password, sslmode
  - SQL Server/Synapse: host, port, database, username, password, encrypt, trust cert
  - Oracle: host, port, SID/service name, username, password, charset
  - Snowflake: account, warehouse, database, schema, role, username, password
  - BigQuery: project ID, dataset, service account JSON upload
  - DuckDB: file path
- [ ] Connection string preview (read-only, masked password) so admins can verify before saving

### Documentation
- [ ] Update user manual chapter "Adding a Data Source" with per-dialect connection instructions
- [ ] Document Docker Compose profiles for optional dev databases (`--profile sqlserver`, etc.)
- [ ] Add troubleshooting section per dialect (common errors, firewall requirements, SSL certs)

### R Service Passthrough
- [ ] Verify `r-runtime` passes `source_dialect` to `DatabaseConnector::createConnectionDetails()`
  for all new dialects — currently hardcoded to `"postgresql"` in connection.R

### Security
- [ ] All `db_password` values stored with Laravel `encrypted` cast (AES-256-CBC)
- [ ] `db_options` JSON stored with `encrypted` cast
- [ ] `SourceResource` never serializes password fields — add `$hidden` guard
- [ ] Connection credentials purged from Laravel connection pool after request completes
  (`DB::purge($dynamicConnectionName)` in request termination hook)

---

## Acceptance Criteria (Phase DB-1 Complete)

- [ ] A user can add a Redshift, Snowflake, SQL Server, Oracle, or Synapse source through the
  wizard UI **without editing any PHP config files**
- [ ] "Test Connection" validates credentials and schema presence before save
- [ ] Achilles result reads (Data Explorer Overview tab) work for all Tier 1 dialects
- [ ] Cohort generation (R service) works for all Tier 1 dialects
- [ ] Incorrect credentials show an actionable error, not a 500
- [ ] Passwords are never returned in any API response
- [ ] All Tier 1 dialects appear as selectable (not "Coming soon") in the Add Source wizard
