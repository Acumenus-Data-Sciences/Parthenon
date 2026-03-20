from app.orchestrator.batch_runner import run_mimic_batch


def test_full_pipeline_end_to_end(db_session):
    """End-to-end: MIMIC demo → staging → CDM → quality gate.
    This is the acceptance test for Phase A."""
    summary = run_mimic_batch(db_session)

    # Staging counts
    assert summary["stage"]["stg_patient"] == 100
    assert summary["stage"]["stg_encounter"] > 0
    assert summary["stage"]["stg_condition"] > 0
    assert summary["stage"]["stg_measurement"] > 0

    # Mapping counts
    assert summary["map"]["person"] == 100
    assert summary["map"]["visit_occurrence"] > 0
    assert summary["map"]["condition_occurrence"] > 0
    assert summary["map"]["measurement"] > 0

    # Derived tables
    assert summary["derive"]["observation_period"] > 0
    assert summary["derive"]["concept_gaps"] > 0  # MIMIC local codes won't map

    # Quality gate
    gate = summary["quality"]["gate"]
    assert "passed" in gate
    assert "overall_coverage_pct" in gate

    # No orphan persons (referential integrity)
    for table, checks in summary["quality"]["integrity"].items():
        assert checks["orphan_persons"] == 0, f"{table} has orphan person_ids"

    # Batch tracking
    assert summary["batch_id"] > 0
    assert summary["status"] in ("complete", "rejected")

    print(f"\n{'='*60}")
    print(f"MORPHEUS PHASE A — END-TO-END RESULTS")
    print(f"{'='*60}")
    print(f"Batch ID: {summary['batch_id']}")
    print(f"Status: {summary['status']}")
    print(f"\nStaging:")
    for k, v in summary["stage"].items():
        print(f"  {k}: {v:,}")
    print(f"\nMapping:")
    for k, v in summary["map"].items():
        print(f"  {k}: {v:,}")
    print(f"\nDerived:")
    for k, v in summary["derive"].items():
        print(f"  {k}: {v:,}")
    print(f"\nQuality Gate: {'PASSED' if gate['passed'] else 'REJECTED'}")
    print(f"  Overall coverage: {gate['overall_coverage_pct']}%")
    print(f"  Condition coverage: {gate['condition_coverage_pct']}%")
    print(f"  Procedure coverage: {gate['procedure_coverage_pct']}%")
    if gate.get("reasons"):
        print(f"  Reasons: {gate['reasons']}")
    print(f"{'='*60}")
