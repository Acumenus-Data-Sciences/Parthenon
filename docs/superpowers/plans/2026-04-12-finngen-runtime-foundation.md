# FinnGen Runtime Foundation (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Darkstar the host runtime for three FinnGen R packages (ROMOPAPI, HadesExtras, CO2AnalysisModules) and deliver the Laravel ↔ Darkstar handshake, `finngen_runs` durability, idempotency, and artifact plumbing that SP2–4 will consume. No user-visible UI ships in SP1.

**Architecture:** Laravel owns the user-visible run lifecycle and RBAC; Horizon dispatches `RunFinnGenAnalysisJob` which polls Darkstar's existing `/jobs/{id}` Plumber endpoint backed by mirai daemons. Darkstar hosts three new installed R packages behind new `api/finngen/*.R` routes (sync reads + async execution). Artifacts land on a shared `finngen-artifacts` Docker volume. The old `parthenon-finngen-runner` Python service and `StudyAgent/FinnGen*.php` layer are deleted in the same PR.

**Tech Stack:** Laravel 11, PHP 8.4, Pest, Sanctum, Horizon, Redis 7, Postgres 16/17, Plumber2 + mirai (R), testthat, React 19 + TanStack Query + Vitest, Playwright, Docker Compose, Nginx, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-04-12-finngen-runtime-foundation-design.md`
**SP2–4 handoff:** `docs/superpowers/specs/2026-04-12-finngen-workbench-subprojects-handoff.md`

---

## Part A — Infrastructure Foundation

Before writing any application code we lay down the Docker volume, Postgres roles, and compose surgery. Nothing downstream works until these exist.

### Task A1: Create the `finngen-artifacts` shared volume

**Files:**
- Modify: `docker-compose.yml` (add volume definition + two mounts)

- [ ] **Step 1: Inspect current compose surface**

Run: `grep -n "finngen\|volumes:\|r-runtime\|darkstar\|^  php:" docker-compose.yml | head -40`

Expected: see the existing `darkstar` / `r-runtime` service, the `php` service, and the `volumes:` section near the bottom.

- [ ] **Step 2: Add the `finngen-artifacts` volume definition**

In the top-level `volumes:` block at the bottom of `docker-compose.yml`, add after existing entries:

```yaml
  finngen-artifacts:
    name: parthenon_finngen_artifacts
```

- [ ] **Step 3: Mount the volume into the Darkstar (r-runtime) service**

Find the `r-runtime:` service block. Under its `volumes:` key, add:

```yaml
      - finngen-artifacts:/opt/finngen-artifacts
```

- [ ] **Step 4: Mount the volume into the `php` service**

Find the `php:` service block. Under its `volumes:` key, add:

```yaml
      - finngen-artifacts:/opt/finngen-artifacts
```

- [ ] **Step 5: Validate compose config**

Run: `docker compose config --quiet && echo OK`
Expected: `OK` with no error lines.

- [ ] **Step 6: Create the volume & verify mounts**

Run:
```bash
docker compose up -d --no-build darkstar php
docker compose exec darkstar sh -c 'mkdir -p /opt/finngen-artifacts/runs && touch /opt/finngen-artifacts/.probe && ls -la /opt/finngen-artifacts'
docker compose exec php sh -c 'ls -la /opt/finngen-artifacts && cat /opt/finngen-artifacts/.probe'
```
Expected: both containers see the `.probe` file. `runs/` directory listed.

- [ ] **Step 7: Fix cross-container permissions**

Run: `docker compose exec darkstar sh -c 'stat -c "%u:%g %a" /opt/finngen-artifacts'`

If owner is `0:0` root or permissions block the PHP user, set umask + shared group:

```bash
docker compose exec --user root darkstar sh -c 'chgrp -R www-data /opt/finngen-artifacts && chmod -R g+rwX /opt/finngen-artifacts && find /opt/finngen-artifacts -type d -exec chmod g+s {} \;'
docker compose exec --user root php sh -c 'ls -la /opt/finngen-artifacts/.probe && cat /opt/finngen-artifacts/.probe'
```

The `chmod g+s` on directories ensures new files inherit the group. Record the final chmod + chgrp behavior; this will be baked into the Darkstar entrypoint in Task B1.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(finngen): add finngen-artifacts shared volume to darkstar + php"
```

### Task A2: Create the two FinnGen Postgres roles

**Files:**
- Create: `backend/database/migrations/YYYY_MM_DD_HHMMSS_create_finngen_db_roles.php`

- [ ] **Step 1: Generate migration skeleton**

Run: `docker compose exec php php artisan make:migration create_finngen_db_roles`

Expected: file printed under `backend/database/migrations/` — note the timestamp prefix.

- [ ] **Step 2: Write the migration body**

Open the file and replace the body with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // RO role — SELECT on CDM + vocab + results schemas for sync reads
        DB::statement("DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                CREATE ROLE parthenon_finngen_ro WITH LOGIN PASSWORD :ro_password;
            END IF;
        END$$", ['ro_password' => config('finngen.pg_ro_password')]);

        // RW role — SELECT + INSERT/UPDATE/DELETE on *_results and cohort tables
        DB::statement("DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                CREATE ROLE parthenon_finngen_rw WITH LOGIN PASSWORD :rw_password;
            END IF;
        END$$", ['rw_password' => config('finngen.pg_rw_password')]);

        // Grant schema-level privileges. Expand the source list as new sources come online.
        $cdmSchemas    = ['omop', 'synpuf', 'irsf', 'pancreas', 'inpatient', 'eunomia'];
        $vocabSchema   = 'vocab';
        $resultsSchemas = ['results', 'synpuf_results', 'irsf_results', 'pancreas_results', 'eunomia_results'];

        foreach (array_merge($cdmSchemas, [$vocabSchema]) as $schema) {
            DB::statement("GRANT USAGE ON SCHEMA {$schema} TO parthenon_finngen_ro, parthenon_finngen_rw");
            DB::statement("GRANT SELECT ON ALL TABLES IN SCHEMA {$schema} TO parthenon_finngen_ro, parthenon_finngen_rw");
            DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA {$schema} GRANT SELECT ON TABLES TO parthenon_finngen_ro, parthenon_finngen_rw");
        }

        foreach ($resultsSchemas as $schema) {
            DB::statement("GRANT USAGE, CREATE ON SCHEMA {$schema} TO parthenon_finngen_rw");
            DB::statement("GRANT SELECT ON ALL TABLES IN SCHEMA {$schema} TO parthenon_finngen_ro");
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {$schema} TO parthenon_finngen_rw");
            DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA {$schema} GRANT SELECT ON TABLES TO parthenon_finngen_ro");
            DB::statement("ALTER DEFAULT PRIVILEGES IN SCHEMA {$schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO parthenon_finngen_rw");
        }
    }

    public function down(): void
    {
        // NEVER drop in prod without explicit authorization (project rule).
        // Leave as a no-op; document in runbook if manual cleanup ever needed.
    }
};
```

- [ ] **Step 3: Add the two passwords to config/finngen.php**

Create `backend/config/finngen.php`:

```php
<?php

