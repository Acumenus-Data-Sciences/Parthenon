# Population Risk Scores v2 — Cohort-Scoped Clinical Risk Analysis

**Date:** 2026-03-28
**Status:** Draft
**Replaces:** `2026-03-28-risk-scores-frontend-design.md` (v1 — retained as-is, frontend reused)

## Problem Statement

v1 runs all 20 risk scores against an entire source population, producing clinically meaningless results. Running CHADS2-VASc on a pancreatic cancer cohort, or CURB-65 on a cardiac population, wastes compute and undermines credibility.

Risk scores are only meaningful when applied to the right patient population. A Charlson Comorbidity Index is relevant for any hospitalized cohort. A Framingham Risk Score is relevant for cardiovascular screening populations aged 30-74. MELD is relevant for patients with liver disease. The platform should know this and act accordingly.

## Design Goals

1. **Cohort-scoped** — Scores run against specific target cohorts, not entire sources
2. **Recommendation-driven** — Given a cohort, recommend which scores are clinically relevant
3. **Vocab-validated** — Concept IDs resolved from `vocab.concept` + `concept_ancestor` at runtime, never hardcoded
4. **Analysis-integrated** — First-class analysis type alongside Characterization, Incidence Rate, Pathways
5. **Patient-level** — Store individual patient scores for downstream use (cohort criteria, stratification, export)

## Architecture Overview

### Analysis Integration

Risk scoring becomes a new analysis type in the existing Analyses framework:

```
Analyses
  ├─ Characterization         (existing)
  ├─ Incidence Rate           (existing)
  ├─ Treatment Pathways       (existing)
  ├─ Estimation               (existing)
  ├─ Prediction               (existing)
  ├─ SCCS                     (existing)
  ├─ Evidence Synthesis        (existing)
  └─ Risk Score Analysis      (NEW — v2)
```

A `RiskScoreAnalysis` is configured with:
- Target cohort(s)
- Selected score(s) — recommended by the engine, confirmed by the user
- Source to execute against
- Optional: comparator cohort for risk distribution comparison

### Data Flow

```
User selects cohort → Recommendation engine analyzes cohort profile
→ Recommends applicable scores → User confirms/adjusts selection
→ Execution: each score runs scoped to cohort membership
→ Patient-level results stored → Population summaries computed
→ Results visible in Analysis detail page + Risk Scores Evidence page
```

## Backend Components

### 1. Score Recommendation Service

`App\Services\PopulationRisk\RiskScoreRecommendationService`

Given a cohort and source, determines which scores are clinically appropriate:

1. **Profile the cohort** — Query the cohort's condition prevalence, age/sex distribution, measurement availability
2. **Match against score eligibility** — Each score declares its eligible population (AF patients, liver disease, all adults, etc.) as semantic condition groups
3. **Check data completeness** — For each potentially applicable score, verify the source has the required measurements/conditions
4. **Return ranked recommendations** with relevance reason and expected completeness

```php
interface ScoreRecommendation {
    string $scoreId;
    string $scoreName;
    string $category;
    string $relevanceReason;      // "92% of cohort has malignancy conditions"
    float $expectedCompleteness;  // 0.0–1.0
    bool $isApplicable;
    string[] $missingComponents;  // What data would be needed
}
```

**Eligibility Matching Logic:**

Each score declares eligibility as structured criteria, not just a human-readable string:

```php
interface PopulationRiskScoreInterface {
    // ... existing methods ...

    /**
     * Structured eligibility criteria for recommendation engine.
     * @return array{
     *   min_age?: int,
     *   max_age?: int,
     *   gender?: int,
     *   required_condition_ancestors?: int[],
     *   required_measurement_concepts?: int[],
     *   population_type: 'universal'|'condition_specific'|'age_restricted'
     * }
     */
    public function eligibilityCriteria(): array;
}
```

Universal scores (Charlson, Elixhauser, Multimorbidity) apply to any cohort. Condition-specific scores (CHADS2-VASc, MELD) only apply when the cohort contains the prerequisite condition.

### 2. Runtime Vocabulary Resolution

`App\Services\PopulationRisk\ConceptResolutionService`

Replaces hardcoded concept IDs with runtime lookups:

```php
class ConceptResolutionService {
    /**
     * Resolve all descendant concept IDs for a clinical ancestor concept.
     * Uses concept_ancestor hierarchy for correct OMOP mapping.
     */
    public function resolveDescendants(
        int $ancestorConceptId,
        string $connection,
        string $vocabSchema,
    ): array;

    /**
     * Find the standard concept ID for a clinical term.
     * Queries vocab.concept with exact or fuzzy matching.
     */
    public function findConcept(
        string $conceptName,
        string $domainId,
        string $connection,
        string $vocabSchema,
    ): ?int;
}
```

