# Solr-Accelerated Vector Explorer — 48x Faster Initial Load

**Date:** 2026-03-12
**Branch:** feature/fhir-omop-ig-compliance
**Context:** Vector Explorer 3D visualization was loading in ~8-10s due to live PCA→UMAP computation on every page load

## Problem

The Vector Explorer's initial load required a full pipeline on every request:
1. Fetch 43K+ embeddings from ChromaDB in 500-record batches (86 round trips, ~5s)
2. PCA→UMAP dimensionality reduction (768d → 50d → 3d, ~3s)
3. K-means clustering + quality detection (~1s)

Additionally, the frontend intermittently showed "AI service unavailable" and fell back to a degraded 2D umap-js scatter plot, even though the API endpoint returned 200 when tested via curl.

## Solution

Added a `vector_explorer` Solr core that stores pre-computed 3D projections. The backend serves from Solr first (<200ms), falling back to live UMAP only when no index exists.

### Performance

| Path | Response Time | Response Size |
|------|--------------|---------------|
| Solr (cached) | **168ms** | 1.77MB |
| Live UMAP | 8,053ms | 1.77MB |
| **Speedup** | **48x** | — |

## What Was Built

### Solr Core — `vector_explorer`

- **Schema:** `solr/configsets/vector_explorer/conf/schema.xml`
  - Core fields: `point_id`, `collection_name`, `chroma_id`, `x`, `y`, `z`, `cluster_id`, `cluster_label`
  - Quality flags: `is_outlier`, `is_orphan`, `duplicate_of` (multiValued)
  - Metadata: `source`, `doc_type`, `category`, `title`, `document_text`
  - Dynamic fields: `meta_s_*`, `meta_i_*`, `meta_f_*` for arbitrary ChromaDB metadata
  - Stats document per collection with cluster centroids, counts, and `indexed_at` timestamp
- **Config:** `solr/configsets/vector_explorer/conf/solrconfig.xml` — optimized for bulk retrieval (default 10K rows, large document cache)
- **Docker:** Volume mount + `precreate-core` added to `docker-compose.yml`

### Indexer Command — `solr:index-vector-explorer`

`backend/app/Console/Commands/SolrIndexVectorExplorer.php`

- Calls the Python AI service's projection endpoint once per collection
- Indexes points in batches of 500 with quality flags and metadata
- Stores a stats document per collection with cluster info as dynamic fields
- Supports `--collection=NAME`, `--sample-size=N`, `--fresh` flags

```bash
php artisan solr:index-vector-explorer --fresh              # All collections
php artisan solr:index-vector-explorer --collection=docs    # Specific collection
php artisan solr:index-vector-explorer --sample-size=15000  # More points
```

### Search Service

`backend/app/Services/Solr/VectorExplorerSearchService.php`

- `getProjection(collectionName)` — returns full projection in the same format as the Python endpoint
- `hasProjection(collectionName)` — checks if a collection is indexed
- `searchPoints(collectionName, query, filters)` — faceted search within a projection (cluster, source, doc_type, outlier/orphan filtering)
- Rebuilds clusters, quality report, and stats from Solr documents

### Controller Update

`backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php`

- `projectCollection()` now tries Solr first via dependency-injected `VectorExplorerSearchService`
- Falls back to live UMAP if Solr unavailable or collection not indexed
- `refresh=true` parameter bypasses Solr cache for live re-computation

### Frontend Updates

- `VectorExplorer.tsx` — shows "Solr (cached)" vs "Live UMAP" source indicator, refresh button, indexed date
- `useVectorExplorer.ts` — added `console.error` logging in catch block for future debugging
- `chromaStudioApi.ts` — `fetchProjection` accepts optional `refresh` parameter

### Infrastructure Fixes

- **Nginx fastcgi buffers:** Increased from `4 × 16k` (64KB) to `16 × 128k` (2MB) + `256k` busy buffer — prevents potential truncation of 1.7MB projection responses
- **Solr config:** Added `vector_explorer` to `backend/config/solr.php` core registry
- **Docker Compose:** Added configset volume mount and `precreate-core` command for `vector_explorer`

## Architecture

```
Browser → Apache (production) → Nginx → PHP-FPM
                                          │
                                    ┌─────┴─────┐
                                    │ Solr       │ ← 168ms (pre-computed)
                                    │ available? │
                                    └─────┬─────┘
                                     yes  │  no
                                    ┌─────┴─────┐
                                    │ Return     │ Python AI → ChromaDB
                                    │ cached     │ → PCA→UMAP → cluster
                                    │ projection │ → quality → 8s
                                    └───────────┘
```

## Files Changed

| File | Change |
|------|--------|
| `solr/configsets/vector_explorer/conf/schema.xml` | New — Solr schema |
| `solr/configsets/vector_explorer/conf/solrconfig.xml` | New — Solr config |
| `solr/configsets/vector_explorer/conf/stopwords.txt` | New — required by text_general |
| `backend/app/Console/Commands/SolrIndexVectorExplorer.php` | New — indexer command |
| `backend/app/Services/Solr/VectorExplorerSearchService.php` | New — search service |
| `backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php` | Modified — Solr-first with UMAP fallback |
| `backend/config/solr.php` | Modified — added vector_explorer core |
| `docker-compose.yml` | Modified — volume mount + precreate-core |
| `docker/nginx/default.conf` | Modified — larger fastcgi buffers |
| `frontend/src/features/administration/components/vector-explorer/VectorExplorer.tsx` | Modified — source indicator, refresh button |
| `frontend/src/features/administration/components/vector-explorer/useVectorExplorer.ts` | Modified — error logging |
| `frontend/src/features/administration/api/chromaStudioApi.ts` | Modified — refresh parameter |

## Gotchas

- Solr core won't be created unless `stopwords.txt` exists in the configset (schema references it)
- Docker Compose `command` is inline, not using `solr/init/create-cores.sh` — must add `precreate-core` to the command string
- `docker compose restart` does NOT reload volume mounts — must use `docker compose up -d --force-recreate`
- The Solr stats document stores cluster centroids as dynamic float fields (`meta_f_cluster_N_cx/cy/cz`) — number of clusters is variable
