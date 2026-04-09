"""Tests for ingestion quality heuristics."""

from app.chroma.quality import audit_document


def test_audit_document_accepts_relevant_ohdsi_paper():
    result = audit_document(
        target_collection="ohdsi_papers",
        source_kind="pdf",
        source_id="paper.pdf",
        path="/tmp/paper.pdf",
        text=(
            "The OHDSI community used the OMOP common data model to define a cohort, "
            "standardize vocabulary mappings, and evaluate patient-level clinical outcomes. "
            "This observational healthcare study used EHR and claims data for phenotype validation. "
            "We compared standardized concept sets across sites, measured cohort incidence, "
            "and reviewed vocabulary harmonization for clinical drug exposure and condition occurrence. "
            "The analysis describes healthcare data quality, phenotype transportability, and "
            "federated OHDSI network methods for observational research using OMOP CDM. "
            "Investigators examined patient-level prediction workflows, network estimation, "
            "and transportability across healthcare systems using shared cohort definitions. "
            "The paper reports observational study diagnostics, standardized vocabulary curation, "
            "and concept-level review for phenotype reproducibility within the OHDSI community."
        ),
        metadata={
            "title": "OMOP cohort validation",
            "year": "2024",
            "doi": "10.1000/example",
            "authors": "Doe et al.",
            "journal": "JAMIA",
        },
    )

    assert result.disposition == "accept"


def test_audit_document_rejects_boilerplate_noise():
    result = audit_document(
        target_collection="ohdsi_papers",
        source_kind="pdf",
        source_id="junk.pdf",
        path="/tmp/junk.pdf",
        text=(
            "Copyright Elsevier. All rights reserved. doi:10.0000/junk\n"
            "Received for review January 2024. Correspondence to the department of medicine.\n"
            "!!!! #### $$$$ !!!! #### $$$$\n"
        ),
        metadata={"title": "", "year": "", "doi": ""},
    )

    assert result.disposition == "reject"
    assert any(reason.startswith("boilerplate") or reason.startswith("possible_boilerplate") for reason in result.reasons)


def test_audit_document_accepts_relevant_paper_with_references_and_acknowledgements():
    result = audit_document(
        target_collection="ohdsi_papers",
        source_kind="pdf",
        source_id="paper-with-refs.pdf",
        path="/tmp/paper-with-refs.pdf",
        text=(
            "The OHDSI network used the OMOP common data model for cohort definition and phenotype "
            "transportability across EHR and claims databases. This observational study evaluated "
            "patient-level outcome phenotypes, vocabulary harmonization, and real-world evidence "
            "generation across sites. Investigators compared concept sets, study diagnostics, "
            "cohort transportability, and measurement consistency across participating health systems. "
            "The manuscript describes standardized analytics, phenotype review workflows, and "
            "observational healthcare methods used for reproducible evidence generation in OMOP networks.\n\n"
            "Acknowledgements\n"
            "We thank the OHDSI community.\n\n"
            "References\n"
            "1. Prior OMOP paper.\n"
        ),
        metadata={
            "title": "OMOP phenotype transportability",
            "year": "2024",
            "doi": "10.1000/omop",
            "authors": "Doe et al.",
            "journal": "JAMIA",
        },
    )

    assert result.disposition == "accept"
    assert all(not reason.startswith("boilerplate") for reason in result.reasons)


def test_audit_document_rejects_wiki_source_missing_required_metadata():
    result = audit_document(
        target_collection="wiki_pages",
        source_kind="pdf",
        source_id="source.pdf",
        path="/tmp/source.pdf",
        text=(
            "This paper describes OHDSI methods for cohort definition and standardized clinical "
            "terminology across OMOP CDM sites."
        ),
        metadata={
            "title": "Useful paper",
            "doi": "",
            "authors": "",
            "journal": "JAMIA",
            "publication_year": "2024",
        },
    )

    assert result.disposition in {"review", "reject"}
    assert "doi" in result.missing_metadata
    assert "authors" in result.missing_metadata


def test_audit_document_reviews_low_quality_manifest_content():
    result = audit_document(
        target_collection="ohdsi_papers",
        source_kind="markdown",
        source_id="topic_123.md",
        path="/tmp/topic_123.md",
        text=(
            "# Installation issue\n\n"
            "A forum topic about package installation and OHDSI tooling in HADES and ATLAS.\n"
        ),
        metadata={
            "title": "Installation issue",
            "quality_score": 0.2,
        },
    )

    assert result.disposition in {"review", "reject"}
    assert any(reason.startswith("manifest_quality") for reason in result.reasons)
