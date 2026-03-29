---
slug: population-risk-scoring-engine
title: "Building a Clinically Intelligent Risk Scoring Engine on OMOP CDM"
authors: [mudoshi, claude]
tags: [risk-scores, omop, clinical-analytics, architecture, cohort-analysis, vocabulary]
date: 2026-03-28T12:00:00
---

We built a population risk scoring engine that runs 20 validated clinical risk calculators against any OMOP CDM dataset — then immediately realized the approach was wrong. This post covers what we built, why we tore it apart, and the v2 architecture that replaced "run everything on everyone" with cohort-scoped, recommendation-driven clinical risk analysis.

<!-- truncate -->

## The Problem with "Run All"

Clinical risk scores are precision instruments. A Framingham Risk Score was designed for adults aged 30-74 without prior cardiovascular events. CHADS2-VASc only applies to patients with atrial fibrillation. MELD is for liver disease severity. Running all 20 scores against a pancreatic cancer cohort produces a page full of "low" and "uncomputable" — clinically meaningless results that make the platform look naive.

But that's exactly what v1 did. We implemented 20 risk calculators, wired them to a "Run All" button, and watched the results pour in. Framingham returned "uncomputable" for 66% of our cancer patients (no lipid panels). CHADS2-VASc returned 0 for everyone (no atrial fibrillation). Charlson returned mean CCI of 0.37 for a cohort where every single patient has cancer — because the concept IDs were wrong.

That last part was the wake-up call.

## Where Hallucinated Concepts Go to Die

Our first Charlson implementation used concept ID `4178681` for "any malignancy." It seemed right. The code was clean. The SQL ran without errors. The score computed to 0.37 for a cohort of 361 pancreatic cancer patients who should all score at least 2.

We queried the vocabulary:

```sql
SELECT concept_id, concept_name FROM vocab.concept WHERE concept_id = 4178681;
```

| concept_id | concept_name |
|------------|------|
| 4178681 | Dermatological complication of procedure |

Not malignancy. A dermatological complication. The concept ID was fabricated — confidently wrong, plausibly formatted, and catastrophically misleading. Every patient in our cancer cohort was being matched against a skin procedure concept. Of course the CCI was near zero.

This wasn't an edge case. Ten of our twenty score implementations had the same problem: concept IDs pulled from training data rather than queried from the actual OMOP vocabulary. Some were close enough to pass a cursory review. Others were entirely fictional.

The fix was straightforward but non-negotiable: every concept ID must be verified against `vocab.concept` at development time, and resolved via `concept_ancestor` at runtime. No exceptions. No "I'm pretty sure this is right." Query the vocabulary or don't write the code.

## The Vocabulary Is the Source of Truth

OMOP CDM's strength is its standardized vocabulary. Concept hierarchies, ancestor relationships, and cross-vocabulary mappings are the foundation that makes population-level analytics work. Ignoring them — or approximating them from memory — defeats the purpose.

Here's what the correct Charlson malignancy lookup looks like:

```sql
-- "Malignant neoplastic disease" (443392) is the verified ancestor
SELECT concept_id, concept_name FROM vocab.concept WHERE concept_id = 443392;
-- Returns: Malignant neoplastic disease

-- Verify our PDAC concept is a descendant
SELECT min_levels_of_separation
FROM vocab.concept_ancestor
WHERE ancestor_concept_id = 443392
  AND descendant_concept_id = 4180793; -- Malignant tumor of pancreas
-- Returns: 3 (three levels of separation — it IS a descendant)
```

One query. Definitive answer. Our pancreatic cancer concept (4180793) sits three levels below the general malignancy ancestor (443392) in the SNOMED hierarchy. Every patient with PDAC now correctly matches the Charlson "any malignancy" condition group.

We verified all 17 Charlson condition groups this way:

| Group | Ancestor | Verified Concept |
|-------|----------|-----------------|
| MI | 4329847 | Myocardial infarction |
| CHF | 319835 | Congestive heart failure |
| Malignancy | 443392 | Malignant neoplastic disease |
| Metastatic tumor | 432851 | Metastatic malignant neoplasm |
| Diabetes | 201820 | Diabetes mellitus |
| COPD | 255573 | Chronic obstructive pulmonary disease |
| Renal disease | 46271022 | Chronic kidney disease |
| HIV/AIDS | 439727 | Human immunodeficiency virus infection |
| ... | ... | ... |

With verified ancestors and runtime descendant resolution, the Charlson now correctly scores our pancreatic cancer cohort: **226 patients at CCI=2 (cancer only), 135 patients at CCI=3 (cancer + Type 2 diabetes).**

