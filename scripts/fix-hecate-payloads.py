#!/usr/bin/env python3
"""Fix Hecate Qdrant payloads: restructure flat fields into nested concepts array.

Uses overwrite_payload with batch of point IDs per unique payload structure.
Since each point has unique data, we batch scroll + overwrite in chunks.
"""

import json
import os
import time
import urllib.request

import psycopg2

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
PG_DSN = os.getenv("PG_DSN", "host=localhost dbname=parthenon user=claude_dev password=claude321$%")
COLLECTION = "meddra"
SCROLL_BATCH = 1000  # how many to scroll at once
UPDATE_BATCH = 100   # how many to send per overwrite_payload call


def qdrant_request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{QDRANT_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    resp = urllib.request.urlopen(req, timeout=120)
    return json.loads(resp.read())


def load_concept_codes(conn, concept_ids: list[int]) -> dict[int, str]:
    if not concept_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT concept_id, concept_code FROM concept WHERE concept_id = ANY(%s)",
            (concept_ids,),
        )
        return {int(row[0]): str(row[1]) for row in cur.fetchall()}


def build_new_payload(payload: dict, code: str) -> dict:
    cid = int(payload["concept_id"])
    return {
        "concept_name": payload.get("concept_name", ""),
        "concept_name_lower": payload.get("concept_name_lower", ""),
        "concepts": [{
            "concept_id": cid,
            "concept_name": payload.get("concept_name", ""),
            "domain_id": payload.get("domain_id", ""),
            "vocabulary_id": payload.get("vocabulary_id", ""),
            "concept_class_id": payload.get("concept_class_id", ""),
            "standard_concept": payload.get("standard_concept"),
            "concept_code": code,
            "invalid_reason": None,
            "record_count": 0,
        }],
    }


def main():
    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SET search_path TO vocab")

    info = qdrant_request("GET", f"/collections/{COLLECTION}")
    total = info["result"]["points_count"]
    print(f"Total points to fix: {total:,}")

    offset = None
    processed = 0
    start = time.time()

    while True:
        body: dict = {"limit": SCROLL_BATCH, "with_payload": True}
        if offset:
            body["offset"] = offset

        result = qdrant_request("POST", f"/collections/{COLLECTION}/points/scroll", body)
        points = result["result"]["points"]
        if not points:
            break

        # Skip points already in correct format
        unfixed = [p for p in points if "concepts" not in p.get("payload", {})]
        if not unfixed:
            offset = result["result"].get("next_page_offset")
            processed += len(points)
            if not offset:
                break
            elapsed = time.time() - start
            rate = processed / elapsed if elapsed > 0 else 0
            print(f"  {processed:,}/{total:,} (skipping fixed) | {rate:.0f}/sec", end="\r")
            continue
        points = unfixed

        # Batch lookup concept_codes from PG
        concept_ids = []
        for p in points:
            cid = p["payload"].get("concept_id")
            if cid is not None:
                concept_ids.append(int(cid))
        codes = load_concept_codes(conn, concept_ids)

        # Build updates and send in sub-batches
        updates = []
        for p in points:
            if "concept_id" not in p["payload"]:
                continue
            cid = int(p["payload"]["concept_id"])
            new_pl = build_new_payload(p["payload"], codes.get(cid, str(cid)))
            updates.append({"id": p["id"], "payload": new_pl})

        # Send in sub-batches using points/payload (overwrite)
        for i in range(0, len(updates), UPDATE_BATCH):
            batch = updates[i:i + UPDATE_BATCH]
            # Use individual set_payload calls grouped — Qdrant batch API
            # Actually use the upsert points API with payload-only (no vector)
            # Better: use the batch update API
            for item in batch:
                qdrant_request(
                    "PUT",
                    f"/collections/{COLLECTION}/points/payload?wait=false",
                    {"payload": item["payload"], "points": [item["id"]]},
                )

        offset = result["result"].get("next_page_offset")
        processed += len(points)

        elapsed = time.time() - start
        rate = processed / elapsed if elapsed > 0 else 0
        pct = processed / total * 100
        eta_min = (total - processed) / rate / 60 if rate > 0 else 0
        print(f"  {processed:,}/{total:,} ({pct:.1f}%) | {rate:.0f}/sec | ETA {eta_min:.0f}m", end="\r")

        if not offset:
            break

    conn.close()
    elapsed = time.time() - start
    print(f"\nDone: {processed:,} points updated in {elapsed/60:.1f}m")


if __name__ == "__main__":
    main()
