# ADR-007: Darkstar with s6-overlay, Plumber2, and mirai Worker Pool

**Status:** Accepted
**Date:** 2026-03-21
**Decision Makers:** Dr. Sanjay Udoshi

## Context

Parthenon executes OHDSI HADES analytics packages (CohortMethod, PatientLevelPrediction, CohortGenerator, Achilles, DataQualityDashboard) that are written in R. These packages require R 4.4, Java (for DatabaseConnector/JDBC), and 20+ R package dependencies including Cyclops, SqlRender, and Arrow.

Darkstar must:
1. Expose an HTTP API so the Laravel backend and Python AI service can trigger R analyses
2. Handle concurrent analysis requests without blocking (analyses can run for minutes to hours)
3. Survive process crashes without bringing down the container
4. Start reliably despite HADES packages taking 30-60 seconds to load into memory

The initial R container used a simple `Rscript plumber_api.R` entrypoint, which suffered from: single-threaded blocking (one long analysis blocked all other requests), no process supervision (a crash required manual container restart), and no worker pool for parallel execution.

## Decision

Build a custom R container called **Darkstar** (`parthenon-darkstar`) with three architectural components:

### 1. s6-overlay as PID 1

Use s6-overlay v3 as the init system instead of the default Docker `tini` or direct process execution. s6-overlay provides:
- Proper signal forwarding to child processes
- Automatic restart of crashed services
- Ordered startup/shutdown of multiple processes within a single container
- Readiness notification so dependent services can wait for R to be fully loaded

### 2. Plumber2 HTTP API

Replace the legacy Plumber (v1) API with Plumber2, which provides:
- Modern HTTP routing with middleware support
- Built-in request validation
- WebSocket support for streaming analysis progress
- Rust-based `waysign` dependency for cryptographic request signing

### 3. mirai 3-Worker Pool

Use the `mirai` package (by ShColumn Zero) to create a pool of 3 pre-forked R worker processes. The main Plumber2 process accepts HTTP requests and dispatches analysis tasks to the worker pool via `mirai::mirai()`. This provides:
- Non-blocking request handling: the API remains responsive while analyses run
- Parallel execution of up to 3 concurrent analyses
- Worker crash isolation: a failed worker is replaced without affecting the API process
- Pre-loaded HADES packages in each worker (loaded at pool creation time)

### Container specifications

- **Base image:** `rocker/r-ver:4.4` (Debian-based R distribution)
- **Container name:** `parthenon-darkstar`
- **Port:** 8787
- **Memory allocation:** 32GB (configurable via Docker resource limits)
- **Multi-stage Dockerfile:** Stage 1 compiles HADES dependencies (cached layer), Stage 2 adds application code and s6 configuration
- **GHCR image:** `ghcr.io/sudoshi/parthenon-darkstar:latest` (pre-built to avoid 30+ minute local compilation)

### Package installation strategy

Packages are pinned to specific versions (as of 2026-03-04) and installed in dependency order across multiple Dockerfile layers:
- Layer 1: Base R plumbing (`plumber2`, `mirai`, `nanonext`, `jsonlite`, `DBI`, `RPostgres`), plus native-compilation packages (`rJava`, `duckdb`)
- Layer 2: HADES core (`DatabaseConnector`, `SqlRender`, `Eunomia`, `Achilles`, `DataQualityDashboard`)
- Layer 3: HADES analytics (`CohortMethod`, `PatientLevelPrediction`, `CohortGenerator`, `CohortDiagnostics`, `Cyclops`)
- Layer 4: Visualization and utilities (`ggplot2`, `plotly`, `survival`, `arrow`)

## Consequences

### Positive
- 35% faster analysis execution compared to the legacy single-threaded container (3 parallel workers)
- API remains responsive during long-running analyses -- health checks and status queries are never blocked
- Worker crash isolation prevents a single failed analysis from bringing down the entire R service
- s6-overlay automatically restarts crashed processes, reducing manual intervention
- Pre-built GHCR image eliminates the 30+ minute local build time for HADES package compilation
- Pinned package versions prevent rolling-release breakage from upstream R package updates

### Negative
- Container image size is large (~4GB) due to HADES dependencies, Java JDK, and Rust toolchain
- 32GB memory allocation is substantial -- smaller machines must reduce the worker count
- s6-overlay adds complexity to the Dockerfile and requires understanding its service directory structure
- The Rust toolchain is required at build time solely for `waysign` (a Plumber2 dependency), adding build time
- R container still runs as root (hardening to non-root user is planned but not yet implemented)

### Risks
- mirai worker pool exhaustion: if more than 3 analyses are submitted simultaneously, requests queue. Mitigated by the Laravel backend's Horizon queue, which rate-limits analysis dispatch.
- JDBC driver compatibility: DatabaseConnector bundles JDBC drivers that must match the target database version. Mitigated by including drivers for PostgreSQL, SQL Server, Oracle, and Redshift in the container.
- R package version conflicts: pinning versions can cause dependency resolution failures when updating individual packages. Mitigated by testing the full package set in CI before updating pins.

## Alternatives Considered

1. **OpenCPU** -- A mature R-as-a-service platform. Rejected because it imposes its own URL routing scheme (`/ocpu/library/{pkg}/R/{fn}`) that conflicts with the custom API design, and its Apache-based architecture adds unnecessary components.

2. **Shiny Server** -- Interactive R web applications. Rejected because Parthenon needs an API (request/response), not interactive dashboards, and Shiny's WebSocket-based architecture is designed for user sessions, not programmatic API calls.

3. **Legacy Plumber v1** -- The original implementation. Replaced because Plumber v1 is single-threaded (one request at a time), lacks middleware support, and has no built-in worker pool mechanism.

4. **R subprocess per request** -- Spawn a new R process for each analysis request. Rejected because R process startup (including HADES package loading) takes 30-60 seconds, making per-request spawning impractical.

5. **Rewrite analytics in Python** -- Port HADES packages to Python. Rejected because the OHDSI community maintains HADES exclusively in R, and rewriting would require ongoing maintenance to keep pace with upstream changes to CohortMethod, PLP, and other packages.
