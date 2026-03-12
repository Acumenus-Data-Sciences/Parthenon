# Vector Explorer — 3D Embedding Visualization for Chroma Studio

**Date:** 2026-03-12
**Status:** Final
**Scope:** Full-featured 3D vector embedding visualization with cluster discovery, retrieval debugging, and data quality inspection

---

## 1. Overview

Vector Explorer is a 3D WebGL visualization tool embedded in Parthenon's Chroma Studio. It replaces the current 2D SVG scatter plot with an interactive Three.js scene that supports three modes: cluster discovery, retrieval debugging, and data quality inspection.

The feature uses a compact-plus-expand integration pattern: a small 3D preview lives in the existing Semantic Map tab, and an expand button opens a full-screen overlay with all controls and modes.

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | All three modes (clusters, query, QA) | Researchers need cluster exploration, retrieval debugging, and data quality in one tool |
| Integration | Compact + Expand | Preview without leaving the panel; full immersion when needed; no new routes |
| Dimensionality reduction | Hybrid server/client | Server-side PCA→UMAP for quality at scale; client-side umap-js fallback when AI service is down |
| Point budget | User-controlled slider (1K–All, default 5K) | Simplest to implement; puts researchers in control; avoids premature optimization |
| Color encoding | Mode defaults + metadata field override | Each mode gets a meaningful default; researchers can switch to any metadata field for custom slicing |

## 3. Component Architecture

```
ChromaStudioPanel (existing)
  └─ MapSection (existing, currently SVG)
       └─ VectorExplorer (NEW — replaces ScatterPlot)
            ├─ CompactView
            │    └─ Three.js canvas (~300px), orbit controls, expand button
            ├─ ExpandedOverlay (full-screen portal)
            │    ├─ ThreeScene — shared scene/camera/renderer
            │    ├─ ModeSelector — tabs: Clusters | Query | QA
            │    ├─ ColorLegend — dynamic legend based on active mode + override
            │    ├─ PointInspector — sidebar showing hovered/selected point metadata
            │    ├─ SampleSlider — 1K → 5K → 15K → All range input
            │    └─ MetadataColorPicker — dropdown to override color-by field
            └─ useVectorExplorer (hook) — projection data, sampling, mode state
```

### Key architectural decisions

- **Single `<Canvas>` component** that stays mounted in a fixed-position container. Compact vs. expanded is achieved via CSS (resizing and repositioning the container), not DOM reparenting. This avoids WebGL context loss that occurs when moving a canvas between DOM locations. Camera state is preserved across transitions via a ref.
- **`react-three-fiber`** + **`@react-three/drei`** for declarative React integration with Three.js.
- **`InstancedMesh`** for point rendering — one draw call regardless of point count, handles 50K+ points.
- Compact view: read-only auto-rotating orbit preview. Expanded view: full orbit + pan controls, all mode UI.

## 4. Backend — Projection API

### New endpoint

```
POST /chroma/collections/{name}/project
```

**Request body:**
```json
{
  "sample_size": 5000,
  "method": "pca-umap",
  "dimensions": 3
}
```

**Validation constraints:**
- `sample_size`: integer, min 500, max 100000. Value `0` means "all vectors."
- `method`: enum, only `"pca-umap"` supported initially (extensible for future methods)
- `dimensions`: enum, `2` or `3` (default `3`)

**Response:**
```json
{
  "points": [
    { "id": "doc_42", "x": 1.23, "y": -0.45, "z": 0.78, "metadata": { "source": "clinical_notes", "category": "cardiology" } }
  ],
  "clusters": [
    { "id": 0, "label": "Clinical Notes", "centroid": [1.1, -0.3, 0.5], "size": 842 }
  ],
  "quality": {
    "outlier_ids": ["doc_99", "doc_1204"],
    "duplicate_pairs": [["doc_12", "doc_13"], ["doc_500", "doc_501"]],
    "orphan_ids": ["doc_7777"]
  },
  "stats": {
    "total_vectors": 43649,
    "sampled": 5000,
    "projection_time_ms": 1240
  }
}
```

### Pipeline steps

1. **Fetch embeddings** from ChromaDB (up to `sample_size`, stratified by cluster if clusters exist)
2. **PCA → 50 dimensions** (sklearn, fast deterministic reduction)
3. **UMAP → 3 dimensions** (umap-learn, preserves non-linear structure)
4. **K-means clustering** with auto-k via silhouette score (capped at 20 clusters)
5. **Quality detection:**
   - Outliers: isolation forest
   - Duplicates: cosine similarity > 0.98
   - Orphans: points farther than 2σ from nearest cluster centroid
6. **Sampling** uses a seeded random with `seed = hash(collection_name + total_count)` for deterministic results across repeated requests with the same parameters
7. **Cache** result keyed on `collection_name + sample_size + total_count`, TTL 10 minutes. Deterministic sampling ensures cache hits on repeated requests

### Client-side fallback

