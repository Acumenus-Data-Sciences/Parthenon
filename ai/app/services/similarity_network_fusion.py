"""Similarity Network Fusion (SNF) for multi-modal patient similarity.

Builds separate similarity matrices per clinical data modality (diagnoses, labs,
drugs, procedures), then iteratively fuses them via network diffusion so each
modality's structure propagates through the others. After convergence, community
detection identifies patient subtypes on the fused network.

Reference: Wang et al., "Similarity network fusion for aggregating data types
on a genomic scale", Nature Methods 11, 333-337 (2014).
"""

import logging
from typing import Any

import asyncpg
import numpy as np
from sklearn.cluster import SpectralClustering
from sklearn.metrics import silhouette_score

logger = logging.getLogger(__name__)

MAX_PATIENTS = 2000


def _jaccard_similarity_matrix(features: list[dict[str, Any]], key: str) -> np.ndarray:
    """Build NxN Jaccard similarity matrix for a set-valued modality."""
    n = len(features)
    sets: list[set[str]] = []
    for f in features:
        raw = f.get(key) or {}
        if isinstance(raw, dict):
            sets.append(set(raw.keys()))
        elif isinstance(raw, list):
            sets.append({str(x) for x in raw})
        else:
            sets.append(set())

    W = np.zeros((n, n), dtype=np.float64)
    for i in range(n):
        W[i, i] = 1.0
        for j in range(i + 1, n):
            if not sets[i] and not sets[j]:
                sim = 0.0
            else:
                intersection = len(sets[i] & sets[j])
                union = len(sets[i] | sets[j])
                sim = intersection / union if union > 0 else 0.0
            W[i, j] = sim
            W[j, i] = sim
    return W


def _cosine_similarity_matrix(features: list[dict[str, Any]], key: str) -> np.ndarray:
    """Build NxN cosine similarity matrix for dict-valued vectors (e.g. lab_vector)."""
    n = len(features)
    # Collect all keys across patients
    all_keys: set[str] = set()
    dicts: list[dict[str, float]] = []
    for f in features:
        raw = f.get(key) or {}
        d: dict[str, float] = {}
        if isinstance(raw, dict):
            for k, v in raw.items():
                try:
                    d[str(k)] = float(v)
                except (ValueError, TypeError):
                    pass
        dicts.append(d)
        all_keys.update(d.keys())

    if not all_keys:
        return np.zeros((n, n), dtype=np.float64)

    sorted_keys = sorted(all_keys)
    key_idx = {k: i for i, k in enumerate(sorted_keys)}
    dim = len(sorted_keys)

    # Build dense matrix
    mat = np.zeros((n, dim), dtype=np.float64)
    for i, d in enumerate(dicts):
        for k, v in d.items():
            mat[i, key_idx[k]] = v

    # Compute norms
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    normed = mat / norms

    W = normed @ normed.T
    np.clip(W, 0.0, 1.0, out=W)
    return W


def build_modality_matrix(features: list[dict[str, Any]], modality: str) -> np.ndarray:
    """Build NxN pairwise similarity matrix for one modality."""
    if modality == "labs":
        return _cosine_similarity_matrix(features, "lab_vector")
    key_map = {
        "conditions": "condition_concepts",
        "drugs": "drug_concepts",
        "procedures": "procedure_concepts",
    }
    key = key_map.get(modality)
    if key is None:
        msg = f"Unknown modality: {modality}"
        raise ValueError(msg)
    return _jaccard_similarity_matrix(features, key)


def _modality_has_data(features: list[dict[str, Any]], modality: str) -> bool:
    """Check if at least some patients have data for this modality."""
    if modality == "labs":
        key = "lab_vector"
    else:
        key_map = {
            "conditions": "condition_concepts",
            "drugs": "drug_concepts",
            "procedures": "procedure_concepts",
        }
        key = key_map.get(modality, modality)

    count = 0
    for f in features:
        raw = f.get(key) or {}
        if isinstance(raw, dict) and len(raw) > 0:
            count += 1
        elif isinstance(raw, list) and len(raw) > 0:
            count += 1
        if count >= 2:
            return True
    return False


