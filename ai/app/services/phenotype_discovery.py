"""Phenotype discovery via consensus clustering on OMOP patient feature vectors.

Discovers latent patient subgroups within a cohort by clustering on clinical
features (diagnoses, drugs, labs, demographics) extracted from the
patient_feature_vectors table.
"""

import json
import logging
from typing import Any

import asyncpg
import numpy as np
from sklearn.cluster import KMeans, SpectralClustering
from sklearn.metrics import silhouette_score

logger = logging.getLogger(__name__)

MAX_PATIENTS = 2000
DEFAULT_K_RANGE = (2, 10)
DEFAULT_N_ITERATIONS = 50
DEFAULT_SUBSAMPLE_RATIO = 0.8


async def build_feature_matrix(
    pool: asyncpg.Pool,
    person_ids: list[int],
    source_id: int,
) -> tuple[np.ndarray, list[str], list[int]]:
    """Build a patient x feature matrix from patient_feature_vectors.

    Returns (matrix, feature_names, person_id_order).
    """
    rows = await pool.fetch(
        """
        SELECT person_id, age_bucket, gender_concept_id,
               condition_concepts, drug_concepts, lab_vector
        FROM app.patient_feature_vectors
        WHERE source_id = $1 AND person_id = ANY($2::bigint[])
        """,
        source_id,
        person_ids,
    )

    if not rows:
        return np.empty((0, 0)), [], []

    # Parse JSONB columns
    parsed: list[dict[str, Any]] = []
    for row in rows:
        rec: dict[str, Any] = {
            "person_id": row["person_id"],
            "age_bucket": row["age_bucket"] or 0,
            "gender_concept_id": row["gender_concept_id"] or 0,
        }
        for col in ("condition_concepts", "drug_concepts", "lab_vector"):
            raw = row[col]
            if raw is None:
                rec[col] = {}
            elif isinstance(raw, str):
                try:
                    rec[col] = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    rec[col] = {}
            else:
                rec[col] = raw
        parsed.append(rec)

    # Collect all unique feature keys across patients
    dx_keys: set[str] = set()
    rx_keys: set[str] = set()
    lab_keys: set[str] = set()

    for rec in parsed:
        conds = rec["condition_concepts"]
        if isinstance(conds, dict):
            for cid in conds:
                dx_keys.add(f"dx_{cid}")
        elif isinstance(conds, list):
            for cid in conds:
                dx_keys.add(f"dx_{cid}")

        drugs = rec["drug_concepts"]
        if isinstance(drugs, dict):
            for cid in drugs:
                rx_keys.add(f"rx_{cid}")
        elif isinstance(drugs, list):
            for cid in drugs:
                rx_keys.add(f"rx_{cid}")

        labs = rec["lab_vector"]
        if isinstance(labs, dict):
            for lid in labs:
                lab_keys.add(f"lab_{lid}")
        elif isinstance(labs, list):
            for lid in labs:
                lab_keys.add(f"lab_{lid}")

    sorted_dx = sorted(dx_keys)
    sorted_rx = sorted(rx_keys)
    sorted_lab = sorted(lab_keys)
    feature_names = ["age_bucket", "gender"] + sorted_dx + sorted_rx + sorted_lab

    n_patients = len(parsed)
    n_features = len(feature_names)
    matrix = np.zeros((n_patients, n_features), dtype=np.float64)
    person_id_order: list[int] = []

    # Feature name -> column index
    col_idx = {name: i for i, name in enumerate(feature_names)}

    for i, rec in enumerate(parsed):
        person_id_order.append(rec["person_id"])
        matrix[i, 0] = float(rec["age_bucket"])
        # Encode gender as 0/1 (8507=male -> 1, else -> 0)
        matrix[i, 1] = 1.0 if rec["gender_concept_id"] == 8507 else 0.0

        conds = rec["condition_concepts"]
        if isinstance(conds, dict):
            for cid in conds:
                key = f"dx_{cid}"
                if key in col_idx:
                    matrix[i, col_idx[key]] = 1.0
        elif isinstance(conds, list):
            for cid in conds:
                key = f"dx_{cid}"
                if key in col_idx:
                    matrix[i, col_idx[key]] = 1.0

        drugs = rec["drug_concepts"]
        if isinstance(drugs, dict):
            for cid in drugs:
                key = f"rx_{cid}"
                if key in col_idx:
                    matrix[i, col_idx[key]] = 1.0
        elif isinstance(drugs, list):
            for cid in drugs:
                key = f"rx_{cid}"
                if key in col_idx:
                    matrix[i, col_idx[key]] = 1.0

        labs = rec["lab_vector"]
        if isinstance(labs, dict):
            for lid, zscore in labs.items():
                key = f"lab_{lid}"
                if key in col_idx:
                    try:
                        matrix[i, col_idx[key]] = float(zscore)
                    except (ValueError, TypeError):
                        pass
        elif isinstance(labs, list):
            for lid in labs:
                key = f"lab_{lid}"
                if key in col_idx:
                    matrix[i, col_idx[key]] = 1.0

    return matrix, feature_names, person_id_order


