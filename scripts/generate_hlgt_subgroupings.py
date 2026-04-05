#!/usr/bin/env python3
"""Generate HLGT-level sub-groupings for clinical groupings using II-Medical-8B.

For each Condition-domain parent grouping, queries SNOMED hierarchy for immediate
children of anchor concepts, then uses the medical LLM to cluster them into
clinically meaningful sub-categories. Outputs one JSON fixture file per parent
grouping in backend/database/fixtures/groupings/.

Usage:
    python scripts/generate_hlgt_subgroupings.py [--dry-run] [--grouping NAME]

Requires:
    - PostgreSQL access (uses ~/.pgpass or PGPASSWORD)
    - Ollama running with II-Medical-8B model
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg2
import requests

# ── Configuration ──────────────────────────────────────────────────────────────

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "parthenon")
DB_USER = os.getenv("DB_USER", "claude_dev")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "ii-medical:8b-q8_0")

FIXTURES_DIR = Path(__file__).parent.parent / "backend" / "database" / "fixtures" / "groupings"


def get_db_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER
    )


def fetch_parent_groupings(conn: psycopg2.extensions.connection, grouping_name: str | None = None) -> list[dict[str, Any]]:
    """Fetch Condition-domain parent groupings from app.clinical_groupings."""
    sql = """
        SELECT id, name, description, anchor_concept_ids
        FROM app.clinical_groupings
        WHERE domain_id = 'Condition'
          AND parent_grouping_id IS NULL
    """
    params: list[Any] = []
    if grouping_name:
        sql += " AND name = %s"
        params.append(grouping_name)
    sql += " ORDER BY sort_order"

    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    result = []
    for row in rows:
        anchor_ids_raw = row[3]
        if isinstance(anchor_ids_raw, str):
            anchor_ids = [int(x) for x in anchor_ids_raw.strip("{}").split(",") if x]
        elif isinstance(anchor_ids_raw, list):
            anchor_ids = [int(x) for x in anchor_ids_raw]
        else:
            anchor_ids = []

        result.append({
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "anchor_concept_ids": anchor_ids,
        })
    return result


def fetch_anchor_children(conn: psycopg2.extensions.connection, anchor_ids: list[int]) -> list[dict[str, Any]]:
    """Fetch immediate SNOMED children of the given anchor concepts from concept_ancestor."""
    if not anchor_ids:
        return []

    placeholders = ",".join(["%s"] * len(anchor_ids))
    sql = f"""
        SELECT DISTINCT c.concept_id, c.concept_name, c.concept_class_id
        FROM vocab.concept_ancestor ca
        JOIN vocab.concept c ON c.concept_id = ca.descendant_concept_id
        WHERE ca.ancestor_concept_id IN ({placeholders})
          AND ca.min_levels_of_separation = 1
          AND c.standard_concept = 'S'
          AND c.invalid_reason IS NULL
          AND c.vocabulary_id = 'SNOMED'
        ORDER BY c.concept_name
    """

    with conn.cursor() as cur:
        cur.execute(sql, anchor_ids)
        return [
            {"concept_id": r[0], "concept_name": r[1], "concept_class_id": r[2]}
            for r in cur.fetchall()
        ]


def verify_concept_ids(conn: psycopg2.extensions.connection, concept_ids: list[int]) -> list[int]:
    """Return only concept_ids that exist in vocab.concept."""
    if not concept_ids:
        return []
    placeholders = ",".join(["%s"] * len(concept_ids))
    sql = f"SELECT concept_id FROM vocab.concept WHERE concept_id IN ({placeholders})"
    with conn.cursor() as cur:
        cur.execute(sql, concept_ids)
        return [r[0] for r in cur.fetchall()]


def query_llm(prompt: str) -> str:
    """Send a prompt to II-Medical-8B via Ollama and return the response."""
    resp = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 4096},
        },
        timeout=300,
    )
    resp.raise_for_status()
    return resp.json()["response"]


def build_prompt(grouping_name: str, children: list[dict[str, Any]]) -> str:
    """Build the LLM prompt for grouping children into HLGT-level sub-categories."""
    child_list = "\n".join(
        f"  - {c['concept_name']} (concept_id: {c['concept_id']}, class: {c['concept_class_id']})"
        for c in children
    )

    return f"""You are a clinical informatics specialist. Given the following SNOMED CT concepts that are immediate children of the "{grouping_name}" clinical grouping, organize them into clinically meaningful sub-categories analogous to MedDRA High Level Group Terms (HLGTs).

Each sub-category should:
1. Have a clear, concise clinical name (2-5 words)
2. Have a one-sentence description
3. Contain the concept_ids of its member concepts
4. Be clinically meaningful to a researcher browsing conditions

