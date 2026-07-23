#!/usr/bin/env python3
"""Build and audit a versioned Hecate/Qdrant OMOP vocabulary collection.

The active ``meddra`` collection is never mutated. The synchronizer reads the
current SQL membership from the beginning on every run, reuses a source vector
only when the concept name and embedding space still match, and validates every
eligible concept before producing a manifest and pairs file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sqlite3
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator

import psycopg2

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333").rstrip("/")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/embed")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "embeddinggemma:300m")
HECATE_QUERY_MODEL = os.getenv("HECATE_QUERY_MODEL", "text-embedding-3-large:latest")
PG_DSN = os.getenv("PG_DSN", "dbname=parthenon")
VECTOR_DIM = 768
EXCLUDED_VOCABULARIES = ("RxNorm Extension",)
POLICY_VERSION = "hecate-standard-valid-v2-no-rxnorm-extension"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output" / "hecate-bootstrap"
COLLECTION_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,254}$")


@dataclass(frozen=True)
class Concept:
    concept_id: int
    concept_name: str
    domain_id: str
    vocabulary_id: str
    concept_class_id: str
    standard_concept: str
    concept_code: str

    @property
    def point_id(self) -> str:
        return point_id_for_concept(self.concept_id)

    def payload(self, *, release: str, embedding_model: str) -> dict[str, Any]:
        return {
            "concept_id": self.concept_id,
            "concept_name": self.concept_name,
            "concept_name_lower": self.concept_name.lower(),
            "vocabulary_release": release,
            "embedding_model": embedding_model,
            "concepts": [{
                "concept_id": self.concept_id,
                "concept_name": self.concept_name,
                "domain_id": self.domain_id,
                "vocabulary_id": self.vocabulary_id,
                "concept_class_id": self.concept_class_id,
                "standard_concept": self.standard_concept,
                "concept_code": self.concept_code or str(self.concept_id),
                "invalid_reason": None,
                "record_count": 0,
            }],
        }


@dataclass
class SyncStats:
    expected: int = 0
    written: int = 0
    reused_embeddings: int = 0
    generated_embeddings: int = 0
    batches: int = 0


def validate_identifier(value: str, label: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"Unsafe {label}: {value!r}")
    return value


def validate_collection_name(value: str) -> str:
    if not COLLECTION_NAME_RE.fullmatch(value):
        raise ValueError(f"Unsafe Qdrant collection name: {value!r}")
    return value


def point_id_for_concept(concept_id: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"omop-concept-{concept_id}"))


def qdrant_request(
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
    *,
    timeout: int = 120,
) -> dict[str, Any]:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{QDRANT_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(f"Qdrant {method} {path} failed ({error.code}): {detail}") from error


def collection_info(name: str) -> dict[str, Any] | None:
    try:
        return qdrant_request("GET", f"/collections/{validate_collection_name(name)}")["result"]
    except RuntimeError as error:
        if "(404)" in str(error):
            return None
        raise


def ensure_target_collection(name: str) -> dict[str, Any]:
    name = validate_collection_name(name)
    info = collection_info(name)
    if info is None:
        qdrant_request("PUT", f"/collections/{name}", {
            "vectors": {"size": VECTOR_DIM, "distance": "Cosine"},
            "on_disk_payload": True,
            # Defer HNSW construction until the full bulk load completes. This
            # avoids rebuilding the graph after every small upsert batch.
            "optimizers_config": {"indexing_threshold": 0},
        })
        qdrant_request("PUT", f"/collections/{name}/index?wait=true", {
            "field_name": "concept_name_lower",
            "field_schema": "keyword",
        })
        qdrant_request("PUT", f"/collections/{name}/index?wait=true", {
            "field_name": "concept_id",
            "field_schema": "integer",
        })
        info = collection_info(name)
    assert info is not None
    vectors = info["config"]["params"]["vectors"]
    if vectors.get("size") != VECTOR_DIM or vectors.get("distance") != "Cosine":
        raise RuntimeError(f"Target collection {name!r} has incompatible vector config: {vectors}")
    return info


def set_indexing_threshold(name: str, threshold: int) -> None:
    qdrant_request(
        "PATCH",
        f"/collections/{validate_collection_name(name)}",
        {"optimizers_config": {"indexing_threshold": threshold}},
    )


def embed_batch(texts: list[str], model: str = OLLAMA_MODEL) -> list[list[float]]:
    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps({"model": model, "input": texts}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        embeddings = json.loads(response.read())["embeddings"]
    if len(embeddings) != len(texts) or any(len(vector) != VECTOR_DIM for vector in embeddings):
        raise RuntimeError("Ollama returned an unexpected embedding count or dimension")
    return embeddings


def verify_query_alias() -> float:
    """Prove Hecate's hardcoded query alias is in the indexed semantic space."""
    probe = "Rett syndrome clinical concept"
    similarity = cosine_similarity(
        embed_batch([probe], OLLAMA_MODEL)[0],
        embed_batch([probe], HECATE_QUERY_MODEL)[0],
    )
    if similarity < 0.999:
        raise RuntimeError(
            f"Hecate query-model alias drift: {HECATE_QUERY_MODEL} vs {OLLAMA_MODEL} cosine={similarity:.6f}"
        )
    return similarity


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return -1.0
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return -1.0
    return dot / (left_norm * right_norm)


