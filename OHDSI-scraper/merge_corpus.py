#!/usr/bin/env python3
"""Merge high-quality OHDSI Papers + validated_oa_corpus into a single deduplicated directory.

Steps:
  1. Load 679 high-quality papers from ohdsi_papers_metadata.csv (crossref + existing_csv only)
  2. Load 345 papers from validated_oa_corpus/metadata/downloaded_paper_metadata.csv
  3. Deduplicate by DOI (prefer validated_oa_corpus when both exist — richer metadata)
  4. Copy all PDFs into OHDSI-scraper/corpus/pdfs/
  5. Write merged metadata to OHDSI-scraper/corpus/metadata.csv
"""
from __future__ import annotations

import csv
import re
import shutil
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
OHDSI_PAPERS_DIR = BASE_DIR / "OHDSI Papers"
OHDSI_META = BASE_DIR / "ohdsi_papers_metadata.csv"
VALIDATED_DIR = BASE_DIR / "validated_oa_corpus" / "pdfs"
VALIDATED_META = BASE_DIR / "validated_oa_corpus" / "metadata" / "downloaded_paper_metadata.csv"
EXCLUSIONS_CSV = BASE_DIR / "corpus_exclusions.csv"
OUTPUT_DIR = BASE_DIR / "corpus"
OUTPUT_PDFS = OUTPUT_DIR / "pdfs"
OUTPUT_CSV = OUTPUT_DIR / "metadata.csv"
QUARANTINE_CSV = OUTPUT_DIR / "quarantine.csv"

# Unified output columns — superset of both sources
OUTPUT_COLUMNS = [
    "DOI",
    "PMID",
    "PMCID",
    "Title",
    "Authors",
    "First Author",
    "Journal",
    "Publication Year",
    "Create Date",
    "Citation",
    "Source",
    "Metadata Source",
    "Source Provenance",
    "Trust Tier",
    "Gate Status",
    "Gate Reasons",
    "Primary Domain",
    "Category",
    "Topic Signals",
    "Filename",
    "File Size Bytes",
    "Page Count",
    "SHA256",
    "PDF Title",
    "PDF Author",
    "PDF Subject",
    "PDF Keywords",
]

_COVER_MATTER_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("cover_matter", re.compile(r"\bcover and back matter\b", re.IGNORECASE)),
    ("publication_information", re.compile(r"\bpublication information\b", re.IGNORECASE)),
    ("committee_notice", re.compile(r"\bofficers/committee\b", re.IGNORECASE)),
    ("correction_notice", re.compile(r"^correction to:", re.IGNORECASE)),
]

_OFF_DOMAIN_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "paleontology_or_geology",
        re.compile(
            r"\b(trilobit|cambrian|ordovician|ediacaran|acritarch|fossil|taphonomy|"
            r"geological magazine|journal of paleontology|paleobiology)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "robotics_or_mechanical_design",
        re.compile(
            r"\b(robot|robotics|articulated robots|origami-inspired|aerial vehicle|"
            r"bistable mechanism|mechanical design|icra)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "power_or_grid_systems",
        re.compile(
            r"\b(power systems|smart grid|power \& energy|ieee transactions on smart grid|"
            r"ieee power)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "phylogenetics_or_agricultural_biology",
        re.compile(
            r"\b(phylogenetic|phylogeograph|phylodynamic|agriseqdb|plant species|"
            r"lassa virus endemic area)\b",
            re.IGNORECASE,
        ),
    ),
]

_OHDSI_SIGNAL_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("ohdsi", re.compile(r"\bohdsi\b", re.IGNORECASE)),
    ("omop", re.compile(r"\bomop\b", re.IGNORECASE)),
    ("common_data_model", re.compile(r"\bcommon data model\b", re.IGNORECASE)),
    ("cdm", re.compile(r"\bcdm\b", re.IGNORECASE)),
    ("atlas", re.compile(r"\batlas\b", re.IGNORECASE)),
    ("hades", re.compile(r"\bhades\b", re.IGNORECASE)),
    ("achilles", re.compile(r"\bachilles\b", re.IGNORECASE)),
    ("phenotype", re.compile(r"\bphenotyp\w*\b", re.IGNORECASE)),
    ("cohort", re.compile(r"\bcohort\b", re.IGNORECASE)),
    ("vocabulary", re.compile(r"\bvocabular\w*\b", re.IGNORECASE)),
    ("ehr_or_claims", re.compile(r"\b(ehr|electronic health record|claims data?)\b", re.IGNORECASE)),
    ("real_world", re.compile(r"\breal[- ]world\b", re.IGNORECASE)),
    ("observational", re.compile(r"\bobservational\b", re.IGNORECASE)),
    ("data_harmonization", re.compile(r"\bdata harmonization\b", re.IGNORECASE)),
]

