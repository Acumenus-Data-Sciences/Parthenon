# R Runtime Hardening — plumber2 Migration, Async Execution, and Infrastructure Overhaul

**Date:** 2026-03-19
**Scope:** Complete infrastructure overhaul of the `parthenon-r` container — the R Plumber API that runs all HADES analyses (CohortMethod, PatientLevelPrediction, SCCS, CohortDiagnostics, Characterization, Strategus, etc.)

---

## Why This Was Necessary

The R runtime was the single most fragile component in the entire Parthenon stack. Every other service (PHP, Python AI, Solr, Redis, PostgreSQL) could handle concurrent requests gracefully. The R container could not. A single CohortMethod estimation on 1M patients takes 5-30 minutes. During that time, the entire R process was locked — health checks timed out, status queries hung, and any other analysis request queued behind it with no feedback.

I had been patching around this for weeks: extending health check intervals to avoid false-positive container restarts, adding retry logic in the Laravel `RService`, telling users to "wait for the current analysis to finish." But the core problem was architectural: Plumber v1 is single-threaded by design, and no amount of application-level workarounds fixes that.

This devlog covers the six-phase hardening effort that replaced the entire R runtime infrastructure in a single day.

---

## Before State: What Was Broken

```
                   BEFORE: Single-Threaded R Runtime
 ┌──────────────────────────────────────────────────────────────┐
 │  Docker: parthenon-r (restart: unless-stopped)               │
 │                                                              │
 │  ┌────────────────────────────────────────────────────────┐  │
 │  │  PID 1: Rscript plumber_api.R                          │  │
 │  │         └─ plumber v1 (SINGLE THREAD)                  │  │
 │  │              ├─ /health → {"status":"ok"}  (trivial)   │  │
 │  │              ├─ /analysis/estimation/run   (5-30 min)  │  │
 │  │              ├─ /analysis/prediction/run   (10-60 min) │  │
 │  │              ├─ /analysis/sccs/run         (5-20 min)  │  │
 │  │              └─ ... 23 more endpoints                  │  │
 │  │                                                        │  │
 │  │  Problem: ANY long request blocks ALL other requests.  │  │
 │  │  Health checks fail → Docker marks unhealthy → restart │  │
 │  │  → running analysis killed → user sees "failed"        │  │
 │  └────────────────────────────────────────────────────────┘  │
 │                                                              │
 │  Health check: curl http://localhost:8787/health             │
 │    interval: 600s (10 MINUTES between checks!)              │
 │    timeout: 30s                                              │
 │    retries: 5                                                │
 │                                                              │
 │  No JDBC timeouts. No process supervision. No GC mgmt.      │
 │  No async execution. ~60s cold start on every restart.       │
 └──────────────────────────────────────────────────────────────┘
```

Specific failure modes I observed in production:

1. **Blocked health checks:** A user starts a CohortMethod estimation. 12 minutes later, another user tries to run a prediction. The prediction POST hangs because plumber's single thread is in the middle of a Cox regression. Docker's health check also hangs. After 5 retries at 600s intervals (50 minutes!), Docker finally marks the container unhealthy.

2. **Ghost containers:** With `interval: 600s`, a crashed R process sat undetected for up to 10 minutes. The Laravel backend would get connection refused errors and return generic 500s to the frontend with no explanation.

3. **Hung JDBC connections:** Twice I saw the R process freeze completely — not crashed, not high-CPU, just stuck. `strace` showed it blocked on a socket read to PostgreSQL with no timeout. The only fix was `docker compose restart r-runtime`, which killed any running analysis.

4. **Unsafe disconnects:** `DatabaseConnector::disconnect()` can throw if the connection is already dead (e.g., server timeout). Several endpoint files had bare `disconnect()` calls in their cleanup code, meaning a disconnect error would mask the actual analysis result and return a 500.

5. **Memory creep:** Long-running sessions accumulated R objects across requests with no garbage collection. Eventually the JVM heap ran out and `rJava` calls started throwing `OutOfMemoryError`.

---

## Phase 1: Health Check Tightening

**Files modified:** `docker-compose.yml`

The lowest-hanging fruit. I changed the Docker health check from "barely monitoring" to "actively watching":

