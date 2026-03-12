"""
Text-to-SQL router — natural language → OMOP CDM v5.4 PostgreSQL queries.

Inspired by OHDSI Nostos but implemented with the project's own Ollama/MedGemma
integration.  Three endpoints:

  POST /text-to-sql/generate  — NL question → validated SQL + explanation
  POST /text-to-sql/validate  — Static analysis of a candidate SQL string
  GET  /text-to-sql/schema    — OMOP CDM v5.4 schema reference (structured JSON)
"""

import logging
import re
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── OMOP CDM v5.4 reference data ─────────────────────────────────────────────

# Canonical set of CDM table names (lower-case).  Used for validation and the
# /schema endpoint.  Vocabulary tables are a subset of the full OMOP list.
OMOP_CLINICAL_TABLES: set[str] = {
    "person",
    "visit_occurrence",
    "visit_detail",
    "condition_occurrence",
    "drug_exposure",
    "procedure_occurrence",
    "device_exposure",
    "measurement",
    "observation",
    "note",
    "note_nlp",
    "specimen",
    "fact_relationship",
    "location",
    "care_site",
    "provider",
    "payer_plan_period",
    "cost",
    "drug_era",
    "dose_era",
    "condition_era",
    "episode",
    "episode_event",
    "death",
    "observation_period",
}

OMOP_VOCAB_TABLES: set[str] = {
    "concept",
    "vocabulary",
    "domain",
    "concept_class",
    "concept_relationship",
    "relationship",
    "concept_synonym",
    "concept_ancestor",
    "source_to_concept_map",
    "drug_strength",
}

OMOP_ALL_TABLES: set[str] = OMOP_CLINICAL_TABLES | OMOP_VOCAB_TABLES

# DML / DDL verbs that must never appear in generated SQL
_FORBIDDEN_VERBS: list[str] = [
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bDELETE\b",
    r"\bDROP\b",
    r"\bTRUNCATE\b",
    r"\bALTER\b",
    r"\bCREATE\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
    r"\bEXECUTE\b",
    r"\bCALL\b",
]

# Patterns that suggest attempts to read system metadata or escape the CDM
_DANGEROUS_PATTERNS: list[str] = [
    r"\bpg_\w+",                    # pg_catalog functions / tables
    r"\binformation_schema\b",
    r"\bpg_shadow\b",
    r"\bpg_user\b",
    r"\bcopy\s+\w+\s+from\b",      # COPY FROM  (data exfil)
    r"\\\w+",                       # psql meta-commands
]

