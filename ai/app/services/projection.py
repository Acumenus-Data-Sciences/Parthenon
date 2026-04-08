"""PCA→UMAP projection pipeline with clustering and quality detection."""
import hashlib
import logging
import re
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)

PAGE_TYPE_LABELS = {
    "source_summary": "Source Summaries",
    "entity": "Entities",
    "concept": "Concept Pages",
    "comparison": "Comparisons",
    "analysis": "Analysis Pages",
}

METADATA_KEY_LABELS = {
    "primary_domain": "Primary Domain",
    "page_type": "Page Type",
    "journal": "Journal",
    "publication_year": "Publication Year",
    "first_author": "First Author",
    "category": "Category",
    "type": "Type",
    "source": "Source",
    "source_type": "Source Type",
    "workspace": "Workspace",
}

LABEL_PRIORITY = {
    "primary_domain": 1.6,
    "page_type": 1.5,
    "category": 1.25,
    "type": 1.15,
    "journal": 1.1,
    "publication_year": 1.0,
    "first_author": 0.95,
    "source": 0.45,
    "source_type": 0.4,
    "workspace": 0.35,
}

NON_LABEL_KEYS = {
    "workspace",
    "source",
    "source_type",
    "slug",
    "source_slug",
    "doi",
    "authors",
    "title",
    "keywords",
    "document",
    "chunk_index",
}

SUMMARY_KEYS = (
    "primary_domain",
    "page_type",
    "category",
    "type",
    "journal",
    "publication_year",
    "first_author",
    "source",
    "source_type",
    "workspace",
)

GENERIC_LABEL_VALUES = {"platform", "pdf", "markdown", "jsonl", "docs", "wiki"}

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
    summary: dict[str, Any] | None = None


@dataclass
class QualityReport:
    outlier_ids: list[str]
    duplicate_pairs: list[tuple[str, str]]
    orphan_ids: list[str]


@dataclass
class ProjectionEdge:
    source_id: str
    target_id: str
    similarity: float


@dataclass
class ProjectionResult:
    points: list[ProjectedPoint]
    edges: list[ProjectionEdge]
    clusters: list[Cluster]
    quality: QualityReport
    stats: dict


# ── Cache ────────────────────────────────────────────────────────────────────

_cache: dict[str, tuple[float, ProjectionResult]] = {}
CACHE_TTL = 600  # 10 minutes


def _cache_key(collection_name: str, sample_size: int, total_count: int, dimensions: int) -> str:
    return f"{collection_name}:{sample_size}:{total_count}:{dimensions}"


def _get_cached(key: str) -> ProjectionResult | None:
    if key in _cache:
        ts, result = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return result
        del _cache[key]
    return None


def cache_result(
    collection_name: str,
    sample_size: int,
    total_count: int,
    result: ProjectionResult,
    dimensions: int,
) -> None:
    """Store a projection result in the in-process cache."""
    key = _cache_key(collection_name, sample_size, total_count, dimensions)
    _cache[key] = (time.time(), result)


def get_cached_projection(
    collection_name: str, sample_size: int, total_count: int, dimensions: int
) -> ProjectionResult | None:
    """Retrieve a cached projection result, or None if expired/missing."""
    key = _cache_key(collection_name, sample_size, total_count, dimensions)
    return _get_cached(key)


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
    from sklearn.decomposition import PCA

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

    # Step 2b: Robust percentile normalization to tame outliers
    # Clamp to [1st, 99th] percentile per axis, then scale to [-1, 1]
    projected = _normalize_coordinates(projected)

    # Step 3: K-means clustering with auto-k
    clusters = _compute_clusters(projected, ids, metadatas)

    # Step 4: Quality detection
    quality = _detect_quality_issues(embeddings, projected, ids, clusters)

    # Step 5: Exact k-NN graph in original embedding space
    edges = _compute_knn_edges(embeddings, ids)

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
        edges=edges,
        clusters=clusters,
        quality=quality,
        stats={
            "total_vectors": n_samples,
            "sampled": n_samples,
            "projection_time_ms": elapsed,
            "knn_neighbors": min(5, max(0, n_samples - 1)),
            "num_edges": len(edges),
        },
    )


def _normalize_coordinates(projected: NDArray[np.float32]) -> NDArray[np.float32]:
    """Robust percentile normalization: clamp to [1st, 99th] then scale to [-1, 1].

    This prevents far outliers from compressing the main cluster into an
    invisible dot while preserving the relative structure of the data.
    """
    result = projected.copy()
    for axis in range(projected.shape[1]):
        col = projected[:, axis]
        p1, p99 = np.percentile(col, [1, 99])
        # Clamp
        clamped = np.clip(col, p1, p99)
        # Scale to [-1, 1]
        span = p99 - p1
        if span > 1e-8:
            result[:, axis] = 2.0 * (clamped - p1) / span - 1.0
        else:
            result[:, axis] = 0.0
    return result


