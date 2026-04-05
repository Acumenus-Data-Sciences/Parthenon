"""Benchmark Abby's ChromaDB hot paths and recent efficiency changes.

Usage:
  python ai/scripts/chroma_benchmark.py
  python ai/scripts/chroma_benchmark.py --json
  docker exec -i parthenon-ai python /app/scripts/chroma_benchmark.py --json

The script measures:
- cached collection access vs repeated get_or_create_collection
- OHDSI retrieval with and without the removed count() probe
- Abby memory legacy dual-write vs shared single-write
- legacy per-user query vs shared filtered query
- FAQ-style multi-collection scans vs single shared collection scans
- startup doc-ingest disabled fast path

Temp collections created for the benchmark are deleted automatically.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

AI_DIR = Path(__file__).resolve().parents[1]
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

from app import main as main_module
from app.chroma.client import get_chroma_client
from app.chroma.collections import _collection_cache, get_docs_collection
from app.chroma.embeddings import get_general_embedder
from app.main import _startup_ingest_docs


@dataclass(frozen=True)
class BenchStats:
    iterations: int
    mean_ms: float
    median_ms: float
    min_ms: float
    max_ms: float

    def as_dict(self) -> dict[str, float | int]:
        return {
            "iterations": self.iterations,
            "mean_ms": round(self.mean_ms, 3),
            "median_ms": round(self.median_ms, 3),
            "min_ms": round(self.min_ms, 3),
            "max_ms": round(self.max_ms, 3),
        }


def _measure(fn: Callable[[], Any], *, iterations: int, warmup: int) -> BenchStats:
    for _ in range(warmup):
        fn()

    samples: list[float] = []
    for _ in range(iterations):
        start = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - start) * 1000.0)

    return BenchStats(
        iterations=iterations,
        mean_ms=statistics.mean(samples),
        median_ms=statistics.median(samples),
        min_ms=min(samples),
        max_ms=max(samples),
    )


def _benchmark_collection_access() -> dict[str, dict[str, float | int]]:
    client = get_chroma_client()
    general_embedder = get_general_embedder()

    _collection_cache.clear()
    get_docs_collection()

    legacy = _measure(
        lambda: client.get_or_create_collection(
            name="docs",
            embedding_function=general_embedder,
            metadata={"hnsw:space": "cosine"},
        ),
        iterations=100,
        warmup=5,
    )
    cached = _measure(
        lambda: get_docs_collection(),
        iterations=1000,
        warmup=20,
    )
    return {
        "collection_access_legacy": legacy.as_dict(),
        "collection_access_cached": cached.as_dict(),
    }


def _benchmark_ohdsi_query() -> dict[str, dict[str, float | int]]:
    collection = get_chroma_client().get_collection("ohdsi_papers")
    query_only = _measure(
        lambda: collection.get(limit=5, include=["metadatas"]),
        iterations=75,
        warmup=5,
    )
    count_plus_get = _measure(
        lambda: (collection.count(), collection.get(limit=5, include=["metadatas"])),
        iterations=75,
        warmup=5,
    )
    return {
        "ohdsi_query_only": query_only.as_dict(),
        "ohdsi_count_plus_get": count_plus_get.as_dict(),
    }


def _benchmark_write_and_query_shapes() -> dict[str, dict[str, float | int]]:
    client = get_chroma_client()
    bench_id = uuid.uuid4().hex[:8]
    collection_names = {
        "legacy_user": f"bench_legacy_user_{bench_id}",
        "legacy_unified": f"bench_legacy_unified_{bench_id}",
        "shared": f"bench_shared_{bench_id}",
        "per_user_query": f"bench_per_user_query_{bench_id}",
        "shared_query": f"bench_shared_query_{bench_id}",
    }

    try:
        for name in collection_names.values():
            try:
                client.delete_collection(name)
            except Exception:
                pass

        legacy_user = client.get_or_create_collection(
            name=collection_names["legacy_user"],
            metadata={"hnsw:space": "cosine"},
        )
        legacy_unified = client.get_or_create_collection(
            name=collection_names["legacy_unified"],
            metadata={"hnsw:space": "cosine"},
        )
        shared = client.get_or_create_collection(
            name=collection_names["shared"],
            metadata={"hnsw:space": "cosine"},
        )
        per_user_query = client.get_or_create_collection(
            name=collection_names["per_user_query"],
            metadata={"hnsw:space": "cosine"},
        )
        shared_query = client.get_or_create_collection(
            name=collection_names["shared_query"],
            metadata={"hnsw:space": "cosine"},
        )

        dim = 32
        base_embedding = [0.03125] * dim
        base_document = "Q: How do I build a cohort?\nA: Use the cohort builder."
        base_metadata = {
            "user_id": 1,
            "page_context": "cohort_builder",
            "timestamp": "2026-04-04T00:00:00+00:00",
            "source": "abby_chat",
        }

        legacy_counter = {"i": 0}
        shared_counter = {"i": 0}

        def legacy_dual_write() -> None:
            idx = legacy_counter["i"]
            legacy_counter["i"] += 1
            doc_id = f"conv_1_{idx}"
            legacy_user.add(
                ids=[doc_id],
                embeddings=[base_embedding],
                documents=[base_document],
                metadatas=[base_metadata],
            )
            legacy_unified.upsert(
                ids=[f"agg_{doc_id}"],
                embeddings=[base_embedding],
                documents=[base_document],
                metadatas=[base_metadata],
            )

        def shared_single_write() -> None:
            idx = shared_counter["i"]
            shared_counter["i"] += 1
            doc_id = f"conv_1_{idx}"
            shared.upsert(
                ids=[doc_id],
                embeddings=[base_embedding],
                documents=[base_document],
                metadatas=[base_metadata],
            )

        write_results = {
            "legacy_dual_write": _measure(legacy_dual_write, iterations=40, warmup=3).as_dict(),
            "shared_single_write": _measure(shared_single_write, iterations=40, warmup=3).as_dict(),
        }

        entries: list[dict[str, Any]] = []
        for user_id in range(1, 11):
            for idx in range(120):
                embedding = [0.0] * dim
                embedding[0] = 1.0 if user_id == 1 else 0.85 if user_id == 2 else 0.2
                embedding[1] = idx / 120.0
                embedding[2] = user_id / 10.0
                entries.append({
                    "id": f"u{user_id}_{idx}",
                    "embedding": embedding,
                    "document": f"Q: cohort question {idx} for user {user_id}\nA: answer {idx}",
                    "metadata": {
                        "user_id": user_id,
                        "page_context": "general",
                        "timestamp": "2026-04-04T00:00:00+00:00",
                        "source": "abby_chat",
                    },
                })

        user_1_entries = [entry for entry in entries if entry["metadata"]["user_id"] == 1]
        per_user_query.add(
            ids=[entry["id"] for entry in user_1_entries],
            embeddings=[entry["embedding"] for entry in user_1_entries],
            documents=[entry["document"] for entry in user_1_entries],
            metadatas=[entry["metadata"] for entry in user_1_entries],
        )
        shared_query.add(
            ids=[entry["id"] for entry in entries],
            embeddings=[entry["embedding"] for entry in entries],
            documents=[entry["document"] for entry in entries],
            metadatas=[entry["metadata"] for entry in entries],
        )

        query_embedding = [[1.0] + [0.0] * (dim - 1)]
        query_results = {
            "legacy_per_user_query": _measure(
                lambda: per_user_query.query(query_embeddings=query_embedding, n_results=5),
                iterations=100,
                warmup=5,
            ).as_dict(),
            "shared_filtered_query": _measure(
                lambda: shared_query.query(
                    query_embeddings=query_embedding,
                    n_results=5,
                    where={"user_id": 1},
                ),
                iterations=100,
                warmup=5,
            ).as_dict(),
        }

        return {**write_results, **query_results}
    finally:
        for name in collection_names.values():
            try:
                client.delete_collection(name)
            except Exception:
                pass


def _benchmark_scan_shape() -> dict[str, dict[str, float | int]]:
    client = get_chroma_client()
    bench_id = uuid.uuid4().hex[:8]
    shared_name = f"bench_scan_shared_{bench_id}"
    legacy_names = [f"bench_scan_conversations_user_{user_id}_{bench_id}" for user_id in range(1, 11)]

    try:
        for name in [shared_name, *legacy_names]:
            try:
                client.delete_collection(name)
            except Exception:
                pass

        shared = client.get_or_create_collection(name=shared_name, metadata={"hnsw:space": "cosine"})
        legacy_collections = [
            client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})
            for name in legacy_names
        ]

        dim = 16
        now = datetime.now(timezone.utc)
        cutoff = (now - timedelta(days=7)).isoformat()
        entries: list[tuple[int, str, str, dict[str, Any], list[float]]] = []
        for user_id in range(1, 11):
            for idx in range(150):
                metadata = {
                    "user_id": user_id,
                    "timestamp": (now - timedelta(days=idx % 5)).isoformat(),
                    "page_context": "general",
                    "source": "abby_chat",
                }
                document = f"Q: question {idx} user {user_id}\nA: answer {idx}"
                embedding = [0.0] * dim
                embedding[0] = 1.0
                embedding[1] = user_id / 10.0
                embedding[2] = idx / 150.0
                entries.append((user_id, f"u{user_id}_{idx}", document, metadata, embedding))

        for user_id, collection in enumerate(legacy_collections, start=1):
            subset = [entry for entry in entries if entry[0] == user_id]
            collection.add(
                ids=[entry[1] for entry in subset],
                documents=[entry[2] for entry in subset],
                metadatas=[entry[3] for entry in subset],
                embeddings=[entry[4] for entry in subset],
            )

        shared.add(
            ids=[entry[1] for entry in entries],
            documents=[entry[2] for entry in entries],
            metadatas=[entry[3] for entry in entries],
            embeddings=[entry[4] for entry in entries],
        )

        def legacy_multi_collection_scan() -> list[tuple[int, str, str]]:
            recent: list[tuple[int, str, str]] = []
            for user_id, collection in enumerate(legacy_collections, start=1):
                rows = collection.get(include=["documents", "metadatas"])
                for document, metadata in zip(rows.get("documents") or [], rows.get("metadatas") or []):
                    timestamp = str((metadata or {}).get("timestamp", ""))
                    if timestamp >= cutoff:
                        lines = (document or "").split("\n", 1)
                        recent.append((user_id, lines[0], lines[1] if len(lines) > 1 else ""))
            return recent

        def shared_single_collection_scan() -> list[tuple[int, str, str]]:
            recent: list[tuple[int, str, str]] = []
            rows = shared.get(include=["documents", "metadatas"])
            for document, metadata in zip(rows.get("documents") or [], rows.get("metadatas") or []):
                metadata = metadata or {}
                timestamp = str(metadata.get("timestamp", ""))
                if timestamp >= cutoff:
                    lines = (document or "").split("\n", 1)
                    recent.append((int(metadata.get("user_id", 0) or 0), lines[0], lines[1] if len(lines) > 1 else ""))
            return recent

        return {
            "legacy_multi_collection_scan": _measure(
                legacy_multi_collection_scan,
                iterations=40,
                warmup=3,
            ).as_dict(),
            "shared_single_collection_scan": _measure(
                shared_single_collection_scan,
                iterations=40,
                warmup=3,
            ).as_dict(),
        }
    finally:
        for name in [shared_name, *legacy_names]:
            try:
                client.delete_collection(name)
            except Exception:
                pass


def _benchmark_startup_ingest_disabled() -> dict[str, dict[str, float | int]]:
    async def bench_once() -> None:
        old = main_module.settings.startup_ingest_docs
        main_module.settings.startup_ingest_docs = False
        try:
            await _startup_ingest_docs()
        finally:
            main_module.settings.startup_ingest_docs = old

    def runner() -> None:
        asyncio.run(bench_once())

    stats = _measure(runner, iterations=25, warmup=3)
    return {"startup_ingest_disabled": stats.as_dict()}


def run_benchmark() -> dict[str, dict[str, float | int]]:
    results: dict[str, dict[str, float | int]] = {}
    results.update(_benchmark_collection_access())
    results.update(_benchmark_ohdsi_query())
    results.update(_benchmark_write_and_query_shapes())
    results.update(_benchmark_scan_shape())
    results.update(_benchmark_startup_ingest_disabled())
    return results


def _render_text(results: dict[str, dict[str, float | int]]) -> str:
    lines = ["Chroma Benchmark Results", ""]
    for name, stats in results.items():
        lines.append(
            (
                f"{name}: mean={stats['mean_ms']}ms median={stats['median_ms']}ms "
                f"min={stats['min_ms']}ms max={stats['max_ms']}ms "
                f"(n={stats['iterations']})"
            )
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark Abby ChromaDB hot paths")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of plain text")
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional file path to write the benchmark payload",
    )
    args = parser.parse_args()

    results = run_benchmark()
    payload = json.dumps(results, indent=2)

    if args.output:
        args.output.write_text(payload + "\n")

    if args.json:
        print(payload)
    else:
        print(_render_text(results))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
