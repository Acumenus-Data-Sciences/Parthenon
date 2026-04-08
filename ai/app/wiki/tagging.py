"""Controlled wiki taxonomy and metadata cleanup helpers."""

from __future__ import annotations

import html
import re
from collections import OrderedDict


PRIMARY_DOMAIN_DESCRIPTIONS: "OrderedDict[str, str]" = OrderedDict(
    [
        ("population-level-estimation", "Comparative effectiveness, drug safety studies, and large-scale estimation."),
        ("patient-level-prediction", "Predictive models, risk scores, and machine learning on clinical data."),
        ("characterization", "Descriptive studies, data profiling, prevalence, and source characterization."),
        ("data-quality", "Data quality assessment, validation, completeness, conformance, and plausibility."),
        ("vocabulary-mapping", "Terminology, concept mapping, vocabulary standards, SNOMED, RxNorm, and LOINC."),
        ("etl-cdm", "ETL workflows, common data model conversion, and data transformation."),
        ("methods-statistics", "Study design, calibration, causal inference, and statistical methodology."),
        ("network-studies", "Distributed, federated, or multi-site OHDSI network studies."),
        ("pharmacovigilance", "Drug safety surveillance, adverse events, and signal detection."),
        ("clinical-applications", "Disease-specific or clinical outcome studies."),
        ("infrastructure-tools", "OHDSI tools, software, Atlas, WebAPI, HADES, and packages."),
        ("policy-governance", "Privacy, governance, ethics, regulation, and policy."),
    ]
)

SECONDARY_TAG_GROUPS: "OrderedDict[str, tuple[str, ...]]" = OrderedDict(
    [
        (
            "disease",
            (
                "covid-19",
                "diabetes",
                "cardiovascular",
                "cancer",
                "respiratory",
                "neurological",
                "psychiatric",
                "renal",
                "gastrointestinal",
                "musculoskeletal",
                "infectious-disease",
                "autoimmune",
                "ophthalmology",
                "pediatric",
                "geriatric",
            ),
        ),
        (
            "methods",
            (
                "cohort-study",
                "case-control",
                "self-controlled",
                "meta-analysis",
                "machine-learning",
                "deep-learning",
                "nlp",
                "propensity-score",
                "negative-controls",
                "time-series",
                "survival-analysis",
                "bayesian",
            ),
        ),
        (
            "data",
            (
                "claims-data",
                "ehr-data",
                "registry-data",
                "multi-database",
                "synthetic-data",
                "imaging",
                "genomics",
                "biobank",
            ),
        ),
        (
            "ohdsi",
            (
                "omop-cdm",
                "ohdsi-tools",
                "atlas",
                "achilles",
                "cohort-diagnostics",
                "feature-extraction",
                "plp-package",
                "cohort-method-package",
                "book-of-ohdsi",
            ),
        ),
    ]
)

SECONDARY_TAGS = tuple(tag for group in SECONDARY_TAG_GROUPS.values() for tag in group)
_SECONDARY_TAG_SET = frozenset(SECONDARY_TAGS)
_PRIMARY_DOMAIN_SET = frozenset(PRIMARY_DOMAIN_DESCRIPTIONS)

_TAG_ALIASES = {
    "atlas": "atlas",
    "achilles": "achilles",
    "bayes": "bayesian",
    "case control": "case-control",
    "case-control": "case-control",
    "claims": "claims-data",
    "cohort": "cohort-study",
    "cohort diagnostics": "cohort-diagnostics",
    "cohort method": "cohort-method-package",
    "cohort-method-package": "cohort-method-package",
    "covid": "covid-19",
    "deep learning": "deep-learning",
    "ehr": "ehr-data",
    "electronic health record": "ehr-data",
    "federated": "multi-database",
    "feature extraction": "feature-extraction",
    "genomic": "genomics",
    "meta analysis": "meta-analysis",
    "machine learning": "machine-learning",
    "multi database": "multi-database",
    "negative control": "negative-controls",
    "nlp": "nlp",
    "omop": "omop-cdm",
    "omop cdm": "omop-cdm",
    "patient level prediction": "plp-package",
    "patient-level-prediction": "patient-level-prediction",
    "plp": "plp-package",
    "propensity score": "propensity-score",
    "registry": "registry-data",
    "self controlled": "self-controlled",
    "self-controlled": "self-controlled",
    "time series": "time-series",
    "webapi": "ohdsi-tools",
}

_PRIMARY_DOMAIN_ALIASES = {
    "clinical application": "clinical-applications",
    "clinical applications": "clinical-applications",
    "data quality": "data-quality",
    "etl": "etl-cdm",
    "etl / cdm": "etl-cdm",
    "etl-cdm": "etl-cdm",
    "infrastructure": "infrastructure-tools",
    "methods": "methods-statistics",
    "network": "network-studies",
    "patient level prediction": "patient-level-prediction",
    "patient-level prediction": "patient-level-prediction",
    "ple": "population-level-estimation",
    "plp": "patient-level-prediction",
    "policy": "policy-governance",
    "population level estimation": "population-level-estimation",
    "population-level estimation": "population-level-estimation",
    "terminology": "vocabulary-mapping",
    "vocabulary": "vocabulary-mapping",
}

