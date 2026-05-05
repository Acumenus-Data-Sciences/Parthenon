"""SQLAlchemy MetaData factory for OMOP CDM versions.

The plan called for ``pyomop.cdm54.cdm54.Base`` and ``pyomop.cdm53.cdm53.Base``
imports, but pyomop 4.3.0 (the version pinned in ``pyproject.toml``) only ships
CDM v6 declarative models under ``pyomop.cdm6_tables``. Phase 0's canonical
bootstrap path is the bundled DDL SQL files in ``runtime/cdm/migrations/``;
SQLAlchemy ``MetaData`` is a fallback used only when a SQL file is missing.

For the version-specific MetaData surface (which the catalog and tests query),
we re-export pyomop's CDM v6 metadata as a stand-in. The CDM v5.3, v5.4, and
v6 schemas overlap on the tables exercised by Phase 0 (``person``,
``visit_occurrence``, ``drug_exposure``, ``concept``); a real v5.3/v5.4
MetaData will land in Plan 4 alongside the actual templates.
"""

from __future__ import annotations

from typing import Final

from sqlalchemy import BigInteger, Column, ForeignKey, MetaData, String, Table
from sqlalchemy.sql.schema import MetaData as MetaDataType

SUPPORTED_CDM_VERSIONS: Final[tuple[str, ...]] = ("5.3", "5.4", "oncology_ext")


class Schema:
    """Factory for SQLAlchemy ``MetaData`` scoped to a CDM version."""

    @staticmethod
    def for_version(version: str) -> MetaDataType:
        if version not in SUPPORTED_CDM_VERSIONS:
            raise ValueError(
                f"unsupported CDM version {version!r}; expected one of {SUPPORTED_CDM_VERSIONS}"
            )
        if version in ("5.3", "5.4"):
            return _metadata_from_pyomop()
        if version == "oncology_ext":
            base = _metadata_from_pyomop()
            _attach_oncology_ext(base)
            return base
        raise AssertionError("unreachable")  # pragma: no cover


def _metadata_from_pyomop() -> MetaDataType:
    """Return a fresh copy of pyomop's bundled CDM MetaData.

    pyomop 4.3.0 exports a single ``MetaData`` for CDM v6. We copy tables into
    a fresh ``MetaData`` so callers can mutate (e.g. attach oncology tables)
    without affecting other consumers in the same process.
    """
    import pyomop

    src: MetaDataType = pyomop.metadata
    target = MetaData()
    for table in src.tables.values():
        table.to_metadata(target)
    return target


def _attach_oncology_ext(metadata: MetaDataType) -> None:
    """Add Oncology Extension tables (``episode``, ``episode_event``) to ``metadata``.

    The actual table definitions are bundled in ``migrations/oncology_ext.sql``;
    Phase 0 attaches placeholder ``Table`` objects so MetaData reflects the
    extension surface area for catalog purposes.
    """
    Table(
        "episode",
        metadata,
        Column("episode_id", BigInteger, primary_key=True),
        Column("person_id", BigInteger, nullable=False),
        Column("episode_concept_id", BigInteger, nullable=False),
        Column("episode_start_date", String, nullable=False),
        Column("episode_end_date", String, nullable=True),
        extend_existing=True,
    )
    Table(
        "episode_event",
        metadata,
        Column("episode_id", BigInteger, ForeignKey("episode.episode_id"), nullable=False),
        Column("event_id", BigInteger, nullable=False),
        Column("episode_event_field_concept_id", BigInteger, nullable=False),
        extend_existing=True,
    )
