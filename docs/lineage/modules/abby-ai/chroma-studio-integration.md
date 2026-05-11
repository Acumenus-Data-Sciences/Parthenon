# Chroma Studio Integration

**Date:** 2026-03-12
**Branch:** `feature/fhir-omop-ig-compliance`

## What Was Built

Full-stack ChromaDB management UI ("Chroma Studio") integrated into Parthenon's admin System Health interface. This gives administrators visual inspection and management of the vector knowledge base.

### 3-Layer Architecture

```
React Frontend → Laravel Proxy → Python AI Service → ChromaDB
```

Browser never talks to ChromaDB directly — all requests proxy through authenticated Laravel middleware to the Python FastAPI service.

### Components

**Python AI Service** (`ai/app/routers/chroma.py`):
- `GET /chroma/collections` — List all collections with vector counts
- `GET /chroma/collections/{name}/overview` — Sample records, facets, dimension detection, metadata keys
- `POST /chroma/query` — Semantic search with Pydantic-validated input
- Embeddings excluded from overview by default (`?include_embeddings=true` opt-in) to avoid ~1MB payload bloat

**Laravel Proxy** (`backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php`):
- 6 proxy methods with appropriate timeouts (10s–300s)
- Input validation on query endpoint (collectionName required, queryText max 2000, nResults 1-50)
- Consistent error handling extracting `detail` from AI service errors

**React Frontend** (`frontend/src/features/administration/components/ChromaStudioPanel.tsx`):
- 3 tabs: Overview (stats + facets + sample records), Retrieval Inspector (semantic query), Semantic Map (UMAP 2D projection)
- Admin actions: Ingest Docs, Ingest Clinical, Promote FAQ (data-driven button loop)
- Lazy embedding loading — embeddings only fetched when Semantic Map tab is activated
- UMAP projection via dynamic import of `umap-js` with circular fallback
- Dark clinical theme palette matching Parthenon design system

**Integration** (`frontend/src/features/administration/pages/ServiceDetailPage.tsx`):
- ChromaStudioPanel mounts conditionally when service key is `chromadb`
- Same pattern as existing Orthanc PACS and Solr panels

### Additional Fixes

- **Spatie guard mismatch**: Added `$guard_name = 'web'` to User model (Sanctum auth resolves `sanctum` guard but roles exist under `web`)
- **Admin user show 500**: Replaced broken `.append(['all_permissions'])` accessor with explicit `$user->getAllPermissions()->pluck('name')`
- **Demo site access**: All registered users now auto-assigned `super-admin` role
- **numpy truthiness bug**: Fixed `ValueError` in Python embedding serialization using `hasattr(raw_emb, "tolist")`

## Code Review Findings Addressed

- **CRITICAL**: Stripped embeddings from default overview response (opt-in via query param) — saves ~1MB per request
- **HIGH**: Refactored 3 copy-paste action buttons to data-driven `ADMIN_ACTIONS` constant loop
- **MEDIUM**: Standardized error handling across all ChromaStudioController methods
- **MEDIUM**: Removed unused lucide icon imports

## Verified

- 4 collections visible in UI (docs: 43,638 vectors, clinical_reference, faq_shared, conversations)
- Semantic query returns results in ~135ms
- UMAP projection renders correctly with metadata-based coloring
- All admin actions (ingest, promote) functional end-to-end

## Dependencies Added

- `umap-js` (frontend, dynamically imported)