_PRIMARY_RULES: "OrderedDict[str, tuple[str, ...]]" = OrderedDict(
    [
        ("pharmacovigilance", ("pharmacovigilance", "adverse event", "signal detection", "drug safety", "faers", "vaccine safety")),
        ("patient-level-prediction", ("patient-level prediction", "prediction model", "predictive model", "risk score", "auroc", "c-statistic", "calibration", "machine learning")),
        ("population-level-estimation", ("comparative effectiveness", "comparative safety", "propensity score", "new-user", "cohort method", "hazard ratio", "treatment effect")),
        ("data-quality", ("data quality", "dqd", "completeness", "conformance", "plausibility")),
        ("vocabulary-mapping", ("vocabulary", "concept mapping", "terminology", "snomed", "rxnorm", "loinc", "icd-10", "icd10")),
        ("etl-cdm", ("etl", "extract transform load", "common data model", "cdm conversion", "data transformation")),
        ("network-studies", ("network study", "distributed", "federated", "multi-site", "multi database", "multi-database")),
        ("infrastructure-tools", ("atlas", "webapi", "hades", "software", "r package", "package", "featureextraction", "cohortmethod", "patientlevelprediction", "achilles")),
        ("policy-governance", ("privacy", "governance", "ethics", "regulatory", "policy", "gdpr")),
        ("characterization", ("characterization", "achilles", "descriptive", "prevalence", "profiling")),
        ("methods-statistics", ("empirical calibration", "negative control", "causal inference", "methodology", "statistical method", "self-controlled", "bayesian")),
        ("clinical-applications", ("outcomes", "survival", "disease", "clinical", "patients")),
    ]
)

_SECONDARY_RULES: "OrderedDict[str, tuple[str, ...]]" = OrderedDict(
    [
        ("covid-19", ("covid-19", "sars-cov-2", "coronavirus disease 2019", "long covid")),
        ("diabetes", ("diabetes", "glycemic", "glp-1", "insulin", "metformin")),
        ("cardiovascular", ("cardiovascular", "heart failure", "myocardial", "stroke", "atrial fibrillation")),
        ("cancer", ("cancer", "oncology", "tumor", "carcinoma", "neoplasm")),
        ("respiratory", ("respiratory", "asthma", "copd", "pulmonary")),
        ("neurological", ("neurolog", "epilep", "parkinson", "alzheimer", "multiple sclerosis")),
        ("psychiatric", ("psychiatr", "depression", "schizophrenia", "bipolar", "mental health")),
        ("renal", ("renal", "kidney", "neph", "dialysis")),
        ("gastrointestinal", ("gastro", "ibd", "crohn", "ulcerative colitis", "liver")),
        ("musculoskeletal", ("musculoskeletal", "arthritis", "osteoporosis", "fracture")),
        ("infectious-disease", ("infectious", "infection", "sepsis", "antimicrobial", "influenza")),
        ("autoimmune", ("autoimmune", "lupus", "rheumatoid", "psoriasis")),
        ("ophthalmology", ("ophthalm", "retina", "glaucoma", "macular")),
        ("pediatric", ("pediatric", "children", "childhood", "adolescent", "neonate")),
        ("geriatric", ("geriatric", "older adult", "elderly", "aging")),
        ("cohort-study", ("cohort study", "cohort design", "retrospective cohort", "prospective cohort")),
        ("case-control", ("case-control", "case control")),
        ("self-controlled", ("self-controlled", "self controlled case series", "sccs")),
        ("meta-analysis", ("meta-analysis", "systematic review")),
        ("machine-learning", ("machine learning", "random forest", "xgboost", "gradient boosting")),
        ("deep-learning", ("deep learning", "neural network", "transformer", "cnn", "lstm")),
        ("nlp", ("natural language processing", "nlp", "clinical note", "text mining")),
        ("propensity-score", ("propensity score", "propensity-score")),
        ("negative-controls", ("negative control", "negative-control")),
        ("time-series", ("time series", "interrupted time series")),
        ("survival-analysis", ("survival analysis", "cox", "kaplan-meier", "hazard ratio")),
        ("bayesian", ("bayesian", "posterior", "hierarchical model")),
        ("claims-data", ("claims data", "claims-based", "claims database")),
        ("ehr-data", ("electronic health record", "ehr", "emr", "clinical data warehouse")),
        ("registry-data", ("registry", "registry-based")),
        ("multi-database", ("multi-database", "multi database", "distributed", "federated", "network study")),
        ("synthetic-data", ("synthetic data", "synthea")),
        ("imaging", ("imaging", "radiology", "ct scan", "mri")),
        ("genomics", ("genomic", "genome", "sequencing", "variant", "beacon")),
        ("biobank", ("biobank", "uk biobank")),
        ("omop-cdm", ("omop", "common data model", "cdm")),
        ("ohdsi-tools", ("ohdsi tool", "atlas", "webapi", "hades", "r package")),
        ("atlas", ("atlas",)),
        ("achilles", ("achilles",)),
        ("cohort-diagnostics", ("cohortdiagnostics", "cohort diagnostics")),
        ("feature-extraction", ("featureextraction", "feature extraction")),
        ("plp-package", ("patientlevelprediction", "patient level prediction", "plp")),
        ("cohort-method-package", ("cohortmethod", "cohort method")),
        ("book-of-ohdsi", ("book of ohdsi",)),
    ]
)