Each score declares its condition groups as **semantic labels with validated ancestor concept IDs**:

```php
// In RS005CharlsonComorbidityIndex
public function conditionGroups(): array {
    return [
        ['label' => 'Myocardial infarction', 'ancestor' => 4329847, 'weight' => 1],
        ['label' => 'Congestive heart failure', 'ancestor' => 319835, 'weight' => 1],
        ['label' => 'Malignant neoplastic disease', 'ancestor' => 443392, 'weight' => 2],
        ['label' => 'Metastatic malignant neoplasm', 'ancestor' => 432851, 'weight' => 6],
        // ... etc
    ];
}
```

At execution time, the engine resolves each ancestor to its full descendant set via `concept_ancestor`, and constructs the SQL dynamically. This way:
- Concept IDs are validated against the actual vocabulary at runtime
- Different vocabulary versions produce correct results
- No more hardcoded, potentially wrong concept IDs in SQL templates

### 3. Cohort-Scoped Execution Engine

`App\Services\PopulationRisk\RiskScoreExecutionService`

Replaces `PopulationRiskScoreEngineService`. Executes scores scoped to a target cohort:

```php
class RiskScoreExecutionService {
    public function execute(
        RiskScoreAnalysis $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void;
}
```

**SQL generation pattern:** Instead of querying `{@cdmSchema}.person` directly, the engine JOINs against the cohort table:

```sql
WITH cohort_patients AS (
    SELECT DISTINCT subject_id AS person_id
    FROM {resultsSchema}.cohort
    WHERE cohort_definition_id = {targetCohortId}
),
eligible AS (
    SELECT p.person_id, ...
    FROM {cdmSchema}.person p
    INNER JOIN cohort_patients cp ON p.person_id = cp.person_id
    WHERE ...
)
```

This scopes every score to the target cohort membership.

**Execution tracking:** Uses the existing `AnalysisExecution` model with step-level tracking (same pattern as Achilles):

```
RiskScoreAnalysis (app.risk_score_analyses)
  └─ AnalysisExecution (app.analysis_executions, morphed)
       └─ RiskScoreRunStep (app.risk_score_run_steps)
            - score_id, status, elapsed_ms, error_message
```

### 4. Patient-Level Results

New table: `app.risk_score_patient_results`

```sql
CREATE TABLE app.risk_score_patient_results (
    id                  bigserial PRIMARY KEY,
    execution_id        bigint NOT NULL REFERENCES app.analysis_executions(id),
    source_id           bigint NOT NULL,
    cohort_definition_id bigint NOT NULL,
    person_id           bigint NOT NULL,
    score_id            varchar(10) NOT NULL,
    score_value         numeric,
    risk_tier           varchar(20),
    confidence          numeric,
    completeness        numeric,
    missing_components  jsonb,
    created_at          timestamp DEFAULT NOW()
);

CREATE INDEX idx_rspr_execution ON app.risk_score_patient_results (execution_id);
CREATE INDEX idx_rspr_cohort_person ON app.risk_score_patient_results (cohort_definition_id, person_id);
CREATE INDEX idx_rspr_score_tier ON app.risk_score_patient_results (score_id, risk_tier);
```

Population-level summaries (`app.population_risk_score_results`) are computed FROM patient-level results via aggregation, not stored separately.

### 5. Score Interface v2

```php
interface PopulationRiskScoreV2Interface {
    public function scoreId(): string;
    public function scoreName(): string;
    public function category(): string;
    public function description(): string;
    public function eligiblePopulation(): string;

    /**
     * Structured eligibility for recommendation engine.
     */
    public function eligibilityCriteria(): array;

    /**
     * Condition groups with ancestor concept IDs for vocab resolution.
     * Each group: label, ancestor_concept_id, weight (if applicable).
     */
    public function conditionGroups(): array;

    /**
     * Measurement concepts needed for scoring.
     * Each: label, concept_id, unit, min_valid, max_valid.
     */
    public function measurementRequirements(): array;

    /**
     * Risk tier definitions with thresholds.
     */
    public function riskTiers(): array;

    /**
     * Compute the score for a single patient given their clinical data.
     * Pure function — no database access. All data passed in.
     *
     * @param array $patientData Resolved clinical features for one patient
     * @return array{score: float|null, tier: string, confidence: float, completeness: float, missing: string[]}
     */
    public function compute(array $patientData): array;

    /**
     * Required CDM tables for feature extraction.
     */
    public function requiredTables(): array;
}
```

**Key change:** The `compute()` method is a pure function. Feature extraction (querying condition_occurrence, measurement, etc.) is handled by the engine, not by each score's SQL template. This separates data access from scoring logic.

### 6. Feature Extraction Layer