def knn_filter(W: np.ndarray, k: int = 20) -> np.ndarray:
    """Keep only top-K nearest neighbors per row, normalize rows to sum to 1.

    Returns the S_k matrix used in SNF iterations.
    """
    n = W.shape[0]
    k = min(k, n - 1)
    S = np.zeros_like(W)

    for i in range(n):
        row = W[i].copy()
        row[i] = -np.inf  # exclude self
        if k < n - 1:
            # Find top-k indices
            top_k_idx = np.argpartition(row, -(k))[-k:]
            S[i, top_k_idx] = W[i, top_k_idx]
        else:
            S[i] = W[i].copy()
        S[i, i] = 0.0  # no self-loop in KNN graph

    # Symmetrize
    S = (S + S.T) / 2.0

    # Row-normalize
    row_sums = S.sum(axis=1, keepdims=True)
    row_sums = np.where(row_sums == 0, 1.0, row_sums)
    S = S / row_sums

    return np.asarray(S)


def _row_normalize(P: np.ndarray) -> np.ndarray:
    """Normalize rows to sum to 1."""
    row_sums = P.sum(axis=1, keepdims=True)
    row_sums = np.where(row_sums == 0, 1.0, row_sums)
    return P / row_sums


def snf_fuse(
    similarity_matrices: list[np.ndarray],
    n_iterations: int = 20,
    k_neighbors: int = 20,
) -> tuple[np.ndarray, int, float]:
    """Core SNF iterative diffusion loop.

    Returns (fused_matrix, actual_iterations, final_delta).
    """
    m = len(similarity_matrices)
    if m == 0:
        msg = "No similarity matrices provided"
        raise ValueError(msg)
    if m == 1:
        return (_row_normalize(similarity_matrices[0]), 0, 0.0)

    n = similarity_matrices[0].shape[0]

    # Build S_k (KNN-filtered) for each modality
    S_list = [knn_filter(W, k_neighbors) for W in similarity_matrices]

    # Initialize P_k = row-normalized W_k
    P_list = [_row_normalize(W.copy()) for W in similarity_matrices]

    final_delta = 0.0
    actual_iters = n_iterations

    for t in range(n_iterations):
        P_new_list: list[np.ndarray] = []
        for k in range(m):
            # Average of all P_j where j != k
            others = [P_list[j] for j in range(m) if j != k]
            P_avg = np.mean(others, axis=0)

            # Diffusion: P_k_new = S_k @ P_avg @ S_k^T
            P_k_new = S_list[k] @ P_avg @ S_list[k].T

            # Row-normalize
            P_k_new = _row_normalize(P_k_new)
            P_new_list.append(P_k_new)

        # Compute convergence delta
        delta = max(
            float(np.max(np.abs(P_new_list[k] - P_list[k])))
            for k in range(m)
        )
        P_list = P_new_list
        final_delta = delta

        if delta < 1e-6:
            actual_iters = t + 1
            break

    # Fused matrix = average of all P_k
    fused = np.mean(P_list, axis=0)
    # Symmetrize
    fused = (fused + fused.T) / 2.0

    return (fused, actual_iters, final_delta)


def detect_communities(
    fused: np.ndarray,
    n_communities: int | None = None,
) -> tuple[np.ndarray, int]:
    """Detect communities on fused similarity using SpectralClustering.

    If n_communities is None, tries k=2..8 and picks best silhouette score.
    Returns (labels, n_clusters).
    """
    n = fused.shape[0]
    if n < 3:
        return (np.zeros(n, dtype=np.int32), 1)

    # Ensure non-negative for affinity
    affinity = np.clip(fused, 0.0, None)
    np.fill_diagonal(affinity, 0.0)

    if n_communities is not None:
        k = min(n_communities, n - 1)
        k = max(k, 2)
        sc = SpectralClustering(
            n_clusters=k,
            affinity="precomputed",
            random_state=42,
            assign_labels="kmeans",
        )
        labels = sc.fit_predict(affinity)
        return (labels, k)

    # Auto-detect best k
    best_k = 2
    best_score = -1.0
    max_k = min(9, n)

    for k in range(2, max_k):
        try:
            sc = SpectralClustering(
                n_clusters=k,
                affinity="precomputed",
                random_state=42,
                assign_labels="kmeans",
            )
            labels = sc.fit_predict(affinity)
            if len(set(labels)) < 2:
                continue
            score = float(silhouette_score(affinity, labels, metric="precomputed"))
            if score > best_score:
                best_score = score
                best_k = k
        except Exception:
            continue

    sc = SpectralClustering(
        n_clusters=best_k,
        affinity="precomputed",
        random_state=42,
        assign_labels="kmeans",
    )
    labels = sc.fit_predict(affinity)
    return (labels, best_k)


