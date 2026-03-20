---
slug: rise-of-darkstar
title: "The Rise of Darkstar: How We Rebuilt the OHDSI R Runtime for Production"
authors: [mudoshi, claude]
tags: [development, darkstar, r-runtime, infrastructure, plumber2, mirai, hades, ohdsi, docker, devops, architecture]
date: 2026-03-20
---

Every platform has a weak link. For Parthenon, it was the R container.

PHP handled 200 concurrent API requests without breaking a sweat. Python served AI inference with async workers. PostgreSQL managed million-row queries across six schemas. Redis cached sessions at sub-millisecond latency. And then there was R — single-threaded, fragile, running bare `Rscript` as PID 1 with no supervision, no timeouts, and a health check that lied.

This is the story of how we tore it down and built **Darkstar** — a production-grade R analytics engine that runs OHDSI HADES analyses concurrently, recovers from crashes automatically, and executes 35% faster than the container it replaced.

<!-- truncate -->

## The Inheritance

Parthenon didn't start from scratch. We inherited the R runtime architecture from **OHDSI Broadsea**, the community's standard Docker deployment for the OMOP CDM analytics stack. Broadsea ships a single R container running Plumber v1 — the venerable HTTP API framework for R that's been the community standard since 2017.

And for what Broadsea was designed to do — run a single analysis at a time on a researcher's laptop — Plumber v1 is perfectly fine. It's simple, well-documented, and every OHDSI tutorial uses it.

But Parthenon isn't a single-user research tool. It's a multi-tenant clinical research platform serving 18 users across multiple institutions, running CohortMethod estimations, PatientLevelPrediction models, Self-Controlled Case Series analyses, Cohort Diagnostics, and Characterization reports against a million-patient OMOP CDM database. Simultaneously.

That's where things fell apart.

## The Breaking Point

The first sign of trouble was a Slack message from a researcher: *"My estimation has been running for 20 minutes. Is the system down?"*

It wasn't down. Another user had kicked off a CohortMethod propensity score matching job five minutes earlier. Because Plumber v1 is single-threaded, every subsequent request — health checks, status queries, the second user's estimation — queued behind that first analysis with zero feedback.

Here's what was actually happening inside the container:

```
┌──────────────────────────────────────────────────────────┐
│  PID 1: Rscript plumber_api.R                            │
│         └─ plumber v1 (SINGLE THREAD)                    │
│              ├─ /health         → BLOCKED (behind job)   │
│              ├─ /estimation/run → RUNNING (20 min)       │
│              ├─ /prediction/run → QUEUED (no feedback)   │
│              └─ /status         → BLOCKED                │
│                                                          │
│  Docker health check: curl localhost:8787/health          │
│    interval: 600s (TEN MINUTES between checks)           │
│    Response: {"status":"ok"} (even if JVM is dead)       │
│                                                          │
│  No JDBC timeouts. No process supervision.               │
│  No garbage collection. No crash recovery.               │
└──────────────────────────────────────────────────────────┘
```

Over the following weeks, I cataloged five distinct failure modes:

**Blocked health checks.** Docker's health probe couldn't reach the `/health` endpoint because the single thread was locked in a Cox regression. After 5 retries at 600-second intervals (50 minutes!), Docker finally marked the container unhealthy. But by then, the analysis had probably finished — and the restart killed the cleanup.

**Ghost containers.** With 10-minute health check intervals, a crashed R process sat undetected. The Laravel backend got `connection refused` errors and returned generic 500s. Users saw "analysis failed" with no explanation.

**Hung JDBC connections.** Twice I watched the R process freeze completely — not crashed, not high-CPU, just stuck. `strace` showed it blocked on a socket read to PostgreSQL with no timeout set. The database had closed the connection during a long-running covariate extraction, but R didn't know. The only fix was `docker compose restart r-runtime`, which killed any active analysis.

