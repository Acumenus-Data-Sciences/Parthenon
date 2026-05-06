"""Plan 6 Gate 2 acceptance harness — Claude Haiku 4.5 wired against the live pipeline.

One-shot driver for the Phase 3 spec §2 Gate 2 acceptance run. Bypasses
the gated ``pytest -m mapping_eval`` lane (which targets OpenAI/Ollama)
and wires Anthropic's Claude Haiku 4.5 as the rerank LLM directly.

Usage:

    PARTHENON_DB_URL=... \\
        uv run python -m scripts.run_mapping_acceptance \\
            --benchmark-dir commercial/runtime/commercial/mapping/benchmark/v0.1.0 \\
            --api-key-file /home/smudoshi/Github/Parthenon/.claudeapikey \\
            --max-rows 100   # optional smoke; omit for full 3000

Acceptance gates:

- ``seen.csv``  top-1 >= 0.60, top-5 >= 0.85
- ``blind.csv`` top-1 >= 0.50, top-5 >= 0.75

Cost budget: ~3000 Claude Haiku calls; with input ~1.5k tokens + output ~300
tokens per call, expect $1-3 of API spend on the full run.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

_LOGGER = logging.getLogger(__name__)

# Plan 6 acceptance gates (per ADR 0019).
SEEN_TOP1_MIN = 0.60
SEEN_TOP5_MIN = 0.85
BLIND_TOP1_MIN = 0.50
BLIND_TOP5_MIN = 0.75

DEFAULT_RERANK_MODEL = "claude-haiku-4-5-20251001"


def _build_anthropic_caller(
    api_key: str, model: str
) -> Callable[[str, str], dict[str, Any] | None]:
    """Return an LlmCallable backed by ``anthropic.Anthropic.messages.create``.

    The reranker prompt is the full v0.1.0 prompt template (SYSTEM +
    user); we pass it as the ``messages[0].content`` and rely on Claude's
    JSON-output prompt-following to return a parseable rerank response.
    """
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)

    def call(user_prompt: str, prompt_version: str) -> dict[str, Any] | None:
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=1024,
                system=(
                    "You are a clinical-informatics reranker. Output ONLY a "
                    "single JSON object matching the response schema described "
                    "in the user message. NEVER fabricate a concept_id that "
                    "is not in the input candidates list."
                ),
                messages=[{"role": "user", "content": user_prompt}],
            )
        except Exception:
            _LOGGER.exception("anthropic call failed")
            return None

        text = "".join(
            block.text for block in resp.content if getattr(block, "type", None) == "text"
        )
        # Tolerate ```json ... ``` fences.
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].lstrip()
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            _LOGGER.warning(
                "rerank response not parseable as JSON; first 200 chars: %r", cleaned[:200]
            )
            return None
        if not isinstance(parsed, dict):
            return None
        return parsed

    return call


def _load_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file() or path.stat().st_size == 0:
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _evaluate_pipeline(
    rows: list[dict[str, str]],
    *,
    db_url: str,
    api_caller: Callable[[str, str], dict[str, Any] | None],
    rerank_model: str,
    max_rows: int | None = None,
) -> dict[str, Any]:
    """Run rows through the full pipeline; return metrics + per-row hit log."""
    import psycopg

    from runtime.commercial.mapping.embedder import BgeEmbedder
    from runtime.commercial.mapping.reranker import ConceptReranker
    from runtime.commercial.mapping.retriever import ConceptRetriever

    embedder = BgeEmbedder()
    retriever = ConceptRetriever()
    reranker = ConceptReranker(llm_callable=api_caller, rerank_model=rerank_model)

    sample = rows if max_rows is None else rows[:max_rows]
    n = len(sample)
    top1_hits = 0
    top5_hits = 0
    started = time.time()

    with psycopg.connect(db_url) as conn, conn.cursor() as cursor:
        for idx, row in enumerate(sample, start=1):
            target = int(row["target_concept_id"])
            source_text = row["source_text"]
            source_code = row["source_code"]
            source_vocab = row["source_vocab"]

            vec = embedder.embed([source_text])[0]
            candidates = retriever.search(cursor, vec)
            result = reranker.rerank(
                source_text=source_text,
                source_code=source_code,
                source_vocab=source_vocab,
                candidates=candidates,
            )
            ids = [c.concept_id for c in result.candidates]
            if ids and ids[0] == target:
                top1_hits += 1
            if target in ids[:5]:
                top5_hits += 1
            if idx % 50 == 0 or idx == n:
                elapsed = time.time() - started
                rate = idx / elapsed if elapsed > 0 else 0.0
                _LOGGER.info(
                    "[%4d/%d] top1=%d top5=%d  rate=%.1f/s  eta=%ds",
                    idx,
                    n,
                    top1_hits,
                    top5_hits,
                    rate,
                    int((n - idx) / rate) if rate > 0 else -1,
                )

    return {
        "n": n,
        "top1": top1_hits / n if n else 0.0,
        "top5": top5_hits / n if n else 0.0,
        "top1_hits": top1_hits,
        "top5_hits": top5_hits,
        "elapsed_sec": int(time.time() - started),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--benchmark-dir",
        type=Path,
        default=Path("commercial/runtime/commercial/mapping/benchmark/v0.1.0"),
        help="Directory containing seen.csv + blind.csv (per Task 12 layout).",
    )
    parser.add_argument(
        "--db-url",
        default=os.environ.get("PARTHENON_DB_URL"),
        help="psycopg DSN; default $PARTHENON_DB_URL.",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("ANTHROPIC_API_KEY"),
        help="Anthropic API key; default $ANTHROPIC_API_KEY.",
    )
    parser.add_argument(
        "--api-key-file",
        type=Path,
        help="Path to a file containing the Anthropic API key (alternative to --api-key).",
    )
    parser.add_argument(
        "--rerank-model",
        default=DEFAULT_RERANK_MODEL,
        help=f"Anthropic model id (default: {DEFAULT_RERANK_MODEL}).",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        help="Cap rows per CSV (smoke runs); default = full benchmark.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if not args.db_url:
        parser.error("--db-url (or $PARTHENON_DB_URL) is required")

    api_key = args.api_key
    if api_key is None and args.api_key_file is not None:
        api_key = args.api_key_file.read_text(encoding="utf-8").strip()
    if not api_key:
        parser.error("--api-key, --api-key-file, or $ANTHROPIC_API_KEY is required")

    seen_csv = args.benchmark_dir / "seen.csv"
    blind_csv = args.benchmark_dir / "blind.csv"
    seen_rows = _load_csv(seen_csv)
    blind_rows = _load_csv(blind_csv)
    if not seen_rows and not blind_rows:
        parser.error(
            f"benchmark CSVs absent or empty under {args.benchmark_dir}; "
            "run scripts/curate_mapping_benchmark first"
        )

    caller = _build_anthropic_caller(api_key, args.rerank_model)

    results: dict[str, Any] = {
        "rerank_model": args.rerank_model,
        "max_rows": args.max_rows,
    }

    if seen_rows:
        _LOGGER.info("=== seen.csv (%d rows) ===", len(seen_rows))
        results["seen"] = _evaluate_pipeline(
            seen_rows,
            db_url=args.db_url,
            api_caller=caller,
            rerank_model=args.rerank_model,
            max_rows=args.max_rows,
        )
    if blind_rows:
        _LOGGER.info("=== blind.csv (%d rows) ===", len(blind_rows))
        results["blind"] = _evaluate_pipeline(
            blind_rows,
            db_url=args.db_url,
            api_caller=caller,
            rerank_model=args.rerank_model,
            max_rows=args.max_rows,
        )

    print()
    print("=" * 60)
    print("Plan 6 Gate 2 acceptance results")
    print("=" * 60)
    if "seen" in results:
        s = results["seen"]
        ok1 = "PASS" if s["top1"] >= SEEN_TOP1_MIN else "FAIL"
        ok5 = "PASS" if s["top5"] >= SEEN_TOP5_MIN else "FAIL"
        print(f"seen ({s['n']}): top-1 = {s['top1']:.3f} ({ok1} >= {SEEN_TOP1_MIN})")
        print(f"             top-5 = {s['top5']:.3f} ({ok5} >= {SEEN_TOP5_MIN})")
    if "blind" in results:
        b = results["blind"]
        ok1 = "PASS" if b["top1"] >= BLIND_TOP1_MIN else "FAIL"
        ok5 = "PASS" if b["top5"] >= BLIND_TOP5_MIN else "FAIL"
        print(f"blind ({b['n']}): top-1 = {b['top1']:.3f} ({ok1} >= {BLIND_TOP1_MIN})")
        print(f"              top-5 = {b['top5']:.3f} ({ok5} >= {BLIND_TOP5_MIN})")
    print("=" * 60)

    seen_pass = "seen" not in results or (
        results["seen"]["top1"] >= SEEN_TOP1_MIN and results["seen"]["top5"] >= SEEN_TOP5_MIN
    )
    blind_pass = "blind" not in results or (
        results["blind"]["top1"] >= BLIND_TOP1_MIN and results["blind"]["top5"] >= BLIND_TOP5_MIN
    )
    return 0 if seen_pass and blind_pass else 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
