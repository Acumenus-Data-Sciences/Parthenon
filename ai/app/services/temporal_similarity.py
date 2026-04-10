"""Temporal similarity service using Dynamic Time Warping (DTW).

Compares patient lab trajectories over time using DTW distance on z-score
normalized measurement series. Pure numpy implementation with no additional
dependencies.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta

import asyncpg
import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)


def dtw_distance(
    series_a: NDArray[np.float64],
    series_b: NDArray[np.float64],
) -> tuple[float, list[tuple[int, int]]]:
    """Compute DTW distance between two 1-D time series.

    Uses dynamic programming with O(n*m) cost matrix. Distance is the
    square root of the accumulated cost normalized by the maximum series
    length for length-invariance.

    Returns:
        (normalized_distance, alignment_path) where alignment_path is a
        list of (i, j) index pairs from start to end.
    """
    n = len(series_a)
    m = len(series_b)

    if n == 0 or m == 0:
        return (0.0, [])

    cost = np.full((n + 1, m + 1), np.inf, dtype=np.float64)
    cost[0, 0] = 0.0

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = (series_a[i - 1] - series_b[j - 1]) ** 2
            cost[i, j] = d + min(cost[i - 1, j], cost[i, j - 1], cost[i - 1, j - 1])

    # Traceback for alignment path
    path: list[tuple[int, int]] = []
    i, j = n, m
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        candidates = [
            (cost[i - 1, j - 1], i - 1, j - 1),
            (cost[i - 1, j], i - 1, j),
            (cost[i, j - 1], i, j - 1),
        ]
        _, i, j = min(candidates, key=lambda x: x[0])
    path.reverse()

    normalized = math.sqrt(cost[n, m] / max(n, m))
    return (normalized, path)


def zscore_series(
    series: list[dict[str, float | str]],
    mean: float,
    std: float,
) -> NDArray[np.float64]:
    """Z-score normalize a series using provided population statistics.

    Args:
        series: List of {date, value} dicts.
        mean: Population mean for this measurement type.
        std: Population standard deviation.

    Returns:
        Numpy array of z-scored values.
    """
    values = np.array([float(s["value"]) for s in series], dtype=np.float64)
    if std > 0:
        return (values - mean) / std
    return values - mean


async def extract_lab_series(
    pool: asyncpg.Pool,
    person_id: int,
    source_schema: str,
    measurement_concept_ids: list[int] | None = None,
    max_days: int = 730,
) -> dict[int, list[dict[str, float | str]]]:
    """Extract lab measurement time series for a patient.

    Queries the measurement table for (date, value) pairs grouped by
    measurement_concept_id. Limits to the last `max_days` days from the
    patient's most recent measurement. Caps at 365 points per series.

    Returns:
        {concept_id: [{date: str, value: float}, ...]} ordered by date.
    """
    async with pool.acquire() as conn:
        # Find the patient's most recent measurement date for the cutoff
        cutoff_row = await conn.fetchrow(
            f"SELECT MAX(measurement_date) AS max_date "
            f"FROM {source_schema}.measurement "
            f"WHERE person_id = $1 AND value_as_number IS NOT NULL",
            person_id,
        )

        if cutoff_row is None or cutoff_row["max_date"] is None:
            return {}

        max_date = cutoff_row["max_date"]
        if isinstance(max_date, datetime):
            min_date = max_date - timedelta(days=max_days)
        else:
            min_date = max_date - timedelta(days=max_days)

        query = (
            f"SELECT measurement_concept_id, measurement_date, value_as_number "
            f"FROM {source_schema}.measurement "
            f"WHERE person_id = $1 "
            f"  AND value_as_number IS NOT NULL "
            f"  AND measurement_date >= $2 "
            f"  AND measurement_date <= $3 "
        )
        params: list[int | object] = [person_id, min_date, max_date]

        if measurement_concept_ids:
            query += f"  AND measurement_concept_id = ANY($4::bigint[]) "
            params.append(measurement_concept_ids)

        query += "ORDER BY measurement_concept_id, measurement_date"

        rows = await conn.fetch(query, *params)

    # Group by concept_id
    result: dict[int, list[dict[str, float | str]]] = {}
    for row in rows:
        cid = int(row["measurement_concept_id"])
        entry: dict[str, float | str] = {
            "date": str(row["measurement_date"]),
            "value": float(row["value_as_number"]),
        }
        if cid not in result:
            result[cid] = []
        result[cid].append(entry)

    # Cap at 365 points per series
    for cid in result:
        if len(result[cid]) > 365:
            result[cid] = result[cid][-365:]

    return result


async def compute_temporal_similarity(
    pool: asyncpg.Pool,
    person_a_id: int,
    person_b_id: int,
    source_schema: str,
    vocab_schema: str,
    measurement_concept_ids: list[int] | None = None,
) -> dict:
    """Compute temporal trajectory similarity between two patients.

    Extracts lab series for both patients, z-score normalizes using
    population statistics, then computes DTW distance for each shared
    measurement type. Returns overall similarity and per-measurement
    breakdowns.

    Args:
        pool: asyncpg connection pool.
        person_a_id: First patient person_id.
        person_b_id: Second patient person_id.
        source_schema: CDM schema name (e.g., 'omop', 'synpuf').
        vocab_schema: Vocabulary schema name (e.g., 'vocab').
        measurement_concept_ids: Optional filter for specific measurement types.

    Returns:
        {overall_similarity, per_measurement: [{concept_id, concept_name,
         dtw_distance, similarity, series_a, series_b, alignment}]}
    """
    series_a = await extract_lab_series(
        pool, person_a_id, source_schema, measurement_concept_ids
    )
    series_b = await extract_lab_series(
        pool, person_b_id, source_schema, measurement_concept_ids
    )

    if not series_a and not series_b:
        return {"overall_similarity": 0.0, "per_measurement": []}

    # Determine shared measurement types
    if measurement_concept_ids is not None:
        shared_ids = [
            cid for cid in measurement_concept_ids
            if cid in series_a and cid in series_b
        ]
    else:
        shared_ids = sorted(set(series_a.keys()) & set(series_b.keys()))

    if not shared_ids:
        return {"overall_similarity": 0.0, "per_measurement": []}

    # Resolve concept names
    concept_names: dict[int, str] = {}
    if shared_ids:
        async with pool.acquire() as conn:
            name_rows = await conn.fetch(
                f"SELECT concept_id, concept_name FROM {vocab_schema}.concept "
                f"WHERE concept_id = ANY($1::bigint[])",
                shared_ids,
            )
            for row in name_rows:
                concept_names[int(row["concept_id"])] = str(row["concept_name"])

    per_measurement: list[dict] = []
    dtw_distances: list[float] = []

    for cid in shared_ids:
        sa = series_a[cid]
        sb = series_b[cid]

        # Skip single-point series (can't compute meaningful DTW)
        if len(sa) < 2 or len(sb) < 2:
            logger.debug(
                "Skipping concept_id=%d: series too short (a=%d, b=%d)",
                cid, len(sa), len(sb),
            )
            continue

        # Get population statistics for z-score normalization
        async with pool.acquire() as conn:
            stats_row = await conn.fetchrow(
                f"SELECT AVG(value_as_number) AS mean_val, "
                f"STDDEV(value_as_number) AS std_val "
                f"FROM {source_schema}.measurement "
                f"WHERE measurement_concept_id = $1 AND value_as_number IS NOT NULL",
                cid,
            )

        pop_mean = float(stats_row["mean_val"]) if stats_row and stats_row["mean_val"] is not None else 0.0
        pop_std = float(stats_row["std_val"]) if stats_row and stats_row["std_val"] is not None else 1.0

        z_a = zscore_series(sa, pop_mean, pop_std)
        z_b = zscore_series(sb, pop_mean, pop_std)

        distance, alignment = dtw_distance(z_a, z_b)
        similarity = 1.0 / (1.0 + distance)

        dtw_distances.append(distance)
        per_measurement.append({
            "concept_id": cid,
            "concept_name": concept_names.get(cid, f"Concept {cid}"),
            "dtw_distance": round(distance, 4),
            "similarity": round(similarity, 4),
            "series_a": sa,
            "series_b": sb,
            "alignment": alignment,
        })

    if dtw_distances:
        mean_distance = sum(dtw_distances) / len(dtw_distances)
        overall_similarity = 1.0 / (1.0 + mean_distance)
    else:
        overall_similarity = 0.0

    return {
        "overall_similarity": round(overall_similarity, 4),
        "per_measurement": per_measurement,
    }