_PRIMARY_DEFAULT_SECONDARY: dict[str, tuple[str, ...]] = {
    "population-level-estimation": ("cohort-study", "propensity-score", "omop-cdm"),
    "patient-level-prediction": ("machine-learning", "ehr-data", "plp-package"),
    "characterization": ("ehr-data", "omop-cdm", "achilles"),
    "data-quality": ("omop-cdm", "ehr-data", "achilles"),
    "vocabulary-mapping": ("omop-cdm", "ohdsi-tools", "ehr-data"),
    "etl-cdm": ("omop-cdm", "ehr-data", "claims-data"),
    "methods-statistics": ("negative-controls", "cohort-study", "omop-cdm"),
    "network-studies": ("multi-database", "omop-cdm", "cohort-study"),
    "pharmacovigilance": ("cohort-study", "multi-database", "negative-controls"),
    "clinical-applications": ("cohort-study", "ehr-data", "omop-cdm"),
    "infrastructure-tools": ("ohdsi-tools", "omop-cdm", "atlas"),
    "policy-governance": ("multi-database", "ehr-data", "omop-cdm"),
}


def clean_bibliographic_text(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = html.unescape(value)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = cleaned.replace("\u00a0", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def normalize_primary_domain(value: str | None) -> str:
    candidate = _normalize_tag(value)
    if not candidate:
        return ""
    return _PRIMARY_DOMAIN_ALIASES.get(candidate, candidate) if _PRIMARY_DOMAIN_ALIASES.get(candidate, candidate) in _PRIMARY_DOMAIN_SET else ""


def normalize_secondary_tags(values: list[str] | tuple[str, ...] | None) -> list[str]:
    normalized: list[str] = []
    for value in values or []:
        candidate = _normalize_tag(value)
        if not candidate:
            continue
        resolved = _TAG_ALIASES.get(candidate, candidate)
        if resolved in _SECONDARY_TAG_SET and resolved not in normalized:
            normalized.append(resolved)
    return normalized


def assign_controlled_tags(
    *,
    title: str,
    body: str,
    journal: str = "",
    pdf_keywords: str = "",
    candidate_primary_domain: str | None = None,
    candidate_secondary_tags: list[str] | tuple[str, ...] | None = None,
) -> tuple[str, list[str]]:
    text = " ".join(part for part in (title, journal, pdf_keywords, body) if part).lower()
    primary_domain = normalize_primary_domain(candidate_primary_domain) or _classify_primary_domain(text)
    secondary_tags = normalize_secondary_tags(candidate_secondary_tags)

    scored_secondary = _score_matches(text, _SECONDARY_RULES)
    for tag, score in scored_secondary:
        if score <= 0 or tag in secondary_tags:
            continue
        secondary_tags.append(tag)
        if len(secondary_tags) >= 7:
            break

    for fallback_tag in _PRIMARY_DEFAULT_SECONDARY.get(primary_domain, ()):
        if fallback_tag not in secondary_tags:
            secondary_tags.append(fallback_tag)
        if len(secondary_tags) >= 7:
            break

    return primary_domain, secondary_tags[:7]


def primary_domain_prompt_block() -> str:
    return "\n".join(f"- `{tag}`: {description}" for tag, description in PRIMARY_DOMAIN_DESCRIPTIONS.items())


def secondary_tags_prompt_block() -> str:
    return "\n".join(
        f"- {group.title()}: {', '.join(f'`{tag}`' for tag in tags)}"
        for group, tags in SECONDARY_TAG_GROUPS.items()
    )


def _classify_primary_domain(text: str) -> str:
    scored = _score_matches(text, _PRIMARY_RULES)
    if scored and scored[0][1] > 0:
        return scored[0][0]
    return "clinical-applications"


def _score_matches(text: str, rules: "OrderedDict[str, tuple[str, ...]]") -> list[tuple[str, int]]:
    scores: list[tuple[str, int]] = []
    for tag, terms in rules.items():
        score = sum(1 for term in terms if term in text)
        scores.append((tag, score))
    scores.sort(key=lambda item: (-item[1], item[0]))
    return scores


def _normalize_tag(value: str | None) -> str:
    if value is None:
        return ""
    normalized = clean_bibliographic_text(value).lower()
    normalized = normalized.replace("_", "-")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = normalized.strip("-")
    return normalized
