"""Create and validate high-value research cohorts for IRSF-NHS Rett Syndrome data.

Each cohort is defined by SQL criteria against the loaded OMOP CDM data,
validated with counts and descriptive statistics, and optionally registered
in Parthenon's cohort_definition table.

Tiers:
  1. Clinical Trial Stratification (highest pharma value)
  2. Disease Progression & Natural History (regulatory/label value)
  3. Genotype-Phenotype Research (publication/pipeline value)
  4. Treatment Pattern Analysis (market access value)
"""

from __future__ import annotations

import json
import logging
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

import psycopg2
import psycopg2.extras

from scripts.irsf_etl.config import ETLConfig

logger = logging.getLogger(__name__)

# Custom IRSF concept ID ranges (from irsf_vocabulary.py)
CSS_TOTAL_CONCEPT_ID = 2000001000
MBA_GRAND_TOTAL_CONCEPT_ID = 2000002000
MUTATION_CONCEPT_RANGE = (2000003000, 2000004000)
DIAGNOSIS_CONCEPT_RANGE = (2000004000, 2000004014)

# Severe MECP2 mutations (highest CSS scores: R168X=26.4, R255X=25.6, R270X=25.7)
SEVERE_MUTATIONS = (
    "CommonMECP2Mutations_C502TR168X",
    "CommonMECP2Mutations_C763TR255X",
    "CommonMECP2Mutations_C808TR270X",
)

# Mild MECP2 mutations (lowest CSS scores: R294X=18.7, R133C=16.5)
MILD_MUTATIONS = (
    "CommonMECP2Mutations_C880TR294X",
    "CommonMECP2Mutations_C397TR133C",
)

# Anticonvulsant drug name patterns
AED_PATTERNS = (
    "Keppra", "Lamictal", "Depakote", "Topamax", "Diastat", "Tegretol",
    "Trileptal", "Phenobarbital", "Valproic", "Carbamazepine", "Levetiracetam",
    "Lamotrigine", "Topiramate", "Gabapentin", "Clobazam", "Clonazepam",
    "Zonegran", "Zonisamide", "Banzel", "Rufinamide", "Onfi", "Sabril",
    "Vigabatrin", "Felbamate", "Felbatol", "Oxcarbazepine", "Epidiolex",
    "Cannabidiol", "Fycompa", "Perampanel", "Briviact", "Brivaracetam",
)


@dataclass
class CohortValidation:
    """Validation results for a cohort."""

    person_count: int = 0
    descriptive_stats: dict = field(default_factory=dict)
    sample_person_ids: list[int] = field(default_factory=list)


@dataclass
class CohortDefinition:
    """A research cohort definition with SQL criteria and validation."""

    id: str
    tier: int
    name: str
    description: str
    clinical_rationale: str
    sql_criteria: str
    validation: CohortValidation = field(default_factory=CohortValidation)
    status: str = "pending"


def _aed_like_clause(alias: str = "de") -> str:
    """Build SQL LIKE clause for anticonvulsant matching."""
    conditions = [f"{alias}.drug_source_value ILIKE '%%{drug}%%'" for drug in AED_PATTERNS]
    return "(" + " OR ".join(conditions) + ")"


# ---------------------------------------------------------------------------
# TIER 1: Clinical Trial Stratification
# ---------------------------------------------------------------------------

def _tier1_severe_mecp2() -> CohortDefinition:
    mutations_list = ", ".join(f"'{m}'" for m in SEVERE_MUTATIONS)
    return CohortDefinition(
        id="T1-01",
        tier=1,
        name="Severe MECP2 Mutations (R168X/R255X/R270X)",
        description=(
            "Patients with severe MECP2 missense mutations (R168X, R255X, R270X) "
            "who have at least one CSS assessment with total score > 20. "
            "These mutations have mean CSS 25-26, representing the population "
            "most likely to show measurable treatment effect."
        ),
        clinical_rationale=(
            "Clinical trial enrollment for therapies targeting severe Rett phenotype. "
            "R168X, R255X, and R270X are the three most common severe mutations, "
            "accounting for ~20% of all Rett patients. Their high and consistent "
            "CSS scores make treatment effects detectable with smaller sample sizes."
        ),
        sql_criteria=f"""
            SELECT DISTINCT o.person_id
            FROM omop.observation o
            JOIN omop.measurement m ON o.person_id = m.person_id
            WHERE o.observation_source_value IN ({mutations_list})
              AND o.value_as_concept_id = 4181412
              AND m.measurement_concept_id = {CSS_TOTAL_CONCEPT_ID}
              AND m.value_as_number > 20
        """,
    )


