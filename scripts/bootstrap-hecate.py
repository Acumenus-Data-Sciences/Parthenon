#!/usr/bin/env python3
"""Bootstrap Hecate: embed OMOP vocabulary concepts into Qdrant and generate pairs file.

Usage:
    python3 scripts/bootstrap-hecate.py [--phase 1|2|3] [--batch-size 200] [--limit N]

Phase 1: Clinical concepts (Condition, Procedure, Measurement, Observation, Device, etc.) ~660K
Phase 2: Drug concepts (RxNorm Clinical Drug, Ingredient, etc.) ~500K most common
Phase 3: Remaining standard concepts

The script is resumable — it tracks progress in a checkpoint file and skips already-embedded concepts.
"""

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path

import psycopg2
import psycopg2.extras
import urllib.request

# ── Configuration ──────────────────────────────────────────────────────────────

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/embed")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
PG_DSN = os.getenv("PG_DSN", "host=localhost dbname=parthenon user=claude_dev password=claude321$%")
VECTOR_DIM = 768  # nomic-embed-text dimension
COLLECTION_NAME = "meddra"  # Hecate expects this name

CHECKPOINT_DIR = Path(__file__).parent.parent / "output" / "hecate-bootstrap"
CHECKPOINT_FILE = CHECKPOINT_DIR / "checkpoint.json"
PAIRS_FILE = CHECKPOINT_DIR / "all_pairs.txt"

# Domain groupings for phased rollout
PHASE_1_DOMAINS = [
    "Condition", "Procedure", "Measurement", "Observation",
    "Device", "Meas Value", "Specimen", "Visit", "Unit",
    "Spec Anatomic Site", "Note", "Race", "Provider",
]
PHASE_2_DOMAINS = ["Drug"]
PHASE_3_DOMAINS = None  # everything else


def qdrant_request(method: str, path: str, body: dict | None = None) -> dict:
    """Make a request to Qdrant REST API."""
    url = f"{QDRANT_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        raise RuntimeError(f"Qdrant {method} {path} failed ({e.code}): {err_body}")


