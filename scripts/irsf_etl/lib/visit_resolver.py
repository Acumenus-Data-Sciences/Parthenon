"""Visit resolution for IRSF ETL downstream clinical event scripts.

Loads visit_id_map.csv (produced by visit_derivation.py) and resolves
clinical events to visit_occurrence_id values using three strategies:
exact match, date-only fallback, and nearest-date fallback.

Follows the PersonIdRegistry frozen dataclass pattern from id_registry.py.
"""

from __future__ import annotations

import bisect
import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

from scripts.irsf_etl.lib.csv_utils import read_csv_safe

logger = logging.getLogger(__name__)

# OMOP concept_id for outpatient visit -- preferred in date-only fallback
_OUTPATIENT_CONCEPT_ID = 9202


@dataclass(frozen=True)
class VisitResolver:
    """Immutable visit lookup for downstream clinical event scripts.

    Resolves (person_id, visit_date, visit_label) to visit_occurrence_id
    using three resolution strategies:
      1. Exact match on (person_id, visit_date, visit_label)
      2. Date-only fallback on (person_id, visit_date), preferring outpatient
      3. Nearest-date fallback within a configurable day window

    Construction via classmethods only (from_csv, from_dataframe).
    """

    _exact_map: dict[tuple[int, str, str], int] = field(repr=False)
    _date_map: dict[tuple[int, str], list[tuple[int, int]]] = field(repr=False)
    _person_dates: dict[int, list[tuple[str, int]]] = field(repr=False)
    _visit_count: int = field(repr=False)
    _all_person_ids: frozenset[int] = field(repr=False)

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    @classmethod
    def from_csv(cls, path: Path) -> VisitResolver:
        """Load resolver from visit_id_map.csv.

        Expected columns: visit_occurrence_id, person_id, visit_date,
                          visit_label, visit_concept_id.

        Uses csv_utils.read_csv_safe for encoding safety.
        """
        df = read_csv_safe(path)
        return cls.from_dataframe(df)

    @classmethod
    def from_dataframe(cls, df: pd.DataFrame) -> VisitResolver:
        """Build resolver from a DataFrame.

        Args:
            df: Must have columns: visit_occurrence_id, person_id,
                visit_date, visit_label, visit_concept_id.

        Returns:
            Frozen VisitResolver.
        """
        exact_map: dict[tuple[int, str, str], int] = {}
        date_map: dict[tuple[int, str], list[tuple[int, int]]] = {}
        person_dates: dict[int, list[tuple[str, int]]] = {}
        person_id_set: set[int] = set()

        for _, row in df.iterrows():
            visit_occ_id = int(row["visit_occurrence_id"])
            person_id = int(row["person_id"])
            visit_date = str(row["visit_date"]).strip()
            visit_label = str(row.get("visit_label", "") or "").strip()
            visit_concept_id = int(row.get("visit_concept_id", 0) or 0)

            person_id_set.add(person_id)

            # Exact map: (person_id, date, label) -> visit_occurrence_id
            exact_key = (person_id, visit_date, visit_label)
            if exact_key not in exact_map:
                exact_map[exact_key] = visit_occ_id

            # Date map: (person_id, date) -> list of (visit_occurrence_id, concept_id)
            date_key = (person_id, visit_date)
            if date_key not in date_map:
                date_map[date_key] = []
            date_map[date_key].append((visit_occ_id, visit_concept_id))

            # Person dates: person_id -> sorted list of (date_str, visit_occurrence_id)
            if person_id not in person_dates:
                person_dates[person_id] = []
            person_dates[person_id].append((visit_date, visit_occ_id))

        # Sort person_dates by date for binary search in nearest-date fallback
        for pid in person_dates:
            person_dates[pid].sort(key=lambda x: x[0])

        visit_count = len(df)

        logger.info(
            "Built VisitResolver: %d visits for %d persons",
            visit_count,
            len(person_id_set),
        )

        return cls(
            _exact_map=exact_map,
            _date_map=date_map,
            _person_dates=person_dates,
            _visit_count=visit_count,
            _all_person_ids=frozenset(person_id_set),
        )

    # ------------------------------------------------------------------
    # Resolution
    # ------------------------------------------------------------------

    def resolve(
        self,
        person_id: int,
        visit_date: str,
        visit_label: Optional[str] = None,
    ) -> Optional[int]:
        """Resolve a clinical event to a visit_occurrence_id.

        Strategy 1: Exact match on (person_id, visit_date, visit_label)
                    if label is provided.
        Strategy 2: Date match on (person_id, visit_date), preferring
                    outpatient (9202) visits.
        Strategy 3: Return None if no match.

        Args:
            person_id: OMOP person_id.
            visit_date: ISO date string YYYY-MM-DD.
            visit_label: Optional visit label (e.g., "Screening", "Visit 1").

        Returns:
            visit_occurrence_id or None if not found.
        """
        # Strategy 1: exact match
        if visit_label is not None:
            exact_key = (person_id, visit_date, visit_label)
            result = self._exact_map.get(exact_key)
            if result is not None:
                return result

        # Strategy 2: date-only fallback, prefer outpatient (9202)
        date_key = (person_id, visit_date)
        candidates = self._date_map.get(date_key)
        if candidates is not None:
            return _pick_preferred(candidates)

        # Strategy 3: no match
        return None

    def resolve_or_nearest(
        self,
        person_id: int,
        visit_date: str,
        visit_label: Optional[str] = None,
        max_days: int = 7,
    ) -> Optional[int]:
        """Resolve with nearest-date fallback.

        Tries resolve() first. If None, finds the nearest visit for this
        person within max_days window using binary search.

        Args:
            person_id: OMOP person_id.
            visit_date: ISO date string YYYY-MM-DD.
            visit_label: Optional visit label.
            max_days: Maximum day difference for nearest-date match.

        Returns:
            visit_occurrence_id or None if no match within window.
        """
        result = self.resolve(person_id, visit_date, visit_label)
        if result is not None:
            return result

        # Nearest-date fallback via binary search
        dates_list = self._person_dates.get(person_id)
        if dates_list is None:
            return None

        try:
            target = date.fromisoformat(visit_date)
        except ValueError:
            return None

        # Extract just the date strings for bisect
        date_strs = [d[0] for d in dates_list]
        idx = bisect.bisect_left(date_strs, visit_date)

        best_id: Optional[int] = None
        best_diff = max_days + 1  # sentinel above threshold

        # Check the insertion point and its neighbors
        for candidate_idx in (idx - 1, idx):
            if 0 <= candidate_idx < len(dates_list):
                cand_date_str, cand_id = dates_list[candidate_idx]
                try:
                    cand_date = date.fromisoformat(cand_date_str)
                except ValueError:
                    continue
                diff = abs((target - cand_date).days)
                if diff < best_diff:
                    best_diff = diff
                    best_id = cand_id

        if best_diff <= max_days:
            return best_id
        return None

    def resolve_series(
        self,
        person_ids: pd.Series,
        visit_dates: pd.Series,
        visit_labels: Optional[pd.Series] = None,
    ) -> pd.Series:
        """Vectorized resolve for DataFrame columns.

        Args:
            person_ids: Series of person_id values.
            visit_dates: Series of visit_date strings.
            visit_labels: Optional Series of visit labels.

        Returns:
            Series of visit_occurrence_ids with pd.NA for unresolved.
        """
        results = []
        for i in range(len(person_ids)):
            pid = person_ids.iloc[i]
            vdate = visit_dates.iloc[i]
            label = visit_labels.iloc[i] if visit_labels is not None else None

            # Handle NA/NaN in inputs
            if pd.isna(pid) or pd.isna(vdate):
                results.append(pd.NA)
                continue

            if label is not None and pd.isna(label):
                label = None

            resolved = self.resolve(int(pid), str(vdate), label)
            results.append(resolved if resolved is not None else pd.NA)

        return pd.array(results, dtype=pd.Int64Dtype())

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def count(self) -> int:
        """Number of visits in the map."""
        return self._visit_count

    @property
    def person_ids(self) -> frozenset[int]:
        """All person_ids with visits."""
        return self._all_person_ids

    def __len__(self) -> int:
        return self._visit_count


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _pick_preferred(candidates: list[tuple[int, int]]) -> int:
    """Pick preferred visit from date-match candidates.

    Prefers outpatient (9202) over other visit types.
    If multiple outpatient visits, returns the first one.
    If no outpatient, returns the first candidate.

    Args:
        candidates: List of (visit_occurrence_id, visit_concept_id).

    Returns:
        visit_occurrence_id of the preferred match.
    """
    for visit_occ_id, concept_id in candidates:
        if concept_id == _OUTPATIENT_CONCEPT_ID:
            return visit_occ_id
    return candidates[0][0]