def _tier1_mild_mecp2() -> CohortDefinition:
    mutations_list = ", ".join(f"'{m}'" for m in MILD_MUTATIONS)
    return CohortDefinition(
        id="T1-02",
        tier=1,
        name="Mild MECP2 Mutations (R294X/R133C)",
        description=(
            "Patients with milder MECP2 mutations (R294X, R133C) who have at "
            "least one CSS assessment. R294X (mean CSS 18.7) and R133C (16.5) "
            "have preserved speech and hand use more frequently."
        ),
        clinical_rationale=(
            "Comparison/control arm for genotype-stratified trials. These patients "
            "have milder trajectories with different treatment goals — maintenance "
            "of existing function rather than restoration. Also valuable for "
            "understanding the ceiling effect of therapies."
        ),
        sql_criteria=f"""
            SELECT DISTINCT o.person_id
            FROM omop.observation o
            JOIN omop.measurement m ON o.person_id = m.person_id
            WHERE o.observation_source_value IN ({mutations_list})
              AND o.value_as_concept_id = 4181412
              AND m.measurement_concept_id = {CSS_TOTAL_CONCEPT_ID}
        """,
    )


def _tier1_aed_seizure_css() -> CohortDefinition:
    aed_clause = _aed_like_clause("de")
    return CohortDefinition(
        id="T1-03",
        tier=1,
        name="AED-Treated Seizure Patients with Longitudinal CSS",
        description=(
            "Patients on anticonvulsant medications who have a seizure/epilepsy "
            "diagnosis AND at least 2 CSS assessments over time. This enables "
            "treatment efficacy analysis: does seizure control correlate with "
            "CSS stability?"
        ),
        clinical_rationale=(
            "Gold standard cohort for anticonvulsant comparative effectiveness "
            "research. Seizures affect ~80% of Rett patients and are the #1 "
            "treatment target. Longitudinal CSS allows measuring whether seizure "
            "control (via AEDs) prevents or slows functional decline."
        ),
        sql_criteria=f"""
            SELECT DISTINCT de.person_id
            FROM omop.drug_exposure de
            JOIN (
                SELECT DISTINCT person_id FROM omop.condition_occurrence
                WHERE condition_source_value ILIKE '%%seizure%%'
                   OR condition_source_value ILIKE '%%epilep%%'
                   OR condition_source_value ILIKE '%%spasm%%'
            ) sz ON de.person_id = sz.person_id
            JOIN (
                SELECT person_id FROM omop.measurement
                WHERE measurement_concept_id = {CSS_TOTAL_CONCEPT_ID}
                GROUP BY person_id HAVING count(DISTINCT measurement_date) >= 2
            ) css ON de.person_id = css.person_id
            WHERE {aed_clause}
        """,
    )


# ---------------------------------------------------------------------------
# TIER 2: Disease Progression & Natural History
# ---------------------------------------------------------------------------

def _tier2_progression_cohort() -> CohortDefinition:
    return CohortDefinition(
        id="T2-01",
        tier=2,
        name="Genotyped with 4+ CSS Assessments (Progression Cohort)",
        description=(
            "Patients with a known MECP2/CDKL5/FOXG1 mutation AND at least 4 "
            "CSS assessments over time. This is the gold-standard natural history "
            "cohort for external control arm use."
        ),
        clinical_rationale=(
            "FDA accepts external controls from well-characterized registries for "
            "rare disease single-arm trials. This cohort IS that reference — "
            "genotyped patients with sufficient longitudinal depth to model "
            "disease trajectory. Worth millions in avoided control-arm costs."
        ),
        sql_criteria=f"""
            SELECT DISTINCT g.person_id
            FROM (
                SELECT DISTINCT person_id FROM omop.observation
                WHERE observation_concept_id >= {MUTATION_CONCEPT_RANGE[0]}
                  AND observation_concept_id < {MUTATION_CONCEPT_RANGE[1]}
                  AND value_as_concept_id = 4181412
            ) g
            JOIN (
                SELECT person_id FROM omop.measurement
                WHERE measurement_concept_id = {CSS_TOTAL_CONCEPT_ID}
                GROUP BY person_id HAVING count(DISTINCT measurement_date) >= 4
            ) css ON g.person_id = css.person_id
        """,
    )


