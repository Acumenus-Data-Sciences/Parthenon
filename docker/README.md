# Parthenon Docker Configuration

Container configurations for all Parthenon services.

## Services (18)

| Service | Ports |
|---|---|
| nginx | ${NGINX_PORT:-8082}:80 |
| php | internal |
| node | ${VITE_PORT:-5175}:5173 |
| postgres | ${POSTGRES_PORT:-5480}:5432 |
| redis | ${REDIS_PORT:-6381}:6379 |
| python-ai | ${AI_PORT:-8002}:8000 |
| chromadb | internal |
| study-agent | ${STUDY_AGENT_PORT:-8765}:8765 |
| qdrant | internal |
| hecate | ${HECATE_PORT:-8080}:8080 |
| solr | ${SOLR_PORT:-8983}:8983 |
| blackrabbit | ${BLACKRABBIT_PORT:-8090}:8090 |
| darkstar | ${R_PORT:-8787}:8787 |
| horizon | internal |
| orthanc | ${ORTHANC_PORT:-8042}:8042 |
| ohif-build | internal |
| docs-build | internal |
| fhir-to-cdm | ${FHIR_TO_CDM_PORT:-8091}:8091 |

## Quick Start

```bash
docker compose up -d          # Start all services
docker compose ps             # Check health
docker compose logs -f php    # Follow PHP logs
```

## Dockerfiles

- `docker/php/Dockerfile` — PHP-FPM 8.4 with extensions
- `docker/nginx/Dockerfile` — Nginx reverse proxy
- `docker/node/Dockerfile` — Node.js for Vite builds
- `docker/r/Dockerfile` — Darkstar, R 4.4 with HADES packages

## Key URLs (Development)

| Service | URL |
|---|---|
| App | http://localhost:8082 |
| Vite dev server | http://localhost:5175 |
| AI service | http://localhost:8002 |
| Darkstar | http://localhost:8787 |
| Solr | http://localhost:8983 |
| PostgreSQL | localhost:5480 |
| Redis | localhost:6381 |
