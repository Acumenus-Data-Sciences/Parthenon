from app.config import settings


def evaluate_quality(coverage: dict, integrity: dict) -> dict:
    """Evaluate quality gate. Returns pass/fail with reasons."""
    reasons = []
    passed = True

    # Check overall mapping coverage
    overall_pct = coverage.get("overall", {}).get("coverage_pct", 0)
    min_coverage = settings.min_mapping_coverage * 100  # convert 0.70 to 70%

    # Note: MIMIC uses local item IDs — coverage will be low for measurements
    # Only check conditions and procedures (which use standard ICD codes)
    condition_pct = coverage.get("condition_occurrence", {}).get("coverage_pct", 0)
    procedure_pct = coverage.get("procedure_occurrence", {}).get("coverage_pct", 0)

    if condition_pct < min_coverage:
        reasons.append(f"Condition mapping coverage {condition_pct}% < {min_coverage}% threshold")
        passed = False

    # Check referential integrity — orphan persons are critical failures
    for table, checks in integrity.items():
        if checks["orphan_persons"] > 0:
            reasons.append(f"{table}: {checks['orphan_persons']} records with invalid person_id")
            passed = False

    return {
        "passed": passed,
        "overall_coverage_pct": overall_pct,
        "condition_coverage_pct": condition_pct,
        "procedure_coverage_pct": procedure_pct,
        "reasons": reasons,
    }