_PRIMARY_DOMAIN_RULES: list[tuple[str, list[re.Pattern[str]]]] = [
    (
        "patient-level-prediction",
        [
            re.compile(r"\bpatient-level prediction\b", re.IGNORECASE),
            re.compile(r"\bpredict(?:ion|ive|ing)?\b", re.IGNORECASE),
            re.compile(r"\brisk (?:model|score|calculator|prediction)\b", re.IGNORECASE),
            re.compile(r"\bprognostic\b", re.IGNORECASE),
            re.compile(r"\bmachine learning\b", re.IGNORECASE),
        ],
    ),
    (
        "vocabulary-mapping",
        [
            re.compile(r"\bvocabular\w*\b", re.IGNORECASE),
            re.compile(r"\bterminolog\w*\b", re.IGNORECASE),
            re.compile(r"\bconcept set\b", re.IGNORECASE),
            re.compile(r"\bmapping\b", re.IGNORECASE),
            re.compile(r"\b(rxnorm|snomed|loinc|icd-?\d*|atc)\b", re.IGNORECASE),
        ],
    ),
    (
        "genomics",
        [
            re.compile(r"\bgenom\w*\b", re.IGNORECASE),
            re.compile(r"\bvariant\w*\b", re.IGNORECASE),
            re.compile(r"\bsequence\w*\b", re.IGNORECASE),
            re.compile(r"\bbeacon\b", re.IGNORECASE),
            re.compile(r"\bmolecular\b", re.IGNORECASE),
            re.compile(r"\bgenetic\b", re.IGNORECASE),
        ],
    ),
    (
        "imaging",
        [
            re.compile(r"\bimaging\b", re.IGNORECASE),
            re.compile(r"\bimage\b", re.IGNORECASE),
            re.compile(r"\bdicom\b", re.IGNORECASE),
            re.compile(r"\bradiolog\w*\b", re.IGNORECASE),
        ],
    ),
    (
        "network-studies",
        [
            re.compile(r"\bnetwork stud(?:y|ies)\b", re.IGNORECASE),
            re.compile(r"\bdistributed\b", re.IGNORECASE),
            re.compile(r"\bfederated\b", re.IGNORECASE),
            re.compile(r"\bmulti-?database\b", re.IGNORECASE),
            re.compile(r"\bmultinational\b", re.IGNORECASE),
            re.compile(r"\bnetwork\b", re.IGNORECASE),
            re.compile(r"\bconsorti(?:um|a)\b", re.IGNORECASE),
            re.compile(r"\bcollaborat\w*\b", re.IGNORECASE),
            re.compile(r"\bmulti-site\b", re.IGNORECASE),
            re.compile(r"\bscientific community\b", re.IGNORECASE),
            re.compile(r"\bpublic artifacts\b", re.IGNORECASE),
            re.compile(r"\bnetworks of observational health care databases\b", re.IGNORECASE),
        ],
    ),
    (
        "data-quality",
        [
            re.compile(r"\bdata quality\b", re.IGNORECASE),
            re.compile(r"\bquality\b", re.IGNORECASE),
            re.compile(r"\bvalidation\b", re.IGNORECASE),
            re.compile(r"\breliability\b", re.IGNORECASE),
            re.compile(r"\bfidelity\b", re.IGNORECASE),
            re.compile(r"\bbenchmark\w*\b", re.IGNORECASE),
            re.compile(r"\bperformance characteristics\b", re.IGNORECASE),
        ],
    ),
    (
        "methods-statistics",
        [
            re.compile(r"\bpropensity\b", re.IGNORECASE),
            re.compile(r"\bcausal\b", re.IGNORECASE),
            re.compile(r"\bconfounding\b", re.IGNORECASE),
            re.compile(r"\bregression\b", re.IGNORECASE),
            re.compile(r"\bcalibration\b", re.IGNORECASE),
            re.compile(r"\bmethod(?:s)?\b", re.IGNORECASE),
            re.compile(r"\bstatistic(?:al|s)?\b", re.IGNORECASE),
            re.compile(r"\bbias\b", re.IGNORECASE),
            re.compile(r"\bsurveillance\b", re.IGNORECASE),
            re.compile(r"\bsignal detection\b", re.IGNORECASE),
            re.compile(r"\bdifference-in-differences\b", re.IGNORECASE),
            re.compile(r"\bsystematic review\b", re.IGNORECASE),
            re.compile(r"\btemporal analysis\b", re.IGNORECASE),
            re.compile(r"\btemporal pattern\b", re.IGNORECASE),
            re.compile(r"\belixhauser\b", re.IGNORECASE),
            re.compile(r"\bsignal analysis\b", re.IGNORECASE),
        ],
    ),
    (
        "ehr-data-infrastructure",
        [
            re.compile(r"\bcommon data model\b", re.IGNORECASE),
            re.compile(r"\bomop(?: |-)?cdm\b", re.IGNORECASE),
            re.compile(r"\bcdm\b", re.IGNORECASE),
            re.compile(r"\betl\b", re.IGNORECASE),
            re.compile(r"\bharmonization\b", re.IGNORECASE),
            re.compile(r"\bstandardization\b", re.IGNORECASE),
            re.compile(r"\binteroperability\b", re.IGNORECASE),
            re.compile(r"\bfhir\b", re.IGNORECASE),
            re.compile(r"\belectronic health record\b", re.IGNORECASE),
            re.compile(r"\behr\b", re.IGNORECASE),
            re.compile(r"\binfrastructure\b", re.IGNORECASE),
            re.compile(r"\bfair\b", re.IGNORECASE),
            re.compile(r"\bmetadata\b", re.IGNORECASE),
            re.compile(r"\bcommon data elements?\b", re.IGNORECASE),
            re.compile(r"\bdata standards?\b", re.IGNORECASE),
            re.compile(r"\bdata warehouse\b", re.IGNORECASE),
            re.compile(r"\bdata warehouses\b", re.IGNORECASE),
            re.compile(r"\bdata resource\b", re.IGNORECASE),
            re.compile(r"\bdata reuse\b", re.IGNORECASE),
            re.compile(r"\bhealth data space\b", re.IGNORECASE),
            re.compile(r"\bmachine-readable\b", re.IGNORECASE),
            re.compile(r"\bimplement(?:ing|ation)\b", re.IGNORECASE),
            re.compile(r"\bachilles\b", re.IGNORECASE),
            re.compile(r"\bohdsireportgenerator\b", re.IGNORECASE),
            re.compile(r"\bohdsishinyappbuilder\b", re.IGNORECASE),
            re.compile(r"\bdatahub\b", re.IGNORECASE),
            re.compile(r"\bontologizing\b", re.IGNORECASE),
            re.compile(r"\bweb services\b", re.IGNORECASE),
            re.compile(r"\bcommon data models\b", re.IGNORECASE),
            re.compile(r"\bcommon standard\b", re.IGNORECASE),
            re.compile(r"\bextract, transform, load\b", re.IGNORECASE),
            re.compile(r"\belectronic health records\b", re.IGNORECASE),
            re.compile(r"\badministrative databases\b", re.IGNORECASE),
            re.compile(r"\bhealth systems\b", re.IGNORECASE),
            re.compile(r"\bdata extraction and management\b", re.IGNORECASE),
        ],
    ),
    (
        "clinical-applications",
        [
            re.compile(r"\bcohort\b", re.IGNORECASE),
            re.compile(r"\bpatients?\b", re.IGNORECASE),
            re.compile(r"\btreatment\b", re.IGNORECASE),
            re.compile(r"\bdisease\b", re.IGNORECASE),
            re.compile(r"\bcancer\b", re.IGNORECASE),
            re.compile(r"\bdrug\b", re.IGNORECASE),
            re.compile(r"\bclinical\b", re.IGNORECASE),
            re.compile(r"\bcovid-19\b", re.IGNORECASE),
            re.compile(r"\blong covid\b", re.IGNORECASE),
            re.compile(r"\bphenotyp\w*\b", re.IGNORECASE),
            re.compile(r"\bdiagnos\w*\b", re.IGNORECASE),
            re.compile(r"\bscreening\b", re.IGNORECASE),
            re.compile(r"\bpregnan\w*\b", re.IGNORECASE),
            re.compile(r"\bdementia\b", re.IGNORECASE),
            re.compile(r"\bdepression\b", re.IGNORECASE),
            re.compile(r"\bosteoporosis\b", re.IGNORECASE),
            re.compile(r"\bhiv\b", re.IGNORECASE),
            re.compile(r"\bcomparative effectiveness\b", re.IGNORECASE),
            re.compile(r"\breal[- ]world\b", re.IGNORECASE),
            re.compile(r"\bhearing health\b", re.IGNORECASE),
            re.compile(r"\bgenetic diseases?\b", re.IGNORECASE),
            re.compile(r"\becg\b", re.IGNORECASE),
            re.compile(r"\belectrocardiogram\w*\b", re.IGNORECASE),
            re.compile(r"\bstandards of care\b", re.IGNORECASE),
            re.compile(r"\bpain\b", re.IGNORECASE),
            re.compile(r"\bmetabolic syndrome\b", re.IGNORECASE),
            re.compile(r"\bprevalence\b", re.IGNORECASE),
        ],
    ),
]

