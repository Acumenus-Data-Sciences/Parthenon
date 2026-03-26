"""Tests for pandera validation schemas."""

from io import StringIO

import pandas as pd
import pandera as pa
import pytest

from scripts.irsf_etl.schemas.person_characteristics import person_characteristics_schema
from scripts.irsf_etl.schemas.medications import medications_schema


class TestPersonCharacteristicsSchema:
    """Tests for Person_Characteristics pandera schema."""

    def test_validates_valid_sample_row(self, valid_person_csv: StringIO) -> None:
        """Schema validates a valid sample row with required columns."""
        df = pd.read_csv(valid_person_csv, dtype=str)
        validated = person_characteristics_schema.validate(df)
        assert len(validated) == 3

    def test_rejects_duplicate_participant_id(self, duplicate_person_csv: StringIO) -> None:
        """Schema rejects rows with duplicate participant_id."""
        df = pd.read_csv(duplicate_person_csv, dtype=str)
        with pytest.raises(pa.errors.SchemaError):
            person_characteristics_schema.validate(df)


class TestMedicationsSchema:
    """Tests for Medications pandera schema."""

    def test_validates_valid_medications_row(self, valid_medications_csv: StringIO) -> None:
        """Schema validates a valid sample row with MedRxNormCode."""
        df = pd.read_csv(valid_medications_csv, dtype=str)
        validated = medications_schema.validate(df)
        assert len(validated) == 3