def source_embedding_is_compatible(source: str) -> tuple[bool, float | None]:
    result = qdrant_request(
        "POST",
        f"/collections/{validate_collection_name(source)}/points/scroll",
        {"limit": 1, "with_payload": True, "with_vector": True},
    )["result"]["points"]
    if not result:
        return False, None
    point = result[0]
    name = (point.get("payload") or {}).get("concept_name")
    vector = point.get("vector")
    if not name or not isinstance(vector, list):
        return False, None
    similarity = cosine_similarity(vector, embed_batch([name])[0])
    return similarity >= 0.999, similarity


def eligibility_sql(schema: str) -> str:
    schema = validate_identifier(schema, "vocabulary schema")
    return f"""
        SELECT concept_id, concept_name, domain_id, vocabulary_id,
               concept_class_id, standard_concept, concept_code
        FROM {schema}.concept
        WHERE invalid_reason IS NULL
          AND standard_concept = 'S'
          AND vocabulary_id != ALL(%s)
          AND concept_id > %s
        ORDER BY concept_id
        LIMIT %s
    """


def iter_concept_batches(
    connection: Any,
    *,
    schema: str,
    batch_size: int,
) -> Iterator[list[Concept]]:
    if batch_size < 1 or batch_size > 10_000:
        raise ValueError("batch_size must be between 1 and 10000")
    query = eligibility_sql(schema)
    after_id = -1
    while True:
        with connection.cursor() as cursor:
            cursor.execute(query, (list(EXCLUDED_VOCABULARIES), after_id, batch_size))
            rows = cursor.fetchall()
        if not rows:
            return
        concepts = [Concept(*row) for row in rows]
        yield concepts
        after_id = concepts[-1].concept_id


def retrieve_points(collection: str, ids: list[str], *, with_vector: bool) -> list[dict[str, Any]]:
    return qdrant_request(
        "POST",
        f"/collections/{validate_collection_name(collection)}/points",
        {"ids": ids, "with_payload": True, "with_vector": with_vector},
    )["result"]


def reusable_vectors(source: str | None, concepts: list[Concept]) -> dict[str, list[float]]:
    if source is None:
        return {}
    try:
        points = retrieve_points(source, [concept.point_id for concept in concepts], with_vector=True)
    except Exception:
        if len(concepts) <= 1:
            raise
        midpoint = len(concepts) // 2
        return {
            **reusable_vectors(source, concepts[:midpoint]),
            **reusable_vectors(source, concepts[midpoint:]),
        }
    expected_names = {concept.point_id: concept.concept_name for concept in concepts}
    result: dict[str, list[float]] = {}
    for point in points:
        point_id = str(point["id"])
        payload = point.get("payload") or {}
        vector = point.get("vector")
        if payload.get("concept_name") != expected_names.get(point_id):
            continue
        if isinstance(vector, list) and len(vector) == VECTOR_DIM:
            result[point_id] = vector
    return result


