# Chroma Studio Rollout And Ingestion Quality Hardening

**Date:** 2026-04-08
**Status:** Complete
**Scope:** Chroma Studio feature expansion, vector explorer cache/search improvements, ingestion quality gates, and live rollout verification

## Summary

This work turned the earlier Chroma Studio launch into a fuller debugging and curation surface for Abby's vector corpus, while also tightening the ingest path so low-quality material is easier to reject, review, and trace.

The delivered slice includes:

- a richer Vector Explorer with 2D/3D switching, topology edges, query overlays, cluster hulls, and Solr-backed projection filtering
- dimension-aware projection caching and explicit refresh behavior between Laravel, the AI service, and Solr
- ingestion audit metadata recorded directly on docs, OHDSI papers, OHDSI knowledge, and textbook chunks
- stricter wiki corpus rebuild metadata gates, resume support, and bounded slug generation
- operational scripts to audit and export ingestion triage queues
- live PHP/frontend deploy plus `python-ai` restart and post-rollout health verification

## Chroma Studio Features

### Vector Explorer upgrades

The Chroma Studio viewer now supports a materially broader inspection workflow:

- `2D` and `3D` projection modes from the same explorer surface
- adaptive sample sizing and explicit projection refresh
- query mode with a projected query anchor and similarity-colored lines to visible hits
- QA mode with outlier, duplicate-pair, and orphan overlays
- clickable cluster visibility controls and per-point inspection
- metadata-driven coloring and collection-specific visual themes
- translucent cluster hull rendering for dense regions
- topology edge rendering from exact k-NN similarity edges

Primary frontend files:

- `frontend/src/features/administration/components/vector-explorer/VectorExplorer.tsx`
- `frontend/src/features/administration/components/vector-explorer/ThreeScene.tsx`
- `frontend/src/features/administration/components/vector-explorer/QueryVisuals.tsx`
- `frontend/src/features/administration/components/vector-explorer/ClusterHulls.tsx`
- `frontend/src/features/administration/components/vector-explorer/useVectorExplorer.ts`
- `frontend/src/features/administration/components/vector-explorer/constants.ts`
- `frontend/src/features/administration/components/vector-explorer/DimensionToggle.tsx`

### Solr-backed projection filtering

Chroma Studio can now filter the visible projection using the Solr-cached point index instead of only showing a static point cloud.

Supported filters:

- free-text query
- `source`
- `doc_type`
- `cluster_id`

This is exposed through:

- `GET /api/v1/admin/chroma-studio/collections/{name}/projection-search`
- `backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php`
- `backend/app/Services/Solr/VectorExplorerSearchService.php`
- `frontend/src/features/administration/api/chromaStudioApi.ts`

### Post-rollout performance and inspector optimizations

After the initial rollout, the Vector Explorer still felt slow in-browser even though Solr-backed projection assembly had been repaired. A follow-up pass focused on the real bottlenecks: oversized cached projection payloads and expensive client-side hover churn.

The follow-up changes include:

- compact Solr projection payloads that return only render-critical point metadata by default (`source`, `type`, `category`, `title`, plus an active color field when needed)
- on-demand point detail hydration for the inspector so full metadata is only fetched when a point is selected
- hover handling that updates only the previously hovered and newly hovered point instances instead of repainting the full point cloud on every pointer move
- cluster overlay cleanup so hull/topology helpers no longer re-filter cluster visibility when they already receive the visible point subset
- a dedicated Solr-backed point-details route:
  - `GET /api/v1/admin/chroma-studio/collections/{name}/projection-point?point_id=...`

Measured impact from the payload trim on Solr-cached 5K projections:

- `wiki_pages`: `5,047,282` bytes -> `1,922,965` bytes
- `docs`: `3,255,801` bytes -> `1,866,941` bytes
- `ohdsi_papers`: `2,612,380` bytes -> `1,868,462` bytes
- `clinical_reference`: `973,038` bytes -> `631,090` bytes

Measured Solr-backed projection assembly after the optimization pass:

- `clinical_reference`: `~61.5 ms`
- `wiki_pages`: `~82.9-102.6 ms`
- `ohdsi_papers`: `~111.4 ms`
- `docs`: `~130.1 ms`

Primary files touched in this optimization pass:

- `backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php`
- `backend/app/Services/Solr/VectorExplorerSearchService.php`
- `backend/routes/api.php`
- `frontend/src/features/administration/api/chromaStudioApi.ts`
- `frontend/src/features/administration/components/vector-explorer/useVectorExplorer.ts`
- `frontend/src/features/administration/components/vector-explorer/ThreeScene.tsx`
- `frontend/src/features/administration/components/vector-explorer/PointInspector.tsx`
- `frontend/src/features/administration/components/vector-explorer/VectorExplorer.tsx`
- `frontend/src/features/administration/components/vector-explorer/ClusterHulls.tsx`

### Projection pipeline changes

The AI projection service and Laravel proxy were extended so cached and live projections are consistent and inspectable:

