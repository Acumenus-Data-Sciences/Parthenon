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

### DB-2.1 — DuckDB

DuckDB is file-based (or in-memory) — no host, no port, no auth. The connection model is
fundamentally different: a file path replaces the network address. The R service already bundles
DatabaseConnector which supports DuckDB natively. The PHP side can proxy reads through R, or use
a lightweight DuckDB HTTP server sidecar.

**Infrastructure:**

- [ ] Evaluate two integration paths and choose one:
  - **Path A (R proxy):** All DuckDB queries routed through R service's
    `DatabaseConnector::connect()`. PHP calls `/api/execute-sql` on R service with connection
    details; R returns result as JSON. No new PHP extension needed. Adds ~50ms latency per query.
  - **Path B (DuckDB sidecar):** Run `duckdb-wasm` or `duckdb --listen` HTTP API as a sidecar
    Docker container. PHP talks to it over HTTP. More complex but lower latency.
  - **Recommended:** Path A for initial implementation — R service already handles this.
- [ ] Add `duckdb` as optional service in `docker-compose.yml` with a volume-mounted `.duckdb`
  file at `/data/duckdb/`
- [ ] No PHP PDO extension needed for Path A

**Backend:**

- [ ] Add `duckdb` dialect branch to `DynamicConnectionFactory`:
  ```php
  // DuckDB uses file path not host — route all queries through R service
  return [
      'driver'    => 'r_proxy',          // custom pseudo-driver
      'file_path' => $source->db_host,   // repurpose db_host as file path
      'read_only' => false,
  ];
  ```
- [ ] Create `RServiceQueryProxy` — sends SQL + connection details to R service endpoint,
  returns result sets as Laravel Collection-compatible arrays
- [ ] `AchillesResultReaderService` — add DuckDB branch that uses `RServiceQueryProxy` instead
  of `DB::connection()`
- [ ] Map dialect `duckdb` → SqlRender dialect `"duckdb"` in R passthrough
- [ ] DuckDB SQL audit:
  - `SET search_path` → use `USE schema` or fully-qualify table names
  - `SERIAL` → `SEQUENCE` or `INTEGER PRIMARY KEY` (DuckDB auto-increment)
  - Window functions: fully supported ✓
  - `ILIKE`: supported ✓

**Frontend:**

- [ ] Unlock DuckDB in `DatabaseStep.tsx`
- [ ] Replace host/port/database fields with a single "Database File Path" field
  (e.g. `/data/duckdb/eunomia.duckdb` or `:memory:`)
- [ ] Hide username/password fields for DuckDB (no auth)
- [ ] Add descriptive callout: "DuckDB reads directly from a file on the Parthenon server.
  Ensure the file is accessible from the Docker container."

**Eunomia migration path:**

- [ ] Investigate replacing `eunomia` PostgreSQL schema (currently loaded via `parthenon:load-eunomia`)
  with a DuckDB file containing the same GiBleed data
- [ ] If viable: deprecate `eunomia:seed-source` PostgreSQL path; new default is DuckDB file
- [ ] Reduces Docker Postgres container load; Eunomia queries run faster on DuckDB columnar engine

**Testing:**

- [ ] Download official Eunomia v2 `.duckdb` file from CDMConnector releases
- [ ] Validate Data Explorer Overview tab against DuckDB-backed Eunomia source
- [ ] Benchmark query times vs. PostgreSQL Eunomia (expect 2–5× faster on analytical queries)

---

### DB-2.2 — Google BigQuery

BigQuery has no persistent connections — every query is an authenticated HTTP request to the
Google Cloud API. PHP communicates via the `google/cloud-bigquery` REST client, not PDO. The
entire connection model must be reimplemented as an HTTP adapter.

**Infrastructure:**

- [ ] Add `google/cloud-bigquery: ^7.0` to `backend/composer.json`
- [ ] Add `GOOGLE_APPLICATION_CREDENTIALS` env var support (path to service account JSON)
- [ ] Add service account JSON file upload to source creation API:
  - New endpoint or field: `POST /api/v1/sources` accepts `service_account_json` as encrypted text
  - Store in `db_options` as `encrypted` JSON field
  - Never return `service_account_json` in any API response