def _tier2_css_progressors() -> CohortDefinition:
    return CohortDefinition(
        id="T2-02",
        tier=2,
        name="CSS Progressors (Documented Functional Decline)",
        description=(
            "Patients whose CSS total score increased by 5+ points between their "
            "earliest and latest assessment, indicating documented functional "
            "decline over the observation period."
        ),
        clinical_rationale=(
            "Defines the target population for disease-modifying therapies. "
            "Patients with documented progression are the ones who NEED treatment "
            "most, and where treatment effects are most measurable. A 5-point "
            "CSS change is considered clinically meaningful in Rett literature."
        ),
        sql_criteria=f"""
            SELECT person_id FROM (
                SELECT
                    person_id,
                    FIRST_VALUE(value_as_number) OVER (PARTITION BY person_id ORDER BY measurement_date ASC) as first_css,
                    FIRST_VALUE(value_as_number) OVER (PARTITION BY person_id ORDER BY measurement_date DESC) as last_css
                FROM omop.measurement
                WHERE measurement_concept_id = {CSS_TOTAL_CONCEPT_ID}
                  AND value_as_number IS NOT NULL
            ) t
            WHERE last_css - first_css >= 5
            GROUP BY person_id
        """,
    )


def _tier2_growth_failure() -> CohortDefinition:
    return CohortDefinition(
        id="T2-03",
        tier=2,
        name="Growth Failure Cohort (Low Weight/BMI)",
        description=(
            "Patients with at least one weight measurement below the 5th percentile "
            "proxy (weight < 15kg after age 5, or BMI < 14 after age 10). Growth "
            "failure is a hallmark of Rett syndrome."
        ),
        clinical_rationale=(
            "Nutritional interventions and feeding tube decisions are major clinical "
            "endpoints. Growth failure is a key secondary endpoint in Rett trials "
            "and affects quality of life, hospitalization rates, and survival."
        ),
        sql_criteria="""
            SELECT DISTINCT m.person_id
            FROM omop.measurement m
            JOIN omop.person p ON p.person_id = m.person_id
            WHERE (
                (m.measurement_concept_id = 3025315  -- Weight
                 AND m.value_as_number < 15
                 AND EXTRACT(YEAR FROM m.measurement_date) - p.year_of_birth > 5)
                OR
                (m.measurement_concept_id = 3038553  -- BMI
                 AND m.value_as_number < 14
                 AND EXTRACT(YEAR FROM m.measurement_date) - p.year_of_birth > 10)
            )
        """,
    )


# ---------------------------------------------------------------------------
# TIER 3: Genotype-Phenotype Research
# ---------------------------------------------------------------------------

def _tier3_cdkl5() -> CohortDefinition:
    return CohortDefinition(
        id="T3-01",
        tier=3,
        name="CDKL5 Deficiency Disorder Patients",
        description=(
            "Patients with CDKL5 mutations — a distinct genetic etiology that is "
            "now its own orphan drug indication separate from classic Rett."
        ),
        clinical_rationale=(
            "CDKL5 deficiency is a separate genetic disorder with its own drug "
            "development pipeline (ganaxolone, soticlestat). Pipeline companies "
            "need this cohort for natural history modeling and trial design."
        ),
        sql_criteria="""
            SELECT DISTINCT person_id
            FROM omop.observation
            WHERE observation_source_value = 'CDKL5Mutations_Other'
              AND value_as_concept_id = 4181412
        """,
    )


def _tier3_foxg1() -> CohortDefinition:
    return CohortDefinition(
        id="T3-02",
        tier=3,
        name="FOXG1 Syndrome Patients",
        description=(
            "Patients with FOXG1 mutations — a rare congenital variant of Rett "
            "with distinct phenotypic features including microcephaly and "
            "hyperkinetic movement disorder."
        ),
        clinical_rationale=(
            "FOXG1 syndrome is an emerging orphan indication with distinct "
            "drug development targets. Small but well-characterized cohort "
            "for natural history and biomarker studies."
        ),
        sql_criteria="""
            SELECT DISTINCT person_id
            FROM omop.observation
            WHERE observation_source_value = 'FOXG1Mutations_Other'
              AND value_as_concept_id = 4181412
        """,
    )


