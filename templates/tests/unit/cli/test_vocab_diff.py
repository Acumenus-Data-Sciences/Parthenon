"""Unit tests for parthenon-vocab diff CLI."""

from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from runtime.cli.vocab_diff import app, diff_bundles


def _write_bundle(bundle: Path, rows: list[tuple[int, str]]) -> None:
    bundle.mkdir(parents=True, exist_ok=True)
    lines = ["concept_id\tconcept_name"]
    lines.extend(f"{cid}\t{name}" for cid, name in rows)
    (bundle / "CONCEPT.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_diff_bundles_added_concepts(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    _write_bundle(bundle_a, [(1, "Aspirin"), (2, "Ibuprofen")])
    _write_bundle(bundle_b, [(1, "Aspirin"), (2, "Ibuprofen"), (3, "Naproxen")])

    result = diff_bundles(bundle_a, bundle_b)
    assert result["added"] == [{"concept_id": 3, "concept_name": "Naproxen"}]
    assert result["removed"] == []
    assert result["changed"] == []


def test_diff_bundles_removed_concepts(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    _write_bundle(bundle_a, [(1, "Aspirin"), (2, "Ibuprofen")])
    _write_bundle(bundle_b, [(1, "Aspirin")])

    result = diff_bundles(bundle_a, bundle_b)
    assert result["added"] == []
    assert result["removed"] == [{"concept_id": 2, "concept_name": "Ibuprofen"}]
    assert result["changed"] == []


def test_diff_bundles_changed_concepts(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    _write_bundle(bundle_a, [(1, "Aspirin")])
    _write_bundle(bundle_b, [(1, "Acetylsalicylic acid")])

    result = diff_bundles(bundle_a, bundle_b)
    assert result["added"] == []
    assert result["removed"] == []
    assert len(result["changed"]) == 1
    assert result["changed"][0]["concept_id"] == 1
    assert result["changed"][0]["before"]["concept_name"] == "Aspirin"
    assert result["changed"][0]["after"]["concept_name"] == "Acetylsalicylic acid"


def test_diff_bundles_no_changes(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    _write_bundle(bundle_a, [(1, "Aspirin"), (2, "Ibuprofen")])
    _write_bundle(bundle_b, [(1, "Aspirin"), (2, "Ibuprofen")])

    result = diff_bundles(bundle_a, bundle_b)
    assert result["added"] == []
    assert result["removed"] == []
    assert result["changed"] == []


def test_diff_bundles_added_sorted_by_concept_id(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    _write_bundle(bundle_a, [(1, "Aspirin")])
    _write_bundle(bundle_b, [(1, "Aspirin"), (5, "E"), (3, "C"), (4, "D")])

    result = diff_bundles(bundle_a, bundle_b)
    assert [c["concept_id"] for c in result["added"]] == [3, 4, 5]


def test_cli_diff_writes_to_stdout(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    _write_bundle(bundle_a, [(1, "Aspirin")])
    _write_bundle(bundle_b, [(1, "Aspirin"), (2, "Ibuprofen")])

    runner = CliRunner()
    result = runner.invoke(app, ["diff", str(bundle_a), str(bundle_b)])

    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["added"] == [{"concept_id": 2, "concept_name": "Ibuprofen"}]
    assert payload["removed"] == []
    assert payload["changed"] == []


def test_cli_diff_writes_to_output_file(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    _write_bundle(bundle_a, [(1, "Aspirin")])
    _write_bundle(bundle_b, [(1, "Aspirin"), (2, "Ibuprofen")])
    out_file = tmp_path / "diff.json"

    runner = CliRunner()
    result = runner.invoke(
        app,
        ["diff", str(bundle_a), str(bundle_b), "--output", str(out_file)],
    )

    assert result.exit_code == 0
    assert out_file.exists()
    payload = json.loads(out_file.read_text(encoding="utf-8"))
    assert payload["added"] == [{"concept_id": 2, "concept_name": "Ibuprofen"}]


def test_cli_diff_missing_concept_csv(tmp_path: Path) -> None:
    bundle_a = tmp_path / "a"
    bundle_b = tmp_path / "b"
    bundle_a.mkdir()
    bundle_b.mkdir()
    # bundle_a has no CONCEPT.csv

    runner = CliRunner()
    result = runner.invoke(app, ["diff", str(bundle_a), str(bundle_b)])

    assert result.exit_code != 0