_PRIMARY_DOMAIN_PRIORITY = {
    "patient-level-prediction": 9,
    "vocabulary-mapping": 8,
    "genomics": 8,
    "imaging": 8,
    "methods-statistics": 7,
    "ehr-data-infrastructure": 6,
    "network-studies": 5,
    "data-quality": 4,
    "clinical-applications": 3,
}

_CATEGORY_RULES: list[tuple[str, str, list[re.Pattern[str]]]] = [
    (
        "patient-level-prediction",
        "external-validation",
        [
            re.compile(r"\bexternal(?:ly)? validat\w*\b", re.IGNORECASE),
            re.compile(r"\btransportab\w*\b", re.IGNORECASE),
        ],
    ),
    (
        "patient-level-prediction",
        "risk-prediction",
        [
            re.compile(r"\brisk (?:model|score|calculator|prediction)\b", re.IGNORECASE),
            re.compile(r"\bmortality\b", re.IGNORECASE),
            re.compile(r"\bpredict(?:ion|ive|ing)?\b", re.IGNORECASE),
        ],
    ),
    (
        "methods-statistics",
        "causal-inference",
        [
            re.compile(r"\bcausal\b", re.IGNORECASE),
            re.compile(r"\bpropensity\b", re.IGNORECASE),
            re.compile(r"\bconfounding\b", re.IGNORECASE),
            re.compile(r"\bcomparative effectiveness\b", re.IGNORECASE),
        ],
    ),
    (
        "methods-statistics",
        "statistical-methods",
        [
            re.compile(r"\bregression\b", re.IGNORECASE),
            re.compile(r"\bcalibration\b", re.IGNORECASE),
            re.compile(r"\bbias\b", re.IGNORECASE),
            re.compile(r"\bstatistic(?:al|s)?\b", re.IGNORECASE),
        ],
    ),
    (
        "vocabulary-mapping",
        "concept-mapping",
        [
            re.compile(r"\bmapping\b", re.IGNORECASE),
            re.compile(r"\bmap(?:s|ping)?\b", re.IGNORECASE),
            re.compile(r"\bconcept set\b", re.IGNORECASE),
        ],
    ),
    (
        "vocabulary-mapping",
        "standardized-vocabularies",
        [
            re.compile(r"\bvocabular\w*\b", re.IGNORECASE),
            re.compile(r"\bterminolog\w*\b", re.IGNORECASE),
            re.compile(r"\b(rxnorm|snomed|loinc|icd-?\d*|atc)\b", re.IGNORECASE),
        ],
    ),
    (
        "genomics",
        "genomic-interoperability",
        [
            re.compile(r"\bbeacon\b", re.IGNORECASE),
            re.compile(r"\binteroperab\w*\b", re.IGNORECASE),
            re.compile(r"\bcommon data model\b", re.IGNORECASE),
        ],
    ),
    (
        "genomics",
        "variant-analysis",
        [
            re.compile(r"\bvariant\w*\b", re.IGNORECASE),
            re.compile(r"\bsequence\w*\b", re.IGNORECASE),
            re.compile(r"\bmolecular\b", re.IGNORECASE),
        ],
    ),
    (
        "imaging",
        "medical-imaging",
        [
            re.compile(r"\bimaging\b", re.IGNORECASE),
            re.compile(r"\bdicom\b", re.IGNORECASE),
            re.compile(r"\bradiolog\w*\b", re.IGNORECASE),
        ],
    ),
    (
        "network-studies",
        "distributed-research-networks",
        [
            re.compile(r"\bdistributed\b", re.IGNORECASE),
            re.compile(r"\bfederated\b", re.IGNORECASE),
            re.compile(r"\bnetwork\b", re.IGNORECASE),
            re.compile(r"\bmulti-?database\b", re.IGNORECASE),
            re.compile(r"\bcommunity\b", re.IGNORECASE),
            re.compile(r"\bpublic artifacts\b", re.IGNORECASE),
        ],
    ),
    (
        "network-studies",
        "multinational-cohorts",
        [
            re.compile(r"\bmultinational\b", re.IGNORECASE),
            re.compile(r"\binternational\b", re.IGNORECASE),
            re.compile(r"\bseven countries\b", re.IGNORECASE),
        ],
    ),
    (
        "data-quality",
        "quality-assessment",
        [
            re.compile(r"\bquality\b", re.IGNORECASE),
            re.compile(r"\breliability\b", re.IGNORECASE),
            re.compile(r"\bfidelity\b", re.IGNORECASE),
            re.compile(r"\bbenchmark\w*\b", re.IGNORECASE),
        ],
    ),
    (
        "data-quality",
        "validation",
        [
            re.compile(r"\bvalidation\b", re.IGNORECASE),
            re.compile(r"\bvalidat\w*\b", re.IGNORECASE),
        ],
    ),
    (
        "ehr-data-infrastructure",
        "research-infrastructure",
        [
            re.compile(r"\binfrastructure\b", re.IGNORECASE),
            re.compile(r"\bdata warehouse\b", re.IGNORECASE),
            re.compile(r"\bdatahub\b", re.IGNORECASE),
            re.compile(r"\btools?\b", re.IGNORECASE),
            re.compile(r"\bachilles\b", re.IGNORECASE),
            re.compile(r"\bohdsireportgenerator\b", re.IGNORECASE),
            re.compile(r"\bohdsishinyappbuilder\b", re.IGNORECASE),
        ],
    ),
    (
        "ehr-data-infrastructure",
        "omop-cdm",
        [
            re.compile(r"\bcommon data model\b", re.IGNORECASE),
            re.compile(r"\bomop(?: |-)?cdm\b", re.IGNORECASE),
            re.compile(r"\bcdm\b", re.IGNORECASE),
        ],
    ),
    (
        "ehr-data-infrastructure",
        "metadata-governance",
        [
            re.compile(r"\bfair\b", re.IGNORECASE),
            re.compile(r"\bmetadata\b", re.IGNORECASE),
            re.compile(r"\bcommon data elements?\b", re.IGNORECASE),
            re.compile(r"\bdata standards?\b", re.IGNORECASE),
            re.compile(r"\bmachine-readable\b", re.IGNORECASE),
            re.compile(r"\bhealth data space\b", re.IGNORECASE),
        ],
    ),
    (
        "ehr-data-infrastructure",
        "etl-standardization",
        [
            re.compile(r"\betl\b", re.IGNORECASE),
            re.compile(r"\bharmonization\b", re.IGNORECASE),
            re.compile(r"\bstandardization\b", re.IGNORECASE),
        ],
    ),
    (
        "ehr-data-infrastructure",
        "ehr-interoperability",
        [
            re.compile(r"\belectronic health record\b", re.IGNORECASE),
            re.compile(r"\behr\b", re.IGNORECASE),
            re.compile(r"\bfhir\b", re.IGNORECASE),
            re.compile(r"\binteroperability\b", re.IGNORECASE),
        ],
    ),
    (
        "clinical-applications",
        "phenotyping",
        [
            re.compile(r"\bphenotyp\w*\b", re.IGNORECASE),
            re.compile(r"\bcase adjudication\b", re.IGNORECASE),
            re.compile(r"\bnatural language processing\b", re.IGNORECASE),
            re.compile(r"\btemporal events detector\b", re.IGNORECASE),
        ],
    ),
    (
        "clinical-applications",
        "drug-safety",
        [
            re.compile(r"\badverse drug\b", re.IGNORECASE),
            re.compile(r"\bsafety\b", re.IGNORECASE),
            re.compile(r"\bsignal assessment\b", re.IGNORECASE),
        ],
    ),
    (
        "clinical-applications",
        "comparative-effectiveness",
        [
            re.compile(r"\bcomparative effectiveness\b", re.IGNORECASE),
            re.compile(r"\bexternal comparator\b", re.IGNORECASE),
            re.compile(r"\btreatment pathways?\b", re.IGNORECASE),
        ],
    ),
    (
        "clinical-applications",
        "disease-application",
        [
            re.compile(r"\bcancer\b", re.IGNORECASE),
            re.compile(r"\bcovid-19\b", re.IGNORECASE),
            re.compile(r"\bdiabetes\b", re.IGNORECASE),
            re.compile(r"\bkidney\b", re.IGNORECASE),
            re.compile(r"\bdepression\b", re.IGNORECASE),
            re.compile(r"\bglaucoma\b", re.IGNORECASE),
        ],
    ),
]


