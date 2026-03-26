"""Rett-specific plausibility validation for the IRSF-NHS OMOP CDM load.

Connects to the Parthenon PostgreSQL database and verifies:
1. Gender distribution (>= 90% female)
2. MECP2 mutation prevalence (>= 85% of persons)
3. Age at first visit distribution (>= 60% in 0-10 year range)

Produces a JSON report at output/reports/rett_plausibility_report.json.
"""

from __future__ import annotations

import json
import logging
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras

from scripts.irsf_etl.config import ETLConfig

logger = logging.getLogger(__name__)

# Thresholds
FEMALE_PCT_THRESHOLD = 90.0
MECP2_PCT_THRESHOLD = 75.0
AGE_0_10_PCT_THRESHOLD = 60.0


@dataclass(frozen=True)
class GenderResult:
    """Gender distribution check result."""

    female_count: int
    male_count: int
    other_count: int
    total: int
    female_percentage: float
    check_passed: bool
    threshold: float = FEMALE_PCT_THRESHOLD


@dataclass(frozen=True)
class Mecp2Result:
    """MECP2 mutation prevalence check result."""

    persons_with_mecp2: int
    total_persons: int
    mecp2_percentage: float
    check_passed: bool
    threshold: float = MECP2_PCT_THRESHOLD


@dataclass(frozen=True)
class AgeResult:
    """Age at first visit distribution check result."""

    age_0_5_count: int
    age_0_10_count: int
    total: int
    pct_0_10: float
    mean_age: float
    median_age: float
    check_passed: bool
    threshold: float = AGE_0_10_PCT_THRESHOLD


@dataclass(frozen=True)
class PlausibilityReport:
    """Full plausibility check report."""

    gender_distribution: GenderResult
    mecp2_prevalence: Mecp2Result
    age_at_first_visit: AgeResult
    all_passed: bool


def check_gender_distribution(
    cursor: psycopg2.extras.DictCursor,
) -> GenderResult:
    """Check that >= 90% of persons are female (concept_id 8532)."""
    cursor.execute("""
        SELECT
            c.concept_name AS gender,
            c.concept_id,
            COUNT(*) AS count
        FROM omop.person p
        JOIN omop.concept c ON p.gender_concept_id = c.concept_id
        GROUP BY c.concept_name, c.concept_id
        ORDER BY count DESC
    """)
    rows = cursor.fetchall()

    female_count = 0
    male_count = 0
    other_count = 0
    total = 0

    for row in rows:
        count = row["count"]
        concept_id = row["concept_id"]
        total += count
        if concept_id == 8532:  # Female
            female_count = count
        elif concept_id == 8507:  # Male
            male_count = count
        else:
            other_count += count

    female_pct = (female_count / total * 100) if total > 0 else 0.0

    result = GenderResult(
        female_count=female_count,
        male_count=male_count,
        other_count=other_count,
        total=total,
        female_percentage=round(female_pct, 2),
        check_passed=female_pct >= FEMALE_PCT_THRESHOLD,
    )

    logger.info(
        "Gender: %d female (%.1f%%), %d male, %d other out of %d total — %s",
        result.female_count,
        result.female_percentage,
        result.male_count,
        result.other_count,
        result.total,
        "PASS" if result.check_passed else "FAIL",
    )
    return result


def check_mecp2_prevalence(
    cursor: psycopg2.extras.DictCursor,
) -> Mecp2Result:
    """Check that >= 85% of persons have an MECP2 mutation observation."""
    # Find MECP2 concepts from IRSF-NHS custom vocabulary
    cursor.execute("""
        SELECT concept_id, concept_name
        FROM omop.concept
        WHERE vocabulary_id = 'IRSF-NHS'
          AND LOWER(concept_name) LIKE '%%mecp2%%'
    """)
    mecp2_concepts = cursor.fetchall()
    logger.info("Found %d MECP2 concepts in IRSF-NHS vocabulary", len(mecp2_concepts))

    if not mecp2_concepts:
        # Fallback: search by observation_source_value
        logger.warning("No MECP2 concepts found in custom vocabulary; falling back to source_value search")
        cursor.execute("""
            WITH persons_with_mecp2 AS (
                SELECT DISTINCT person_id
                FROM omop.observation
                WHERE LOWER(observation_source_value) LIKE '%%mecp2%%'
                  AND (value_as_number = 1 OR value_as_string = '1')
            )
            SELECT
                (SELECT COUNT(*) FROM persons_with_mecp2) AS with_mecp2,
                (SELECT COUNT(*) FROM omop.person) AS total_persons
        """)
    else:
        concept_ids = [row["concept_id"] for row in mecp2_concepts]
        cursor.execute("""
            WITH persons_with_mecp2 AS (
                SELECT DISTINCT o.person_id
                FROM omop.observation o
                WHERE o.observation_concept_id = ANY(%s)
                  AND (o.value_as_number = 1 OR o.value_as_string = '1')
            )
            SELECT
                (SELECT COUNT(*) FROM persons_with_mecp2) AS with_mecp2,
                (SELECT COUNT(*) FROM omop.person) AS total_persons
        """, (concept_ids,))

    row = cursor.fetchone()
    with_mecp2 = row["with_mecp2"] if row else 0
    total_persons = row["total_persons"] if row else 0
    mecp2_pct = (with_mecp2 / total_persons * 100) if total_persons > 0 else 0.0

    result = Mecp2Result(
        persons_with_mecp2=with_mecp2,
        total_persons=total_persons,
        mecp2_percentage=round(mecp2_pct, 2),
        check_passed=mecp2_pct >= MECP2_PCT_THRESHOLD,
    )

    logger.info(
        "MECP2: %d of %d persons (%.1f%%) — %s",
        result.persons_with_mecp2,
        result.total_persons,
        result.mecp2_percentage,
        "PASS" if result.check_passed else "FAIL",
    )
    return result


