"""Cross-protocol ID reconciliation for IRSF ETL.

Maps three ID systems (participant_id5211, participant_id5201, unified
participant_id) to deterministic OMOP person_id values using the
Person_Characteristics_5201_5211.csv crosswalk.

person_id = int(participant_id)  -- direct use, no hashing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pandas as pd

from scripts.irsf_etl.lib.csv_utils import read_csv_safe

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PersonIdRecord:
    """Single person's ID mapping across protocols."""

    person_id: int
    participant_id: int
    participant_id5201: Optional[int] = None
    participant_id5211: Optional[int] = None


@dataclass(frozen=True)
class PersonIdRegistry:
    """Immutable cross-protocol ID registry.

    Resolves participant IDs from any protocol to a unified OMOP person_id.
    Lookup order without protocol hint: unified -> 5211 -> 5201.
    """

    _unified_to_person_id: dict[int, int] = field(repr=False)
    _id5201_to_person_id: dict[int, int] = field(repr=False)
    _id5211_to_person_id: dict[int, int] = field(repr=False)
    _records: tuple[PersonIdRecord, ...] = field(repr=False)

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    @classmethod
    def from_dataframe(cls, df: pd.DataFrame) -> PersonIdRegistry:
        """Build registry from a DataFrame with participant_id columns.

        Args:
            df: Must have columns: participant_id, participant_id5201,
                participant_id5211.

        Returns:
            Frozen PersonIdRegistry.

        Raises:
            ValueError: On duplicate person_ids or duplicate protocol IDs.
        """
        unified_map: dict[int, int] = {}
        id5201_map: dict[int, int] = {}
        id5211_map: dict[int, int] = {}
        records: list[PersonIdRecord] = []

        for _, row in df.iterrows():
            unified = _to_optional_int(row["participant_id"])
            if unified is None:
                msg = "participant_id must not be null"
                raise ValueError(msg)

            person_id = unified  # direct use as OMOP person_id

            # Check duplicate person_id
            if person_id in unified_map:
                msg = f"duplicate person_id: {person_id}"
                raise ValueError(msg)

            id5201 = _to_optional_int(row.get("participant_id5201"))
            id5211 = _to_optional_int(row.get("participant_id5211"))

            # Check duplicate protocol IDs
            if id5201 is not None and id5201 in id5201_map:
                msg = f"duplicate participant_id5201: {id5201}"
                raise ValueError(msg)
            if id5211 is not None and id5211 in id5211_map:
                msg = f"duplicate participant_id5211: {id5211}"
                raise ValueError(msg)

            unified_map[person_id] = person_id
            if id5201 is not None:
                id5201_map[id5201] = person_id
            if id5211 is not None:
                id5211_map[id5211] = person_id

            records.append(
                PersonIdRecord(
                    person_id=person_id,
                    participant_id=unified,
                    participant_id5201=id5201,
                    participant_id5211=id5211,
                )
            )

        logger.info(
            "Built ID registry: %d entries (%d with 5201, %d with 5211)",
            len(records),
            len(id5201_map),
            len(id5211_map),
        )

        return cls(
            _unified_to_person_id=unified_map,
            _id5201_to_person_id=id5201_map,
            _id5211_to_person_id=id5211_map,
            _records=tuple(records),
        )

    @classmethod
    def from_csv(cls, path: Path) -> PersonIdRegistry:
        """Load registry from a CSV file.

        Uses csv_utils.read_csv_safe for encoding safety.
        Supports both the source crosswalk CSV (with extra columns)
        and the exported person_id_map.csv (4 columns).
        """
        df = read_csv_safe(path)
        return cls.from_dataframe(df)

    # ------------------------------------------------------------------
    # Resolution
    # ------------------------------------------------------------------

    def resolve(self, protocol_id: int, protocol: Optional[str] = None) -> Optional[int]:
        """Resolve a participant ID to an OMOP person_id.

        Args:
            protocol_id: The ID to look up.
            protocol: Optional hint -- "5201" or "5211". If None, checks
                      unified -> 5211 -> 5201 in order.

        Returns:
            person_id or None if not found.
        """
        if protocol == "5201":
            return self._id5201_to_person_id.get(protocol_id)
        if protocol == "5211":
            return self._id5211_to_person_id.get(protocol_id)

        # No hint: check unified first, then 5211, then 5201
        result = self._unified_to_person_id.get(protocol_id)
        if result is not None:
            return result
        result = self._id5211_to_person_id.get(protocol_id)
        if result is not None:
            return result
        return self._id5201_to_person_id.get(protocol_id)

    def resolve_series(
        self, ids: pd.Series, protocol: Optional[str] = None
    ) -> pd.Series:
        """Vectorized resolve for DataFrame columns.

        Returns:
            Series of person_ids with pd.NA for unresolved.
        """
        return ids.map(lambda x: self.resolve(int(x), protocol=protocol)).astype(
            pd.Int64Dtype()
        )

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def to_dataframe(self) -> pd.DataFrame:
        """Export registry as a DataFrame.

        Columns: person_id, participant_id, participant_id5201, participant_id5211.
        """
        rows = [
            {
                "person_id": r.person_id,
                "participant_id": r.participant_id,
                "participant_id5201": r.participant_id5201,
                "participant_id5211": r.participant_id5211,
            }
            for r in self._records
        ]
        return pd.DataFrame(rows)

    def to_csv(self, path: Path) -> None:
        """Write registry to CSV file."""
        path.parent.mkdir(parents=True, exist_ok=True)
        self.to_dataframe().to_csv(path, index=False)
        logger.info("Wrote person_id_map.csv with %d entries to %s", len(self), path)

    # ------------------------------------------------------------------
    # Properties and dunder methods
    # ------------------------------------------------------------------

    @property
    def person_ids(self) -> frozenset[int]:
        """All person_ids in the registry."""
        return frozenset(self._unified_to_person_id.values())

    @property
    def count(self) -> int:
        """Number of entries in the registry."""
        return len(self._records)

    def __len__(self) -> int:
        return len(self._records)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_optional_int(value: object) -> Optional[int]:
    """Convert a value to int or None, handling pd.NA, NaN, empty strings."""
    if value is None or value is pd.NA:
        return None
    if isinstance(value, float):
        if pd.isna(value):
            return None
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return None
        return int(float(stripped))
    return int(value)