return [
    'pg_ro_password' => env('FINNGEN_PG_RO_PASSWORD'),
    'pg_rw_password' => env('FINNGEN_PG_RW_PASSWORD'),

    'darkstar_url'   => env('FINNGEN_DARKSTAR_URL', env('R_SERVICE_URL', 'http://darkstar:8787')),
    'darkstar_timeout_sync_ms'     => (int) env('FINNGEN_DARKSTAR_TIMEOUT_SYNC_MS', 30_000),
    'darkstar_timeout_dispatch_ms' => (int) env('FINNGEN_DARKSTAR_TIMEOUT_DISPATCH_MS', 10_000),
    'darkstar_timeout_poll_ms'     => (int) env('FINNGEN_DARKSTAR_TIMEOUT_POLL_MS', 120_000),

    'artifacts_path' => env('FINNGEN_ARTIFACTS_PATH', '/opt/finngen-artifacts'),
    'artifacts_stream_threshold_bytes' => (int) env('FINNGEN_ARTIFACT_STREAM_THRESHOLD', 10 * 1024 * 1024),

    'gc_retention_days' => (int) env('FINNGEN_GC_RETENTION_DAYS', 90),

    'idempotency_ttl_seconds' => (int) env('FINNGEN_IDEMPOTENCY_TTL', 300),

    'sync_cache_ttl_seconds' => (int) env('FINNGEN_SYNC_CACHE_TTL', 3600),

    'pause_dispatch' => (bool) env('FINNGEN_PAUSE_DISPATCH', false),

    'cancel_force_recycle_after_seconds' => (int) env('FINNGEN_CANCEL_CEILING', 60),
];
```

- [ ] **Step 4: Add env vars to `.env.example`**

Append to `.env.example`:

```
# FinnGen (SP1 foundation)
FINNGEN_PG_RO_PASSWORD=replace_me_with_strong_password
FINNGEN_PG_RW_PASSWORD=replace_me_with_strong_password
FINNGEN_DARKSTAR_URL=http://darkstar:8787
FINNGEN_ARTIFACTS_PATH=/opt/finngen-artifacts
```

- [ ] **Step 5: Set real passwords in `.env` + `backend/.env`**

Generate two strong passwords locally; set them in both `.env` files. Ensure files remain `chmod 600`.

```bash
RO=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
RW=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
echo "FINNGEN_PG_RO_PASSWORD=$RO" >> backend/.env
echo "FINNGEN_PG_RW_PASSWORD=$RW" >> backend/.env
echo "FINNGEN_PG_RO_PASSWORD=$RO" >> .env
echo "FINNGEN_PG_RW_PASSWORD=$RW" >> .env
chmod 600 backend/.env .env
```

Per global rule: never use `!` in generated passwords. The `tr -d` above drops safe special chars; add a manual sanity check if needed.

- [ ] **Step 6: Run the migration**

Run:
```bash
docker compose exec php sh -c 'cd /var/www/html && php artisan migrate --path=database/migrations'
```

Expected: `create_finngen_db_roles` runs successfully.

- [ ] **Step 7: Verify roles exist + can connect**

Run:
```bash
PGPASSWORD=$RO psql -h localhost -U parthenon_finngen_ro -d parthenon -c "SELECT current_user, current_database();"
PGPASSWORD=$RW psql -h localhost -U parthenon_finngen_rw -d parthenon -c "SELECT current_user, current_database();"
```
(Use the passwords you set.) Expected: both return one row.

Per user memory: always use claude_dev on host PG17 for admin-like DB ops; these two roles are for app/runtime connections only.

- [ ] **Step 8: Commit**

```bash
git add backend/database/migrations/*create_finngen_db_roles.php backend/config/finngen.php .env.example
git commit -m "feat(finngen): add parthenon_finngen_ro / _rw Postgres roles"
```

### Task A3: Remove the old `finngen-runner` container + volumes

**Files:**
- Modify: `docker-compose.yml`
- Delete: `docker/finngen-runner/`
- Delete: `external/finngen/finngen-runner/`

Do this *early* so downstream work doesn't accidentally depend on the old service. The old volumes are kept for 30 days in case of rollback (noted in spec §7.3).

- [ ] **Step 1: Stop the old container**

Run: `docker compose down finngen-runner`
Expected: container stops; volumes remain.

- [ ] **Step 2: Remove from `docker-compose.yml`**

Delete the entire `finngen-runner:` service block. Remove `finngen-runner-state` and `finngen-runner-r-lib` from the top-level `volumes:` block. Remove any `FINNGEN_RUNNER_*` env references.

- [ ] **Step 3: Delete the runner source + Dockerfile**

Run:
```bash
rm -rf docker/finngen-runner external/finngen/finngen-runner
```

- [ ] **Step 4: Validate compose + build**

Run: `docker compose config --quiet && echo OK`
Expected: OK, no errors about missing service.

- [ ] **Step 5: Sanity grep**

Run:
```bash
grep -rn "finngen-runner\|FinnGenWorkbenchService\|FinnGenCo2Service\|FinnGenRomopapiService" \
  backend/app backend/routes docker docker-compose.yml external frontend/src 2>/dev/null | head
```

Expected: no matches (the PHP services still exist — they go in Part F; we're only removing the container now).

Actually you'll see matches in `backend/app/Services/StudyAgent/FinnGen*.php` — those are removed in Part F. The container references must be zero.

Re-run filtered: `grep -rn "finngen-runner" backend frontend docker docker-compose.yml external 2>/dev/null` → zero.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git rm -r docker/finngen-runner external/finngen/finngen-runner
git commit -m "chore(finngen): remove deprecated finngen-runner container + source"
```

---

## Part B — Darkstar R Runtime

Install the three FinnGen packages into Darkstar, write the shared R utilities, and mount new Plumber routes. Everything here is testable against Eunomia (the bundled demo CDM).

### Task B1: Extend Darkstar install_deps.R + permissions

**Files:**
- Modify (or create): `darkstar/install_deps.R`
- Modify: `darkstar/Dockerfile` (or the entrypoint at `darkstar/s6/services/...`) for the umask + artifact dir

- [ ] **Step 1: Audit current install state**

Run: `docker compose exec darkstar Rscript -e 'installed.packages()[, "Package"]' | tr ',' '\n' | sort -u > /tmp/r-pkg-before.txt && wc -l /tmp/r-pkg-before.txt`

Expected: ~300+ packages (HADES stack).

- [ ] **Step 2: Add the three FinnGen packages to install_deps.R**

Open `darkstar/install_deps.R` (create if missing). Add:

```r
finngen_packages <- list(
  list(repo = "finngen/ROMOPAPI",           ref = "main"),
  list(repo = "finngen/HadesExtras",        ref = "main"),
  list(repo = "finngen/CO2AnalysisModules", ref = "main")
)

# Ensure remotes is available
if (!requireNamespace("remotes", quietly = TRUE)) {
  install.packages("remotes", repos = "https://cloud.r-project.org")
}

for (pkg in finngen_packages) {
  pkg_name <- basename(pkg$repo)
  if (!requireNamespace(pkg_name, quietly = TRUE)) {
    cat(sprintf("[finngen] installing %s@%s\n", pkg$repo, pkg$ref))
    remotes::install_github(
      pkg$repo,
      ref          = pkg$ref,
      dependencies = TRUE,
      upgrade      = "never",
      quiet        = FALSE
    )
  } else {
    cat(sprintf("[finngen] %s already installed\n", pkg_name))
  }
}

# Sanity probe: the three packages must load (CO2AnalysisModules via loadNamespace only — NEVER library() it)
stopifnot(requireNamespace("ROMOPAPI", quietly = TRUE))
stopifnot(requireNamespace("HadesExtras", quietly = TRUE))
stopifnot(requireNamespace("CO2AnalysisModules", quietly = TRUE))
cat("[finngen] all three packages installed & loadable\n")
```

Pin refs to a specific tag/commit before merge (avoid `main` drifting during a long-running branch). For now `main` is fine for the first implementation pass.

- [ ] **Step 3: Bake umask + artifact dir into Darkstar entrypoint**

Find the Darkstar service entrypoint (either `darkstar/Dockerfile` CMD/ENTRYPOINT or under `darkstar/s6/`). Add before the main process launches:

```sh
umask 002
mkdir -p /opt/finngen-artifacts/runs
chgrp -R www-data /opt/finngen-artifacts 2>/dev/null || true
chmod -R g+rwX /opt/finngen-artifacts 2>/dev/null || true
find /opt/finngen-artifacts -type d -exec chmod g+s {} \; 2>/dev/null || true
```

(This matches what we did manually in Task A1 Step 7.)

- [ ] **Step 4: Rebuild Darkstar image**

Run: `docker compose build darkstar`
Expected: first build adds ~25 min for the three R packages. Subsequent builds cache.

- [ ] **Step 5: Verify packages load in-container**

Run:
```bash
docker compose up -d darkstar
sleep 30  # s6 boot + package precompile
docker compose exec darkstar Rscript -e '
  library(ROMOPAPI)
  library(HadesExtras)
  loadNamespace("CO2AnalysisModules")
  cat("ok\n")
'
```
Expected: `ok` with no error lines.

- [ ] **Step 6: Extend the HADES audit script**

Modify `scripts/darkstar-version-check.sh`. Find the list of audited packages; add:

```bash
FINNGEN_PACKAGES=("ROMOPAPI" "HadesExtras" "CO2AnalysisModules")
for pkg in "${FINNGEN_PACKAGES[@]}"; do
  version=$(docker compose exec -T darkstar Rscript -e "cat(as.character(packageVersion(\"$pkg\")))" 2>/dev/null || echo "NOT_INSTALLED")
  echo "  $pkg: $version"
done
```

- [ ] **Step 7: Commit**

```bash
git add darkstar/install_deps.R darkstar/Dockerfile scripts/darkstar-version-check.sh
# (also commit whichever s6 or entrypoint file you edited)
git commit -m "feat(darkstar): install ROMOPAPI, HadesExtras, CO2AnalysisModules"
```

### Task B2: Write `darkstar/api/finngen/common.R` (shared R utilities)

**Files:**
- Create: `darkstar/api/finngen/common.R`
- Create: `darkstar/tests/testthat/test-finngen-common.R`

This file hosts `run_with_classification()`, `write_progress()` (rotating buffer), and `build_cohort_table_handler()` (parses the `source` envelope into a HadesExtras R6 handler). Everything downstream imports from here.

- [ ] **Step 1: Write the failing testthat tests**

Create `darkstar/tests/testthat/test-finngen-common.R`:

```r
source("/app/api/finngen/common.R")

testthat::test_that("run_with_classification returns ok=TRUE on success", {
  result <- run_with_classification("/tmp/common-test", function() 42)
  testthat::expect_true(result$ok)
  testthat::expect_equal(result$result, 42)
})

testthat::test_that("run_with_classification classifies DatabaseConnectorError", {
  result <- run_with_classification("/tmp/common-test", function() {
    e <- structure(
      class = c("DatabaseConnectorError", "error", "condition"),
      list(message = "could not connect to server", call = sys.call())
    )
    stop(e)
  })
  testthat::expect_false(result$ok)
  testthat::expect_equal(result$error$category, "DB_CONNECTION_FAILED")
})

testthat::test_that("run_with_classification classifies SqlRenderError as schema mismatch", {
  result <- run_with_classification("/tmp/common-test", function() {
    e <- structure(
      class = c("SqlRenderError", "error", "condition"),
      list(message = "relation synpuf.cohort does not exist", call = sys.call())
    )
    stop(e)
  })
  testthat::expect_equal(result$error$category, "DB_SCHEMA_MISMATCH")
})

testthat::test_that("run_with_classification OOM detected", {
  result <- run_with_classification("/tmp/common-test", function() {
    e <- structure(
      class = c("OutOfMemoryError", "error", "condition"),
      list(message = "Java heap space", call = sys.call())
    )
    stop(e)
  })
  testthat::expect_equal(result$error$category, "OUT_OF_MEMORY")
})

testthat::test_that("run_with_classification falls through to ANALYSIS_EXCEPTION", {
  result <- run_with_classification("/tmp/common-test", function() stop("generic boom"))
  testthat::expect_equal(result$error$category, "ANALYSIS_EXCEPTION")
  testthat::expect_match(result$error$message, "generic boom")
})

testthat::test_that("write_progress rotates at 500 lines", {
  path <- tempfile(fileext = ".json")
  for (i in 1:520) {
    write_progress(path, list(step = "x", pct = i, message = sprintf("iter %d", i)))
  }
  lines <- readLines(path)
  testthat::expect_lte(length(lines), 500)
  # Last line must be the most recent
  last <- jsonlite::fromJSON(lines[length(lines)])
  testthat::expect_equal(last$pct, 520)
})

testthat::test_that("build_cohort_table_handler accepts valid source envelope", {
  source_envelope <- list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server   = "postgres/parthenon",
      port     = 5432,
      user     = "parthenon_finngen_ro",
      password = Sys.getenv("FINNGEN_PG_RO_PASSWORD", "dummy")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab", results = "eunomia_results", cohort = "eunomia_results")
  )
  handler <- build_cohort_table_handler(source_envelope)
  testthat::expect_s4_class(handler, "R6") |> testthat::expect_true() |> invisible()
  # At minimum the handler exposes getCohortDatabaseSchema() or similar
  testthat::expect_true(inherits(handler, "R6"))
})
```

- [ ] **Step 2: Run the failing tests**

Run: `docker compose exec darkstar Rscript -e 'testthat::test_file("/app/tests/testthat/test-finngen-common.R")'`
Expected: all 7 fail (file doesn't exist yet).

- [ ] **Step 3: Implement common.R**

Create `darkstar/api/finngen/common.R`:

```r
# darkstar/api/finngen/common.R
#
# Shared utilities for all FinnGen Plumber routes.
# Invariant: PHP does NO error-message pattern matching. All classification
# happens here and is surfaced as a category code in result$error$category.

suppressPackageStartupMessages({
  library(jsonlite)
  library(HadesExtras)
})

# ---- Error classification -----------------------------------------------

finngen_error <- function(category, cond, export_folder = NULL) {
  list(
    ok = FALSE,
    error = list(
      category = category,
      class    = paste(class(cond), collapse = "/"),
      message  = conditionMessage(cond),
      call     = tryCatch(format(conditionCall(cond)), error = function(e) ""),
      stack    = paste(capture.output(traceback()), collapse = "\n"),
      reproducer_params_path = if (!is.null(export_folder)) file.path(export_folder, "params.json") else NA_character_
    )
  )
}

classify_simple_error <- function(e, export_folder) {
  msg <- conditionMessage(e)

  # Java/JDBC out-of-memory surfaces as plain simpleError — one known signature.
  if (grepl("java.lang.OutOfMemoryError|Java heap space", msg, ignore.case = TRUE)) {
    return(finngen_error("OUT_OF_MEMORY", e, export_folder))
  }
  if (grepl("No space left on device|disk full", msg, ignore.case = TRUE)) {
    return(finngen_error("DISK_FULL", e, export_folder))
  }
  # Known Andromeda error class sometimes surfaces as simpleError wrapper.
  if (inherits(e, "AndromedaError") ||
      grepl("AndromedaError|andromeda", msg, ignore.case = TRUE)) {
    return(finngen_error("ANALYSIS_EXCEPTION", e, export_folder))
  }
  finngen_error("ANALYSIS_EXCEPTION", e, export_folder)
}

run_with_classification <- function(export_folder, fn) {
  result <- tryCatch({
    res <- fn()
    list(ok = TRUE, result = res)
  },
    DatabaseConnectorError = function(e) finngen_error("DB_CONNECTION_FAILED", e, export_folder),
    SqlRenderError         = function(e) finngen_error("DB_SCHEMA_MISMATCH",   e, export_folder),
    OutOfMemoryError       = function(e) finngen_error("OUT_OF_MEMORY",        e, export_folder),
    error = function(e) classify_simple_error(e, export_folder)
  )

  # Persist result.json if export folder exists (async endpoints only)
  if (!is.null(export_folder) && dir.exists(export_folder)) {
    writeLines(
      jsonlite::toJSON(result, auto_unbox = TRUE, null = "null", force = TRUE),
      file.path(export_folder, "result.json")
    )
  }
  result
}

# ---- Progress writer (rotating buffer, 500-line cap) --------------------

.PROGRESS_MAX_LINES <- 500L
.PROGRESS_DROP_LINES <- 100L

write_progress <- function(path, obj) {
  obj$updated_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC")
  line <- jsonlite::toJSON(obj, auto_unbox = TRUE, null = "null", force = TRUE)

  existing <- if (file.exists(path)) readLines(path, warn = FALSE) else character(0)
  if (length(existing) >= .PROGRESS_MAX_LINES) {
    existing <- tail(existing, .PROGRESS_MAX_LINES - .PROGRESS_DROP_LINES)
  }
  new_lines <- c(existing, line)

  # Atomic: write to temp, rename.
  tmp <- paste0(path, ".tmp")
  writeLines(new_lines, tmp)
  file.rename(tmp, path)
  invisible(NULL)
}

# ---- source → CohortTableHandler ---------------------------------------

build_cohort_table_handler <- function(source_envelope) {
  stopifnot(is.list(source_envelope))
  conn <- source_envelope$connection
  sch  <- source_envelope$schemas

  connection_details <- DatabaseConnector::createConnectionDetails(
    dbms     = source_envelope$dbms,
    server   = conn$server,
    port     = conn$port,
    user     = conn$user,
    password = conn$password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/runner-state/jdbc")
  )

  HadesExtras::createCohortTableHandlerFromList(list(
    connectionHandlerSettings = list(connectionDetailsSettings = connection_details),
    cdm = list(
      cdmDatabaseSchema   = sch$cdm,
      vocabularyDatabaseSchema = sch$vocab
    ),
    cohortTable = list(
      cohortDatabaseSchema = sch$cohort,
      cohortTableName      = "cohort"
    ),
    resultsDatabaseSchema  = sch$results
  ))
}

build_cdm_handler <- function(source_envelope) {
  # Lighter handler for read-only ROMOPAPI-style endpoints. Returns CDMdbHandler.
  stopifnot(is.list(source_envelope))
  conn <- source_envelope$connection
  sch  <- source_envelope$schemas

  connection_details <- DatabaseConnector::createConnectionDetails(
    dbms     = source_envelope$dbms,
    server   = conn$server,
    port     = conn$port,
    user     = conn$user,
    password = conn$password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/runner-state/jdbc")
  )

  HadesExtras::createCDMdbHandlerFromList(list(
    connectionHandlerSettings = list(connectionDetailsSettings = connection_details),
    cdm = list(
      cdmDatabaseSchema        = sch$cdm,
      vocabularyDatabaseSchema = sch$vocab
    )
  ))
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `docker compose exec darkstar Rscript -e 'testthat::test_file("/app/tests/testthat/test-finngen-common.R")'`
Expected: all 7 pass (the `build_cohort_table_handler` test may SKIP if Eunomia is not seeded — acceptable; it runs green once Eunomia is loaded).

- [ ] **Step 5: Commit**

```bash
git add darkstar/api/finngen/common.R darkstar/tests/testthat/test-finngen-common.R
git commit -m "feat(darkstar): finngen common.R — error classification + progress + handlers"
```

### Task B3: Write ROMOPAPI sync endpoints

**Files:**
- Create: `darkstar/api/finngen/romopapi.R`
- Create: `darkstar/tests/testthat/test-finngen-romopapi.R`

- [ ] **Step 1: Write the failing tests**

Create `darkstar/tests/testthat/test-finngen-romopapi.R`:

```r
source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi.R")

eunomia_source <- list(
  source_key = "eunomia",
  dbms       = "postgresql",
  connection = list(
    server = "postgres/parthenon", port = 5432,
    user = "parthenon_finngen_ro",
    password = Sys.getenv("FINNGEN_PG_RO_PASSWORD", "dummy")
  ),
  schemas = list(cdm = "eunomia", vocab = "vocab",
                 results = "eunomia_results", cohort = "eunomia_results")
)

testthat::test_that("getCodeCounts returns stratified counts + concept metadata", {
  testthat::skip_if_not(nzchar(Sys.getenv("FINNGEN_PG_RO_PASSWORD")), "RO password not set")
  out <- finngen_romopapi_code_counts(eunomia_source, concept_id = 317009)  # asthma (in Eunomia)
  testthat::expect_named(out, c("concept", "stratified_counts", "node_count", "descendant_count"))
  testthat::expect_true(is.list(out$concept))
  testthat::expect_true("concept_id" %in% names(out$concept))
})

testthat::test_that("getConceptRelationships returns tibble-of-relationships", {
  testthat::skip_if_not(nzchar(Sys.getenv("FINNGEN_PG_RO_PASSWORD")), "RO password not set")
  out <- finngen_romopapi_relationships(eunomia_source, concept_id = 317009)
  testthat::expect_named(out, "relationships")
  testthat::expect_true(is.data.frame(out$relationships) || is.list(out$relationships))
})

testthat::test_that("getConceptAncestors returns nodes + edges + mermaid", {
  testthat::skip_if_not(nzchar(Sys.getenv("FINNGEN_PG_RO_PASSWORD")), "RO password not set")
  out <- finngen_romopapi_ancestors(eunomia_source, concept_id = 317009, direction = "both", max_depth = 3)
  testthat::expect_named(out, c("nodes", "edges", "mermaid"))
  testthat::expect_true(is.character(out$mermaid))
  testthat::expect_match(out$mermaid, "^graph")
})
```

- [ ] **Step 2: Verify tests fail**

Run: `docker compose exec darkstar Rscript -e 'testthat::test_file("/app/tests/testthat/test-finngen-romopapi.R")'`
Expected: 3 failures (source not found).

- [ ] **Step 3: Implement the three endpoints**

Create `darkstar/api/finngen/romopapi.R`:

```r
# darkstar/api/finngen/romopapi.R
#
# Sync read endpoints backed by ROMOPAPI::getCodeCounts(), concept_relationship,
# concept_ancestor. Each function is callable standalone (for testthat) and also
# wired into plumber_api.R.

suppressPackageStartupMessages({
  library(ROMOPAPI)
})

finngen_romopapi_code_counts <- function(source_envelope, concept_id) {
  handler <- build_cdm_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))

  counts <- ROMOPAPI::getCodeCounts(handler, conceptId = as.integer(concept_id))

  # ROMOPAPI returns a list; normalize field names for our API contract
  list(
    concept = counts$concept,
    stratified_counts = counts$stratified_code_counts %||% counts$codeCounts,
    node_count = counts$node_count %||% sum(counts$stratified_code_counts$n %||% 0),
    descendant_count = counts$descendant_count %||% NA_integer_
  )
}

finngen_romopapi_relationships <- function(source_envelope, concept_id) {
  handler <- build_cdm_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))

  sql <- SqlRender::render(
    "SELECT cr.relationship_id,
            cr.concept_id_2,
            c2.concept_name AS concept_name_2,
            c2.vocabulary_id AS vocabulary_id_2,
            c2.standard_concept
     FROM @vocab.concept_relationship cr
     JOIN @vocab.concept c2 ON c2.concept_id = cr.concept_id_2
     WHERE cr.concept_id_1 = @concept_id
       AND cr.invalid_reason IS NULL",
    vocab      = source_envelope$schemas$vocab,
    concept_id = as.integer(concept_id)
  )
  rs <- DatabaseConnector::querySql(handler$connectionHandler$getConnection(), sql)
  list(relationships = rs)
}

finngen_romopapi_ancestors <- function(source_envelope, concept_id, direction = "both", max_depth = 5) {
  stopifnot(direction %in% c("up", "down", "both"))
  handler <- build_cdm_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))

  queries <- list()
  if (direction %in% c("up", "both")) {
    queries$ancestors <- SqlRender::render(
      "SELECT ca.ancestor_concept_id AS src, ca.descendant_concept_id AS dst,
              ca.min_levels_of_separation AS depth, c.concept_name AS src_name
       FROM @vocab.concept_ancestor ca
       JOIN @vocab.concept c ON c.concept_id = ca.ancestor_concept_id
       WHERE ca.descendant_concept_id = @concept_id
         AND ca.min_levels_of_separation BETWEEN 1 AND @max_depth",
      vocab = source_envelope$schemas$vocab,
      concept_id = as.integer(concept_id),
      max_depth  = as.integer(max_depth)
    )
  }
  if (direction %in% c("down", "both")) {
    queries$descendants <- SqlRender::render(
      "SELECT ca.ancestor_concept_id AS src, ca.descendant_concept_id AS dst,
              ca.min_levels_of_separation AS depth, c.concept_name AS dst_name
       FROM @vocab.concept_ancestor ca
       JOIN @vocab.concept c ON c.concept_id = ca.descendant_concept_id
       WHERE ca.ancestor_concept_id = @concept_id
         AND ca.min_levels_of_separation BETWEEN 1 AND @max_depth",
      vocab = source_envelope$schemas$vocab,
      concept_id = as.integer(concept_id),
      max_depth  = as.integer(max_depth)
    )
  }

  edges <- do.call(rbind, lapply(queries, function(sql) {
    DatabaseConnector::querySql(handler$connectionHandler$getConnection(), sql)
  }))
  if (is.null(edges) || nrow(edges) == 0) edges <- data.frame(SRC = integer(), DST = integer(), DEPTH = integer())

  # Derive node set
  node_ids <- unique(c(edges$SRC, edges$DST, as.integer(concept_id)))
  nodes_sql <- SqlRender::render(
    "SELECT concept_id, concept_name FROM @vocab.concept WHERE concept_id IN (@ids)",
    vocab = source_envelope$schemas$vocab,
    ids   = paste(node_ids, collapse = ",")
  )
  nodes <- DatabaseConnector::querySql(handler$connectionHandler$getConnection(), nodes_sql)

  # Mermaid rendering — root node styled
  mermaid_lines <- c("graph TD")
  for (i in seq_len(nrow(edges))) {
    mermaid_lines <- c(mermaid_lines, sprintf("  c%d --> c%d", edges$SRC[i], edges$DST[i]))
  }
  for (i in seq_len(nrow(nodes))) {
    name <- gsub('"', "'", nodes$CONCEPT_NAME[i], fixed = TRUE)
    mermaid_lines <- c(mermaid_lines, sprintf('  c%d["%s"]', nodes$CONCEPT_ID[i], name))
  }
  mermaid <- paste(mermaid_lines, collapse = "\n")

  list(nodes = nodes, edges = edges, mermaid = mermaid)
}

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a
```

- [ ] **Step 4: Run tests to verify pass**

Ensure Eunomia is seeded:
```bash
docker compose exec php sh -c 'cd /var/www/html && php artisan parthenon:load-eunomia --fresh'
```

Run: `docker compose exec -e FINNGEN_PG_RO_PASSWORD="$RO" darkstar Rscript -e 'testthat::test_file("/app/tests/testthat/test-finngen-romopapi.R")'`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add darkstar/api/finngen/romopapi.R darkstar/tests/testthat/test-finngen-romopapi.R
git commit -m "feat(darkstar): finngen romopapi.R — code counts, relationships, ancestors"
```

### Task B4: Write HadesExtras sync endpoints

**Files:**
- Create: `darkstar/api/finngen/hades_extras.R`
- Create: `darkstar/tests/testthat/test-finngen-hades.R`

Follow exactly the pattern of Task B3.

- [ ] **Step 1: Write failing tests** — three tests: `finngen_hades_overlap`, `finngen_hades_demographics`, `finngen_hades_counts`, each taking `eunomia_source` + `cohort_ids` (overlap/counts) or `cohort_id` (demographics). Use the Eunomia demo cohorts (ids 1 and 2, seeded by `parthenon:load-eunomia`).

- [ ] **Step 2: Implement `hades_extras.R`**

```r
# darkstar/api/finngen/hades_extras.R

finngen_hades_counts <- function(source_envelope, cohort_ids) {
  handler <- build_cohort_table_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))

  counts <- HadesExtras::getCohortCounts(handler, cohortIds = as.integer(cohort_ids))
  list(counts = counts)
}

finngen_hades_overlap <- function(source_envelope, cohort_ids) {
  handler <- build_cohort_table_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))

  overlap <- HadesExtras::getCohortsOverlap(handler, cohortIds = as.integer(cohort_ids))
  list(
    matrix = overlap$matrix %||% overlap,
    labels = overlap$labels %||% as.integer(cohort_ids)
  )
}

finngen_hades_demographics <- function(source_envelope, cohort_id) {
  handler <- build_cohort_table_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))

  demo <- HadesExtras::getCohortDemographics(handler, cohortId = as.integer(cohort_id))
  list(
    age_histogram = demo$age_histogram %||% demo$ageHistogram,
    gender_counts = demo$gender_counts %||% demo$genderCounts,
    total         = demo$total %||% sum(demo$gender_counts %||% 0)
  )
}
```

- [ ] **Step 3: Run tests → pass**

Run: `docker compose exec -e FINNGEN_PG_RO_PASSWORD="$RO" darkstar Rscript -e 'testthat::test_file("/app/tests/testthat/test-finngen-hades.R")'`

- [ ] **Step 4: Commit**

```bash
git add darkstar/api/finngen/hades_extras.R darkstar/tests/testthat/test-finngen-hades.R
git commit -m "feat(darkstar): finngen hades_extras.R — counts, overlap, demographics"
```

### Task B5: Write async endpoints (CO2 analysis + cohort ops — thin shells)

**Files:**
- Create: `darkstar/api/finngen/co2_analysis.R`
- Create: `darkstar/api/finngen/cohort_ops.R`
- Create: `darkstar/tests/testthat/test-finngen-co2-codewas.R`
- Create: `darkstar/tests/testthat/test-finngen-cohort-generate.R`

Each async endpoint has the same shape: build handler → validate params → spawn mirai task wrapped in `run_with_classification` + `write_progress` → return `{ job_id, status: "running" }`.

- [ ] **Step 1: Write failing end-to-end testthat for CodeWAS**

Create `darkstar/tests/testthat/test-finngen-co2-codewas.R`:

```r
source("/app/api/finngen/common.R")
source("/app/api/finngen/co2_analysis.R")

testthat::test_that("execute_CodeWAS runs end-to-end on Eunomia", {
  testthat::skip_if_not(nzchar(Sys.getenv("FINNGEN_PG_RW_PASSWORD")), "RW password not set")
  src <- list(
    source_key = "eunomia",
    dbms = "postgresql",
    connection = list(
      server = "postgres/parthenon", port = 5432,
      user = "parthenon_finngen_rw",
      password = Sys.getenv("FINNGEN_PG_RW_PASSWORD")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )
  run_id <- "test01HXYZEUNOMIA0000000001"
  export_folder <- file.path("/opt/finngen-artifacts/runs", run_id)
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)

  result <- finngen_co2_codewas_execute(
    source_envelope = src,
    run_id = run_id,
    export_folder = export_folder,
    analysis_settings = list(
      cohortIdCases    = 1L,
      cohortIdControls = 2L,
      analysisIds      = c(1L, 10L),
      minCellCount     = 5L
    )
  )

  testthat::expect_true(result$ok)
  testthat::expect_true(file.exists(file.path(export_folder, "results.duckdb")))
  testthat::expect_true(file.exists(file.path(export_folder, "summary.json")))
  # Cleanup
  unlink(export_folder, recursive = TRUE)
})
```

- [ ] **Step 2: Implement `co2_analysis.R`**

```r
# darkstar/api/finngen/co2_analysis.R

finngen_co2_codewas_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))

    write_progress(progress_path, list(step = "execute_CodeWAS", pct = 10))
    res <- CO2AnalysisModules::execute_CodeWAS(
      exportFolder        = export_folder,
      cohortTableHandler  = handler,
      analysisSettings    = analysis_settings
    )
    write_progress(progress_path, list(step = "write_summary", pct = 95))

    summary <- list(
      rows = if (!is.null(res$codeWASCounts)) nrow(res$codeWASCounts) else NA_integer_,
      covariates = analysis_settings$analysisIds %||% integer()
    )
    writeLines(jsonlite::toJSON(summary, auto_unbox = TRUE), file.path(export_folder, "summary.json"))
    write_progress(progress_path, list(step = "done", pct = 100))
    summary
  })
}

# Stubs for timeCodeWAS, overlaps, demographics — same shape; each calls the
# corresponding CO2AnalysisModules::execute_* function.
finngen_co2_time_codewas_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")
  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "execute_timeCodeWAS", pct = 10))
    handler <- build_cohort_table_handler(source_envelope); on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))
    res <- CO2AnalysisModules::execute_timeCodeWAS(exportFolder = export_folder, cohortTableHandler = handler, analysisSettings = analysis_settings)
    summary <- list(rows = if (!is.null(res$timeCodeWASCounts)) nrow(res$timeCodeWASCounts) else NA_integer_)
    writeLines(jsonlite::toJSON(summary, auto_unbox = TRUE), file.path(export_folder, "summary.json"))
    write_progress(progress_path, list(step = "done", pct = 100))
    summary
  })
}

finngen_co2_overlaps_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")
  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "execute_CohortOverlaps", pct = 10))
    handler <- build_cohort_table_handler(source_envelope); on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))
    res <- CO2AnalysisModules::execute_CohortOverlaps(exportFolder = export_folder, cohortTableHandler = handler, analysisSettings = analysis_settings)
    summary <- list(cohort_ids = analysis_settings$cohortIds %||% integer())
    writeLines(jsonlite::toJSON(summary, auto_unbox = TRUE), file.path(export_folder, "summary.json"))
    write_progress(progress_path, list(step = "done", pct = 100))
    summary
  })
}

finngen_co2_demographics_execute <- function(source_envelope, run_id, export_folder, analysis_settings) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")
  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "execute_CohortDemographics", pct = 10))
    handler <- build_cohort_table_handler(source_envelope); on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))
    res <- CO2AnalysisModules::execute_CohortDemographics(exportFolder = export_folder, cohortTableHandler = handler, analysisSettings = analysis_settings)
    summary <- list(total = res$total %||% NA_integer_)
    writeLines(jsonlite::toJSON(summary, auto_unbox = TRUE), file.path(export_folder, "summary.json"))
    write_progress(progress_path, list(step = "done", pct = 100))
    summary
  })
}
```

- [ ] **Step 3: Implement `cohort_ops.R`**

```r
# darkstar/api/finngen/cohort_ops.R

finngen_cohort_generate_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")
  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope); on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))
    write_progress(progress_path, list(step = "generateCohortSet", pct = 30))
    res <- handler$generateCohortSet(cohortDefinitionSet = params$cohort_definition_set)
    write_progress(progress_path, list(step = "getCohortCounts", pct = 90))
    counts <- handler$getCohortCounts()
    writeLines(jsonlite::toJSON(list(counts = counts), auto_unbox = TRUE), file.path(export_folder, "summary.json"))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(counts = counts)
  })
}

finngen_cohort_match_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")
  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope); on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL))
    # Matching subset operator
    matched <- HadesExtras::CohortGenerator_MatchingSubsetOperator(
      targetCohortId     = params$primary_cohort_id,
      comparatorCohortIds = params$comparator_cohort_ids,
      ratio              = params$ratio %||% 1,
      matchSex           = params$match_sex %||% TRUE,
      matchBirthYear     = params$match_birth_year %||% TRUE,
      maxYearDifference  = params$max_year_difference %||% 1L
    )
    write_progress(progress_path, list(step = "generateCohortSet", pct = 50))
    handler$generateCohortSet(cohortDefinitionSet = list(matched))
    write_progress(progress_path, list(step = "done", pct = 100))
    list(matched_cohort_id = params$primary_cohort_id * 1000L)  # convention per HadesExtras
  })
}
```

- [ ] **Step 4: Run CodeWAS end-to-end test**

```bash
docker compose exec -e FINNGEN_PG_RW_PASSWORD="$RW" darkstar \
  Rscript -e 'testthat::test_file("/app/tests/testthat/test-finngen-co2-codewas.R")'
```
Expected: 1 pass within ~30-60s.

- [ ] **Step 5: Commit**

```bash
git add darkstar/api/finngen/co2_analysis.R darkstar/api/finngen/cohort_ops.R darkstar/tests/testthat/test-finngen-*.R
git commit -m "feat(darkstar): finngen co2_analysis.R + cohort_ops.R — async execute functions"
```

### Task B6: Mount finngen routes in plumber_api.R + async wrapper

**Files:**
- Modify: `darkstar/plumber_api.R`
- Create: `darkstar/api/finngen/routes.R` (Plumber annotations file)

Plumber2 uses file-based mounting. The routes.R file contains annotated handlers that call the functions from B3–B5.

- [ ] **Step 1: Create routes.R**

Create `darkstar/api/finngen/routes.R`:

```r
# darkstar/api/finngen/routes.R

source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi.R")
source("/app/api/finngen/hades_extras.R")
source("/app/api/finngen/co2_analysis.R")
source("/app/api/finngen/cohort_ops.R")

# --- Sync endpoints ------------------------------------------------------

#* @get /finngen/romopapi/code-counts
#* @serializer unboxedJSON
function(source, concept_id) {
  src <- jsonlite::fromJSON(source, simplifyVector = FALSE)
  out <- run_with_classification(NULL, function() finngen_romopapi_code_counts(src, as.integer(concept_id)))
  if (!isTRUE(out$ok)) res$status <- 422L
  out
}

#* @get /finngen/romopapi/relationships
#* @serializer unboxedJSON
function(source, concept_id) {
  src <- jsonlite::fromJSON(source, simplifyVector = FALSE)
  out <- run_with_classification(NULL, function() finngen_romopapi_relationships(src, as.integer(concept_id)))
  if (!isTRUE(out$ok)) res$status <- 422L
  out
}

#* @get /finngen/romopapi/ancestors
#* @serializer unboxedJSON
function(source, concept_id, direction = "both", max_depth = 5) {
  src <- jsonlite::fromJSON(source, simplifyVector = FALSE)
  out <- run_with_classification(NULL, function() finngen_romopapi_ancestors(src, as.integer(concept_id), direction, as.integer(max_depth)))
  if (!isTRUE(out$ok)) res$status <- 422L
  out
}

#* @get /finngen/hades/counts
#* @serializer unboxedJSON
function(source, cohort_ids) {
  src <- jsonlite::fromJSON(source, simplifyVector = FALSE)
  ids <- as.integer(strsplit(cohort_ids, ",")[[1]])
  out <- run_with_classification(NULL, function() finngen_hades_counts(src, ids))
  if (!isTRUE(out$ok)) res$status <- 422L
  out
}

#* @get /finngen/hades/overlap
#* @serializer unboxedJSON
function(source, cohort_ids) {
  src <- jsonlite::fromJSON(source, simplifyVector = FALSE)
  ids <- as.integer(strsplit(cohort_ids, ",")[[1]])
  out <- run_with_classification(NULL, function() finngen_hades_overlap(src, ids))
  if (!isTRUE(out$ok)) res$status <- 422L
  out
}

#* @get /finngen/hades/demographics
#* @serializer unboxedJSON
function(source, cohort_id) {
  src <- jsonlite::fromJSON(source, simplifyVector = FALSE)
  out <- run_with_classification(NULL, function() finngen_hades_demographics(src, as.integer(cohort_id)))
  if (!isTRUE(out$ok)) res$status <- 422L
  out
}

# --- Async endpoints (mirai-backed) -------------------------------------

.finngen_dispatch_async <- function(endpoint_fn, body) {
  # body is already parsed list: { source, run_id, params }
  src <- body$source
  run_id <- body$run_id
  export_folder <- file.path("/opt/finngen-artifacts/runs", run_id)
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)

  # Persist params for reproducers
  writeLines(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"), file.path(export_folder, "params.json"))

  task <- mirai::mirai({
    endpoint_fn(source_envelope = src, run_id = run_id, export_folder = export_folder, params = body$params %||% body$analysis_settings)
  }, endpoint_fn = endpoint_fn, src = src, run_id = run_id, export_folder = export_folder, body = body)

  # Register with existing Darkstar jobs subsystem (api/jobs.R)
  # The jobs API already tracks mirai tasks; we pass the mirai handle in.
  job_id <- darkstar_jobs_register(task, run_id = run_id, export_folder = export_folder)
  list(job_id = job_id, status = "running")
}

#* @post /finngen/co2/codewas
#* @serializer unboxedJSON
function(req, res) {
  body <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
  .finngen_dispatch_async(finngen_co2_codewas_execute, body)
}

#* @post /finngen/co2/time-codewas
#* @serializer unboxedJSON
function(req) {
  body <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
  .finngen_dispatch_async(finngen_co2_time_codewas_execute, body)
}

#* @post /finngen/co2/overlaps
#* @serializer unboxedJSON
function(req) {
  body <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
  .finngen_dispatch_async(finngen_co2_overlaps_execute, body)
}

#* @post /finngen/co2/demographics
#* @serializer unboxedJSON
function(req) {
  body <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
  .finngen_dispatch_async(finngen_co2_demographics_execute, body)
}

#* @post /finngen/cohort/generate
#* @serializer unboxedJSON
function(req) {
  body <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
  .finngen_dispatch_async(finngen_cohort_generate_execute, body)
}

#* @post /finngen/cohort/match
#* @serializer unboxedJSON
function(req) {
  body <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)
  .finngen_dispatch_async(finngen_cohort_match_execute, body)
}
```

NOTE: `darkstar_jobs_register()` is the existing Darkstar jobs subsystem in `darkstar/api/jobs.R`. Inspect that file and confirm it exposes a register+poll API that accepts a mirai handle. If it doesn't, extend it in a sub-step — this is an existing-file modification, not new work.

- [ ] **Step 2: Mount routes.R in plumber_api.R**

Modify `darkstar/plumber_api.R`. In the `api()` constructor, after existing `api/*.R` mounts, add:

```r
pa <- pa |>
  plumber2::api_merge(plumber2::api("/app/api/finngen/routes.R"))
```

(or whatever the existing mount idiom is — `darkstar/plumber_api.R` already does this pattern for its 11 existing files).

- [ ] **Step 3: Extend Darkstar health endpoint**

Open `darkstar/api/health.R`. Extend the `/health` response payload to include a `finngen` block:

```r
# In the /health handler:
finngen_block <- list(
  packages_loaded = c("ROMOPAPI", "HadesExtras", "CO2AnalysisModules"),
  load_errors = tryCatch({
    invisible(loadNamespace("ROMOPAPI"))
    invisible(loadNamespace("HadesExtras"))
    invisible(loadNamespace("CO2AnalysisModules"))
    list()
  }, error = function(e) list(as.character(e$message)))
)
# merge into response list:
response$finngen <- finngen_block
```

- [ ] **Step 4: Restart Darkstar + smoke-test the new routes**

```bash
docker compose restart darkstar
sleep 20

# Sync endpoint
curl -s "http://localhost:8787/finngen/romopapi/code-counts?source=$(python3 -c 'import json,urllib.parse; print(urllib.parse.quote(json.dumps({"source_key":"eunomia","dbms":"postgresql","connection":{"server":"postgres/parthenon","port":5432,"user":"parthenon_finngen_ro","password":"'$RO'"},"schemas":{"cdm":"eunomia","vocab":"vocab","results":"eunomia_results","cohort":"eunomia_results"}})))&concept_id=317009" | jq '.'

# Health
curl -s http://localhost:8787/health | jq '.finngen'
```
Expected: code-counts returns `{ok: true, result: {...}}`; health shows `packages_loaded` and `load_errors: []`.

- [ ] **Step 5: Commit**

```bash
git add darkstar/api/finngen/routes.R darkstar/plumber_api.R darkstar/api/health.R
git commit -m "feat(darkstar): mount finngen Plumber routes + extend /health"
```

### Task B7: Cancel test (graceful + forced)

**Files:**
- Create: `darkstar/tests/testthat/test-finngen-cancel.R`

- [ ] **Step 1: Write two tests**

```r
# Test 1: graceful cancel within 10s
# Test 2: forced cancel at 60s ceiling (SIGINT-ignoring task)
testthat::test_that("graceful cancel transitions mirai task to canceled within 10s", {
  export_folder <- tempfile("run_")
  dir.create(export_folder)
  task <- mirai::mirai({
    for (i in 1:100) { Sys.sleep(0.5) }
    "done"
  })
  job_id <- darkstar_jobs_register(task, run_id = basename(export_folder), export_folder = export_folder)
  Sys.sleep(2)
  start <- Sys.time()
  darkstar_jobs_cancel(job_id)
  for (i in 1:40) {
    st <- darkstar_jobs_status(job_id)
    if (st$status %in% c("canceled", "done", "error")) break
    Sys.sleep(0.25)
  }
  elapsed <- as.numeric(Sys.time() - start, units = "secs")
  testthat::expect_lte(elapsed, 10)
  testthat::expect_equal(st$status, "canceled")
})

testthat::test_that("forced cancel enforces 60s ceiling on SIGINT-ignoring task", {
  export_folder <- tempfile("run_forced_")
  dir.create(export_folder)
  task <- mirai::mirai({
    tryCatch({
      repeat { Sys.sleep(0.1) }  # SIGINT will eventually interrupt Sys.sleep — OK
    }, interrupt = function(e) {
      # Ignore interrupt — keep running
      repeat { Sys.sleep(0.1) }
    })
  })
  job_id <- darkstar_jobs_register(task, run_id = basename(export_folder), export_folder = export_folder)
  Sys.sleep(2)
  start <- Sys.time()
  darkstar_jobs_cancel(job_id)
  # Wait up to 65s for force-recycle
  for (i in 1:260) {
    st <- darkstar_jobs_status(job_id)
    if (st$status == "canceled") break
    Sys.sleep(0.25)
  }
  elapsed <- as.numeric(Sys.time() - start, units = "secs")
  testthat::expect_lte(elapsed, 65)
  testthat::expect_equal(st$status, "canceled")
  testthat::expect_true(isTRUE(st$forced))
})
```

- [ ] **Step 2: Extend `darkstar/api/jobs.R`** with the 60s ceiling + force-recycle in its `jobs_cancel` implementation per spec §5.6.

- [ ] **Step 3: Run tests to verify pass** (test 2 is tagged `@slow`; runs nightly).

- [ ] **Step 4: Commit**

```bash
git add darkstar/tests/testthat/test-finngen-cancel.R darkstar/api/jobs.R
git commit -m "feat(darkstar): finngen cancellation with 60s force-recycle ceiling"
```

### Task B8: Darkstar response-shape snapshot fixture

**Files:**
- Create: `darkstar/tests/fixtures/darkstar-finngen-shapes.json`

- [ ] **Step 1: Run each endpoint against Eunomia, capture shape, commit.**

```bash
# For each of the 6 sync endpoints:
curl -s "http://localhost:8787/finngen/romopapi/code-counts?source=..." | jq 'paths(scalars) | .' > tmp_codecounts_paths.json
```

Convert to a committed shape manifest (keys + types, not values). Use a small R helper:

```r
# darkstar/tests/testthat/helper-shape.R
response_shape <- function(x) {
  if (is.list(x)) setNames(lapply(x, response_shape), names(x))
  else class(x)
}
```

Run the helper against each endpoint response, serialize via `jsonlite::toJSON(pretty=TRUE)`, write to `darkstar/tests/fixtures/darkstar-finngen-shapes.json`.

- [ ] **Step 2: Commit the shapes fixture + a shape-drift test**

```bash
git add darkstar/tests/fixtures/darkstar-finngen-shapes.json darkstar/tests/testthat/helper-shape.R
git commit -m "test(darkstar): commit finngen response shape snapshot + drift test"
```

---

## Part C — Laravel Backend

Now the meat. Build bottom-up: schema → models → services → jobs → middleware → controllers → routes → commands.

### Task C1: Migrations — `finngen_runs` + `finngen_analysis_modules`

**Files:**
- Create: `backend/database/migrations/YYYY_MM_DD_create_finngen_runs_table.php`
- Create: `backend/database/migrations/YYYY_MM_DD_create_finngen_analysis_modules_table.php`

- [ ] **Step 1: Generate + write `finngen_runs` migration**

Run: `docker compose exec php php artisan make:migration create_finngen_runs_table`

Replace body with (matches spec §4.3 exactly — includes all columns from §5.9 too):

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app.finngen_runs', function (Blueprint $table) {
            $table->char('id', 26)->primary();
            $table->foreignId('user_id')->constrained('app.users')->cascadeOnDelete();
            $table->string('source_key', 64);
            $table->string('analysis_type', 64);
            $table->jsonb('params');
            $table->string('status', 16)->default('queued');
            $table->jsonb('progress')->nullable();
            $table->jsonb('artifacts')->default(DB::raw("'{}'::jsonb"));
            $table->jsonb('summary')->nullable();
            $table->jsonb('error')->nullable();
            $table->boolean('pinned')->default(false);
            $table->boolean('artifacts_pruned')->default(false);
            $table->timestampTz('artifacts_pruned_at')->nullable();
            $table->string('darkstar_job_id', 64)->nullable();
            $table->string('horizon_job_id', 64)->nullable();
            $table->smallInteger('reconciled_count')->default(0);
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('finished_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'created_at']);
            $table->index('analysis_type');
        });

        DB::statement("
            ALTER TABLE app.finngen_runs
            ADD CONSTRAINT finngen_runs_status_check
            CHECK (status IN ('queued','running','canceling','succeeded','failed','canceled'))
        ");
        DB::statement("
            ALTER TABLE app.finngen_runs
            ADD CONSTRAINT finngen_runs_terminal_requires_finished_at
            CHECK (status NOT IN ('succeeded','failed','canceled') OR finished_at IS NOT NULL)
        ");
        DB::statement("
            CREATE INDEX finngen_runs_status_idx ON app.finngen_runs (status)
            WHERE status IN ('queued','running','canceling')
        ");
        DB::statement("
            CREATE INDEX finngen_runs_gc_idx ON app.finngen_runs (finished_at)
            WHERE pinned = false AND finished_at IS NOT NULL
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('app.finngen_runs');
    }
};
```

- [ ] **Step 2: Write `finngen_analysis_modules` migration**

Run: `docker compose exec php php artisan make:migration create_finngen_analysis_modules_table`

```php
Schema::create('app.finngen_analysis_modules', function (Blueprint $table) {
    $table->string('key', 64)->primary();
    $table->string('label', 128);
    $table->text('description');
    $table->string('darkstar_endpoint', 128);
    $table->boolean('enabled')->default(true);
    $table->string('min_role', 32)->default('researcher');
    $table->jsonb('settings_schema')->nullable();
    $table->jsonb('default_settings')->nullable();
    $table->jsonb('result_schema')->nullable();
    $table->string('result_component', 64)->nullable();
    $table->timestampsTz();
});
```

- [ ] **Step 3: Run migrations**

```bash
docker compose exec php sh -c 'cd /var/www/html && php artisan migrate --path=database/migrations'
```
Expected: both migrations run.

- [ ] **Step 4: Verify schema**

```bash
docker compose exec postgres psql -U parthenon -d parthenon -c "\d app.finngen_runs"
docker compose exec postgres psql -U parthenon -d parthenon -c "\d app.finngen_analysis_modules"
```

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/*create_finngen_*.php
git commit -m "feat(finngen): create finngen_runs + finngen_analysis_modules tables"
```

### Task C2: Eloquent models

**Files:**
- Create: `backend/app/Models/App/FinnGen/Run.php`
- Create: `backend/app/Models/App/FinnGen/AnalysisModule.php`

- [ ] **Step 1: Create `Run.php`**

```php
<?php

namespace App\Models\App\FinnGen;

use App\Models\App\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Run extends Model
{
    use HasUlids;

    protected $table = 'app.finngen_runs';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'user_id', 'source_key', 'analysis_type', 'params',
        'status', 'progress', 'artifacts', 'summary', 'error',
        'pinned', 'artifacts_pruned', 'artifacts_pruned_at',
        'darkstar_job_id', 'horizon_job_id', 'reconciled_count',
        'started_at', 'finished_at',
    ];

    protected $casts = [
        'params'              => 'array',
        'progress'            => 'array',
        'artifacts'           => 'array',
        'summary'             => 'array',
        'error'               => 'array',
        'pinned'              => 'boolean',
        'artifacts_pruned'    => 'boolean',
        'artifacts_pruned_at' => 'datetime',
        'reconciled_count'    => 'integer',
        'started_at'          => 'datetime',
        'finished_at'         => 'datetime',
    ];

    public const STATUS_QUEUED    = 'queued';
    public const STATUS_RUNNING   = 'running';
    public const STATUS_CANCELING = 'canceling';
    public const STATUS_SUCCEEDED = 'succeeded';
    public const STATUS_FAILED    = 'failed';
    public const STATUS_CANCELED  = 'canceled';

    public const TERMINAL_STATUSES = [
        self::STATUS_SUCCEEDED, self::STATUS_FAILED, self::STATUS_CANCELED,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', [self::STATUS_QUEUED, self::STATUS_RUNNING, self::STATUS_CANCELING]);
    }

    public function scopeEligibleForGC($query, int $retentionDays)
    {
        return $query->where('pinned', false)
            ->whereNotNull('finished_at')
            ->where('finished_at', '<', now()->subDays($retentionDays));
    }
}
```

- [ ] **Step 2: Create `AnalysisModule.php`**

```php
<?php

namespace App\Models\App\FinnGen;

use Illuminate\Database\Eloquent\Model;

class AnalysisModule extends Model
{
    protected $table = 'app.finngen_analysis_modules';
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'key', 'label', 'description', 'darkstar_endpoint',
        'enabled', 'min_role',
        'settings_schema', 'default_settings', 'result_schema', 'result_component',
    ];

    protected $casts = [
        'enabled'          => 'boolean',
        'settings_schema'  => 'array',
        'default_settings' => 'array',
        'result_schema'    => 'array',
    ];

    public function scopeEnabled($query) { return $query->where('enabled', true); }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Models/App/FinnGen
git commit -m "feat(finngen): Run + AnalysisModule Eloquent models"
```

### Task C3: Seeders

**Files:**
- Create: `backend/database/seeders/FinnGenAnalysisModuleSeeder.php`
- Create: `backend/database/seeders/Testing/FinnGenTestingSeeder.php`

- [ ] **Step 1: Production module seeder**

```php
<?php

namespace Database\Seeders;

use App\Models\App\FinnGen\AnalysisModule;
use Illuminate\Database\Seeder;

class FinnGenAnalysisModuleSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            ['key' => 'co2.codewas',      'label' => 'CodeWAS',          'description' => 'Phenome-wide association scan', 'darkstar_endpoint' => '/finngen/co2/codewas'],
            ['key' => 'co2.time_codewas', 'label' => 'timeCodeWAS',      'description' => 'CodeWAS with temporal windows', 'darkstar_endpoint' => '/finngen/co2/time-codewas'],
            ['key' => 'co2.overlaps',     'label' => 'Cohort Overlaps',  'description' => 'Upset-plot cohort intersection analysis', 'darkstar_endpoint' => '/finngen/co2/overlaps'],
            ['key' => 'co2.demographics', 'label' => 'Cohort Demographics', 'description' => 'Demographic summary of cohorts', 'darkstar_endpoint' => '/finngen/co2/demographics'],
        ];

        foreach ($modules as $mod) {
            AnalysisModule::updateOrCreate(['key' => $mod['key']], $mod + ['enabled' => true, 'min_role' => 'researcher']);
        }
    }
}
```

- [ ] **Step 2: Testing seeder (used by Pest + Playwright)**

```php
<?php

namespace Database\Seeders\Testing;

use App\Models\App\FinnGen\AnalysisModule;
use App\Models\App\Source;
use App\Models\App\User;
use Database\Seeders\FinnGenAnalysisModuleSeeder;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class FinnGenTestingSeeder extends Seeder
{
    public function run(): void
    {
        // Ensure modules
        (new FinnGenAnalysisModuleSeeder)->run();

        // Ensure Eunomia source
        Source::firstOrCreate(['key' => 'eunomia'], [
            'label' => 'Eunomia Demo', 'enabled' => true,
        ]);
        // Fake-disabled source for RBAC/disabled-source tests
        Source::firstOrCreate(['key' => 'test_disabled'], [
            'label' => 'Disabled Test Source', 'enabled' => false,
        ]);

        // One user per role
        foreach (['viewer', 'researcher', 'admin', 'super-admin'] as $role) {
            $user = User::firstOrCreate(['email' => "finngen-test-{$role}@test.local"], [
                'name' => "FinnGen Test {$role}",
                'password' => bcrypt('finngen-test-password'),
            ]);
            $user->syncRoles([Role::findOrCreate($role)]);
        }
    }
}
```

- [ ] **Step 3: Run the production seeder**

```bash
docker compose exec php sh -c 'cd /var/www/html && php artisan db:seed --class=Database\\Seeders\\FinnGenAnalysisModuleSeeder'
```

- [ ] **Step 4: Verify**

```bash
docker compose exec postgres psql -U parthenon -d parthenon -c "SELECT key, label FROM app.finngen_analysis_modules"
```
Expected: 4 rows.

- [ ] **Step 5: Commit**

```bash
git add backend/database/seeders/FinnGenAnalysisModuleSeeder.php backend/database/seeders/Testing/FinnGenTestingSeeder.php
git commit -m "feat(finngen): seeders for analysis modules + testing fixtures"
```

### Task C4: FinnGenSourceContextBuilder service

**Files:**
- Create: `backend/app/Services/FinnGen/FinnGenSourceContextBuilder.php`
- Create: `backend/tests/Unit/FinnGen/FinnGenSourceContextBuilderTest.php`

- [ ] **Step 1: Write failing Pest test**

```php
<?php

use App\Models\App\Source;
use App\Services\FinnGen\FinnGenSourceContextBuilder;

uses(\Tests\TestCase::class, \Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\Testing\FinnGenTestingSeeder::class);
});

it('builds a RO envelope for a valid source', function () {
    $builder = app(FinnGenSourceContextBuilder::class);
    $envelope = $builder->build('eunomia', FinnGenSourceContextBuilder::ROLE_RO);

    expect($envelope)->toHaveKey('source_key', 'eunomia');
    expect($envelope['connection']['user'])->toBe('parthenon_finngen_ro');
    expect($envelope['schemas'])->toHaveKeys(['cdm', 'vocab', 'results', 'cohort']);
});

it('builds an RW envelope with a different role', function () {
    $envelope = app(FinnGenSourceContextBuilder::class)->build('eunomia', FinnGenSourceContextBuilder::ROLE_RW);
    expect($envelope['connection']['user'])->toBe('parthenon_finngen_rw');
});

it('throws FinnGenSourceNotFound for unknown source', function () {
    app(FinnGenSourceContextBuilder::class)->build('does-not-exist', FinnGenSourceContextBuilder::ROLE_RO);
})->throws(\App\Services\FinnGen\Exceptions\FinnGenSourceNotFoundException::class);

it('throws FinnGenSourceDisabled for disabled source', function () {
    app(FinnGenSourceContextBuilder::class)->build('test_disabled', FinnGenSourceContextBuilder::ROLE_RO);
})->throws(\App\Services\FinnGen\Exceptions\FinnGenSourceDisabledException::class);
```

- [ ] **Step 2: Write skeleton exceptions**

Create `backend/app/Services/FinnGen/Exceptions/FinnGenSourceNotFoundException.php` and `FinnGenSourceDisabledException.php` — both extend `\RuntimeException`.

- [ ] **Step 3: Implement `FinnGenSourceContextBuilder`**

```php
<?php

namespace App\Services\FinnGen;

use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Services\FinnGen\Exceptions\FinnGenSourceDisabledException;
use App\Services\FinnGen\Exceptions\FinnGenSourceNotFoundException;

class FinnGenSourceContextBuilder
{
    public const ROLE_RO = 'ro';
    public const ROLE_RW = 'rw';

    public function build(string $sourceKey, string $role): array
    {
        $source = Source::where('key', $sourceKey)->first();
        if (! $source) {
            throw new FinnGenSourceNotFoundException("Source '{$sourceKey}' not found");
        }
        if (! $source->enabled) {
            throw new FinnGenSourceDisabledException("Source '{$sourceKey}' is disabled");
        }

        $daimons = SourceDaimon::where('source_id', $source->id)->get()->keyBy('daimon_type');

        $cdmSchema     = $this->schemaFor($daimons, 'CDM',        $sourceKey);
        $vocabSchema   = $this->schemaFor($daimons, 'Vocabulary', 'vocab');
        $resultsSchema = $this->schemaFor($daimons, 'Results',    "{$sourceKey}_results");
        $cohortSchema  = $resultsSchema;

        $user = $role === self::ROLE_RW ? 'parthenon_finngen_rw' : 'parthenon_finngen_ro';
        $password = $role === self::ROLE_RW
            ? config('finngen.pg_rw_password')
            : config('finngen.pg_ro_password');

        return [
            'source_key' => $sourceKey,
            'label'      => $source->label,
            'dbms'       => 'postgresql',
            'connection' => [
                'server'   => config('database.connections.pgsql.host') . '/' . config('database.connections.pgsql.database'),
                'port'     => (int) config('database.connections.pgsql.port'),
                'user'     => $user,
                'password' => $password,
            ],
            'schemas' => [
                'cdm'     => $cdmSchema,
                'vocab'   => $vocabSchema,
                'results' => $resultsSchema,
                'cohort'  => $cohortSchema,
            ],
        ];
    }

    private function schemaFor($daimons, string $type, string $default): string
    {
        return $daimons->get($type)?->table_qualifier ?? $default;
    }
}
```

- [ ] **Step 4: Run tests → pass**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Unit/FinnGen/FinnGenSourceContextBuilderTest.php'
```

- [ ] **Step 5: Pint**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pint app/Services/FinnGen tests/Unit/FinnGen'
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/FinnGen backend/tests/Unit/FinnGen
git commit -m "feat(finngen): FinnGenSourceContextBuilder service + tests"
```

### Task C5: FinnGenClient HTTP client

**Files:**
- Create: `backend/app/Services/FinnGen/FinnGenClient.php`
- Create: `backend/app/Services/FinnGen/Exceptions/FinnGenDarkstarException.php` and subclasses (Unreachable, Timeout, Rejected, Malformed)
- Create: `backend/tests/Unit/FinnGen/FinnGenClientTest.php`

- [ ] **Step 1: Write 8 failing tests** covering: successful sync (200), transport fail (502 → Unreachable), 5xx (Unreachable), 4xx dispatch (Rejected), malformed JSON (Malformed), timeout mapping, job poll happy path, job cancel idempotent.

One example:

```php
it('maps 503 to FinnGenDarkstarUnreachableException', function () {
    Http::fake(['darkstar:8787/*' => Http::response('oops', 503)]);
    expect(fn() => app(FinnGenClient::class)->getSync('/finngen/romopapi/code-counts', []))
        ->toThrow(\App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException::class);
});
```

- [ ] **Step 2: Implement `FinnGenClient`**

```php
<?php

namespace App\Services\FinnGen;

use App\Services\FinnGen\Exceptions\FinnGenDarkstarMalformedResponseException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarTimeoutException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use JsonException;

class FinnGenClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly int $timeoutSyncMs,
        private readonly int $timeoutDispatchMs,
        private readonly int $timeoutPollMs,
    ) {}

    public static function forContainer(): self
    {
        return new self(
            rtrim(config('finngen.darkstar_url'), '/'),
            config('finngen.darkstar_timeout_sync_ms'),
            config('finngen.darkstar_timeout_dispatch_ms'),
            config('finngen.darkstar_timeout_poll_ms'),
        );
    }

    public function getSync(string $path, array $query): array
    {
        return $this->request('GET', $path, query: $query, timeoutMs: $this->timeoutSyncMs);
    }

    public function postAsyncDispatch(string $path, array $body): array
    {
        return $this->request('POST', $path, body: $body, timeoutMs: $this->timeoutDispatchMs);
    }

    public function pollJob(string $jobId): array
    {
        return $this->request('GET', "/jobs/{$jobId}", timeoutMs: $this->timeoutPollMs);
    }

    public function cancelJob(string $jobId): array
    {
        return $this->request('DELETE', "/jobs/{$jobId}", timeoutMs: $this->timeoutDispatchMs);
    }

    public function health(): array
    {
        return $this->request('GET', '/health', timeoutMs: $this->timeoutSyncMs);
    }

    private function request(string $method, string $path, array $query = [], array $body = [], int $timeoutMs): array
    {
        try {
            $response = Http::timeout($timeoutMs / 1000)
                ->acceptJson()
                ->asJson()
                ->withOptions(['connect_timeout' => 5])
                ->send($method, $this->baseUrl . $path, [
                    'query' => $query,
                    'json'  => $method !== 'GET' && $body !== [] ? $body : null,
                ]);
        } catch (ConnectionException $e) {
            throw new FinnGenDarkstarUnreachableException("Connection failed: {$e->getMessage()}", previous: $e);
        } catch (\Illuminate\Http\Client\RequestException $e) {
            throw new FinnGenDarkstarUnreachableException("HTTP error: {$e->getMessage()}", previous: $e);
        }

        if ($response->status() >= 500) {
            throw new FinnGenDarkstarUnreachableException("Darkstar returned {$response->status()}");
        }
        if ($response->status() >= 400) {
            $body = $response->json() ?? [];
            throw new FinnGenDarkstarRejectedException("Darkstar rejected: {$response->status()}", darkstarError: $body['error'] ?? null);
        }

        try {
            return $response->json() ?? throw new JsonException('empty body');
        } catch (JsonException $e) {
            throw new FinnGenDarkstarMalformedResponseException("Malformed response: {$e->getMessage()}", rawBody: substr($response->body(), 0, 4096));
        }
    }
}
```

- [ ] **Step 3: Tests → pass**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Unit/FinnGen/FinnGenClientTest.php'
```

- [ ] **Step 4: Pint + commit**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pint app/Services/FinnGen tests/Unit/FinnGen'
git add backend/app/Services/FinnGen backend/tests/Unit/FinnGen/FinnGenClientTest.php
git commit -m "feat(finngen): FinnGenClient HTTP client with Http::fake tests"
```

### Task C6: FinnGenErrorMapper (pure lookup)

**Files:**
- Create: `backend/app/Services/FinnGen/FinnGenErrorMapper.php`
- Create: `backend/lang/en/finngen.php`
- Create: `backend/tests/Unit/FinnGen/FinnGenErrorMapperTest.php`

- [ ] **Step 1: Translation file**

```php
<?php

return [
    'errors' => [
        'db_connection_failed' => "Couldn't connect to the data source. Check the source configuration.",
        'db_schema_mismatch'   => 'The data source is missing expected tables or columns. This usually means the CDM needs to be re-ingested or the source config is wrong.',
        'out_of_memory'        => 'The analysis ran out of memory. Try a smaller cohort or narrower covariates.',
        'package_not_loaded'   => 'A required R package is not loaded in the runtime. Contact an administrator.',
        'analysis_exception'   => 'The analysis failed. See details below.',
        'mirai_task_crashed'   => 'The R worker process crashed. This is usually transient — retry.',
        'timeout'              => 'The analysis exceeded its allowed runtime.',
        'disk_full'            => 'The artifact volume is full. Contact an administrator.',
        'canceled'             => 'The analysis was canceled.',
    ],
];
```

- [ ] **Step 2: Mapper**

```php
<?php

namespace App\Services\FinnGen;

class FinnGenErrorMapper
{
    public const DARKSTAR_R_CATEGORIES = [
        'DB_CONNECTION_FAILED' => 'finngen.errors.db_connection_failed',
        'DB_SCHEMA_MISMATCH'   => 'finngen.errors.db_schema_mismatch',
        'OUT_OF_MEMORY'        => 'finngen.errors.out_of_memory',
        'PACKAGE_NOT_LOADED'   => 'finngen.errors.package_not_loaded',
        'ANALYSIS_EXCEPTION'   => 'finngen.errors.analysis_exception',
        'MIRAI_TASK_CRASHED'   => 'finngen.errors.mirai_task_crashed',
        'TIMEOUT'              => 'finngen.errors.timeout',
        'DISK_FULL'            => 'finngen.errors.disk_full',
        'CANCELED'             => 'finngen.errors.canceled',
    ];

    public function userMessage(string $darkstarCategory): string
    {
        $key = self::DARKSTAR_R_CATEGORIES[$darkstarCategory] ?? 'finngen.errors.analysis_exception';
        return (string) __($key);
    }

    public function wrapperCode(string $darkstarCategory): string
    {
        return 'DARKSTAR_R_' . $darkstarCategory;
    }
}
```

- [ ] **Step 3: Test — one per category + unknown fallback**

```php
it('maps every known category to a translation key', function (string $cat) {
    $out = app(\App\Services\FinnGen\FinnGenErrorMapper::class)->userMessage($cat);
    expect($out)->toBeString()->and(strlen($out))->toBeGreaterThan(10);
})->with(array_keys(\App\Services\FinnGen\FinnGenErrorMapper::DARKSTAR_R_CATEGORIES));

it('falls back to generic for unknown category', function () {
    $out = app(\App\Services\FinnGen\FinnGenErrorMapper::class)->userMessage('MADE_UP_THING');
    expect($out)->toContain('analysis failed');
});
```

- [ ] **Step 4: Tests → pass; Pint; commit**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Unit/FinnGen/FinnGenErrorMapperTest.php && vendor/bin/pint app/Services/FinnGen backend/lang/en/finngen.php'
git add backend/app/Services/FinnGen/FinnGenErrorMapper.php backend/lang/en/finngen.php backend/tests/Unit/FinnGen/FinnGenErrorMapperTest.php
git commit -m "feat(finngen): FinnGenErrorMapper pure lookup + en translations"
```

### Task C7: FinnGenArtifactService

**Files:**
- Create: `backend/app/Services/FinnGen/FinnGenArtifactService.php`
- Create: `backend/tests/Unit/FinnGen/FinnGenArtifactServiceTest.php`

Covers: path-traversal rejection, content-type by extension, streaming threshold decision, signed URL generation (Laravel `URL::signedRoute`).

- [ ] **Step 1: Tests**

Key assertions: `../etc/passwd` as key → throws `FinnGenArtifactPathTraversalException`. `.duckdb` → content-type `application/vnd.duckdb`, `attachment` disposition. 15MB file → `shouldStream() = true`; 500KB file → false. `signedUrl(Run, 'results_db')` returns a signed URL that contains the run id and key.

- [ ] **Step 2: Implementation**

```php
<?php

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\Exceptions\FinnGenArtifactPathTraversalException;
use App\Services\FinnGen\Exceptions\FinnGenArtifactNotFoundException;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinnGenArtifactService
{
    private const CONTENT_TYPES = [
        'duckdb' => 'application/vnd.duckdb',
        'html'   => 'text/html',
        'json'   => 'application/json',
        'png'    => 'image/png',
        'txt'    => 'text/plain',
    ];

    public function __construct(
        private readonly string $artifactsPath,
        private readonly int $streamThresholdBytes,
    ) {}

    public function signedUrl(Run $run, string $key, int $minutes = 10): string
    {
        return URL::temporarySignedRoute(
            'finngen.runs.artifact',
            now()->addMinutes($minutes),
            ['run' => $run->id, 'key' => $key]
        );
    }

    public function resolvePath(Run $run, string $key): string
    {
        $rel = $run->artifacts[$key] ?? null;
        if ($rel === null) {
            throw new FinnGenArtifactNotFoundException("Artifact key '{$key}' not found on run");
        }
        if (str_contains($rel, '..') || str_starts_with($rel, '/')) {
            throw new FinnGenArtifactPathTraversalException("Rejected artifact path '{$rel}'");
        }
        $full = rtrim($this->artifactsPath, '/') . '/' . ltrim($rel, '/');
        if (! file_exists($full)) {
            throw new FinnGenArtifactNotFoundException("Artifact file missing: {$full}");
        }
        return $full;
    }

    public function respond(string $path, string $filename): BinaryFileResponse|StreamedResponse
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $contentType = self::CONTENT_TYPES[$ext] ?? 'application/octet-stream';

        if (filesize($path) >= $this->streamThresholdBytes) {
            // X-Accel-Redirect path: Nginx is configured with internal /_artifacts/
            $internal = '/_artifacts/' . str_replace($this->artifactsPath . '/', '', $path);
            return response('', 200, [
                'X-Accel-Redirect'    => $internal,
                'Content-Type'        => $contentType,
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            ]);
        }

        return (new BinaryFileResponse($path))
            ->setContentDisposition('attachment', $filename);
    }
}
```

- [ ] **Step 3: Register binding in AppServiceProvider**

```php
$this->app->bind(\App\Services\FinnGen\FinnGenArtifactService::class, fn () => new \App\Services\FinnGen\FinnGenArtifactService(
    config('finngen.artifacts_path'),
    config('finngen.artifacts_stream_threshold_bytes'),
));
```

- [ ] **Step 4: Tests → pass; Pint; commit**

```bash
git add backend/app/Services/FinnGen/FinnGenArtifactService.php backend/app/Services/FinnGen/Exceptions/FinnGenArtifact*.php backend/tests/Unit/FinnGen/FinnGenArtifactServiceTest.php backend/app/Providers/AppServiceProvider.php
git commit -m "feat(finngen): FinnGenArtifactService with path-traversal protection + streaming"
```

### Task C8: FinnGenAnalysisModuleRegistry

**Files:**
- Create: `backend/app/Services/FinnGen/FinnGenAnalysisModuleRegistry.php`
- Create: `backend/tests/Unit/FinnGen/FinnGenAnalysisModuleRegistryTest.php`

- [ ] **Step 1: Implementation**

```php
<?php

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\AnalysisModule;
use Illuminate\Support\Facades\Cache;

class FinnGenAnalysisModuleRegistry
{
    private const CACHE_KEY = 'finngen:analysis-modules';
    private const CACHE_TTL = 300;

    public function all(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, fn () =>
            AnalysisModule::enabled()->get()->keyBy('key')->all()
        );
    }

    public function find(string $key): ?AnalysisModule
    {
        return $this->all()[$key] ?? null;
    }

    public function assertEnabled(string $key): AnalysisModule
    {
        $mod = $this->find($key);
        if (! $mod) {
            throw new Exceptions\FinnGenUnknownAnalysisTypeException("Analysis type '{$key}' is not registered or is disabled");
        }
        return $mod;
    }

    public function validateParams(string $key, array $params): void
    {
        $mod = $this->assertEnabled($key);
        // SP1: accept any params shape; SP3 fills out settings_schema + JSON Schema validation.
        // Keep this method as the hook point so controllers don't change when SP3 lands.
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
```

- [ ] **Step 2: Tests — seeded modules, disabled filter, unknown throws, validate stub**

- [ ] **Step 3: Pass; Pint; commit**

```bash
git commit -am "feat(finngen): FinnGenAnalysisModuleRegistry with 5-min cache"
```

### Task C9: EnforceFinnGenIdempotency middleware + FinnGenIdempotencyStore

**Files:**
- Create: `backend/app/Services/FinnGen/FinnGenIdempotencyStore.php`
- Create: `backend/app/Http/Middleware/EnforceFinnGenIdempotency.php`
- Create: `backend/tests/Unit/FinnGen/EnforceFinnGenIdempotencyTest.php`

- [ ] **Step 1: Store**

```php
<?php

namespace App\Services\FinnGen;

use Illuminate\Support\Facades\Redis;

class FinnGenIdempotencyStore
{
    public function __construct(private readonly int $ttlSeconds) {}

    public function trySet(string $key, string $fingerprint, string $responseBody): string
    {
        $k = $this->redisKey($key);
        $set = Redis::connection()->set($k, $fingerprint, 'EX', $this->ttlSeconds, 'NX');
        if ($set !== true && $set !== 'OK') {
            return $this->peek($key)?->fingerprint === $fingerprint ? 'replay' : 'conflict';
        }
        Redis::connection()->setex($this->responseKey($key), $this->ttlSeconds, $responseBody);
        return 'fresh';
    }

    public function peek(string $key): ?object
    {
        $fp = Redis::connection()->get($this->redisKey($key));
        if (! $fp) return null;
        $body = Redis::connection()->get($this->responseKey($key));
        return (object) ['fingerprint' => $fp, 'response' => $body];
    }

    private function redisKey(string $k): string { return "finngen:idem:{$k}"; }
    private function responseKey(string $k): string { return "finngen:idem:{$k}:response"; }
}
```

- [ ] **Step 2: Middleware**

```php
<?php

namespace App\Http\Middleware;

use App\Services\FinnGen\FinnGenIdempotencyStore;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EnforceFinnGenIdempotency
{
    public function __construct(private readonly FinnGenIdempotencyStore $store) {}

    public function handle(Request $request, Closure $next)
    {
        $userId = optional($request->user())->id;
        $key = $request->header('Idempotency-Key');

        if (! $userId || ! $key) {
            if ($userId && ! $key) {
                Log::info('finngen.idempotency.missing', ['user_id' => $userId, 'route' => $request->path()]);
            }
            return $next($request);
        }

        $fingerprint = hash('sha256', $userId . ':' . $key . ':' . json_encode($request->all()));
        $composite = "{$userId}:{$key}";

        try {
            $existing = $this->store->peek($composite);
            if ($existing) {
                if ($existing->fingerprint === $fingerprint) {
                    // Replay cached response
                    return response($existing->response, 200)->header('Idempotent-Replay', 'true');
                }
                return response()->json([
                    'error' => [
                        'code'    => 'FINNGEN_IDEMPOTENCY_CONFLICT',
                        'message' => 'A different request was already submitted with this key.',
                    ],
                ], 409);
            }

            $response = $next($request);
            if ($response->isSuccessful()) {
                $this->store->trySet($composite, $fingerprint, $response->getContent());
            }
            return $response;
        } catch (\Throwable $e) {
            Log::warning('finngen.idempotency.redis_down', ['err' => $e->getMessage()]);
            return $next($request);  // Degrade open
        }
    }
}
```

- [ ] **Step 3: Register middleware alias in `bootstrap/app.php`**

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'finngen.idempotency' => \App\Http\Middleware\EnforceFinnGenIdempotency::class,
    ]);
})
```

- [ ] **Step 4: Bind store**

In `AppServiceProvider`:
```php
$this->app->bind(FinnGenIdempotencyStore::class, fn () => new FinnGenIdempotencyStore(config('finngen.idempotency_ttl_seconds')));
```

- [ ] **Step 5: Tests — fresh / replay / conflict / missing header / Redis outage degradation**

- [ ] **Step 6: Pint + commit**

```bash
git commit -am "feat(finngen): Idempotency-Key middleware with Redis SETNX + degradation"
```

### Task C10: FinnGenRunService

**Files:**
- Create: `backend/app/Services/FinnGen/FinnGenRunService.php`
- Create: `backend/tests/Unit/FinnGen/FinnGenRunServiceTest.php`

- [ ] **Step 1: Implementation**

```php
<?php

namespace App\Services\FinnGen;

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\Run;
use Illuminate\Support\Facades\DB;

class FinnGenRunService
{
    public function __construct(
        private readonly FinnGenAnalysisModuleRegistry $registry,
    ) {}

    public function create(int $userId, string $sourceKey, string $analysisType, array $params): Run
    {
        if (config('finngen.pause_dispatch')) {
            abort(503, 'FinnGen dispatch is paused by admin.');
        }
        $this->registry->validateParams($analysisType, $params);

        return DB::transaction(function () use ($userId, $sourceKey, $analysisType, $params) {
            $run = Run::create([
                'user_id'       => $userId,
                'source_key'    => $sourceKey,
                'analysis_type' => $analysisType,
                'params'        => $params,
                'status'        => Run::STATUS_QUEUED,
            ]);
            RunFinnGenAnalysisJob::dispatch($run->id)->onQueue('finngen');
            return $run;
        });
    }

    public function requestCancel(Run $run): Run
    {
        if ($run->isTerminal()) return $run;  // idempotent
        $run->update(['status' => Run::STATUS_CANCELING]);
        return $run->fresh();
    }

    public function pin(Run $run): Run       { $run->update(['pinned' => true]); return $run->fresh(); }
    public function unpin(Run $run): Run     { $run->update(['pinned' => false]); return $run->fresh(); }

    public function markRunning(Run $run): void
    {
        $run->update(['status' => Run::STATUS_RUNNING, 'started_at' => now()]);
    }

    public function markSucceeded(Run $run, array $artifacts, ?array $summary): void
    {
        $run->update([
            'status'       => Run::STATUS_SUCCEEDED,
            'artifacts'    => $artifacts,
            'summary'      => $summary,
            'finished_at'  => now(),
        ]);
    }

    public function markFailed(Run $run, string $code, ?string $category, array $errorDetail): void
    {
        $run->update([
            'status'      => Run::STATUS_FAILED,
            'error'       => array_merge(['code' => $code, 'category' => $category], $errorDetail),
            'finished_at' => now(),
        ]);
    }

    public function markCanceled(Run $run, bool $forced = false): void
    {
        $run->update([
            'status'      => Run::STATUS_CANCELED,
            'error'       => ['code' => 'DARKSTAR_R_CANCELED', 'category' => 'CANCELED', 'forced' => $forced],
            'finished_at' => now(),
        ]);
    }

    public function updateProgress(Run $run, array $progress): void
    {
        $run->update(['progress' => $progress]);
    }
}
```

- [ ] **Step 2: Tests — create with pause flag, cancel idempotent on terminal, transitions**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(finngen): FinnGenRunService lifecycle orchestrator"
```

### Task C11: RunFinnGenAnalysisJob

**Files:**
- Create: `backend/app/Jobs/FinnGen/RunFinnGenAnalysisJob.php`
- Create: `backend/tests/Feature/FinnGen/FinnGenRunsLifecycleTest.php` (depends on this job + C12 controller)

- [ ] **Step 1: Implement the job**

```php
<?php

namespace App\Jobs\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class RunFinnGenAnalysisJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 7200;
    public bool $failOnTimeout = true;

    public function __construct(public string $runId, public bool $resumeMode = false) {}

    public function backoff(): array { return [5, 30, 120]; }

    public function handle(
        FinnGenClient $client,
        FinnGenRunService $runs,
        FinnGenSourceContextBuilder $sourceBuilder,
    ): void {
        $run = Run::findOrFail($this->runId);
        if ($run->isTerminal()) return;

        $mod = app(\App\Services\FinnGen\FinnGenAnalysisModuleRegistry::class)->assertEnabled($run->analysis_type);
        $role = $this->roleForAnalysisType($run->analysis_type);
        $source = $sourceBuilder->build($run->source_key, $role);

        $runs->markRunning($run);

        // Dispatch (unless resume)
        if (! $this->resumeMode) {
            try {
                $dispatch = $client->postAsyncDispatch($mod->darkstar_endpoint, [
                    'source'  => $source,
                    'run_id'  => $run->id,
                    'params'  => $run->params,
                    'analysis_settings' => $run->params,
                ]);
            } catch (FinnGenDarkstarRejectedException $e) {
                $runs->markFailed($run, 'FINNGEN_DARKSTAR_REJECTED', null, ['darkstar_error' => $e->darkstarError]);
                return;
            }
            $run->update(['darkstar_job_id' => $dispatch['job_id']]);
        }

        // Poll loop
        while (true) {
            // Cooperative cancellation
            $fresh = $run->fresh();
            if ($fresh->status === Run::STATUS_CANCELING) {
                try { $client->cancelJob($fresh->darkstar_job_id); } catch (Throwable $e) {}
                // Wait one poll for terminal confirmation
                sleep(2);
                $state = $client->pollJob($fresh->darkstar_job_id);
                $runs->markCanceled($run, forced: (bool)($state['forced'] ?? false));
                return;
            }

            $state = $client->pollJob($run->darkstar_job_id);

            if (isset($state['progress'])) $runs->updateProgress($run, $state['progress']);

            if ($state['status'] === 'done') {
                $runs->markSucceeded($run, $state['artifacts'] ?? [], $state['summary'] ?? null);
                return;
            }
            if ($state['status'] === 'error') {
                $cat = $state['error']['category'] ?? 'ANALYSIS_EXCEPTION';
                $runs->markFailed($run, "DARKSTAR_R_{$cat}", $cat, ['r_error' => $state['error']]);
                return;
            }
            if ($state['status'] === 'canceled') {
                $runs->markCanceled($run);
                return;
            }

            // Poll cadence: 2s for first 30s, 5s thereafter
            $elapsed = now()->diffInSeconds($run->started_at ?? now());
            sleep($elapsed < 30 ? 2 : 5);
        }
    }

    public function failed(Throwable $e): void
    {
        $run = Run::find($this->runId);
        if (! $run || $run->isTerminal()) return;

        $code = match (true) {
            $e instanceof FinnGenDarkstarUnreachableException => 'FINNGEN_DARKSTAR_UNREACHABLE',
            $e instanceof \Illuminate\Http\Client\RequestException => 'FINNGEN_DARKSTAR_UNREACHABLE',
            default => 'FINNGEN_WORKER_INTERRUPTED',
        };
        app(FinnGenRunService::class)->markFailed($run, $code, null, ['exception' => get_class($e), 'message' => $e->getMessage()]);
    }

    private function roleForAnalysisType(string $type): string
    {
        return str_starts_with($type, 'romopapi.') || str_starts_with($type, 'hades.')
            ? FinnGenSourceContextBuilder::ROLE_RO
            : FinnGenSourceContextBuilder::ROLE_RW;
    }
}
```

- [ ] **Step 2: Tests — full lifecycle with Http::fake simulating sequence queued → running → progressed → done; cancellation path; failure path**

- [ ] **Step 3: Register `finngen` Horizon queue**

Edit `backend/config/horizon.php`. In all environments' `supervisors`:

```php
'supervisor-1' => [
    'queue' => ['default', 'finngen', /* ...existing queues... */],
    'maxProcesses' => 4,
    'timeout' => 7200,
    // ... matches existing pattern
],
```

Alternatively add a dedicated `supervisor-finngen`.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(finngen): RunFinnGenAnalysisJob with polling + cancellation + retry"
```

