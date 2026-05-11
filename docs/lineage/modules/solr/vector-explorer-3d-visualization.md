# Vector Explorer — 3D Embedding Visualization for Chroma Studio

**Date:** 2026-03-12
**Branch:** main
**Commits:** 6 (db01e256 → c769b346)

## What Was Built

Replaced the 2D SVG scatter plot in Chroma Studio's Semantic Map tab with a full 3D WebGL point cloud visualization powered by Three.js and a server-side PCA→UMAP projection pipeline.

### Backend — Projection Pipeline

- **`ai/app/services/projection.py`** — PCA→UMAP dimensionality reduction (768d → 50d → 3d), auto-k K-means clustering via silhouette score (k=2..10), quality detection (isolation forest outliers at 5% contamination, cosine >0.98 duplicates capped at 100 pairs for n≤5K, 2σ orphans from nearest centroid), deterministic sampling with SHA-256 seeded RNG, in-process TTL cache (10min).
- **`ai/app/routers/chroma.py`** — `POST /collections/{name}/project` endpoint with validation (method=pca-umap, dimensions 2|3, sample_size 0 or 500-100K).
- **`backend/.../ChromaStudioController.php`** — Laravel proxy with 120s timeout, custom sample_size validation.
- **Dependencies:** umap-learn, scikit-learn added to `ai/requirements.txt`.

### Frontend — 12 New Components

All under `frontend/src/features/administration/components/vector-explorer/`:

| Component | Purpose |
|-----------|---------|
| `ThreeScene.tsx` | InstancedMesh point cloud (50K+ in one draw call), per-frame color updates, raycasting hover/click |
| `useVectorExplorer.ts` | State hook: projection loading, AbortController, 500ms debounce, umap-js client fallback |
| `VectorExplorer.tsx` | Main component with compact (300px) and fullscreen CSS-expand modes |
| `ModeSelector.tsx` | Clusters / Query / QA tab bar |
| `SampleSlider.tsx` | Discrete-step selector (1K, 5K, 15K, All) |
| `ColorLegend.tsx` | Dynamic legend per mode with cluster toggle |
| `PointInspector.tsx` | Selected point detail sidebar with quality flags |
| `MetadataColorPicker.tsx` | Dropdown to override color-by metadata field |
| `QualitySummary.tsx` | Toggleable QA layer bar with CSV export |
| `ClusterHulls.tsx` | Phase 2 stub (convex hull meshes) |
| `QueryVisuals.tsx` | Phase 2 stub (query star, similarity lines) |
| `constants.ts` | Color palette, scene tokens, sample steps, mode types |

### Integration

- Old `MapSection`, `ScatterPlot`, `useUmapProjection` removed from `ChromaStudioPanel.tsx`
- `VectorExplorer` wired in with `collectionName` and `overview` props
- Old `ProjectionPoint` type replaced by `ProjectedPoint3D` (includes cluster_id, z coordinate)

## Architecture Decisions

1. **Server-side PCA→UMAP** over client-only: Produces much better 3D projections with consistent clustering. Client-side umap-js kept as degraded fallback (2D, no clusters/QA).
2. **CSS expand over DOM reparent**: Single `<Canvas>` stays mounted, avoids WebGL context loss. Expand is a `fixed inset-0` overlay with `flex-1` scene.
3. **InstancedMesh**: One draw call for entire point cloud. Colors via `InstancedBufferAttribute` created once in `useEffect`, only `needsUpdate` set per frame.
4. **Cluster IDs from server**: `pairwise_distances_argmin` assigns cluster_id in projection service, sent with each point. Frontend uses it directly (no re-clustering).

## Known Limitations (MVP-Accepted)

- Full collection embeddings loaded into memory before sampling (~130MB for 43K×768). Phase 2: paginated fetch.
- Cosine similarity duplicate detection is O(n²), gated at n≤5000.
- Projection runs synchronously in async handler (blocks event loop). Acceptable for single-admin tool.
- No thread-safe cache (single-worker uvicorn in Docker).

## Phase 2 (Deferred)

- ClusterHulls: ConvexGeometry translucent meshes, centroid labels, re-cluster slider
- QueryVisuals: Weighted 5-NN query projection, pulsing star, similarity lines/rings
- Shared query state from SearchSection to auto-switch to Query mode

## Dependencies Added

- `three`, `@react-three/fiber`, `@react-three/drei`, `three-stdlib` (WebGL rendering)
- `umap-js` (client-side fallback)
- `@types/three` (dev)
- `umap-learn>=0.5.0`, `scikit-learn>=1.5.0` (Python)

## Gotchas

- Docker node container has its own `node_modules` — must run `npm install` inside container after host install
- `frontend/dist` owned by Docker user — can't delete from host without sudo; build via `docker compose exec node`
- Three.js `InstancedBufferAttribute` must be created in `useEffect` (not `useFrame`) to avoid per-frame allocation