def consensus_cluster(
    feature_matrix: np.ndarray,
    k_range: tuple[int, int] = DEFAULT_K_RANGE,
    n_iterations: int = DEFAULT_N_ITERATIONS,
    subsample_ratio: float = DEFAULT_SUBSAMPLE_RATIO,
) -> tuple[np.ndarray, np.ndarray, int, float]:
    """Run consensus clustering with automatic k selection.

    Returns (co_clustering_matrix, best_labels, best_k, best_silhouette).
    """
    n = feature_matrix.shape[0]
    if n < 3:
        return (
            np.ones((n, n)),
            np.zeros(n, dtype=int),
            1,
            0.0,
        )

    rng = np.random.RandomState(42)
    subsample_size = max(3, int(n * subsample_ratio))

    # Build co-clustering matrix across iterations
    co_count = np.zeros((n, n), dtype=np.float64)
    co_sampled = np.zeros((n, n), dtype=np.float64)

    k_min, k_max = k_range
    k_max = min(k_max, n - 1)
    if k_min > k_max:
        k_min = 2
        k_max = max(2, min(n - 1, 3))

    for _ in range(n_iterations):
        idx = rng.choice(n, size=subsample_size, replace=False)
        sub_matrix = feature_matrix[idx]

        k_iter = rng.randint(k_min, k_max + 1)
        km = KMeans(n_clusters=k_iter, n_init=1, random_state=rng.randint(0, 2**31))
        labels_iter = km.fit_predict(sub_matrix)

        # Update co-clustering counts
        for a_local in range(len(idx)):
            for b_local in range(a_local + 1, len(idx)):
                i_global = idx[a_local]
                j_global = idx[b_local]
                co_sampled[i_global, j_global] += 1
                co_sampled[j_global, i_global] += 1
                if labels_iter[a_local] == labels_iter[b_local]:
                    co_count[i_global, j_global] += 1
                    co_count[j_global, i_global] += 1

    # Normalize: proportion of times co-sampled pairs were co-clustered
    mask = co_sampled > 0
    co_matrix = np.zeros_like(co_count)
    co_matrix[mask] = co_count[mask] / co_sampled[mask]
    np.fill_diagonal(co_matrix, 1.0)

    # Try each k on the consensus matrix, pick best silhouette
    best_k = k_min
    best_silhouette = -1.0
    best_labels = np.zeros(n, dtype=int)

    for k in range(k_min, k_max + 1):
        try:
            sc = SpectralClustering(
                n_clusters=k,
                affinity="precomputed",
                random_state=42,
                n_init=3,
            )
            labels_k = sc.fit_predict(co_matrix)
            if len(set(labels_k)) < 2:
                continue
            sil = silhouette_score(co_matrix, labels_k, metric="precomputed")
            # For precomputed affinity, invert distance interpretation
            # silhouette on similarity matrix: higher = better separation
            if sil > best_silhouette:
                best_silhouette = sil
                best_k = k
                best_labels = labels_k
        except Exception:
            logger.debug("SpectralClustering failed for k=%d", k, exc_info=True)
            continue

    return co_matrix, best_labels, best_k, float(best_silhouette)