### Task C12: Controllers + Routes + CreateRunRequest

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/FinnGen/RunController.php`
- Create: `backend/app/Http/Controllers/Api/V1/FinnGen/ArtifactController.php`
- Create: `backend/app/Http/Controllers/Api/V1/FinnGen/SyncReadController.php`
- Create: `backend/app/Http/Controllers/Api/V1/FinnGen/AnalysisModuleController.php`
- Create: `backend/app/Http/Requests/FinnGen/CreateRunRequest.php`
- Modify: `backend/routes/api.php` (add finngen group; remove old `/study-agent/finngen-*`)
- Modify: `backend/app/Http/Controllers/Api/V1/StudyAgentController.php` (remove FinnGen methods)

- [ ] **Step 1: Controllers**

```php
// RunController.php — abbreviated; full file should ~150 lines
namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\CreateRunRequest;
use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\FinnGenRunService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RunController extends Controller
{
    public function __construct(private readonly FinnGenRunService $svc) {}

    public function index(Request $r): JsonResponse
    {
        $q = Run::forUser($r->user()->id);
        foreach (['status', 'analysis_type', 'source_key'] as $f) {
            if ($r->filled($f)) $q->where($f, $r->input($f));
        }
        if ($r->filled('pinned')) $q->where('pinned', $r->boolean('pinned'));
        return response()->json([
            'data' => $q->orderByDesc('created_at')->paginate((int)($r->input('per_page', 25))),
        ]);
    }

    public function store(CreateRunRequest $r): JsonResponse
    {
        $run = $this->svc->create($r->user()->id, $r->input('source_key'), $r->input('analysis_type'), (array)$r->input('params', []));
        return response()->json($run, 201);
    }

    public function show(Request $r, Run $run): JsonResponse
    {
        $this->authorize('view', $run);
        return response()->json($run);
    }

    public function cancel(Request $r, Run $run): JsonResponse
    {
        $this->authorize('update', $run);
        return response()->json($this->svc->requestCancel($run), 202);
    }

    public function pin(Request $r, Run $run): JsonResponse   { $this->authorize('update', $run); return response()->json($this->svc->pin($run)); }
    public function unpin(Request $r, Run $run): JsonResponse { $this->authorize('update', $run); return response()->json($this->svc->unpin($run)); }
}
```

Policies: create `app/Policies/FinnGen/RunPolicy.php` with `view`/`update` checking ownership or admin role.

`ArtifactController` streams via `FinnGenArtifactService::respond`. `SyncReadController` wraps `FinnGenClient::getSync` with Redis cache (`finngen:sync:{endpoint}:{source}:{hash}`, TTL 3600). `AnalysisModuleController::index` returns `FinnGenAnalysisModuleRegistry::all()`.

- [ ] **Step 2: `CreateRunRequest`**

```php
namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

class CreateRunRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()->can('run', \App\Models\App\FinnGen\Run::class) || $this->user()->hasPermissionTo('analyses.run'); }

    public function rules(): array
    {
        return [
            'analysis_type' => ['required', 'string'],
            'source_key'    => ['required', 'string'],
            'params'        => ['required', 'array'],
        ];
    }
}
```

- [ ] **Step 3: Routes**

In `backend/routes/api.php`, find the `Route::prefix('v1')->middleware('auth:sanctum')->group(function () { ... })` block. Inside, add:

```php
Route::prefix('finngen')->group(function () {
    // Runs
    Route::get('/runs',         [\App\Http\Controllers\Api\V1\FinnGen\RunController::class, 'index'])->middleware('permission:analyses.view');
    Route::post('/runs',        [\App\Http\Controllers\Api\V1\FinnGen\RunController::class, 'store'])
        ->middleware(['permission:analyses.run', 'finngen.idempotency', 'throttle:10,1']);
    Route::get('/runs/{run}',   [\App\Http\Controllers\Api\V1\FinnGen\RunController::class, 'show'])->middleware('permission:analyses.view');
    Route::post('/runs/{run}/cancel',     [\App\Http\Controllers\Api\V1\FinnGen\RunController::class, 'cancel'])->middleware('permission:analyses.run');
    Route::post('/runs/{run}/pin',        [\App\Http\Controllers\Api\V1\FinnGen\RunController::class, 'pin'])->middleware('permission:analyses.view');
    Route::delete('/runs/{run}/pin',      [\App\Http\Controllers\Api\V1\FinnGen\RunController::class, 'unpin'])->middleware('permission:analyses.view');

    // Artifacts (signed URL — ensure signed middleware validates)
    Route::get('/runs/{run}/artifacts/{key}',
        [\App\Http\Controllers\Api\V1\FinnGen\ArtifactController::class, 'show']
    )->middleware(['permission:analyses.view', 'signed'])->name('finngen.runs.artifact');

    // Sync reads
    Route::prefix('sync')->middleware(['permission:analyses.view', 'throttle:60,1'])->group(function () {
        Route::get('/romopapi/code-counts',   [\App\Http\Controllers\Api\V1\FinnGen\SyncReadController::class, 'romopapiCodeCounts']);
        Route::get('/romopapi/relationships', [\App\Http\Controllers\Api\V1\FinnGen\SyncReadController::class, 'romopapiRelationships']);
        Route::get('/romopapi/ancestors',     [\App\Http\Controllers\Api\V1\FinnGen\SyncReadController::class, 'romopapiAncestors']);
        Route::get('/hades/overlap',          [\App\Http\Controllers\Api\V1\FinnGen\SyncReadController::class, 'hadesOverlap']);
        Route::get('/hades/demographics',     [\App\Http\Controllers\Api\V1\FinnGen\SyncReadController::class, 'hadesDemographics']);
        Route::get('/hades/counts',           [\App\Http\Controllers\Api\V1\FinnGen\SyncReadController::class, 'hadesCounts']);
    });

    // Module registry
    Route::get('/analyses/modules', [\App\Http\Controllers\Api\V1\FinnGen\AnalysisModuleController::class, 'index'])->middleware('permission:analyses.view');
});
```

- [ ] **Step 4: Delete the old `/study-agent/finngen-*` routes**

Search `backend/routes/api.php` for `study-agent/finngen` and remove each matching `Route::...` line. Also remove any imports of `StudyAgentController::finngen*` methods.

- [ ] **Step 5: Remove FinnGen methods from `StudyAgentController.php`**

Open the file, delete every method whose body references `FinnGenWorkbenchService`, `FinnGenCo2Service`, `FinnGenRomopapiService`, `FinnGenHadesService`, `FinnGenRunService` (old version), `FinnGenExternalAdapterService`. Keep other methods.

- [ ] **Step 6: `artisan route:list --path=finngen` → show all new routes with expected middleware**

```bash
docker compose exec php sh -c 'cd /var/www/html && php artisan route:list --path=finngen'
```
Expected: 14 routes, each with `auth:sanctum` + `permission:*` + throttles where set.

- [ ] **Step 7: Feature tests** (`FinnGenRunsLifecycleTest`, `FinnGenRunsValidationTest`, `FinnGenRunsRBACTest`, `FinnGenSyncReadsTest`, `FinnGenIdempotencyTest`, `FinnGenRunsCancellationTest`) — write per §6.3 roster. Use `Http::fake()` + `Queue::fake()` + `RefreshDatabase` + `FinnGenTestingSeeder`.

- [ ] **Step 8: Pest → pass**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Feature/FinnGen'
```

