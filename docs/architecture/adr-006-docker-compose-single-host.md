# ADR-006: Single-Host Docker Compose with 28+ Services

**Status:** Accepted
**Date:** 2026-03-21
**Decision Makers:** Dr. Sanjay Udoshi

## Context

Parthenon integrates services spanning five runtime ecosystems: PHP (Laravel), JavaScript/TypeScript (React + Vite), Python (FastAPI + AI), R (HADES analytics), and Java (Solr, OHDSI tools). Supporting services include PostgreSQL, Redis, Solr, ChromaDB, Qdrant, Orthanc (DICOM), Grafana, Prometheus, and Loki. The platform targets two deployment profiles:

1. **Development/single-site** -- A single Linux server (4-32 cores, 16-64GB RAM) at a research institution or clinical site, managed by a data engineer or IT generalist.
2. **Enterprise/multi-site** -- Kubernetes-orchestrated deployment across multiple nodes with horizontal scaling (planned, not yet implemented).

The immediate priority is making the platform installable and runnable with minimal DevOps expertise. The target is a single `docker compose up -d` command to bring up the entire stack.

## Decision

Define all services in a single `docker-compose.yml` file (886 lines, 28+ services). Use Docker Compose profiles to allow selective service activation. Pre-built images are published to GitHub Container Registry (GHCR) to avoid lengthy local builds.

**Service inventory (28 runtime services + volumes):**

| Category | Services |
|----------|----------|
| Core app | nginx, php, node (Vite dev), horizon (queue worker), reverb (WebSocket) |
| Data | postgres, redis, solr |
| AI/ML | python-ai, chromadb, qdrant |
| Analytics | darkstar (R runtime), finngen-runner |
| Research tools | study-agent, whiterabbit, hecate, fhir-to-cdm |
| Medical | orthanc (DICOM), ohif-build (viewer) |
| Ingest | morpheus-ingest |
| Notebooks | jupyterhub |
| Monitoring | grafana, prometheus, cadvisor, node-exporter, loki, alloy |
| Build | docs-build |

**Schema isolation** (per ADR-001) means all these services share a single PostgreSQL instance. Inter-service communication uses Docker's internal DNS (service names as hostnames).

**GHCR pre-built images** (e.g., `ghcr.io/sudoshi/parthenon-darkstar:latest`) eliminate the need to build R or Python containers locally, which can take 30-60 minutes due to HADES package compilation.

## Consequences

### Positive
- Single command (`docker compose up -d`) starts the entire platform -- no multi-repo coordination
- Docker Compose profiles allow running a minimal subset (e.g., `docker compose --profile core up -d` for just PHP, nginx, PostgreSQL, Redis)
- GHCR pre-built images reduce first-run time from 60+ minutes to under 5 minutes
- All service configurations (ports, volumes, environment, health checks, resource limits) are in one file, making the system inspectable with `docker compose config`
- Health checks on critical services (PostgreSQL, Redis, PHP) enable `depends_on` with `condition: service_healthy` for proper startup ordering
- Resource limits (`deploy.resources.limits`) prevent any single service from consuming all host memory

### Negative
- The `docker-compose.yml` file is 886 lines and growing -- editing requires understanding the full service graph
- Running all 28 services simultaneously requires 16GB+ RAM; smaller development machines must selectively disable services
- `docker compose restart` does not reload `env_file` -- this gotcha has caused multiple debugging sessions; `docker compose up -d` must be used instead
- Single point of failure: if the Docker daemon crashes, all services go down simultaneously
- Log aggregation across 28 containers requires Loki/Alloy -- `docker compose logs` alone is unwieldy

### Risks
- Port conflicts on the host: 12+ ports are exposed (8082, 5480, 6381, 5175, 8002, 8787, 8983, etc.). Mitigated by using non-standard ports and making them configurable via environment variables.
- Docker socket mounting: JupyterHub and Alloy mount `/var/run/docker.sock`, which is a privilege escalation vector. Documented in HIGHSEC.spec.md with strict rules against adding socket mounts to new services.
- Image size: the full set of images exceeds 15GB. Mitigated by multi-stage Dockerfile builds and `.dockerignore` files.
- Version drift between GHCR images and local Dockerfiles if builds are not kept in sync. Mitigated by CI pipelines that rebuild and push on every merge to main.

## Alternatives Considered

1. **Kubernetes from the start** -- Deploy on K8s with Helm charts. Rejected for the initial release because the target audience (single-site research institutions) rarely has K8s expertise, and the operational complexity is disproportionate to a single-server deployment. K8s is planned for the enterprise tier.

2. **Multiple docker-compose files** -- Split services into `docker-compose.core.yml`, `docker-compose.monitoring.yml`, `docker-compose.research.yml`, etc. Rejected because Docker Compose's `-f` flag for multi-file composition is error-prone, and profiles achieve the same selective activation within a single file.

3. **Bare-metal services (no Docker)** -- Install PHP, PostgreSQL, Redis, R, Python, Solr directly on the host. Rejected because dependency conflicts between five runtime ecosystems make bare-metal installation fragile and non-reproducible across different Linux distributions.

4. **Podman Compose** -- Use Podman for rootless containers. Considered for security benefits but rejected because Docker Compose has broader ecosystem support, and many OHDSI community tools assume Docker.

5. **Microservices with separate repos** -- Each service in its own repository with independent CI/CD. Rejected because it fragments the development experience and makes cross-service changes (e.g., a database migration that affects both PHP and Python) require coordinated releases.
