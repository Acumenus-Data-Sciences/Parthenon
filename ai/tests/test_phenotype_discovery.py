import numpy as np
import pytest

from app.services import phenotype_discovery as svc


def test_consensus_cluster_never_chooses_more_clusters_than_subsample_size() -> None:
    matrix = np.random.RandomState(42).rand(10, 4)

    co_matrix, labels, best_k, silhouette = svc.consensus_cluster(
        matrix,
        k_range=(9, 10),
        n_iterations=2,
        subsample_ratio=0.8,
    )

    assert co_matrix.shape == (10, 10)
    assert len(labels) == 10
    assert best_k <= 7
    assert isinstance(silhouette, float)


def test_parallel_jobs_uses_all_available_cpus_by_default(monkeypatch) -> None:
    monkeypatch.delenv("PHENOTYPE_DISCOVERY_N_JOBS", raising=False)
    monkeypatch.setattr(svc, "_available_cpu_count", lambda: 8)

    assert svc._parallel_jobs() == 8


def test_parallel_jobs_can_be_capped_by_env(monkeypatch) -> None:
    monkeypatch.setenv("PHENOTYPE_DISCOVERY_N_JOBS", "3")
    monkeypatch.setattr(svc, "_available_cpu_count", lambda: 8)

    assert svc._parallel_jobs() == 3


def test_parallel_starts_defaults_to_parallel_jobs(monkeypatch) -> None:
    monkeypatch.delenv("PHENOTYPE_DISCOVERY_KMEANS_STARTS", raising=False)
    monkeypatch.setenv("PHENOTYPE_DISCOVERY_N_JOBS", "5")
    monkeypatch.setattr(svc, "_available_cpu_count", lambda: 8)

    assert svc._parallel_starts("PHENOTYPE_DISCOVERY_KMEANS_STARTS") == 5


def test_extract_json_object_accepts_fenced_json() -> None:
    parsed = svc._extract_json_object('```json\n{"capable": true, "confidence": 0.8}\n```')

    assert parsed == {"capable": True, "confidence": 0.8}


def test_interpretation_prompt_marks_low_silhouette_as_exploratory() -> None:
    result = {
        "quality": {"k_used": 2, "method": "kmeans", "silhouette_score": 0.08},
        "feature_matrix_info": {"n_patients": 100, "n_features": 20},
        "original_n_patients": 500,
        "capped_at": 100,
        "clusters": [],
    }

    proposed, prompt = svc.build_phenotype_interpretation_prompt(result)

    assert "exploratory soft segments" in proposed
    assert "Return only JSON" in prompt


@pytest.mark.asyncio
async def test_discover_phenotypes_caps_large_cohorts_and_reports_metadata(monkeypatch) -> None:
    async def fake_build_feature_matrix(pool, person_ids, source_id):
        assert source_id == 47
        assert len(person_ids) == svc.MAX_PATIENTS
        matrix = np.array(
            [
                [0.0, 0.0],
                [0.1, 0.0],
                [4.0, 4.0],
                [4.1, 4.2],
            ],
            dtype=np.float64,
        )
        return matrix, ["age_bucket", "gender"], [101, 102, 103, 104]

    async def fake_profile_clusters(feature_matrix, labels, feature_names, pool, source_id):
        return [
            {
                "cluster_id": 0,
                "size": int((labels == 0).sum()),
                "top_conditions": [],
                "top_drugs": [],
                "lab_profile": [],
                "demographics": {
                    "mean_age_bucket": 1.0,
                    "gender_distribution": {"male": 0.5, "female": 0.5},
                    "size": int((labels == 0).sum()),
                },
            },
            {
                "cluster_id": 1,
                "size": int((labels == 1).sum()),
                "top_conditions": [],
                "top_drugs": [],
                "lab_profile": [],
                "demographics": {
                    "mean_age_bucket": 1.0,
                    "gender_distribution": {"male": 0.5, "female": 0.5},
                    "size": int((labels == 1).sum()),
                },
            },
        ]

    monkeypatch.setattr(svc, "build_feature_matrix", fake_build_feature_matrix)
    monkeypatch.setattr(svc, "profile_clusters", fake_profile_clusters)
    monkeypatch.setattr(svc, "_build_heatmap", lambda *args, **kwargs: [])

    result = await svc.discover_phenotypes(
        pool=None,
        source_id=47,
        person_ids=list(range(6000)),
        method="kmeans",
        k=2,
    )

    assert result["capped_at"] == svc.MAX_PATIENTS
    assert result["original_n_patients"] == 6000
    assert result["feature_matrix_info"]["n_patients"] == 4
    assert result["quality"]["k_used"] == 2
    assert len(result["assignments"]) == 4


@pytest.mark.asyncio
async def test_discover_phenotypes_uses_fast_kmeans_for_large_consensus_requests(monkeypatch) -> None:
    matrix = np.vstack([
        np.random.RandomState(1).normal(0, 0.1, size=(6, 3)),
        np.random.RandomState(2).normal(4, 0.1, size=(6, 3)),
    ])

    async def fake_build_feature_matrix(pool, person_ids, source_id):
        return matrix, ["age_bucket", "gender", "dx_1"], list(range(100, 112))

    async def fake_profile_clusters(feature_matrix, labels, feature_names, pool, source_id):
        return [
            {
                "cluster_id": cluster_id,
                "size": int((labels == cluster_id).sum()),
                "top_conditions": [],
                "top_drugs": [],
                "lab_profile": [],
                "demographics": {
                    "mean_age_bucket": 1.0,
                    "gender_distribution": {"male": 0.5, "female": 0.5},
                    "size": int((labels == cluster_id).sum()),
                },
            }
            for cluster_id in sorted(set(labels))
        ]

    monkeypatch.setattr(svc, "CONSENSUS_MAX_PATIENTS", 10)
    monkeypatch.setattr(svc, "build_feature_matrix", fake_build_feature_matrix)
    monkeypatch.setattr(svc, "profile_clusters", fake_profile_clusters)
    monkeypatch.setattr(svc, "_build_heatmap", lambda *args, **kwargs: [])

    result = await svc.discover_phenotypes(
        pool=None,
        source_id=47,
        person_ids=list(range(12)),
        method="consensus",
        k=2,
    )

    assert result["quality"]["method"] == "kmeans"
    assert result["quality"]["k_used"] == 2
    assert len(result["assignments"]) == 12
