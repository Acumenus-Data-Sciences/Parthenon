"""Patient embedding service.

Generates 512-dimensional patient embeddings by aggregating SapBERT concept
embeddings across clinical dimensions (demographics, conditions, measurements,
drugs, procedures, genomics).
"""

import logging

import numpy as np
from numpy.typing import NDArray

from app.services.sapbert import get_sapbert_service

logger = logging.getLogger(__name__)

PATIENT_EMBEDDING_DIM = 512
SAPBERT_DIM = 768
MAX_CONCEPTS_PER_DIM = 50

# Dimension slices within the 512-dim patient vector
SLICE_DEMOGRAPHICS = slice(0, 32)       # 32 dims
SLICE_CONDITIONS = slice(32, 160)       # 128 dims
SLICE_MEASUREMENTS = slice(160, 224)    # 64 dims
SLICE_DRUGS = slice(224, 352)           # 128 dims
SLICE_PROCEDURES = slice(352, 448)      # 96 dims
SLICE_GENOMICS = slice(448, 512)        # 64 dims


def _encode_and_project(texts: list[str], target_dim: int) -> NDArray[np.float64]:
    """SapBERT-encode texts, mean-pool, and project to target dimension via truncation.

    Args:
        texts: Concept names or IDs to encode.
        target_dim: Number of dimensions in the target slice.

    Returns:
        1-D array of length target_dim.
    """
    if not texts:
        return np.zeros(target_dim, dtype=np.float64)

    capped = texts[:MAX_CONCEPTS_PER_DIM]
    sapbert = get_sapbert_service()
    embeddings = sapbert.encode(capped)  # list[list[float]], each 768-dim
    arr = np.array(embeddings, dtype=np.float64)

    # Mean pool across all concept embeddings
    pooled = arr.mean(axis=0)  # (768,)

    # Project to target dimension via truncation
    projected: NDArray[np.float64] = pooled[:target_dim]
    return projected


def _encode_demographics(features: dict) -> NDArray[np.float64]:
    """Encode demographic features as normalized numeric vector.

    Fills the 32-dim demographics slice:
      - [0]: age_bucket / 20 (normalized)
      - [1]: gender as +1 (male) / -1 (female) / 0 (unknown)
      - [2:]: race as sparse encoding (remaining dims zero-padded)
    """
    dim = SLICE_DEMOGRAPHICS.stop - SLICE_DEMOGRAPHICS.start  # 32
    vec = np.zeros(dim, dtype=np.float64)

    # Age bucket: normalize by dividing by 20 (typical max bucket ~18-20)
    age_bucket = features.get("age_bucket", 0)
    if age_bucket is not None:
        vec[0] = float(age_bucket) / 20.0

    # Gender: concept ID mapping — 8507=male(+1), 8532=female(-1), else 0
    gender_id = features.get("gender_concept_id", 0)
    if gender_id == 8507:
        vec[1] = 1.0
    elif gender_id == 8532:
        vec[1] = -1.0

    # Race: one-hot style encoding in dims 2-31
    # Common OMOP race concept IDs mapped to fixed indices
    race_id = features.get("race_concept_id", 0)
    race_map: dict[int, int] = {
        8516: 2,   # Black or African American
        8527: 3,   # White
        8515: 4,   # Asian
        8557: 5,   # Native Hawaiian or Other Pacific Islander
        8657: 6,   # American Indian or Alaska Native
    }
    idx = race_map.get(race_id)
    if idx is not None and idx < dim:
        vec[idx] = 1.0

    return vec


def _encode_measurements(features: dict) -> NDArray[np.float64]:
    """Encode measurement z-scores directly, clipped to [-5, 5] and normalized to [-1, 1].

    Expects features["lab_vector"] as a list of z-score floats.
    """
    dim = SLICE_MEASUREMENTS.stop - SLICE_MEASUREMENTS.start  # 64
    lab_vector = features.get("lab_vector")
    if not lab_vector:
        return np.zeros(dim, dtype=np.float64)

    arr = np.array(lab_vector[:dim], dtype=np.float64)
    # Clip to [-5, 5] then normalize to [-1, 1]
    arr = np.clip(arr, -5.0, 5.0) / 5.0

    # Pad to full dimension if shorter
    if len(arr) < dim:
        arr = np.pad(arr, (0, dim - len(arr)))

    return arr


def compute_patient_embedding(features: dict) -> list[float]:
    """Compute a 512-dimensional patient embedding from clinical features.

    Args:
        features: Dictionary containing patient clinical data:
            - age_bucket: int — age group bucket
            - gender_concept_id: int — OMOP gender concept ID
            - race_concept_id: int — OMOP race concept ID
            - condition_concepts: list[str] — condition concept IDs as strings
            - lab_vector: list[float] — measurement z-scores
            - drug_concepts: list[str] — drug concept IDs as strings
            - procedure_concepts: list[str] — procedure concept IDs as strings
            - variant_genes: list[str] — gene names for genomic dimension

    Returns:
        L2-normalized 512-dimensional embedding as list of floats.
    """
    embedding = np.zeros(PATIENT_EMBEDDING_DIM, dtype=np.float64)

    # Demographics (0-32)
    embedding[SLICE_DEMOGRAPHICS] = _encode_demographics(features)

    # Conditions (32-160): SapBERT encode concept IDs
    condition_dim = SLICE_CONDITIONS.stop - SLICE_CONDITIONS.start
    condition_concepts: list[str] = features.get("condition_concepts", []) or []
    embedding[SLICE_CONDITIONS] = _encode_and_project(
        [str(c) for c in condition_concepts], condition_dim,
    )

    # Measurements (160-224): z-scores
    embedding[SLICE_MEASUREMENTS] = _encode_measurements(features)

    # Drugs (224-352): SapBERT encode concept IDs
    drug_dim = SLICE_DRUGS.stop - SLICE_DRUGS.start
    drug_concepts: list[str] = features.get("drug_concepts", []) or []
    embedding[SLICE_DRUGS] = _encode_and_project(
        [str(c) for c in drug_concepts], drug_dim,
    )

    # Procedures (352-448): SapBERT encode concept IDs
    proc_dim = SLICE_PROCEDURES.stop - SLICE_PROCEDURES.start
    procedure_concepts: list[str] = features.get("procedure_concepts", []) or []
    embedding[SLICE_PROCEDURES] = _encode_and_project(
        [str(c) for c in procedure_concepts], proc_dim,
    )

    # Genomics (448-512): SapBERT encode gene names
    genomics_dim = SLICE_GENOMICS.stop - SLICE_GENOMICS.start
    variant_genes: list[str] = features.get("variant_genes", []) or []
    embedding[SLICE_GENOMICS] = _encode_and_project(variant_genes, genomics_dim)

    # L2 normalize the full vector
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding.tolist()
