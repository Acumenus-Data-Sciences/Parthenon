"""Phenotype discovery via consensus clustering on OMOP patient feature vectors.

Discovers latent patient subgroups within a cohort by clustering on clinical
features (diagnoses, drugs, labs, demographics) extracted from the
patient_feature_vectors table.
"""

import json
import logging
import os
from typing import Any

import asyncpg
import httpx
import numpy as np
from joblib import Parallel, delayed
from sklearn.cluster import KMeans, MiniBatchKMeans, SpectralClustering
from sklearn.metrics import silhouette_score

from app.config import settings

try:
    from threadpoolctl import threadpool_limits
except ImportError:  # pragma: no cover - scikit-learn normally provides this
    threadpool_limits = None

logger = logging.getLogger(__name__)

# Keep large interactive requests comfortably below the Laravel proxy timeout.
MAX_PATIENTS = 1000
CONSENSUS_MAX_PATIENTS = 750
MAX_FEATURES_PER_DOMAIN = 3000
DEFAULT_K_RANGE = (2, 10)
DEFAULT_N_ITERATIONS = 30
DEFAULT_SUBSAMPLE_RATIO = 0.8


def _available_cpu_count() -> int:
    """Return the CPU count available to this container/process."""
    try:
        return max(1, len(os.sched_getaffinity(0)))
    except (AttributeError, OSError):
        return max(1, os.cpu_count() or 1)


def _parallel_jobs() -> int:
    """Resolve phenotype-discovery parallelism; -1/empty means all CPUs."""
    raw = os.getenv("PHENOTYPE_DISCOVERY_N_JOBS", "-1").strip()
    cpu_count = _available_cpu_count()
    if raw in {"", "-1", "all", "max"}:
        return cpu_count
    try:
        requested = int(raw)
    except ValueError:
        logger.warning("Invalid PHENOTYPE_DISCOVERY_N_JOBS=%r; using %d", raw, cpu_count)
        return cpu_count
    if requested <= 0:
        return cpu_count
    return min(requested, cpu_count)


def _parallel_starts(env_name: str, default: int | None = None) -> int:
    """Resolve parallel model restarts; -1/empty means match parallel jobs."""
    jobs = _parallel_jobs()
    raw = os.getenv(env_name, "-1" if default is None else str(default)).strip()
    if raw in {"", "-1", "all", "max"}:
        return jobs
    try:
        requested = int(raw)
    except ValueError:
        logger.warning("Invalid %s=%r; using %d", env_name, raw, jobs)
        return jobs
    if requested <= 0:
        return jobs
    return min(requested, jobs)