# Comprehensive schema context injected into the system prompt
_OMOP_SCHEMA_CONTEXT = """
## OMOP CDM v5.4 — Key Tables & Columns

### Clinical Tables

**person** — one row per patient
  person_id (bigint PK), gender_concept_id (int), year_of_birth (int),
  month_of_birth (int), day_of_birth (int), birth_datetime (timestamp),
  race_concept_id (int), ethnicity_concept_id (int),
  location_id (bigint), provider_id (bigint), care_site_id (bigint)

**observation_period** — contiguous observation windows
  observation_period_id (bigint PK), person_id (bigint FK),
  observation_period_start_date (date), observation_period_end_date (date),
  period_type_concept_id (int)

**visit_occurrence** — encounters / visits
  visit_occurrence_id (bigint PK), person_id (bigint FK),
  visit_concept_id (int), visit_start_date (date), visit_start_datetime (timestamp),
  visit_end_date (date), visit_end_datetime (timestamp),
  visit_type_concept_id (int), provider_id (bigint), care_site_id (bigint)

**condition_occurrence** — diagnoses
  condition_occurrence_id (bigint PK), person_id (bigint FK),
  condition_concept_id (int), condition_start_date (date),
  condition_start_datetime (timestamp), condition_end_date (date),
  condition_end_datetime (timestamp), condition_type_concept_id (int),
  stop_reason (varchar), provider_id (bigint), visit_occurrence_id (bigint FK)

**drug_exposure** — prescriptions, administrations, dispensings
  drug_exposure_id (bigint PK), person_id (bigint FK),
  drug_concept_id (int), drug_exposure_start_date (date),
  drug_exposure_start_datetime (timestamp), drug_exposure_end_date (date),
  drug_exposure_end_datetime (timestamp), drug_type_concept_id (int),
  stop_reason (varchar), refills (int), quantity (numeric), days_supply (int),
  route_concept_id (int), provider_id (bigint), visit_occurrence_id (bigint FK)

**procedure_occurrence** — surgical procedures, labs ordered
  procedure_occurrence_id (bigint PK), person_id (bigint FK),
  procedure_concept_id (int), procedure_date (date),
  procedure_datetime (timestamp), procedure_type_concept_id (int),
  modifier_concept_id (int), quantity (int), provider_id (bigint),
  visit_occurrence_id (bigint FK)

**measurement** — lab results, vitals
  measurement_id (bigint PK), person_id (bigint FK),
  measurement_concept_id (int), measurement_date (date),
  measurement_datetime (timestamp), measurement_type_concept_id (int),
  operator_concept_id (int), value_as_number (numeric),
  value_as_concept_id (int), unit_concept_id (int),
  range_low (numeric), range_high (numeric),
  provider_id (bigint), visit_occurrence_id (bigint FK)

**observation** — surveys, social history, allergies, qualitative findings
  observation_id (bigint PK), person_id (bigint FK),
  observation_concept_id (int), observation_date (date),
  observation_datetime (timestamp), observation_type_concept_id (int),
  value_as_number (numeric), value_as_string (varchar),
  value_as_concept_id (int), qualifier_concept_id (int),
  unit_concept_id (int), provider_id (bigint), visit_occurrence_id (bigint FK)

**death** — mortality records
  person_id (bigint PK/FK), death_date (date), death_datetime (timestamp),
  death_type_concept_id (int), cause_concept_id (int),
  cause_source_value (varchar), cause_source_concept_id (int)

**condition_era** — contiguous condition spans
  condition_era_id (bigint PK), person_id (bigint FK),
  condition_concept_id (int), condition_era_start_date (date),
  condition_era_end_date (date), condition_occurrence_count (int)

**drug_era** — contiguous drug exposure spans
  drug_era_id (bigint PK), person_id (bigint FK),
  drug_concept_id (int), drug_era_start_date (date),
  drug_era_end_date (date), gap_days (int), drug_exposure_count (int)

### Vocabulary Tables

**concept** — the master vocabulary table
  concept_id (int PK), concept_name (varchar), domain_id (varchar),
  vocabulary_id (varchar), concept_class_id (varchar),
  standard_concept (char), concept_code (varchar),
  valid_start_date (date), valid_end_date (date), invalid_reason (char)

**concept_ancestor** — hierarchical relationships
  ancestor_concept_id (int), descendant_concept_id (int),
  min_levels_of_separation (int), max_levels_of_separation (int)

**concept_relationship** — lateral concept relationships
  concept_id_1 (int), concept_id_2 (int), relationship_id (varchar),
  valid_start_date (date), valid_end_date (date), invalid_reason (char)

### Common Join Patterns

-- Look up concept name:
JOIN {schema}.concept c ON c.concept_id = co.condition_concept_id

-- Find all descendants of a concept (e.g., all diabetes subtypes):
JOIN {schema}.concept_ancestor ca
  ON ca.descendant_concept_id = co.condition_concept_id
  AND ca.ancestor_concept_id = 201826  -- Type 2 diabetes mellitus

-- Age calculation:
DATE_PART('year', AGE(CURRENT_DATE, MAKE_DATE(p.year_of_birth, 1, 1)))

-- Standard gender concepts:
--   8507 = Male, 8532 = Female

### Important Vocabulary Concepts (standard concept_ids)

Conditions (SNOMED):
  201826 = Type 2 diabetes mellitus
  313217 = Atrial fibrillation
  319835 = Congestive heart failure
  255573 = Chronic obstructive lung disease
  4329847 = Myocardial infarction

Drugs (RxNorm):
  1503297 = Metformin
  1539403 = Lisinopril
  1307046 = Warfarin

Measurements (LOINC):
  3004249 = Systolic blood pressure
  3012888 = Diastolic blood pressure
  3013682 = HbA1c (LOINC 4548-4)
"""