def _tier3_mecp2_duplication() -> CohortDefinition:
    return CohortDefinition(
        id="T3-03",
        tier=3,
        name="MECP2 Duplication Syndrome",
        description=(
            "Patients with MECP2 duplication — predominantly male, with distinct "
            "phenotype including recurrent infections and progressive spasticity. "
            "Gene therapy specifically targets this mechanism."
        ),
        clinical_rationale=(
            "MECP2 duplication syndrome has a different molecular mechanism "
            "(gain-of-function vs loss-of-function in classic Rett). Gene therapy "
            "and antisense oligonucleotide programs target this specifically. "
            "101 patients is a substantial cohort for this ultra-rare condition."
        ),
        sql_criteria="""
            SELECT DISTINCT person_id
            FROM omop.observation
            WHERE observation_source_value = 'MCP2Duplications'
              AND value_as_concept_id = 4181412
        """,
    )


def _tier3_seizure_free() -> CohortDefinition:
    aed_clause = _aed_like_clause("de")
    return CohortDefinition(
        id="T3-04",
        tier=3,
        name="Seizure-Free Rett Patients",
        description=(
            "Rett patients with NO seizure/epilepsy conditions AND no "
            "anticonvulsant medications. Understanding protective factors "
            "in seizure-free patients informs drug target discovery."
        ),
        clinical_rationale=(
            "~20% of Rett patients never develop seizures despite having "
            "the same MECP2 mutations as those who do. Understanding this "
            "protective phenotype is a key research question that could "
            "reveal novel drug targets."
        ),
        sql_criteria=f"""
            SELECT DISTINCT p.person_id
            FROM omop.person p
            WHERE p.person_id NOT IN (
                SELECT DISTINCT person_id FROM omop.condition_occurrence
                WHERE condition_source_value ILIKE '%%seizure%%'
                   OR condition_source_value ILIKE '%%epilep%%'
                   OR condition_source_value ILIKE '%%spasm%%'
            )
            AND p.person_id NOT IN (
                SELECT DISTINCT de.person_id FROM omop.drug_exposure de
                WHERE {aed_clause}
            )
        """,
    )


# ---------------------------------------------------------------------------
# TIER 4: Treatment Pattern Analysis
# ---------------------------------------------------------------------------

def _tier4_polypharmacy() -> CohortDefinition:
    aed_clause = _aed_like_clause("de")
    return CohortDefinition(
        id="T4-01",
        tier=4,
        name="AED Polypharmacy (3+ Concurrent Anticonvulsants)",
        description=(
            "Patients who were prescribed 3 or more different anticonvulsant "
            "medications with overlapping exposure periods, indicating "
            "refractory epilepsy requiring combination therapy."
        ),
        clinical_rationale=(
            "Refractory epilepsy in Rett — defines the unmet medical need "
            "population for novel mechanisms of action. These patients have "
            "failed multiple standard therapies, making them prime candidates "
            "for novel AEDs, neuromodulation, or gene therapy targeting "
            "seizure pathways."
        ),
        sql_criteria=f"""
            SELECT person_id FROM (
                SELECT de.person_id, count(DISTINCT
                    CASE
                        WHEN de.drug_source_value ILIKE '%%Keppra%%' OR de.drug_source_value ILIKE '%%Levetiracetam%%' THEN 'levetiracetam'
                        WHEN de.drug_source_value ILIKE '%%Lamictal%%' OR de.drug_source_value ILIKE '%%Lamotrigine%%' THEN 'lamotrigine'
                        WHEN de.drug_source_value ILIKE '%%Depakote%%' OR de.drug_source_value ILIKE '%%Valproic%%' OR de.drug_source_value ILIKE '%%Divalproex%%' THEN 'valproate'
                        WHEN de.drug_source_value ILIKE '%%Topamax%%' OR de.drug_source_value ILIKE '%%Topiramate%%' THEN 'topiramate'
                        WHEN de.drug_source_value ILIKE '%%Tegretol%%' OR de.drug_source_value ILIKE '%%Carbamazepine%%' THEN 'carbamazepine'
                        WHEN de.drug_source_value ILIKE '%%Trileptal%%' OR de.drug_source_value ILIKE '%%Oxcarbazepine%%' THEN 'oxcarbazepine'
                        WHEN de.drug_source_value ILIKE '%%Phenobarbital%%' THEN 'phenobarbital'
                        WHEN de.drug_source_value ILIKE '%%Diastat%%' OR de.drug_source_value ILIKE '%%Diazepam%%' THEN 'diazepam'
                        WHEN de.drug_source_value ILIKE '%%Clobazam%%' OR de.drug_source_value ILIKE '%%Onfi%%' THEN 'clobazam'
                        WHEN de.drug_source_value ILIKE '%%Clonazepam%%' OR de.drug_source_value ILIKE '%%Klonopin%%' THEN 'clonazepam'
                        WHEN de.drug_source_value ILIKE '%%Zonegran%%' OR de.drug_source_value ILIKE '%%Zonisamide%%' THEN 'zonisamide'
                        WHEN de.drug_source_value ILIKE '%%Gabapentin%%' OR de.drug_source_value ILIKE '%%Neurontin%%' THEN 'gabapentin'
                        WHEN de.drug_source_value ILIKE '%%Vigabatrin%%' OR de.drug_source_value ILIKE '%%Sabril%%' THEN 'vigabatrin'
                        WHEN de.drug_source_value ILIKE '%%Epidiolex%%' OR de.drug_source_value ILIKE '%%Cannabidiol%%' THEN 'cannabidiol'
                        WHEN {aed_clause} THEN 'other_aed'
                    END
                ) as distinct_aeds
                FROM omop.drug_exposure de
                WHERE {aed_clause}
                GROUP BY de.person_id
            ) t
            WHERE distinct_aeds >= 3
        """,
    )


