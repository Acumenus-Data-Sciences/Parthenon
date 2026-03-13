"""Tests for the schema mapping endpoint (/schema-mapping/suggest).

The endpoint uses pure regex pattern matching — no external dependencies
(Ollama, ChromaDB, DB) — so these tests run without any mocking.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ------------------------------------------------------------------ #
#  Helpers
# ------------------------------------------------------------------ #


def _suggest(columns: list[dict]) -> dict:
    """Call /schema-mapping/suggest and return parsed JSON."""
    response = client.post("/schema-mapping/suggest", json={"columns": columns})
    assert response.status_code == 200
    return response.json()


def _col(name: str, table: str = "source_table", inferred_type: str | None = None) -> dict:
    return {"source_table": table, "column_name": name, "inferred_type": inferred_type}


# ------------------------------------------------------------------ #
#  1. Returns suggestions for known columns
# ------------------------------------------------------------------ #


def test_schema_suggest_returns_mappings() -> None:
    """POST /schema-mapping/suggest with well-known CDM column names should
    return mapping suggestions with cdm_table and cdm_column populated."""
    data = _suggest([
        _col("patient_id"),
        _col("gender"),
        _col("date_of_birth"),
        _col("diagnosis_code"),
    ])

    assert "suggestions" in data
    suggestions = {s["source_column"]: s for s in data["suggestions"]}

    # patient_id → person.person_source_value
    assert suggestions["patient_id"]["cdm_table"] == "person"
    assert suggestions["patient_id"]["cdm_column"] == "person_source_value"

    # gender → person.gender_source_value
    assert suggestions["gender"]["cdm_table"] == "person"
    assert suggestions["gender"]["cdm_column"] == "gender_source_value"

    # date_of_birth → person.birth_datetime
    assert suggestions["date_of_birth"]["cdm_table"] == "person"

    # diagnosis_code → condition_occurrence
    assert suggestions["diagnosis_code"]["cdm_table"] == "condition_occurrence"


# ------------------------------------------------------------------ #
#  2. Regex fallback — all patterns work (Ollama not involved)
# ------------------------------------------------------------------ #


def test_regex_fallback_without_ai() -> None:
    """Schema mapping is purely regex-based — no AI required.
    Even without Ollama, suggestions should be returned for known patterns."""
    # The endpoint never calls Ollama, so this test verifies
    # the regex path always works independently.
    data = _suggest([
        _col("lab_code"),
        _col("result_value"),
        _col("admit_date"),
        _col("drug_code"),
    ])

    assert "suggestions" in data
    suggestions = {s["source_column"]: s for s in data["suggestions"]}

    assert suggestions["lab_code"]["cdm_table"] == "measurement"
    assert suggestions["result_value"]["cdm_table"] == "measurement"
    assert suggestions["admit_date"]["cdm_table"] == "visit_occurrence"
    assert suggestions["drug_code"]["cdm_table"] == "drug_exposure"


# ------------------------------------------------------------------ #
#  3. Confidence scores in valid range (0.0–1.0)
# ------------------------------------------------------------------ #


def test_confidence_scores_valid_range() -> None:
    """All returned confidence scores must be in the range [0.0, 1.0]."""
    columns = [
        _col("patient_id"),
        _col("gender"),
        _col("year_of_birth"),
        _col("icd_code"),
        _col("unknown_column_xyz"),   # no match → confidence 0.0
    ]
    data = _suggest(columns)

    for s in data["suggestions"]:
        confidence = s["confidence"]
        assert 0.0 <= confidence <= 1.0, (
            f"Confidence {confidence} out of [0, 1] for column '{s['source_column']}'"
        )


# ------------------------------------------------------------------ #
#  4. Unknown columns return unmapped suggestion (confidence 0.0)
# ------------------------------------------------------------------ #


def test_unknown_column_returns_unmapped() -> None:
    """Columns with no pattern match should return cdm_table=None and
    cdm_column=None with confidence 0.0."""
    data = _suggest([_col("zxqy_random_col_9999")])

    s = data["suggestions"][0]
    assert s["cdm_table"] is None
    assert s["cdm_column"] is None
    assert s["confidence"] == 0.0


# ------------------------------------------------------------------ #
#  5. source_table is preserved in response
# ------------------------------------------------------------------ #


def test_source_table_preserved_in_response() -> None:
    """The source_table field from the request must be echoed back in each
    suggestion."""
    data = _suggest([
        {"source_table": "my_ehr_table", "column_name": "patient_id"},
        {"source_table": "lab_results", "column_name": "loinc_code"},
    ])

    for s in data["suggestions"]:
        assert s["source_table"] in ("my_ehr_table", "lab_results")


# ------------------------------------------------------------------ #
#  6. Multiple columns processed in a single request
# ------------------------------------------------------------------ #


def test_multiple_columns_processed() -> None:
    """A single request with N columns should return exactly N suggestions."""
    columns = [
        _col("patient_id"),
        _col("sex"),
        _col("year_of_birth"),
        _col("icd10"),
        _col("ndc"),
        _col("lab_date"),
        _col("visit_id"),
        _col("unknown_col"),
    ]
    data = _suggest(columns)
    assert len(data["suggestions"]) == len(columns)


# ------------------------------------------------------------------ #
#  7. Year-of-birth pattern maps with high confidence
# ------------------------------------------------------------------ #


def test_year_of_birth_high_confidence() -> None:
    """year_of_birth should map to person.year_of_birth with confidence ≥ 0.90."""
    data = _suggest([_col("year_of_birth")])
    s = data["suggestions"][0]
    assert s["cdm_table"] == "person"
    assert s["cdm_column"] == "year_of_birth"
    assert s["confidence"] >= 0.90


# ------------------------------------------------------------------ #
#  8. Drug-related columns map to drug_exposure
# ------------------------------------------------------------------ #


def test_drug_columns_map_to_drug_exposure() -> None:
    """Drug-related column names should map to drug_exposure table."""
    data = _suggest([
        _col("days_supply"),
        _col("refills"),
        _col("prescription_date"),
    ])

    for s in data["suggestions"]:
        assert s["cdm_table"] == "drug_exposure", (
            f"Expected drug_exposure for {s['source_column']}, got {s['cdm_table']}"
        )


# ------------------------------------------------------------------ #
#  9. Empty columns list returns empty suggestions
# ------------------------------------------------------------------ #


def test_empty_columns_returns_empty_suggestions() -> None:
    """POST with an empty columns list should return empty suggestions."""
    data = _suggest([])
    assert data["suggestions"] == []


# ------------------------------------------------------------------ #
#  10. Procedure columns map correctly
# ------------------------------------------------------------------ #


def test_procedure_columns_map_correctly() -> None:
    """Procedure-related columns should map to procedure_occurrence."""
    data = _suggest([
        _col("procedure_code"),
        _col("cpt_code"),
        _col("procedure_date"),
    ])

    suggestions = {s["source_column"]: s for s in data["suggestions"]}
    assert suggestions["procedure_code"]["cdm_table"] == "procedure_occurrence"
    assert suggestions["cpt_code"]["cdm_table"] == "procedure_occurrence"
    assert suggestions["procedure_date"]["cdm_table"] == "procedure_occurrence"
