"""Versioned, membership-aware OMOP clinical-reference synchronization.

This module deliberately never deletes or rewrites the active collection. It
builds an explicitly named replacement, reuses source vectors only when the
source embedding space is proven compatible, and audits every eligible concept
before an operator changes ``CHROMA_CLINICAL_COLLECTION``.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator

import httpx
from sqlalchemy import Engine, create_engine, text

from app.chroma.client import get_chroma_client
from app.chroma.clinical import (
    EXCLUDED_VOCABULARIES,
    REQUIRED_VOCABULARIES,
    TARGET_DOMAINS,
)
from app.chroma.embeddings import get_clinical_embedder
from app.config import settings
from app.services.sapbert import OllamaEmbeddingService, get_sapbert_service

COLLECTION_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,62}$")
POLICY_VERSION = "clinical-reference-v3-irsf-cpt-preserved"
DEFAULT_QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant:6333").rstrip("/")


@dataclass(frozen=True)
class ClinicalConcept:
    concept_id: int
    concept_name: str
    domain_id: str
    vocabulary_id: str
    concept_class_id: str

    @property
    def document_id(self) -> str:
        return f"concept_{self.concept_id}"

    def metadata(self) -> dict[str, Any]:
        return {
            "concept_id": self.concept_id,
            "domain": self.domain_id,
            "vocabulary_id": self.vocabulary_id,
            "concept_class_id": self.concept_class_id,
            "category": self.domain_id,
            "source": "clinical_reference",
            "source_type": "omop_concept",
            "type": "clinical_concept",
        }


@dataclass
class SyncStats:
    expected: int = 0
    written: int = 0
    reused_embeddings: int = 0
    generated_embeddings: int = 0
    batches: int = 0


def _validate_identifier(value: str, label: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"Unsafe {label}: {value!r}")
    return value


def validate_collection_name(name: str) -> str:
    if not COLLECTION_NAME_RE.fullmatch(name):
        raise ValueError(
            "Collection names must be 3-63 characters using letters, numbers, '.', '_' or '-'"
        )
    return name


def embedding_model_identity() -> str:
    service = get_sapbert_service()
    if isinstance(service, OllamaEmbeddingService):
        return f"ollama:{settings.ollama_embedding_model}"
    return f"sapbert:{settings.sapbert_model}"


def _eligibility_query(schema: str) -> str:
    schema = _validate_identifier(schema, "vocabulary schema")
    return f"""
        SELECT concept_id, concept_name, domain_id, vocabulary_id, concept_class_id
        FROM {schema}.concept
        WHERE invalid_reason IS NULL
          AND standard_concept = 'S'
          AND (domain_id = ANY(:domains) OR vocabulary_id = ANY(:required_vocabularies))
          AND concept_name IS NOT NULL
          AND LENGTH(concept_name) > 2
          AND vocabulary_id != ALL(:excluded_vocabularies)
          AND concept_id > :after_id
        ORDER BY concept_id
        LIMIT :batch_size
    """


def iter_concept_batches(
    engine: Engine,
    *,
    schema: str,
    batch_size: int,
) -> Iterator[list[ClinicalConcept]]:
    """Read every current eligible concept using deterministic keyset paging."""
    if batch_size < 1 or batch_size > 10_000:
        raise ValueError("batch_size must be between 1 and 10000")

    query = text(_eligibility_query(schema))
    after_id = -1
    while True:
        with engine.connect() as connection:
            rows = connection.execute(
                query,
                {
                    "domains": list(TARGET_DOMAINS),
                    "required_vocabularies": list(REQUIRED_VOCABULARIES),
                    "excluded_vocabularies": list(EXCLUDED_VOCABULARIES),
                    "after_id": after_id,
                    "batch_size": batch_size,
                },
            ).fetchall()
        if not rows:
            return
        batch = [ClinicalConcept(*row) for row in rows]
        yield batch
        after_id = batch[-1].concept_id


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return -1.0
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return -1.0
    return dot / (left_norm * right_norm)


def _as_vector(value: Any) -> list[float]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    return [float(item) for item in value]


def source_embedding_is_compatible(source: Any, embedder: Any) -> tuple[bool, float | None]:
    """Prove an unlabelled legacy collection uses the current embedding space."""
    if source.count() == 0:
        return False, None
    sample = source.get(limit=1, include=["documents", "embeddings"])
    documents = sample.get("documents") or []
    embeddings = sample.get("embeddings")
    if not documents or embeddings is None or len(embeddings) == 0:
        return False, None
    current = _as_vector(embedder([documents[0]])[0])
    existing = _as_vector(embeddings[0])
    similarity = cosine_similarity(existing, current)
    return similarity >= 0.999, similarity


def embedding_model_is_discriminative(embedder: Any) -> tuple[bool, float]:
    """Reject an embedding runtime that collapses distinct short labels.

    A live nomic-embed-text/Ollama combination was found to return the exact
    same vector for unrelated labels ending in ``syndrome``. Dimension and a
    one-record source probe cannot detect that failure mode.
    """
    vectors = embedder(["Rett syndrome", "Faciocardiorenal syndrome"])
    similarity = cosine_similarity(_as_vector(vectors[0]), _as_vector(vectors[1]))
    return similarity < 0.999, similarity


def _qdrant_point_id(concept_id: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"omop-concept-{concept_id}"))


def _qdrant_request(
    base_url: str,
    collection: str,
    path: str,
    body: dict[str, Any],
) -> dict[str, Any]:
    validate_collection_name(collection)
    response = httpx.post(
        f"{base_url.rstrip('/')}/collections/{collection}/{path.lstrip('/')}",
        json=body,
        timeout=120.0,
    )
    response.raise_for_status()
    return response.json()


def qdrant_source_is_compatible(
    *,
    base_url: str,
    collection: str,
    embedder: Any,
) -> tuple[bool, float | None]:
    """Prove a Qdrant source uses the current query-time semantic space."""
    payload = _qdrant_request(
        base_url,
        collection,
        "points/scroll",
        {"limit": 3, "with_payload": True, "with_vector": True},
    )
    points = payload.get("result", {}).get("points", [])
    names = [(point.get("payload") or {}).get("concept_name") for point in points]
    if not points or any(not name for name in names):
        return False, None
    fresh = embedder(names)
    similarities = [
        cosine_similarity(_as_vector(point.get("vector") or []), _as_vector(vector))
        for point, vector in zip(points, fresh, strict=True)
    ]
    minimum = min(similarities)
    return minimum >= 0.999, minimum


def _qdrant_vectors(
    *,
    base_url: str,
    collection: str,
    concepts: list[ClinicalConcept],
) -> dict[str, list[float]]:
    if not concepts:
        return {}
    try:
        payload = _qdrant_request(
            base_url,
            collection,
            "points",
            {
                "ids": [_qdrant_point_id(concept.concept_id) for concept in concepts],
                "with_payload": True,
                "with_vector": True,
            },
        )
    except Exception:
        if len(concepts) <= 1:
            raise
        midpoint = len(concepts) // 2
        return {
            **_qdrant_vectors(
                base_url=base_url,
                collection=collection,
                concepts=concepts[:midpoint],
            ),
            **_qdrant_vectors(
                base_url=base_url,
                collection=collection,
                concepts=concepts[midpoint:],
            ),
        }

    by_point_id = {_qdrant_point_id(concept.concept_id): concept for concept in concepts}
    reusable: dict[str, list[float]] = {}
    for point in payload.get("result", []):
        concept = by_point_id.get(str(point.get("id")))
        point_payload = point.get("payload") or {}
        vector = _as_vector(point.get("vector") or [])
        if concept is None or point_payload.get("concept_name") != concept.concept_name:
            continue
        if len(vector) == 768:
            reusable[concept.document_id] = vector
    return reusable


def _source_vectors(source: Any | None, concepts: list[ClinicalConcept]) -> dict[str, list[float]]:
    if source is None:
        return {}
    try:
        result = source.get(
            ids=[concept.document_id for concept in concepts],
            include=["documents", "embeddings"],
        )
    except Exception:
        if len(concepts) <= 1:
            raise
        midpoint = len(concepts) // 2
        return {
            **_source_vectors(source, concepts[:midpoint]),
            **_source_vectors(source, concepts[midpoint:]),
        }
    ids = result.get("ids") or []
    documents = result.get("documents") or []
    embeddings = result.get("embeddings")
    if embeddings is None:
        return {}
    expected_names = {concept.document_id: concept.concept_name for concept in concepts}
    reusable: dict[str, list[float]] = {}
    for index, document_id in enumerate(ids):
        if index >= len(documents) or index >= len(embeddings):
            continue
        if documents[index] != expected_names.get(document_id):
            continue
        vector = _as_vector(embeddings[index])
        if len(vector) == 768:
            reusable[document_id] = vector
    return reusable


def _target_metadata(release: str, model: str) -> dict[str, str]:
    return {
        "hnsw:space": "cosine",
        "parthenon:policy": POLICY_VERSION,
        "parthenon:release": release,
        "parthenon:embedding_model": model,
    }


def _get_or_create_target(client: Any, name: str, release: str, model: str, embedder: Any) -> Any:
    expected = _target_metadata(release, model)
    target = client.get_or_create_collection(
        name=name,
        embedding_function=embedder,
        metadata=expected,
    )
    actual = target.metadata or {}
    for key, value in expected.items():
        if actual.get(key) != value:
            raise RuntimeError(
                f"Target collection {name!r} already exists with incompatible {key}: "
                f"expected {value!r}, got {actual.get(key)!r}"
            )
    return target


def sync_versioned_collection(
    *,
    engine: Engine,
    source_name: str,
    target_name: str,
    release: str,
    schema: str,
    batch_size: int,
    qdrant_source: str | None = None,
    qdrant_url: str = DEFAULT_QDRANT_URL,
) -> tuple[SyncStats, str, float | None, float | None]:
    """Build a replacement collection without mutating the source collection."""
    validate_collection_name(source_name)
    validate_collection_name(target_name)
    if source_name == target_name and target_name in {
        "clinical_reference",
        settings.chroma_clinical_collection,
    }:
        raise ValueError("The active source and target collections must differ")

    client = get_chroma_client()
    embedder = get_clinical_embedder()
    model = embedding_model_identity()
    discriminative, label_similarity = embedding_model_is_discriminative(embedder)
    if not discriminative:
        raise RuntimeError(
            "Clinical embedding model collapsed distinct short labels "
            f"(cosine={label_similarity:.6f}); refusing to build a semantic index"
        )
    target = _get_or_create_target(client, target_name, release, model, embedder)

    try:
        source = client.get_collection(name=source_name)
    except Exception:
        source = None

    source_similarity: float | None = None
    if source is not None:
        compatible, source_similarity = source_embedding_is_compatible(source, embedder)
        if not compatible:
            source = None

    qdrant_similarity: float | None = None
    reusable_qdrant = qdrant_source
    if qdrant_source is not None:
        validate_collection_name(qdrant_source)
        compatible, qdrant_similarity = qdrant_source_is_compatible(
            base_url=qdrant_url,
            collection=qdrant_source,
            embedder=embedder,
        )
        if not compatible:
            raise RuntimeError(
                f"Qdrant source {qdrant_source!r} is not in the active embedding space "
                f"(minimum cosine={qdrant_similarity})"
            )

    stats = SyncStats()
    for concepts in iter_concept_batches(engine, schema=schema, batch_size=batch_size):
        reusable = _source_vectors(source, concepts)
        if reusable_qdrant is not None and len(reusable) != len(concepts):
            absent = [concept for concept in concepts if concept.document_id not in reusable]
            reusable.update(
                _qdrant_vectors(
                    base_url=qdrant_url,
                    collection=reusable_qdrant,
                    concepts=absent,
                )
            )
        missing = [concept for concept in concepts if concept.document_id not in reusable]
        generated: dict[str, list[float]] = {}
        if missing:
            vectors = embedder([concept.concept_name for concept in missing])
            generated = {
                concept.document_id: _as_vector(vector)
                for concept, vector in zip(missing, vectors, strict=True)
            }

        target.upsert(
            ids=[concept.document_id for concept in concepts],
            documents=[concept.concept_name for concept in concepts],
            metadatas=[concept.metadata() for concept in concepts],
            embeddings=[
                reusable[concept.document_id]
                if concept.document_id in reusable
                else generated[concept.document_id]
                for concept in concepts
            ],
        )
        stats.expected += len(concepts)
        stats.written += len(concepts)
        stats.reused_embeddings += len(reusable)
        stats.generated_embeddings += len(missing)
        stats.batches += 1
        print(
            f"clinical sync: {stats.written:,} written; "
            f"{stats.reused_embeddings:,} reused; {stats.generated_embeddings:,} generated",
            flush=True,
        )

    return stats, model, source_similarity, qdrant_similarity


def audit_versioned_collection(
    *,
    engine: Engine,
    target_name: str,
    schema: str,
    batch_size: int,
) -> dict[str, Any]:
    """Audit exact membership and current fields for every eligible SQL row."""
    client = get_chroma_client()
    target = client.get_collection(name=validate_collection_name(target_name))
    expected_count = 0
    missing: list[str] = []
    stale: list[dict[str, Any]] = []

    for concepts in iter_concept_batches(engine, schema=schema, batch_size=batch_size):
        expected_count += len(concepts)
        result = _get_batch_resilient(target, concepts)
        ids = result.get("ids") or []
        documents = result.get("documents") or []
        metadatas = result.get("metadatas") or []
        embeddings = result.get("embeddings")
        positions = {document_id: index for index, document_id in enumerate(ids)}
        for concept in concepts:
            position = positions.get(concept.document_id)
            if position is None:
                if len(missing) < 25:
                    missing.append(concept.document_id)
                continue
            actual_metadata = metadatas[position] or {}
            expected_metadata = concept.metadata()
            vector_length = (
                len(embeddings[position])
                if embeddings is not None and position < len(embeddings)
                else 0
            )
            mismatches = {
                key: {"expected": value, "actual": actual_metadata.get(key)}
                for key, value in expected_metadata.items()
                if actual_metadata.get(key) != value
            }
            if documents[position] != concept.concept_name:
                mismatches["document"] = {
                    "expected": concept.concept_name,
                    "actual": documents[position],
                }
            if vector_length != 768:
                mismatches["embedding_dimension"] = {"expected": 768, "actual": vector_length}
            if mismatches and len(stale) < 25:
                stale.append({"id": concept.document_id, "mismatches": mismatches})

    actual_count = target.count()
    audit = {
        "expected_count": expected_count,
        "actual_count": actual_count,
        "count_matches": actual_count == expected_count,
        "missing_sample": missing,
        "stale_sample": stale,
        "passed": actual_count == expected_count and not missing and not stale,
    }
    if not audit["passed"]:
        raise RuntimeError(f"Clinical collection audit failed: {json.dumps(audit, default=str)}")
    return audit


def _get_batch_resilient(target: Any, concepts: list[ClinicalConcept]) -> dict[str, Any]:
    try:
        return target.get(
            ids=[concept.document_id for concept in concepts],
            include=["documents", "metadatas", "embeddings"],
        )
    except Exception:
        if len(concepts) <= 1:
            raise
        midpoint = len(concepts) // 2
        left = _get_batch_resilient(target, concepts[:midpoint])
        right = _get_batch_resilient(target, concepts[midpoint:])
        merged: dict[str, Any] = {}
        for key in ("ids", "documents", "metadatas"):
            merged[key] = list(left.get(key) or []) + list(right.get(key) or [])
        left_embeddings = left.get("embeddings")
        right_embeddings = right.get("embeddings")
        merged["embeddings"] = (
            list(left_embeddings) + list(right_embeddings)
            if left_embeddings is not None and right_embeddings is not None
            else None
        )
        return merged


def write_manifest(path: Path, payload: dict[str, Any]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode()
    path.write_bytes(encoded)
    digest = hashlib.sha256(encoded).hexdigest()
    path.with_suffix(path.suffix + ".sha256").write_text(f"{digest}  {path.name}\n")
    return digest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="clinical_reference")
    parser.add_argument("--target", required=True)
    parser.add_argument("--release", required=True)
    parser.add_argument("--schema", default=settings.ariadne_vocab_schema)
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--qdrant-source")
    parser.add_argument("--qdrant-url", default=DEFAULT_QDRANT_URL)
    parser.add_argument("--audit-only", action="store_true")
    args = parser.parse_args()

    started = time.monotonic()
    engine = create_engine(
        __import__("os").environ.get("GIS_DATABASE_URL", settings.database_url),
        pool_size=2,
        pool_pre_ping=True,
    )
    stats = SyncStats()
    model = embedding_model_identity()
    similarity: float | None = None
    qdrant_similarity: float | None = None
    if not args.audit_only:
        stats, model, similarity, qdrant_similarity = sync_versioned_collection(
            engine=engine,
            source_name=args.source,
            target_name=args.target,
            release=args.release,
            schema=args.schema,
            batch_size=args.batch_size,
            qdrant_source=args.qdrant_source,
            qdrant_url=args.qdrant_url,
        )
    audit = audit_versioned_collection(
        engine=engine,
        target_name=args.target,
        schema=args.schema,
        batch_size=max(args.batch_size, 1_000),
    )
    payload = {
        "format": "parthenon.chroma-clinical-sync.v1",
        "created_at": datetime.now(UTC).isoformat(),
        "release": args.release,
        "source_collection": args.source,
        "target_collection": args.target,
        "policy": {
            "version": POLICY_VERSION,
            "target_domains": list(TARGET_DOMAINS),
            "required_vocabularies": list(REQUIRED_VOCABULARIES),
            "excluded_vocabularies": list(EXCLUDED_VOCABULARIES),
        },
        "embedding_model": model,
        "source_probe_cosine": similarity,
        "qdrant_source_collection": args.qdrant_source,
        "qdrant_source_probe_cosine": qdrant_similarity,
        "sync": asdict(stats),
        "audit": audit,
        "duration_seconds": round(time.monotonic() - started, 3),
    }
    digest = write_manifest(args.manifest, payload)
    print(json.dumps({"manifest": str(args.manifest), "sha256": digest, **audit}, indent=2))


if __name__ == "__main__":
    main()