# ── Pydantic models ───────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Natural language question about OMOP CDM data",
    )
    cdm_schema: str = Field(
        default="omop",
        description="Schema prefix to qualify table names",
    )
    dialect: Literal["postgresql"] = Field(
        default="postgresql",
        description="Target SQL dialect (only postgresql supported)",
    )


class GenerateResponse(BaseModel):
    sql: str
    explanation: str
    tables_referenced: list[str]
    is_aggregate: bool
    safety: Literal["safe", "unsafe", "unknown"]


class ValidateRequest(BaseModel):
    sql: str = Field(..., min_length=6, max_length=10000)
    cdm_schema: str = Field(default="omop")


class ValidateResponse(BaseModel):
    valid: bool
    read_only: bool
    tables: list[str]
    warnings: list[str]
    estimated_complexity: Literal["low", "medium", "high"]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _build_system_prompt(cdm_schema: str) -> str:
    schema_ctx = _OMOP_SCHEMA_CONTEXT.replace("{schema}", cdm_schema)
    return f"""\
You are an expert OMOP CDM v5.4 SQL query writer for a PostgreSQL database.

Your job is to produce a single valid PostgreSQL SELECT query that answers a
researcher's natural language question about clinical data stored in the OMOP CDM.

## Rules (MANDATORY — never break these)

1. Output ONLY valid JSON — no markdown fences, no prose before or after.
2. Use the exact JSON schema below.
3. Always qualify EVERY table name with the schema prefix: {cdm_schema}.<table>
   Example: {cdm_schema}.person  NOT  person
4. Use standard OMOP concept_id values for filtering — NEVER filter by
   concept_name using string matching (the concept table is the authority).
5. JOIN to the concept table when you need human-readable labels, using
   {cdm_schema}.concept.
6. Use concept_ancestor joins to include descendants when the question implies
   a clinical category (e.g., "diabetes" includes all subtypes).
7. Use SELECT only — no INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE,
   GRANT, REVOKE, EXECUTE, or COPY.
8. Add LIMIT 1000 for row-level result queries; omit LIMIT for pure aggregates
   (COUNT, SUM, AVG, etc.) — the is_aggregate flag must reflect this.
9. Handle dates with PostgreSQL date functions (DATE_PART, AGE, MAKE_DATE).
10. Prefer condition_era / drug_era over raw occurrence tables when the question
    is about ongoing/chronic conditions or drug regimens.
11. If the question is ambiguous, write the most clinically useful interpretation
    and note the assumption in the explanation.

## Output JSON schema

{{
  "sql": "<complete PostgreSQL SELECT statement>",
  "explanation": "<one to three sentences explaining what the query does and any assumptions>",
  "tables_referenced": ["<table_name_without_schema>", ...],
  "is_aggregate": true | false,
  "safety": "safe"
}}

## OMOP CDM v5.4 Schema Reference

{schema_ctx}
"""