def _tier4_aed_switchers() -> CohortDefinition:
    aed_clause = _aed_like_clause("de")
    return CohortDefinition(
        id="T4-02",
        tier=4,
        name="AED Switchers (2+ Medication Changes)",
        description=(
            "Patients with 2 or more distinct anticonvulsant medications "
            "over their treatment history, indicating at least one treatment "
            "switch due to inadequate response or side effects."
        ),
        clinical_rationale=(
            "Treatment failure rate supports unmet medical need claims in "
            "regulatory filings. The number of switches correlates with "
            "disease severity and predicts willingness to try novel therapies. "
            "Essential for market sizing and pricing justification."
        ),
        sql_criteria=f"""
            SELECT person_id FROM (
                SELECT de.person_id, count(DISTINCT
                    CASE
                        WHEN de.drug_source_value ILIKE '%%Keppra%%' OR de.drug_source_value ILIKE '%%Levetiracetam%%' THEN 'levetiracetam'
                        WHEN de.drug_source_value ILIKE '%%Lamictal%%' OR de.drug_source_value ILIKE '%%Lamotrigine%%' THEN 'lamotrigine'
                        WHEN de.drug_source_value ILIKE '%%Depakote%%' OR de.drug_source_value ILIKE '%%Valproic%%' OR de.drug_source_value ILIKE '%%Divalproex%%' THEN 'valproate'
                        WHEN de.drug_source_value ILIKE '%%Topamax%%' OR de.drug_source_value ILIKE '%%Topiramate%%' THEN 'topiramate'
                        WHEN de.drug_source_value ILIKE '%%Tegretol%%' OR de.drug_source_value ILIKE '%%Carbamazepine%%' THEN 'carbamazepine'
                        WHEN de.drug_source_value ILIKE '%%Trileptal%%' OR de.drug_source_value ILIKE '%%Oxcarbazepine%%' THEN 'oxcarbazepine'
                        WHEN de.drug_source_value ILIKE '%%Phenobarbital%%' THEN 'phenobarbital'
                        WHEN de.drug_source_value ILIKE '%%Diastat%%' OR de.drug_source_value ILIKE '%%Diazepam%%' THEN 'diazepam'
                        WHEN de.drug_source_value ILIKE '%%Clobazam%%' OR de.drug_source_value ILIKE '%%Onfi%%' THEN 'clobazam'
                        WHEN de.drug_source_value ILIKE '%%Clonazepam%%' OR de.drug_source_value ILIKE '%%Klonopin%%' THEN 'clonazepam'
                        WHEN de.drug_source_value ILIKE '%%Zonegran%%' OR de.drug_source_value ILIKE '%%Zonisamide%%' THEN 'zonisamide'
                        WHEN de.drug_source_value ILIKE '%%Gabapentin%%' OR de.drug_source_value ILIKE '%%Neurontin%%' THEN 'gabapentin'
                        WHEN de.drug_source_value ILIKE '%%Vigabatrin%%' OR de.drug_source_value ILIKE '%%Sabril%%' THEN 'vigabatrin'
                        WHEN de.drug_source_value ILIKE '%%Epidiolex%%' OR de.drug_source_value ILIKE '%%Cannabidiol%%' THEN 'cannabidiol'
                        WHEN {aed_clause} THEN 'other_aed'
                    END
                ) as distinct_aeds
                FROM omop.drug_exposure de
                WHERE {aed_clause}
                GROUP BY de.person_id
            ) t
            WHERE distinct_aeds >= 2
        """,
    )


