"""Create OHDSI cohort definitions for IRSF-NHS Rett Syndrome data in Parthenon.

Creates 3 cohort definitions via the Parthenon REST API:
1. All Rett Syndrome patients (by SNOMED condition)
2. Rett patients with seizures/epilepsy
3. Rett patients with any drug exposure

Optionally generates each cohort against the IRSF-NHS source.
Produces a report at output/reports/cohort_definitions_report.json.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import requests

from scripts.irsf_etl.config import ETLConfig

logger = logging.getLogger(__name__)

# Parthenon API base URL
API_BASE = os.environ.get("PARTHENON_API_URL", "http://localhost:8082/api/v1")

# IRSF-NHS source ID (registered in Phase 11)
DEFAULT_SOURCE_ID = int(os.environ.get("IRSF_SOURCE_ID", "57"))

# SNOMED concept IDs
RETT_SYNDROME_CONCEPT_ID = 432923  # Rett's disorder
EPILEPSY_CONCEPT_ID = 380378  # Epilepsy


def _rett_concept_set() -> dict[str, Any]:
    """Return the Rett Syndrome concept set definition."""
    return {
        "id": 0,
        "name": "Rett Syndrome",
        "expression": {
            "items": [
                {
                    "concept": {
                        "CONCEPT_ID": RETT_SYNDROME_CONCEPT_ID,
                        "CONCEPT_NAME": "Rett syndrome",
                        "STANDARD_CONCEPT": "S",
                        "VOCABULARY_ID": "SNOMED",
                        "DOMAIN_ID": "Condition",
                    },
                    "includeDescendants": True,
                    "isExcluded": False,
                }
            ]
        },
    }


def _rett_primary_criteria() -> dict[str, Any]:
    """Return PrimaryCriteria for Rett condition occurrence."""
    return {
        "CriteriaList": [
            {"ConditionOccurrence": {"CodesetId": 0}}
        ],
        "ObservationWindow": {"PriorDays": 0, "PostDays": 0},
        "PrimaryCriteriaLimit": {"Type": "First"},
    }


def _time_window() -> dict[str, Any]:
    """Return an unbounded time window for additional criteria."""
    return {
        "Start": {"Days": None, "Coeff": -1},
        "End": {"Days": None, "Coeff": 1},
    }


def build_all_rett_definition() -> dict[str, Any]:
    """Build the 'All Rett Patients' cohort definition payload."""
    return {
        "name": "IRSF-NHS All Rett Syndrome Patients",
        "description": (
            "All patients in the IRSF Natural History Study with a Rett Syndrome "
            "diagnosis (ICD-10 F84.2 / SNOMED 68618008)"
        ),
        "expression_json": {
            "conceptSets": [_rett_concept_set()],
            "PrimaryCriteria": _rett_primary_criteria(),
            "QualifiedLimit": {"Type": "First"},
            "ExpressionLimit": {"Type": "First"},
            "AdditionalCriteria": None,
            "DemographicCriteria": None,
            "EndStrategy": None,
            "CensoringCriteria": [],
        },
    }


def build_seizure_subgroup_definition() -> dict[str, Any]:
    """Build the 'Rett with Seizures' cohort definition payload."""
    seizure_concept_set = {
        "id": 1,
        "name": "Seizure / Epilepsy",
        "expression": {
            "items": [
                {
                    "concept": {
                        "CONCEPT_ID": EPILEPSY_CONCEPT_ID,
                        "CONCEPT_NAME": "Epilepsy",
                        "STANDARD_CONCEPT": "S",
                        "VOCABULARY_ID": "SNOMED",
                        "DOMAIN_ID": "Condition",
                    },
                    "includeDescendants": True,
                    "isExcluded": False,
                }
            ]
        },
    }

    return {
        "name": "IRSF-NHS Rett Patients with Seizures",
        "description": (
            "Rett Syndrome patients who have at least one seizure/epilepsy "
            "condition recorded"
        ),
        "expression_json": {
            "conceptSets": [_rett_concept_set(), seizure_concept_set],
            "PrimaryCriteria": _rett_primary_criteria(),
            "QualifiedLimit": {"Type": "First"},
            "ExpressionLimit": {"Type": "First"},
            "AdditionalCriteria": {
                "Type": "ALL",
                "CriteriaList": [
                    {
                        "Criteria": {
                            "ConditionOccurrence": {"CodesetId": 1}
                        },
                        "StartWindow": _time_window(),
                        "Occurrence": {"Type": 2, "Count": 1},
                    }
                ],
                "Groups": [],
            },
            "DemographicCriteria": None,
            "EndStrategy": None,
            "CensoringCriteria": [],
        },
    }


def build_medication_subgroup_definition() -> dict[str, Any]:
    """Build the 'Rett with Drug Exposure' cohort definition payload."""
    return {
        "name": "IRSF-NHS Rett Patients with Drug Exposure",
        "description": (
            "Rett Syndrome patients who have at least one recorded "
            "medication exposure"
        ),
        "expression_json": {
            "conceptSets": [_rett_concept_set()],
            "PrimaryCriteria": _rett_primary_criteria(),
            "QualifiedLimit": {"Type": "First"},
            "ExpressionLimit": {"Type": "First"},
            "AdditionalCriteria": {
                "Type": "ALL",
                "CriteriaList": [
                    {
                        "Criteria": {"DrugExposure": {}},
                        "StartWindow": _time_window(),
                        "Occurrence": {"Type": 2, "Count": 1},
                    }
                ],
                "Groups": [],
            },
            "DemographicCriteria": None,
            "EndStrategy": None,
            "CensoringCriteria": [],
        },
    }


@dataclass
class CohortResult:
    """Result of creating (and optionally generating) a cohort definition."""

    name: str
    cohort_id: int | None = None
    created: bool = False
    create_error: str | None = None
    generated: bool = False
    generation_status: str | None = None
    person_count: int | None = None


def _get_auth_token() -> str:
    """Obtain a Sanctum auth token for API calls.

    Reads credentials from environment variables:
    - PARTHENON_API_EMAIL (default: admin@acumenus.net)
    - PARTHENON_API_PASSWORD (required)
    """
    email = os.environ.get("PARTHENON_API_EMAIL", "admin@acumenus.net")
    password = os.environ.get("PARTHENON_API_PASSWORD", "")
    if not password:
        msg = (
            "PARTHENON_API_PASSWORD environment variable is required. "
            "Set it to the admin user's password."
        )
        raise RuntimeError(msg)

    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data.get("token") or data.get("data", {}).get("token")
    if not token:
        msg = f"Login response did not contain a token: {list(data.keys())}"
        raise RuntimeError(msg)
    return token


def create_cohort_definition(
    session: requests.Session,
    payload: dict[str, Any],
) -> CohortResult:
    """Create a single cohort definition via the API."""
    result = CohortResult(name=payload["name"])
    try:
        resp = session.post(
            f"{API_BASE}/cohort-definitions",
            json=payload,
            timeout=60,
        )
        if resp.status_code == 201:
            data = resp.json().get("data", resp.json())
            result.cohort_id = data.get("id")
            result.created = True
            logger.info("Created cohort '%s' (id=%s)", result.name, result.cohort_id)
        else:
            result.create_error = f"HTTP {resp.status_code}: {resp.text[:500]}"
            logger.error("Failed to create '%s': %s", result.name, result.create_error)
    except requests.RequestException as exc:
        result.create_error = str(exc)
        logger.error("Request error creating '%s': %s", result.name, exc)

    return result


def generate_cohort(
    session: requests.Session,
    result: CohortResult,
    source_id: int,
) -> CohortResult:
    """Generate a cohort against the given source. Updates result in place."""
    if not result.created or result.cohort_id is None:
        return result

    try:
        resp = session.post(
            f"{API_BASE}/cohort-definitions/{result.cohort_id}/generate",
            json={"source_id": source_id},
            timeout=120,
        )
        if resp.status_code in (200, 201, 202):
            result.generated = True
            result.generation_status = "queued"
            logger.info(
                "Generation queued for cohort '%s' (id=%s) on source %d",
                result.name,
                result.cohort_id,
                source_id,
            )
        else:
            result.generation_status = f"HTTP {resp.status_code}: {resp.text[:300]}"
            logger.warning("Generation request failed for '%s': %s", result.name, result.generation_status)
    except requests.RequestException as exc:
        result.generation_status = f"Error: {exc}"
        logger.warning("Generation request error for '%s': %s", result.name, exc)

    return result


def check_generation_status(
    session: requests.Session,
    result: CohortResult,
    max_wait_seconds: int = 120,
    poll_interval: int = 5,
) -> CohortResult:
    """Poll generation status until complete or timeout."""
    if not result.generated or result.cohort_id is None:
        return result

    deadline = time.monotonic() + max_wait_seconds
    while time.monotonic() < deadline:
        try:
            resp = session.get(
                f"{API_BASE}/cohort-definitions/{result.cohort_id}/generations",
                timeout=30,
            )
            if resp.status_code == 200:
                generations = resp.json().get("data", [])
                if generations:
                    latest = generations[-1] if isinstance(generations, list) else generations
                    status = latest.get("status", "")
                    if status.lower() == "completed":
                        result.generation_status = "completed"
                        result.person_count = latest.get("person_count", latest.get("record_count"))
                        logger.info(
                            "Cohort '%s' generation completed: %s persons",
                            result.name,
                            result.person_count,
                        )
                        return result
                    if status.lower() in ("failed", "error"):
                        result.generation_status = f"failed: {latest.get('message', '')}"
                        logger.warning("Cohort '%s' generation failed", result.name)
                        return result
        except requests.RequestException:
            pass
        time.sleep(poll_interval)

    result.generation_status = f"timeout after {max_wait_seconds}s"
    logger.warning("Cohort '%s' generation timed out", result.name)
    return result


@dataclass
class CohortReport:
    """Full cohort creation report."""

    all_rett: CohortResult
    seizure_subgroup: CohortResult
    medication_exposure: CohortResult
    all_created: bool
    any_generated: bool


def save_report(report: CohortReport, output_path: Path) -> None:
    """Save the cohort report as JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "cohort_definitions": {
            "all_rett": asdict(report.all_rett),
            "seizure_subgroup": asdict(report.seizure_subgroup),
            "medication_exposure": asdict(report.medication_exposure),
            "all_created": report.all_created,
            "any_generated": report.any_generated,
        }
    }
    output_path.write_text(json.dumps(data, indent=2) + "\n")
    logger.info("Cohort report saved to %s", output_path)


