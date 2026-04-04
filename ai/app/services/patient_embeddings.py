"""Patient embedding service.

Generates 768-dimensional patient embeddings by aggregating concept
embeddings across clinical dimensions (demographics, conditions, measurements,
drugs, procedures, genomics).

Uses Ollama (GPU) or SapBERT (CPU fallback) for concept encoding — both
produce native 768-dim embeddings.

Batch mode consolidates all concepts across patients into minimal encoding calls.
"""

import logging

import numpy as np
from numpy.typing import NDArray

from app.services.sapbert import get_sapbert_service

logger = logging.getLogger(__name__)

PATIENT_EMBEDDING_DIM = 768
ENCODER_DIM = 768
MAX_CONCEPTS_PER_DIM = 50

# Dimension slices within the 768-dim patient vector
SLICE_DEMOGRAPHICS = slice(0, 32)       # 32 dims
SLICE_CONDITIONS = slice(32, 224)       # 192 dims
SLICE_MEASUREMENTS = slice(224, 320)    # 96 dims
SLICE_DRUGS = slice(320, 512)           # 192 dims
SLICE_PROCEDURES = slice(512, 672)      # 160 dims
SLICE_GENOMICS = slice(672, 768)        # 96 dims


def _encode_and_project(texts: list[str], target_dim: int) -> NDArray[np.float64]:
    """Encode texts, mean-pool, and project to target dimension via truncation."""
    if not texts:
        return np.zeros(target_dim, dtype=np.float64)

    capped = texts[:MAX_CONCEPTS_PER_DIM]
    svc = get_sapbert_service()
    embeddings = svc.encode(capped)
    arr = np.array(embeddings, dtype=np.float64)
    pooled = arr.mean(axis=0)
    projected: NDArray[np.float64] = pooled[:target_dim]
    return projected


def _encode_demographics(features: dict) -> NDArray[np.float64]:
    """Encode demographic features as normalized numeric vector (32 dims)."""
    dim = SLICE_DEMOGRAPHICS.stop - SLICE_DEMOGRAPHICS.start
    vec = np.zeros(dim, dtype=np.float64)

    age_bucket = features.get("age_bucket", 0)
    if age_bucket is not None:
        vec[0] = float(age_bucket) / 20.0

    gender_id = features.get("gender_concept_id", 0)
    if gender_id == 8507:
        vec[1] = 1.0
    elif gender_id == 8532:
        vec[1] = -1.0

    race_id = features.get("race_concept_id", 0)
    race_map: dict[int, int] = {
        8516: 2, 8527: 3, 8515: 4, 8557: 5, 8657: 6,
    }
    idx = race_map.get(race_id)
    if idx is not None and idx < dim:
        vec[idx] = 1.0

    return vec


def _encode_measurements(features: dict) -> NDArray[np.float64]:
    """Encode measurement z-scores, clipped to [-5, 5] and normalized to [-1, 1]."""
    dim = SLICE_MEASUREMENTS.stop - SLICE_MEASUREMENTS.start
    lab_vector = features.get("lab_vector")
    if not lab_vector:
        return np.zeros(dim, dtype=np.float64)

    if isinstance(lab_vector, dict):
        values = list(lab_vector.values())
    else:
        values = lab_vector

    arr = np.array(values[:dim], dtype=np.float64)
    arr = np.clip(arr, -5.0, 5.0) / 5.0

    if len(arr) < dim:
        arr = np.pad(arr, (0, dim - len(arr)))

    return arr