If the AI service is unavailable, `useVectorExplorer` falls back to client-side `umap-js` (already installed as an existing dependency):
- 2D UMAP output with synthetic Z axis derived from local density estimation
- No clustering or quality analysis in fallback mode — scatter only
- Mode tabs (Clusters, Query, QA) are visible but disabled with tooltip: "Requires AI service connection"
- Only the default scatter view is available in fallback
- Fallback triggers automatically on fetch error, no user action needed

### Laravel proxy

One new method `projectCollection()` in `ChromaStudioController.php`, forwarding to the Python endpoint with a 120-second timeout (matching `ingestDocs` pattern — UMAP on large collections can take 60–90 seconds). Laravel validation rules: `sample_size` integer 500–100000 or 0, `method` in `[pca-umap]`, `dimensions` in `[2, 3]`.

## 5. Three.js Rendering

### Point cloud

- `InstancedMesh` with `SphereGeometry(0.02, 8, 8)` — single draw call for all points
- Color via per-instance attribute buffer, updated when mode or color field changes
- Selected/hovered points scale to 1.3× base size

### Camera and controls

| View | Auto-rotate | Pan | Orbit | Zoom |
|------|-------------|-----|-------|------|
| Compact | Yes (dampened) | No | Yes | Yes |
| Expanded | No | Yes | Yes | Yes |

- Smooth camera lerp (300ms) when transitioning between compact and expanded views

### Interaction

- **Raycasting** via `@react-three/fiber` pointer events on InstancedMesh
- **Hover:** highlight point + tooltip showing ID and top metadata fields
- **Click:** select point, populate PointInspector sidebar
- **Shift+click:** multi-select for comparison

### Performance targets

| Point count | Target FPS | GPU requirement |
|-------------|-----------|-----------------|
| 5,000 | 60 fps | Integrated |
| 15,000 | 60 fps | Discrete |
| 43,000+ | 30 fps | Discrete (instanced only) |

## 6. Mode Behaviors

### 6.1 Cluster Discovery (default mode)

- Server returns k-means clusters with auto-k (silhouette score)
- **Legend:** cluster labels auto-generated from top metadata terms per cluster (e.g., "Clinical Notes", "Lab Results")
- **Click cluster in legend:** isolate — fade non-members to 10% opacity
- **Hover cluster hull:** show size, average similarity, top terms
- **Re-cluster button:** manual k override slider (2–20)
- **Visual:** translucent convex hull per cluster, cluster labels at centroids
- **Color palette:** categorical, up to 20 distinct colors from Parthenon design system

### 6.2 Retrieval Debug

- Integrates with existing query from SearchSection
- When user runs a query, the query embedding is projected into the 3D scene
- **Query point:** rendered as pulsing star at projected position
- **Top-K results:** highlighted, connected to query point with lines (opacity = similarity score)
- **Non-results:** fade to 15% opacity
- **Color gradient:** similarity score — teal (1.0) → gold (0.5) → crimson (0.0)
- **Similarity rings:** at 0.25 intervals around query point
- **No query state:** shows prompt "Run a query in the Search tab first"

### 6.3 Data Quality Inspection

- Server returns outlier/duplicate/orphan classifications
- **Three toggleable layers:**
  - Outliers (red) — isolation forest anomalies
  - Duplicates (orange) — cosine > 0.98, connected with thin lines
  - Orphans (gray) — far from any cluster centroid
- **Summary bar:** "12 outliers, 8 duplicate pairs, 23 orphans out of 5,000 sampled"
- **Click flagged point:** PointInspector shows reason (distance score, cosine similarity to duplicate, etc.)
- **Export flagged:** downloads CSV of flagged point IDs + reasons

### Color override (all modes)

A dropdown in the expanded view lets the user switch color encoding to any metadata field (e.g., `source`, `category`, `document_type`). Automatic palette assignment per unique value. Overrides the mode default until the user switches modes or resets.

## 7. State Management

### TypeScript types (added to `chromaStudioApi.ts`)

```typescript
/** Extends existing ProjectionPoint with z coordinate */
interface ProjectedPoint3D {
  id: string;
  x: number;
  y: number;
  z: number;
  metadata: Record<string, unknown>;
}

interface Cluster {
  id: number;
  label: string;
  centroid: [number, number, number];
  size: number;
}

interface QualityReport {
  outlier_ids: string[];
  duplicate_pairs: [string, string][];
  orphan_ids: string[];
}

interface ProjectionStats {
  total_vectors: number;
  sampled: number;
  projection_time_ms: number;
}

interface ProjectionResponse {
  points: ProjectedPoint3D[];
  clusters: Cluster[];
  quality: QualityReport;
  stats: ProjectionStats;
}

interface ProjectionRequest {
  sample_size: number;  // 500-100000, or 0 for all
  method: 'pca-umap';
  dimensions: 2 | 3;
}
```

### `useVectorExplorer` hook state

```typescript
interface VectorExplorerState {
  projectionData: {
    points: ProjectedPoint3D[];
    clusters: Cluster[];
    quality: QualityReport;
    stats: ProjectionStats;
  } | null;
  activeMode: 'clusters' | 'query' | 'qa';
  sampleSize: number;           // default 5000
  colorField: string | null;    // null = use mode default
  selectedPoints: Set<string>;
  hoveredPoint: string | null;
  isExpanded: boolean;
  isLoading: boolean;
  clusterVisibility: Map<number, boolean>;
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
}
```