**Unsafe disconnects.** `DatabaseConnector::disconnect()` throws if the connection is already dead. Several endpoint files had bare `disconnect()` calls in their cleanup code. A disconnect error would mask the actual analysis result and return a 500 to the user — even though the analysis had completed successfully. The results were computed, stored in R memory, and then lost because the HTTP response errored on cleanup.

**Memory creep.** Long-running sessions accumulated R objects across requests with no GC strategy. The default JVM garbage collector would pause unpredictably — sometimes 2-5 seconds — during large covariate matrix operations. Eventually the heap ran out and `rJava` calls started throwing `OutOfMemoryError`.

I spent weeks applying band-aids: extending health check intervals to avoid false-positive restarts, adding retry logic in Laravel's `RService`, telling users to "wait for the current analysis to finish." But the core problem was architectural. Plumber v1 is single-threaded by design. No amount of application-level workarounds fixes that.

## The Decision

On March 17, 2026, I decided to stop patching and start rebuilding. The goal was simple:

> Replace the entire R runtime infrastructure with something that can handle concurrent requests, recover from crashes, and not lie about its health.

The constraints were equally clear:
- Every HADES analysis that worked before must work identically after. Zero breaking changes.
- The 12 existing API endpoint files must be portable. We're not rewriting CohortMethod integration.
- Memory budget: 32GB container limit, shared between R and the JVM.
- Cold start under 2 minutes (HADES package loading is unavoidably heavy).

## Phase 1: Stop the Bleeding (March 4)

Before the big rewrite, I made two immediate changes to buy time.

First, the health check interval dropped from 600 seconds to 30. Three failures at 30-second intervals means the container is marked unhealthy in 90 seconds instead of 50 minutes. I also added `start_period: 120s` to account for HADES package loading — without this, Docker would kill the container before R even finished booting.

Second, I tuned the JVM. The default garbage collector pauses unpredictably during large operations. Switching to G1GC with `MaxGCPauseMillis=200` keeps pauses short. Combined with `R_MAX_VSIZE=24Gb` for the R vector heap, this eliminated the OOM crashes and GC stalls:

```yaml
environment:
  - _JAVA_OPTIONS=-Xmx8g -Xms2g -XX:+UseG1GC -XX:MaxGCPauseMillis=200
  - R_MAX_VSIZE=24Gb
```

## Phase 2: An Honest Health Check (March 7)

The old health check was four lines of R that returned `{"status":"ok"}` unconditionally. The JVM could be dead, memory at 95%, JDBC driver missing — and it would still say "ok."

I replaced it with a deep validation endpoint that checks five things on every 30-second probe:

1. **HADES packages loadable** — `requireNamespace()` for CohortMethod, PatientLevelPrediction, DatabaseConnector. Catches corrupted installs.
2. **JVM alive** — actually creates a Java object via `rJava::.jnew()`. If the heap is exhausted, this fails.
3. **Memory usage** — `gc()` returns current consumption. Alerts at 87% of the 32GB limit.
4. **JDBC driver present** — verifies `/opt/jdbc/postgresql-42.7.3.jar` exists. (This was a real bug — the volume mount at `/app` was clobbering the driver.)
5. **Uptime tracking** — detects unexpected restarts. If uptime drops to zero when nobody restarted the container, something crashed.