def normalize_doi(doi: str) -> str:
    """Lowercase, strip whitespace."""
    return doi.strip().lower()


def _joined_record_text(record: dict[str, str]) -> str:
    return " ".join(
        value
        for key in ("Title", "Journal", "Citation", "PDF Title", "PDF Subject", "PDF Keywords")
        if (value := str(record.get(key, "")).strip())
    )


def enrich_topic_metadata(record: dict[str, str]) -> tuple[str, str, str]:
    """Derive broad domain, narrower category, and supporting signal labels."""
    blob = _joined_record_text(record)
    matched_domains: list[tuple[str, int]] = []
    domain_signals: dict[str, list[str]] = {}

    for domain, patterns in _PRIMARY_DOMAIN_RULES:
        matches = [
            pattern.pattern
            for pattern in patterns
            if pattern.search(blob)
        ]
        if matches:
            matched_domains.append((domain, len(matches)))
            domain_signals[domain] = matches

    primary_domain = ""
    if matched_domains:
        matched_domains.sort(
            key=lambda item: (
                -_PRIMARY_DOMAIN_PRIORITY.get(item[0], 0),
                -item[1],
                item[0],
            )
        )
        primary_domain = matched_domains[0][0]

    category = ""
    category_signals: list[str] = []
    if primary_domain:
        for domain, candidate_category, patterns in _CATEGORY_RULES:
            if domain != primary_domain:
                continue
            matches = [
                pattern.pattern
                for pattern in patterns
                if pattern.search(blob)
            ]
            if matches:
                category = candidate_category
                category_signals = matches
                break

    if not category and primary_domain:
        category = primary_domain

    if not primary_domain:
        ohdsi_signals = [signal for signal, pattern in _OHDSI_SIGNAL_PATTERNS if pattern.search(blob)]
        if {"omop", "common_data_model", "cdm"} & set(ohdsi_signals):
            primary_domain = "ehr-data-infrastructure"
            category = "omop-cdm"
        elif {"cohort", "real_world", "observational"} & set(ohdsi_signals):
            primary_domain = "clinical-applications"
            category = "clinical-applications"
        elif ohdsi_signals:
            primary_domain = "network-studies"
            category = "distributed-research-networks"

    signals = [
        primary_domain,
        category if category and category != primary_domain else "",
        *[signal for signal, _pattern in _OHDSI_SIGNAL_PATTERNS if _pattern.search(blob)],
    ]
    topic_signals = "; ".join(dict.fromkeys(signal for signal in signals if signal))
    return primary_domain, category, topic_signals


