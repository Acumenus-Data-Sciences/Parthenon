from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.adapters.mimic_adapter import MimicAdapter
from app.mapper.person_mapper import map_persons
from app.mapper.visit_mapper import map_visits
from app.mapper.condition_mapper import map_conditions
from app.mapper.drug_mapper import map_drugs
from app.mapper.measurement_mapper import map_measurements
from app.mapper.procedure_mapper import map_procedures
from app.mapper.domain_router import log_concept_gaps
from app.mapper.era_builder import build_observation_periods, build_condition_eras, build_drug_eras
from app.quality.coverage_checker import check_mapping_coverage
from app.quality.integrity_checker import check_referential_integrity
from app.quality.gate import evaluate_quality

EXT = settings.ext_schema


def run_mimic_batch(session: Session) -> dict:
    """Run the full MIMIC-IV → OMOP CDM pipeline. Returns batch summary."""
    summary = {"stage": {}, "map": {}, "derive": {}, "quality": {}}

    # 1. STAGE
    adapter = MimicAdapter(session)
    batch_id = adapter.stage_all()
    session.execute(
        text(f"UPDATE {EXT}.load_batch SET status = 'mapping' WHERE batch_id = :bid"),
        {"bid": batch_id},
    )
    session.flush()

    # Count staged rows
    for table in ["stg_patient", "stg_encounter", "stg_condition", "stg_drug",
                  "stg_measurement", "stg_procedure"]:
        result = session.execute(
            text(f"SELECT count(*) FROM inpatient_staging.{table} WHERE load_batch_id = :bid"),
            {"bid": batch_id},
        )
        summary["stage"][table] = result.scalar()

    # 2. MAP
    summary["map"]["person"] = map_persons(session, batch_id)
    summary["map"]["visit_occurrence"] = map_visits(session, batch_id)
    summary["map"]["condition_occurrence"] = map_conditions(session, batch_id)
    summary["map"]["drug_exposure"] = map_drugs(session, batch_id)
    summary["map"]["measurement"] = map_measurements(session, batch_id)
    summary["map"]["procedure_occurrence"] = map_procedures(session, batch_id)

    # 3. DERIVE (eras + observation periods)
    summary["derive"]["observation_period"] = build_observation_periods(session)
    summary["derive"]["condition_era"] = build_condition_eras(session)
    summary["derive"]["drug_era"] = build_drug_eras(session)

    # 4. EXTEND (concept gaps)
    summary["derive"]["concept_gaps"] = log_concept_gaps(session, batch_id)

    # 5. VALIDATE
    session.execute(
        text(f"UPDATE {EXT}.load_batch SET status = 'validating' WHERE batch_id = :bid"),
        {"bid": batch_id},
    )
    session.flush()

    coverage = check_mapping_coverage(session)
    integrity = check_referential_integrity(session)
    gate_result = evaluate_quality(coverage, integrity)

    summary["quality"] = {
        "coverage": coverage,
        "integrity": integrity,
        "gate": gate_result,
    }

    # 6. Update batch status
    final_status = "complete" if gate_result["passed"] else "rejected"
    total_mapped = sum(v for k, v in summary["map"].items())
    session.execute(
        text(f"""
            UPDATE {EXT}.load_batch
            SET status = :status,
                end_dt = NOW(),
                rows_staged = :staged,
                rows_mapped = :mapped,
                mapping_coverage_pct = :coverage,
                dqd_pass = :passed,
                stats = CAST(:stats AS jsonb)
            WHERE batch_id = :bid
        """),
        {
            "bid": batch_id,
            "status": final_status,
            "staged": sum(v for v in summary["stage"].values()),
            "mapped": total_mapped,
            "coverage": gate_result["overall_coverage_pct"],
            "passed": gate_result["passed"],
            "stats": __import__("json").dumps(summary),
        },
    )
    session.flush()

    summary["batch_id"] = batch_id
    summary["status"] = final_status
    return summary
