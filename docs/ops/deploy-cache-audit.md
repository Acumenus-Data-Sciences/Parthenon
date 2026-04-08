# Deploy Cache Audit

Date: 2026-04-08
Scope: `deploy.sh` and all runtime services in `docker-compose.yml`

## Goal

Ensure every `./deploy.sh` run clears stale runtime caches and build caches
without deleting durable application data, search indexes, vector collections,
or user content.

## Cache Matrix

| Service | Cache Surface | Class | Deploy Action |
| --- | --- | --- | --- |
| `php` | PHP opcache | Ephemeral runtime cache | `php-fpm` USR2 reload during unified cache reset |
| `php` | Laravel compiled/config/route/view/event caches | Ephemeral runtime cache | `php artisan optimize:clear` on every deploy run |
| `php` | Laravel app cache store (`cache` table or configured store) | Ephemeral runtime cache | Cleared by `php artisan optimize:clear` on every deploy run |
| `horizon` | Worker process memory and code state | Ephemeral runtime cache | `php artisan horizon:terminate` on every deploy run |
| `php` / queues | Queue worker code state | Ephemeral runtime cache | `php artisan queue:restart` on every deploy run |
| `reverb` | WebSocket in-memory runtime state | Ephemeral runtime cache | Container restart on every deploy run |
| `nginx` | DICOM proxy cache in `/tmp/nginx-dicom-cache` | Ephemeral runtime cache | Directory cleared and nginx reloaded on every deploy run |
| `frontend` | `dist/` output and TypeScript build info | Ephemeral build cache | `frontend/dist` and `node_modules/.tmp/*.tsbuildinfo` removed before frontend builds |
| `docs-build` | Docusaurus `.docusaurus`, `build`, and `node_modules/.cache` | Ephemeral build cache | Removed before docs builds |
| `php` / Scribe | `backend/.scribe/endpoints.cache` | Ephemeral build cache | Removed before doc/OpenAPI generation |
| `python-ai` | Chroma collection handle cache, projection cache, warmed embedders, HTTP clients | Ephemeral runtime cache | Container restart on every deploy run |
| `blackrabbit` | `scan_store` in-memory scan/result registry | Ephemeral runtime cache | Container restart on every deploy run |
| `study-agent` | In-process prompt bundle caches and tool-local `_CACHE` maps | Ephemeral runtime cache | Container restart on every deploy run |
| `darkstar` | In-memory async job/result registry | Ephemeral runtime cache mixed with live jobs | Health endpoint cleanup always; restart only when `/jobs/list` is empty |
| `hecate` | In-process TTL cache | Ephemeral runtime cache | Container restart on every deploy run |
| `fhir-to-cdm` | `/tmp/fhir_input` and `/tmp/cdm_output` runtime temp state | Ephemeral runtime cache | Container restart on every deploy run |
| `orthanc` | DICOMweb metadata cache | Ephemeral runtime cache | Container restart on every deploy run |
| `solr` | Query/filter caches inside Solr JVM | Ephemeral runtime cache | Container restart on every deploy run |
| `chromadb` | Process-local caches while retaining persisted collections | Ephemeral runtime cache | Container restart on every deploy run |
| `qdrant` | Process-local caches while retaining persisted collections | Ephemeral runtime cache | Container restart on every deploy run |

## Intentionally Preserved

These are not treated as deploy-time caches because they are durable product
data or expensive persistent assets:

- `chromadb-data` volume contents
- `qdrant-data` volume contents
- `solr_data` core contents
- Redis queue/session/Horizon data
- PostgreSQL tables such as `mapping_cache`, `patient_similarity_cache`, and PACS `metadata_cache`
- Study Agent phenotype index in `study-agent-data`
- AI model cache under `/tmp/parthenon-ai-models`
- Orthanc DICOM storage and PostgreSQL-backed index
- Docs npm package cache volume used only to speed rebuilds

## Current `deploy.sh` Guarantees

Every deploy mode now runs the unified runtime cache reset section, including:

1. Laravel optimize/app cache clear.
2. Queue and Horizon worker recycle.
3. php-fpm opcache reload.
4. Nginx DICOM proxy cache purge.
5. Runtime-service restarts for AI/search/vector services.
6. Safe conditional handling for Darkstar so active analyses are not killed.

Build-specific deploy modes also clear their local build caches before rebuild.

## Tradeoffs

- Clearing runtime caches now favors correctness over minimal restarts.
- Durable data stores are preserved; only process/query caches are reset.
- Darkstar is intentionally guarded because a forced restart would kill active analyses.