def gate_record(record: dict[str, str]) -> tuple[str, str, str]:
    """Classify one merged record as allow/quarantine/reject with reasons and trust tier."""
    source = record.get("Source", "")
    metadata_source = record.get("Metadata Source", "")
    blob = _joined_record_text(record)

    cover_reasons = [label for label, pattern in _COVER_MATTER_PATTERNS if pattern.search(blob)]
    if cover_reasons:
        return "reject", "; ".join(cover_reasons), "blocked"

    if source in {"validated_oa_corpus", "both"}:
        return "allow", "trusted_curated_source", "high"

    if metadata_source == "existing_csv":
        return "allow", "trusted_seed_bibliography", "high"

    if metadata_source != "crossref":
        return "quarantine", "untrusted_metadata_source", "low"

    off_domain_reasons = [label for label, pattern in _OFF_DOMAIN_PATTERNS if pattern.search(blob)]
    if off_domain_reasons:
        return "reject", "; ".join(off_domain_reasons), "blocked"

    signal_reasons = [label for label, pattern in _OHDSI_SIGNAL_PATTERNS if pattern.search(blob)]
    if signal_reasons:
        return "allow", "; ".join(signal_reasons[:4]), "medium"

    return "quarantine", "crossref_without_ohdsi_signal", "low"