- [ ] **Step 9: Pint + PHPStan + commit**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pint && vendor/bin/phpstan analyse'
git add backend/app/Http/Controllers/Api/V1/FinnGen backend/app/Http/Requests/FinnGen backend/routes/api.php backend/app/Http/Controllers/Api/V1/StudyAgentController.php backend/app/Policies/FinnGen backend/tests/Feature/FinnGen backend/config/horizon.php
git commit -m "feat(finngen): API v1 routes + controllers + RBAC policies + feature tests"
```

### Task C13: Artisan commands (6 of them)

**Files:**
- `backend/app/Console/Commands/FinnGen/PruneRunsCommand.php`
- `backend/app/Console/Commands/FinnGen/SweepArtifactsCommand.php`
- `backend/app/Console/Commands/FinnGen/ReconcileOrphansCommand.php`
- `backend/app/Console/Commands/FinnGen/SmokeTestCommand.php`
- `backend/app/Console/Commands/FinnGen/SnapshotOpenapiCommand.php`
- `backend/app/Console/Commands/FinnGen/PauseDispatchCommand.php`

Each command implements spec §5 semantics. Representative:

- [ ] **`finngen:prune-runs`** — query `Run::eligibleForGC(config('finngen.gc_retention_days'))`, `File::deleteDirectory(artifactsPath . '/runs/' . $id)`, then delete the row. Emit telemetry event.

- [ ] **`finngen:sweep-artifacts`** — iterate all succeeded runs with non-empty `artifacts`; stat files; on missing, mark `artifacts_pruned`. Then iterate directory listing under artifacts path; delete dirs with no row.

- [ ] **`finngen:reconcile-orphans`** — with `Cache::lock('finngen:reconcile-orphans', 60)`; for rows in `(running, canceling)` older than 2 minutes: poll Darkstar, update state; if `running` → re-dispatch `RunFinnGenAnalysisJob` with `resumeMode: true`, bump `reconciled_count`; at 3, force-fail.

- [ ] **`finngen:smoke-test`** — one sync ROMOPAPI call against `eunomia` + one end-to-end dispatch-poll-complete for `co2.codewas`; print pass/fail table.

- [ ] **`finngen:snapshot-openapi`** — render OpenAPI from routes; write to `backend/tests/Fixtures/openapi-finngen-snapshot.yaml`.

- [ ] **`finngen:pause-dispatch [--clear]`** — set/unset `Cache::forever('finngen.pause_dispatch', true)` and reflect into config at runtime.

Scheduler registration in `backend/bootstrap/app.php` (Laravel 11) or `Console/Kernel.php`:

```php
->withSchedule(function (Schedule $schedule) {
    $schedule->command('finngen:prune-runs')->dailyAt('03:45');
    $schedule->command('finngen:sweep-artifacts')->weeklyOn(0, '04:00');
    $schedule->command('finngen:reconcile-orphans')->everyFifteenMinutes()->withoutOverlapping();
})
```

- [ ] **Tests for each command** (feature tests under `tests/Feature/FinnGen/`; see §6.3).

- [ ] **Pint + commit**

```bash
git commit -am "feat(finngen): artisan commands — prune, sweep, reconcile, smoke-test, snapshot-openapi, pause-dispatch"
```

### Task C14: Delete old `StudyAgent/FinnGen*.php` + `FinnGenRun.php`

- [ ] **Step 1: Delete**

```bash
git rm backend/app/Services/StudyAgent/FinnGen*.php backend/app/Models/App/FinnGenRun.php
```

- [ ] **Step 2: Verify no references remain**

```bash
grep -rn "FinnGenWorkbenchService\|FinnGenCo2Service\|FinnGenRomopapiService\|FinnGenHadesService\|FinnGenExternalAdapterService\|FinnGenCohortOperationBuilder\|FinnGenCo2FamilyBuilder\|FinnGenSharedHelpers\|App\\\\Models\\\\App\\\\FinnGenRun" backend/app backend/routes backend/config backend/database 2>/dev/null
```
Expected: zero output.

- [ ] **Step 3: Pest full run**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest'
```