- [ ] No new PHP extension needed — pure REST via Guzzle (already a Laravel dependency)

**Backend:**

- [ ] Create `BigQueryConnectionAdapter` implementing a subset of Laravel's query interface:
  ```php
  class BigQueryConnectionAdapter {
      public function select(string $sql, array $bindings = []): array;
      public function statement(string $sql): bool;
  }
  ```
  Uses `Google\Cloud\BigQuery\BigQueryClient` internally.
- [ ] `DynamicConnectionFactory` — detect `bigquery` dialect; return adapter instance rather
  than a PDO connection name
- [ ] Update `AchillesResultReaderService` to accept either `DB::connection()` or the adapter
  (extract a `QueryRunner` interface both implement)
- [ ] BigQuery SQL audit:
  - No `SET search_path` — use fully-qualified `project.dataset.table` names throughout
  - `SERIAL` / auto-increment: use `GENERATE_UUID()` or row identity from Achilles
  - Temp tables: `CREATE TEMP TABLE` creates session tables in a hidden `_SESSION` dataset
  - `DATETIME` vs `TIMESTAMP`: BigQuery distinguishes these strictly; OMOP `DATETIME` → BQ `DATETIME`
  - `ILIKE`: not supported → translate to `LOWER(col) LIKE LOWER(pattern)`
  - `LIMIT` / `OFFSET`: supported ✓
  - Integer division: `DIV` operator, not `/`
- [ ] Cost guardrail: estimate bytes billed before executing via `jobs.query` dry-run;
  reject if > configurable limit (default 10GB per query); surfaced as admin setting
- [ ] Map `bigquery` → SqlRender dialect `"bigquery"` for R service passthrough

**Frontend:**

- [ ] Unlock BigQuery in `DatabaseStep.tsx`
- [ ] Replace host/port/database with BigQuery-specific fields:
  - GCP Project ID
  - Dataset (maps to schema/daimon qualifier)
  - Service Account JSON (file upload widget or textarea; masked after save)
  - Location (US, EU, asia-northeast1, etc.) — stored in `db_options`
- [ ] Cost guardrail setting: "Max bytes per query" input (default 10GB)
- [ ] Show warning badge on BigQuery sources in list: "Charges apply per query"

**Testing:**

- [ ] GCP free tier project with BigQuery sandbox (1TB free queries/month)
- [ ] Load Eunomia GiBleed into BigQuery dataset via `bq load` or `LOAD DATA`
- [ ] Validate full Data Explorer flow against BigQuery-backed source

---

### DB-2.3 — Databricks

Databricks uses SparkSQL over JDBC. PHP has no native JDBC support — all SQL execution must be
proxied through the R service (which has DatabaseConnector + Spark JDBC support). The PHP layer
only handles metadata: storing connection credentials, displaying source info, reading
pre-computed Achilles result rows.

**Infrastructure:**

- [ ] Download Databricks JDBC driver (`DatabricksJDBC42.jar`) and place in R container's
  `/opt/jdbc/` (already the JDBC jar folder per memory — see `DATABASECONNECTOR_JAR_FOLDER`)
- [ ] Update `r-runtime/R/connection.R` to support `spark` dialect:
  ```R
  if (source$dialect == "databricks") {
    conn <- DatabaseConnector::connect(
      dbms          = "spark",
      connectionString = paste0(
        "jdbc:spark://", source$db_host, ":443/",
        source$db_database,
        ";transportMode=http;ssl=1;httpPath=", options$http_path,
        ";AuthMech=3;UID=token;PWD=", source$db_password
      ),
      pathToDriver  = "/opt/jdbc"
    )
  }
  ```
- [ ] PHP never opens a Databricks connection — all reads proxied through R service
- [ ] No new PHP extension needed