def ensure_collection():
    """Create the Qdrant collection if it doesn't exist."""
    try:
        result = qdrant_request("GET", f"/collections/{COLLECTION_NAME}")
        print(f"Collection '{COLLECTION_NAME}' exists: {result['result']['points_count']} points")
        return
    except RuntimeError:
        pass

    print(f"Creating collection '{COLLECTION_NAME}' with dim={VECTOR_DIM}")
    qdrant_request("PUT", f"/collections/{COLLECTION_NAME}", {
        "vectors": {
            "size": VECTOR_DIM,
            "distance": "Cosine",
        },
        "optimizers_config": {
            "indexing_threshold": 20000,
        },
    })
    # Create payload index for concept_name_lower (used by write_pairs logic)
    qdrant_request("PUT", f"/collections/{COLLECTION_NAME}/index", {
        "field_name": "concept_name_lower",
        "field_schema": "keyword",
    })
    print("Collection created.")


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings via Ollama."""
    data = json.dumps({"model": OLLAMA_MODEL, "input": texts}).encode()
    req = urllib.request.Request(OLLAMA_URL, data=data)
    req.add_header("Content-Type", "application/json")
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read())
    return result["embeddings"]


def upsert_points(points: list[dict]):
    """Upload points to Qdrant."""
    qdrant_request("PUT", f"/collections/{COLLECTION_NAME}/points?wait=true", {
        "points": points,
    })


def load_checkpoint() -> dict:
    """Load progress checkpoint."""
    if CHECKPOINT_FILE.exists():
        return json.loads(CHECKPOINT_FILE.read_text())
    return {"last_concept_id": 0, "total_embedded": 0, "pairs": {}}


def save_checkpoint(state: dict):
    """Save progress checkpoint."""
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_FILE.write_text(json.dumps(state))


def fetch_concepts(conn, domains: list[str] | None, after_id: int, limit: int) -> list[tuple]:
    """Fetch concepts from PostgreSQL."""
    with conn.cursor() as cur:
        if domains:
            cur.execute("""
                SELECT concept_id, concept_name, domain_id, vocabulary_id,
                       concept_class_id, standard_concept
                FROM concept
                WHERE invalid_reason IS NULL
                  AND standard_concept = 'S'
                  AND domain_id = ANY(%s)
                  AND concept_id > %s
                ORDER BY concept_id
                LIMIT %s
            """, (domains, after_id, limit))
        else:
            # Phase 3: everything NOT in phase 1 or 2
            exclude = PHASE_1_DOMAINS + PHASE_2_DOMAINS
            cur.execute("""
                SELECT concept_id, concept_name, domain_id, vocabulary_id,
                       concept_class_id, standard_concept
                FROM concept
                WHERE invalid_reason IS NULL
                  AND standard_concept = 'S'
                  AND domain_id != ALL(%s)
                  AND concept_id > %s
                ORDER BY concept_id
                LIMIT %s
            """, (exclude, after_id, limit))
        return cur.fetchall()


def generate_pairs_file(conn):
    """Generate the concept-name → UUID mapping file from Qdrant."""
    print("\nGenerating pairs file from Qdrant...")
    pairs: dict[str, list[str]] = {}

    # Scroll through all points in Qdrant
    offset = None
    total = 0
    while True:
        body: dict = {"limit": 5000, "with_payload": ["concept_name_lower"]}
        if offset:
            body["offset"] = offset

        result = qdrant_request("POST", f"/collections/{COLLECTION_NAME}/points/scroll", body)
        points = result["result"]["points"]
        if not points:
            break

        for point in points:
            name = point["payload"].get("concept_name_lower", "")
            if name:
                pairs.setdefault(name, []).append(point["id"])

        offset = result["result"].get("next_page_offset")
        total += len(points)
        print(f"  Scrolled {total} points...", end="\r")

        if not offset:
            break

    PAIRS_FILE.write_text(json.dumps(pairs))
    print(f"\nPairs file written: {PAIRS_FILE} ({len(pairs)} unique names, {total} points)")
    return str(PAIRS_FILE)


def run_phase(phase: int, batch_size: int, limit: int | None):
    """Run embedding for a specific phase."""
    if phase == 1:
        domains = PHASE_1_DOMAINS
        phase_name = "Clinical (non-Drug)"
    elif phase == 2:
        domains = PHASE_2_DOMAINS
        phase_name = "Drug"
    elif phase == 3:
        domains = None
        phase_name = "Remaining"
    else:
        raise ValueError(f"Unknown phase: {phase}")

    print(f"\n{'='*60}")
    print(f"Phase {phase}: {phase_name} concepts")
    print(f"{'='*60}")

    ensure_collection()

    state = load_checkpoint()
    last_id = state.get(f"phase{phase}_last_id", 0)
    phase_total = state.get(f"phase{phase}_total", 0)

    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = True

    with conn.cursor() as cur:
        cur.execute("SET search_path TO vocab")

    start_time = time.time()
    batch_count = 0
    fetch_limit = limit or 999_999_999

    while True:
        rows = fetch_concepts(conn, domains, last_id, min(batch_size, fetch_limit - phase_total))
        if not rows:
            break

        concept_ids = [r[0] for r in rows]
        concept_names = [r[1] for r in rows]
        concept_data = rows

        # Generate embeddings
        try:
            embeddings = embed_batch(concept_names)
        except Exception as e:
            print(f"\nOllama error at batch starting concept_id={concept_ids[0]}: {e}")
            print("Saving checkpoint and exiting. Re-run to resume.")
            save_checkpoint(state)
            conn.close()
            return

        # Build Qdrant points
        points = []
        for i, (cid, cname, domain, vocab, cclass, std) in enumerate(concept_data):
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"omop-concept-{cid}"))
            points.append({
                "id": point_id,
                "vector": embeddings[i],
                "payload": {
                    "concept_id": cid,
                    "concept_name": cname,
                    "concept_name_lower": cname.lower(),
                    "domain_id": domain,
                    "vocabulary_id": vocab,
                    "concept_class_id": cclass,
                    "standard_concept": std,
                },
            })

        # Upload to Qdrant
        try:
            upsert_points(points)
        except Exception as e:
            print(f"\nQdrant error at batch starting concept_id={concept_ids[0]}: {e}")
            print("Saving checkpoint and exiting. Re-run to resume.")
            save_checkpoint(state)
            conn.close()
            return

        last_id = concept_ids[-1]
        phase_total += len(rows)
        batch_count += 1
        state[f"phase{phase}_last_id"] = last_id
        state[f"phase{phase}_total"] = phase_total

        # Checkpoint every 50 batches
        if batch_count % 50 == 0:
            save_checkpoint(state)

        elapsed = time.time() - start_time
        rate = phase_total / elapsed if elapsed > 0 else 0
        print(
            f"  Phase {phase}: {phase_total:,} concepts | "
            f"batch {batch_count} | "
            f"{rate:.0f}/sec | "
            f"last_id={last_id}",
            end="\r",
        )

        if phase_total >= fetch_limit:
            break

    save_checkpoint(state)
    conn.close()
    elapsed = time.time() - start_time
    print(f"\nPhase {phase} complete: {phase_total:,} concepts in {elapsed:.0f}s")


def main():
    parser = argparse.ArgumentParser(description="Bootstrap Hecate vocabulary embeddings")
    parser.add_argument("--phase", type=int, choices=[1, 2, 3], default=None,
                        help="Run specific phase (1=clinical, 2=drug, 3=remaining). Default: all.")
    parser.add_argument("--batch-size", type=int, default=200,
                        help="Embedding batch size (default: 200)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max concepts per phase (for testing)")
    parser.add_argument("--pairs-only", action="store_true",
                        help="Only generate pairs file from existing Qdrant data")
    args = parser.parse_args()

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    if args.pairs_only:
        conn = psycopg2.connect(PG_DSN)
        conn.autocommit = True
        generate_pairs_file(conn)
        conn.close()
        return

    phases = [args.phase] if args.phase else [1, 2, 3]

    for phase in phases:
        run_phase(phase, args.batch_size, args.limit)

    # Generate pairs file after all phases
    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = True
    generate_pairs_file(conn)
    conn.close()

    print(f"\nBootstrap complete! Pairs file: {PAIRS_FILE}")
    print(f"Mount this file into Hecate container at the VECTORDB_DATA_PATH location.")


if __name__ == "__main__":
    main()
