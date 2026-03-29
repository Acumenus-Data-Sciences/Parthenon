# Poseidon

dbt + Dagster orchestration for OMOP CDM maintenance in Parthenon.

Poseidon extends Aqueduct by adding incremental, idempotent, dependency-aware
CDM refresh pipelines. Each OMOP CDM table is a dbt model exposed as a Dagster
Software-Defined Asset. Dagster schedules, sensors, and jobs orchestrate the
full transformation pipeline.

## Quick Start

```bash
# Start Poseidon services
docker compose up -d poseidon-server poseidon-daemon

# Dagit UI
open http://localhost:3100

# Run dbt commands inside the container
make -f poseidon/Makefile dbt-debug    # Test DB connection
make -f poseidon/Makefile dbt-compile  # Compile models
make -f poseidon/Makefile dbt-build    # Run + test
```

## Architecture

- **poseidon/dbt/** — dbt project with macros, models, tests, seeds
- **poseidon/dagster/** — Dagster assets, resources, sensors, schedules, jobs
- **poseidon/docker/** — Dockerfile and entrypoint for the poseidon container

## Services

| Service | Port | Purpose |
|---------|------|---------|
| poseidon-server | 3100 | Dagit UI + GraphQL API |
| poseidon-daemon | — | Schedules, sensors, run launcher |

## Database Connection

Connects to host PG17 (`parthenon` database) via `host.docker.internal:5432`
using the `claude_dev` user. Credentials from `HECATE_PG_PASSWORD` env var.

## Key Macros

- `concept_lookup(code, vocabulary_id)` — map source code to standard concept_id
- `standard_concept(concept_id)` — follow Maps to relationship to standard concept
- `generate_schema_name(custom, node)` — route models to correct OMOP PG schema

See `docs/devlog/specs/2026-03-28-poseidon-design.md` for the full design spec.