`App\Services\PopulationRisk\PatientFeatureExtractor`

Extracts clinical features for a cohort in bulk, then passes them to individual score `compute()` methods:

```php
class PatientFeatureExtractor {
    /**
     * Extract all features needed by the requested scores for the target cohort.
     * Single pass over CDM tables — efficient batch extraction.
     *
     * @return array<int, array> Map of person_id => feature array
     */
    public function extractForCohort(
        int $cohortDefinitionId,
        array $scores, // PopulationRiskScoreV2Interface[]
        Source $source,
    ): array;
}
```

Feature extraction queries are generated dynamically based on what the selected scores need:
- If any score needs conditions → query condition_occurrence with concept_ancestor
- If any score needs measurements → query measurement with the union of all needed concept_ids
- If any score needs demographics → query person
- Only query what's needed — no wasted work

## Frontend Changes

### Catalogue Page (Existing — Modified)

The existing catalogue page at `/risk-scores` becomes the "New Risk Score Analysis" creator:

1. User selects a **target cohort** (dropdown of existing cohort definitions for the active source)
2. System runs the **recommendation engine** and shows:
   - **Recommended scores** — green cards with relevance reason and expected completeness
   - **Available but not recommended** — gray cards with explanation ("cohort has <2% AF prevalence")
   - **Not applicable** — dimmed cards ("requires liver disease cohort")
3. User selects which recommended scores to include
4. User clicks "Create Analysis" → creates a `RiskScoreAnalysis` with `design_json`
5. User clicks "Run" → dispatches execution

### Analysis Detail Page (Existing — Extended)

Risk Score Analysis results display in the same analysis detail pattern as Characterization:

- Summary: cohort name, scores computed, execution date
- Per-score cards showing tier distributions (reuse existing `TierBreakdownChart`)
- Patient-level table (paginated, sortable, filterable by tier)
- Drill-through to Patient Profile
- Comparison view if comparator cohort was specified

### Risk Scores Evidence Page (Existing — Retained)

The Evidence → Risk Scores page becomes a **viewer** for all risk score analysis results across the active source. Shows the latest results per cohort per score. Links to the full analysis detail.

## API Endpoints

### New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/sources/{source}/risk-scores/recommend` | Get score recommendations for a cohort |
| POST | `/risk-score-analyses` | Create a new risk score analysis |
| GET | `/risk-score-analyses/{id}` | Get analysis detail with results |
| POST | `/risk-score-analyses/{id}/execute` | Run the analysis on a source |
| GET | `/risk-score-analyses/{id}/executions/{executionId}` | Execution progress + results |
| GET | `/risk-score-analyses/{id}/executions/{executionId}/patients` | Patient-level results (paginated) |

### Modified Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| GET | `/sources/{source}/risk-scores` | Returns latest analysis results per cohort, not raw population results |
| GET | `/sources/{source}/risk-scores/catalogue` | Unchanged — still static score metadata |
| GET | `/sources/{source}/risk-scores/eligibility` | Deprecated — replaced by `/recommend` |

### Removed Endpoints

| Method | Endpoint | Reason |
|--------|----------|--------|
| POST | `/sources/{source}/risk-scores/run` | Replaced by per-analysis execution |

## Recommendation Endpoint Detail

`POST /sources/{source}/risk-scores/recommend`

Request:
```json
{
    "cohort_definition_id": 221
}
```

Response:
```json
{
    "cohort": {
        "id": 221,
        "name": "All PDAC Patients",
        "person_count": 361
    },
    "profile": {
        "age_range": [42, 85],
        "gender_split": { "male": 0.55, "female": 0.45 },
        "top_conditions": [
            { "concept_id": 4180793, "name": "Malignant tumor of pancreas", "prevalence": 1.00 },
            { "concept_id": 201826, "name": "Type 2 diabetes mellitus", "prevalence": 0.37 },
            { "concept_id": 134765, "name": "Cachexia", "prevalence": 0.48 }
        ],
        "measurement_coverage": {
            "3022914": 1.00,
            "3024128": 1.00,
            "3000963": 1.00
        }
    },
    "recommendations": [
        {
            "score_id": "RS005",
            "score_name": "Charlson Comorbidity Index",
            "category": "Comorbidity Burden",
            "applicable": true,
            "relevance": "high",
            "reason": "100% of cohort has malignancy conditions; 37% have diabetes",
            "expected_completeness": 1.0,
            "missing_components": []
        },
        {
            "score_id": "RS006",
            "score_name": "Elixhauser Index",
            "category": "Comorbidity Burden",
            "applicable": true,
            "relevance": "high",
            "reason": "Broad comorbidity assessment applicable to cancer cohorts",
            "expected_completeness": 1.0,
            "missing_components": []
        },
        {
            "score_id": "RS013",
            "score_name": "FIB-4 Index",
            "category": "Hepatic",
            "applicable": true,
            "relevance": "medium",
            "reason": "Liver function relevant for chemo hepatotoxicity monitoring; labs available",
            "expected_completeness": 0.95,
            "missing_components": []
        },
        {
            "score_id": "RS003",
            "score_name": "CHA2DS2-VASc",
            "category": "Cardiovascular",
            "applicable": false,
            "relevance": "none",
            "reason": "<1% atrial fibrillation prevalence in cohort",
            "expected_completeness": null,
            "missing_components": ["atrial_fibrillation_diagnosis"]
        }
    ]
}
```

