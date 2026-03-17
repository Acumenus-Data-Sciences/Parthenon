"""Tests for DataProfileService — CDM coverage profiling and gap detection."""

from datetime import date
from unittest.mock import MagicMock

import pytest

from app.knowledge.data_profile import DataGapWarning, DataProfileService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_engine():
    engine = MagicMock()
    conn = MagicMock()
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock(return_value=False)
    engine.connect.return_value = conn
    return engine, conn


@pytest.fixture
def mock_redis():
    redis = MagicMock()
    redis.get.return_value = None
    return redis


def _make_svc(mock_engine, mock_redis, cdm_schema="cdm"):
    engine, _ = mock_engine
    return DataProfileService(engine=engine, redis_client=mock_redis, cdm_schema=cdm_schema)


def _scalar_row(value):
    """Return a mock result whose .scalar() returns value."""
    result = MagicMock()
    result.scalar.return_value = value
    result.fetchone.return_value = MagicMock(
        _mapping={"min_date": date(2015, 1, 1), "max_date": date(2022, 12, 31)}
    )
    return result


# ---------------------------------------------------------------------------
# Test 1: get_person_count
# ---------------------------------------------------------------------------


def test_get_person_count(mock_engine, mock_redis):
    engine, conn = mock_engine
    result = MagicMock()
    result.scalar.return_value = 1500
    conn.execute.return_value = result

    svc = _make_svc((engine, conn), mock_redis)
    count = svc.get_person_count()

    assert count == 1500


# ---------------------------------------------------------------------------
# Test 2: get_temporal_coverage
# ---------------------------------------------------------------------------


def test_get_temporal_coverage(mock_engine, mock_redis):
    engine, conn = mock_engine
    row = MagicMock()
    row._mapping = {"min_date": date(2010, 1, 1), "max_date": date(2023, 6, 30)}
    row.__getitem__ = lambda self, key: self._mapping[key]
    row.keys = lambda: list(row._mapping.keys())
    result = MagicMock()
    result.fetchone.return_value = row
    conn.execute.return_value = result

    svc = _make_svc((engine, conn), mock_redis)
    coverage = svc.get_temporal_coverage()

    assert coverage["min_date"] == date(2010, 1, 1)
    assert coverage["max_date"] == date(2023, 6, 30)


# ---------------------------------------------------------------------------
# Test 3: get_domain_density returns sorted list
# ---------------------------------------------------------------------------


def test_get_domain_density_returns_sorted_list(mock_engine, mock_redis):
    engine, conn = mock_engine

    # Simulate 7 domain table queries returning counts
    call_count = [0]
    domain_counts = [5000, 3000, 2000, 8000, 1000, 4000, 500]

    def execute_side_effect(*args, **kwargs):
        idx = call_count[0]
        call_count[0] += 1
        result = MagicMock()
        result.scalar.return_value = domain_counts[idx % len(domain_counts)]
        return result

    conn.execute.side_effect = execute_side_effect

    svc = _make_svc((engine, conn), mock_redis)
    density = svc.get_domain_density()

    assert isinstance(density, list)
    assert len(density) == 7
    # Must be sorted descending by record count
    counts = [d["record_count"] for d in density]
    assert counts == sorted(counts, reverse=True)
    # Each entry has domain and record_count keys
    for entry in density:
        assert "domain" in entry
        assert "record_count" in entry


# ---------------------------------------------------------------------------
# Test 4: detect_sparse_domains triggers warning
# ---------------------------------------------------------------------------


def test_detect_sparse_domains_triggers_warning(mock_engine, mock_redis):
    engine, conn = mock_engine

    svc = _make_svc((engine, conn), mock_redis)

    # Inject a domain density with a sparse domain (<1 record per patient)
    domain_density = [
        {"domain": "condition_occurrence", "record_count": 100},
        {"domain": "drug_exposure", "record_count": 50},  # sparse if 200 patients
    ]

    warnings = svc.detect_data_gaps(
        person_count=200,
        domain_density=domain_density,
        temporal_coverage={"min_date": date(2010, 1, 1), "max_date": date(2023, 1, 1)},
    )

    sparse_warnings = [w for w in warnings if w.gap_type == "sparse_domain"]
    assert len(sparse_warnings) >= 1
    assert any(w.domain == "drug_exposure" for w in sparse_warnings)
    assert all(w.severity in ("warning", "critical") for w in sparse_warnings)


# ---------------------------------------------------------------------------
# Test 5: detect_temporal_gaps — narrow range triggers warning
# ---------------------------------------------------------------------------


def test_detect_temporal_gaps_triggers_warning(mock_engine, mock_redis):
    engine, conn = mock_engine

    svc = _make_svc((engine, conn), mock_redis)

    # Temporal coverage < 3 years should trigger a warning
    warnings = svc.detect_data_gaps(
        person_count=500,
        domain_density=[{"domain": "condition_occurrence", "record_count": 5000}],
        temporal_coverage={"min_date": date(2022, 1, 1), "max_date": date(2023, 6, 1)},
    )

    temporal_warnings = [w for w in warnings if w.gap_type == "temporal_gap"]
    assert len(temporal_warnings) >= 1
    assert all(w.severity in ("warning", "critical") for w in temporal_warnings)


# ---------------------------------------------------------------------------
# Test 6: format_warnings produces readable text with domain and severity
# ---------------------------------------------------------------------------


def test_format_warnings_produces_readable_text(mock_engine, mock_redis):
    engine, conn = mock_engine
    svc = _make_svc((engine, conn), mock_redis)

    warnings = [
        DataGapWarning(
            gap_type="sparse_domain",
            domain="drug_exposure",
            severity="warning",
            message="drug_exposure has fewer than 1 record per patient",
        ),
        DataGapWarning(
            gap_type="temporal_gap",
            domain="observation_period",
            severity="critical",
            message="Temporal coverage is less than 3 years",
        ),
    ]

    text = svc.format_warnings(warnings)

    assert "DATA QUALITY WARNINGS" in text
    assert "drug_exposure" in text
    assert "observation_period" in text
    # Severity icons or labels present
    assert "warning" in text.lower() or "critical" in text.lower()


# ---------------------------------------------------------------------------
# Test 7: get_profile_summary returns complete dict
# ---------------------------------------------------------------------------


def test_get_profile_summary_returns_complete_dict(mock_engine, mock_redis):
    engine, conn = mock_engine

    call_count = [0]

    def execute_side_effect(*args, **kwargs):
        idx = call_count[0]
        call_count[0] += 1
        result = MagicMock()
        # First call: person count
        if idx == 0:
            result.scalar.return_value = 1000
        # Temporal coverage call
        elif idx == 1:
            row = MagicMock()
            row._mapping = {"min_date": date(2015, 1, 1), "max_date": date(2022, 12, 31)}
            row.__getitem__ = lambda self, key: self._mapping[key]
            row.keys = lambda: list(row._mapping.keys())
            result.fetchone.return_value = row
        # Domain density calls (7 domains)
        else:
            result.scalar.return_value = 2000
        return result

    conn.execute.side_effect = execute_side_effect

    svc = _make_svc((engine, conn), mock_redis)
    summary = svc.get_profile_summary()

    assert isinstance(summary, dict)
    assert "person_count" in summary
    assert "temporal_coverage" in summary
    assert "domain_density" in summary
    assert "warnings" in summary
    assert "formatted_warnings" in summary