def upsert_points(collection: str, points: list[dict[str, Any]]) -> None:
    try:
        qdrant_request(
            "PUT",
            f"/collections/{validate_collection_name(collection)}/points?wait=true",
            {"points": points},
            timeout=300,
        )
    except Exception:
        if len(points) <= 1:
            raise
        midpoint = len(points) // 2
        upsert_points(collection, points[:midpoint])
        upsert_points(collection, points[midpoint:])


def sync_collection(
    connection: Any,
    *,
    source: str,
    target: str,
    release: str,
    schema: str,
    batch_size: int,
) -> tuple[SyncStats, float | None]:
    source = validate_collection_name(source)
    target = validate_collection_name(target)
    if source == target:
        raise ValueError("The source and target collections must differ")
    if collection_info(source) is None:
        raise RuntimeError(f"Source collection {source!r} does not exist")
    ensure_target_collection(target)
    set_indexing_threshold(target, 0)
    compatible, similarity = source_embedding_is_compatible(source)
    reusable_source = source if compatible else None
    target_info = collection_info(target)
    reusable_target: str | None = None
    if target_info is not None and int(target_info.get("points_count") or 0) > 0:
        target_compatible, _ = source_embedding_is_compatible(target)
        if not target_compatible:
            raise RuntimeError(
                f"Existing target {target!r} is not in the active embedding space; "
                "refusing to mix vectors during resume"
            )
        reusable_target = target

    stats = SyncStats()
    for concepts in iter_concept_batches(connection, schema=schema, batch_size=batch_size):
        # Prefer already-written target points so an interrupted run resumes
        # without regenerating vectors that were absent from the old source.
        reused = reusable_vectors(reusable_target, concepts)
        if len(reused) != len(concepts):
            absent = [concept for concept in concepts if concept.point_id not in reused]
            reused.update(reusable_vectors(reusable_source, absent))
        missing = [concept for concept in concepts if concept.point_id not in reused]
        generated_vectors = embed_batch([concept.concept_name for concept in missing]) if missing else []
        generated = {
            concept.point_id: vector
            for concept, vector in zip(missing, generated_vectors, strict=True)
        }
        points = [{
            "id": concept.point_id,
            "vector": reused[concept.point_id] if concept.point_id in reused else generated[concept.point_id],
            "payload": concept.payload(release=release, embedding_model=OLLAMA_MODEL),
        } for concept in concepts]
        upsert_points(target, points)
        stats.expected += len(concepts)
        stats.written += len(concepts)
        stats.reused_embeddings += len(reused)
        stats.generated_embeddings += len(missing)
        stats.batches += 1
        print(
            f"hecate sync: {stats.written:,} written; {stats.reused_embeddings:,} reused; "
            f"{stats.generated_embeddings:,} generated",
            flush=True,
        )
    return stats, similarity