## Database Schema Changes

### New Tables

```sql
-- Risk Score Analysis definition (like Characterization)
CREATE TABLE app.risk_score_analyses (
    id                  bigserial PRIMARY KEY,
    name                varchar(255) NOT NULL,
    description         text,
    design_json         jsonb NOT NULL,
    author_id           bigint REFERENCES app.users(id),
    created_at          timestamp DEFAULT NOW(),
    updated_at          timestamp DEFAULT NOW(),
    deleted_at          timestamp
);

-- Patient-level results
CREATE TABLE app.risk_score_patient_results (
    id                   bigserial PRIMARY KEY,
    execution_id         bigint NOT NULL,
    source_id            bigint NOT NULL,
    cohort_definition_id bigint NOT NULL,
    person_id            bigint NOT NULL,
    score_id             varchar(10) NOT NULL,
    score_value          numeric,
    risk_tier            varchar(20),
    confidence           numeric,
    completeness         numeric,
    missing_components   jsonb,
    created_at           timestamp DEFAULT NOW()
);

-- Execution step tracking (per-score within a run)
CREATE TABLE app.risk_score_run_steps (
    id              bigserial PRIMARY KEY,
    execution_id    bigint NOT NULL,
    score_id        varchar(10) NOT NULL,
    status          varchar(20) DEFAULT 'pending',
    started_at      timestamp,
    completed_at    timestamp,
    elapsed_ms      integer,
    patient_count   integer,
    error_message   text,
    created_at      timestamp DEFAULT NOW()
);
```

### Retained Tables

- `app.population_risk_score_results` — Retained for backward compatibility, now computed as aggregation views over patient-level results

## design_json Schema

```json
{
    "targetCohortIds": [221],
    "comparatorCohortIds": [],
    "scoreIds": ["RS005", "RS006", "RS013", "RS020"],
    "minCompleteness": 0.5,
    "storePatientLevel": true
}
```

## Migration Path from v1

1. v1 frontend (catalogue cards, run modal, detail page) remains functional during v2 development
2. v2 adds the recommendation flow and cohort-scoped execution alongside v1
3. Once v2 is stable, deprecate v1's "Run All" endpoint
4. v1 population_risk_score_results table retained; new patient-level table added
5. The 20 score implementations migrate from `PopulationRiskScoreInterface` to `PopulationRiskScoreV2Interface` incrementally — each score gets vocab-validated concept IDs and a pure `compute()` method

## Implementation Phases

### Phase A: Core Infrastructure
- `RiskScoreAnalysis` model + migration
- `RiskScoreRunStep` model + migration
- `risk_score_patient_results` table + migration
- `ConceptResolutionService` (vocab lookup)
- `PatientFeatureExtractor` (bulk feature extraction)
- Updated `PopulationRiskScoreV2Interface`

### Phase B: Recommendation Engine + Execution
- `RiskScoreRecommendationService`
- `RiskScoreExecutionService` (cohort-scoped, patient-level)
- `POST /recommend` endpoint
- `POST /risk-score-analyses` + execution endpoints
- Migrate RS005 (Charlson) to v2 interface as proof of concept

### Phase C: Frontend — Analysis Creator
- Cohort selector + recommendation display
- Score selection UI
- Analysis creation flow
- Execution with Achilles-pattern modal

### Phase D: Frontend — Results & Patient Drill-Through
- Analysis detail page with per-score tier breakdowns
- Patient-level results table (filterable, sortable)
- Drill-through to Patient Profile
- Risk Scores Evidence page (aggregated view)

### Phase E: Score Migration
- Migrate remaining 19 scores from v1 to v2 interface
- Each score gets vocab-validated ancestor concept IDs
- Pure `compute()` method replacing SQL templates
- Deprecate v1 "Run All" endpoint

## Out of Scope

- Cohort builder integration (risk score as inclusion criterion) — Phase 3 future work
- Custom score creation UI (users define their own scoring rules)
- Cross-source comparison (network-level risk score comparison — already handled by NA007)
- Real-time scoring (compute on individual patient at point of care)
- Score calibration/validation against outcomes