**Backend:**

- [ ] `DynamicConnectionFactory` — `databricks` dialect returns `null` (R-only); flag source
  as `r_proxy_only` in metadata
- [ ] `AchillesResultReaderService` — when source is `r_proxy_only`, delegate ALL queries to
  `RServiceQueryProxy` (built in DB-2.1)
- [ ] Databricks SQL audit (SparkSQL quirks):
  - No `CREATE TEMPORARY TABLE` → use `CREATE OR REPLACE TEMP VIEW`
  - No `SERIAL` / sequences — use `monotonically_increasing_id()` or UUIDs
  - `ILIKE`: supported ✓ (Spark 3.3+)
  - Schema: Unity Catalog uses `catalog.schema.table` (3-level); non-UC uses `schema.table`
  - `SET search_path`: not supported → always fully-qualify table names
  - Window functions: fully supported ✓
- [ ] Handle Unity Catalog 3-level namespace:
  - Add `catalog` field to `db_options`
  - Daimon `table_qualifier` becomes `catalog.schema` pair
  - Update schema-switching logic in R service connection.R

**Frontend:**

- [ ] Unlock Databricks in `DatabaseStep.tsx`
- [ ] Databricks-specific connection fields:
  - Server hostname (e.g. `adb-1234567890123456.7.azuredatabricks.net`)
  - HTTP path (e.g. `/sql/1.0/warehouses/abcdef1234567890`)
  - Personal access token (masked after save)
  - Catalog name (for Unity Catalog; optional for legacy hive_metastore)
  - SQL warehouse vs. cluster toggle (stored in `db_options`)
- [ ] Show informational note: "All queries run through the Parthenon R service via JDBC.
  Ensure your SQL warehouse or cluster is running before executing analyses."
- [ ] Badge on Databricks sources in list: "R-proxied"

**Testing:**

- [ ] Databricks Community Edition (free) for integration testing
- [ ] Load Eunomia GiBleed as Delta table via `spark.createDataFrame()` + `.write.saveAsTable()`
- [ ] Validate Achilles result reads via R proxy end-to-end
- [ ] Test Unity Catalog path separately from legacy metastore path

---

## Phase DB-3 — Tier 3 (As Needed / Community Driven)

These are lower-priority because adoption in new OMOP deployments is declining or the use case
is narrow. Implement when a specific partner or community demand makes them worthwhile.

### DB-3.1 — MySQL / MariaDB

**When to implement:** If a partner site has an existing OMOP CDM on MySQL and cannot migrate.
Most MySQL OMOP deployments are legacy; almost no new ones are created.

**Key challenges:**
- [ ] OMOP CDM DDL uses `BIGINT` for most IDs; MySQL has stricter integer overflow handling
- [ ] No `SCHEMA` concept — databases serve as schemas; `search_path` equivalent is `USE db`
- [ ] SqlRender dialect `"mysql"` exists but has known edge cases with date arithmetic
- [ ] `SERIAL` → `AUTO_INCREMENT` (different syntax)
- [ ] `TEXT` vs `VARCHAR(MAX)` handling for note_text, value_as_string fields
- [ ] Laravel ships with `mysql` driver — no new extension needed
- [ ] Add `mysql` / `mariadb` branch to `DynamicConnectionFactory` (trivial given Laravel support)
- [ ] Audit: `GROUP BY` strict mode, `ONLY_FULL_GROUP_BY` SQL mode must be disabled for some
  Achilles queries
- [ ] Add MySQL icon to wizard DB picker
- [ ] **Decision gate:** Only proceed if a real partner site requests it

---

### DB-3.2 — Microsoft Fabric (OneLake)

**When to implement:** When Microsoft Fabric GA stabilizes and a health system partner requests it.
Currently too early — APIs and SQL endpoints are changing rapidly.

**Key challenges:**
- [ ] Fabric has two SQL engines: Warehouse (T-SQL, like Synapse) and Lakehouse SQL endpoint
  (SparkSQL-compatible) — need to support both or pick one
