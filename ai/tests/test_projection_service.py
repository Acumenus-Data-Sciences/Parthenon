"""Unit tests for projection service helpers."""

import sys
import types

import numpy as np

from app.services.projection import (
    ProjectionResult,
    QualityReport,
    ProjectedPoint,
    cache_result,
    get_cached_projection,
    _compute_knn_edges,
)


def test_projection_cache_separates_dimensions():
    """2D and 3D projections must not collide in cache."""
    result_2d = ProjectionResult(
        points=[ProjectedPoint(id="a", x=0.1, y=0.2, z=0.0, metadata={}, cluster_id=0)],
        edges=[],
        clusters=[],
        quality=QualityReport(outlier_ids=[], duplicate_pairs=[], orphan_ids=[]),
        stats={"sampled": 1},
    )
    result_3d = ProjectionResult(
        points=[ProjectedPoint(id="a", x=0.1, y=0.2, z=0.3, metadata={}, cluster_id=0)],
        edges=[],
        clusters=[],
        quality=QualityReport(outlier_ids=[], duplicate_pairs=[], orphan_ids=[]),
        stats={"sampled": 1},
    )

    cache_result("docs", 5000, 10000, result_2d, 2)
    cache_result("docs", 5000, 10000, result_3d, 3)

    assert get_cached_projection("docs", 5000, 10000, 2) is result_2d
    assert get_cached_projection("docs", 5000, 10000, 3) is result_3d


def test_compute_knn_edges_deduplicates_pairs():
    """k-NN edge generation should not emit both A-B and B-A."""
    embeddings = np.array(
        [
            [1.0, 0.0, 0.0],
            [0.99, 0.01, 0.0],
            [0.0, 1.0, 0.0],
        ],
        dtype=np.float32,
    )

    class FakeNearestNeighbors:
        def __init__(self, *, n_neighbors, metric, algorithm):
            self.n_neighbors = n_neighbors
            self.metric = metric
            self.algorithm = algorithm

        def fit(self, fitted_embeddings):
            self.fitted_embeddings = fitted_embeddings
            return self

        def kneighbors(self, query_embeddings, return_distance=True):
            assert return_distance is True
            assert query_embeddings is self.fitted_embeddings
            return (
                np.array(
                    [
                        [0.0, 0.01, 1.0],
                        [0.0, 0.01, 0.99],
                        [0.0, 0.99, 1.0],
                    ],
                    dtype=np.float32,
                ),
                np.array(
                    [
                        [0, 1, 2],
                        [1, 0, 2],
                        [2, 1, 0],
                    ],
                    dtype=np.int64,
                ),
            )

    fake_neighbors = types.ModuleType("sklearn.neighbors")
    fake_neighbors.NearestNeighbors = FakeNearestNeighbors
    fake_sklearn = types.ModuleType("sklearn")
    fake_sklearn.neighbors = fake_neighbors

    original_sklearn = sys.modules.get("sklearn")
    original_neighbors = sys.modules.get("sklearn.neighbors")
    sys.modules["sklearn"] = fake_sklearn
    sys.modules["sklearn.neighbors"] = fake_neighbors
    try:
        edges = _compute_knn_edges(embeddings, ["a", "b", "c"], neighbors=2)
    finally:
        if original_sklearn is not None:
            sys.modules["sklearn"] = original_sklearn
        else:
            sys.modules.pop("sklearn", None)
        if original_neighbors is not None:
            sys.modules["sklearn.neighbors"] = original_neighbors
        else:
            sys.modules.pop("sklearn.neighbors", None)

    assert edges
    pairs = {(edge.source_id, edge.target_id) for edge in edges}
    assert len(pairs) == len(edges)
    assert ("a", "b") in pairs
    assert all(edge.source_id < edge.target_id for edge in edges)
    assert all(0.0 <= edge.similarity <= 1.0 for edge in edges)


def test_compute_knn_edges_handles_single_point():
    """A single vector should not produce graph edges."""
    embeddings = np.array([[1.0, 0.0, 0.0]], dtype=np.float32)

    assert _compute_knn_edges(embeddings, ["solo"]) == []