def _compute_clusters(
    projected: NDArray, ids: list[str], metadatas: list[dict]
) -> list[Cluster]:
    """K-means with auto-k via silhouette score, capped at 20."""
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score

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

    global_counters = _build_global_metadata_counters(metadatas)
    clusters = []
    for cid in range(best_k):
        mask = labels == cid
        cluster_metas = [metadatas[i] for i in range(n) if mask[i]]
        label, summary = _build_cluster_summary(cluster_metas, global_counters, n)
        centroid = km.cluster_centers_[cid].tolist()
        clusters.append(Cluster(
            id=cid,
            label=label,
            centroid=centroid,
            size=int(mask.sum()),
            summary=summary,
        ))

    return clusters


def _build_global_metadata_counters(metadatas: list[dict]) -> dict[str, Counter[str]]:
    counters: dict[str, Counter[str]] = {}
    for meta in metadatas:
        for key, value in meta.items():
            normalized = _normalize_metadata_value(key, value)
            if normalized is None:
                continue
            counters.setdefault(key, Counter())[normalized] += 1
    return counters


def _build_cluster_summary(
    metadatas: list[dict],
    global_counters: dict[str, Counter[str]],
    total_samples: int,
) -> tuple[str, dict[str, Any] | None]:
    cluster_size = len(metadatas)
    if cluster_size == 0:
        return "Unknown", None

    cluster_counters: dict[str, Counter[str]] = defaultdict(Counter)
    title_counter: Counter[str] = Counter()

    for meta in metadatas:
        for key, value in meta.items():
            normalized = _normalize_metadata_value(key, value)
            if normalized is None:
                continue
            cluster_counters[key][normalized] += 1

        title = _normalize_metadata_value("title", meta.get("title"), for_title=True)
        if title is not None:
            title_counter[title] += 1

    dominant_metadata: list[dict[str, Any]] = []
    for key in SUMMARY_KEYS:
        counter = cluster_counters.get(key)
        if not counter:
            continue

        value, count = counter.most_common(1)[0]
        share = count / cluster_size
        global_count = global_counters.get(key, Counter()).get(value, 0)
        global_share = global_count / max(total_samples, 1)
        lift = share / max(global_share, 1 / max(total_samples, 1))
        score = share * min(lift, 4.0) * LABEL_PRIORITY.get(key, 0.75)

        dominant_metadata.append({
            "key": key,
            "label": METADATA_KEY_LABELS.get(key, _humanize_token(key)),
            "value": value,
            "display_value": _format_metadata_value(key, value),
            "count": count,
            "percentage": round(share * 100, 1),
            "score": round(score, 4),
        })

    dominant_metadata.sort(key=lambda item: (-float(item["score"]), -float(item["percentage"]), str(item["key"])))
    representative_titles = [title for title, _ in title_counter.most_common(3)]
    label, used_keys = _generate_cluster_label(dominant_metadata)

    subtitle_parts: list[str] = []
    for item in dominant_metadata:
        key = str(item["key"])
        if key in used_keys:
            continue

        display_value = str(item["display_value"])
        percentage = float(item["percentage"])

        if key in {"journal", "first_author"}:
            subtitle_parts.append(display_value)
        elif key == "publication_year":
            subtitle_parts.append(f"{display_value} cohort")
        elif key in {"page_type", "primary_domain", "category", "type"}:
            subtitle_parts.append(f"{percentage:.0f}% {display_value}")

        if len(subtitle_parts) >= 2:
            break

    if not subtitle_parts:
        for item in dominant_metadata:
            key = str(item["key"])
            if key in used_keys:
                subtitle_parts.append(f"{float(item['percentage']):.0f}% {item['display_value']}")
            if len(subtitle_parts) >= 2:
                break

    summary = {
        "subtitle": " · ".join(subtitle_parts),
        "dominant_metadata": [
            {k: v for k, v in item.items() if k != "score"}
            for item in dominant_metadata[:6]
        ],
        "representative_titles": representative_titles,
    }
    return label, summary


