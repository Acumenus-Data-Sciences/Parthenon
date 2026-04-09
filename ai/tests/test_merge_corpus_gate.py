"""Tests for the OHDSI paper merge gate."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def _load_merge_module():
    module_path = Path(__file__).resolve().parents[2] / "OHDSI-scraper" / "merge_corpus.py"
    spec = spec_from_file_location("merge_corpus", module_path)
    assert spec is not None
    assert spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_gate_record_allows_validated_source():
    merge_corpus = _load_merge_module()

    status, reasons, trust_tier = merge_corpus.gate_record(
        {
            "Title": "Feasibility and utility of applications of the common data model",
            "Journal": "JAMIA",
            "Source": "validated_oa_corpus",
            "Metadata Source": "validated_manifest",
        }
    )

    assert status == "allow"
    assert reasons == "trusted_curated_source"
    assert trust_tier == "high"


def test_gate_record_rejects_off_domain_crossref_paper():
    merge_corpus = _load_merge_module()

    status, reasons, trust_tier = merge_corpus.gate_record(
        {
            "Title": "Computational Robot Design and Customization",
            "Journal": "Robotica",
            "Source": "ohdsi_papers (crossref)",
            "Metadata Source": "crossref",
        }
    )

    assert status == "reject"
    assert "robotics_or_mechanical_design" in reasons
    assert trust_tier == "blocked"


def test_gate_record_quarantines_crossref_without_ohdsi_signal():
    merge_corpus = _load_merge_module()

    status, reasons, trust_tier = merge_corpus.gate_record(
        {
            "Title": "Characterization and clinical course of 1000 patients with COVID-19 in New York",
            "Journal": "medRxiv",
            "Source": "ohdsi_papers (crossref)",
            "Metadata Source": "crossref",
        }
    )

    assert status == "quarantine"
    assert reasons == "crossref_without_ohdsi_signal"
    assert trust_tier == "low"


def test_enrich_topic_metadata_classifies_prediction_paper():
    merge_corpus = _load_merge_module()

    primary_domain, category, topic_signals = merge_corpus.enrich_topic_metadata(
        {
            "Title": "A standardized analytics pipeline for reliable and rapid development and validation of prediction models using observational health data",
            "Journal": "JAMIA Open",
            "PDF Keywords": "prediction model, validation, observational health data",
        }
    )

    assert primary_domain == "patient-level-prediction"
    assert category == "risk-prediction"
    assert "patient-level-prediction" in topic_signals


def test_enrich_topic_metadata_classifies_vocabulary_paper():
    merge_corpus = _load_merge_module()

    primary_domain, category, topic_signals = merge_corpus.enrich_topic_metadata(
        {
            "Title": "ATC-to-RxNorm mappings - A comparison between OHDSI Standardized Vocabularies and UMLS Metathesaurus",
            "Journal": "J Biomed Inform",
            "PDF Keywords": "RxNorm, terminology, concept mapping",
        }
    )

    assert primary_domain == "vocabulary-mapping"
    assert category in {"concept-mapping", "standardized-vocabularies"}
    assert "vocabulary-mapping" in topic_signals