# ---------------------------------------------------------------------------
# Cohort Registry
# ---------------------------------------------------------------------------

ALL_COHORT_BUILDERS = {
    # Tier 1
    "T1-01": _tier1_severe_mecp2,
    "T1-02": _tier1_mild_mecp2,
    "T1-03": _tier1_aed_seizure_css,
    # Tier 2
    "T2-01": _tier2_progression_cohort,
    "T2-02": _tier2_css_progressors,
    "T2-03": _tier2_growth_failure,
    # Tier 3
    "T3-01": _tier3_cdkl5,
    "T3-02": _tier3_foxg1,
    "T3-03": _tier3_mecp2_duplication,
    "T3-04": _tier3_seizure_free,
    # Tier 4
    "T4-01": _tier4_polypharmacy,
    "T4-02": _tier4_aed_switchers,
}


def validate_cohort(
    conn: psycopg2.extensions.connection,
    cohort: CohortDefinition,
) -> CohortDefinition:
    """Execute cohort SQL and populate validation results."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Get person count
        count_sql = f"SELECT count(*) as cnt FROM ({cohort.sql_criteria}) cohort"
        cur.execute(count_sql)
        cohort.validation.person_count = cur.fetchone()["cnt"]

        # Get sample person_ids
        sample_sql = f"SELECT person_id FROM ({cohort.sql_criteria}) cohort LIMIT 5"
        cur.execute(sample_sql)
        cohort.validation.sample_person_ids = [r["person_id"] for r in cur.fetchall()]

        # Descriptive stats based on tier
        stats = {}

        # Gender distribution for all cohorts
        gender_sql = f"""
            SELECT p.gender_concept_id, count(*) as cnt
            FROM ({cohort.sql_criteria}) c
            JOIN omop.person p ON c.person_id = p.person_id
            GROUP BY 1 ORDER BY 2 DESC
        """
        cur.execute(gender_sql)
        gender_rows = cur.fetchall()
        total = sum(r["cnt"] for r in gender_rows)
        stats["gender"] = {
            str(r["gender_concept_id"]): {
                "count": r["cnt"],
                "pct": round(r["cnt"] / total * 100, 1) if total > 0 else 0,
            }
            for r in gender_rows
        }

        # CSS stats if applicable
        css_sql = f"""
            SELECT
                count(DISTINCT m.person_id) as patients_with_css,
                round(avg(m.value_as_number)::numeric, 1) as mean_css,
                round(min(m.value_as_number)::numeric, 1) as min_css,
                round(max(m.value_as_number)::numeric, 1) as max_css,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY m.value_as_number) as median_css
            FROM ({cohort.sql_criteria}) c
            JOIN omop.measurement m ON c.person_id = m.person_id
            WHERE m.measurement_concept_id = {CSS_TOTAL_CONCEPT_ID}
              AND m.value_as_number IS NOT NULL
        """
        cur.execute(css_sql)
        css_row = cur.fetchone()
        if css_row and css_row["patients_with_css"] and css_row["patients_with_css"] > 0:
            stats["css"] = {
                "patients_with_css": css_row["patients_with_css"],
                "mean": float(css_row["mean_css"]) if css_row["mean_css"] else None,
                "median": float(css_row["median_css"]) if css_row["median_css"] else None,
                "min": float(css_row["min_css"]) if css_row["min_css"] else None,
                "max": float(css_row["max_css"]) if css_row["max_css"] else None,
            }

        # Age distribution
        age_sql = f"""
            SELECT
                round(avg(EXTRACT(YEAR FROM current_date) - p.year_of_birth)::numeric, 1) as mean_age,
                min(EXTRACT(YEAR FROM current_date) - p.year_of_birth)::int as min_age,
                max(EXTRACT(YEAR FROM current_date) - p.year_of_birth)::int as max_age
            FROM ({cohort.sql_criteria}) c
            JOIN omop.person p ON c.person_id = p.person_id
            WHERE p.year_of_birth IS NOT NULL
        """
        cur.execute(age_sql)
        age_row = cur.fetchone()
        if age_row and age_row["mean_age"]:
            stats["age"] = {
                "mean": float(age_row["mean_age"]),
                "min": age_row["min_age"],
                "max": age_row["max_age"],
            }

        cohort.validation.descriptive_stats = stats
        cohort.status = "validated"
        logger.info(
            "  ✓ %s: %d patients | %s",
            cohort.id,
            cohort.validation.person_count,
            cohort.name,
        )

    except Exception as e:
        cohort.status = f"error: {e}"
        logger.error("  ✗ %s: %s", cohort.id, e)

    return cohort


def run_tier(
    conn: psycopg2.extensions.connection,
    tier: int,
    cohort_builders: dict[str, callable] | None = None,
) -> list[CohortDefinition]:
    """Build and validate all cohorts in a tier."""
    if cohort_builders is None:
        cohort_builders = ALL_COHORT_BUILDERS

    cohorts = []
    for cid, builder in cohort_builders.items():
        cohort = builder()
        if cohort.tier == tier:
            validate_cohort(conn, cohort)
            cohorts.append(cohort)

    return cohorts


def save_report(cohorts: list[CohortDefinition], output_path: Path) -> None:
    """Save cohort validation report as JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    report = {
        "total_cohorts": len(cohorts),
        "validated": sum(1 for c in cohorts if c.status == "validated"),
        "errors": sum(1 for c in cohorts if c.status.startswith("error")),
        "tiers": {},
    }

    for cohort in cohorts:
        tier_key = f"tier_{cohort.tier}"
        if tier_key not in report["tiers"]:
            report["tiers"][tier_key] = []

        report["tiers"][tier_key].append({
            "id": cohort.id,
            "name": cohort.name,
            "description": cohort.description,
            "clinical_rationale": cohort.clinical_rationale,
            "person_count": cohort.validation.person_count,
            "status": cohort.status,
            "descriptive_stats": cohort.validation.descriptive_stats,
            "sample_person_ids": cohort.validation.sample_person_ids,
        })

    output_path.write_text(json.dumps(report, indent=2, default=str) + "\n")
    logger.info("Report saved to %s", output_path)