def _generate_cluster_label(dominant_metadata: list[dict[str, Any]]) -> tuple[str, set[str]]:
    by_key = {str(item["key"]): item for item in dominant_metadata}

    page_type = by_key.get("page_type")
    primary_domain = by_key.get("primary_domain")
    category = by_key.get("category")
    doc_type = by_key.get("type")

    if page_type and primary_domain:
        return (
            f"{page_type['display_value']} · {primary_domain['display_value']}",
            {"page_type", "primary_domain"},
        )

    if category and doc_type:
        return (
            f"{category['display_value']} · {doc_type['display_value']}",
            {"category", "type"},
        )

    label_candidates = [
        item
        for item in dominant_metadata
        if str(item["key"]) not in NON_LABEL_KEYS
        and str(item["value"]).strip().lower() not in GENERIC_LABEL_VALUES
    ]
    if label_candidates:
        best = label_candidates[0]
        used_keys = {str(best["key"])}
        if len(label_candidates) > 1 and float(best["percentage"]) < 75:
            second = label_candidates[1]
            if str(second["key"]) != str(best["key"]) and float(second["percentage"]) >= 35:
                used_keys.add(str(second["key"]))
                return f"{best['display_value']} · {second['display_value']}", used_keys
        return str(best["display_value"]), used_keys

    fallback = dominant_metadata[0] if dominant_metadata else None
    if fallback:
        return str(fallback["display_value"]), {str(fallback["key"])}
    return "Unknown", set()


def _normalize_metadata_value(key: str, value: Any, *, for_title: bool = False) -> str | None:
    if value is None:
        return None

    normalized: str
    if isinstance(value, bool):
        normalized = "true" if value else "false"
    elif isinstance(value, int):
        normalized = str(value)
    elif isinstance(value, float):
        normalized = str(int(value)) if value.is_integer() else f"{value:.2f}".rstrip("0").rstrip(".")
    elif isinstance(value, str):
        normalized = re.sub(r"\s+", " ", value).strip()
    else:
        return None

    if not normalized:
        return None

    max_length = 160 if for_title or key == "title" else 80
    if len(normalized) > max_length:
        return None

    return normalized


def _format_metadata_value(key: str, value: str) -> str:
    if key == "page_type":
        return PAGE_TYPE_LABELS.get(value, _humanize_token(value))
    if key == "primary_domain":
        return _humanize_token(value)
    if key in {"category", "type", "source_type", "source"}:
        return _humanize_token(value)
    return value


def _humanize_token(value: str) -> str:
    cleaned = value.replace("_", " ").replace("-", " ").strip()
    return cleaned.title() if cleaned else value


def _detect_quality_issues(
    embeddings: NDArray,
    projected: NDArray,
    ids: list[str],
    clusters: list[Cluster],
) -> QualityReport:
    """Detect outliers, duplicates, and orphans."""
    from sklearn.ensemble import IsolationForest
    from sklearn.neighbors import NearestNeighbors

    n = len(ids)

    # Outliers via isolation forest
    outlier_ids: list[str] = []
    if n >= 10:
        iso = IsolationForest(contamination=0.05, random_state=42)
        preds = iso.fit_predict(projected)
        outlier_ids = [ids[i] for i in range(n) if preds[i] == -1]

    # Duplicates via cosine similarity > 0.98 without materializing a full NxN matrix
    duplicate_pairs: list[tuple[str, str]] = []
    if n <= 5000:
        nn = NearestNeighbors(metric="cosine", radius=0.02, algorithm="auto")
        nn.fit(embeddings)
        _, indices = nn.radius_neighbors(embeddings, return_distance=True)
        seen: set[tuple[str, str]] = set()
        for i, neighbors in enumerate(indices):
            for neighbor_index in neighbors:
                j = int(neighbor_index)
                if j <= i:
                    continue
                pair = (ids[i], ids[j])
                if pair in seen:
                    continue
                seen.add(pair)
                duplicate_pairs.append(pair)
                if len(duplicate_pairs) >= 100:
                    break
            if len(duplicate_pairs) >= 100:
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


def _compute_knn_edges(
    embeddings: NDArray[np.float32],
    ids: list[str],
    neighbors: int = 5,
) -> list[ProjectionEdge]:
    """Build a deduplicated exact k-NN graph in embedding space using cosine distance."""
    n = len(ids)
    if n < 2:
        return []

    k = min(neighbors, n - 1)
    if k <= 0:
        return []

    from sklearn.neighbors import NearestNeighbors

    nn = NearestNeighbors(
        n_neighbors=min(k + 1, n),
        metric="cosine",
        algorithm="auto",
    )
    nn.fit(embeddings)
    distances, indices = nn.kneighbors(embeddings, return_distance=True)

    edges: list[ProjectionEdge] = []
    seen: set[tuple[str, str]] = set()

    for i in range(n):
        for dist, neighbor_index in zip(distances[i][1:], indices[i][1:]):
            if neighbor_index == i:
                continue
            a = ids[i]
            b = ids[int(neighbor_index)]
            key = (a, b) if a < b else (b, a)
            if key in seen:
                continue
            seen.add(key)
            edges.append(
                ProjectionEdge(
                    source_id=key[0],
                    target_id=key[1],
                    similarity=float(max(0.0, 1.0 - float(dist))),
                )
            )

    return edges


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
