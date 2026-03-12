# Vector Explorer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3D WebGL vector embedding visualization tool into Chroma Studio with cluster discovery, retrieval debugging, and data quality inspection modes.

**Architecture:** Server-side PCA→UMAP pipeline (Python FastAPI) produces 3D projections with clustering and quality analysis. React frontend renders via Three.js (react-three-fiber) with compact preview + full-screen expand. Laravel proxies requests with auth.

**Tech Stack:** React 19, TypeScript, Three.js, @react-three/fiber, @react-three/drei, Python FastAPI, scikit-learn, umap-learn, Laravel 11

**Spec:** `docs/superpowers/specs/2026-03-12-vector-explorer-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `ai/app/services/projection.py` | PCA→UMAP pipeline, k-means clustering, quality detection (outliers, duplicates, orphans), caching |
| `frontend/src/features/administration/components/vector-explorer/constants.ts` | Color palette, sample size steps, thresholds, design tokens |
| `frontend/src/features/administration/components/vector-explorer/useVectorExplorer.ts` | Hook: fetch projection, manage mode/sample/color state, debounce, fallback |
| `frontend/src/features/administration/components/vector-explorer/ThreeScene.tsx` | R3F Canvas, InstancedMesh point cloud, raycasting, camera controls |
| `frontend/src/features/administration/components/vector-explorer/VectorExplorer.tsx` | Main component: compact/expanded CSS toggle, composes all sub-components |
| `frontend/src/features/administration/components/vector-explorer/ModeSelector.tsx` | Clusters \| Query \| QA tab bar |
| `frontend/src/features/administration/components/vector-explorer/SampleSlider.tsx` | Discrete-step slider (1K, 5K, 15K, All) |
| `frontend/src/features/administration/components/vector-explorer/ColorLegend.tsx` | Dynamic legend per mode + metadata override |
| `frontend/src/features/administration/components/vector-explorer/PointInspector.tsx` | Selected point detail sidebar |
| `frontend/src/features/administration/components/vector-explorer/MetadataColorPicker.tsx` | Dropdown to override color-by field |
| `frontend/src/features/administration/components/vector-explorer/ClusterHulls.tsx` | Translucent convex hull meshes per cluster |
| `frontend/src/features/administration/components/vector-explorer/QueryVisuals.tsx` | Query star, similarity lines, rings |
| `frontend/src/features/administration/components/vector-explorer/QualitySummary.tsx` | Flagged point summary bar + CSV export |

### Modified files

| File | Change |
|------|--------|
| `ai/requirements.txt` | Add `umap-learn`, `scikit-learn` |
| `ai/app/routers/chroma.py` | Add `POST /collections/{name}/project` endpoint |
| `backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php` | Add `projectCollection()` proxy method |
| `backend/routes/api.php` | Add projection proxy route |
| `frontend/src/features/administration/api/chromaStudioApi.ts` | Add projection types + `fetchProjection()` |
| `frontend/src/features/administration/components/ChromaStudioPanel.tsx` | Lift query state, replace MapSection/ScatterPlot/useUmapProjection with VectorExplorer |

---

## Chunk 1: Backend — Projection Pipeline

### Task 1: Install Python dependencies

**Files:**
- Modify: `ai/requirements.txt`

- [ ] **Step 1: Add umap-learn and scikit-learn to requirements**

Add to `ai/requirements.txt`:
```
umap-learn>=0.5.0
scikit-learn>=1.5.0
```

- [ ] **Step 2: Rebuild AI container**

Run: `docker compose build python-ai && docker compose up -d python-ai`
Expected: Container starts healthy with new packages available

- [ ] **Step 3: Verify imports work**

Run: `docker compose exec python-ai python -c "import umap; import sklearn; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add ai/requirements.txt
git commit -m "chore: add umap-learn and scikit-learn for projection pipeline"
```

---

### Task 2: Projection service module

**Files:**
- Create: `ai/app/services/projection.py`

- [ ] **Step 1: Create the projection service with PCA→UMAP pipeline**

Create `ai/app/services/projection.py`:

```python
"""PCA→UMAP projection pipeline with clustering and quality detection."""
import hashlib
import logging
import time
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
from numpy.typing import NDArray
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.metrics import silhouette_score
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# ── Types ────────────────────────────────────────────────────────────────────

@dataclass
class ProjectedPoint:
    id: str
    x: float
    y: float
    z: float
    metadata: dict
    cluster_id: int = 0


@dataclass
class Cluster:
    id: int
    label: str
    centroid: list[float]
    size: int


@dataclass
class QualityReport:
    outlier_ids: list[str]
    duplicate_pairs: list[tuple[str, str]]
    orphan_ids: list[str]


@dataclass
class ProjectionResult:
    points: list[ProjectedPoint]
    clusters: list[Cluster]
    quality: QualityReport
    stats: dict


# ── Cache ────────────────────────────────────────────────────────────────────

_cache: dict[str, tuple[float, ProjectionResult]] = {}
CACHE_TTL = 600  # 10 minutes


def _cache_key(collection_name: str, sample_size: int, total_count: int) -> str:
    return f"{collection_name}:{sample_size}:{total_count}"


def _get_cached(key: str) -> ProjectionResult | None:
    if key in _cache:
        ts, result = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return result
        del _cache[key]
    return None


# ── Pipeline ─────────────────────────────────────────────────────────────────

def compute_projection(
    ids: list[str],
    embeddings: NDArray[np.float32],
    metadatas: list[dict],
    dimensions: int = 3,
) -> ProjectionResult:
    """Run PCA→UMAP, cluster, and detect quality issues."""
    start = time.time()
    n_samples, n_features = embeddings.shape

    # Step 1: PCA to 50 dims (or less if features < 50)
    pca_dims = min(50, n_features, n_samples)
    pca = PCA(n_components=pca_dims)
    reduced = pca.fit_transform(embeddings)

    # Step 2: UMAP to target dimensions
    import umap  # lazy import — heavy module

    n_neighbors = min(15, n_samples - 1)
    reducer = umap.UMAP(
        n_components=dimensions,
        n_neighbors=n_neighbors,
        min_dist=0.1,
        metric="cosine",
        random_state=42,
    )
    projected = reducer.fit_transform(reduced)

    # Step 3: K-means clustering with auto-k
    clusters = _compute_clusters(projected, ids, metadatas)

    # Step 4: Quality detection
    quality = _detect_quality_issues(embeddings, projected, ids, clusters)

    # Assign cluster IDs to points
    if clusters:
        from sklearn.metrics import pairwise_distances_argmin
        centroids_arr = np.array([c.centroid for c in clusters])
        cluster_labels = pairwise_distances_argmin(projected, centroids_arr)
    else:
        cluster_labels = np.zeros(n_samples, dtype=int)

    # Build points
    points = [
        ProjectedPoint(
            id=ids[i],
            x=float(projected[i, 0]),
            y=float(projected[i, 1]),
            z=float(projected[i, 2]) if dimensions == 3 else 0.0,
            metadata=metadatas[i] if i < len(metadatas) else {},
            cluster_id=int(cluster_labels[i]),
        )
        for i in range(n_samples)
    ]

    elapsed = round((time.time() - start) * 1000)
    return ProjectionResult(
        points=points,
        clusters=clusters,
        quality=quality,
        stats={
            "total_vectors": n_samples,
            "sampled": n_samples,
            "projection_time_ms": elapsed,
        },
    )


