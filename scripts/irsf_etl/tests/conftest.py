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


@pytest.fixture()
def sample_logmasterform_csv() -> StringIO:
    """StringIO with representative LogMasterForm data."""
    data = (
        "participant_id,visit,visit_date\n"
        "1001,Baseline,12/13/16\n"
        "1001,1 year,12/10/17\n"
        "1002,Baseline,03/05/18\n"
        "1002,,06/15/18\n"
    )
    return StringIO(data)


@pytest.fixture()
def sample_hospitalizations_csv() -> StringIO:
    """StringIO with representative Hospitalizations data."""
    data = (
        "participant_id,visit_date,TypeOfVisit,MonthDateVisit,DayDateVisit,"
        "YearDateVisit,DateUnknown\n"
        "1001,11/07/16,Hospital,Sep,,2017,\n"
        "1001,11/07/16,ER,Jan,15,2018,\n"
        "1002,03/05/18,Hospital,,,,"
        "Yes\n"
    )
    return StringIO(data)


@pytest.fixture()
def sample_css_csv() -> StringIO:
    """StringIO with representative CSS data (3 patients, 2 visits, some null scores).

    Contains all 14 CSS score columns matching _CSS_CONCEPTS source_column values.
    Patient 1002 visit 2 has 2 null scores to test NULL filtering.
    """
    data = (
        "participant_id,participant_id5201,participant_id5211,visit,visit_date,"
        "TotalScore,AgeOfOnsetOfRegression,OnsetOfStereotypes,HeadGrowth,"
        "SomaticGrowthAtThisVisit,IndependentSittingAtThisVisitB,"
        "AmbulationAtThisVisitByExam,HandUse,Scoliosis,"
        "LanguageAtThisVisitByExam,NonverbalCommunicationAtThisVi,"
        "RespiratoryDysfunctionAtThisVi,AutonomicSymptomsAtThisVisitBy,"
        "EpilepsySeizuresAtThisVisit\n"
        "1001,1001,1001,Baseline,03/05/06,25,3,2,1,2,3,4,3,2,1,2,1,0,1\n"
        "1001,1001,1001,1 year,03/10/07,30,3,2,2,3,4,4,3,2,1,2,1,1,2\n"
        "1002,1002,1002,Baseline,06/15/08,20,2,1,1,1,2,3,2,1,1,1,1,1,2\n"
        "1002,1002,1002,1 year,06/20/09,22,2,1,1,2,3,3,,1,,1,1,1,3\n"
        "1003,1003,1003,Baseline,01/10/10,18,1,1,0,1,2,2,2,1,1,1,0,0,3\n"
        "1003,1003,1003,1 year,01/15/11,21,2,1,1,2,3,3,2,1,1,1,1,1,2\n"
    )
    return StringIO(data)


@pytest.fixture()
def sample_clinical_assessment_5201_csv() -> StringIO:
    """StringIO with representative 5201 ClinicalAssessment data."""
    data = (
        "Participant_ID,Local_ID,Visit,Visit_Date\n"
        "1003,010061,Baseline,03/04/2006\n"
        "1003,010061,12 months,03/05/2007\n"
        "1003,010061,PRN,03/04/2006\n"
    )
    return StringIO(data)