- [ ] **Step 4: PHPStan**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/phpstan analyse'
```

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(finngen): delete deprecated StudyAgent/FinnGen* + old FinnGenRun model"
```

---

## Part D — Frontend Foundation

SP1 frontend is just the hooks + types + a tiny badge. No pages, no features.

### Task D1: Regenerate OpenAPI types

- [ ] **Step 1: Run OpenAPI generation**

```bash
./deploy.sh --openapi
```

- [ ] **Step 2: Verify new types present**

```bash
grep -n "FinnGenRun\|FinnGenAnalysisType\|FinnGenRunStatus" frontend/src/types/api.generated.ts | head -20
```

- [ ] **Step 3: tsc + vite build**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit && npx vite build'
```

- [ ] **Step 4: Commit**

```bash
git commit -am "chore(finngen): regenerate OpenAPI types"
```

### Task D2: Frontend foundation module

**Files:**
- `frontend/src/features/_finngen-foundation/api.ts`
- `frontend/src/features/_finngen-foundation/hooks/{useFinnGenRun,useFinnGenSyncRead,useCreateFinnGenRun}.ts`
- `frontend/src/features/_finngen-foundation/utils/idempotencyKey.ts`
- `frontend/src/features/_finngen-foundation/components/RunStatusBadge.tsx`
- `frontend/src/features/_finngen-foundation/types.ts`

- [ ] **Step 1: `idempotencyKey.ts`**

```ts
import { v4 as uuidv4 } from 'uuid';

