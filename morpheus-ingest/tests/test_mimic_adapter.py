from sqlalchemy import text

from app.adapters.mimic_adapter import MimicAdapter


def test_mimic_adapter_stages_patients(db_session):
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    result = db_session.execute(
        text("SELECT count(*) FROM inpatient_staging.stg_patient WHERE load_batch_id = :bid"),
        {"bid": batch_id},
    )
    count = result.scalar()
    assert count == 100, f"Expected 100 patients, got {count}"


def test_mimic_adapter_stages_encounters(db_session):
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    result = db_session.execute(
        text("SELECT count(*) FROM inpatient_staging.stg_encounter WHERE load_batch_id = :bid"),
        {"bid": batch_id},
    )
    count = result.scalar()
    assert count > 0, "Expected encounters to be staged"


def test_mimic_adapter_stage_all_uses_single_batch(db_session):
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    for table in ["stg_patient", "stg_encounter", "stg_condition", "stg_drug",
                  "stg_measurement", "stg_procedure"]:
        result = db_session.execute(
            text(f"SELECT count(*) FROM inpatient_staging.{table} WHERE load_batch_id = :bid"),
            {"bid": batch_id},
        )
        count = result.scalar()
        assert count > 0, f"Expected {table} to have rows for batch {batch_id}"