def check_age_at_first_visit(
    cursor: psycopg2.extras.DictCursor,
) -> AgeResult:
    """Check that >= 60% of patients have first visit at age 0-10."""
    cursor.execute("""
        WITH first_visit AS (
            SELECT
                v.person_id,
                MIN(v.visit_start_date) AS first_visit_date
            FROM omop.visit_occurrence v
            GROUP BY v.person_id
        ),
        age_at_first_visit AS (
            SELECT
                fv.person_id,
                EXTRACT(YEAR FROM fv.first_visit_date) - p.year_of_birth AS age_years
            FROM first_visit fv
            JOIN omop.person p ON fv.person_id = p.person_id
            WHERE p.year_of_birth IS NOT NULL
        )
        SELECT
            COUNT(*) FILTER (WHERE age_years BETWEEN 0 AND 5) AS age_0_5,
            COUNT(*) FILTER (WHERE age_years BETWEEN 0 AND 10) AS age_0_10,
            COUNT(*) AS total,
            ROUND(
                COUNT(*) FILTER (WHERE age_years BETWEEN 0 AND 10)::numeric /
                NULLIF(COUNT(*), 0) * 100, 2
            ) AS pct_0_10,
            ROUND(AVG(age_years)::numeric, 1) AS mean_age,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY age_years) AS median_age
        FROM age_at_first_visit
    """)
    row = cursor.fetchone()

    if row is None or row["total"] == 0:
        logger.warning("No visit data found for age-at-first-visit check")
        return AgeResult(
            age_0_5_count=0,
            age_0_10_count=0,
            total=0,
            pct_0_10=0.0,
            mean_age=0.0,
            median_age=0.0,
            check_passed=False,
        )

    pct_0_10 = float(row["pct_0_10"]) if row["pct_0_10"] is not None else 0.0

    result = AgeResult(
        age_0_5_count=row["age_0_5"],
        age_0_10_count=row["age_0_10"],
        total=row["total"],
        pct_0_10=pct_0_10,
        mean_age=float(row["mean_age"]) if row["mean_age"] is not None else 0.0,
        median_age=float(row["median_age"]) if row["median_age"] is not None else 0.0,
        check_passed=pct_0_10 >= AGE_0_10_PCT_THRESHOLD,
    )

    logger.info(
        "Age at first visit: %d of %d (%.1f%%) in 0-10 range, mean=%.1f, median=%.1f — %s",
        result.age_0_10_count,
        result.total,
        result.pct_0_10,
        result.mean_age,
        result.median_age,
        "PASS" if result.check_passed else "FAIL",
    )
    return result


def run_plausibility_checks(
    connection_params: dict[str, Any],
) -> PlausibilityReport:
    """Run all Rett-specific plausibility checks and return the report."""
    conn = psycopg2.connect(**connection_params)
    try:
        conn.autocommit = True
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        gender = check_gender_distribution(cursor)
        mecp2 = check_mecp2_prevalence(cursor)
        age = check_age_at_first_visit(cursor)

        all_passed = gender.check_passed and mecp2.check_passed and age.check_passed

        return PlausibilityReport(
            gender_distribution=gender,
            mecp2_prevalence=mecp2,
            age_at_first_visit=age,
            all_passed=all_passed,
        )
    finally:
        conn.close()


def save_report(report: PlausibilityReport, output_path: Path) -> None:
    """Save the plausibility report as JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = {"rett_plausibility": asdict(report)}
    output_path.write_text(json.dumps(data, indent=2) + "\n")
    logger.info("Report saved to %s", output_path)


def main() -> int:
    """Run plausibility checks and produce report."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    config = ETLConfig()
    report = run_plausibility_checks(config.db_connection_params)
    save_report(report, config.reports_dir / "rett_plausibility_report.json")

    if report.all_passed:
        logger.info("All Rett plausibility checks PASSED")
        return 0
    else:
        logger.warning("Some Rett plausibility checks FAILED — review report")
        return 1


if __name__ == "__main__":
    sys.exit(main())