def load_exclusions() -> set[str]:
    """Load DOI exclusions for records we intentionally keep out of the merged corpus."""
    if not EXCLUSIONS_CSV.exists():
        return set()
    excluded: set[str] = set()
    with EXCLUSIONS_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            doi = normalize_doi(row.get("DOI", ""))
            if doi:
                excluded.add(doi)
    return excluded


def load_ohdsi_papers() -> dict[str, dict[str, str]]:
    """Load high-quality papers from ohdsi_papers_metadata.csv, keyed by DOI."""
    papers: dict[str, dict[str, str]] = {}
    with OHDSI_META.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # Only keep crossref and existing_csv sources
            if row.get("Metadata Source") not in ("crossref", "existing_csv"):
                continue
            doi = normalize_doi(row.get("DOI", ""))
            if not doi:
                continue
            papers[doi] = {
                "DOI": row.get("DOI", ""),
                "PMID": row.get("PMID", ""),
                "PMCID": row.get("PMCID", ""),
                "Title": row.get("Title", ""),
                "Authors": row.get("Authors", ""),
                "First Author": row.get("First Author", ""),
                "Journal": row.get("Journal", ""),
                "Publication Year": row.get("Publication Year", ""),
                "Create Date": row.get("Create Date", ""),
                "Citation": row.get("Citation", ""),
                "Source": f"ohdsi_papers ({row.get('Metadata Source', '')})",
                "Metadata Source": row.get("Metadata Source", ""),
                "Source Provenance": (
                    "seed_bibliography" if row.get("Metadata Source") == "existing_csv" else "crossref_backfill"
                ),
                "Trust Tier": "",
                "Gate Status": "",
                "Gate Reasons": "",
                "Primary Domain": "",
                "Category": "",
                "Topic Signals": "",
                "Filename": row.get("Filename", ""),
                "File Size Bytes": row.get("File Size Bytes", ""),
                "Page Count": row.get("Page Count", ""),
                "SHA256": row.get("SHA256", ""),
                "PDF Title": row.get("PDF Title", ""),
                "PDF Author": row.get("PDF Author", ""),
                "PDF Subject": row.get("PDF Subject", ""),
                "PDF Keywords": row.get("PDF Keywords", ""),
                "_pdf_path": str(OHDSI_PAPERS_DIR / row.get("Filename", "")),
            }
    return papers


