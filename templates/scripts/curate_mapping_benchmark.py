"""Curate the v0.1.0 concept-mapping benchmark from vocab.concept_relationship.

Phase 3 Plan 6 Task 12 (T-024A). Pulls (source -> standard) pairs via
``relationship_id = 'Maps to'`` and partitions into:

- ``seen.csv``: 2400 pairs whose source_vocab is in the training corpus
  (the vocabularies the bge-base ingest job covered: SNOMED, RxNorm,
  LOINC, ATC, HCPCS).
- ``blind.csv``: 600 pairs from held-out source vocabularies (e.g.
  ICD10CM, NDC, Read, ICD9CM) so the acceptance gate measures the
  model's transfer behavior.

Output paths default to
``commercial/runtime/commercial/mapping/benchmark/v0.1.0/``. The CSVs
themselves are gitignored — the benchmark generator runs against a
customer's local ``parthenon`` DB; we don't redistribute vocabulary
excerpts.

CLI:

    python -m scripts.curate_mapping_benchmark \\
        --db-url postgresql://localhost/parthenon \\
        --seed 42

Output columns: source_code, source_vocab, source_text, target_concept_id,
target_concept_name, target_vocab, target_domain.
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import random
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

_LOGGER = logging.getLogger(__name__)

DEFAULT_OUT_DIR = Path("commercial/runtime/commercial/mapping/benchmark/v0.1.0")
DEFAULT_SEEN_VOCABS = ("SNOMED", "RxNorm", "LOINC", "ATC", "HCPCS")
DEFAULT_BLIND_VOCABS = ("ICD10CM", "ICD9CM", "NDC", "Read", "OMOP Extension")
DEFAULT_SEEN_N = 2400
DEFAULT_BLIND_N = 600

CONNECT_TYPE = Callable[[str], Any]


def _select_pairs(cursor: Any, vocabs: tuple[str, ...], limit: int) -> list[dict[str, Any]]:
    """Return ``Maps to`` pairs whose source is in ``vocabs`` and target is standard."""
    sql = """
        SELECT
            src.concept_code   AS source_code,
            src.vocabulary_id  AS source_vocab,
            src.concept_name   AS source_text,
            tgt.concept_id     AS target_concept_id,
            tgt.concept_name   AS target_concept_name,
            tgt.vocabulary_id  AS target_vocab,
            tgt.domain_id      AS target_domain
        FROM vocab.concept_relationship cr
        JOIN vocab.concept src ON src.concept_id = cr.concept_id_1
        JOIN vocab.concept tgt ON tgt.concept_id = cr.concept_id_2
        WHERE cr.relationship_id = 'Maps to'
          AND cr.invalid_reason IS NULL
          AND src.vocabulary_id = ANY(%s)
          AND tgt.standard_concept = 'S'
          AND tgt.invalid_reason IS NULL
        LIMIT %s
    """
    cursor.execute(sql, (list(vocabs), limit * 4))  # over-fetch for sampling
    rows: list[dict[str, Any]] = []
    for row in cursor.fetchall():
        rows.append(
            {
                "source_code": row[0],
                "source_vocab": row[1],
                "source_text": row[2],
                "target_concept_id": int(row[3]),
                "target_concept_name": row[4],
                "target_vocab": row[5],
                "target_domain": row[6],
            }
        )
    return rows


def _sample_balanced(
    rng: random.Random, pool: list[dict[str, Any]], n: int
) -> list[dict[str, Any]]:
    """Draw n rows from pool, balancing per-source-vocab frequency."""
    by_vocab: dict[str, list[dict[str, Any]]] = {}
    for r in pool:
        by_vocab.setdefault(str(r["source_vocab"]), []).append(r)

    if not by_vocab:
        return []

    per_vocab = max(1, n // len(by_vocab))
    out: list[dict[str, Any]] = []
    for _vocab, rows in by_vocab.items():
        rng.shuffle(rows)
        out.extend(rows[:per_vocab])

    rng.shuffle(out)
    return out[:n]


def _write_csv(rows: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main(
    argv: list[str] | None = None,
    *,
    connect: CONNECT_TYPE | None = None,
) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db-url",
        default=os.environ.get("PARTHENON_DB_URL"),
        help="psycopg DSN; default $PARTHENON_DB_URL.",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Output directory (default: commercial/.../benchmark/v0.1.0/).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Sampling seed; default 42 for cross-run reproducibility.",
    )
    parser.add_argument(
        "--seen-n",
        type=int,
        default=DEFAULT_SEEN_N,
        help=f"Rows in seen.csv (default {DEFAULT_SEEN_N}).",
    )
    parser.add_argument(
        "--blind-n",
        type=int,
        default=DEFAULT_BLIND_N,
        help=f"Rows in blind.csv (default {DEFAULT_BLIND_N}).",
    )
    parser.add_argument(
        "--seen-vocabs",
        nargs="+",
        default=list(DEFAULT_SEEN_VOCABS),
        help="Source vocabularies treated as 'in training corpus'.",
    )
    parser.add_argument(
        "--blind-vocabs",
        nargs="+",
        default=list(DEFAULT_BLIND_VOCABS),
        help="Held-out source vocabularies for the blind set.",
    )
    args = parser.parse_args(argv)

    if not args.db_url:
        parser.error("--db-url (or $PARTHENON_DB_URL) is required")

    logging.basicConfig(level=logging.INFO)
    rng = random.Random(args.seed)

    if connect is None:  # pragma: no cover — real PG path
        import psycopg

        connect = psycopg.connect

    conn = connect(args.db_url)
    try:
        with conn.cursor() as cursor:
            seen_pool = _select_pairs(cursor, tuple(args.seen_vocabs), args.seen_n)
            blind_pool = _select_pairs(cursor, tuple(args.blind_vocabs), args.blind_n)
    finally:
        conn.close()

    seen = _sample_balanced(rng, seen_pool, args.seen_n)
    blind = _sample_balanced(rng, blind_pool, args.blind_n)

    out_dir = Path(args.out_dir)
    _write_csv(seen, out_dir / "seen.csv")
    _write_csv(blind, out_dir / "blind.csv")

    _LOGGER.info(
        "curated benchmark v0.1.0: seen=%d, blind=%d, out_dir=%s",
        len(seen),
        len(blind),
        out_dir,
    )
    return 0


__all__ = [
    "DEFAULT_BLIND_N",
    "DEFAULT_BLIND_VOCABS",
    "DEFAULT_OUT_DIR",
    "DEFAULT_SEEN_N",
    "DEFAULT_SEEN_VOCABS",
    "main",
]


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