async def profile_clusters(
    feature_matrix: np.ndarray,
    labels: np.ndarray,
    feature_names: list[str],
    pool: asyncpg.Pool,
    source_id: int,
) -> list[dict[str, Any]]:
    """Profile each cluster: top features, demographics, labs."""
    n_clusters = int(labels.max()) + 1 if len(labels) > 0 else 0
    overall_mean = feature_matrix.mean(axis=0) if feature_matrix.shape[0] > 0 else np.zeros(feature_matrix.shape[1])

    # Collect concept IDs to resolve names
    concept_ids: set[int] = set()
    for name in feature_names:
        for prefix in ("dx_", "rx_", "lab_"):
            if name.startswith(prefix):
                try:
                    concept_ids.add(int(name[len(prefix):]))
                except ValueError:
                    pass

    # Resolve concept names
    concept_names: dict[int, str] = {}
    if concept_ids:
        id_list = list(concept_ids)
        rows = await pool.fetch(
            "SELECT concept_id, concept_name FROM vocab.concept WHERE concept_id = ANY($1::bigint[])",
            id_list,
        )
        for row in rows:
            concept_names[int(row["concept_id"])] = row["concept_name"]

    profiles: list[dict[str, Any]] = []

    for cluster_id in range(n_clusters):
        mask = labels == cluster_id
        cluster_matrix = feature_matrix[mask]
        size = int(mask.sum())

        if size == 0:
            continue

        cluster_mean = cluster_matrix.mean(axis=0)

        # Identify condition features
        dx_features: list[dict[str, Any]] = []
        rx_features: list[dict[str, Any]] = []
        lab_features: list[dict[str, Any]] = []

        for col_i, name in enumerate(feature_names):
            prevalence = float(cluster_mean[col_i])
            overall_prev = float(overall_mean[col_i])

            if name.startswith("dx_"):
                cid = int(name[3:])
                dx_features.append({
                    "concept_id": cid,
                    "name": concept_names.get(cid, f"Concept {cid}"),
                    "prevalence": round(prevalence, 4),
                    "overall_prevalence": round(overall_prev, 4),
                })
            elif name.startswith("rx_"):
                cid = int(name[3:])
                rx_features.append({
                    "concept_id": cid,
                    "name": concept_names.get(cid, f"Concept {cid}"),
                    "prevalence": round(prevalence, 4),
                    "overall_prevalence": round(overall_prev, 4),
                })
            elif name.startswith("lab_"):
                cid = int(name[4:])
                lab_std = float(cluster_matrix[:, col_i].std()) if size > 1 else 0.0
                lab_features.append({
                    "concept_id": cid,
                    "name": concept_names.get(cid, f"Lab {cid}"),
                    "mean": round(prevalence, 4),
                    "std": round(lab_std, 4),
                })

        # Sort by prevalence difference from overall (most distinctive first)
        dx_features.sort(key=lambda f: abs(f["prevalence"] - f["overall_prevalence"]), reverse=True)
        rx_features.sort(key=lambda f: abs(f["prevalence"] - f["overall_prevalence"]), reverse=True)

        # Demographics
        age_col = feature_names.index("age_bucket") if "age_bucket" in feature_names else None
        gender_col = feature_names.index("gender") if "gender" in feature_names else None

        mean_age_bucket = float(cluster_mean[age_col]) if age_col is not None else 0.0
        male_ratio = float(cluster_mean[gender_col]) if gender_col is not None else 0.0

        profiles.append({
            "cluster_id": cluster_id,
            "size": size,
            "top_conditions": dx_features[:10],
            "top_drugs": rx_features[:5],
            "lab_profile": lab_features[:10],
            "demographics": {
                "mean_age_bucket": round(mean_age_bucket, 2),
                "gender_distribution": {
                    "male": round(male_ratio, 3),
                    "female": round(1.0 - male_ratio, 3),
                },
                "size": size,
            },
        })

    return profiles