- [ ] OneLake storage is shared; OMOP CDM lives as Delta tables
- [ ] Auth: Entra ID (Azure AD) — service principal or managed identity; no username/password
- [ ] PHP connector: same `sqlsrv` as SQL Server/Synapse for Warehouse; R proxy for Lakehouse
- [ ] SqlRender: no dedicated Fabric dialect yet — use `"synapse"` for Warehouse endpoint
- [ ] `db_options` needs: workspace ID, item ID (Warehouse or Lakehouse GUID)
- [ ] **Decision gate:** Wait for SqlRender official Fabric dialect support; check OHDSI forums

---

### DB-3.3 — IBM Netezza

**When to implement:** Only if an existing partner runs Netezza and has no migration path. IBM
is end-of-life-ing Netezza; all new deployments should go to alternative platforms.

**Key challenges:**
- [ ] IBM ODBC driver required (proprietary, license-gated)
- [ ] PHP: ODBC extension + Netezza ODBC DSN
- [ ] SqlRender dialect `"netezza"` exists (legacy) but is unmaintained
- [ ] No Docker/container test environment available without IBM license
- [ ] `DISTRIBUTE ON` clause in DDL; `GROOM TABLE` for vacuuming — not relevant to reads
- [ ] **Decision gate:** Only if a partner explicitly requests and provides test environment

---

### DB-3.4 — Teradata

**When to implement:** VA/DoD or large health system with existing Teradata investment.
Declining platform; very few new OMOP deployments.

**Key challenges:**
- [ ] Teradata ODBC or JDBC driver (proprietary)
- [ ] PHP: `pdo_odbc` + Teradata ODBC DSN or R-proxy via JDBC
- [ ] SqlRender dialect `"pdw"` (Parallel Data Warehouse) is closest — deprecated but functional
- [ ] Multi-value INSERT syntax differs; `TOP n` instead of `LIMIT n`
- [ ] `VOLATILE TABLE` for temp tables (session-scoped, Teradata-specific)
- [ ] No free-tier test environment
- [ ] **Decision gate:** Only if a paying partner requires it

---

### DB-3.5 — Apache Hive / Impala (Legacy)

**When to implement:** Almost certainly never for new work. OHDSI deprecated Impala support.
CDH clusters are being migrated to Databricks/Spark everywhere.

**Note:** If a site is on Hive/Impala they should be migrating to Databricks (DB-2.3).
Document the migration path instead of building new Hive support.

- [ ] **Decision gate:** Do not implement; direct users to Databricks migration guide

---

## Acceptance Criteria by Phase

### Phase DB-1 Complete
- [ ] A user can register Redshift, Snowflake, SQL Server, Oracle, or Synapse source
  **entirely through the UI wizard without editing any config files**
- [ ] "Test Connection" validates credentials and schema presence before save
- [ ] Achilles result reads (Data Explorer Overview) work for all Tier 1 dialects
- [ ] Cohort generation (R service) works for all Tier 1 dialects
- [ ] Incorrect credentials return actionable 422 error (not 500)
- [ ] Passwords never appear in any API response
- [ ] All Tier 1 dialects are selectable in the wizard (no "Coming soon")

### Phase DB-2 Complete
- [ ] DuckDB file-backed sources appear in Data Explorer with full characterization
- [ ] Eunomia demo source migrated to DuckDB (no separate PostgreSQL Eunomia schema needed)
- [ ] BigQuery sources work end-to-end with service account auth and cost guardrail
- [ ] Databricks sources execute all analyses via R service proxy; Unity Catalog namespace supported
- [ ] `RServiceQueryProxy` handles DuckDB, BigQuery read-path, and Databricks uniformly

### Phase DB-3 Complete (per dialect)
- [ ] Each Tier 3 dialect added only when a specific partner requests it with a test environment
- [ ] Microsoft Fabric added when SqlRender provides official dialect support
- [ ] MySQL added if OHDSI community formalizes SqlRender MySQL support

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
