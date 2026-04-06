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
MODEL_NAME = os.getenv("MODEL_NAME", "ii-medical:8b-q8")

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


def query_llm(prompt: str, num_predict: int = 8192) -> str:
    """Send a prompt to II-Medical-8B via Ollama and return the response.

    Uses raw mode with a pre-filled empty <think></think> block to suppress
    the reasoning chain, which otherwise consumes most of the token budget.
    """
    # Pre-fill empty think block so the model skips reasoning and outputs JSON directly
    raw_prompt = f"{prompt}\n<think>\n</think>\n"
    resp = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": MODEL_NAME,
            "prompt": raw_prompt,
            "stream": False,
            "raw": True,
            "options": {"temperature": 0.3, "num_predict": num_predict},
        },
        timeout=1800,
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
    # Strip reasoning model <think>...</think> blocks — find last </think> and take everything after
    last_think_close = response.rfind("</think>")
    if last_think_close != -1:
        response = response[last_think_close + len("</think>"):].strip()
    elif response.startswith("<think>"):
        # Thinking consumed entire output with no closing tag — nothing usable
        print("  WARNING: Thinking consumed entire output (no </think> found)", file=sys.stderr)
        return []
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
        candidate = match.group()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

        # Try fixing common LLM JSON issues
        # Remove trailing commas before ] or }
        fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
        # Remove text/comments between JSON objects (e.g., "Here is group 2:")
        fixed = re.sub(r"}\s*[A-Za-z][^{]*{", "},{", fixed)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

    # Last resort: extract individual JSON objects and wrap in array
    objects = re.findall(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", response)
    if objects:
        valid_objects: list[dict[str, Any]] = []
        for obj_str in objects:
            try:
                obj = json.loads(obj_str)
                if isinstance(obj, dict) and "name" in obj:
                    valid_objects.append(obj)
            except json.JSONDecodeError:
                continue
        if valid_objects:
            print(f"  WARNING: Extracted {len(valid_objects)} objects via fallback parser")
            return valid_objects

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

    # Scale token budget based on number of children
    num_predict = min(32768, max(8192, len(children) * 128))

    max_attempts = 3
    sub_groupings: list[dict[str, Any]] = []
    for attempt in range(1, max_attempts + 1):
        print(f"  Querying {MODEL_NAME} (attempt {attempt}/{max_attempts}, budget: {num_predict} tokens)...")

        try:
            raw_response = query_llm(prompt, num_predict=num_predict)
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            print(f"  Attempt {attempt} timed out or connection error: {e.__class__.__name__}")
            if attempt < max_attempts:
                num_predict = min(32768, num_predict + 4096)
            continue

        # Debug: show raw response stats
        has_think_close = "</think>" in raw_response
        think_len = 0
        if has_think_close:
            think_len = raw_response.rfind("</think>") + len("</think>")
        print(f"  Response: {len(raw_response)} chars, think: {think_len} chars, has </think>: {has_think_close}")

        sub_groupings = parse_llm_response(raw_response)

        if sub_groupings:
            break

        print(f"  Attempt {attempt} failed to produce valid JSON")
        # Increase budget on retry in case thinking consumed all tokens
        num_predict = min(32768, num_predict + 4096)

    if not sub_groupings:
        print("  ERROR: No valid sub-groupings after all attempts")
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
        failed: list[str] = []
        for grouping in groupings:
            try:
                fixture = process_grouping(conn, grouping, dry_run=args.dry_run)
            except Exception as e:
                print(f"  EXCEPTION processing {grouping['name']}: {e}")
                failed.append(grouping["name"])
                continue

            if fixture:
                results.append(fixture)

                # BUG FIX: re.sub arguments were swapped in the original plan
                slug = re.sub(r"[^a-z0-9]+", "_", grouping["name"].lower()).strip("_")
                filepath = FIXTURES_DIR / f"{slug}_hlgt.json"
                with open(filepath, "w") as f:
                    json.dump(fixture, f, indent=2)
                print(f"  Written: {filepath}")
            else:
                if not args.dry_run:
                    failed.append(grouping["name"])

        print(f"\n{'='*60}")
        print(f"Done. Generated {len(results)} fixture files in {FIXTURES_DIR}")
        if failed:
            print(f"Failed groupings ({len(failed)}): {', '.join(failed)}")
            print("Re-run with --grouping NAME to retry individual failures.")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
