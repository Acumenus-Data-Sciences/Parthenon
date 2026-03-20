from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema


def check_mapping_coverage(session: Session) -> dict:
    """Check mapping coverage across all CDM domain tables.
    Returns dict with per-domain and overall coverage percentages."""
    domains = {
        "condition_occurrence": ("condition_concept_id", "condition_occurrence_id"),
        "drug_exposure": ("drug_concept_id", "drug_exposure_id"),
        "measurement": ("measurement_concept_id", "measurement_id"),
        "procedure_occurrence": ("procedure_concept_id", "procedure_occurrence_id"),
    }

    results = {}
    total_mapped = 0
    total_rows = 0

    for table, (concept_col, id_col) in domains.items():
        row = session.execute(
            text(f"""
                SELECT
                    count(*) as total,
                    count(*) FILTER (WHERE {concept_col} != 0) as mapped
                FROM {CDM}.{table}
            """)
        ).mappings().first()

        total = row["total"]
        mapped = row["mapped"]
        pct = (mapped / total * 100) if total > 0 else 0.0

        results[table] = {"total": total, "mapped": mapped, "coverage_pct": round(pct, 2)}
        total_mapped += mapped
        total_rows += total

    overall_pct = (total_mapped / total_rows * 100) if total_rows > 0 else 0.0
    results["overall"] = {"total": total_rows, "mapped": total_mapped, "coverage_pct": round(overall_pct, 2)}

    return results