### Data flow

1. User switches to Semantic Map tab → compact view renders with last projection or triggers first load
2. `useVectorExplorer` calls `POST /project` with current collection + sample size
3. Response stored in state; Three.js scene updates via instance attribute buffers
4. **Mode switch** → no re-fetch; recolors from existing data (clusters/quality already in response)
5. **Sample size change** → debounced re-fetch (500ms after slider stops; abort any in-flight projection request via AbortController before issuing new one)
6. **Color field override** → client-side recolor from point metadata (no fetch)
7. **Query in SearchSection** → query embedding passed via shared state, projected client-side using weighted k-nearest-neighbor interpolation: find the 5 nearest sampled points by cosine similarity to the query embedding, then compute the query's 3D position as the similarity-weighted average of those 5 points' projected coordinates. If the max similarity is below 0.3 (query is far from all sampled points), place the query point at the centroid of the scene with a visual indicator ("query is distant from sampled space")
8. **Expand/collapse** → same scene, camera lerps, controls change

### Shared state with SearchSection

- `lastQueryEmbedding` and `lastQueryResults` lifted to ChromaStudioPanel level
- Passed to both SearchSection and VectorExplorer
- New query auto-activates retrieval debug mode if VectorExplorer is visible

## 8. Dependencies

### Frontend (npm)

| Package | Purpose |
|---------|---------|
| `three` | 3D rendering engine |
| `@types/three` | TypeScript definitions |
| `@react-three/fiber` | React renderer for Three.js |
| `@react-three/drei` | Orbit controls, instanced rendering, HTML overlays |
| `three-stdlib` | ConvexGeometry for cluster hulls (explicit install — `ClusterHulls.tsx` imports directly) |

### Backend (Python)

| Package | Purpose |
|---------|---------|
| `umap-learn` | UMAP dimensionality reduction |
| `scikit-learn` | PCA, k-means, isolation forest, silhouette score |

## 9. File Structure

### New files

```
frontend/src/features/administration/components/vector-explorer/
  ├─ VectorExplorer.tsx          — main component, compact/expanded toggle
  ├─ ThreeScene.tsx              — r3f Canvas, InstancedMesh, raycasting
  ├─ ModeSelector.tsx            — Clusters | Query | QA tabs
  ├─ ColorLegend.tsx             — dynamic legend per mode
  ├─ PointInspector.tsx          — selected point detail sidebar
  ├─ SampleSlider.tsx            — discrete-step slider (1K, 5K, 15K, All where All = 0)
  ├─ MetadataColorPicker.tsx     — dropdown for color field override
  ├─ ClusterHulls.tsx            — translucent convex hull meshes
  ├─ QueryVisuals.tsx            — query star, similarity lines, rings
  ├─ QualitySummary.tsx          — flagged point summary bar + export
  ├─ useVectorExplorer.ts        — projection state, API calls, caching
  └─ constants.ts                — palette, default sizes, thresholds

ai/app/services/projection.py    — PCA→UMAP pipeline, clustering, QA detection
```

### Modified files

| File | Change |
|------|--------|
| `frontend/src/features/administration/components/ChromaStudioPanel.tsx` | Lift query state to panel level; replace ScatterPlot with VectorExplorer in MapSection; remove old `ScatterPlot` component and `useUmapProjection` hook (replaced by `useVectorExplorer`); remove old `ProjectionPoint` type from API file after migration |
| `frontend/src/features/administration/api/chromaStudioApi.ts` | Add `fetchProjection()` API function |
| `ai/app/routers/chroma.py` | Add `POST /collections/{name}/project` endpoint |
| `ai/requirements.txt` | Add `umap-learn`, `scikit-learn` |
| `backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php` | Add `projectCollection()` proxy method |
| `backend/routes/api.php` | Add projection proxy route |

## 10. Design System Compliance

All UI elements follow Parthenon's dark clinical theme:

| Element | Value |
|---------|-------|
| Scene background | `#0A0A0F` |
| Card/panel background | `#151518` |
| Borders | `#232328` |
| Primary text | `#F0EDE8` |
| Muted text | `#8A857D` |
| Cluster palette | Derived from crimson `#9B1B30`, gold `#C9A227`, teal `#2DD4BF`, plus extended palette |
| Similarity gradient | Teal `#2DD4BF` (1.0) → Gold `#C9A227` (0.5) → Crimson `#9B1B30` (0.0) |
| Outlier | `#E85A6B` |
| Duplicate | `#F59E0B` (amber) |
| Orphan | `#5A5650` (muted) |
| Data font | IBM Plex Mono |

## 11. Non-Goals

- Real-time streaming updates (projections are snapshot-based)
- 3D rendering on mobile devices (desktop-only feature)
- Custom UMAP hyperparameter tuning UI (use sensible defaults)
- Persistent projection storage (cache only, recompute on demand)
- Annotation or labeling directly in the 3D view