def load_validated_corpus() -> dict[str, dict[str, str]]:
    """Load validated_oa_corpus papers, keyed by DOI."""
    papers: dict[str, dict[str, str]] = {}
    with VALIDATED_META.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            doi = normalize_doi(row.get("DOI", ""))
            if not doi:
                continue
            pdf_path = row.get("PDF Path", "")
            filename = Path(pdf_path).name if pdf_path else ""
            papers[doi] = {
                "DOI": row.get("DOI", ""),
                "PMID": row.get("PMID", ""),
                "PMCID": row.get("PMCID", ""),
                "Title": row.get("Title", ""),
                "Authors": row.get("Authors", ""),
                "First Author": row.get("First Author", ""),
                "Journal": row.get("Journal/Book", ""),
                "Publication Year": row.get("Publication Year", ""),
                "Create Date": row.get("Create Date", ""),
                "Citation": "",
                "Source": "validated_oa_corpus",
                "Metadata Source": "validated_manifest",
                "Source Provenance": "validated_oa_corpus",
                "Trust Tier": "",
                "Gate Status": "",
                "Gate Reasons": "",
                "Primary Domain": "",
                "Category": "",
                "Topic Signals": "",
                "Filename": filename,
                "File Size Bytes": row.get("File Size Bytes", ""),
                "Page Count": row.get("Page Count", ""),
                "SHA256": row.get("SHA256", ""),
                "PDF Title": row.get("PDF Title", ""),
                "PDF Author": row.get("PDF Author", ""),
                "PDF Subject": row.get("PDF Subject", ""),
                "PDF Keywords": row.get("PDF Keywords", ""),
                "_pdf_path": pdf_path,
            }
    return papers