SNOMED concepts under "{grouping_name}":
{child_list}

Return ONLY a JSON array of sub-categories. No markdown, no explanation. Example format:
[
  {{
    "name": "Coronary artery disorders",
    "description": "Ischemic heart disease, coronary atherosclerosis, and acute coronary syndromes",
    "anchor_concept_ids": [312327, 4185932]
  }}
]

Important rules:
- Every concept_id in the input MUST appear in exactly one sub-category
- Do NOT invent concept_ids that are not in the input list
- Aim for 5-20 sub-categories (depending on how many concepts there are)
- Group by clinical similarity, not alphabetically
- If a concept doesn't fit any group, create an "Other {grouping_name} disorders" catch-all

JSON array:"""


def parse_llm_response(response: str) -> list[dict[str, Any]]:
    """Extract JSON array from LLM response, handling common formatting issues."""
    response = response.strip()
    response = re.sub(r"^```(?:json)?\s*", "", response)
    response = re.sub(r"\s*```$", "", response)

    try:
        parsed = json.loads(response)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\[.*\]", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    print("  WARNING: Could not parse LLM response as JSON", file=sys.stderr)
    return []


def process_grouping(
    conn: psycopg2.extensions.connection,
    grouping: dict[str, Any],
    dry_run: bool = False,
) -> dict[str, Any] | None:
    """Process a single parent grouping: fetch children, query LLM, validate, output."""
    name = grouping["name"]
    anchor_ids = grouping["anchor_concept_ids"]

    print(f"\n{'='*60}")
    print(f"Processing: {name}")
    print(f"  Anchors: {anchor_ids}")

    children = fetch_anchor_children(conn, anchor_ids)
    print(f"  Found {len(children)} immediate children")

    if len(children) < 3:
        print("  SKIP: Too few children for sub-grouping")
        return None

    if dry_run:
        print(f"  DRY RUN: Would query LLM with {len(children)} concepts")
        return None

    prompt = build_prompt(name, children)
    print(f"  Querying {MODEL_NAME}...")

    raw_response = query_llm(prompt)
    sub_groupings = parse_llm_response(raw_response)

    if not sub_groupings:
        print("  ERROR: No valid sub-groupings returned")
        return None

    print(f"  LLM returned {len(sub_groupings)} sub-groupings")

    # Validate concept IDs
    all_returned_ids: set[int] = set()
    for sg in sub_groupings:
        ids = sg.get("anchor_concept_ids", [])
        valid_ids = verify_concept_ids(conn, ids)
        invalid = set(ids) - set(valid_ids)
        if invalid:
            print(f"  WARNING: Removing invalid concept_ids from '{sg['name']}': {invalid}")
        sg["anchor_concept_ids"] = valid_ids
        all_returned_ids.update(valid_ids)

    # Check for missing children
    input_ids = {c["concept_id"] for c in children}
    missing = input_ids - all_returned_ids
    if missing:
        print(f"  WARNING: {len(missing)} input concepts not assigned to any sub-grouping")

    # Remove empty sub-groupings
    sub_groupings = [sg for sg in sub_groupings if sg.get("anchor_concept_ids")]

    # Assign colors
    palette = [
        "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
        "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
        "#0EA5E9", "#D946EF", "#22D3EE", "#A855F7", "#FBBF24",
    ]
    for i, sg in enumerate(sub_groupings):
        sg["icon"] = "folder"
        sg["color"] = palette[i % len(palette)]

    fixture = {
        "parent_grouping": name,
        "domain_id": "Condition",
        "sub_groupings": sub_groupings,
    }

    print(f"  Final: {len(sub_groupings)} validated sub-groupings")
    return fixture


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate HLGT sub-groupings via medical LLM")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without querying LLM")
    parser.add_argument("--grouping", type=str, help="Process only this named grouping")
    args = parser.parse_args()

    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    conn = get_db_connection()
    try:
        groupings = fetch_parent_groupings(conn, args.grouping)
        print(f"Found {len(groupings)} parent groupings to process")

        results: list[dict[str, Any]] = []
        for grouping in groupings:
            fixture = process_grouping(conn, grouping, dry_run=args.dry_run)
            if fixture:
                results.append(fixture)

                # BUG FIX: re.sub arguments were swapped in the original plan
                slug = re.sub(r"[^a-z0-9]+", "_", grouping["name"].lower()).strip("_")
                filepath = FIXTURES_DIR / f"{slug}_hlgt.json"
                with open(filepath, "w") as f:
                    json.dump(fixture, f, indent=2)
                print(f"  Written: {filepath}")

        print(f"\n{'='*60}")
        print(f"Done. Generated {len(results)} fixture files in {FIXTURES_DIR}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
