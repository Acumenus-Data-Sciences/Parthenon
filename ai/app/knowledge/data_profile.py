"""
DataProfileService — CDM coverage profiling and gap detection.

Analyses the CDM schema for data completeness, domain density,
temporal coverage, and produces human-readable gap warnings.
"""

import logging
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

ALLOWED_SCHEMAS = {"vocab", "cdm", "omop", "eunomia", "public", "achilles_results"}

# Ordered list of CDM domain tables to profile
_DOMAIN_TABLES = [
    "condition_occurrence",
    "drug_exposure",
    "procedure_occurrence",
    "measurement",
    "observation",
    "visit_occurrence",
    "device_exposure",
]

# Thresholds
_SPARSE_RECORDS_PER_PATIENT = 1.0   # fewer than this triggers a warning
_MIN_YEARS_COVERAGE = 3             # fewer years triggers a temporal warning


@dataclass
class DataGapWarning:
    """A detected data quality gap."""

    gap_type: str      # "empty_cdm" | "sparse_domain" | "temporal_gap"
    domain: str
    severity: str      # "warning" | "critical"
    message: str


class DataProfileService:
    """Profile CDM coverage and detect data gaps."""

    def __init__(
        self,
        engine: Engine,
        redis_client: Any,
        cdm_schema: str = "cdm",
    ) -> None:
        schema = cdm_schema
        if schema not in ALLOWED_SCHEMAS:
            raise ValueError(f"Invalid schema name: {schema!r}. Allowed: {ALLOWED_SCHEMAS}")
        self.engine = engine
        self.redis_client = redis_client
        self.cdm_schema = schema

    # ------------------------------------------------------------------
    # Core metrics
    # ------------------------------------------------------------------

    def get_person_count(self) -> int:
        """Return the total number of patients in the CDM."""
        sql = text(f"SELECT COUNT(*) FROM {self.cdm_schema}.person")
        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql)
                return int(result.scalar() or 0)
        except Exception:
            logger.exception("get_person_count failed")
            return 0

    def get_temporal_coverage(self) -> dict[str, Any]:
        """Return the earliest and latest observation dates."""
        sql = text(
            f"SELECT MIN(observation_period_start_date) AS min_date,"
            f"       MAX(observation_period_end_date)   AS max_date"
            f" FROM {self.cdm_schema}.observation_period"
        )
        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql)
                row = result.fetchone()
                if row is None:
                    return {"min_date": None, "max_date": None}
                row_mapping = row._mapping
                return {
                    "min_date": row_mapping["min_date"],
                    "max_date": row_mapping["max_date"],
                }
        except Exception:
            logger.exception("get_temporal_coverage failed")
            return {"min_date": None, "max_date": None}

    def get_domain_density(self) -> list[dict[str, Any]]:
        """Return record counts per domain table, sorted descending."""
        results: list[dict[str, Any]] = []
        for table in _DOMAIN_TABLES:
            sql = text(f"SELECT COUNT(*) FROM {self.cdm_schema}.{table}")
            try:
                with self.engine.connect() as conn:
                    count = int(conn.execute(sql).scalar() or 0)
                    results.append({"domain": table, "record_count": count})
            except Exception:
                logger.exception("get_domain_density failed for table %s", table)
                results.append({"domain": table, "record_count": 0})

        return sorted(results, key=lambda x: x["record_count"], reverse=True)

    # ------------------------------------------------------------------
    # Gap detection
    # ------------------------------------------------------------------

    def detect_data_gaps(
        self,
        person_count: int,
        domain_density: list[dict[str, Any]],
        temporal_coverage: dict[str, Any],
    ) -> list[DataGapWarning]:
        """Analyse provided metrics and return a list of DataGapWarnings."""
        warnings: list[DataGapWarning] = []

        # Critical: no patients at all
        if person_count == 0:
            warnings.append(
                DataGapWarning(
                    gap_type="empty_cdm",
                    domain="person",
                    severity="critical",
                    message="CDM person table is empty — no patients loaded",
                )
            )
            return warnings

        # Sparse domain check
        for entry in domain_density:
            domain = entry["domain"]
            count = entry["record_count"]
            records_per_patient = count / person_count
            if records_per_patient < _SPARSE_RECORDS_PER_PATIENT:
                warnings.append(
                    DataGapWarning(
                        gap_type="sparse_domain",
                        domain=domain,
                        severity="warning",
                        message=(
                            f"{domain} has fewer than {_SPARSE_RECORDS_PER_PATIENT:.0f}"
                            f" record per patient"
                            f" ({records_per_patient:.2f} avg)"
                        ),
                    )
                )

        # Temporal coverage check
        min_date: date | None = temporal_coverage.get("min_date")
        max_date: date | None = temporal_coverage.get("max_date")
        if min_date is not None and max_date is not None:
            years = (max_date - min_date).days / 365.25
            if years < _MIN_YEARS_COVERAGE:
                warnings.append(
                    DataGapWarning(
                        gap_type="temporal_gap",
                        domain="observation_period",
                        severity="warning",
                        message=(
                            f"Temporal coverage is less than {_MIN_YEARS_COVERAGE} years"
                            f" ({years:.1f} years from {min_date} to {max_date})"
                        ),
                    )
                )

        return warnings

    # ------------------------------------------------------------------
    # Formatting
    # ------------------------------------------------------------------

    _SEVERITY_ICONS = {
        "critical": "CRITICAL",
        "warning": "WARNING",
    }

    def format_warnings(self, warnings: list[DataGapWarning]) -> str:
        """Produce a human-readable summary of data quality warnings."""
        if not warnings:
            return "No data quality warnings detected."

        lines = ["DATA QUALITY WARNINGS:"]
        for w in warnings:
            icon = self._SEVERITY_ICONS.get(w.severity, w.severity.upper())
            lines.append(f"  [{icon}] Domain: {w.domain} — {w.message}")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Profile summary
    # ------------------------------------------------------------------

    def get_profile_summary(self) -> dict[str, Any]:
        """Return a complete CDM profile dictionary."""
        person_count = self.get_person_count()
        temporal_coverage = self.get_temporal_coverage()
        domain_density = self.get_domain_density()
        warnings = self.detect_data_gaps(
            person_count=person_count,
            domain_density=domain_density,
            temporal_coverage=temporal_coverage,
        )
        formatted = self.format_warnings(warnings)

        return {
            "person_count": person_count,
            "temporal_coverage": temporal_coverage,
            "domain_density": domain_density,
            "warnings": [
                {
                    "gap_type": w.gap_type,
                    "domain": w.domain,
                    "severity": w.severity,
                    "message": w.message,
                }
                for w in warnings
            ],
            "formatted_warnings": formatted,
        }