def _compute_clusters(
    projected: NDArray, ids: list[str], metadatas: list[dict]
) -> list[Cluster]:
    """K-means with auto-k via silhouette score, capped at 20."""
    n = len(ids)
    if n < 4:
        return []

    max_k = min(20, n - 1)
    best_k = 2
    best_score = -1.0

    for k in range(2, min(max_k + 1, 11)):  # test 2..10 for speed
        km = KMeans(n_clusters=k, random_state=42, n_init=5, max_iter=100)
        labels = km.fit_predict(projected)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(projected, labels, sample_size=min(2000, n))
        if score > best_score:
            best_score = score
            best_k = k

    # Final fit with best k
    km = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    labels = km.fit_predict(projected)

    clusters = []
    for cid in range(best_k):
        mask = labels == cid
        cluster_metas = [metadatas[i] for i in range(n) if mask[i]]
        label = _generate_cluster_label(cluster_metas)
        centroid = km.cluster_centers_[cid].tolist()
        clusters.append(Cluster(
            id=cid,
            label=label,
            centroid=centroid,
            size=int(mask.sum()),
        ))

    return clusters


def _generate_cluster_label(metadatas: list[dict]) -> str:
    """Auto-label from most common metadata value across all fields."""
    from collections import Counter
    counter: Counter[str] = Counter()
    for meta in metadatas:
        for v in meta.values():
            if isinstance(v, str) and len(v) < 50:
                counter[v] += 1
    if counter:
        label, _ = counter.most_common(1)[0]
        return label
    return "Unknown"


def _detect_quality_issues(
    embeddings: NDArray,
    projected: NDArray,
    ids: list[str],
    clusters: list[Cluster],
) -> QualityReport:
    """Detect outliers, duplicates, and orphans."""
    n = len(ids)

    # Outliers via isolation forest
    outlier_ids: list[str] = []
    if n >= 10:
        iso = IsolationForest(contamination=0.05, random_state=42)
        preds = iso.fit_predict(projected)
        outlier_ids = [ids[i] for i in range(n) if preds[i] == -1]

    # Duplicates via cosine similarity > 0.98
    duplicate_pairs: list[tuple[str, str]] = []
    # Only check pairwise for small-ish sets to avoid O(n^2) blowup
    if n <= 5000:
        sim_matrix = cosine_similarity(embeddings)
        np.fill_diagonal(sim_matrix, 0)
        seen: set[tuple[str, str]] = set()
        dup_indices = np.argwhere(sim_matrix > 0.98)
        for i, j in dup_indices:
            if i < j:
                pair = (ids[i], ids[j])
                if pair not in seen:
                    seen.add(pair)
                    duplicate_pairs.append(pair)
                    if len(duplicate_pairs) >= 100:  # cap for sanity
                        break

    # Orphans: points > 2σ from nearest cluster centroid
    orphan_ids: list[str] = []
    if clusters:
        centroids = np.array([c.centroid for c in clusters])
        distances = np.min(
            np.linalg.norm(projected[:, None] - centroids[None, :], axis=2),
            axis=1,
        )
        threshold = np.mean(distances) + 2 * np.std(distances)
        orphan_ids = [ids[i] for i in range(n) if distances[i] > threshold]

    return QualityReport(
        outlier_ids=outlier_ids,
        duplicate_pairs=duplicate_pairs,
        orphan_ids=orphan_ids,
    )


def sample_deterministic(
    total_ids: list[str], sample_size: int, collection_name: str, total_count: int
) -> list[int]:
    """Return deterministic sample indices using seeded random."""
    if sample_size == 0 or sample_size >= len(total_ids):
        return list(range(len(total_ids)))
    seed_str = f"{collection_name}:{total_count}"
    seed = int(hashlib.sha256(seed_str.encode()).hexdigest()[:8], 16)
    rng = np.random.RandomState(seed)
    return sorted(rng.choice(len(total_ids), size=sample_size, replace=False).tolist())
```

- [ ] **Step 2: Verify module imports**

Run: `docker compose exec python-ai python -c "from app.services.projection import compute_projection; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add ai/app/services/projection.py
git commit -m "feat: add PCA→UMAP projection service with clustering and quality detection"
```

---

### Task 3: FastAPI projection endpoint

**Files:**
- Modify: `ai/app/routers/chroma.py`

- [ ] **Step 1: Add Pydantic model and endpoint to chroma.py**

Add at the bottom of `ai/app/routers/chroma.py`, after the existing `query_collection` endpoint:

```python
class ProjectionInput(BaseModel):
    sample_size: int = 5000
    method: str = "pca-umap"
    dimensions: int = 3