def payload_mismatches(actual: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    mismatches: dict[str, Any] = {}
    for key in ("concept_id", "concept_name", "concept_name_lower", "vocabulary_release", "embedding_model"):
        if actual.get(key) != expected.get(key):
            mismatches[key] = {"expected": expected.get(key), "actual": actual.get(key)}
    actual_concepts = actual.get("concepts") or []
    expected_concepts = expected.get("concepts") or []
    if actual_concepts != expected_concepts:
        mismatches["concepts"] = {"expected": expected_concepts, "actual": actual_concepts}
    return mismatches


def audit_collection(
    connection: Any,
    *,
    target: str,
    release: str,
    schema: str,
    batch_size: int,
) -> dict[str, Any]:
    info = collection_info(validate_collection_name(target))
    if info is None:
        raise RuntimeError(f"Target collection {target!r} does not exist")
    expected_count = 0
    irsf_count = 0
    missing: list[str] = []
    stale: list[dict[str, Any]] = []
    for concepts in iter_concept_batches(connection, schema=schema, batch_size=batch_size):
        expected_count += len(concepts)
        irsf_count += sum(concept.vocabulary_id == "IRSF-NHS" for concept in concepts)
        points = retrieve_points(target, [concept.point_id for concept in concepts], with_vector=False)
        by_id = {str(point["id"]): point for point in points}
        for concept in concepts:
            point = by_id.get(concept.point_id)
            if point is None:
                if len(missing) < 25:
                    missing.append(concept.point_id)
                continue
            mismatches = payload_mismatches(
                point.get("payload") or {},
                concept.payload(release=release, embedding_model=OLLAMA_MODEL),
            )
            if mismatches and len(stale) < 25:
                stale.append({"point_id": concept.point_id, "mismatches": mismatches})

    actual_count = int(info.get("points_count") or 0)
    result = {
        "expected_count": expected_count,
        "actual_count": actual_count,
        "irsf_count": irsf_count,
        "missing_sample": missing,
        "stale_sample": stale,
        "collection_status": info.get("status"),
        "optimizer_status": info.get("optimizer_status"),
        "passed": (
            actual_count == expected_count
            and irsf_count == 117
            and not missing
            and not stale
            and info.get("status") == "green"
        ),
    }
    if not result["passed"]:
        raise RuntimeError(f"Hecate target audit failed: {json.dumps(result, default=str)}")
    return result


def wait_for_collection_green(target: str, timeout_seconds: int = 3_600) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    while True:
        info = collection_info(target)
        if info is not None:
            optimizer = info.get("optimizer_status")
            optimizer_ok = optimizer == "ok" or optimizer is True
            queue_length = int((info.get("update_queue") or {}).get("length") or 0)
            if info.get("status") == "green" and optimizer_ok and queue_length == 0:
                return info
        if time.monotonic() >= deadline:
            raise RuntimeError(f"Qdrant collection {target!r} did not become green before timeout")
        print(f"waiting for Qdrant collection {target} to finish optimizing", flush=True)
        time.sleep(10)


def iter_collection_points(collection: str, batch_size: int = 5_000) -> Iterator[list[dict[str, Any]]]:
    offset: Any = None
    while True:
        body: dict[str, Any] = {
            "limit": batch_size,
            "with_payload": ["concept_name_lower"],
            "with_vector": False,
        }
        if offset is not None:
            body["offset"] = offset
        result = qdrant_request(
            "POST",
            f"/collections/{validate_collection_name(collection)}/points/scroll",
            body,
        )["result"]
        points = result.get("points") or []
        if not points:
            return
        yield points
        offset = result.get("next_page_offset")
        if offset is None:
            return


def generate_pairs_file(collection: str, output: Path) -> dict[str, Any]:
    """Generate deterministic name-to-point mappings without holding them in RAM."""
    output.parent.mkdir(parents=True, exist_ok=True)
    sqlite_path = output.with_suffix(output.suffix + ".sqlite.tmp")
    if sqlite_path.exists():
        sqlite_path.unlink()
    database = sqlite3.connect(sqlite_path)
    database.execute("PRAGMA journal_mode=OFF")
    database.execute("PRAGMA synchronous=OFF")
    database.execute("CREATE TABLE pair (name TEXT NOT NULL, point_id TEXT NOT NULL)")
    total = 0
    try:
        for points in iter_collection_points(collection):
            rows = [
                ((point.get("payload") or {}).get("concept_name_lower"), str(point["id"]))
                for point in points
                if (point.get("payload") or {}).get("concept_name_lower")
            ]
            database.executemany("INSERT INTO pair(name, point_id) VALUES (?, ?)", rows)
            total += len(rows)
            print(f"pairs: staged {total:,} points", flush=True)
        database.execute("CREATE INDEX pair_name_id ON pair(name, point_id)")
        database.commit()

        temp_output = output.with_suffix(output.suffix + ".tmp")
        unique_names = 0
        with temp_output.open("w", encoding="utf-8") as handle:
            handle.write("{")
            current_name: str | None = None
            current_ids: list[str] = []

            def write_group(name: str, ids: list[str]) -> None:
                nonlocal unique_names
                if unique_names:
                    handle.write(",")
                handle.write(json.dumps(name, ensure_ascii=False))
                handle.write(":")
                handle.write(json.dumps(ids, separators=(",", ":")))
                unique_names += 1

            for name, point_id in database.execute("SELECT name, point_id FROM pair ORDER BY name, point_id"):
                if current_name is not None and name != current_name:
                    write_group(current_name, current_ids)
                    current_ids = []
                current_name = name
                current_ids.append(point_id)
            if current_name is not None:
                write_group(current_name, current_ids)
            handle.write("}\n")
        os.replace(temp_output, output)
    finally:
        database.close()
        sqlite_path.unlink(missing_ok=True)

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(f"{digest}  {output.name}\n")
    return {"path": str(output), "sha256": digest, "points": total, "unique_names": unique_names}


def write_manifest(path: Path, payload: dict[str, Any]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode()
    path.write_bytes(encoded)
    digest = hashlib.sha256(encoded).hexdigest()
    path.with_suffix(path.suffix + ".sha256").write_text(f"{digest}  {path.name}\n")
    return digest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="meddra")
    parser.add_argument("--target", required=True)
    parser.add_argument("--release", required=True)
    parser.add_argument("--schema", default="vocab")
    parser.add_argument("--batch-size", type=int, default=200)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--audit-only", action="store_true")
    parser.add_argument("--pairs-only", action="store_true")
    parser.add_argument("--skip-pairs", action="store_true")
    args = parser.parse_args()

    target = validate_collection_name(args.target)
    release_slug = re.sub(r"[^A-Za-z0-9._-]+", "-", args.release).strip("-")
    manifest_path = args.output_dir / f"hecate-{release_slug}.manifest.json"
    pairs_path = args.output_dir / f"all_pairs_{release_slug}.txt"
    started = time.monotonic()
    alias_similarity = verify_query_alias()

    if args.pairs_only:
        pairs = generate_pairs_file(target, pairs_path)
        print(json.dumps(pairs, indent=2))
        return

    connection = psycopg2.connect(PG_DSN)
    connection.autocommit = True
    stats = SyncStats()
    similarity: float | None = None
    try:
        if not args.audit_only:
            stats, similarity = sync_collection(
                connection,
                source=args.source,
                target=target,
                release=args.release,
                schema=args.schema,
                batch_size=args.batch_size,
            )
            set_indexing_threshold(target, 20_000)
        wait_for_collection_green(target)
        audit = audit_collection(
            connection,
            target=target,
            release=args.release,
            schema=args.schema,
            batch_size=max(1_000, args.batch_size),
        )
    finally:
        connection.close()

    pairs = None if args.skip_pairs else generate_pairs_file(target, pairs_path)
    manifest = {
        "format": "parthenon.hecate-vocabulary-sync.v1",
        "created_at": datetime.now(UTC).isoformat(),
        "release": args.release,
        "source_collection": args.source,
        "target_collection": target,
        "policy": {
            "version": POLICY_VERSION,
            "standard_concept": "S",
            "invalid_reason": None,
            "excluded_vocabularies": list(EXCLUDED_VOCABULARIES),
        },
        "embedding_model": OLLAMA_MODEL,
        "hecate_query_model": HECATE_QUERY_MODEL,
        "query_alias_cosine": alias_similarity,
        "source_probe_cosine": similarity,
        "sync": asdict(stats),
        "audit": audit,
        "pairs": pairs,
        "duration_seconds": round(time.monotonic() - started, 3),
    }
    digest = write_manifest(manifest_path, manifest)
    print(json.dumps({"manifest": str(manifest_path), "sha256": digest, **audit}, indent=2))


if __name__ == "__main__":
    main()