def _build_heatmap(
    feature_matrix: np.ndarray,
    labels: np.ndarray,
    feature_names: list[str],
    top_n: int = 30,
) -> list[dict[str, Any]]:
    """Build heatmap data: top features by cross-cluster variance."""
    n_clusters = int(labels.max()) + 1 if len(labels) > 0 else 0
    if n_clusters < 2 or feature_matrix.shape[0] == 0:
        return []

    # Compute per-cluster prevalence for each feature
    cluster_prevalences = np.zeros((len(feature_names), n_clusters))
    for k in range(n_clusters):
        mask = labels == k
        if mask.sum() > 0:
            cluster_prevalences[:, k] = feature_matrix[mask].mean(axis=0)

    # Variance across clusters for each feature
    variance = cluster_prevalences.var(axis=1)
    top_indices = np.argsort(variance)[::-1][:top_n]

    heatmap: list[dict[str, Any]] = []
    for idx in top_indices:
        name = feature_names[idx]
        if variance[idx] < 1e-8:
            continue
        concept_id = 0
        for prefix in ("dx_", "rx_", "lab_"):
            if name.startswith(prefix):
                try:
                    concept_id = int(name[len(prefix):])
                except ValueError:
                    pass
                break
        heatmap.append({
            "feature_name": name,
            "concept_id": concept_id,
            "cluster_prevalences": [round(float(v), 4) for v in cluster_prevalences[idx]],
        })

    return heatmap


async def discover_phenotypes(
    pool: asyncpg.Pool,
    source_id: int,
    person_ids: list[int],
    k: int | None = None,
    method: str = "consensus",
) -> dict[str, Any]:
    """Orchestrate phenotype discovery: build features, cluster, profile."""
    # Cap at MAX_PATIENTS
    if len(person_ids) > MAX_PATIENTS:
        rng = np.random.RandomState(42)
        selected = rng.choice(len(person_ids), size=MAX_PATIENTS, replace=False)
        person_ids = [person_ids[i] for i in sorted(selected)]

    matrix, feature_names, person_id_order = await build_feature_matrix(
        pool, person_ids, source_id,
    )

    if matrix.shape[0] < 3:
        return {
            "clusters": [],
            "assignments": [],
            "quality": {"silhouette_score": 0, "optimal_k": 0, "k_used": 0, "method": method},
            "feature_matrix_info": {"n_patients": matrix.shape[0], "n_features": matrix.shape[1] if matrix.ndim > 1 else 0},
            "heatmap": [],
        }

    best_silhouette = 0.0
    best_labels = np.zeros(matrix.shape[0], dtype=int)
    best_k = k or 2

    if method == "consensus":
        k_range = (k, k) if k else DEFAULT_K_RANGE
        _, best_labels, best_k, best_silhouette = consensus_cluster(
            matrix, k_range=k_range,
        )
        # Consensus can fail on very sparse binary data — fall back to kmeans
        if best_silhouette <= 0 or len(set(best_labels)) < 2:
            logger.info("Consensus clustering found no structure, falling back to kmeans")
            effective_k = k or 4
            effective_k = min(effective_k, matrix.shape[0] - 1)
            effective_k = max(effective_k, 2)
            km = KMeans(n_clusters=effective_k, n_init=10, random_state=42)
            best_labels = km.fit_predict(matrix)
            best_k = effective_k
            method = "kmeans"
            if len(set(best_labels)) >= 2:
                best_silhouette = float(silhouette_score(matrix, best_labels))
    elif method in ("kmeans", "spectral"):
        effective_k = k or 3
        effective_k = min(effective_k, matrix.shape[0] - 1)
        effective_k = max(effective_k, 2)

        if method == "kmeans":
            km = KMeans(n_clusters=effective_k, n_init=10, random_state=42)
            best_labels = km.fit_predict(matrix)
        else:
            sc = SpectralClustering(n_clusters=effective_k, random_state=42, n_init=3)
            best_labels = sc.fit_predict(matrix)

        best_k = effective_k
        if len(set(best_labels)) >= 2:
            best_silhouette = float(silhouette_score(matrix, best_labels))

    # Profile clusters
    profiles = await profile_clusters(matrix, best_labels, feature_names, pool, source_id)

    # Assignments
    assignments = [
        {"person_id": pid, "cluster_id": int(best_labels[i])}
        for i, pid in enumerate(person_id_order)
    ]

    # Heatmap
    heatmap = _build_heatmap(matrix, best_labels, feature_names)

    return {
        "clusters": profiles,
        "assignments": assignments,
        "quality": {
            "silhouette_score": round(best_silhouette, 4),
            "optimal_k": best_k,
            "k_used": best_k,
            "method": method,
        },
        "feature_matrix_info": {
            "n_patients": matrix.shape[0],
            "n_features": matrix.shape[1],
        },
        "heatmap": heatmap,
    }