def main() -> int:
    # Load both sources
    exclusions = load_exclusions()
    ohdsi_all = load_ohdsi_papers()
    validated_all = load_validated_corpus()
    ohdsi = {doi: record for doi, record in ohdsi_all.items() if doi not in exclusions}
    validated = {doi: record for doi, record in validated_all.items() if doi not in exclusions}
    print(f"OHDSI Papers (high-quality): {len(ohdsi)}")
    print(f"Validated OA Corpus: {len(validated)}")
    print(f"Excluded DOIs: {len(exclusions)}")

    # Merge — validated wins on duplicates (richer metadata with PMID/PMCID)
    merged: dict[str, dict[str, str]] = {}

    # Start with OHDSI papers
    for doi, record in ohdsi.items():
        merged[doi] = record

    # Overlay validated corpus — overwrites duplicates, adds new
    dupes = 0
    new_from_validated = 0
    for doi, record in validated.items():
        if doi in merged:
            # Validated has richer metadata — prefer it, but keep OHDSI fields if validated is empty
            ohdsi_rec = merged[doi]
            for col in OUTPUT_COLUMNS:
                if not record.get(col) and ohdsi_rec.get(col):
                    record[col] = ohdsi_rec[col]
            record["Source"] = "both"
            record["Source Provenance"] = "validated_oa_corpus;merged_with_ohdsi_papers"
            record["Metadata Source"] = "validated_manifest"
            dupes += 1
        else:
            new_from_validated += 1
        merged[doi] = record

    print(f"\nDeduplication:")
    print(f"  Duplicates (same DOI in both): {dupes}")
    print(f"  Unique from OHDSI Papers: {len(ohdsi) - dupes}")
    print(f"  Unique from Validated Corpus: {new_from_validated}")
    print(f"  Total merged: {len(merged)}")

    allowed: dict[str, dict[str, str]] = {}
    quarantined: list[dict[str, str]] = []
    gate_counts: dict[str, int] = {"allow": 0, "quarantine": 0, "reject": 0}
    for doi, record in merged.items():
        gate_status, gate_reasons, trust_tier = gate_record(record)
        primary_domain, category, topic_signals = enrich_topic_metadata(record)
        record["Gate Status"] = gate_status
        record["Gate Reasons"] = gate_reasons
        record["Trust Tier"] = trust_tier
        record["Primary Domain"] = primary_domain
        record["Category"] = category
        record["Topic Signals"] = topic_signals
        gate_counts[gate_status] = gate_counts.get(gate_status, 0) + 1
        if gate_status == "allow":
            allowed[doi] = record
        else:
            quarantined.append({col: record.get(col, "") for col in OUTPUT_COLUMNS})

    print(f"\nGate results:")
    print(f"  Allowed: {gate_counts['allow']}")
    print(f"  Quarantined: {gate_counts['quarantine']}")
    print(f"  Rejected: {gate_counts['reject']}")

    # Create output directory
    OUTPUT_PDFS.mkdir(parents=True, exist_ok=True)

    expected_filenames = {
        Path(record.get("_pdf_path", "")).name
        for record in allowed.values()
        if record.get("_pdf_path")
    }
    removed = 0
    for existing_pdf in OUTPUT_PDFS.glob("*.pdf"):
        if existing_pdf.name in expected_filenames:
            continue
        existing_pdf.unlink()
        removed += 1

    # Copy PDFs and write CSV
    copied = 0
    missing = 0
    rows: list[dict[str, str]] = []

    for doi in sorted(allowed.keys()):
        record = allowed[doi]
        src_path = Path(record.get("_pdf_path", ""))

        if src_path.exists():
            dest = OUTPUT_PDFS / src_path.name
            if not dest.exists():
                shutil.copy2(src_path, dest)
            record["Filename"] = src_path.name
            copied += 1
        else:
            missing += 1
            print(f"  WARNING: PDF not found: {src_path}", file=sys.stderr)

        # Build output row (exclude internal _pdf_path)
        row = {col: record.get(col, "") for col in OUTPUT_COLUMNS}
        rows.append(row)

    # Write metadata CSV
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    with QUARANTINE_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(quarantined)

    print(f"\nOutput:")
    print(f"  PDFs copied: {copied}")
    print(f"  PDFs removed: {removed}")
    print(f"  PDFs missing: {missing}")
    print(f"  Metadata rows: {len(rows)}")
    print(f"  Quarantine rows: {len(quarantined)}")
    print(f"  Directory: {OUTPUT_DIR}")
    print(f"  CSV: {OUTPUT_CSV}")
    print(f"  Quarantine CSV: {QUARANTINE_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
