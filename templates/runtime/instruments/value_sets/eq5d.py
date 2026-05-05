"""EQ-5D value-set lookup helper.

The shape of an EQ-5D value set is a CSV with two columns:
  profile (string) — 5-character digit string, e.g. "11111", "22222"
  utility_index (float) — country-specific utility weight

Parthenon ships dimensional PLACEHOLDER data only (see eq5d5l_placeholder.csv).
Customers replace it with their EuroQol-licensed value set at runtime by
passing a path via the manifest parameter ``eq5d_value_set_path``.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

PROFILE_PATTERN = re.compile(r"^[1-5]{5}$")


class Eq5dValueSetError(ValueError):
    """Raised when value-set load or lookup fails."""


def load_value_set(path: Path) -> dict[str, float]:
    """Load an EQ-5D value set from a CSV file.

    Lines beginning with '#' are ignored. The CSV must have a header row
    with at least 'profile' and 'utility_index' columns.
    """
    if not path.exists():
        raise Eq5dValueSetError(f"value set not found: {path}")

    table: dict[str, float] = {}
    with path.open("r", encoding="utf-8") as f:
        non_comment_lines = [line for line in f if not line.lstrip().startswith("#")]
    if not non_comment_lines:
        raise Eq5dValueSetError(f"value set has no data rows: {path}")
    reader = csv.DictReader(non_comment_lines)
    if (
        reader.fieldnames is None
        or "profile" not in reader.fieldnames
        or "utility_index" not in reader.fieldnames
    ):
        raise Eq5dValueSetError(
            f"value set must have 'profile' and 'utility_index' columns; "
            f"got {reader.fieldnames}"
        )
    for row in reader:
        profile = (row.get("profile") or "").strip()
        if not profile:
            continue
        try:
            table[profile] = float(row["utility_index"])
        except (TypeError, ValueError) as exc:
            raise Eq5dValueSetError(
                f"non-numeric utility_index for profile {profile!r}: "
                f"{row.get('utility_index')!r}"
            ) from exc
    if not table:
        raise Eq5dValueSetError(f"value set has no usable rows: {path}")
    return table


def lookup_utility(profile: str, table: dict[str, float]) -> float:
    """Return the utility index for a 5-character EQ-5D profile string.

    Raises Eq5dValueSetError if the profile is malformed or absent from the table.
    """
    if not PROFILE_PATTERN.match(profile):
        raise Eq5dValueSetError(
            f"profile must be a 5-character digit string with each digit 1-5; " f"got {profile!r}"
        )
    if profile not in table:
        raise Eq5dValueSetError(
            f"profile {profile!r} not in value set; replace placeholder with " f"full EuroQol set"
        )
    return table[profile]