def _extract_json_object(text: str) -> dict[str, Any]:
    """Extract the first JSON object from an LLM response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return {}
        try:
            parsed = json.loads(cleaned[start:end + 1])
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}


def _host_gateway_base_url(base_url: str) -> str | None:
    """Fallback for Linux hosts where host.docker.internal maps to the wrong bridge."""
    if "host.docker.internal" not in base_url:
        return None

    try:
        with open("/proc/net/route", encoding="utf-8") as route_file:
            for line in route_file.readlines()[1:]:
                fields = line.strip().split()
                if len(fields) < 3 or fields[1] != "00000000":
                    continue
                gateway_hex = fields[2]
                octets = [
                    str(int(gateway_hex[i:i + 2], 16))
                    for i in range(6, -1, -2)
                ]
                gateway = ".".join(octets)
                return base_url.replace("host.docker.internal", gateway)
    except OSError:
        return None

    return None


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

    # Collect prevalent feature keys across patients. Rare one-off concepts add
    # a lot of dense matrix cost while contributing little clustering signal.
    dx_counts: dict[str, int] = {}
    rx_counts: dict[str, int] = {}
    lab_counts: dict[str, int] = {}

    for rec in parsed:
        conds = rec["condition_concepts"]
        if isinstance(conds, dict):
            for cid in conds:
                key = f"dx_{cid}"
                dx_counts[key] = dx_counts.get(key, 0) + 1
        elif isinstance(conds, list):
            for cid in conds:
                key = f"dx_{cid}"
                dx_counts[key] = dx_counts.get(key, 0) + 1

        drugs = rec["drug_concepts"]
        if isinstance(drugs, dict):
            for cid in drugs:
                key = f"rx_{cid}"
                rx_counts[key] = rx_counts.get(key, 0) + 1
        elif isinstance(drugs, list):
            for cid in drugs:
                key = f"rx_{cid}"
                rx_counts[key] = rx_counts.get(key, 0) + 1

        labs = rec["lab_vector"]
        if isinstance(labs, dict):
            for lid in labs:
                key = f"lab_{lid}"
                lab_counts[key] = lab_counts.get(key, 0) + 1
        elif isinstance(labs, list):
            for lid, value in enumerate(labs):
                if value is None:
                    continue
                key = f"lab_{lid}"
                lab_counts[key] = lab_counts.get(key, 0) + 1

    def top_feature_keys(counts: dict[str, int]) -> list[str]:
        ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        return sorted(key for key, _ in ranked[:MAX_FEATURES_PER_DOMAIN])

    sorted_dx = top_feature_keys(dx_counts)
    sorted_rx = top_feature_keys(rx_counts)
    sorted_lab = top_feature_keys(lab_counts)
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
            for lid, zscore in enumerate(labs):
                key = f"lab_{lid}"
                if key in col_idx:
                    try:
                        matrix[i, col_idx[key]] = float(zscore)
                    except (ValueError, TypeError):
                        pass

    return matrix, feature_names, person_id_order


def _effective_k(k: int | None, n_patients: int, default: int = 4) -> int:
    """Choose a valid cluster count for a matrix with n patients."""
    if n_patients < 3:
        return 1
    selected = k or default
    selected = min(selected, n_patients - 1)
    return max(selected, 2)


def _fit_kmeans(feature_matrix: np.ndarray, k: int) -> np.ndarray:
    """Fit KMeans with parallel restarts, using mini-batches for large matrices."""
    n_patients, n_features = feature_matrix.shape
    use_minibatch = n_patients * n_features > 1_500_000
    n_starts = _parallel_starts("PHENOTYPE_DISCOVERY_KMEANS_STARTS")
    seeds = np.random.RandomState(42).randint(0, 2**31, size=n_starts)

    def run_start(seed: int) -> tuple[float, np.ndarray]:
        if use_minibatch:
            model = MiniBatchKMeans(
                n_clusters=k,
                batch_size=min(512, n_patients),
                n_init=1,
                random_state=int(seed),
            )
        else:
            model = KMeans(n_clusters=k, n_init=1, random_state=int(seed))

        if threadpool_limits is None:
            labels = model.fit_predict(feature_matrix)
        else:
            # We parallelize restarts at the joblib level, so constrain each
            # inner fit to one native thread and let joblib fill the CPU.
            with threadpool_limits(limits=1):
                labels = model.fit_predict(feature_matrix)
        return float(model.inertia_), labels

    results = Parallel(n_jobs=_parallel_jobs(), prefer="threads")(
        delayed(run_start)(int(seed)) for seed in seeds
    )
    _, labels = min(results, key=lambda result: result[0])
    return labels


def _safe_silhouette(feature_matrix: np.ndarray, labels: np.ndarray) -> float:
    """Compute a bounded-cost silhouette score, returning 0 when undefined."""
    if len(set(labels)) < 2 or feature_matrix.shape[0] < 3:
        return 0.0
    try:
        sample_size = min(1000, feature_matrix.shape[0])
        return float(silhouette_score(feature_matrix, labels, sample_size=sample_size, random_state=42))
    except Exception:
        logger.debug("Silhouette score failed", exc_info=True)
        return 0.0


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
    subsample_size = min(n, subsample_size, CONSENSUS_MAX_PATIENTS)

    # Build co-clustering matrix across iterations
    co_count = np.zeros((n, n), dtype=np.float64)
    co_sampled = np.zeros((n, n), dtype=np.float64)

    k_min, k_max = k_range
    k_max = min(k_max, n - 1, subsample_size - 1)
    if k_min > k_max:
        k_min = 2
        k_max = max(2, min(n - 1, subsample_size - 1, 3))

    seeds = rng.randint(0, 2**31, size=n_iterations)

    def run_iteration(seed: int) -> tuple[np.ndarray, np.ndarray]:
        iter_rng = np.random.RandomState(int(seed))
        idx = iter_rng.choice(n, size=subsample_size, replace=False)
        sub_matrix = feature_matrix[idx]
        k_iter = iter_rng.randint(k_min, k_max + 1)
        km = KMeans(n_clusters=k_iter, n_init=1, random_state=iter_rng.randint(0, 2**31))
        if threadpool_limits is None:
            labels_iter = km.fit_predict(sub_matrix)
        else:
            # Consensus parallelizes across iterations, so keep each inner fit
            # single-threaded to avoid N jobs each spawning N BLAS/OpenMP threads.
            with threadpool_limits(limits=1):
                labels_iter = km.fit_predict(sub_matrix)
        return idx, labels_iter

    iterations = Parallel(n_jobs=_parallel_jobs(), prefer="threads")(
        delayed(run_iteration)(int(seed)) for seed in seeds
    )

    for idx, labels_iter in iterations:

        # Update co-clustering counts in one vectorized block. The old nested
        # loops were the main timeout driver for large cohorts.
        idx_grid = np.ix_(idx, idx)
        co_sampled[idx_grid] += 1
        co_count[idx_grid] += labels_iter[:, None] == labels_iter[None, :]

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
            distance_matrix = 1.0 - co_matrix
            np.fill_diagonal(distance_matrix, 0.0)
            sil = silhouette_score(distance_matrix, labels_k, metric="precomputed")
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


def _feature_statement(feature: dict[str, Any]) -> str:
    prevalence = float(feature.get("prevalence", 0.0))
    overall = float(feature.get("overall_prevalence", 0.0))
    direction = "enriched" if prevalence >= overall else "depleted"
    return (
        f"{feature.get('name', 'Unknown')} "
        f"({direction}: {prevalence * 100:.0f}% vs {overall * 100:.0f}% overall)"
    )


def _top_directional_features(
    features: list[dict[str, Any]],
    direction: str,
    limit: int = 4,
) -> list[dict[str, Any]]:
    if direction == "enriched":
        filtered = [
            feature for feature in features
            if float(feature.get("prevalence", 0.0)) > float(feature.get("overall_prevalence", 0.0))
        ]
        return sorted(
            filtered,
            key=lambda feature: float(feature.get("prevalence", 0.0)) - float(feature.get("overall_prevalence", 0.0)),
            reverse=True,
        )[:limit]

    filtered = [
        feature for feature in features
        if float(feature.get("prevalence", 0.0)) < float(feature.get("overall_prevalence", 0.0))
    ]
    return sorted(
        filtered,
        key=lambda feature: float(feature.get("overall_prevalence", 0.0)) - float(feature.get("prevalence", 0.0)),
        reverse=True,
    )[:limit]


def build_phenotype_interpretation_prompt(result: dict[str, Any]) -> tuple[str, str]:
    """Create a deterministic interpretation and a MedGemma review prompt."""
    quality = result.get("quality", {})
    feature_info = result.get("feature_matrix_info", {})
    silhouette = float(quality.get("silhouette_score", 0.0))
    method = str(quality.get("method", "unknown"))
    k_used = int(quality.get("k_used", 0) or 0)
    n_patients = int(feature_info.get("n_patients", 0) or 0)
    original_n = int(result.get("original_n_patients", n_patients) or n_patients)
    capped_at = result.get("capped_at")

    lines = [
        (
            f"Phenotype discovery found {k_used} {method} clusters in {n_patients} analyzed patients"
            f" from {original_n} cohort members."
        ),
    ]
    if capped_at is not None:
        lines.append(f"The cohort was capped at {capped_at} patients for computational feasibility.")
    if silhouette < 0.25:
        lines.append(
            f"The silhouette score is low ({silhouette:.3f}), so the clusters should be treated as exploratory soft segments rather than definitive clinical subtypes."
        )

    for cluster in result.get("clusters", []):
        cluster_id = int(cluster.get("cluster_id", 0)) + 1
        size = int(cluster.get("size", 0) or 0)
        demographics = cluster.get("demographics", {})
        age_bucket = float(demographics.get("mean_age_bucket", 0.0) or 0.0)
        male_ratio = float(demographics.get("gender_distribution", {}).get("male", 0.0) or 0.0)
        features = list(cluster.get("top_conditions", [])) + list(cluster.get("top_drugs", []))
        enriched = [_feature_statement(feature) for feature in _top_directional_features(features, "enriched")]
        depleted = [_feature_statement(feature) for feature in _top_directional_features(features, "depleted")]

        parts = [
            f"Cluster {cluster_id} has {size} patients",
            f"mean age bucket {age_bucket:.2f}",
            f"{male_ratio * 100:.0f}% male",
        ]
        if enriched:
            parts.append("enriched for " + "; ".join(enriched))
        if depleted:
            parts.append("depleted for " + "; ".join(depleted))
        lines.append(". ".join(parts) + ".")

    proposed = "\n".join(lines)
    prompt = (
        "You are a clinical epidemiology reviewer for OMOP phenotype discovery. "
        "Evaluate whether the proposed interpretation is supported by the supplied cluster statistics. "
        "Do not invent diagnoses or causal claims. Treat low silhouette scores as weak evidence. "
        "Return only JSON with keys: capable(boolean), agrees(boolean), confidence(number 0-1), "
        "corrected_interpretation(string), cautions(array of strings).\n\n"
        f"Cluster statistics and proposed interpretation:\n{proposed}"
    )
    return proposed, prompt


async def review_phenotype_interpretation(result: dict[str, Any]) -> dict[str, Any]:
    """Ask MedGemma to review the deterministic phenotype interpretation."""
    proposed, prompt = build_phenotype_interpretation_prompt(result)
    review = {
        "status": "not_requested",
        "provider": "ollama",
        "model": settings.phenotype_interpreter_model,
        "capable": None,
        "agrees": None,
        "confidence": 0.0,
        "proposed_interpretation": proposed,
        "corrected_interpretation": proposed,
        "cautions": [],
    }

    if not settings.phenotype_interpreter_enabled:
        review["status"] = "disabled"
        return review

    base_urls = [settings.phenotype_llm_base_url.rstrip("/")]
    fallback = _host_gateway_base_url(base_urls[0])
    if fallback and fallback.rstrip("/") not in base_urls:
        base_urls.append(fallback.rstrip("/"))

    last_error = ""
    for base_url in base_urls:
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(
                    float(settings.phenotype_interpreter_timeout),
                    connect=3.0,
                ),
                trust_env=False,
            ) as client:
                response = await client.post(
                    f"{base_url}/api/chat",
                    json={
                        "model": settings.phenotype_interpreter_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": False,
                        "options": {
                            "temperature": 0,
                            "num_predict": settings.phenotype_interpreter_num_predict,
                        },
                        "keep_alive": settings.abby_ollama_keep_alive,
                    },
                )
                response.raise_for_status()
                payload = response.json()

            content = str(payload.get("message", {}).get("content", ""))
            parsed = _extract_json_object(content)
            if not parsed:
                return {
                    **review,
                    "status": "unparseable",
                    "raw_response": content[:2000],
                }

            cautions = parsed.get("cautions", [])
            return {
                **review,
                "status": "reviewed",
                "base_url": base_url,
                "capable": bool(parsed.get("capable", False)),
                "agrees": bool(parsed.get("agrees", False)),
                "confidence": max(0.0, min(1.0, float(parsed.get("confidence", 0.0) or 0.0))),
                "corrected_interpretation": str(parsed.get("corrected_interpretation") or proposed),
                "cautions": cautions if isinstance(cautions, list) else [],
            }
        except Exception as exc:
            last_error = str(exc)
            logger.warning("Phenotype interpretation review failed via %s: %s", base_url, exc)

    return {
        **review,
        "status": "unavailable",
        "error": last_error,
    }


async def discover_phenotypes(
    pool: asyncpg.Pool,
    source_id: int,
    person_ids: list[int],
    k: int | None = None,
    method: str = "consensus",
    include_interpretation: bool = False,
) -> dict[str, Any]:
    """Orchestrate phenotype discovery: build features, cluster, profile."""
    original_n_patients = len(person_ids)
    capped_at: int | None = None

    # Cap at MAX_PATIENTS
    if original_n_patients > MAX_PATIENTS:
        rng = np.random.RandomState(42)
        selected = rng.choice(original_n_patients, size=MAX_PATIENTS, replace=False)
        person_ids = [person_ids[i] for i in sorted(selected)]
        capped_at = MAX_PATIENTS

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
        if matrix.shape[0] > CONSENSUS_MAX_PATIENTS:
            logger.info(
                "Cohort has %d feature vectors; using fast kmeans instead of consensus",
                matrix.shape[0],
            )
            best_k = _effective_k(k, matrix.shape[0])
            best_labels = _fit_kmeans(matrix, best_k)
            method = "kmeans"
            best_silhouette = _safe_silhouette(matrix, best_labels)
        else:
            k_range = (k, k) if k else DEFAULT_K_RANGE
            _, best_labels, best_k, best_silhouette = consensus_cluster(
                matrix, k_range=k_range,
            )
            # Consensus can fail on very sparse binary data — fall back to kmeans
            if best_silhouette <= 0 or len(set(best_labels)) < 2:
                logger.info("Consensus clustering found no structure, falling back to kmeans")
                best_k = _effective_k(k, matrix.shape[0])
                best_labels = _fit_kmeans(matrix, best_k)
                method = "kmeans"
                best_silhouette = _safe_silhouette(matrix, best_labels)
    elif method in ("kmeans", "spectral"):
        effective_k = _effective_k(k, matrix.shape[0], default=3)

        if method == "kmeans":
            best_labels = _fit_kmeans(matrix, effective_k)
        else:
            sc = SpectralClustering(n_clusters=effective_k, random_state=42, n_init=3)
            best_labels = sc.fit_predict(matrix)

        best_k = effective_k
        best_silhouette = _safe_silhouette(matrix, best_labels)

    # Profile clusters
    profiles = await profile_clusters(matrix, best_labels, feature_names, pool, source_id)

    # Assignments
    assignments = [
        {"person_id": pid, "cluster_id": int(best_labels[i])}
        for i, pid in enumerate(person_id_order)
    ]

    # Heatmap
    heatmap = _build_heatmap(matrix, best_labels, feature_names)

    result = {
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
        "capped_at": capped_at,
        "original_n_patients": original_n_patients,
    }

    if include_interpretation:
        result["interpretation"] = await review_phenotype_interpretation(result)

    return result
