"""Shared test fixtures for irsf-etl tests."""

from io import StringIO

import pandas as pd
import pytest


@pytest.fixture()
def valid_person_csv() -> StringIO:
    """Sample valid Person_Characteristics CSV data."""
    data = (
        "participant_id,participant_id5201,participant_id5211,"
        "ChildsDOB,ChildsGender,diagnosis,mutation\n"
        "P001,5201-001,5211-001,01/15/2010,Female,Rett Syndrome,MECP2\n"
        "P002,5201-002,,03/22/2008,Male,Rett Syndrome,CDKL5\n"
        "P003,,5211-003,12/01/2015,Female,Rett Syndrome,FOXG1\n"
    )
    return StringIO(data)


@pytest.fixture()
def duplicate_person_csv() -> StringIO:
    """Person_Characteristics CSV with duplicate participant_id."""
    data = (
        "participant_id,participant_id5201,participant_id5211,"
        "ChildsDOB,ChildsGender,diagnosis,mutation\n"
        "P001,5201-001,5211-001,01/15/2010,Female,Rett Syndrome,MECP2\n"
        "P001,5201-002,,03/22/2008,Male,Rett Syndrome,CDKL5\n"
    )
    return StringIO(data)


@pytest.fixture()
def valid_medications_csv() -> StringIO:
    """Sample valid Medications CSV data."""
    data = (
        "participant_id,MedName,MedRxNormCode\n"
        "P001,Levetiracetam,187832\n"
        "P001,Valproic Acid,11170\n"
        "P002,Carbamazepine,2002\n"
    )
    return StringIO(data)


@pytest.fixture()
def sample_csv_stringio() -> StringIO:
    """Simple CSV for csv_utils tests."""
    return StringIO("col_a,col_b\n1,hello\n2,world\n")


@pytest.fixture()
def split_date_columns() -> list[str]:
    """Columns containing known split-date patterns."""
    return [
        "participant_id",
        "ChildsDOBMonth",
        "ChildsDOBDay",
        "ChildsDOBYear",
        "DiagnosisDateMonth",
        "DiagnosisDateDay",
        "DiagnosisDateYear",
        "some_other_col",
    ]


@pytest.fixture()
def no_date_columns() -> list[str]:
    """Columns with no date patterns."""
    return ["participant_id", "name", "diagnosis", "mutation"]


@pytest.fixture()
def medications_with_dates() -> pd.DataFrame:
    """Medications-shaped DataFrame with split date columns (mixed valid/invalid)."""
    return pd.DataFrame(
        {
            "participant_id": ["P001", "P002", "P003"],
            "MedName": ["Levetiracetam", "Valproic Acid", "Carbamazepine"],
            "MedStartDateMonth": ["Jan", "Apr", None],
            "MedStartDateDay": [15, None, None],
            "MedStartDateYear": [2006, 2008, None],
        }
    )