## From "Run All" to Recommendation-Driven

The concept ID fix was necessary but not sufficient. The fundamental design was still wrong: presenting 20 scores to every user for every cohort. A researcher studying pancreatic cancer doesn't need CURB-65 (pneumonia severity) or STOP-BANG (sleep apnea risk). Showing them alongside Charlson creates noise and erodes trust.

### v2 Architecture: Cohort-Scoped Risk Analysis

The redesigned engine is built around a simple principle: **risk scores are only meaningful when applied to the right population.** The system should know which scores apply and recommend them.

**The flow:**

1. Researcher selects a target cohort (e.g., "All PDAC Patients" — 361 subjects)
2. The recommendation engine profiles the cohort: demographics, condition prevalence, measurement availability
3. Based on the profile, it recommends applicable scores with relevance reasons:
   - Charlson CCI: **Recommended** — "100% of cohort has malignancy conditions; 37% have diabetes"
   - FIB-4 Index: **Recommended** — "Liver function relevant for chemo hepatotoxicity monitoring; labs available"
   - CHADS2-VASc: **Not applicable** — "Less than 1% atrial fibrillation prevalence in cohort"
4. Researcher confirms selection
5. Scores execute scoped to the cohort membership, storing patient-level results

### Score Eligibility Criteria

Each score declares its eligibility as structured criteria, not just a human-readable string:

```php
public function eligibilityCriteria(): array
{
    return [
        'population_type' => 'universal',
        // Universal scores (Charlson, Elixhauser) apply to any cohort.
        // Condition-specific scores (CHADS2-VASc, MELD) require prerequisite conditions.
        // Age-restricted scores (Framingham, SCORE2) need patients in the right age range.
    ];
}
```

The recommendation engine uses these criteria plus the cohort's actual clinical profile to make intelligent suggestions. A cardiovascular screening cohort gets Framingham and Pooled Cohort Equations. A liver disease cohort gets MELD and Child-Pugh. A cancer cohort gets Charlson, Elixhauser, and Multimorbidity Burden.

### Runtime Concept Resolution

Instead of hardcoded concept IDs in SQL templates, v2 scores declare clinical condition groups with verified ancestor concepts:

```php
public function conditionGroups(): array
{
    return [
        ['label' => 'Myocardial infarction', 'ancestor_concept_id' => 4329847, 'weight' => 1],
        ['label' => 'Malignant neoplastic disease', 'ancestor_concept_id' => 443392, 'weight' => 2],
        ['label' => 'Metastatic malignant neoplasm', 'ancestor_concept_id' => 432851, 'weight' => 6],
        // ...
    ];
}
```

At execution time, the `ConceptResolutionService` resolves each ancestor to its full descendant set via `concept_ancestor`. This means:

- Different vocabulary versions produce correct results automatically
- No hardcoded concept IDs in scoring logic
- The vocabulary is always the source of truth, queried live

Results are cached for one hour to avoid redundant ancestor lookups across multiple score executions.

### Pure Computation, Separate Data Access

v1 scores were SQL templates — the scoring logic was tangled with data access. A Charlson score was a 200-line SQL CTE chain that both fetched conditions and computed weights. Debugging meant reading SQL. Testing meant running against a database.

v2 separates these concerns:

1. **PatientFeatureExtractor** — queries condition_occurrence, measurement, and person tables for the entire cohort in one efficient batch
2. **Score.compute()** — a pure PHP function that receives extracted features and returns a score. No database access. Testable with mock data.

```php
public function compute(array $patientData): array
{
    // $patientData contains: age, gender, conditions (as ancestor IDs), measurements
    // Returns: score value, risk tier, confidence, completeness, missing components
}
```

This makes each score independently testable, debuggable, and auditable. The Charlson `compute()` method is 50 lines of clear PHP logic with explicit supersession rules (metastatic trumps malignancy, severe liver trumps mild liver).

### Patient-Level Persistence

v1 stored only population summaries — mean scores and tier counts. Useful for dashboards, useless for research. v2 stores every patient's individual score:

```sql
SELECT person_id, score_value, risk_tier, confidence
FROM app.risk_score_patient_results
WHERE score_id = 'RS005' AND risk_tier = 'moderate'
ORDER BY score_value DESC;
```

This enables:
- Patient-level drill-through from any risk tier to the Patient Profile
- Using risk scores as cohort inclusion criteria (future: "Charlson >= 3" as a cohort filter)
- Exporting patient-level risk stratification for downstream analysis
- Comparing risk distributions across cohorts