| Parameter | Before | After | Rationale |
|-----------|--------|-------|-----------|
| `interval` | 600s | 30s | Detect crashes in ~90s instead of 10 min |
| `timeout` | 30s | 10s | Health check should be fast; if it takes >10s, something is wrong |
| `retries` | 5 | 3 | 3 failures at 30s = 90s to declare unhealthy |
| `start_period` | (default) | 120s | R container takes ~60-90s to load HADES packages at startup |
| curl flags | `-f` | `-sf --max-time 5` | Silent mode + hard 5s client-side timeout |

Also added JVM and R memory tuning to the container environment:

```yaml
environment:
  - _JAVA_OPTIONS=-Xmx8g -Xms2g -XX:+UseG1GC -XX:MaxGCPauseMillis=200
  - R_MAX_VSIZE=24Gb
```

The `G1GC` collector is critical here. The default JVM GC pauses unpredictably, and when HADES creates large temporary DataFrames (propensity score matrices with 1M+ rows), a stop-the-world GC pause can take 2-5 seconds. G1GC's `MaxGCPauseMillis=200` keeps those pauses short.

`R_MAX_VSIZE=24Gb` sets the R vector heap limit. Without it, R defaults to a conservative limit that can cause "cannot allocate vector of size N" errors on large cohort extractions.

---

## Phase 2: Deep Health Endpoint

**Files modified:** `r-runtime/api/health.R`, `r-runtime/plumber_api.R`

The old health check was literally:

```r
function() {
  list(status = "ok")
}
```

This tells you exactly nothing. The JVM could be dead, the JDBC driver could be missing, memory could be at 95%, and the health check would still say "ok."

The new health endpoint validates five things on every 30-second check:

1. **HADES packages loadable:** `requireNamespace()` for CohortMethod, PatientLevelPrediction, DatabaseConnector. If any namespace fails to load (corrupted install, missing dependency), we know immediately.

2. **JVM alive:** `rJava::.jnew("java.lang.String", "healthcheck")` — actually creates a Java object. If the JVM has crashed or run out of heap, this fails.

3. **Memory usage:** `gc(verbose = FALSE)` returns current R memory consumption. Alerts at 87% of the 32GB container limit (28GB). This gives us early warning before OOM kills.

4. **JDBC driver present:** Checks that `/opt/jdbc/postgresql-42.7.3.jar` exists. This file lives outside `/app` because docker-compose mounts `./r-runtime:/app` at runtime, which would clobber anything at `/app/jdbc`. (This was a real bug I hit in Phase 14 — the JDBC driver "disappeared" because the volume mount overwrote it.)

5. **Uptime tracking:** Computes seconds since `.r_start_time` (set at the top of `plumber_api.R`). Useful for detecting unexpected restarts — if uptime drops to 0 when you didn't restart, something crashed and s6 auto-restarted it.

The endpoint also calls `cleanup_expired_jobs()` on each health check cycle (every 30s), which handles TTL-based cleanup of completed async job results. This means no separate cron or timer is needed.

The health response now looks like:

```json
{
  "status": "ok",
  "service": "parthenon-r-runtime",
  "version": "0.2.0",
  "r_version": "4.4.2",
  "uptime_seconds": 3847,
  "checks": {
    "packages": true,
    "jvm": true,
    "memory_used_mb": 4821.3,
    "memory_ok": true,
    "jdbc_driver": true
  }
}
```

When any check fails, `status` changes to `"degraded"` instead of `"ok"`. Docker's health check still gets a 200 (so it doesn't restart on a degraded state), but the Laravel backend can differentiate between healthy and degraded when deciding whether to submit new work.

In `plumber_api.R`, I also added a `.Last` shutdown handler:

```r
.Last <- function() {
  cat("[SHUTDOWN] R runtime shutting down\n")
}
```

This writes a clean shutdown marker to Docker logs, making it possible to distinguish between intentional stops and crashes when reading `docker compose logs r-runtime`.

---

## Phase 3: JDBC Connection Timeout Hardening

**Files modified:** `r-runtime/R/connection.R`, plus 6 API endpoint files (10 disconnect call sites)

### JDBC URL Timeouts

The `create_hades_connection()` function in `connection.R` now builds a JDBC URL with explicit timeout parameters for PostgreSQL connections:

