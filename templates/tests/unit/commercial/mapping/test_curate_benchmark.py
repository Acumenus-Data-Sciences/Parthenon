"""Phase 3 Plan 6 Task 12 (T-024A): mapping benchmark curation script."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

import pytest

from scripts.curate_mapping_benchmark import (
    DEFAULT_BLIND_N,
    DEFAULT_BLIND_VOCABS,
    DEFAULT_SEEN_N,
    DEFAULT_SEEN_VOCABS,
    _sample_balanced,
    _write_csv,
    main,
)


class _FakeCursor:
    """Returns a programmable list of pair rows for two consecutive .execute calls."""

    def __init__(self, response_batches: list[list[tuple[Any, ...]]]) -> None:
        self._batches = list(response_batches)
        self.executes: list[tuple[str, tuple[Any, ...]]] = []
        self._next: list[tuple[Any, ...]] = []

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> None:
        self.executes.append((query, params))
        self._next = self._batches.pop(0) if self._batches else []

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self._next)

    def __enter__(self) -> _FakeCursor:
        return self

    def __exit__(self, *args: Any) -> None:
        return None


class _FakeConn:
    def __init__(self, cursor: _FakeCursor) -> None:
        self._cursor = cursor
        self.closed = False

    def cursor(self) -> _FakeCursor:
        return self._cursor

    def close(self) -> None:
        self.closed = True


def _row(
    source_code: str = "X",
    source_vocab: str = "SNOMED",
    target_concept_id: int = 100,
    target_vocab: str = "SNOMED",
    target_domain: str = "Condition",
) -> tuple[Any, ...]:
    return (
        source_code,
        source_vocab,
        f"{source_vocab}::{source_code}",
        target_concept_id,
        f"target {target_concept_id}",
        target_vocab,
        target_domain,
    )


# ---------- pure helper tests ----------


def test_sample_balanced_caps_at_n() -> None:
    import random

    rng = random.Random(42)
    pool = [{"source_vocab": v, "i": i} for v in ("A", "B", "C") for i in range(20)]
    out = _sample_balanced(rng, pool, n=15)
    assert len(out) == 15


def test_sample_balanced_per_vocab_balance() -> None:
    """When n is divisible by vocab count, expect ~equal per-vocab share."""
    import random

    rng = random.Random(42)
    pool = [{"source_vocab": v, "i": i} for v in ("A", "B") for i in range(50)]
    out = _sample_balanced(rng, pool, n=20)
    counts: dict[str, int] = {}
    for r in out:
        counts[r["source_vocab"]] = counts.get(r["source_vocab"], 0) + 1
    # Each vocab gets at least 5 rows when n=20 across 2 vocabs.
    assert counts["A"] >= 5
    assert counts["B"] >= 5


def test_sample_balanced_empty_pool_returns_empty() -> None:
    import random

    rng = random.Random(42)
    assert _sample_balanced(rng, [], n=10) == []


def test_sample_balanced_deterministic_with_seed() -> None:
    import random

    pool = [{"source_vocab": "A", "i": i} for i in range(50)]
    rng_a = random.Random(42)
    rng_b = random.Random(42)
    a = _sample_balanced(rng_a, [dict(r) for r in pool], n=10)
    b = _sample_balanced(rng_b, [dict(r) for r in pool], n=10)
    assert a == b


def test_write_csv_emits_header_and_rows(tmp_path: Path) -> None:
    rows = [
        {"source_code": "A", "target_concept_id": 1},
        {"source_code": "B", "target_concept_id": 2},
    ]
    target = tmp_path / "x.csv"
    _write_csv(rows, target)
    text = target.read_text(encoding="utf-8")
    assert text.startswith("source_code,target_concept_id\n")
    parsed = list(csv.DictReader(target.open(encoding="utf-8")))
    assert len(parsed) == 2
    assert parsed[0]["source_code"] == "A"


def test_write_csv_empty_rows_writes_empty_file(tmp_path: Path) -> None:
    target = tmp_path / "empty.csv"
    _write_csv([], target)
    assert target.read_text(encoding="utf-8") == ""


# ---------- main() CLI tests ----------


def test_main_requires_db_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PARTHENON_DB_URL", raising=False)
    with pytest.raises(SystemExit) as excinfo:
        main([])
    assert excinfo.value.code == 2


def test_main_writes_seen_and_blind_csvs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PARTHENON_DB_URL", "postgresql://stub")
    seen_rows = [_row(source_code=f"S{i}") for i in range(20)]
    blind_rows = [_row(source_code=f"B{i}", source_vocab="ICD10CM") for i in range(10)]
    cursor = _FakeCursor([seen_rows, blind_rows])
    conn = _FakeConn(cursor)

    rc = main(
        [
            "--out-dir",
            str(tmp_path),
            "--seen-n",
            "10",
            "--blind-n",
            "5",
        ],
        connect=lambda _dsn: conn,
    )
    assert rc == 0
    assert conn.closed
    seen_csv = tmp_path / "seen.csv"
    blind_csv = tmp_path / "blind.csv"
    assert seen_csv.is_file()
    assert blind_csv.is_file()
    seen_parsed = list(csv.DictReader(seen_csv.open(encoding="utf-8")))
    assert 1 <= len(seen_parsed) <= 10
    blind_parsed = list(csv.DictReader(blind_csv.open(encoding="utf-8")))
    assert 1 <= len(blind_parsed) <= 5


def test_main_uses_seen_vocab_filter(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PARTHENON_DB_URL", "postgresql://stub")
    cursor = _FakeCursor([[], []])
    conn = _FakeConn(cursor)
    main(
        [
            "--out-dir",
            str(tmp_path),
            "--seen-vocabs",
            "SNOMED",
            "--blind-vocabs",
            "ICD10CM",
        ],
        connect=lambda _dsn: conn,
    )
    # First execute is the seen query; should bind ['SNOMED'].
    assert cursor.executes[0][1][0] == ["SNOMED"]
    assert cursor.executes[1][1][0] == ["ICD10CM"]


def test_default_n_constants() -> None:
    """Plan: 'seen.csv 2400 + blind.csv 600 = 3k pairs'."""
    assert DEFAULT_SEEN_N == 2400
    assert DEFAULT_BLIND_N == 600
    assert DEFAULT_SEEN_N + DEFAULT_BLIND_N == 3000


def test_default_vocab_partitions() -> None:
    """Seen + blind sets must be disjoint."""
    seen = set(DEFAULT_SEEN_VOCABS)
    blind = set(DEFAULT_BLIND_VOCABS)
    assert not seen & blind
