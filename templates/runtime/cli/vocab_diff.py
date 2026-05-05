"""``parthenon-vocab`` CLI: diff two OHDSI Athena vocabulary bundles.

Standalone diagnostic CLI (Plan 4 Phase C, devplan T-008 differentiator).
Compares ``CONCEPT.csv`` between two Athena bundle directories and emits
JSON listing concepts that were added, removed, or changed.

Used as a pre-flight tool before running the ``load_athena_vocabulary``
template against production: operators run a quarterly diff to understand
the delta a new bundle will introduce.

Wired as the ``parthenon-vocab`` console script (see ``[project.scripts]``
in ``pyproject.toml``).
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

import typer

app = typer.Typer(help="Diff OHDSI Athena vocabulary bundles.")

CONCEPT_FILE = "CONCEPT.csv"


@app.callback()
def _root() -> None:
    """``parthenon-vocab`` — diagnostic tools for OHDSI Athena vocabulary bundles.

    The empty callback forces Typer to keep the subcommand structure even
    when only one subcommand (``diff``) is registered. Future subcommands
    (e.g. ``download``, ``validate``) can be added without a CLI break.
    """


def _load_concepts(bundle: Path) -> dict[int, dict[str, Any]]:
    """Load ``CONCEPT.csv`` from ``bundle`` keyed by ``concept_id``.

    Athena distributes ``CONCEPT.csv`` as tab-delimited UTF-8 with a header
    row. Each row is loaded as a string-valued dict; ``concept_id`` is
    coerced to ``int`` for stable hashable keys and sorting.
    """
    concept_csv = bundle / CONCEPT_FILE
    if not concept_csv.exists():
        raise FileNotFoundError(f"{CONCEPT_FILE} not found in bundle: {bundle}")

    concepts: dict[int, dict[str, Any]] = {}
    with concept_csv.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            cid = int(row["concept_id"])
            entry: dict[str, Any] = dict(row)
            entry["concept_id"] = cid
            concepts[cid] = entry
    return concepts


def diff_bundles(bundle_a: Path, bundle_b: Path) -> dict[str, list[dict[str, Any]]]:
    """Return added / removed / changed concepts between two Athena bundles.

    Comparison is performed on ``CONCEPT.csv`` only. ``added`` and
    ``removed`` are sorted ascending by ``concept_id`` for deterministic
    output. ``changed`` rows include both ``before`` and ``after``
    snapshots for audit-trail use.
    """
    a = _load_concepts(bundle_a)
    b = _load_concepts(bundle_b)

    added = [b[cid] for cid in sorted(b.keys() - a.keys())]
    removed = [a[cid] for cid in sorted(a.keys() - b.keys())]
    changed: list[dict[str, Any]] = []
    for cid in sorted(a.keys() & b.keys()):
        if a[cid] != b[cid]:
            changed.append(
                {
                    "concept_id": cid,
                    "before": a[cid],
                    "after": b[cid],
                }
            )

    return {"added": added, "removed": removed, "changed": changed}


@app.command("diff")
def diff_command(
    bundle_a: Path = typer.Argument(..., help="Path to the baseline (older) Athena bundle."),
    bundle_b: Path = typer.Argument(..., help="Path to the comparison (newer) Athena bundle."),
    output: Path | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Write JSON to this path. If omitted, JSON is printed to stdout.",
    ),
) -> None:
    """Diff two Athena vocabulary bundles and emit added/removed/changed JSON."""
    try:
        result = diff_bundles(bundle_a, bundle_b)
    except FileNotFoundError as exc:
        typer.echo(f"error: {exc}", err=True)
        raise typer.Exit(code=2) from exc

    payload = json.dumps(result, indent=2, default=str)
    if output is not None:
        output.write_text(payload, encoding="utf-8")
    else:
        typer.echo(payload)


# Allow ``python -m runtime.cli.vocab_diff`` for parity with the entrypoint.
if __name__ == "__main__":  # pragma: no cover
    app()


__all__ = ["app", "diff_bundles"]
