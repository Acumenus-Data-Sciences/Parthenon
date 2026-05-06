"""ARTEMIS regimen matcher: drug-set + temporal-window matching.

Per Plan 5 Task 4: for each (person_id, day) pair in the input
drug_exposure rows, find the largest subset of pattern.drugs that is
co-administered within ``window_days``. If coverage ≥ ``min_coverage``,
emit a RegimenMatch.

The matcher is pure Python (no pandas dependency on the hot path) —
input is an iterable of dict rows from a SQL query against
``<schema>.drug_exposure``.
"""

from __future__ import annotations

import json
from collections import defaultdict
from collections.abc import Iterable
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from runtime.oncology.exceptions import ArtemisLibraryError
from runtime.oncology.types import RegimenDrug, RegimenMatch, RegimenPattern


def load_pattern_library(version: str = "v0.2.0") -> list[RegimenPattern]:
    """Load the regimen pattern JSON shipped with this version of the runtime.

    The library lives at ``runtime/oncology/artemis/<version>/patterns.json``.

    - ``v0.1.0``: hand-curated 5-regimen subset (Phase 2 Plan 5).
    - ``v0.2.0``: full ~600-regimen library extracted from the HemOnc
      R-package at Docker build time (Phase 3 Plan 7 Section B). The
      ``patterns.json`` is materialized by Stage 1 of templates/Dockerfile
      and copied into Stage 2; it is NOT committed to git.

    Default switched to v0.2.0 in Phase 3 Plan 7 Task 15. Callers that
    need the old hand-curated subset must pass ``version="v0.1.0"``
    explicitly.

    If v0.2.0/patterns.json is missing (the dev runner has not built the
    Docker image), the loader falls back to v0.1.0 so the unit suite and
    local dev still work without R installed.
    """
    path = Path(__file__).parent / "artemis" / version / "patterns.json"
    if not path.is_file() and version == "v0.2.0":
        # Fall back to v0.1.0 when the Docker-built library isn't present
        # (dev runner / CI before Section B's build step). Caller logic is
        # unchanged because the v0.1.0 subset is a strict subset of v0.2.0.
        path = Path(__file__).parent / "artemis" / "v0.1.0" / "patterns.json"
        version = "v0.1.0"
    if not path.is_file():
        raise ArtemisLibraryError(f"pattern library not found: {path}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ArtemisLibraryError(f"invalid pattern library JSON: {exc}") from exc

    if data.get("version") != version:
        raise ArtemisLibraryError(
            f"library version mismatch: expected {version}, got {data.get('version')!r}"
        )

    patterns = []
    for entry in data.get("regimens", []):
        drugs = [RegimenDrug(**d) for d in entry["drugs"]]
        patterns.append(
            RegimenPattern(
                regimen_name=entry["regimen_name"],
                indication=entry["indication"],
                phase=entry["phase"],
                drugs=drugs,
            )
        )
    return patterns


class RegimenMatcher:
    """Match drug_exposure rows against ARTEMIS regimen patterns."""

    def __init__(
        self,
        patterns: list[RegimenPattern],
        window_days: int = 7,
        min_coverage: float = 0.75,
    ) -> None:
        self._patterns = patterns
        self._window = timedelta(days=window_days)
        self._min_coverage = min_coverage

    def match(self, drug_exposures: Iterable[dict[str, Any]]) -> list[RegimenMatch]:
        """Match exposures (dict rows with person_id, drug_concept_id,
        drug_exposure_start_date, optional drug_exposure_id) against patterns.

        For each person, group by drug_concept_id, then for each pattern
        check if a window of width ``window_days`` covers ≥ ``min_coverage``
        of the pattern's drugs.
        """
        per_person: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for row in drug_exposures:
            pid = int(row["person_id"])
            per_person[pid].append(dict(row))

        matches: list[RegimenMatch] = []
        for person_id, rows in per_person.items():
            rows.sort(key=lambda r: r["drug_exposure_start_date"])
            for pattern in self._patterns:
                m = self._match_pattern_for_person(person_id, rows, pattern)
                if m is not None:
                    matches.append(m)
        return matches

    def _match_pattern_for_person(
        self,
        person_id: int,
        sorted_rows: list[dict[str, Any]],
        pattern: RegimenPattern,
    ) -> RegimenMatch | None:
        pattern_concept_ids = {d.rxnorm_concept_id for d in pattern.drugs}
        n_required = len(pattern.drugs)

        # Sliding window — each row is the window anchor.
        for i, anchor in enumerate(sorted_rows):
            anchor_date: date = anchor["drug_exposure_start_date"]
            window_end = anchor_date + self._window
            seen: dict[int, int] = {}  # drug_concept_id → drug_exposure_id (first occurrence)
            j = i
            while j < len(sorted_rows):
                row = sorted_rows[j]
                row_date: date = row["drug_exposure_start_date"]
                if row_date > window_end:
                    break
                concept_id = int(row["drug_concept_id"])
                if concept_id in pattern_concept_ids and concept_id not in seen:
                    de_id = int(row.get("drug_exposure_id", 0) or 0)
                    seen[concept_id] = de_id
                j += 1

            coverage = len(seen) / n_required
            if coverage >= self._min_coverage:
                end_date = anchor_date + self._window
                # Episode end = window end for v0.1; future enhancement: track
                # full course duration via cycle metadata.
                return RegimenMatch(
                    regimen_name=pattern.regimen_name,
                    person_id=person_id,
                    episode_start_date=anchor_date,
                    episode_end_date=end_date,
                    drug_exposure_ids=sorted(de_id for de_id in seen.values() if de_id),
                    coverage=coverage,
                )
        return None