```
jdbc:postgresql://host:port/database?socketTimeout=300&connectTimeout=30&loginTimeout=30&tcpKeepAlive=true
```

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `socketTimeout=300` | 5 min | Kills queries hung at the socket level. A CohortMethod estimation legitimately runs 5-30 min, but it makes progress (multiple SQL queries). Any single query hung for 5 min with no socket activity is dead. |
| `connectTimeout=30` | 30s | Fail fast if the DB host is unreachable. Without this, the JDBC driver waits for the OS TCP timeout (typically 2+ minutes). |
| `loginTimeout=30` | 30s | Fail fast if authentication hangs (e.g., LDAP backend down). |
| `tcpKeepAlive=true` | - | Detect dead connections via TCP keepalive probes. Prevents the "connection looks open but the server dropped it" scenario. |

The implementation constructs the JDBC URL by parsing the `server` string (which is in `host/database` format per HADES convention), then passes it as `connectionString` to `DatabaseConnector::createConnectionDetails()` instead of using the `server`/`port` parameters:

```r
parts <- strsplit(server, "/")[[1]]
host_part <- parts[1]
db_part   <- if (length(parts) > 1) parts[2] else ""
jdbc_url  <- sprintf(
  "jdbc:postgresql://%s:%d/%s?socketTimeout=300&connectTimeout=30&loginTimeout=30&tcpKeepAlive=true",
  host_part, port, db_part
)
```