@router.post("/collections/{name}/project")
async def project_collection(name: str, body: ProjectionInput) -> dict:
    """Compute 3D projection with clustering and quality analysis."""
    if body.method != "pca-umap":
        raise HTTPException(status_code=400, detail="Only 'pca-umap' method is supported.")
    if body.dimensions not in (2, 3):
        raise HTTPException(status_code=400, detail="Dimensions must be 2 or 3.")
    if body.sample_size != 0 and (body.sample_size < 500 or body.sample_size > 100000):
        raise HTTPException(status_code=400, detail="sample_size must be 0 (all) or 500-100000.")

    from app.services.projection import (
        ProjectionResult,
        _cache_key,
        _get_cached,
        _cache,
        compute_projection,
        sample_deterministic,
    )
    import numpy as np

    client = get_chroma_client()
    try:
        col = client.get_collection(name=name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Collection '{name}' not found.")

    total_count = col.count()
    if total_count == 0:
        raise HTTPException(status_code=400, detail="Collection is empty.")

    # Check cache
    cache_key = _cache_key(name, body.sample_size, total_count)
    cached = _get_cached(cache_key)
    if cached is not None:
        return _result_to_dict(cached)

    # Fetch all embeddings for sampling. Note: for a 43K×768 collection this is
    # ~130MB in memory. Acceptable for MVP; Phase 2 could use ChromaDB's offset/limit
    # to fetch only sampled IDs if memory becomes a concern.
    all_data = col.get(limit=total_count, include=["embeddings", "metadatas"])
    all_ids = all_data.get("ids", [])
    all_embeddings = all_data.get("embeddings")
    all_metadatas = all_data.get("metadatas") or [{}] * len(all_ids)

    if all_embeddings is None or len(all_embeddings) == 0:
        raise HTTPException(status_code=400, detail="Collection has no embeddings.")

    # Sample deterministically
    indices = sample_deterministic(all_ids, body.sample_size, name, total_count)

    ids = [all_ids[i] for i in indices]
    raw_embeddings = [all_embeddings[i] for i in indices]
    metadatas = [all_metadatas[i] or {} for i in indices]

    embeddings_array = np.array(
        [e.tolist() if hasattr(e, "tolist") else e for e in raw_embeddings],
        dtype=np.float32,
    )

    if len(ids) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 vectors for projection.")

    result = compute_projection(ids, embeddings_array, metadatas, body.dimensions)

    # Update stats with total
    result.stats["total_vectors"] = total_count
    result.stats["sampled"] = len(ids)

    # Cache
    import time as _time
    _cache[cache_key] = (_time.time(), result)

    return _result_to_dict(result)


def _result_to_dict(result) -> dict:
    """Convert ProjectionResult dataclass to JSON-safe dict."""
    return {
        "points": [
            {"id": p.id, "x": p.x, "y": p.y, "z": p.z, "metadata": p.metadata, "cluster_id": p.cluster_id}
            for p in result.points
        ],
        "clusters": [
            {"id": c.id, "label": c.label, "centroid": c.centroid, "size": c.size}
            for c in result.clusters
        ],
        "quality": {
            "outlier_ids": result.quality.outlier_ids,
            "duplicate_pairs": [list(p) for p in result.quality.duplicate_pairs],
            "orphan_ids": result.quality.orphan_ids,
        },
        "stats": result.stats,
    }
```

Also add `import numpy as np` to the top of the file if not already present (numpy is already a dependency).

- [ ] **Step 2: Verify endpoint loads**

Run: `docker compose restart python-ai && sleep 3 && docker compose exec python-ai curl -s http://localhost:8000/chroma/health | python -m json.tool`
Expected: `{"status": "ok", ...}`

- [ ] **Step 3: Commit**

```bash
git add ai/app/routers/chroma.py
git commit -m "feat: add POST /collections/{name}/project endpoint for 3D projection"
```

---

### Task 4: Laravel proxy method and route

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add projectCollection method to ChromaStudioController**

Add to `ChromaStudioController.php`, after the `promoteFaq` method (before the closing `}`):

```php
/** Compute 3D projection for a collection's embeddings. */
public function projectCollection(Request $request, string $name): JsonResponse
{
    $sampleSize = $request->integer('sample_size', 5000);

    // sample_size must be 0 (all) or 500-100000
    if ($sampleSize !== 0 && ($sampleSize < 500 || $sampleSize > 100000)) {
        return response()->json(
            ['error' => 'sample_size must be 0 (all) or between 500 and 100000.'],
            422,
        );
    }

    $validated = $request->validate([
        'method' => 'required|string|in:pca-umap',
        'dimensions' => 'required|integer|in:2,3',
    ]);
    $validated['sample_size'] = $sampleSize;

    $response = Http::timeout(120)
        ->post("{$this->aiUrl()}/chroma/collections/{$name}/project", $validated);

    if (! $response->successful()) {
        return response()->json(
            ['error' => $response->json('detail') ?? 'Projection failed.'],
            $response->status() ?: 502,
        );
    }

    return response()->json($response->json());
}
```

- [ ] **Step 2: Add route in api.php**

Add inside the `chroma-studio` route group in `backend/routes/api.php`, after the `promote-faq` route:

```php
Route::post('/collections/{name}/project', [ChromaStudioController::class, 'projectCollection']);
```

- [ ] **Step 3: Verify route is registered**

Run: `docker compose exec php php artisan route:list --path=chroma-studio`
Expected: Shows the new `POST chroma-studio/collections/{name}/project` route

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Admin/ChromaStudioController.php backend/routes/api.php
git commit -m "feat: add Laravel proxy for collection projection endpoint"
```

---

## Chunk 2: Frontend — Dependencies, Types, and Constants

### Task 5: Install frontend dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install Three.js packages**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npm install --legacy-peer-deps three @react-three/fiber @react-three/drei three-stdlib && npm install --legacy-peer-deps -D @types/three`

Expected: Packages install successfully

- [ ] **Step 2: Verify TypeScript can resolve the packages**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --moduleResolution node16 2>&1 | head -20`
Expected: No errors related to three.js packages (existing errors OK)

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add three.js, react-three-fiber, drei, three-stdlib dependencies"
```

---

### Task 6: Add projection types and API function

**Files:**
- Modify: `frontend/src/features/administration/api/chromaStudioApi.ts`

- [ ] **Step 1: Add TypeScript types for projection**

Add after the existing `IngestResult` interface (before `// ── API Functions`):

```typescript
// ── Projection Types ────────────────────────────────────────────────────────

export interface ProjectedPoint3D {
  id: string;
  x: number;
  y: number;
  z: number;
  metadata: Record<string, unknown>;
  cluster_id: number;
}

export interface ClusterInfo {
  id: number;
  label: string;
  centroid: [number, number, number];
  size: number;
}

export interface QualityReport {
  outlier_ids: string[];
  duplicate_pairs: [string, string][];
  orphan_ids: string[];
}

export interface ProjectionStats {
  total_vectors: number;
  sampled: number;
  projection_time_ms: number;
}

export interface ProjectionResponse {
  points: ProjectedPoint3D[];
  clusters: ClusterInfo[];
  quality: QualityReport;
  stats: ProjectionStats;
}

export interface ProjectionRequest {
  sample_size: number;
  method: "pca-umap";
  dimensions: 2 | 3;
}
```

- [ ] **Step 2: Add fetchProjection API function**

Add after the existing `promoteFaq` function:

```typescript
export const fetchProjection = (name: string, request: ProjectionRequest, signal?: AbortSignal) =>
  apiClient
    .post<ProjectionResponse>(`/admin/chroma-studio/collections/${encodeURIComponent(name)}/project`, request, {
      signal,
      timeout: 130_000, // 130s client timeout (server is 120s)
    })
    .then((r) => r.data);
```

- [ ] **Step 3: Verify types compile**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | tail -5`
Expected: Clean compile (or only pre-existing errors)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/administration/api/chromaStudioApi.ts
git commit -m "feat: add projection types and fetchProjection API function"
```

---

### Task 7: Constants file

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/constants.ts`

- [ ] **Step 1: Create constants file**

```typescript
/** Design tokens and configuration for Vector Explorer. */

// ── Color Palette ───────────────────────────────────────────────────────────

/** Categorical palette for clusters (up to 20 colors). */
export const CLUSTER_PALETTE = [
  "#2DD4BF", // teal
  "#C9A227", // gold
  "#9B1B30", // crimson
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
  "#fb923c", // orange
  "#4ade80", // green
  "#e879f9", // fuchsia
  "#38bdf8", // sky
  "#fbbf24", // amber
  "#34d399", // emerald
  "#f87171", // red
  "#818cf8", // indigo
  "#22d3ee", // cyan
  "#a3e635", // lime
  "#e2e8f0", // slate
  "#fda4af", // rose
  "#93c5fd", // light blue
  "#d8b4fe", // light purple
] as const;

/** Quality mode colors. */
export const QUALITY_COLORS = {
  normal: "#4ade80",
  outlier: "#E85A6B",
  duplicate: "#F59E0B",
  orphan: "#5A5650",
} as const;

/** Similarity gradient stops (teal → gold → crimson). */
export const SIMILARITY_GRADIENT = {
  high: "#2DD4BF",   // 1.0
  mid: "#C9A227",    // 0.5
  low: "#9B1B30",    // 0.0
} as const;

// ── Scene ───────────────────────────────────────────────────────────────────

export const SCENE_BG = "#0A0A0F";
export const POINT_RADIUS = 0.02;
export const POINT_SEGMENTS = 8;
export const HOVER_SCALE = 1.3;
export const CAMERA_LERP_DURATION = 300; // ms

// ── Sample Sizes ────────────────────────────────────────────────────────────

export const SAMPLE_STEPS = [
  { label: "1K", value: 1000 },
  { label: "5K", value: 5000 },
  { label: "15K", value: 15000 },
  { label: "All", value: 0 },
] as const;

export const DEFAULT_SAMPLE_SIZE = 5000;
export const DEBOUNCE_MS = 500;

// ── Modes ───────────────────────────────────────────────────────────────────

export type ExplorerMode = "clusters" | "query" | "qa";

export const MODE_LABELS: Record<ExplorerMode, string> = {
  clusters: "Clusters",
  query: "Query",
  qa: "QA",
};

// ── Query Projection ────────────────────────────────────────────────────────

export const KNN_NEIGHBORS = 5;
export const KNN_MIN_SIMILARITY = 0.3;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/constants.ts
git commit -m "feat: add Vector Explorer constants and design tokens"
```

---

## Chunk 3: Frontend — Core Hook and 3D Scene

### Task 8: useVectorExplorer hook

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/useVectorExplorer.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import { fetchProjection } from "../../api/chromaStudioApi";
import type { ProjectionResponse, ProjectedPoint3D, ClusterInfo, QualityReport } from "../../api/chromaStudioApi";
import { DEFAULT_SAMPLE_SIZE, DEBOUNCE_MS, type ExplorerMode } from "./constants";

export interface VectorExplorerState {
  projectionData: ProjectionResponse | null;
  activeMode: ExplorerMode;
  sampleSize: number;
  colorField: string | null;
  selectedPoints: Set<string>;
  hoveredPoint: string | null;
  isExpanded: boolean;
  isLoading: boolean;
  isFallback: boolean;
  clusterVisibility: Map<number, boolean>;
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
  error: string | null;
}

export function useVectorExplorer(collectionName: string | null) {
  const [state, setState] = useState<VectorExplorerState>({
    projectionData: null,
    activeMode: "clusters",
    sampleSize: DEFAULT_SAMPLE_SIZE,
    colorField: null,
    selectedPoints: new Set(),
    hoveredPoint: null,
    isExpanded: false,
    isLoading: false,
    isFallback: false,
    clusterVisibility: new Map(),
    qaLayers: { outliers: true, duplicates: true, orphans: true },
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProjection = useCallback(
    async (sampleSize: number) => {
      if (!collectionName) return;

      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((s) => ({ ...s, isLoading: true, error: null, isFallback: false }));

      try {
        const data = await fetchProjection(
          collectionName,
          { sample_size: sampleSize, method: "pca-umap", dimensions: 3 },
          controller.signal,
        );

        if (controller.signal.aborted) return;

        // Initialize cluster visibility
        const visibility = new Map<number, boolean>();
        for (const c of data.clusters) {
          visibility.set(c.id, true);
        }

        setState((s) => ({
          ...s,
          projectionData: data,
          isLoading: false,
          clusterVisibility: visibility,
        }));
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        // Client-side fallback using umap-js
        try {
          const { fetchCollectionOverview } = await import("../../api/chromaStudioApi");
          const overview = await fetchCollectionOverview(collectionName!, true);
          const records = overview.sampleRecords.filter(
            (r) => Array.isArray(r.embedding) && r.embedding.length > 1,
          );
          if (records.length >= 3) {
            const { UMAP } = await import("umap-js");
            const umap = new UMAP({
              nNeighbors: Math.min(12, records.length - 1),
              minDist: 0.18,
              nComponents: 2,
            });
            const proj = umap.fit(records.map((r) => r.embedding!));
            const fallbackPoints = proj.map((coords: number[], i: number) => ({
              id: records[i].id,
              x: coords[0],
              y: coords[1],
              z: 0, // synthetic Z = 0 in fallback
              metadata: records[i].metadata ?? {},
            }));
            setState((s) => ({
              ...s,
              projectionData: {
                points: fallbackPoints,
                clusters: [],
                quality: { outlier_ids: [], duplicate_pairs: [], orphan_ids: [] },
                stats: { total_vectors: overview.count, sampled: records.length, projection_time_ms: 0 },
              },
              isLoading: false,
              isFallback: true,
              error: "AI service unavailable. Showing basic 2D scatter (no clusters/QA).",
            }));
            return;
          }
        } catch {
          // fallback also failed
        }
        setState((s) => ({
          ...s,
          isLoading: false,
          isFallback: true,
          error: "AI service unavailable. Could not load fallback view.",
        }));
      }
    },
    [collectionName],
  );

  // Initial load when collection changes
  useEffect(() => {
    if (collectionName) {
      loadProjection(state.sampleSize);
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [collectionName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced sample size change
  const setSampleSize = useCallback(
    (size: number) => {
      setState((s) => ({ ...s, sampleSize: size }));
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadProjection(size), DEBOUNCE_MS);
    },
    [loadProjection],
  );

  const setMode = useCallback((mode: ExplorerMode) => {
    setState((s) => ({ ...s, activeMode: mode, colorField: null }));
  }, []);

  const setColorField = useCallback((field: string | null) => {
    setState((s) => ({ ...s, colorField: field }));
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    setState((s) => ({ ...s, isExpanded: expanded }));
  }, []);

  const selectPoint = useCallback((id: string, multi = false) => {
    setState((s) => {
      const next = new Set(multi ? s.selectedPoints : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...s, selectedPoints: next };
    });
  }, []);

  const setHoveredPoint = useCallback((id: string | null) => {
    setState((s) => ({ ...s, hoveredPoint: id }));
  }, []);

  const toggleCluster = useCallback((clusterId: number) => {
    setState((s) => {
      const next = new Map(s.clusterVisibility);
      next.set(clusterId, !next.get(clusterId));
      return { ...s, clusterVisibility: next };
    });
  }, []);

  const toggleQaLayer = useCallback((layer: "outliers" | "duplicates" | "orphans") => {
    setState((s) => ({
      ...s,
      qaLayers: { ...s.qaLayers, [layer]: !s.qaLayers[layer] },
    }));
  }, []);

  const refresh = useCallback(() => {
    loadProjection(state.sampleSize);
  }, [loadProjection, state.sampleSize]);

  return {
    ...state,
    setSampleSize,
    setMode,
    setColorField,
    setExpanded,
    selectPoint,
    setHoveredPoint,
    toggleCluster,
    toggleQaLayer,
    refresh,
  };
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | grep -i "vector-explorer" | head -10`
Expected: No errors from vector-explorer files

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/useVectorExplorer.ts
git commit -m "feat: add useVectorExplorer hook with projection loading, debounce, and fallback"
```

---

### Task 9: ThreeScene component

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/ThreeScene.tsx`

- [ ] **Step 1: Create the 3D scene component**

```tsx
import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ProjectedPoint3D, ClusterInfo } from "../../api/chromaStudioApi";
import {
  SCENE_BG,
  POINT_RADIUS,
  POINT_SEGMENTS,
  HOVER_SCALE,
  CLUSTER_PALETTE,
  QUALITY_COLORS,
  SIMILARITY_GRADIENT,
  type ExplorerMode,
} from "./constants";

interface ThreeSceneProps {
  points: ProjectedPoint3D[];
  clusters: ClusterInfo[];
  activeMode: ExplorerMode;
  colorField: string | null;
  hoveredPoint: string | null;
  selectedPoints: Set<string>;
  clusterVisibility: Map<number, boolean>;
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
  outlierIds: Set<string>;
  duplicateIds: Set<string>;
  orphanIds: Set<string>;
  isExpanded: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string, multi: boolean) => void;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

function PointCloud({
  points,
  clusters,
  activeMode,
  colorField,
  hoveredPoint,
  selectedPoints,
  clusterVisibility,
  qaLayers,
  outlierIds,
  duplicateIds,
  orphanIds,
  onHover,
  onSelect,
}: Omit<ThreeSceneProps, "isExpanded">) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorArray = useMemo(() => new Float32Array(points.length * 3), [points.length]);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);

  // Create color attribute once, recreate only when point count changes
  useEffect(() => {
    if (!meshRef.current) return;
    const attr = new THREE.InstancedBufferAttribute(colorArray, 3);
    meshRef.current.geometry.setAttribute("color", attr);
    colorAttrRef.current = attr;
  }, [colorArray]);

  // Update instance matrices and colors each frame
  useFrame(() => {
    if (!meshRef.current || !colorAttrRef.current) return;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const isHovered = hoveredPoint === p.id;
      const isSelected = selectedPoints.has(p.id);
      const scale = isHovered || isSelected ? HOVER_SCALE : 1;

      tempObject.position.set(p.x, p.y, p.z);
      tempObject.scale.setScalar(scale);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);

      // Color based on mode — uses cluster_id from server (not recomputed)
      let color = "#5A5650";

      if (activeMode === "clusters") {
        const visible = clusterVisibility.get(p.cluster_id) ?? true;
        color = CLUSTER_PALETTE[p.cluster_id % CLUSTER_PALETTE.length];
        if (!visible) color = "#1a1a1f"; // near-black for hidden clusters (visual approximation of 10% opacity)
      } else if (activeMode === "qa") {
        if (outlierIds.has(p.id) && qaLayers.outliers) {
          color = QUALITY_COLORS.outlier;
        } else if (duplicateIds.has(p.id) && qaLayers.duplicates) {
          color = QUALITY_COLORS.duplicate;
        } else if (orphanIds.has(p.id) && qaLayers.orphans) {
          color = QUALITY_COLORS.orphan;
        } else {
          color = QUALITY_COLORS.normal;
        }
      }

      // Color field override
      if (colorField && p.metadata[colorField] !== undefined) {
        const val = String(p.metadata[colorField]);
        let hash = 0;
        for (let c = 0; c < val.length; c++) {
          hash = val.charCodeAt(c) + ((hash << 5) - hash);
        }
        color = CLUSTER_PALETTE[Math.abs(hash) % CLUSTER_PALETTE.length];
      }

      tempColor.set(color);
      colorArray[i * 3] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    colorAttrRef.current.needsUpdate = true;
  });

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        onHover(points[e.instanceId].id);
      }
    },
    [points, onHover],
  );

  const handlePointerOut = useCallback(() => {
    onHover(null);
  }, [onHover]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < points.length) {
        onSelect(points[e.instanceId].id, e.shiftKey);
      }
    },
    [points, onSelect],
  );

  if (points.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, points.length]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <sphereGeometry args={[POINT_RADIUS, POINT_SEGMENTS, POINT_SEGMENTS]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

export default function ThreeScene(props: ThreeSceneProps) {
  const { isExpanded, ...cloudProps } = props;

  return (
    <Canvas
      camera={{ position: [2, 2, 2], fov: 50 }}
      style={{ background: SCENE_BG }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.8} />
      <PointCloud {...cloudProps} />
      <OrbitControls
        autoRotate={!isExpanded}
        autoRotateSpeed={0.5}
        enablePan={isExpanded}
        dampingFactor={0.1}
        enableDamping
      />
      {/* Tooltip for hovered point */}
      {props.hoveredPoint && (() => {
        const point = props.points.find((p) => p.id === props.hoveredPoint);
        if (!point) return null;
        return (
          <Html position={[point.x, point.y, point.z]} distanceFactor={5}>
            <div className="pointer-events-none rounded border border-[#232328] bg-[#151518]/95 px-2 py-1 text-xs shadow-xl backdrop-blur">
              <div className="font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">{point.id}</div>
              {Object.entries(point.metadata).slice(0, 3).map(([k, v]) => (
                <div key={k} className="text-[#8A857D]">
                  {k}: <span className="text-[#C5C0B8]">{String(v)}</span>
                </div>
              ))}
            </div>
          </Html>
        );
      })()}
    </Canvas>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | grep -i "ThreeScene" | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/ThreeScene.tsx
git commit -m "feat: add ThreeScene component with InstancedMesh point cloud and raycasting"
```

---

## Chunk 4: Frontend — UI Controls

### Task 10: ModeSelector component

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/ModeSelector.tsx`

- [ ] **Step 1: Create ModeSelector**

```tsx
import { MODE_LABELS, type ExplorerMode } from "./constants";

interface ModeSelectorProps {
  activeMode: ExplorerMode;
  onChange: (mode: ExplorerMode) => void;
  disabled?: boolean;
  disabledTooltip?: string;
}

const modes: ExplorerMode[] = ["clusters", "query", "qa"];

export default function ModeSelector({ activeMode, onChange, disabled, disabledTooltip }: ModeSelectorProps) {
  return (
    <div className="flex gap-1 rounded-lg border border-[#232328] bg-[#0E0E11] p-1">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => !disabled && onChange(mode)}
          disabled={disabled}
          title={disabled ? disabledTooltip : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMode === mode
              ? "bg-[#C9A227]/20 text-[#C9A227]"
              : disabled
                ? "cursor-not-allowed text-[#5A5650]/50"
                : "text-[#8A857D] hover:bg-[#151518] hover:text-[#C5C0B8]"
          }`}
        >
          {MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/ModeSelector.tsx
git commit -m "feat: add ModeSelector tab bar component"
```

---

### Task 11: SampleSlider component

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/SampleSlider.tsx`

- [ ] **Step 1: Create SampleSlider**

```tsx
import { SAMPLE_STEPS } from "./constants";

interface SampleSliderProps {
  value: number;
  onChange: (size: number) => void;
}

export default function SampleSlider({ value, onChange }: SampleSliderProps) {
  const currentIndex = SAMPLE_STEPS.findIndex((s) => s.value === value);
  const idx = currentIndex >= 0 ? currentIndex : 1; // default to 5K

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#5A5650]">Sample</span>
      <div className="flex gap-1 rounded border border-[#232328] bg-[#0E0E11] p-0.5">
        {SAMPLE_STEPS.map((step, i) => (
          <button
            key={step.label}
            onClick={() => onChange(step.value)}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              i === idx
                ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                : "text-[#5A5650] hover:text-[#8A857D]"
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/SampleSlider.tsx
git commit -m "feat: add SampleSlider discrete-step component"
```

---

### Task 12: ColorLegend component

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/ColorLegend.tsx`

- [ ] **Step 1: Create ColorLegend**

```tsx
import type { ClusterInfo, QualityReport } from "../../api/chromaStudioApi";
import { CLUSTER_PALETTE, QUALITY_COLORS, type ExplorerMode } from "./constants";

interface ColorLegendProps {
  mode: ExplorerMode;
  clusters: ClusterInfo[];
  quality: QualityReport | null;
  clusterVisibility: Map<number, boolean>;
  onToggleCluster: (id: number) => void;
  totalSampled: number;
}

export default function ColorLegend({
  mode,
  clusters,
  quality,
  clusterVisibility,
  onToggleCluster,
  totalSampled,
}: ColorLegendProps) {
  if (mode === "clusters") {
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">Clusters</h4>
        {clusters.map((c) => {
          const visible = clusterVisibility.get(c.id) ?? true;
          return (
            <button
              key={c.id}
              onClick={() => onToggleCluster(c.id)}
              className={`flex w-full items-center justify-between rounded px-1.5 py-1 text-sm transition-opacity hover:bg-[#151518] ${
                visible ? "opacity-100" : "opacity-40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: CLUSTER_PALETTE[c.id % CLUSTER_PALETTE.length] }}
                />
                <span className="truncate text-[#C5C0B8]">{c.label}</span>
              </div>
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">{c.size}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (mode === "qa" && quality) {
    const items = [
      { label: "Outliers", color: QUALITY_COLORS.outlier, count: quality.outlier_ids.length },
      { label: "Duplicates", color: QUALITY_COLORS.duplicate, count: quality.duplicate_pairs.length },
      { label: "Orphans", color: QUALITY_COLORS.orphan, count: quality.orphan_ids.length },
      { label: "Normal", color: QUALITY_COLORS.normal, count: totalSampled - quality.outlier_ids.length - quality.orphan_ids.length },
    ];
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">Quality</h4>
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between px-1.5 py-1 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-[#C5C0B8]">{item.label}</span>
            </div>
            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">{item.count}</span>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "query") {
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">Similarity</h4>
        <div className="flex items-center gap-2 px-1.5 py-1">
          <div className="h-2 w-full rounded-full" style={{
            background: "linear-gradient(to right, #9B1B30, #C9A227, #2DD4BF)",
          }} />
        </div>
        <div className="flex justify-between px-1.5 text-xs text-[#5A5650]">
          <span>0.0</span>
          <span>0.5</span>
          <span>1.0</span>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/ColorLegend.tsx
git commit -m "feat: add ColorLegend component with cluster, query, and QA modes"
```

---

### Task 13: PointInspector component

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/PointInspector.tsx`

- [ ] **Step 1: Create PointInspector**

```tsx
import type { ProjectedPoint3D } from "../../api/chromaStudioApi";

interface PointInspectorProps {
  points: ProjectedPoint3D[];
  selectedIds: Set<string>;
  outlierIds?: Set<string>;
  duplicateIds?: Set<string>;
  orphanIds?: Set<string>;
}

export default function PointInspector({
  points,
  selectedIds,
  outlierIds,
  duplicateIds,
  orphanIds,
}: PointInspectorProps) {
  const selected = points.filter((p) => selectedIds.has(p.id));

  if (selected.length === 0) {
    return (
      <div className="text-sm text-[#5A5650]">Click a point to inspect.</div>
    );
  }

  return (
    <div className="space-y-3">
      {selected.map((point) => {
        const flags: string[] = [];
        if (outlierIds?.has(point.id)) flags.push("Outlier");
        if (duplicateIds?.has(point.id)) flags.push("Duplicate");
        if (orphanIds?.has(point.id)) flags.push("Orphan");

        return (
          <div key={point.id} className="rounded border border-[#232328] bg-[#0E0E11] p-3">
            <div className="font-['IBM_Plex_Mono',monospace] text-xs text-[#2DD4BF]">{point.id}</div>
            {flags.length > 0 && (
              <div className="mt-1 flex gap-1">
                {flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: f === "Outlier" ? "#E85A6B20" : f === "Duplicate" ? "#F59E0B20" : "#5A565020",
                      color: f === "Outlier" ? "#E85A6B" : f === "Duplicate" ? "#F59E0B" : "#5A5650",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
            {Object.keys(point.metadata).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(point.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-[#8A857D]">{k}</span>
                    <span className="max-w-[60%] truncate text-[#C5C0B8]">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">
              ({point.x.toFixed(3)}, {point.y.toFixed(3)}, {point.z.toFixed(3)})
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/PointInspector.tsx
git commit -m "feat: add PointInspector component for selected point details"
```

---

### Task 14: MetadataColorPicker component

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/MetadataColorPicker.tsx`

- [ ] **Step 1: Create MetadataColorPicker**

```tsx
interface MetadataColorPickerProps {
  metadataKeys: string[];
  value: string | null;
  onChange: (field: string | null) => void;
}

export default function MetadataColorPicker({ metadataKeys, value, onChange }: MetadataColorPickerProps) {
  if (metadataKeys.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#5A5650]">Color by</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded border border-[#232328] bg-[#0E0E11] px-2 py-1 text-xs text-[#E8E4DC] outline-none focus:border-[#C9A227]/50"
      >
        <option value="">Mode default</option>
        {metadataKeys.map((key) => (
          <option key={key} value={key}>{key}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/MetadataColorPicker.tsx
git commit -m "feat: add MetadataColorPicker dropdown component"
```

---

### Task 15: QualitySummary component

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/QualitySummary.tsx`

- [ ] **Step 1: Create QualitySummary**

```tsx
import type { QualityReport, ProjectionStats } from "../../api/chromaStudioApi";

interface QualitySummaryProps {
  quality: QualityReport;
  stats: ProjectionStats;
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
  onToggle: (layer: "outliers" | "duplicates" | "orphans") => void;
}

export default function QualitySummary({ quality, stats, qaLayers, onToggle }: QualitySummaryProps) {
  const items = [
    { key: "outliers" as const, label: "Outliers", count: quality.outlier_ids.length, color: "#E85A6B" },
    { key: "duplicates" as const, label: "Duplicate pairs", count: quality.duplicate_pairs.length, color: "#F59E0B" },
    { key: "orphans" as const, label: "Orphans", count: quality.orphan_ids.length, color: "#5A5650" },
  ];

  function handleExport() {
    const rows = [
      ["id", "type", "detail"],
      ...quality.outlier_ids.map((id) => [id, "outlier", ""]),
      ...quality.duplicate_pairs.map(([a, b]) => [a, "duplicate", `pair: ${b}`]),
      ...quality.duplicate_pairs.map(([a, b]) => [b, "duplicate", `pair: ${a}`]),
      ...quality.orphan_ids.map((id) => [id, "orphan", ""]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quality-report-${stats.sampled}-samples.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onToggle(item.key)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${
            qaLayers[item.key] ? "opacity-100" : "opacity-40"
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          <span className="text-[#C5C0B8]">{item.count}</span>
          <span className="text-[#5A5650]">{item.label}</span>
        </button>
      ))}
      <span className="text-xs text-[#5A5650]">
        out of {stats.sampled.toLocaleString()} sampled
      </span>
      <button
        onClick={handleExport}
        className="ml-auto text-xs text-[#C9A227] hover:text-[#C9A227]/80"
      >
        Export CSV
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/QualitySummary.tsx
git commit -m "feat: add QualitySummary component with toggleable layers and CSV export"
```

---

## Chunk 5: Frontend — Main Component and Integration

### Task 16: VectorExplorer main component

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/VectorExplorer.tsx`

- [ ] **Step 1: Create VectorExplorer**

```tsx
import { useMemo } from "react";
import { Maximize2, Minimize2, Loader2, WifiOff } from "lucide-react";
import { Panel } from "@/components/ui";
import type { CollectionOverview } from "../../api/chromaStudioApi";
import { useVectorExplorer } from "./useVectorExplorer";
import ThreeScene from "./ThreeScene";
import ModeSelector from "./ModeSelector";
import SampleSlider from "./SampleSlider";
import ColorLegend from "./ColorLegend";
import PointInspector from "./PointInspector";
import MetadataColorPicker from "./MetadataColorPicker";
import QualitySummary from "./QualitySummary";

interface VectorExplorerProps {
  collectionName: string | null;
  overview: CollectionOverview | null;
}

export default function VectorExplorer({ collectionName, overview }: VectorExplorerProps) {
  const explorer = useVectorExplorer(collectionName);
  const { projectionData, activeMode, isExpanded, isLoading, isFallback, error } = explorer;

  const outlierIds = useMemo(
    () => new Set(projectionData?.quality.outlier_ids ?? []),
    [projectionData?.quality.outlier_ids],
  );
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [a, b] of projectionData?.quality.duplicate_pairs ?? []) {
      ids.add(a);
      ids.add(b);
    }
    return ids;
  }, [projectionData?.quality.duplicate_pairs]);
  const orphanIds = useMemo(
    () => new Set(projectionData?.quality.orphan_ids ?? []),
    [projectionData?.quality.orphan_ids],
  );

  // Loading state
  if (isLoading && !projectionData) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#C9A227]" />
          <div>
            <p className="text-sm font-medium text-[#C5C0B8]">Computing projection</p>
            <p className="mt-1 text-xs text-[#5A5650]">
              Running PCA→UMAP on {explorer.sampleSize === 0 ? "all" : explorer.sampleSize.toLocaleString()} vectors...
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  if (!projectionData && !isFallback) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-[#5A5650]">
          Select a collection to visualize embeddings.
        </p>
      </Panel>
    );
  }

  const points = projectionData?.points ?? [];
  const clusters = projectionData?.clusters ?? [];
  const quality = projectionData?.quality ?? null;
  const stats = projectionData?.stats ?? null;

  const sceneContent = (
    <ThreeScene
      points={points}
      clusters={clusters}
      activeMode={isFallback ? "clusters" : activeMode}
      colorField={explorer.colorField}
      hoveredPoint={explorer.hoveredPoint}
      selectedPoints={explorer.selectedPoints}
      clusterVisibility={explorer.clusterVisibility}
      qaLayers={explorer.qaLayers}
      outlierIds={outlierIds}
      duplicateIds={duplicateIds}
      orphanIds={orphanIds}
      isExpanded={isExpanded}
      onHover={explorer.setHoveredPoint}
      onSelect={explorer.selectPoint}
    />
  );

  // ── Expanded overlay ──────────────────────────────────────────────────────
  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex bg-[#0A0A0F]">
        {/* Main scene */}
        <div className="flex flex-1 flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-4 py-2">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-[#F0EDE8]">Vector Explorer</h2>
              {overview && (
                <span className="rounded bg-[#2DD4BF]/10 px-2 py-0.5 text-xs text-[#2DD4BF]">
                  {overview.name} ({(stats?.sampled ?? 0).toLocaleString()})
                </span>
              )}
              <ModeSelector
                activeMode={activeMode}
                onChange={explorer.setMode}
                disabled={isFallback}
                disabledTooltip="Requires AI service connection"
              />
            </div>
            <div className="flex items-center gap-3">
              <SampleSlider value={explorer.sampleSize} onChange={explorer.setSampleSize} />
              <MetadataColorPicker
                metadataKeys={overview?.metadataKeys ?? []}
                value={explorer.colorField}
                onChange={explorer.setColorField}
              />
              <button
                onClick={() => explorer.setExpanded(false)}
                className="rounded p-1.5 text-[#8A857D] hover:bg-[#151518] hover:text-[#F0EDE8]"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* QA summary bar */}
          {activeMode === "qa" && quality && stats && (
            <div className="border-b border-[#232328] px-4 py-1">
              <QualitySummary
                quality={quality}
                stats={stats}
                qaLayers={explorer.qaLayers}
                onToggle={explorer.toggleQaLayer}
              />
            </div>
          )}

          {/* 3D Scene */}
          <div className="flex-1">
            {sceneContent}
          </div>

          {/* Status bar */}
          {isLoading && (
            <div className="flex items-center gap-2 border-t border-[#232328] bg-[#0E0E11] px-4 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-[#C9A227]" />
              <span className="text-xs text-[#5A5650]">Recomputing projection...</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 space-y-4 overflow-y-auto border-l border-[#232328] bg-[#0E0E11] p-4">
          {error && (
            <div className="flex items-center gap-2 rounded border border-[#E85A6B]/30 bg-[#E85A6B]/10 px-3 py-2">
              <WifiOff className="h-4 w-4 text-[#E85A6B]" />
              <span className="text-xs text-[#E85A6B]">{error}</span>
            </div>
          )}

          <ColorLegend
            mode={activeMode}
            clusters={clusters}
            quality={quality}
            clusterVisibility={explorer.clusterVisibility}
            onToggleCluster={explorer.toggleCluster}
            totalSampled={stats?.sampled ?? 0}
          />

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Inspector
            </h4>
            <PointInspector
              points={points}
              selectedIds={explorer.selectedPoints}
              outlierIds={outlierIds}
              duplicateIds={duplicateIds}
              orphanIds={orphanIds}
            />
          </div>

          {stats && (
            <div className="space-y-1 border-t border-[#232328] pt-3">
              <div className="flex justify-between text-xs">
                <span className="text-[#5A5650]">Total vectors</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {stats.total_vectors.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5A5650]">Sampled</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {stats.sampled.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5A5650]">Projection time</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {(stats.projection_time_ms / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Compact view ──────────────────────────────────────────────────────────
  return (
    <Panel>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#F0EDE8]">3D Semantic Map</h3>
        <div className="flex items-center gap-2">
          {stats && (
            <span className="text-xs text-[#5A5650]">
              {stats.sampled.toLocaleString()} pts · {(stats.projection_time_ms / 1000).toFixed(1)}s
            </span>
          )}
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-[#C9A227]" />}
          <button
            onClick={() => explorer.setExpanded(true)}
            className="flex items-center gap-1 rounded bg-[#232328] px-2 py-1 text-xs text-[#C9A227] hover:bg-[#232328]/80"
          >
            <Maximize2 className="h-3 w-3" />
            Expand
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-2 flex items-center gap-2 rounded bg-[#E85A6B]/10 px-2 py-1 text-xs text-[#E85A6B]">
          <WifiOff className="h-3 w-3" />
          {error}
        </div>
      )}
      <div className="h-[300px] overflow-hidden rounded-lg border border-[#232328]">
        {sceneContent}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | grep -c "error" || echo "0 errors"`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/VectorExplorer.tsx
git commit -m "feat: add VectorExplorer main component with compact and expanded views"
```

---

### Task 17: Integrate VectorExplorer into ChromaStudioPanel

**Files:**
- Modify: `frontend/src/features/administration/components/ChromaStudioPanel.tsx`

This task replaces the old `MapSection`, `ScatterPlot`, and `useUmapProjection` with the new `VectorExplorer`.

- [ ] **Step 1: Add VectorExplorer import**

At the top of `ChromaStudioPanel.tsx`, add:

```typescript
import VectorExplorer from "./vector-explorer/VectorExplorer";
```

- [ ] **Step 2: Replace MapSection usage in the JSX**

Find the line (around line 411):
```tsx
{activeTab === "map" && <MapSection points={computedPoints} overview={overview} loadingEmbeddings={loadingEmbeddings} />}
```

Replace with:
```tsx
{activeTab === "map" && <VectorExplorer collectionName={selectedCollection} overview={overview} />}
```

- [ ] **Step 3: Lift query state to ChromaStudioPanel level**

In `ChromaStudioPanel`, add state to track the last query embedding and results:

```typescript
const [lastQueryResults, setLastQueryResults] = useState<QueryResultItem[] | null>(null);
```

Pass `setLastQueryResults` to `SearchSection` so it calls it after a successful query. Pass `lastQueryResults` to `VectorExplorer` as a prop (the VectorExplorer can use this in Phase 2 when QueryVisuals is implemented). For now, VectorExplorer accepts the prop but doesn't use it beyond auto-switching to query mode:

```tsx
{activeTab === "map" && (
  <VectorExplorer
    collectionName={selectedCollection}
    overview={overview}
    queryResults={lastQueryResults}
  />
)}
```

- [ ] **Step 5: Remove old code**

Remove these sections from `ChromaStudioPanel.tsx`:
1. The `computedPoints` line: `const computedPoints = useUmapProjection(embeddingRecords);` (around line 144)
2. The entire `MapSection` function (around lines 545–650)
3. The entire `ScatterPlot` function (around lines 652–709)
4. The entire `useUmapProjection` function (around lines 711–762)
5. The `loadingEmbeddings` state and the embedding-loading logic in the `map` tab effect (the `activeTab === "map"` branch that fetches with `include_embeddings: true`) — this is now handled by `useVectorExplorer` internally
6. Remove unused imports: `Radar` from lucide-react (if only used by old MapSection)

- [ ] **Step 6: Remove old ProjectionPoint type from chromaStudioApi.ts**

Remove the `ProjectionPoint` interface (lines 26-32 of `chromaStudioApi.ts`) since it's replaced by `ProjectedPoint3D`.

- [ ] **Step 7: Verify types compile**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: Clean compile

- [ ] **Step 8: Build frontend**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/administration/components/ChromaStudioPanel.tsx frontend/src/features/administration/api/chromaStudioApi.ts
git commit -m "feat: replace 2D SVG scatter plot with 3D Vector Explorer in Chroma Studio"
```

---

## Chunk 6: Phase 2 Stubs (ClusterHulls, QueryVisuals)

These components implement spec sections 6.1 (convex hulls, re-cluster button) and 6.2 (query star, similarity lines, kNN projection). They are deferred to Phase 2 to ship the core 3D visualization first. Phase 2 will implement full ClusterHulls with ConvexGeometry, cluster labels at centroids, re-cluster slider, and QueryVisuals with weighted kNN query projection, pulsing star, similarity lines/rings, and shared query state from SearchSection.

### Task 18: ClusterHulls placeholder

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/ClusterHulls.tsx`

- [ ] **Step 1: Create placeholder**

```tsx
/** Placeholder for translucent convex hull meshes per cluster.
 *  TODO: Implement using ConvexGeometry from three-stdlib. */
export default function ClusterHulls() {
  // Will render translucent convex hulls per cluster
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/ClusterHulls.tsx
git commit -m "feat: add ClusterHulls placeholder component"
```

---

### Task 19: QueryVisuals placeholder

**Files:**
- Create: `frontend/src/features/administration/components/vector-explorer/QueryVisuals.tsx`

- [ ] **Step 1: Create placeholder**

```tsx
/** Placeholder for query star, similarity lines, and rings.
 *  TODO: Implement query embedding projection with weighted kNN. */
export default function QueryVisuals() {
  // Will render query point as pulsing star + similarity lines
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/components/vector-explorer/QueryVisuals.tsx
git commit -m "feat: add QueryVisuals placeholder component"
```

---

### Task 20: Deploy and verify end-to-end

- [ ] **Step 1: Rebuild containers**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose build python-ai && docker compose up -d`

- [ ] **Step 2: Build frontend for production**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`

- [ ] **Step 3: Deploy**

Run: `./deploy.sh`

- [ ] **Step 4: Verify in browser**

1. Navigate to System Health → ChromaDB service detail
2. Select the `docs` collection (43,649 vectors)
3. Click the "Semantic Map" tab
4. Verify 3D compact preview renders with auto-rotating point cloud
5. Click "Expand" button
6. Verify full-screen overlay with mode tabs, sample slider, legend, inspector
7. Switch between Clusters / QA modes
8. Click points to inspect metadata
9. Click "Export CSV" in QA mode

- [ ] **Step 5: Final commit with any fixes**

```bash
git add -A
git commit -m "feat: Vector Explorer 3D embedding visualization for Chroma Studio"
```