- explicit `refresh` support on projection requests
- cache keys now include projection dimensionality
- projection responses now include similarity edges
- Solr retrieval respects requested sample size and projection dimension
- Solr stats docs now store `num_edges`, `projection_dimensions`, and `knn_neighbors`

Primary backend files:

- `ai/app/routers/chroma.py`
- `ai/app/services/projection.py`
- `backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php`
- `backend/app/Services/Solr/VectorExplorerSearchService.php`
- `backend/app/Console/Commands/SolrIndexVectorExplorer.php`
- `solr/configsets/vector_explorer/conf/schema.xml`

## Ingestion Quality Hardening

### Chunk audit metadata at ingest time

The Chroma ingest path now audits source material before or during ingest and records the audit verdict in metadata. This applies to:

- docs markdown
- OHDSI PDF corpus
- OHDSI knowledge markdown sources
- medical textbook JSONL sources

New metadata fields written during ingest include:

- `ingest_disposition`
- `ingest_reasons`
- `ingest_metadata_score`
- `ingest_relevance_score`
- `ingest_boilerplate_score`
- `ingest_noise_score`
- `ingest_source_quality_score` when available

Operationally, this means low-trust material can be filtered or inspected later without re-auditing raw inputs.

Other ingest fixes in the same slice:

- generated/vendor docs subtrees such as `node_modules`, `.docusaurus`, `build`, and `dist` are skipped
- textbook ingestion audits representative content before chunk writes
- OHDSI harvester metadata can now fall back to `metadata.csv` when state files are missing

Primary files:

- `ai/app/chroma/ingestion.py`
- `ai/tests/test_chroma_ingestion.py`
- `ai/tests/test_ingestion_quality.py`

### Audit and triage scripts

Two scripts were added to turn ingestion quality into an operator workflow instead of a one-off debugging pass:

- `ai/scripts/audit_ingestion_quality.py`
  Runs dry-run audits across docs, OHDSI papers, OHDSI knowledge, textbooks, or wiki sources.
- `ai/scripts/export_ingestion_triage.py`
  Converts one or more audit JSON outputs into actionable `reject` and `review` CSV/JSON queues plus Markdown/JSON summaries.

### Wiki corpus rebuild hardening

The wiki rebuild flow now rejects weak source rows earlier and is safer to resume:

- strict metadata gate for DOI, title, authors, journal, and publication year
- explicit `skipped_metadata` and `source_total` accounting
- optional `--skip-existing` resume mode using DOI presence in the workspace index
- git `index.lock` retry handling during batched commits
- bounded slug generation to avoid runaway source/concept slugs

Primary files:

- `ai/app/wiki/batch_ingest.py`
- `ai/app/wiki/engine.py`

## Verification

Targeted checks run for this rollout:

```bash
pytest ai/tests/test_projection_service.py -q
python3 -m compileall ai/app/services/projection.py ai/app/routers/chroma.py
php -l backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php
php -l backend/app/Services/Solr/VectorExplorerSearchService.php
php -l backend/routes/api.php
cd frontend && npx vite build --mode production
./deploy.sh --php
./deploy.sh --frontend
docker compose restart python-ai
docker compose exec -T python-ai curl -sf http://127.0.0.1:8000/health
docker compose exec -T python-ai curl -sf http://127.0.0.1:8000/chroma/health
```

Results:

- new projection service unit tests passed
- Python modules compiled successfully
- PHP syntax checks passed for the Chroma Studio controller, Solr search service, and API routes
- Vite production build succeeded
- `./deploy.sh --php` succeeded, including cache clears, API doc generation, and smoke checks
- `./deploy.sh --frontend` succeeded, including frontend smoke checks
- `python-ai` restarted successfully
- container-local AI health and Chroma health endpoints both returned `ok`
- follow-up PHP syntax checks and `./node_modules/.bin/tsc --noEmit` passed after the payload/inspector optimization pass
- live Solr detail retrieval was verified against cached `wiki_pages` points, including metadata keys such as `chunk_index`, `keywords`, `workspace`, `authors`, `journal`, and `slug`

## Deployment Notes

The repo's actual frontend deploy path is `./deploy.sh --frontend`, which uses a Vite production build. A separate `npm --prefix frontend run build` still fails because of unrelated TypeScript issues in existing wiki/generated API files, but those were not blockers for the production frontend deploy path used here.

## Files Added

- `ai/scripts/audit_ingestion_quality.py`
- `ai/scripts/export_ingestion_triage.py`
- `ai/tests/test_ingestion_quality.py`
- `ai/tests/test_projection_service.py`
- `frontend/src/features/administration/components/vector-explorer/DimensionToggle.tsx`
- `docs/devlog/process/chroma-studio-rollout-and-ingestion-quality-2026-04-08.md`

## Follow-Up

- Exercise the authenticated admin Chroma Studio UI against a live session to verify the new `projection-search` flow in-browser.
- Reindex the Solr vector explorer core if the new edge metadata is expected to be present for older cached collections.
- Decide whether the unrelated frontend TypeScript failures should be fixed now or whether the Vite-only production path remains the intentional deploy gate.