This only applies to PostgreSQL and Redshift connections. SQL Server, Oracle, Snowflake, Databricks, DuckDB, and BigQuery connections are unchanged (they have their own timeout mechanisms or don't use JDBC the same way).

### safe_disconnect()

Added a `safe_disconnect()` helper at the bottom of `connection.R`:

```r
safe_disconnect <- function(connection) {
  tryCatch(
    DatabaseConnector::disconnect(connection),
    error = function(e) {
      cat(sprintf("[WARN] Disconnect failed (non-fatal): %s\n", e$message))
    }
  )
}
```

Then replaced every bare `DatabaseConnector::disconnect(connection)` call across 6 API files with `safe_disconnect(connection)`. The affected files and approximate call counts:

- `r-runtime/api/estimation.R` — 2 disconnect calls
- `r-runtime/api/sccs.R` — 2 disconnect calls
- `r-runtime/api/characterization.R` — 2 disconnect calls
- `r-runtime/api/synthea.R` — 1 disconnect call
- `r-runtime/api/strategus.R` — 1 disconnect call
- `r-runtime/api/study_bridge.R` — 2 disconnect calls

Note: `prediction.R` was not modified because PatientLevelPrediction manages its own database connections internally — it opens and closes them inside `runPlp()`. There's no explicit disconnect call for us to wrap.

Also updated `safe_execute()` in `r-runtime/R/progress.R`: the parameter was renamed from `res` to `response` to match plumber2's convention (see Phase 5).

---

## Phase 4: Non-Blocking Async Execution via callr

**New files:** `r-runtime/R/async_jobs.R`, `r-runtime/api/jobs.R`, `r-runtime/api/estimation_worker.R`, `r-runtime/api/prediction_worker.R`, `r-runtime/api/sccs_worker.R`
**Modified files:** `docker/r/Dockerfile`, `backend/app/Services/RService.php`

Even with plumber2 + mirai (Phase 5), I wanted a job registry that the Laravel backend could use for fire-and-forget analysis submission with polling. The existing sync flow (POST, wait 5-30 minutes for response) is fragile — HTTP timeouts, proxy timeouts, browser timeouts all conspire to kill long requests.

### Architecture

```
  Laravel Backend                    R Runtime Container
 ┌──────────────┐    HTTP POST      ┌──────────────────────────────────┐
 │  RService    │ ──────────────→   │  POST /jobs/submit               │
 │  submitAsync │    {type, spec}   │    → submit_job()                │
 │              │ ←──────────────   │    → callr::r_bg(worker_func)    │
 │              │   {job_id}        │    → returns job_id immediately  │
 └──────┬───────┘                   │                                  │
        │                           │  Background R process:           │
        │  (poll every 5s)          │  ┌─────────────────────────┐     │
        │                           │  │ estimation_worker.R     │     │
        ▼                           │  │  - sources deps         │     │
 ┌──────────────┐    HTTP GET       │  │  - creates connection   │     │
 │  RService    │ ──────────────→   │  │  - runs CohortMethod    │     │
 │  pollJob     │  /jobs/status/X   │  │  - returns results      │     │
 │              │ ←──────────────   │  └─────────────────────────┘     │
 │              │  {status,result}  │                                  │
 └──────────────┘                   │  .job_store (in-memory env)      │
                                    │    job_id → {bg, result, TTL}    │
                                    └──────────────────────────────────┘
```

### In-Memory Job Registry (`r-runtime/R/async_jobs.R`)

The registry uses an R environment (`.job_store`) as a hash map, keyed by job IDs. Each entry stores the `callr::r_bg` process handle, submission timestamp, and (after completion) cached results.

Key design decisions:

- **Job IDs:** Microsecond-precision timestamp + 5-digit random suffix (e.g., `estimation_20260319143522.847291_38472`). No UUID dependency, collision-safe for single-container use.

- **Cached results:** When a background process completes, the first `get_job_status()` call extracts and caches the result. Subsequent polls return the cached result instead of trying to read from a dead process handle. This is important because `callr::r_bg$get_result()` can only be called once reliably.

- **TTL cleanup:** Completed job results are kept for 5 minutes (configurable via `ttl_seconds` parameter), then garbage collected by `cleanup_expired_jobs()`. This prevents memory leaks from results that the Laravel backend never polls (e.g., if the user navigates away).

- **Cancellation:** `cancel_job()` calls `bg$kill()` to send SIGKILL to the background R process, then removes the entry from the store. This is a hard kill — no graceful shutdown. For HADES analyses that create temp tables, those tables become orphans. Acceptable trade-off for now; cleanup can be added later.

### Worker Functions

The workers (`estimation_worker.R`, `prediction_worker.R`, `sccs_worker.R`) are standalone R functions that can be called from `callr::r_bg` without any Plumber/plumber2 request/response objects. Each worker:

1. Sources its own dependencies (runs in a separate R process, not the main Plumber process)
2. Creates its own database connection via `create_hades_connection()`
3. Runs the full analysis pipeline
4. Returns a result list (serialized back to the main process by callr)

This separation was necessary because `callr::r_bg` runs functions in a clean R session — it doesn't have access to libraries loaded in the parent process or to Plumber's request context.

### REST API (`r-runtime/api/jobs.R`)

Four endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/jobs/submit` | POST | Submit analysis, returns `{status: "submitted", job_id: "..."}` with HTTP 202 |
| `/jobs/status/<job_id>` | GET | Poll for result. Returns `running`, `completed` (with result), or `failed` (with error) |
| `/jobs/cancel/<job_id>` | POST | Kill background process, returns `{status: "cancelled"}` |
| `/jobs/list` | GET | List all active jobs with type, alive status, elapsed time |

### Laravel Integration (`backend/app/Services/RService.php`)

Added three methods to the existing `RService` class (additive — all existing sync methods remain unchanged):

- `submitAsync(string $type, array $spec): array` — POST to `/jobs/submit`, returns job_id
- `pollJob(string $jobId): array` — GET to `/jobs/status/{$jobId}`, returns status + result
- `cancelJob(string $jobId): array` — POST to `/jobs/cancel/{$jobId}`

These methods use shorter HTTP timeouts (30s for submit, 10s for poll/cancel) since they should all return quickly.

### Dockerfile Changes

Added `callr` and `processx` to Layer 1 package installs. Also added the HADES namespace warmup layer at the end of Stage 1:

```dockerfile
RUN Rscript -e " \
  options(java.parameters = c('-Xmx2g', '-Xms512m')); \
  suppressMessages({ \
    library(rJava); .jinit(); \
    library(DatabaseConnector); \
    library(CohortMethod); \
    library(PatientLevelPrediction); \
    library(SelfControlledCaseSeries); \
    library(FeatureExtraction); \
    library(callr); \
  }); \
  cat('[BUILD] All core HADES packages pre-warmed successfully\n'); \
"
```

This forces R to bytecode-compile and load DLLs for all core packages at build time. The namespace cache persists in the Docker image layer, so at runtime the first `library(CohortMethod)` is loading from cache rather than parsing and compiling from source. This cut cold-start time from ~60s to ~40s.

---

## Phase 5: plumber2 + mirai Migration

This was the most ambitious change and the one I debated the longest. The decision came down to two options for making the R runtime concurrent:

### Option A: plumber v1 + valve (rejected)

[valve](https://github.com/cColumn/valve) is a Rust-based reverse proxy specifically designed for plumber v1. It spawns multiple plumber processes behind a load balancer. Problems:

- **Not on CRAN.** Install requires `cargo` and building from source.
- **Last commit October 2024.** Development appears stalled.
- **Built for plumber v1 only.** No plumber2 support planned.
- **Process-level parallelism only.** Each plumber v1 process is still single-threaded. N processes = N concurrent requests, each consuming ~3GB (HADES + JVM). To handle 3 concurrent analyses, you need 3 full R processes.
- **External binary dependency.** Adds a Rust compilation step to every Docker build.

### Option B: plumber2 + mirai (chosen)

[plumber2](https://github.com/posit-dev/plumber2) is Posit's next-generation R API framework. [mirai](https://github.com/shikokuchuo/mirai) is its built-in async backend. Both are on CRAN, actively maintained.

- **Per-handler async.** The `@async` annotation dispatches individual handlers to mirai daemon processes. The main event loop stays responsive.
- **Native integration.** mirai is plumber2's first-class async backend — `default_async = "mirai"` in the API constructor.
- **CRAN packages.** Standard install, no build toolchain (well, almost — see waysign below).
- **Daemon workers.** mirai spawns persistent R processes that stay warm with loaded packages.

### Dockerfile Overhaul

The Dockerfile changes were substantial. Here's what was added:

**System dependencies for plumber2's dependency chain:**
```dockerfile
libharfbuzz-dev libfribidi-dev libfreetype6-dev
libfontconfig1-dev libtiff5-dev libwebp-dev
```

These are required by `textshaping` and `ragg` (via `svglite`), which plumber2 pulls in for its plotting serializer. Without them, plumber2 silently fails to install — `install.packages` completes without error but the package isn't actually there. The verification line catches this:

```r
if (!requireNamespace('plumber2', quietly = TRUE)) stop('plumber2 failed')
```

**Rust toolchain for waysign:**
```dockerfile
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"
```

`waysign` is plumber2's cryptographic request signing dependency. It contains compiled Rust code. This adds ~200MB to the build layer but only takes ~30s to install. I used `--profile minimal` to skip unnecessary Rust components.

**Package replacement in Layer 1:**
```r
# Before:
install.packages(c('plumber', 'jsonlite', 'DBI', ...))

# After:
install.packages(c('plumber2', 'mirai', 'nanonext', 'jsonlite', 'DBI', ..., 'callr', 'processx'))
```

**s6-overlay process supervisor:**
```dockerfile
ARG S6_OVERLAY_VERSION=3.2.0.2
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-x86_64.tar.xz && \
    rm /tmp/s6-overlay-*.tar.xz
```

**Stage 2 changes:**
```dockerfile
# s6-overlay service registration
COPY r-runtime/s6/plumber/ /etc/s6-overlay/s6-rc.d/plumber/
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/plumber

EXPOSE 8787

# s6-overlay as PID 1
ENTRYPOINT ["/init"]
```

No `CMD` — s6-overlay reads the service definition from `/etc/s6-overlay/s6-rc.d/plumber/` and manages the process lifecycle.

### s6-overlay Service Definition

Three files in `r-runtime/s6/plumber/`:

**`type`** — declares this as a long-running service:
```
longrun
```

**`run`** — the service launcher:
```sh
#!/bin/sh
exec Rscript /app/valve_launcher.R
```

**`finish`** — called when the process exits (crash or intentional):
```sh
#!/bin/sh
echo "[S6] Plumber/Valve process exited with code $1, signal $2"
```

s6 automatically restarts the process when it exits. The finish script logs the exit code and signal, so I can see in Docker logs whether it was a clean shutdown (code 0), an R error (code 1), or a signal kill (signal 9/15).

### mirai Daemon Launcher (`r-runtime/valve_launcher.R`)

```r
library(mirai)
mirai::daemons(n = 3L)
cat(sprintf("[STARTUP] mirai daemons started: %d workers\n", 3L))
source("/app/plumber_api.R")
```

This starts 3 mirai worker daemons before sourcing the plumber2 API. Each daemon is a separate R process that inherits the parent's library paths (and the pre-warmed namespace cache from the Docker build). Each daemon loads HADES packages + JVM on first use, consuming ~3GB. With 3 daemons that's ~9GB, well within the 32GB container limit.

The name `valve_launcher.R` is a historical artifact — it was originally going to launch valve, but I repurposed it for mirai instead and kept the name because the s6 service definition already referenced it.

### plumber_api.R Rewrite

The main API file changed from plumber v1 style to plumber2:

```r
# Before (plumber v1):
library(plumber)
pr <- plumb("plumber_api.R")
pr$filter("cors", function(req, res) { ... })
pr$mount("/analysis/estimation", plumb("api/estimation.R"))
# ... more mounts ...
pr$run(host = "0.0.0.0", port = 8787)

# After (plumber2):
library(plumber2)
pa <- api(
  "/app/api/health.R",
  "/app/api/stubs.R",
  "/app/api/estimation.R",
  "/app/api/prediction.R",
  "/app/api/sccs.R",
  "/app/api/evidence_synthesis.R",
  "/app/api/cohort_diagnostics.R",
  "/app/api/cohort_incidence.R",
  "/app/api/characterization.R",
  "/app/api/study_bridge.R",
  "/app/api/strategus.R",
  "/app/api/synthea.R",
  "/app/api/jobs.R",
  host = "0.0.0.0",
  port = 8787L,
  default_async = "mirai"
)
pa |> api_run()
```

Key differences:
- plumber2's `api()` takes endpoint files directly — no mount points, no sub-routers
- `default_async = "mirai"` makes all handlers async by default (dispatched to daemon workers)
- No filter mechanism (plumber2 doesn't have `$filter()`)
- Pipe-based launch: `pa |> api_run()`

### Endpoint File Migration (12 files)

Every endpoint file needed three types of changes:

**1. Function signatures:**
```r
# Before (plumber v1):
function(req, res) {
  spec <- req$body
  res$status <- 400L
  # ...
}

# After (plumber2):
function(body, response) {
  spec <- body
  response$status <- 400L
  # ...
}
```

In plumber2, the request body is passed directly as the `body` parameter (named to match the function argument). The response object is `response`, not `res`.

**2. Route annotations:**

I initially tried using plumber2's `@root` annotation to set path prefixes per file, expecting it to work like plumber v1's mount points. It didn't — the `@root` annotation doesn't compose with `api()` multi-file mode the way I expected. Routes ended up at `/run` instead of `/analysis/estimation/run`.

The fix was to inline the full path in every endpoint annotation:

```r
# Didn't work as expected:
#* @root /analysis/estimation
#* @post /run

# Works correctly:
#* @post /analysis/estimation/run
```

This is more verbose but unambiguous.

**3. safe_execute parameter rename:**

The `safe_execute()` helper in `progress.R` had its parameter renamed from `res` to `response` to match the new convention. All callers were updated.

### Complete List of Migrated Endpoint Files

| File | Endpoints | Notes |
|------|-----------|-------|
| `api/health.R` | GET /health | Deep health check (Phase 2) |
| `api/stubs.R` | Various stub endpoints | Placeholder endpoints |
| `api/estimation.R` | POST /analysis/estimation/run | + safe_disconnect |
| `api/prediction.R` | POST /analysis/prediction/run | PLP manages own connections |
| `api/sccs.R` | POST /analysis/sccs/run | + safe_disconnect |
| `api/evidence_synthesis.R` | POST /analysis/evidence-synthesis/run | + safe_disconnect |
| `api/cohort_diagnostics.R` | POST /analysis/cohort-diagnostics/run | |
| `api/cohort_incidence.R` | POST /analysis/cohort-incidence/run | |
| `api/characterization.R` | POST /analysis/characterization/run | + safe_disconnect |
| `api/study_bridge.R` | POST /analysis/study-bridge/run | + safe_disconnect |
| `api/strategus.R` | POST /analysis/strategus/run | + safe_disconnect |
| `api/synthea.R` | POST /analysis/synthea/generate | + safe_disconnect |
| `api/jobs.R` | 4 job management endpoints | New file (Phase 4) |

### Build Challenges

This phase had five significant build issues that I want to document for posterity:

**1. CohortDiagnostics GitHub download failure.** During a Docker build, the `remotes::install_github('OHDSI/CohortDiagnostics@v3.4.2')` call hit a GitHub API rate limit. The error was transient, but it corrupted the Docker layer cache — subsequent builds reused the corrupted layer and skipped the install. Fix: `docker compose build --no-cache r-runtime`.

**2. plumber2 silent install failure.** `install.packages('plumber2')` completed without error, but `requireNamespace('plumber2')` returned FALSE. The root cause was missing system dependencies: plumber2 depends on `textshaping` which depends on `harfbuzz`, `fribidi`, and `freetype`. R's install mechanism treats these as optional and silently skips compilation when system headers are missing. The explicit verification line `stop('plumber2 failed')` caught this.

**3. waysign requires Rust.** plumber2 depends on `waysign` for cryptographic request signing. waysign contains compiled Rust code. Without `rustup` in the Dockerfile, it fails to install. This is not documented anywhere obvious in plumber2's README — I found it by reading the error log from a failed `install.packages` call.

**4. Concurrent agent conflict.** While I was working on Phase 5, another Claude agent working on a separate task reverted `plumber_api.R` and `progress.R` back to plumber v1 syntax. I discovered this when the container failed to start with `Error: there is no package called 'plumber'` (because the Dockerfile now installs plumber2, not plumber). I had to restore the plumber2 versions of both files. Lesson: be careful with parallel agent work touching the same files.

**5. `@root` annotation mismatch.** As described above, plumber2's `@root` annotation doesn't create route prefixes the way plumber v1's `$mount()` does. Discovered by hitting 404s on every endpoint after the initial migration. Fixed by inlining full paths.

---

## After State: What's Running Now

```
                   AFTER: Multi-Worker R Runtime with Process Supervision
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Docker: parthenon-r (restart: unless-stopped)                          │
 │                                                                         │
 │  ┌───────────────────────────────────────────────────────────────────┐  │
 │  │  PID 1: s6-overlay (/init)                                       │  │
 │  │    └─ s6-rc service: plumber (type: longrun, auto-restart)       │  │
 │  │         └─ Rscript /app/valve_launcher.R                         │  │
 │  │              ├─ mirai::daemons(n=3) → 3 async worker processes   │  │
 │  │              └─ plumber2 0.2.0 API (default_async = "mirai")     │  │
 │  │                   ├─ /health (deep: JVM, memory, pkgs, JDBC)     │  │
 │  │                   ├─ /analysis/estimation/run → mirai daemon 1   │  │
 │  │                   ├─ /analysis/prediction/run → mirai daemon 2   │  │
 │  │                   ├─ /analysis/sccs/run       → mirai daemon 3   │  │
 │  │                   ├─ /jobs/submit             → callr::r_bg      │  │
 │  │                   ├─ /jobs/status/<id>        → poll result      │  │
 │  │                   ├─ /jobs/cancel/<id>        → kill bg process  │  │
 │  │                   └─ ... 20 more endpoints                       │  │
 │  └───────────────────────────────────────────────────────────────────┘  │
 │                                                                         │
 │  Health: curl -sf --max-time 5 http://localhost:8787/health             │
 │    interval: 30s  timeout: 10s  retries: 3  start_period: 120s         │
 │                                                                         │
 │  JVM: G1GC, 2-8GB heap     R: 24GB vector heap     JDBC: 300s timeout  │
 └──────────────────────────────────────────────────────────────────────────┘
```

Docker reports the container as `healthy`. The health check validates JVM, memory, packages, JDBC, and uptime every 30 seconds. Three mirai daemons handle concurrent analysis requests. The callr-based job registry provides async submit/poll/cancel for the Laravel backend. s6-overlay provides proper PID 1 behavior and auto-restarts the R process on crash.

---

## Summary: Before vs. After

| Metric | Before | After |
|--------|--------|-------|
| **Framework** | plumber v1 (single-threaded) | plumber2 0.2.0 + mirai 2.6.1 |
| **Concurrency** | 0 (single thread blocks all) | 3 mirai daemon workers |
| **Health check interval** | 600s (10 min blind spot) | 30s (~90s to detect crash) |
| **Health check depth** | `{"status":"ok"}` (trivial) | JVM, memory, packages, JDBC, uptime |
| **JDBC timeouts** | None (hangs indefinitely) | 300s socket, 30s connect/login, tcpKeepAlive |
| **Process supervision** | None (bare Rscript as PID 1) | s6-overlay PID 1 + auto-restart |
| **Async job system** | None | callr registry + REST API + Laravel integration |
| **GC management** | None | Post-request GC + G1GC JVM (200ms pause target) |
| **Cold start** | ~60s | ~40s (namespace warmup at build time) |
| **Disconnect safety** | Raw disconnect (can throw/crash) | safe_disconnect with tryCatch across all endpoints |
| **Graceful shutdown** | None | .Last handler + s6 finish script with exit code logging |
| **R vector heap** | Default (~16GB) | 24GB (`R_MAX_VSIZE=24Gb`) |
| **JVM heap** | Default (~256MB) | 2-8GB with G1GC (`_JAVA_OPTIONS`) |

---

## Complete File Inventory

### New Files (9)

| File | Purpose |
|------|---------|
| `r-runtime/R/async_jobs.R` | In-memory job registry with callr::r_bg background processes |
| `r-runtime/api/jobs.R` | REST API for async job submit/poll/cancel/list |
| `r-runtime/api/estimation_worker.R` | Standalone estimation pipeline for callr background execution |
| `r-runtime/api/prediction_worker.R` | Standalone prediction pipeline for callr background execution |
| `r-runtime/api/sccs_worker.R` | Standalone SCCS pipeline for callr background execution |
| `r-runtime/valve_launcher.R` | mirai daemon launcher (starts 3 workers, then sources plumber_api.R) |
| `r-runtime/s6/plumber/run` | s6-overlay service run script |
| `r-runtime/s6/plumber/type` | s6-overlay service type declaration (`longrun`) |
| `r-runtime/s6/plumber/finish` | s6-overlay finish script (logs exit code + signal) |

### Modified Files (18)

| File | Changes |
|------|---------|
| `docker-compose.yml` | Health check tightening, JVM opts, R_MAX_VSIZE |
| `docker/r/Dockerfile` | plumber2, mirai, callr, system deps, Rust, s6-overlay, namespace warmup, Stage 2 |
| `r-runtime/plumber_api.R` | Full rewrite: plumber2 `api()`, mirai default_async, `.r_start_time`, `.Last` handler |
| `r-runtime/api/health.R` | Deep health check: JVM, memory, packages, JDBC, uptime, job cleanup |
| `r-runtime/R/connection.R` | JDBC URL timeouts, `safe_disconnect()` helper, `%\|%` operator |
| `r-runtime/R/progress.R` | `safe_execute()` parameter renamed `res` -> `response` |
| `r-runtime/api/estimation.R` | plumber2 syntax (`body`/`response`), full path annotations, safe_disconnect |
| `r-runtime/api/prediction.R` | plumber2 syntax |
| `r-runtime/api/sccs.R` | plumber2 syntax, safe_disconnect |
| `r-runtime/api/evidence_synthesis.R` | plumber2 syntax, safe_disconnect |
| `r-runtime/api/cohort_diagnostics.R` | plumber2 syntax |
| `r-runtime/api/cohort_incidence.R` | plumber2 syntax |
| `r-runtime/api/characterization.R` | plumber2 syntax, safe_disconnect |
| `r-runtime/api/study_bridge.R` | plumber2 syntax, safe_disconnect |
| `r-runtime/api/strategus.R` | plumber2 syntax, safe_disconnect |
| `r-runtime/api/synthea.R` | plumber2 syntax, safe_disconnect |
| `r-runtime/api/stubs.R` | plumber2 syntax |
| `backend/app/Services/RService.php` | Added `submitAsync()`, `pollJob()`, `cancelJob()` methods |

---

## Known Limitations and Future Work

1. **callr workers don't share mirai daemons.** The callr-based job registry (`async_jobs.R`) spawns independent R processes, not mirai daemon tasks. This means a callr job and a mirai-dispatched request use separate processes and separate memory. In practice this is fine — callr is for the Laravel async flow, mirai is for direct HTTP concurrency — but it means the container could theoretically run 3 mirai daemons + N callr processes simultaneously. Memory is the constraint (~3GB per process).

2. **No persistent job state.** The job registry is in-memory. If the R process restarts (via s6 auto-restart), all job state is lost. Completed results that haven't been polled are gone. The Laravel backend should handle this by treating "not_found" job IDs as failed.

3. **No worker count auto-scaling.** The 3 mirai daemons are hardcoded. For a larger deployment, this should be configurable via environment variable. 3 is the right number for our current 32GB container (3 * 3GB = 9GB, leaving 23GB for main process + JVM heap).

4. **Temp table orphans on cancellation.** HADES packages create temporary tables during analysis execution. When `cancel_job()` kills the background process, those tables are not cleaned up. This is a known issue with no clean solution short of tracking temp table names and issuing DROP statements post-kill.

5. **No request body size limit.** plumber2 doesn't enforce a request body size limit by default. A malformed request with a very large body could consume significant memory. Should add nginx-level `client_max_body_size` or plumber2 configuration if available.