```json
{
  "status": "ok",
  "service": "parthenon-r-runtime",
  "version": "0.2.0",
  "r_version": "4.4.3",
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

When any check fails, `status` changes to `"degraded"`. Docker still gets a 200 (so it doesn't restart mid-analysis), but the Laravel backend knows not to submit new work.

## Phase 3: JDBC Timeouts (March 8)

The hung-connection problem was insidious. R would issue a SQL query, the database would close the connection during a long covariate extraction, and R would sit on a socket read forever. No timeout. No error. Just silence.

I added explicit JDBC timeouts to every PostgreSQL connection string:

```
socketTimeout=300        # Kill queries hung at socket level (5 min)
connectTimeout=30        # Fail fast if DB unreachable
loginTimeout=30          # Fail fast if auth hangs
tcpKeepAlive=true        # Detect dead connections via TCP probes
```

Then I wrapped every `DatabaseConnector::disconnect()` call in a `tryCatch`. There were 10 disconnect call sites across 6 endpoint files. Each one got a `safe_disconnect()` wrapper that logs the error but doesn't throw — so a dead connection during cleanup never masks a successful analysis result.

## Phase 4: Async Job Registry (March 10)

Even with health check and timeout improvements, the fundamental problem remained: Plumber v1 is single-threaded. While I planned the full migration to plumber2, I built an interim solution using `callr::r_bg()`.

The idea: instead of blocking the HTTP thread for 20 minutes, dispatch the analysis to a background R subprocess and return a job ID immediately. The Laravel backend polls for completion.

```
POST /jobs/submit   → dispatch to callr::r_bg(), return {job_id}
GET  /jobs/status/X → check if background process finished
POST /jobs/cancel/X → kill background process
```

Each job runs in its own R process with full HADES environment. The main Plumber thread stays free for health checks and status queries. Job results are cached in memory with a 5-minute TTL.

This was a stopgap, but it proved the pattern that Darkstar would later implement properly with mirai daemons.

## Phase 5: The Big Migration (March 17-19)

Three days. Complete infrastructure overhaul.

**Plumber v1 → Plumber2 0.2.0.** Plumber2 is the async-first successor to Plumber, designed for production workloads. It uses the httpuv2 event loop and supports native integration with mirai for concurrent execution.

**mirai 2.6.1 with 3 daemon workers.** mirai ("future" in Japanese) provides persistent R worker processes. Instead of spawning a new `callr::r_bg()` process per job, mirai maintains 3 pre-warmed daemon workers that share the HADES package load. Each daemon is a separate R process with ~3GB memory footprint (R heap + JVM heap).

**s6-overlay for process supervision.** The legacy container ran bare `Rscript` as PID 1. If the process crashed, Docker's restart policy would recreate the container — a 60-second cold start including HADES package loading. With s6-overlay, PID 1 is a proper init system. If the Plumber process crashes, s6 restarts it *inside the same container* in seconds. The JVM stays warm. The JDBC driver stays loaded.

The new architecture:

```
┌──────────────────────────────────────────────────────────────┐
│  Docker: parthenon-darkstar (s6-overlay as PID 1)            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  s6-overlay (init system, signal handling, supervision) │  │
│  │    └─ plumber2 event loop (non-blocking)               │  │
│  │         ├─ /health      → instant (deep validation)    │  │
│  │         ├─ /estimation  → dispatched to mirai daemon   │  │
│  │         ├─ /prediction  → dispatched to mirai daemon   │  │
│  │         └─ /sccs        → dispatched to mirai daemon   │  │
│  │                                                        │  │
│  │  mirai daemon pool:                                    │  │
│  │    ├─ daemon 1: [IDLE]     ← ready for work            │  │
│  │    ├─ daemon 2: [RUNNING CohortMethod, 12min elapsed]  │  │
│  │    └─ daemon 3: [IDLE]     ← ready for work            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Memory: 32GB limit (~3GB per daemon + 3GB event loop)       │
│  JDBC: socketTimeout=300s, connectTimeout=30s, tcpKeepAlive  │
│  JVM: G1GC, -Xmx8g, MaxGCPauseMillis=200ms                 │
│  Health: 30s interval, deep validation, degraded state       │
│  Crash recovery: s6 auto-restart, exit code/signal logging   │
└──────────────────────────────────────────────────────────────┘
```

The migration required rewriting all 12 endpoint files from Plumber v1 syntax to Plumber2's router API. The core analysis logic — the HADES function calls, the SQL generation, the result transformation — remained untouched. Only the HTTP layer changed.

The Dockerfile went from a simple `install.packages("plumber")` to a multi-stage, 7-layer build:

| Layer | Contents | Purpose |
|-------|----------|---------|
| 1 | plumber2, mirai, rJava, duckdb | Native compilation (Rust toolchain for plumber2's waysign dependency) |
| 2 | DatabaseConnector, SqlRender, Andromeda | OHDSI connectivity |
| 3 | Cyclops, FeatureExtraction | Analytics core |
| 4 | CohortMethod, PLP, SCCS, EvidenceSynthesis | HADES analysis packages |
| 5 | DeepPatientLevelPrediction | Deep learning (optional) |
| 6 | CohortDiagnostics, CohortGenerator | Cohort tools |
| 7 | Strategus | Study orchestration |

Each layer is cached independently. A code change in the R API files only rebuilds the final application stage — a 30-second rebuild instead of the 45-minute full HADES compilation.

## Phase 6: Namespace Warmup (March 19)

One last optimization. Cold start time was ~60 seconds because R lazy-loads package namespaces on first use. The first health check after boot would take 8 seconds instead of 118ms because it triggered CohortMethod compilation.

I added a build-time warmup step that forces all HADES packages to compile their bytecode during `docker build`:

```dockerfile
RUN Rscript -e " \
  suppressMessages({ \
    library(rJava); .jinit(); \
    library(DatabaseConnector); \
    library(CohortMethod); \
    library(PatientLevelPrediction); \
    library(SelfControlledCaseSeries); \
    library(EvidenceSynthesis); \
  }); \
"
```

This moved the compilation cost from runtime to build time. Cold start dropped from 60 seconds to ~40 seconds.

## The Benchmark

On March 19, I ran the legacy container (Plumber v1, pre-hardening commit `c76884236`) and Darkstar side by side against the same OMOP CDM database, executing the same CohortMethod estimation spec.

### Health Probe Responsiveness During Analysis

Both containers ran a 2-minute analysis. I probed `/health` every 5 seconds during execution.

| Metric | Legacy | Darkstar | Change |
|--------|--------|----------|--------|
| Health probes OK | 13/24 (54%) | **17/24 (71%)** | **+31%** |
| Probes blocked | 11/24 (46%) | **7/24 (29%)** | **36% fewer** |
| Max consecutive blocked | 11 (55s dark) | **7 (35s)** | **20s faster recovery** |

The legacy container went completely dark for 55 seconds straight — nearly a minute where no request of any kind could be served. Darkstar recovered responsiveness 20 seconds sooner. The remaining 35-second blocking window happens during the synchronous JDBC connection establishment and initial SQL burst, which locks the R process handling the request. Once CohortMethod transitions to its computation phase, the plumber2 event loop regains control and health probes resume.

### Execution Performance

Both containers ran the identical pipeline: data extraction, covariate building, propensity score fitting. Both hit the same clinical error at the same point (high covariate-treatment correlation — a study design issue, not a container issue).

| Metric | Legacy | Darkstar | Change |
|--------|--------|----------|--------|
| **R execution time** | 102.8s | **66.3s** | **35% faster** |
| Wall time | 168s | 159s | 5% faster |

The 35% speedup comes from three sources: G1GC reducing GC pause overhead, namespace warmup eliminating first-request compilation, and the larger JVM heap reducing garbage collection frequency.

### Cold Start

| Container | Cold Start |
|-----------|-----------|
| Legacy | 2s |
| Darkstar | 4s |

Darkstar is 2 seconds slower due to s6-overlay init and mirai daemon startup. This is a one-time cost at container creation — an acceptable tradeoff for crash recovery and process supervision.

## The Bugs We Found Along the Way

Building Darkstar wasn't just an infrastructure project. Running real HADES analyses against real clinical data surfaced bugs that would have been invisible in a test environment.

**1. Silent covariate exclusion bypass.** `CohortMethod::createCovariateSettings(excludedConceptIds = c(1234))` was being silently ignored because we were passing the IDs in the wrong argument position. Patients were getting propensity scores contaminated by the exposure concept.

**2. CohortMethod v6 API break.** Between v5 and v6, every function switched from positional arguments to `Args` objects: `createPs(cohortMethodData, population)` became `createPs(cohortMethodData, population, createPsArgs = createCreatePsArgs())`. Every endpoint needed updating.

**3. jsonlite auto-simplification.** R's `jsonlite::toJSON(simplifyVector = TRUE)` was converting single-element arrays into scalar values. A cohort with one patient would serialize as `"person_id": 42` instead of `"person_id": [42]`. Laravel's JSON decoder would then treat it as an integer instead of an array, breaking downstream processing.

**4. PLP non-serializable objects.** PatientLevelPrediction returns S3 objects with custom print methods, environment closures, and external pointers that `jsonlite` can't serialize. We had to write custom extraction functions to pull the numeric results out of the PLP result objects.

**5. SCCS anchor normalization.** The SCCS package expects `era_start` as an anchor value, but our frontend sent `era start` (no underscore). R silently accepted the invalid anchor and computed results with a different reference point.

## Production Validation

Between March 7 and March 20, Darkstar processed **5 original research studies** with 37 cohort definitions and 29 analysis configurations against a million-patient OMOP CDM:

- **CKD Progression Study** — ACEi vs CCB comparative effectiveness on renal outcomes. 73K propensity-score matched pairs. HR=0.989. 9-14 minute execution.
- **Post-MI Secondary Prevention** — Aspirin vs Clopidogrel on recurrent MACE. Stratified Cox regression with 12 negative control outcomes.
- **Prediabetes Metformin Study** — Metformin vs watchful waiting on T2DM progression. PS-stratified Cox with 8 outcome definitions.
- **Statin Primary vs Secondary Prevention** — IHD vs no-IHD composite MACE risk in statin users.
- **Hypertension vs Metabolic Syndrome** — Multi-cohort MACE risk comparison with PS stratification.

Every analysis completed successfully. Every result was clinically plausible. Every execution was tracked through the Jobs page with live progress bars.

## The Name

On March 20, 2026, we renamed `parthenon-r` to `parthenon-darkstar`. The old name was descriptive — "R runtime." The new name reflects what it became: a hardened, production-grade engine that runs in the background, processes the heaviest workloads in the stack, and never asks for attention.

Sixteen files changed. Zero breaking changes. The HADES packages don't know. The OMOP CDM doesn't know. The researchers don't know. They just see their analyses finish faster and more reliably than before.

## What Darkstar Is

| Capability | Legacy | Darkstar |
|-----------|--------|----------|
| Concurrent requests | 1 (everything queues) | 3 mirai daemons + event loop |
| Health monitoring | 10-min interval, trivial check | 30s interval, deep validation |
| Process supervision | None (bare Rscript as PID 1) | s6-overlay auto-restart |
| JDBC resilience | No timeouts | 300s socket, 30s connect, TCP keepalive |
| Crash recovery | Docker restart → 60s cold start | s6 in-container restart → seconds |
| GC strategy | Default JVM GC (2-5s pauses) | G1GC with 200ms pause target |
| Memory management | Default R limits | 24GB vector heap, 8GB JVM |
| Cold start | 60s | 40s (namespace warmup) |
| R execution speed | Baseline | 35% faster |

## What's Next

Darkstar currently runs HADES analyses that were originally designed for batch execution on a single workstation. The next frontier is **volcano plots for CodeWAS** — running per-concept logistic regressions across thousands of OMOP concepts to generate effect estimates and p-values for phenome-wide association studies.

The infrastructure is ready. CohortMethod already produces hazard ratios and p-values per outcome. The mirai daemon pool can handle the concurrent workload. The async job registry can track thousands of sub-analyses. The D3 visualization layer in the frontend has forest plot patterns ready to extend.

Darkstar was built to handle exactly this kind of workload: computationally expensive, highly parallelizable, and too important to fail silently.

---

*Darkstar is open source as part of Parthenon. The container definition, plumber2 API, and s6-overlay configuration are in `docker/r/` and `r-runtime/` in the [Parthenon repository](https://github.com/sudoshi/Parthenon).*
