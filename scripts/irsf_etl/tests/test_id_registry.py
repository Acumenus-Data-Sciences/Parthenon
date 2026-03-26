"""Tests for PersonIdRegistry -- cross-protocol ID reconciliation."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from scripts.irsf_etl.lib.id_registry import PersonIdRegistry


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def sample_person_df() -> pd.DataFrame:
    """DataFrame with 10 rows covering all three enrollment patterns.

    Patterns:
      - 3 rows: 5211-only (participant_id5201 is NA)
      - 3 rows: 5201-only (participant_id5211 is NA)
      - 4 rows: dual-enrolled (both filled, including cases where IDs differ)
    """
    return pd.DataFrame(
        {
            "participant_id": [1001, 1002, 1003, 2001, 2002, 2003, 3001, 3002, 3003, 3004],
            "participant_id5201": [
                pd.NA, pd.NA, pd.NA,        # 5211-only
                2001, 2002, 2003,            # 5201-only
                4001, 3002, 4003, 3004,      # dual: some IDs differ from unified
            ],
            "participant_id5211": [
                1001, 1002, 1003,            # 5211-only
                pd.NA, pd.NA, pd.NA,         # 5201-only
                3001, 3002, 3003, 3004,      # dual
            ],
        }
    )


@pytest.fixture()
def registry(sample_person_df: pd.DataFrame) -> PersonIdRegistry:
    """Build a registry from the sample DataFrame."""
    return PersonIdRegistry.from_dataframe(sample_person_df)


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------


class TestConstruction:
    def test_from_dataframe_builds_registry(self, registry: PersonIdRegistry) -> None:
        assert len(registry) == 10

    def test_count_property(self, registry: PersonIdRegistry) -> None:
        assert registry.count == 10

    def test_person_ids_frozenset(self, registry: PersonIdRegistry) -> None:
        ids = registry.person_ids
        assert isinstance(ids, frozenset)
        assert len(ids) == 10
        assert 1001 in ids
        assert 3001 in ids

    def test_person_id_equals_unified_participant_id(
        self, sample_person_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        """person_id = int(participant_id) -- direct use, no hashing."""
        for pid in sample_person_df["participant_id"]:
            assert registry.resolve(int(pid)) == int(pid)


# ---------------------------------------------------------------------------
# Resolve -- 5211-only patients
# ---------------------------------------------------------------------------


class TestResolve5211Only:
    def test_resolve_unified_id(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(1001) == 1001

    def test_resolve_with_5211_hint(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(1001, protocol="5211") == 1001

    def test_resolve_with_wrong_protocol_returns_none(self, registry: PersonIdRegistry) -> None:
        # 1001 is only in 5211, not in 5201
        assert registry.resolve(1001, protocol="5201") is None


# ---------------------------------------------------------------------------
# Resolve -- 5201-only patients
# ---------------------------------------------------------------------------


class TestResolve5201Only:
    def test_resolve_unified_id(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(2001) == 2001

    def test_resolve_with_5201_hint(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(2001, protocol="5201") == 2001

    def test_resolve_with_wrong_protocol_returns_none(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(2001, protocol="5211") is None


# ---------------------------------------------------------------------------
# Resolve -- dual-enrolled patients
# ---------------------------------------------------------------------------


class TestResolveDualEnrolled:
    def test_resolve_unified_id(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(3001) == 3001

    def test_resolve_5211_id(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(3001, protocol="5211") == 3001

    def test_resolve_5201_id_different_from_unified(self, registry: PersonIdRegistry) -> None:
        """Dual-enrolled: 5201 ID 4001 maps to person_id 3001."""
        assert registry.resolve(4001, protocol="5201") == 3001

    def test_resolve_dual_same_ids(self, registry: PersonIdRegistry) -> None:
        """Dual-enrolled where 5201==5211==unified (3002)."""
        assert registry.resolve(3002) == 3002
        assert registry.resolve(3002, protocol="5201") == 3002
        assert registry.resolve(3002, protocol="5211") == 3002

    def test_resolve_without_hint_checks_all(self, registry: PersonIdRegistry) -> None:
        """Without protocol hint, a 5201-only ID that differs from unified resolves via fallback."""
        # 4001 is the 5201 ID for person 3001; unified lookup won't find it,
        # but fallback to 5211 and then 5201 dicts should
        assert registry.resolve(4001) == 3001


# ---------------------------------------------------------------------------
# Resolve -- unknown IDs
# ---------------------------------------------------------------------------


class TestResolveUnknown:
    def test_unknown_id_returns_none(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(999999) is None

    def test_unknown_with_protocol_returns_none(self, registry: PersonIdRegistry) -> None:
        assert registry.resolve(999999, protocol="5201") is None
        assert registry.resolve(999999, protocol="5211") is None


# ---------------------------------------------------------------------------
# Duplicate rejection
# ---------------------------------------------------------------------------


class TestDuplicateRejection:
    def test_rejects_duplicate_person_ids(self) -> None:
        df = pd.DataFrame(
            {
                "participant_id": [1001, 1001],
                "participant_id5201": [pd.NA, pd.NA],
                "participant_id5211": [1001, 1001],
            }
        )
        with pytest.raises(ValueError, match="duplicate.*person_id"):
            PersonIdRegistry.from_dataframe(df)

    def test_rejects_duplicate_protocol_ids(self) -> None:
        df = pd.DataFrame(
            {
                "participant_id": [1001, 1002],
                "participant_id5201": [pd.NA, pd.NA],
                "participant_id5211": [5001, 5001],  # same 5211 ID for two people
            }
        )
        with pytest.raises(ValueError, match="duplicate"):
            PersonIdRegistry.from_dataframe(df)


# ---------------------------------------------------------------------------
# Export / import
# ---------------------------------------------------------------------------


class TestExportImport:
    def test_to_dataframe_columns(self, registry: PersonIdRegistry) -> None:
        df = registry.to_dataframe()
        expected_cols = {"person_id", "participant_id", "participant_id5201", "participant_id5211"}
        assert set(df.columns) == expected_cols

    def test_to_dataframe_row_count(self, registry: PersonIdRegistry) -> None:
        df = registry.to_dataframe()
        assert len(df) == 10

    def test_to_csv_roundtrip(self, registry: PersonIdRegistry, tmp_path: Path) -> None:
        csv_path = tmp_path / "person_id_map.csv"
        registry.to_csv(csv_path)
        assert csv_path.exists()

        loaded = PersonIdRegistry.from_csv(csv_path)
        assert len(loaded) == len(registry)
        assert loaded.person_ids == registry.person_ids

    def test_from_csv_loads_file(self, registry: PersonIdRegistry, tmp_path: Path) -> None:
        csv_path = tmp_path / "test_ids.csv"
        registry.to_csv(csv_path)

        loaded = PersonIdRegistry.from_csv(csv_path)
        # Spot-check a resolve
        assert loaded.resolve(1001) == 1001
        assert loaded.resolve(4001, protocol="5201") == 3001


# ---------------------------------------------------------------------------
# resolve_series
# ---------------------------------------------------------------------------


class TestResolveSeries:
    def test_resolve_series_maps_ids(self, registry: PersonIdRegistry) -> None:
        ids = pd.Series([1001, 2001, 3001])
        result = registry.resolve_series(ids)
        assert list(result) == [1001, 2001, 3001]

    def test_resolve_series_returns_na_for_unknown(self, registry: PersonIdRegistry) -> None:
        ids = pd.Series([1001, 999999, 3001])
        result = registry.resolve_series(ids)
        assert result.iloc[0] == 1001
        assert pd.isna(result.iloc[1])
        assert result.iloc[2] == 3001

    def test_resolve_series_with_protocol(self, registry: PersonIdRegistry) -> None:
        ids = pd.Series([4001, 3002])
        result = registry.resolve_series(ids, protocol="5201")
        assert result.iloc[0] == 3001
        assert result.iloc[1] == 3002