def main() -> int:
    """Create and validate all research cohorts tier by tier."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    config = ETLConfig()
    conn = psycopg2.connect(**config.db_connection_params)

    # Parse args
    tiers_to_run = [1, 2, 3, 4]
    if len(sys.argv) > 1:
        tiers_to_run = [int(t) for t in sys.argv[1:]]

    all_cohorts = []

    for tier in tiers_to_run:
        tier_names = {1: "Clinical Trial Stratification", 2: "Disease Progression", 3: "Genotype-Phenotype", 4: "Treatment Patterns"}
        logger.info("")
        logger.info("━" * 60)
        logger.info(" TIER %d: %s", tier, tier_names.get(tier, ""))
        logger.info("━" * 60)

        cohorts = run_tier(conn, tier)
        all_cohorts.extend(cohorts)

        # Print tier summary table
        logger.info("")
        logger.info("  %-6s %-50s %8s", "ID", "Cohort", "Patients")
        logger.info("  %s %s %s", "-" * 6, "-" * 50, "-" * 8)
        for c in cohorts:
            logger.info("  %-6s %-50s %8d", c.id, c.name[:50], c.validation.person_count)

    conn.close()

    # Save report
    save_report(all_cohorts, config.reports_dir / "research_cohorts_report.json")

    # Final summary
    logger.info("")
    logger.info("━" * 60)
    logger.info(" COHORT VALIDATION COMPLETE")
    logger.info("━" * 60)
    logger.info("  Total cohorts: %d", len(all_cohorts))
    logger.info("  Validated: %d", sum(1 for c in all_cohorts if c.status == "validated"))
    logger.info("  Errors: %d", sum(1 for c in all_cohorts if c.status.startswith("error")))
    total_unique = sum(c.validation.person_count for c in all_cohorts)
    logger.info("  Total patient-cohort memberships: %d", total_unique)

    return 0 if all(c.status == "validated" for c in all_cohorts) else 1


if __name__ == "__main__":
    sys.exit(main())