## The 20 Scores

Parthenon ships with 20 validated clinical risk calculators spanning six clinical domains:

| Category | Scores | Key Use Case |
|----------|--------|-------------|
| **Cardiovascular** | Framingham, Pooled Cohort Equations, CHA2DS2-VASc, HAS-BLED, SCORE2, TIMI, GRACE, CHADS2, RCRI | CV event prediction, stroke risk in AF, bleeding risk, pre-operative cardiac risk |
| **Comorbidity** | Charlson CCI, Elixhauser, Multimorbidity Burden | Overall disease burden, mortality prediction, resource utilization |
| **Hepatic** | MELD, Child-Pugh, FIB-4 | Liver transplant priority, cirrhosis severity, fibrosis staging |
| **Pulmonary** | CURB-65, STOP-BANG | Pneumonia severity, sleep apnea screening |
| **Metabolic** | Metabolic Syndrome Score, DCSI | Metabolic risk clustering, diabetes complications |
| **Musculoskeletal** | FRAX | Osteoporotic fracture risk |

Each score implements the same v2 interface. Adding a new score means implementing one PHP class with ~100 lines of code: eligibility criteria, condition/measurement groups, risk tiers, and a `compute()` method.

## Running It on the Pancreatic Cancer Corpus

Our test dataset: 361 patients with pancreatic ductal adenocarcinoma (PDAC) across three sub-cohorts — 21 PANCREAS-CT imaging patients, 168 CPTAC-PDA pathology patients, and 172 TCGA-PAAD genomics patients. Full clinical trajectories: visits, labs, drugs, conditions, procedures, specimens, 1,227 clinical notes, and genomic mutation profiles (KRAS/TP53/SMAD4/CDKN2A).

We ran the recommendation engine against the "All PDAC Patients" cohort:

**Recommended:**
- Charlson CCI — universal applicability, 100% have malignancy conditions
- Elixhauser Index — universal, captures T2DM, cachexia, DVT
- Multimorbidity Burden — broad comorbidity assessment
- FIB-4 — liver function labs available, relevant for chemotherapy hepatotoxicity monitoring

**Not applicable:**
- CHADS2-VASc, CHADS2 — less than 1% atrial fibrillation
- MELD, Child-Pugh — no primary liver disease
- CURB-65 — no pneumonia diagnoses
- Framingham, PCE, SCORE2 — missing lipid panels for most patients

This is exactly what a clinical researcher would expect. The engine's recommendations align with clinical judgment because they're derived from the actual data, not from assumptions about what a cancer cohort "probably" needs.

### Charlson CCI Results

| Tier | Patients | Mean CCI | Interpretation |
|------|----------|----------|---------------|
| Low (0-2) | 226 | 2.0 | Cancer only — no additional comorbidities |
| Moderate (3-4) | 135 | 3.0 | Cancer + one comorbidity (typically T2DM) |

All 361 patients correctly score at least 2 (any malignancy, weight 2). The 37% with Type 2 diabetes score 3 (malignancy + diabetes, weight 1). No patient scores below 2. No patient is "uncomputable." The vocabulary hierarchy resolution works.

## What's Next

The v2 backend is complete. Remaining work:

1. **Frontend analysis creator** — cohort selector with recommendation cards, score selection, execution modal (replicating the Achilles UX pattern)
2. **Results visualization** — tier distribution charts, patient drill-through tables
3. **Score migration** — converting the remaining 19 scores from v1 SQL templates to v2 pure-compute implementations
4. **Cohort builder integration** — using risk scores as cohort inclusion criteria ("Charlson >= 3 AND KRAS mutant" as a single cohort definition)

The architectural lesson: clinical analytics tools must respect clinical context. A risk score without population awareness is just a number. A risk score that knows when it's relevant — and when it's not — is a clinical decision support tool.

## Technical Summary

| Component | Technology |
|-----------|-----------|
| Score Engine | Laravel 11 / PHP 8.4 |
| Vocabulary Resolution | vocab.concept_ancestor (runtime, cached) |
| Feature Extraction | Bulk SQL with DISTINCT ON, PostgreSQL ANY() |
| Patient Storage | app.risk_score_patient_results (indexed by cohort + person) |
| Execution Tracking | AnalysisExecution polymorphism + RiskScoreRunStep |
| Score Interface | PopulationRiskScoreV2Interface with pure compute() |
| Database | PostgreSQL 17, OMOP CDM v5.4 |

All 20 scores, the recommendation engine, and the execution pipeline are open source under Apache 2.0.