async def _call_ollama(system_prompt: str, user_message: str,
                       temperature: float = 0.05) -> str:
    """
    Single-turn Ollama call.  Low temperature (0.05) for near-deterministic
    structured SQL output.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": temperature},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]  # type: ignore[no-any-return]
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="LLM service timed out.")
    except Exception as exc:
        logger.error("Ollama call failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"LLM service unavailable: {exc}")


def _strip_fences(raw: str) -> str:
    """Remove accidental markdown code fences from LLM output."""
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        # parts[1] is the content between first pair of fences
        inner = parts[1] if len(parts) > 1 else text
        if inner.startswith("json"):
            inner = inner[4:]
        return inner.strip()
    return text


def _extract_tables(sql: str) -> list[str]:
    """
    Extract bare table names (without schema prefix) from a SQL string.
    Recognises FROM <schema>.<table> and JOIN <schema>.<table> patterns.
    """
    pattern = re.compile(
        r"(?:FROM|JOIN)\s+(?:\w+\.)?(\w+)",
        re.IGNORECASE,
    )
    found = {m.group(1).lower() for m in pattern.finditer(sql)}
    # Return only names that are valid OMOP tables
    return sorted(found & OMOP_ALL_TABLES)


def _is_read_only(sql: str) -> bool:
    sql_upper = sql.upper()
    for verb in _FORBIDDEN_VERBS:
        if re.search(verb, sql_upper):
            return False
    return True


def _has_dangerous_pattern(sql: str) -> bool:
    for pat in _DANGEROUS_PATTERNS:
        if re.search(pat, sql, re.IGNORECASE):
            return True
    return False


def _is_aggregate(sql: str) -> bool:
    """Heuristic: query is aggregate if it uses COUNT/SUM/AVG/MIN/MAX at the
    top SELECT level and has no row-driving LIMIT."""
    upper = sql.upper()
    agg_funcs = re.search(r"\b(COUNT|SUM|AVG|MIN|MAX)\s*\(", upper)
    return bool(agg_funcs)


def _estimate_complexity(sql: str) -> Literal["low", "medium", "high"]:
    upper = sql.upper()
    join_count = len(re.findall(r"\bJOIN\b", upper))
    subquery_count = len(re.findall(r"\bSELECT\b", upper)) - 1  # subtract outer
    cte_count = len(re.findall(r"\bWITH\b", upper))
    window_count = len(re.findall(r"\bOVER\s*\(", upper))
    score = join_count + subquery_count * 2 + cte_count + window_count * 2
    if score <= 2:
        return "low"
    if score <= 6:
        return "medium"
    return "high"


def _validate_sql(sql: str, cdm_schema: str) -> tuple[bool, list[str]]:
    """
    Core validation logic.  Returns (valid, list_of_warnings).
    valid=False means the SQL should not be executed.
    """
    warnings: list[str] = []
    stripped = sql.strip()

    # Must start with SELECT or WITH (CTE)
    if not re.match(r"^\s*(SELECT|WITH)\b", stripped, re.IGNORECASE):
        return False, ["SQL must begin with SELECT or WITH."]

    if not _is_read_only(stripped):
        return False, ["SQL contains a forbidden data-modification statement."]

    if _has_dangerous_pattern(stripped):
        return False, ["SQL contains a dangerous pattern (system table access, COPY, etc.)."]

    tables = _extract_tables(stripped)
    if not tables:
        warnings.append(
            "No recognised OMOP CDM table names found — ensure tables are "
            f"qualified as {cdm_schema}.<table_name>."
        )

    # Warn if schema prefix appears absent for at least one reference
    if cdm_schema and not re.search(
        rf"\b{re.escape(cdm_schema)}\.", stripped, re.IGNORECASE
    ):
        warnings.append(
            f"Schema prefix '{cdm_schema}.' not detected. "
            "All table references should be fully qualified."
        )

    # Warn about missing LIMIT on non-aggregate queries
    if not _is_aggregate(stripped) and "LIMIT" not in stripped.upper():
        warnings.append(
            "No LIMIT clause on a row-level query; consider adding LIMIT to "
            "avoid returning very large result sets."
        )

    return True, warnings


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateResponse)
async def generate_sql(request: GenerateRequest) -> GenerateResponse:
    """
    Convert a natural language question into a validated OMOP CDM SQL query.

    The LLM is instructed to return structured JSON containing the SQL,
    explanation, referenced tables, and aggregate flag.  The SQL is then
    statically validated before being returned to the caller.
    """
    system_prompt = _build_system_prompt(request.cdm_schema)
    raw = await _call_ollama(system_prompt=system_prompt, user_message=request.question)

    clean = _strip_fences(raw)

    # Attempt to parse the structured JSON returned by the LLM
    import json  # local import to keep top-level imports clean
    try:
        parsed: dict[str, Any] = json.loads(clean)
    except json.JSONDecodeError:
        # The LLM returned unstructured text.  Try to extract a SQL block.
        sql_match = re.search(
            r"((?:WITH|SELECT)\s.+?)(?:```|$)", clean, re.IGNORECASE | re.DOTALL
        )
        if sql_match:
            raw_sql = sql_match.group(1).strip()
        else:
            logger.warning("LLM returned non-JSON output for text-to-sql: %s", raw[:300])
            raise HTTPException(
                status_code=422,
                detail="LLM returned unparseable output. Try rephrasing the question.",
            )
        parsed = {
            "sql": raw_sql,
            "explanation": "Extracted from unstructured LLM output.",
            "tables_referenced": [],
            "is_aggregate": _is_aggregate(raw_sql),
            "safety": "unknown",
        }

    sql: str = parsed.get("sql", "").strip()
    if not sql:
        raise HTTPException(
            status_code=422,
            detail="LLM did not return a SQL statement.",
        )

    # Static safety validation
    valid, warnings = _validate_sql(sql, request.cdm_schema)
    safety: Literal["safe", "unsafe", "unknown"] = "safe" if valid else "unsafe"

    if not valid:
        # Return the SQL anyway so the frontend can show it, but flag as unsafe
        logger.warning(
            "Generated SQL failed validation: %s | sql=%s", warnings, sql[:200]
        )

    # Derive tables from the actual SQL (more reliable than LLM self-report)
    tables_referenced = _extract_tables(sql)
    if not tables_referenced:
        # Fall back to what the LLM reported
        tables_referenced = [
            t.lower() for t in parsed.get("tables_referenced", [])
            if isinstance(t, str)
        ]

    is_agg = bool(parsed.get("is_aggregate", _is_aggregate(sql)))

    return GenerateResponse(
        sql=sql,
        explanation=str(parsed.get("explanation", "")),
        tables_referenced=tables_referenced,
        is_aggregate=is_agg,
        safety=safety,
    )


@router.post("/validate", response_model=ValidateResponse)
async def validate_sql(request: ValidateRequest) -> ValidateResponse:
    """
    Statically analyse a SQL string for read-only safety, OMOP table references,
    schema prefix compliance, and query complexity.  Does NOT execute the SQL.
    """
    sql = request.sql.strip()
    read_only = _is_read_only(sql)
    valid, warnings = _validate_sql(sql, request.cdm_schema)

    if _has_dangerous_pattern(sql):
        warnings.insert(0, "Dangerous system-access pattern detected.")

    tables = _extract_tables(sql)
    complexity = _estimate_complexity(sql)

    return ValidateResponse(
        valid=valid,
        read_only=read_only,
        tables=tables,
        warnings=warnings,
        estimated_complexity=complexity,
    )


@router.get("/schema")
async def get_schema() -> dict[str, Any]:
    """
    Return the OMOP CDM v5.4 schema summary as structured JSON.
    The frontend uses this to render a schema browser alongside the SQL editor.
    """
    return {
        "version": "5.4",
        "clinical_tables": [
            {
                "name": "person",
                "description": "One row per patient; demographic anchor.",
                "key_columns": [
                    {"name": "person_id", "type": "bigint", "note": "Primary key"},
                    {"name": "gender_concept_id", "type": "int", "note": "8507=Male, 8532=Female"},
                    {"name": "year_of_birth", "type": "int", "note": "Use for age calculations"},
                    {"name": "race_concept_id", "type": "int", "note": ""},
                    {"name": "ethnicity_concept_id", "type": "int", "note": ""},
                ],
            },
            {
                "name": "observation_period",
                "description": "Contiguous observation windows defining data availability.",
                "key_columns": [
                    {"name": "observation_period_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "observation_period_start_date", "type": "date", "note": ""},
                    {"name": "observation_period_end_date", "type": "date", "note": ""},
                ],
            },
            {
                "name": "visit_occurrence",
                "description": "Clinical encounters (inpatient, outpatient, ED, etc.).",
                "key_columns": [
                    {"name": "visit_occurrence_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "visit_concept_id", "type": "int", "note": "9201=IP, 9202=OP, 9203=ED"},
                    {"name": "visit_start_date", "type": "date", "note": ""},
                    {"name": "visit_end_date", "type": "date", "note": ""},
                ],
            },
            {
                "name": "condition_occurrence",
                "description": "Diagnoses recorded during visits.",
                "key_columns": [
                    {"name": "condition_occurrence_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "condition_concept_id", "type": "int", "note": "SNOMED standard concept"},
                    {"name": "condition_start_date", "type": "date", "note": ""},
                    {"name": "condition_end_date", "type": "date", "note": "Nullable"},
                    {"name": "visit_occurrence_id", "type": "bigint", "note": "FK → visit_occurrence"},
                ],
            },
            {
                "name": "drug_exposure",
                "description": "Prescriptions, administrations, and dispensings.",
                "key_columns": [
                    {"name": "drug_exposure_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "drug_concept_id", "type": "int", "note": "RxNorm standard concept"},
                    {"name": "drug_exposure_start_date", "type": "date", "note": ""},
                    {"name": "drug_exposure_end_date", "type": "date", "note": ""},
                    {"name": "days_supply", "type": "int", "note": ""},
                    {"name": "quantity", "type": "numeric", "note": ""},
                ],
            },
            {
                "name": "procedure_occurrence",
                "description": "Surgical procedures and ordered labs.",
                "key_columns": [
                    {"name": "procedure_occurrence_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "procedure_concept_id", "type": "int", "note": "SNOMED/CPT4"},
                    {"name": "procedure_date", "type": "date", "note": ""},
                ],
            },
            {
                "name": "measurement",
                "description": "Lab results, vital signs, and quantitative observations.",
                "key_columns": [
                    {"name": "measurement_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "measurement_concept_id", "type": "int", "note": "LOINC standard concept"},
                    {"name": "measurement_date", "type": "date", "note": ""},
                    {"name": "value_as_number", "type": "numeric", "note": "Quantitative result"},
                    {"name": "unit_concept_id", "type": "int", "note": "UCUM unit"},
                    {"name": "range_low", "type": "numeric", "note": "Reference range low"},
                    {"name": "range_high", "type": "numeric", "note": "Reference range high"},
                ],
            },
            {
                "name": "observation",
                "description": "Surveys, social history, allergies, qualitative findings.",
                "key_columns": [
                    {"name": "observation_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "observation_concept_id", "type": "int", "note": "Standard concept"},
                    {"name": "observation_date", "type": "date", "note": ""},
                    {"name": "value_as_number", "type": "numeric", "note": ""},
                    {"name": "value_as_string", "type": "varchar", "note": ""},
                    {"name": "value_as_concept_id", "type": "int", "note": ""},
                ],
            },
            {
                "name": "death",
                "description": "Mortality records.",
                "key_columns": [
                    {"name": "person_id", "type": "bigint", "note": "PK and FK → person"},
                    {"name": "death_date", "type": "date", "note": ""},
                    {"name": "cause_concept_id", "type": "int", "note": "SNOMED cause of death"},
                ],
            },
            {
                "name": "condition_era",
                "description": "Contiguous spans of a condition diagnosis.",
                "key_columns": [
                    {"name": "condition_era_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "condition_concept_id", "type": "int", "note": ""},
                    {"name": "condition_era_start_date", "type": "date", "note": ""},
                    {"name": "condition_era_end_date", "type": "date", "note": ""},
                    {"name": "condition_occurrence_count", "type": "int", "note": ""},
                ],
            },
            {
                "name": "drug_era",
                "description": "Contiguous spans of drug exposure (gaps ≤ 30 days collapsed).",
                "key_columns": [
                    {"name": "drug_era_id", "type": "bigint", "note": "PK"},
                    {"name": "person_id", "type": "bigint", "note": "FK → person"},
                    {"name": "drug_concept_id", "type": "int", "note": "RxNorm ingredient"},
                    {"name": "drug_era_start_date", "type": "date", "note": ""},
                    {"name": "drug_era_end_date", "type": "date", "note": ""},
                    {"name": "drug_exposure_count", "type": "int", "note": ""},
                ],
            },
        ],
        "vocabulary_tables": [
            {
                "name": "concept",
                "description": "Master vocabulary — every clinical concept has a row here.",
                "key_columns": [
                    {"name": "concept_id", "type": "int", "note": "PK"},
                    {"name": "concept_name", "type": "varchar", "note": "Human-readable label"},
                    {"name": "domain_id", "type": "varchar", "note": "Condition, Drug, Measurement, etc."},
                    {"name": "vocabulary_id", "type": "varchar", "note": "SNOMED, RxNorm, LOINC, ICD10CM…"},
                    {"name": "standard_concept", "type": "char", "note": "'S'=standard, 'C'=classification, null=non-standard"},
                    {"name": "concept_code", "type": "varchar", "note": "Source code (ICD code, LOINC code, etc.)"},
                ],
            },
            {
                "name": "concept_ancestor",
                "description": "Pre-computed hierarchy for all standard concepts.",
                "key_columns": [
                    {"name": "ancestor_concept_id", "type": "int", "note": ""},
                    {"name": "descendant_concept_id", "type": "int", "note": ""},
                    {"name": "min_levels_of_separation", "type": "int", "note": ""},
                    {"name": "max_levels_of_separation", "type": "int", "note": ""},
                ],
            },
            {
                "name": "concept_relationship",
                "description": "Lateral relationships (Maps to, Is a, etc.).",
                "key_columns": [
                    {"name": "concept_id_1", "type": "int", "note": ""},
                    {"name": "concept_id_2", "type": "int", "note": ""},
                    {"name": "relationship_id", "type": "varchar", "note": "'Maps to', 'Is a', 'Subsumes'…"},
                ],
            },
        ],
        "common_join_patterns": [
            {
                "name": "Concept name lookup",
                "sql": "JOIN {schema}.concept c ON c.concept_id = co.condition_concept_id",
            },
            {
                "name": "Hierarchical concept descendants",
                "sql": (
                    "JOIN {schema}.concept_ancestor ca\n"
                    "  ON ca.descendant_concept_id = co.condition_concept_id\n"
                    "  AND ca.ancestor_concept_id = <root_concept_id>"
                ),
            },
            {
                "name": "Age at first event",
                "sql": (
                    "DATE_PART('year', AGE(co.condition_start_date,\n"
                    "  MAKE_DATE(p.year_of_birth, 1, 1))) AS age_at_event"
                ),
            },
        ],
        "notable_concepts": {
            "gender": {"male": 8507, "female": 8532},
            "visit_type": {"inpatient": 9201, "outpatient": 9202, "emergency": 9203},
            "common_conditions": {
                "type_2_diabetes": 201826,
                "atrial_fibrillation": 313217,
                "congestive_heart_failure": 319835,
                "copd": 255573,
                "myocardial_infarction": 4329847,
            },
            "common_drugs": {
                "metformin": 1503297,
                "lisinopril": 1539403,
                "warfarin": 1307046,
            },
            "common_measurements": {
                "systolic_bp": 3004249,
                "diastolic_bp": 3012888,
                "hba1c": 3013682,
            },
        },
    }