def compute_modality_contributions(
    similarity_matrices: list[np.ndarray],
    modality_names: list[str],
    fused: np.ndarray,
) -> list[dict[str, Any]]:
    """Compute each modality's correlation with the fused matrix.

    Uses Frobenius inner product normalized by norms.
    """
    fused_norm = np.linalg.norm(fused, "fro")
    if fused_norm == 0:
        return [{"modality": name, "weight": 1.0 / len(modality_names)} for name in modality_names]

    raw_weights: list[float] = []
    for W in similarity_matrices:
        w_norm = np.linalg.norm(W, "fro")
        if w_norm == 0:
            raw_weights.append(0.0)
        else:
            corr: float = float(np.sum(W * fused)) / float(w_norm * fused_norm)
            raw_weights.append(corr if corr > 0.0 else 0.0)

    total = sum(raw_weights)
    if total == 0:
        total = 1.0

    return [
        {"modality": name, "weight": round(w / total, 4)}
        for name, w in zip(modality_names, raw_weights)
    ]


def _extract_top_k_edges(
    fused: np.ndarray,
    person_ids: list[int],
    top_k: int,
) -> list[dict[str, Any]]:
    """Extract top-K edges per patient from fused matrix (not full NxN)."""
    n = fused.shape[0]
    top_k = min(top_k, n - 1)
    seen: set[tuple[int, int]] = set()
    edges: list[dict[str, Any]] = []

    for i in range(n):
        row = fused[i].copy()
        row[i] = -1.0
        top_idx = np.argpartition(row, -top_k)[-top_k:]
        top_idx = top_idx[np.argsort(row[top_idx])[::-1]]

        for j in top_idx:
            if row[j] <= 0:
                continue
            pair = (min(i, int(j)), max(i, int(j)))
            if pair not in seen:
                seen.add(pair)
                edges.append({
                    "person_a": person_ids[pair[0]],
                    "person_b": person_ids[pair[1]],
                    "similarity": round(float(fused[pair[0], pair[1]]), 6),
                })

    return edges


async def fuse_patient_network(
    pool: asyncpg.Pool,
    source_id: int,
    person_ids: list[int],
    n_neighbors: int = 20,
    n_iterations: int = 20,
    top_k_edges: int = 10,
) -> dict[str, Any]:
    """Orchestrate SNF pipeline: fetch features, build matrices, fuse, detect communities."""
    from app.routers.patient_similarity import _fetch_feature_vectors

    capped_at: int | None = None
    if len(person_ids) > MAX_PATIENTS:
        capped_at = MAX_PATIENTS
        person_ids = person_ids[:MAX_PATIENTS]

    features = await _fetch_feature_vectors(pool, source_id, person_ids)
    if len(features) < 10:
        msg = f"Only {len(features)} patients have feature vectors. Need at least 10 for SNF."
        raise ValueError(msg)

    # Build person_id list matching feature order
    pid_list = [f["person_id"] for f in features]
    n = len(features)

    # Build per-modality similarity matrices
    modality_names: list[str] = []
    matrices: list[np.ndarray] = []
    all_modalities = ["conditions", "drugs", "procedures", "labs"]

    for mod in all_modalities:
        if _modality_has_data(features, mod):
            W = build_modality_matrix(features, mod)
            matrices.append(W)
            modality_names.append(mod)
            logger.info("SNF: built %s matrix (%dx%d)", mod, n, n)
        else:
            logger.info("SNF: skipping %s (no data)", mod)

    if not matrices:
        msg = "No modalities have sufficient data for SNF."
        raise ValueError(msg)

    # Run SNF
    fused, actual_iters, final_delta = snf_fuse(
        matrices, n_iterations=n_iterations, k_neighbors=n_neighbors,
    )

    # Detect communities
    labels, n_clusters = detect_communities(fused)

    # Build community list
    communities: list[dict[str, Any]] = []
    for c in range(n_clusters):
        member_mask = labels == c
        member_ids = [pid_list[i] for i in range(n) if member_mask[i]]
        communities.append({
            "id": c,
            "member_ids": member_ids,
            "size": len(member_ids),
        })

    # Extract top-K edges per patient
    edges = _extract_top_k_edges(fused, pid_list, top_k_edges)

    # Modality contributions
    contributions = compute_modality_contributions(matrices, modality_names, fused)

    return {
        "edges": edges,
        "communities": communities,
        "modality_contributions": contributions,
        "convergence": {
            "iterations": actual_iters,
            "final_delta": round(final_delta, 8),
        },
        "n_patients": n,
        "capped_at": capped_at,
    }
