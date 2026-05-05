"""FhirResourceNode: NDJSON streaming path."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import polars as pl
import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.fhir_resource import FhirResourceNode


def _write_ndjson(path: Path, resources: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in resources:
            f.write(json.dumps(r) + "\n")


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-fhir",
        node_id="fhir-1",
        logger=logging.getLogger("test.fhir"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert FhirResourceNode.type_name == "fhir_resource"


def test_streams_ndjson_to_parquet(context: NodeContext, tmp_path: Path) -> None:
    """Read a directory of NDJSON files, emit one Parquet artifact per resource type."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    _write_ndjson(
        bulk_dir / "Patient.ndjson",
        [
            {"resourceType": "Patient", "id": "p1", "gender": "male"},
            {"resourceType": "Patient", "id": "p2", "gender": "female"},
        ],
    )
    _write_ndjson(
        bulk_dir / "Observation.ndjson",
        [
            {"resourceType": "Observation", "id": "o1", "status": "final"},
        ],
    )

    result = FhirResourceNode().run(
        context,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
        },
    )
    assert result.status == NodeStatus.SUCCESS

    patient_parquet = tmp_path / "patient.parquet"
    obs_parquet = tmp_path / "observation.parquet"
    assert patient_parquet.exists()
    assert obs_parquet.exists()

    patients = pl.read_parquet(patient_parquet)
    assert patients.height == 2
    assert "id" in patients.columns
    assert set(patients["id"].to_list()) == {"p1", "p2"}


def test_skips_files_not_matching_profile(context: NodeContext, tmp_path: Path) -> None:
    """A resource type not in the chosen profile is skipped, not failed."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    _write_ndjson(
        bulk_dir / "Group.ndjson",
        [{"resourceType": "Group", "id": "g1"}],
    )
    _write_ndjson(
        bulk_dir / "Patient.ndjson",
        [{"resourceType": "Patient", "id": "p1"}],
    )

    result = FhirResourceNode().run(
        context,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
        },
    )
    assert result.status == NodeStatus.SUCCESS
    assert (tmp_path / "patient.parquet").exists()
    assert not (tmp_path / "group.parquet").exists()
    assert "Group" in result.outputs.get("skipped_resource_types", [])


def test_missing_ndjson_dir_fails(context: NodeContext) -> None:
    result = FhirResourceNode().run(
        context,
        {"source": "ndjson", "ndjson_dir": "/nonexistent/path", "profile": "us-core"},
    )
    assert result.status == NodeStatus.FAILED
    assert "ndjson_dir" in (result.error_message or "")


def test_unknown_profile_fails(context: NodeContext, tmp_path: Path) -> None:
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    result = FhirResourceNode().run(
        context,
        {"source": "ndjson", "ndjson_dir": str(bulk_dir), "profile": "made-up"},
    )
    assert result.status == NodeStatus.FAILED
    assert "profile" in (result.error_message or "")


def test_resource_with_unknown_profile_in_meta_fails_loudly(
    context: NodeContext, tmp_path: Path
) -> None:
    """Per spec Q3: meta.profile that doesn't match the run's profile pack -> FAILED."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    _write_ndjson(
        bulk_dir / "Patient.ndjson",
        [
            {
                "resourceType": "Patient",
                "id": "p1",
                "meta": {
                    "profile": ["http://hl7.org/fhir/us/davinci-pdex/StructureDefinition/Patient"]
                },
            }
        ],
    )
    result = FhirResourceNode().run(
        context,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
            "strict_profile_match": True,
        },
    )
    assert result.status == NodeStatus.FAILED
    assert "profile" in (result.error_message or "").lower()


def test_resource_without_meta_profile_is_accepted(context: NodeContext, tmp_path: Path) -> None:
    """A resource without meta.profile uses base FHIR semantics; no conflict possible."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    _write_ndjson(
        bulk_dir / "Patient.ndjson",
        [{"resourceType": "Patient", "id": "p1"}],  # no meta
    )
    result = FhirResourceNode().run(
        context,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
            "strict_profile_match": True,
        },
    )
    assert result.status == NodeStatus.SUCCESS
