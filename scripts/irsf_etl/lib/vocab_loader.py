"""Database loader for IRSF-NHS custom vocabulary into OMOP CDM.

Provides VocabularyLoader class that performs idempotent (DELETE + INSERT)
loading of vocabulary, concept, and source_to_concept_map records into
PostgreSQL via psycopg2 with parameterized queries.

All operations occur within a single transaction for all-or-nothing consistency.
No credentials are stored in source code -- connection params passed at runtime.
"""

from __future__ import annotations

import logging

import psycopg2

from scripts.irsf_etl.lib.irsf_vocabulary import (
    SNOMED_MAPPINGS,
    IrsfVocabulary,
)

logger = logging.getLogger(__name__)


class VocabularyLoader:
    """Idempotent loader for IRSF-NHS custom vocabulary into PostgreSQL.

    Usage::

        loader = VocabularyLoader({
            "host": "localhost",
            "dbname": "parthenon",
            "user": "parthenon",
            "password": os.environ["DB_PASSWORD"],
            "options": "-c search_path=omop",
        })
        summary = loader.load_all()
        print(summary)  # {"vocabulary": 1, "concepts": 117, "source_to_concept_map": 121}
        loader.close()
    """

    def __init__(self, connection_params: dict[str, str]) -> None:
        """Connect to PostgreSQL with the given parameters.

        Args:
            connection_params: Dict passed to psycopg2.connect() as keyword args.
                Must NOT contain credentials in source code -- pass at runtime.
        """
        self._conn = psycopg2.connect(**connection_params)
        self._conn.autocommit = False

    def load_all(self) -> dict[str, int]:
        """Load vocabulary, concepts, and source_to_concept_map into the database.

        Performs DELETE + INSERT within a single transaction for idempotency.
        On success, commits and returns a summary dict with row counts.
        On failure, rolls back and re-raises the exception.

        Returns:
            Dict with keys: vocabulary, concepts, source_to_concept_map (row counts).
        """
        cursor = self._conn.cursor()
        try:
            self._delete_existing(cursor)
            vocab_count = self._insert_vocabulary(cursor)
            concept_count = self._insert_concepts(cursor)
            stcm_count = self._insert_source_mappings(cursor)
            self._conn.commit()
            summary = {
                "vocabulary": vocab_count,
                "concepts": concept_count,
                "source_to_concept_map": stcm_count,
            }
            logger.info("Loaded IRSF-NHS vocabulary: %s", summary)
            return summary
        except Exception:
            self._conn.rollback()
            logger.exception("Failed to load IRSF-NHS vocabulary, rolled back")
            raise
        finally:
            cursor.close()

    def _delete_existing(self, cursor: psycopg2.extensions.cursor) -> None:
        """Delete all existing IRSF-NHS entries (reverse dependency order)."""
        cursor.execute(
            "DELETE FROM source_to_concept_map WHERE source_vocabulary_id = %s",
            ("IRSF-NHS",),
        )
        logger.debug("Deleted existing source_to_concept_map rows")

        cursor.execute(
            "DELETE FROM concept WHERE vocabulary_id = %s",
            ("IRSF-NHS",),
        )
        logger.debug("Deleted existing concept rows")

        cursor.execute(
            "DELETE FROM vocabulary WHERE vocabulary_id = %s",
            ("IRSF-NHS",),
        )
        logger.debug("Deleted existing vocabulary rows")

    def _insert_vocabulary(self, cursor: psycopg2.extensions.cursor) -> int:
        """Insert the IRSF-NHS vocabulary registration row."""
        cursor.execute(
            "INSERT INTO vocabulary "
            "(vocabulary_id, vocabulary_name, vocabulary_reference, "
            "vocabulary_version, vocabulary_concept_id) "
            "VALUES (%s, %s, %s, %s, %s)",
            (
                IrsfVocabulary.VOCABULARY_ID,
                IrsfVocabulary.VOCABULARY_NAME,
                IrsfVocabulary.VOCABULARY_REFERENCE,
                IrsfVocabulary.VOCABULARY_VERSION,
                IrsfVocabulary.vocabulary_concept_id,
            ),
        )
        logger.debug("Inserted vocabulary row")
        return 1

    def _insert_concepts(self, cursor: psycopg2.extensions.cursor) -> int:
        """Insert all 117 custom concept rows via executemany."""
        rows = [
            (
                c.concept_id,
                c.concept_name,
                c.domain_id,
                c.vocabulary_id,
                c.concept_class_id,
                c.standard_concept,
                c.concept_code,
                "1970-01-01",
                "2099-12-31",
                None,  # invalid_reason
            )
            for c in IrsfVocabulary.all_concepts()
        ]
        cursor.executemany(
            "INSERT INTO concept "
            "(concept_id, concept_name, domain_id, vocabulary_id, "
            "concept_class_id, standard_concept, concept_code, "
            "valid_start_date, valid_end_date, invalid_reason) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            rows,
        )
        logger.debug("Inserted %d concept rows", len(rows))
        return len(rows)

    def _insert_source_mappings(self, cursor: psycopg2.extensions.cursor) -> int:
        """Insert source_to_concept_map rows via executemany.

        Each concept gets one primary mapping. Diagnoses with SNOMED equivalents
        get an additional row targeting the standard SNOMED concept_id.
        """
        rows: list[tuple[str, int, str, str, int, str, str, str, str | None]] = []

        for concept in IrsfVocabulary.all_concepts():
            # Determine source_code
            if concept.source_column is not None:
                source_code = concept.source_column
            elif concept.source_value is not None:
                source_code = concept.source_value
            else:
                continue

            # Primary mapping: source -> custom concept
            rows.append((
                source_code,
                0,  # source_concept_id
                "IRSF-NHS",
                concept.concept_name,
                concept.concept_id,
                concept.vocabulary_id,
                "1970-01-01",
                "2099-12-31",
                None,  # invalid_reason
            ))

            # Dual mapping for diagnoses with SNOMED equivalents
            if concept.source_value is not None and concept.source_value in SNOMED_MAPPINGS:
                rows.append((
                    source_code,
                    0,
                    "IRSF-NHS",
                    concept.concept_name,
                    SNOMED_MAPPINGS[concept.source_value],
                    "SNOMED",
                    "1970-01-01",
                    "2099-12-31",
                    None,
                ))

        cursor.executemany(
            "INSERT INTO source_to_concept_map "
            "(source_code, source_concept_id, source_vocabulary_id, "
            "source_code_description, target_concept_id, target_vocabulary_id, "
            "valid_start_date, valid_end_date, invalid_reason) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            rows,
        )
        logger.debug("Inserted %d source_to_concept_map rows", len(rows))
        return len(rows)

    def close(self) -> None:
        """Close the database connection."""
        self._conn.close()
        logger.debug("Database connection closed")