export const makeIdempotencyKey = (): string => uuidv4();
```

Test: same key reused across `rerender`, new key on explicit call. (Use `uuid` npm package if not present.)

- [ ] **Step 2: `api.ts`**

```ts
import { apiClient } from '@/lib/api-client';
import type { FinnGenRun } from '@/types/api.generated';

export const finngenApi = {
  listRuns: (params?: { status?: string; analysis_type?: string; page?: number; per_page?: number }) =>
    apiClient.get<{ data: FinnGenRun[] }>('/api/v1/finngen/runs', { params }).then(r => r.data),

  getRun: (id: string) =>
    apiClient.get<FinnGenRun>(`/api/v1/finngen/runs/${id}`).then(r => r.data),

  createRun: (body: { analysis_type: string; source_key: string; params: Record<string, unknown> }, idempotencyKey: string) =>
    apiClient.post<FinnGenRun>('/api/v1/finngen/runs', body, { headers: { 'Idempotency-Key': idempotencyKey } }).then(r => r.data),

  cancelRun: (id: string) =>
    apiClient.post<FinnGenRun>(`/api/v1/finngen/runs/${id}/cancel`).then(r => r.data),

  pinRun: (id: string) =>
    apiClient.post<FinnGenRun>(`/api/v1/finngen/runs/${id}/pin`).then(r => r.data),

  unpinRun: (id: string) =>
    apiClient.delete<FinnGenRun>(`/api/v1/finngen/runs/${id}/pin`).then(r => r.data),

  syncRead: <T = unknown>(path: string, params: Record<string, unknown>, refresh = false) =>
    apiClient.get<T>(`/api/v1/finngen/sync/${path}`, { params: { ...params, ...(refresh ? { refresh: 'true' } : {}) } }).then(r => r.data),
};
```

- [ ] **Step 3: `useFinnGenRun.ts` (polling hook)**

```ts
import { useQuery } from '@tanstack/react-query';
import { finngenApi } from '../api';
import type { FinnGenRun } from '@/types/api.generated';