def run_cohort_creation(
    source_id: int = DEFAULT_SOURCE_ID,
    skip_generate: bool = False,
) -> CohortReport:
    """Create all 3 cohort definitions and optionally generate them."""
    token = _get_auth_token()
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    })

    # Build and create definitions
    definitions = [
        ("all_rett", build_all_rett_definition()),
        ("seizure_subgroup", build_seizure_subgroup_definition()),
        ("medication_exposure", build_medication_subgroup_definition()),
    ]

    results: dict[str, CohortResult] = {}
    for key, payload in definitions:
        result = create_cohort_definition(session, payload)
        if not skip_generate:
            generate_cohort(session, result, source_id)
        results[key] = result

    # Poll for generation completion
    if not skip_generate:
        for key, result in results.items():
            check_generation_status(session, result)

    all_created = all(r.created for r in results.values())
    any_generated = any(r.generated for r in results.values())

    return CohortReport(
        all_rett=results["all_rett"],
        seizure_subgroup=results["seizure_subgroup"],
        medication_exposure=results["medication_exposure"],
        all_created=all_created,
        any_generated=any_generated,
    )


def main() -> int:
    """Create cohort definitions and produce report."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    config = ETLConfig()

    # Allow skipping generation via env var (useful when Horizon queue is not running)
    skip_generate = os.environ.get("SKIP_COHORT_GENERATE", "").lower() in ("1", "true", "yes")
    source_id = DEFAULT_SOURCE_ID

    report = run_cohort_creation(source_id=source_id, skip_generate=skip_generate)
    save_report(report, config.reports_dir / "cohort_definitions_report.json")

    if report.all_created:
        logger.info("All 3 cohort definitions created successfully")
        return 0
    else:
        logger.warning("Some cohort definitions failed to create — review report")
        return 1


if __name__ == "__main__":
    sys.exit(main())