def compute_patient_embedding(features: dict) -> list[float]:
    """Compute a single patient's 768-dimensional embedding."""
    embedding = np.zeros(PATIENT_EMBEDDING_DIM, dtype=np.float64)

    embedding[SLICE_DEMOGRAPHICS] = _encode_demographics(features)

    condition_dim = SLICE_CONDITIONS.stop - SLICE_CONDITIONS.start
    condition_concepts = features.get("condition_concepts", []) or []
    embedding[SLICE_CONDITIONS] = _encode_and_project(
        [str(c) for c in condition_concepts], condition_dim,
    )

    embedding[SLICE_MEASUREMENTS] = _encode_measurements(features)

    drug_dim = SLICE_DRUGS.stop - SLICE_DRUGS.start
    drug_concepts = features.get("drug_concepts", []) or []
    embedding[SLICE_DRUGS] = _encode_and_project(
        [str(c) for c in drug_concepts], drug_dim,
    )

    proc_dim = SLICE_PROCEDURES.stop - SLICE_PROCEDURES.start
    procedure_concepts = features.get("procedure_concepts", []) or []
    embedding[SLICE_PROCEDURES] = _encode_and_project(
        [str(c) for c in procedure_concepts], proc_dim,
    )

    genomics_dim = SLICE_GENOMICS.stop - SLICE_GENOMICS.start
    raw_genes = features.get("variant_genes", []) or []
    # variant_genes may be list[str] or list[{gene, pathogenicity}] from PHP JSONB
    variant_genes = [
        g["gene"] if isinstance(g, dict) else str(g)
        for g in raw_genes
    ]
    embedding[SLICE_GENOMICS] = _encode_and_project(variant_genes, genomics_dim)

    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding.tolist()


# ---------------------------------------------------------------------------
# Batch-optimized path: one encode call per dimension for all patients
# ---------------------------------------------------------------------------

def _batch_encode_dimension(
    patients: list[dict],
    field: str,
    target_dim: int,
) -> list[NDArray[np.float64]]:
    """Encode a single dimension for all patients in one bulk call.

    Collects all unique concept texts across all patients, encodes them in
    a single call, then mean-pools per patient using the shared lookup.
    """
    per_patient_texts: list[list[str]] = []
    all_unique_texts: list[str] = []
    text_to_idx: dict[str, int] = {}

    for p in patients:
        raw = p.get(field, []) or []
        # Handle variant_genes stored as [{gene, pathogenicity}] dicts
        texts = [
            c["gene"] if isinstance(c, dict) and "gene" in c else str(c)
            for c in raw[:MAX_CONCEPTS_PER_DIM]
        ]
        per_patient_texts.append(texts)
        for t in texts:
            if t not in text_to_idx:
                text_to_idx[t] = len(all_unique_texts)
                all_unique_texts.append(t)

    if not all_unique_texts:
        zero = np.zeros(target_dim, dtype=np.float64)
        return [zero] * len(patients)

    # Single bulk encode call for all unique concepts
    svc = get_sapbert_service()
    all_embeddings = np.array(svc.encode(all_unique_texts), dtype=np.float64)

    # Mean-pool per patient
    results: list[NDArray[np.float64]] = []
    for texts in per_patient_texts:
        if not texts:
            results.append(np.zeros(target_dim, dtype=np.float64))
            continue
        indices = [text_to_idx[t] for t in texts]
        pooled = all_embeddings[indices].mean(axis=0)
        results.append(pooled[:target_dim])

    return results


def compute_patient_embeddings_batch(patients: list[dict]) -> list[list[float]]:
    """Compute 768-dim embeddings for a batch of patients with minimal encode calls.

    Instead of 4 encode calls per patient, this deduplicates concepts across
    all patients and makes one encode call per dimension — typically 4 calls
    total regardless of batch size.
    """
    n = len(patients)
    embeddings = np.zeros((n, PATIENT_EMBEDDING_DIM), dtype=np.float64)

    # Demographics + measurements — no encoding needed
    for i, p in enumerate(patients):
        embeddings[i, SLICE_DEMOGRAPHICS] = _encode_demographics(p)
        embeddings[i, SLICE_MEASUREMENTS] = _encode_measurements(p)

    # Concept dimensions — one bulk call each
    dim_configs = [
        ("condition_concepts", SLICE_CONDITIONS),
        ("drug_concepts", SLICE_DRUGS),
        ("procedure_concepts", SLICE_PROCEDURES),
        ("variant_genes", SLICE_GENOMICS),
    ]

    for field, slc in dim_configs:
        target_dim = slc.stop - slc.start
        encoded = _batch_encode_dimension(patients, field, target_dim)
        for i, vec in enumerate(encoded):
            embeddings[i, slc] = vec

    # L2 normalize each patient
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms = np.where(norms > 0, norms, 1.0)
    embeddings = embeddings / norms

    return embeddings.tolist()