const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);

export const useFinnGenRun = (id: string | null) =>
  useQuery<FinnGenRun>({
    queryKey: ['finngen', 'run', id],
    queryFn: () => finngenApi.getRun(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const run = q.state.data;
      if (!run || TERMINAL.has(run.status)) return false;
      const elapsed = run.started_at ? Date.now() - new Date(run.started_at).getTime() : 0;
      return elapsed < 30_000 ? 3_000 : 10_000;
    },
    staleTime: 0,
  });
```

Test the exponential backoff logic directly; assert `refetchInterval` returns the right values.

- [ ] **Step 4: `useFinnGenSyncRead.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { finngenApi } from '../api';

export function useFinnGenSyncRead<T>(path: string, params: Record<string, unknown>, opts?: { refresh?: boolean }) {
  return useQuery<T>({
    queryKey: ['finngen', 'sync', path, params, opts?.refresh],
    queryFn: () => finngenApi.syncRead<T>(path, params, opts?.refresh),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 5: `useCreateFinnGenRun.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { finngenApi } from '../api';
import { makeIdempotencyKey } from '../utils/idempotencyKey';

export const useCreateFinnGenRun = () => {
  const qc = useQueryClient();
  const key = useMemo(() => makeIdempotencyKey(), []);
  return useMutation({
    mutationFn: (body: { analysis_type: string; source_key: string; params: Record<string, unknown> }) =>
      finngenApi.createRun(body, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finngen', 'run'] }),
  });
};
```

- [ ] **Step 6: `RunStatusBadge.tsx`** — one-line badge component using design tokens (reuse existing Parthenon badge primitive if present).

- [ ] **Step 7: Vitest tests** — 4 files per §6.5. Minimum: poll cadence, `?refresh` flag behavior, idempotency key stability, badge renders one variant per status.

- [ ] **Step 8: tsc + vite build + eslint**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit && npx vite build && npx eslint src/features/_finngen-foundation'
```

- [ ] **Step 9: Commit**

```bash
git commit -am "feat(finngen): frontend foundation — hooks, types, idempotency, status badge"
```

### Task D3: Delete old workbench + investigation components

- [ ] **Step 1:** `git rm frontend/src/features/workbench/toolsets.ts frontend/src/features/investigation/components/phenotype/{CohortOperationPanel,CodeWASRunner}.tsx`

- [ ] **Step 2:** Edit `frontend/src/app/router.tsx` — remove `/workbench` route if it points to removed components. Remove any remaining imports.

- [ ] **Step 3:** Verify no references remain

```bash
grep -rn "CohortOperationPanel\|CodeWASRunner\|features/workbench/toolsets" frontend/src
```
Expected: zero.

- [ ] **Step 4:** tsc + vite build + commit

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit && npx vite build'
git commit -am "chore(finngen): delete obsolete workbench + investigation FinnGen components"
```

---

## Part E — Infra Polish

### Task E1: Nginx X-Accel-Redirect for artifact streaming

**Files:**
- Create: `docker/nginx/conf.d/finngen.conf` (or append to existing)

- [ ] **Step 1: Add internal location**

Inside the existing `server { ... }` block (in whichever Nginx config Parthenon uses), add:

```nginx
# FinnGen artifact streaming (served via Laravel X-Accel-Redirect)
location /_artifacts/ {
    internal;
    alias /opt/finngen-artifacts/;
    add_header Content-Security-Policy "default-src 'none'";
    add_header X-Content-Type-Options nosniff;
}
```

- [ ] **Step 2: Mount the volume into nginx container**

In `docker-compose.yml` under `nginx:` service `volumes:`, add:

```yaml
      - finngen-artifacts:/opt/finngen-artifacts:ro
```

- [ ] **Step 3: Restart nginx + test**

```bash
docker compose up -d nginx
# Create a probe file via darkstar
docker compose exec darkstar sh -c 'echo probe > /opt/finngen-artifacts/runs/probe/file.txt'
# Try external access — must 404 (internal-only)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8082/_artifacts/runs/probe/file.txt
# Expected: 404
```

- [ ] **Step 4: Smoke test via Laravel**

Use the signed URL from the artifact endpoint (covered by Pest feature test). Confirm 200 + correct content.

- [ ] **Step 5: Commit**

```bash
git add docker/nginx docker-compose.yml
git commit -m "feat(finngen): Nginx X-Accel-Redirect for artifact streaming"
```

### Task E2: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/finngen-tests.yml`

- [ ] **Step 1: Workflow**

```yaml
name: FinnGen Tests

on:
  pull_request:
    paths:
      - 'backend/app/Services/FinnGen/**'
      - 'backend/app/Http/Controllers/Api/V1/FinnGen/**'
      - 'backend/app/Http/Middleware/EnforceFinnGenIdempotency.php'
      - 'backend/app/Jobs/FinnGen/**'
      - 'backend/app/Models/App/FinnGen/**'
      - 'backend/app/Console/Commands/FinnGen/**'
      - 'backend/routes/api.php'
      - 'backend/database/migrations/**finngen**'
      - 'darkstar/api/finngen/**'
      - 'darkstar/install_deps.R'
      - 'frontend/src/features/_finngen-foundation/**'
      - '.github/workflows/finngen-tests.yml'
  push:
    branches: [main]
  schedule:
    - cron: '30 4 * * *'  # nightly 4:30 UTC

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: parthenon, POSTGRES_DB: parthenon }
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.4' }
      - run: cd backend && composer install --no-interaction
      - run: cd backend && php artisan migrate --force
      - run: cd backend && vendor/bin/pest tests/Unit/FinnGen tests/Feature/FinnGen --coverage --min=80

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd frontend && npm ci --legacy-peer-deps
      - run: cd frontend && npx vitest run src/features/_finngen-foundation
      - run: cd frontend && npx tsc --noEmit
      - run: cd frontend && npx vite build

  darkstar:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build darkstar
      - run: docker compose up -d postgres redis darkstar
      - run: sleep 60
      - run: docker compose exec -T darkstar Rscript -e 'testthat::test_dir("/app/tests/testthat")'

  e2e:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - run: docker compose up -d
      - run: sleep 90
      - run: cd e2e && npm ci && npx playwright install chromium
      - run: cd e2e && npx playwright test finngen
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/finngen-tests.yml
git commit -m "ci(finngen): fast + slow test lanes"
```

### Task E3: Playwright E2E

**Files:**
- `e2e/finngen/finngen-code-counts.spec.ts`
- `e2e/finngen/finngen-codewas-lifecycle.spec.ts`

- [ ] **Step 1:** Write the two specs per spec §6.6. Login, exercise hook via a dev-only harness page or direct API call, assert.

- [ ] **Step 2:** Run locally against the stack

```bash
cd e2e && npx playwright test finngen --headed
```

- [ ] **Step 3:** Commit

```bash
git add e2e/finngen
git commit -m "test(e2e): finngen code-counts + codewas lifecycle specs"
```

---

## Part F — Docs & Deploy

### Task F1: Runbook + devlog

**Files:**
- `docs/devlog/modules/finngen/sp1-runtime-foundation.md`
- `docs/devlog/modules/finngen/runbook.md`

- [ ] **Step 1: Devlog** — change summary, deviations from spec, known limitations, links to the spec + handoff docs.

- [ ] **Step 2: Runbook** — verbatim copy of spec §7.6 items expanded into actionable commands. Include exact `curl` / `psql` / `php artisan` examples.

- [ ] **Step 3: Commit**

```bash
git add docs/devlog/modules/finngen
git commit -m "docs(finngen): SP1 devlog + runbook"
```

### Task F2: Pre-merge verification sweep

- [ ] **Step 1: All the checks from spec §7.1**

```bash
# PHP
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pint --test && vendor/bin/phpstan analyse && vendor/bin/pest'

# Frontend
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit && npx vite build && npx vitest run && npx eslint .'

# Darkstar
docker compose exec -T darkstar Rscript -e 'testthat::test_dir("/app/tests/testthat")'

# Compose
docker compose config --quiet && echo OK

# Routes
docker compose exec php sh -c 'cd /var/www/html && php artisan route:list --path=finngen'

# Package probe
docker compose exec darkstar Rscript -e 'library(ROMOPAPI); library(HadesExtras); loadNamespace("CO2AnalysisModules"); cat("ok\n")'

# Final grep — zero results required
grep -rn "FinnGenWorkbenchService\|FinnGenCo2Service\|FinnGenRomopapiService\|finngen-runner" \
  backend/ frontend/ docker/ docker-compose.yml 2>/dev/null
```

- [ ] **Step 2: Code review**

Invoke `gsd-code-reviewer` or equivalent via the Agent tool on the full diff.

- [ ] **Step 3: HIGHSEC §2.3 checklist in PR description**

For each new route: auth:sanctum ✓, permission middleware ✓, ownership check ✓, rate limit ✓, no unauth clinical data ✓.

### Task F3: Deploy + post-deploy verification

Execute spec §7.2 exactly. After step 8:

```bash
curl -s https://parthenon.acumenus.net/api/v1/health | jq '.finngen'
# Expected: { ready: true, packages_loaded: ["ROMOPAPI","HadesExtras","CO2AnalysisModules"], load_errors: [] }

docker compose exec php sh -c 'cd /var/www/html && php artisan finngen:smoke-test'
# Expected: 2 pass
```

---

## Self-Review

**Spec coverage check (spec §-by-§):**

- §1 Scope: 12 items → Tasks A1-A3 (infra), B1-B8 (Darkstar), C1-C14 (Laravel), D1-D3 (frontend), E1-E3 (infra polish), F1-F3 (docs + deploy). Every item covered.
- §2 Component architecture: ✓ C1-C14 build all services + models + commands listed; A3 removes `finngen-runner`.
- §3 Data flow: sync (C12), async (C11 + C12), artifacts (C7 + C12 + E1), cancel (C11), GC (C13), observability (C11 job + existing Loki hookup — relies on existing Parthenon audit log wiring, noted to engineer as not net-new).
- §4 API contracts: full types in C2, routes in C12, schema in C1. OpenAPI snapshot in C13 + D1.
- §5 Error handling: taxonomy (C5 + C6 + C9), idempotency (C9), R classification (B2), cancel ceiling (B7 + C11), reconciler (C13), artifact sweeper (C13), progress rotation (B2).
- §6 Testing: every Pest file named in §6.2/6.3 is created under C4, C5, C6, C7, C8, C9, C10, C11, C12, C13; testthat files under B2-B7; Vitest under D2; Playwright under E3; snapshots under B8 + C13.
- §7 Migration + rollout: A1-A3 prep, F2 verification, F3 deploy.

**Placeholder scan:** No `TBD`, `TODO`, "implement later" lines. All code samples are runnable as-is (some are abbreviated with clear "follow the pattern" guidance for repetitive files — e.g. the five other `execute_*` endpoints follow `finngen_co2_codewas_execute` exactly).

**Type consistency:**
- `FinnGenSourceContextBuilder::ROLE_RO` / `ROLE_RW` constants used consistently in C4 + C11.
- `FinnGenClient` method names `getSync`, `postAsyncDispatch`, `pollJob`, `cancelJob`, `health` used consistently in C5 + C11 + C13.
- `Run::STATUS_*` constants used consistently in C2 + C10 + C11 + C13.
- R function names `run_with_classification`, `write_progress`, `build_cohort_table_handler`, `build_cdm_handler`, `finngen_error`, `classify_simple_error` used consistently across B2 + B3 + B4 + B5 + B6.
- Artisan command names match spec §7.6 runbook.

---

## Plan complete.

Saved to `docs/superpowers/plans/2026-04-12-finngen-runtime-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Each task's check-boxed steps become the subagent's prompt; green tests + passing verification gate each commit.

**2. Inline Execution** — Execute tasks in this session using executing-plans, with checkpoints at task boundaries for your review.

Which approach?
