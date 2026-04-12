---
slug: care-bundles-ecqm-library
title: "From 10 to 45: Building an OHDSI-Compliant eCQM Care Bundle Library"
authors: [mudoshi, claude]
tags: [care-bundles, ecqm, ohdsi, omop, circe, cohort-definitions, concept-sets, quality-measures, vocabulary, rxnorm, loinc, snomed, ai, debugging]
date: 2026-04-12
---

Parthenon's Cohort Definitions page has always had a "Create from Care Bundle" modal — a way to bootstrap a cohort definition from a pre-packaged disease framework with ICD-10 patterns, OMOP concepts, and quality measures. The idea is elegant: select "Rheumatoid Arthritis," click a button, and get a fully-formed OHDSI Circe cohort expression ready to run against any CDM source.

But when I opened the modal this weekend, I saw only **ten bundles**. Type 2 Diabetes, Hypertension, Heart Failure, COPD, Asthma, and a handful of others. Meanwhile, the [Medgnosis project](https://github.com/sudoshi/Medgnosis) — our sister platform for population health intelligence — has a library of **45 care bundles** covering everything from Systemic Lupus Erythematosus to Post-Traumatic Stress Disorder, each mapped to CMS Electronic Clinical Quality Measures (eCQMs). The data was sitting there in three SQL migration files. Parthenon just didn't know about it.

That observation kicked off what became a seven-hour deep dive into OHDSI vocabulary semantics, Circe expression compliance, and the kind of database integrity issues that only reveal themselves when you actually try to compile a cohort definition into executable SQL. By the end, we had 45 bundles, 338 quality measures, 928 verified OMOP concept IDs — and we caught eleven bugs along the way, several of which would have silently produced wrong cohorts in production.

This is the story of how we got there.

<!-- truncate -->

## Why Care Bundles Matter

Before diving in, it's worth understanding why we built this feature in the first place. OHDSI's Atlas has Concept Sets and Cohort Definitions, but each one is a blank slate. A researcher studying Rheumatoid Arthritis management has to know the ICD-10 codes for RA (M05, M06), the SNOMED concepts for the condition, the RxNorm ingredients for DMARDs (methotrexate, adalimumab, etanercept, infliximab...), the LOINC codes for DAS28 disease activity scoring, and the CPT codes for DXA bone density scans. Then they have to assemble all of that into a Circe expression with proper lookback windows, inclusion criteria, and observation periods.

Care bundles collapse that entire workflow into a single click. They're curated, guideline-aligned, eCQM-traceable packages that produce OHDSI-compliant cohort definitions and concept sets on demand. When a user selects "Chronic Kidney Disease," they're not starting from zero — they're starting from the nephrology community's collective judgment about what matters for CKD population health.

Here's what each bundle carries:

- **ICD-10 patterns** (e.g., `N18.%` for CKD) for quick patient identification
- **OMOP standard concept IDs** (vocabulary-verified Condition-domain concepts)
- **eCQM references** (CMS122v12, CMS134v12, ACR Guideline, AASLD Guideline)
- **Quality measures** — numerator/denominator criteria with concept sets per measure
- **Overlap rules** — deduplication logic when measures are shared across bundles (e.g., blood pressure control applies to HTN, DM, CAD, HF, CKD, AFib, PAD)

When a user creates a cohort from a bundle, the system generates a complete OHDSI Circe v1 expression — the kind Atlas would produce after an hour of clicking — with primary criteria, additional criteria, concept sets, observation windows, and collapse settings all properly structured.

## Step 1: Porting 35 Missing Bundles

The Medgnosis SQL files were organized in three batches:

- `007_seed_bundles_v1.sql` — bundles 1-15 (DM, HTN, CAD, HF, COPD, ASTH, CKD, AFIB, MDD, OSTEO, OB, CLD, RA, PAD, HYPO)
- `008_seed_bundles_v2.sql` — bundles 16-30 (ALZ, STR, PAIN, OA, GERD, BPH, MIG, EPI, HIV, HCV, SCD, SLE, GOUT, OSA, GAD)
- `009_seed_bundles_v3.sql` — bundles 31-45 (T1D, IBD, MS, PD, PSO, HBV, PAH, ANEM, LIPID, PTSD, BP, TOB, AUD, VTE, WND)

Parthenon already had the first 10 (minus OSTEO — Medgnosis lists OSTEO as bundle #10 but Parthenon's seeder had OB as #10, a numbering discrepancy that became one of the first bugs we hit). That meant porting 35 bundles with about 270 measures.

The Medgnosis format was PostgreSQL DO-blocks using `phm_edw` schema. Parthenon's format is PHP Laravel seeders with Eloquent models. We needed to translate:

```sql
-- Medgnosis
INSERT INTO phm_edw.condition_bundle
  (bundle_code, condition_name, icd10_pattern, bundle_size, key_ecqm_refs, description)
VALUES ('RA', 'Rheumatoid Arthritis', 'M05%,M06%', 8,
  'ACR Guideline, ACC/AHA', 'Disease activity monitoring...');
```

into:

```php
// Parthenon
[
    'bundle_code' => 'RA',
    'condition_name' => 'Rheumatoid Arthritis',
    'icd10_patterns' => ['M05%', 'M06%'],
    'omop_concept_ids' => [80809, 4035611],
    'ecqm_references' => ['ACR Guideline', 'ACC/AHA'],
    'disease_category' => 'Musculoskeletal',
    'is_active' => true,
    'measures' => [ /* 8 measures */ ],
],
```

The tricky part: Medgnosis's SQL doesn't carry `omop_concept_ids` or `disease_category` — those are Parthenon-specific. We had to look up OMOP standard concepts for each condition and categorize by organ system. For every bundle, we needed to identify the seed SNOMED concept(s) that would serve as the primary condition criterion for cohort definitions.

## Step 2: Discovering the Invisible Bug

We created `AdditionalConditionBundleSeeder.php`, ran it, and confirmed 45 bundles in the database. The modal showed all 45. The feature "worked."

Then we started auditing.

```
Bundle size mismatches: 10
  DM: declared=8, actual=0
  HTN: declared=6, actual=0
  CAD: declared=7, actual=0
  HF: declared=6, actual=0
  ...
```

**The original 10 bundles had zero measures linked in the junction table.**

This was a time bomb that had been sitting in the codebase for weeks. The original `ConditionBundleSeeder.php` defined 56 quality measures across 10 bundles, but the seeder had never actually been run after its migration. The bundles existed. The measure definitions in the seeder code existed. But `bundle_measures` — the table that links them — was empty for those 10 bundles.

Users creating cohorts from the DM bundle would get a cohort with just the condition criterion. No HbA1c monitoring, no retinal exam, no nephropathy screening — none of the quality measures the bundle was supposed to carry. Silent failure. No error. The modal looked right, the API returned successfully, but the semantic content was missing.

Fix: `php artisan db:seed --class=ConditionBundleSeeder --force`. The seeder is idempotent (uses `firstOrCreate`), so running it populated the missing measures without duplicating existing bundles.

## Step 3: The Hay Rake Incident

With 45 bundles and 338 measures in place, we ran the OHDSI compliance check:

```
[FAIL] Bundle omop_concept_ids are valid Condition concepts: 9 issues
  DM: invalid concept_ids = [4193704, 443238]
  PSO: invalid concept_ids = [4216061]
  ...
```

Querying the vocabulary for each "bad" concept produced some disturbing results:

```
PSO - bad concept IDs:
  4216061: Hay rake | domain=Device | vocab=SNOMED | std=S
```

Our Psoriasis bundle had "Hay rake" as one of its primary concept IDs.

This was my error during the porting step. I had used some plausible-looking concept IDs without verifying them against the vocabulary. A "hay rake" (the agricultural implement) is a standard SNOMED device concept, but it is decidedly not a clinical finding for psoriasis. Similarly:

- **DM**: `4193704` was "Type 2 diabetes mellitus without complication" — *invalid* (deprecated)
- **OB**: `4215968` was "Obese" — Observation domain, not Condition
- **EPI**: `4214956` was "History of clinical finding in subject" — way too generic
- **SCD**: `4128331` was "Pregnancy" — completely unrelated
- **TOB**: `4218917` was "Pipe smoker" — non-standard
- **WND**: `4158817` was "Assessment of psychosocial issues specific to patient nutritional status" — a procedure, not a condition

The right approach was to traverse the OMOP concept_relationship graph. For Sickle Cell Disease, the canonical mapping is: start with ICD-10 code `D57`, find its "Maps to" relationship in concept_relationship, and that gives you the standard SNOMED concept:

```sql
SELECT c2.concept_id, c2.concept_name
FROM vocab.concept c1
JOIN vocab.concept_relationship cr ON cr.concept_id_1 = c1.concept_id
JOIN vocab.concept c2 ON c2.concept_id = cr.concept_id_2
WHERE c1.concept_code = 'D57' AND c1.vocabulary_id = 'ICD10CM'
  AND cr.relationship_id = 'Maps to'
  AND c2.standard_concept = 'S' AND c2.domain_id = 'Condition';

-- Result: 22281, 'Sickle cell-hemoglobin SS disease'
```

That's the concept you want — SNOMED, Condition domain, standard, invalid_reason null. With `includeDescendants=true` in the concept set, it automatically captures all SCD variants.

We fixed all 9 bundles and updated the `denominator_criteria` on their measures to reference the corrected condition concept IDs.

## Step 4: Using Hecate to Populate 282 Measure Concept Sets

Once the bundles were structurally sound, we needed to populate the `numerator_criteria.concept_ids` for every quality measure. The Medgnosis SQL didn't carry these — they had the measure names ("DMARD Therapy Prescribed") and the frequency ("Annually") but no OMOP concept IDs. We needed to map each of 282 measure names to a set of appropriate standard concepts.

Parthenon has [Hecate](https://github.com/OHDSI/Hecate), OHDSI's semantic vocabulary search engine — a Rust service backed by Qdrant vector embeddings over `nomic-embed-text`. Hecate can take a natural-language query like "DMARD Therapy" and return ranked OMOP concepts by semantic similarity. It runs on port 8088 in our Docker stack.

In practice, for this task, we found direct SQL against `vocab.concept` was more precise. Hecate excels at *discovery* (finding concepts you didn't know about) while SQL filters excel at *enforcement* (guaranteeing OHDSI compliance rules). For each measure, we knew what we wanted — we just needed to query it with the right constraints:

```python
# OHDSI standard: drugs use RxNorm Ingredient level
query = """
    SELECT concept_id FROM (
        SELECT DISTINCT c.concept_id, c.concept_id AS sort_key
        FROM vocab.concept c
        WHERE c.concept_name ILIKE %s
          AND c.standard_concept = 'S'
          AND c.domain_id = 'Drug'
          AND c.concept_class_id = 'Ingredient'
          AND c.invalid_reason IS NULL
    ) sub ORDER BY sort_key LIMIT 3
"""
```

The script encoded OHDSI conventions per domain:

- **Drugs**: `Ingredient` concept class (not Clinical Drug Comp, not Branded Drug) — ingredient-level concepts capture all formulations via descendant expansion
- **Measurements**: Prefer LOINC vocabulary
- **Procedures**: Prefer SNOMED, fall back to CPT4
- **Observations**: Allow Observation/Measurement/Condition domains

We built a mapping from measure code → search terms. For RA-02 ("DMARD Therapy Prescribed"):

```python
"RA-02": {
    "search": ["methotrexate", "hydroxychloroquine", "sulfasalazine",
               "leflunomide", "adalimumab", "etanercept", "infliximab",
               "tofacitinib"],
    "domain": "Drug",
    "table": "drug_exposure",
    "lookback": 365,
},
```

That produced 10 RxNorm Ingredient concepts: `937368 (infliximab), 964339 (sulfasalazine), 1101898 (leflunomide), 1119119 (etanercept)...`

After one pass, 254 of 282 measures had concepts. The other 28 needed broader searches — concepts like "Caregiver burden assessment" or "Carotid duplex ultrasound" required looking outside the preferred vocabularies. A second pass using relationship-graph-aware queries (following `ICD10CM → Maps to → SNOMED` links) closed the gap.

## Step 5: The Domain Coherence Problem

With 282 measures populated, we ran a validation check that exposed the most subtle bug in the whole sequence:

```
Domain/concept mismatches: 65 measures
  ALZ-01: concepts are: [('Measurement', 4), ('Observation', 5)] [mixed_domains]
  PAIN-07: concepts are: [('Procedure', 9)] [wrong_domain, declared observation]
  MIG-02: concepts are: [('Drug', 5)] [wrong_domain, declared observation]
  LIPID-02: concepts are: [('Measurement', 3)] [wrong_domain, declared observation]
```

Here's why this matters. The controller that builds the Circe expression picks a criterion type from the measure's `domain` field:

```php
return match ($domain) {
    'measurement' => 'Measurement',
    'drug' => 'DrugExposure',
    'procedure' => 'ProcedureOccurrence',
    'observation' => 'Observation',
    'condition' => 'ConditionOccurrence',
    default => null,
};
```

A measure declared `domain=observation` tells Circe to look in `omop.observation` for the concept IDs — but if those concept IDs are actually Measurement-domain concepts, they'll never be found there. The cohort query would silently return zero patients even when patients clearly exist in the data.

The real world of clinical vocabulary is messier than a clean domain split. A "PHQ-9 Depression Screen" might be coded as Observation in one EHR and Measurement in another. A "Lipoprotein(a) Testing" looks like an observation but is a lab test. "Post-Stroke Depression Screening" uses PHQ-9 concepts that the vocab classifies as Measurement, not Observation.

The fix was mechanical but important: for each measure, we queried the actual OMOP domain of each of its concept IDs, picked the dominant domain, filtered the concept list to only that domain, and updated both the `domain` field and the `table` field on the measure. Ninety percent of measures had a clean dominant domain; a few had genuinely mixed concepts that we split into domain-coherent subsets.

After normalization: 0 mismatches. Every measure's `concept_ids` now live in the OMOP domain matching its declared criterion type.

## Step 6: Four Bad Vaccine Concepts

During the final concept validation, we found four concept IDs that didn't exist in our vocabulary at all:

```
{40213152, 40213154, 40213160, 40213186}
```

These were in COPD-03 (Influenza Vaccination) and COPD-04 (Pneumococcal Vaccination) — leftover CVX codes from the original seeder, from an era when Parthenon's vocabulary setup was different. They had never been standard concepts in our vocab.

We replaced them with proper RxNorm Ingredient concepts:

```python
# Flu vaccine
42903441: influenza A virus (Ingredient)
42903442: influenza B virus (Ingredient)

# Pneumococcal
36879032: Pneumococcal Purified Capsular Polysaccharides (Ingredient)
36878946: Pneumococcal polysaccharide conjugate serotype 6A in CRM197 carrier protein (Ingredient)
```

With `includeDescendants=true`, the `influenza A virus` ingredient concept captures all flu vaccine variants in the RxNorm graph.

## Step 7: The Circe StartWindow Bug

With the data clean, we turned to the cohort expression builder. The controller method that translates a bundle into a Circe expression looked like this:

```php
$additionalCriteriaList[] = [
    'Criteria' => [$domainType => ['CodesetId' => $conceptSetIndex]],
    'StartWindow' => [
        'Start' => ['Days' => $lookbackDays, 'Coeff' => -1],
        'End' => ['Days' => $lookbackDays, 'Coeff' => 1],
    ],
    'Occurrence' => ['Type' => 2, 'Count' => 1],
];
```

That `StartWindow` has `Start` at `-lookbackDays` and `End` at `+lookbackDays`. For a 365-day measurement, this creates a window from 365 days before the index date to 365 days after — a total 730-day window that includes future events relative to the cohort entry.

That's not how OHDSI care gap analysis works. You look *backward* from the index date: "in the 365 days prior to this patient's RA diagnosis, did they have a DAS28 score recorded?" A forward-looking window captures events the patient hadn't had yet at cohort entry, which violates causality for most quality measures.

The fix:

```php
'StartWindow' => [
    'Start' => ['Days' => $lookbackDays, 'Coeff' => -1],  // N days before index
    'End' => ['Days' => 0, 'Coeff' => 1],                  // AT index date
    'UseIndexEnd' => false,
    'UseEventEnd' => false,
],
'Occurrence' => ['Type' => 2, 'Count' => 1, 'IsDistinct' => false],
'RestrictVisit' => false,
'IgnoreObservationPeriod' => false,
```

We also added the full set of Circe fields (`UseIndexEnd`, `UseEventEnd`, `IsDistinct`, `RestrictVisit`, `IgnoreObservationPeriod`) that the OHDSI Circe schema expects. Tools like the Atlas JSON importer will complain if these aren't present.

## Step 8: Concept Metadata Resolution

The original controller built Circe concept set items with placeholder metadata:

```php
'concept' => [
    'CONCEPT_ID' => $id,
    'CONCEPT_NAME' => $measure->measure_name,  // ← same for every concept!
    'DOMAIN_ID' => $this->mapDomainToOmop($measure->domain),
    'VOCABULARY_ID' => '',                      // ← empty
    'CONCEPT_CLASS_ID' => '',                   // ← empty
    'STANDARD_CONCEPT' => 'S',
    'CONCEPT_CODE' => '',
],
```

This meant a DMARD concept set would have ten items all named "DMARD Therapy Prescribed" with no vocabulary or concept class. When imported into Atlas, those concept sets look like garbage — users can't tell methotrexate from infliximab from etanercept because they all display the same name.

We added a vocab lookup:

```php
$conceptMeta = DB::connection('vocab')
    ->table('vocab.concept')
    ->whereIn('concept_id', $conceptIds)
    ->get(['concept_id', 'concept_name', 'domain_id',
           'vocabulary_id', 'concept_class_id',
           'standard_concept', 'concept_code'])
    ->keyBy('concept_id');

$measureItems = collect($conceptIds)->map(function ($id) use ($conceptMeta) {
    $meta = $conceptMeta->get($id);
    return [
        'concept' => [
            'CONCEPT_ID' => $id,
            'CONCEPT_NAME' => $meta->concept_name,
            'DOMAIN_ID' => $meta->domain_id,
            'VOCABULARY_ID' => $meta->vocabulary_id,
            'CONCEPT_CLASS_ID' => $meta->concept_class_id,
            'STANDARD_CONCEPT' => $meta->standard_concept,
            'CONCEPT_CODE' => $meta->concept_code,
        ],
        'isExcluded' => false,
        'includeDescendants' => true,
        'includeMapped' => false,
    ];
})->values()->all();
```

Now when a user views the generated cohort definition, they see the real vocabulary: `infliximab (RxNorm Ingredient, code 191831)`, `methotrexate (RxNorm Ingredient, code 6851)`, `Rheumatoid arthritis (SNOMED Disorder, code 69896004)`.

## Step 9: The CDM Source Isolation Wall

We introduced `DB::connection('omop')` into the controller to look up vocab concepts. PHPStan level 8 immediately rejected it:

```
Direct DB::connection('omop') is banned. Use the SourceAware trait:
$this->cdm(), $this->results(), or $this->vocab().
See docs/superpowers/specs/2026-03-26-cdm-source-isolation-design.md
```

Parthenon has a strict CDM source isolation rule — controllers that query CDM data must go through a trait that routes to the correct source based on request context. The reason: Parthenon supports multiple CDM sources (Acumenus, SynPUF, IRSF, Pancreas, MIMIC-IV) and they have different schemas. Hardcoding `'omop'` in a controller means the code only works for the Acumenus source.

We switched to the `SourceAware` trait and `$this->vocab()`. Clean Pint, clean PHPStan, clean code.

But when we tested the endpoint at runtime:

```json
{"error":"Failed to create cohort from bundle",
 "message":"Source context required but not set."}
```

The SourceAware trait requires a `SourceContext` to be populated by middleware. The care-bundles endpoint doesn't have that middleware because it doesn't query CDM data — it only queries the shared vocabulary schema, which is the same for every source. The trait's abstraction was wrong for our use case.

The resolution: Parthenon has a dedicated `vocab` database connection in `config/database.php`, parallel to the `omop`, `results`, `gis` connections. It targets the shared `vocab` schema without requiring source context. We switched to `DB::connection('vocab')`, and the PHPStan rule accepts it because `vocab` isn't one of the source-specific connections on the banned list.

## Step 10: The "Empty Cohort" Bug That Almost Shipped

With everything compiling and passing static analysis, we built a Sanctum token and invoked the endpoint against live data. The RA bundle created a cohort definition. Beautiful Circe expression, valid SQL, clean compilation. We ran it against the Acumenus CDM.

```
Patients: 0
```

That was surprising. RA is common — we expected at least a few thousand patients in a million-patient CDM. We switched to `include_measures=false` to isolate the primary criteria:

```
Patients: 2,662
```

OK — the RA condition cohort has 2,662 patients, as expected. Adding the 8 quality measures dropped it to zero. Let's try diabetes, which should be massive:

```
DM primary only: 74,800 patients
DM with measures: 0 patients
```

Seventy-four thousand diabetic patients, and not one of them had all 8 quality measures (HbA1c, retinal exam, nephropathy screening, blood pressure, statin therapy, foot exam, self-management education, poor-control flag) documented in the past year.

That's actually... realistic. Real-world population health data *always* has care gaps. In fact, if every diabetic patient had every quality measure completed, there would be no need for care gap analysis in the first place. The Circe expression was requiring the intersection of all measures — semantically correct OHDSI Circe `Type=ALL`, but useless as a default.

The question was: what *should* happen when a user clicks "Create Cohort from Bundle?" Three interpretations:

1. **Eligible population**: all patients with the condition (primary criteria only)
2. **Compliant population**: all patients with the condition AND all quality measures completed
3. **Gap population**: all patients with the condition AND missing quality measures

The old default was interpretation #2, which produces an empty cohort for almost every real dataset. Interpretation #3 requires more complex Circe (exclusion logic), and interpretation #1 is the safe, useful starting point — researchers can layer additional filters on top.

We flipped the default from `true` to `false` for `include_measures`. The toggle remains in the UI for users who want compliant-population cohorts, but its label now reads "Require all quality measures completed (filters to compliant patients)" — so the implication is explicit.

## Step 11: End-to-End Validation

With all fixes in place, we ran the complete test suite against live data:

```
Test                                                Result
─────────────────────────────────────────────────────────────
GET /api/v1/care-bundles?per_page=200               45 bundles returned ✓
POST /cohort-definitions/from-bundle (RA, measures) Cohort 240, 9 ConceptSets ✓
Circe expression inspection                         Real concept names, codes ✓
Circe → PostgreSQL SQL compilation                  9,187 chars, valid ✓
Execute SQL against live omop                       0 errors ✓
RA primary-only                                     2,662 patients ✓
DM primary-only                                     74,800 patients ✓
POST /concept-sets/from-bundle (PAD)                5 domain-grouped sets ✓
Edge: non-existent bundle_id                        422 validation error ✓
Edge: HIV bundle (10 measures, largest)             11,078 chars, executes ✓
Pint + PHPStan level 8 + TypeScript                 All pass ✓
```

The generated SQL has the right structure:

```sql
-- Descendant expansion for primary condition
codesetId_0 AS MATERIALIZED (
    SELECT DISTINCT concept_id FROM (
        SELECT concept_id FROM vocab.concept
            WHERE concept_id IN (80809, 4035611)
        UNION ALL
        SELECT ca.descendant_concept_id AS concept_id
            FROM vocab.concept_ancestor ca
            WHERE ca.ancestor_concept_id IN (80809, 4035611)
    ) included
),

-- Primary event detection
primary_events AS (
    SELECT ..., e.condition_start_date AS start_date
    FROM omop.condition_occurrence e
    JOIN omop.observation_period op ON ...
    WHERE e.condition_concept_id IN (SELECT concept_id FROM codesetId_0)
),

-- Inclusion rules (one per measure, uses AND logic for Type=ALL)
inclusion_rule_0 AS (
    SELECT DISTINCT qe.person_id
    FROM qualified_events qe
    WHERE EXISTS (
        SELECT 1 FROM omop.measurement e
        WHERE e.person_id = qe.person_id
          AND e.measurement_concept_id IN (SELECT concept_id FROM codesetId_1)
          AND e.measurement_date >= (qe.start_date + INTERVAL '-365 days')
          AND e.measurement_date <= (qe.start_date + INTERVAL '0 days')
    )
),
```

Notice the lookback window: `(qe.start_date + INTERVAL '-365 days')` to `(qe.start_date + INTERVAL '0 days')`. That's the StartWindow fix in action — no forward-looking events included.

## Final Numbers

```
Structural:
  45 bundles | 338 measures | 338 bundle-measure links | 28 overlap rules

OHDSI Compliance (all PASS):
  928/928 concept IDs exist in vocab
  928/928 are Standard concepts
  0 invalid/deprecated concepts
  0 domain/concept mismatches
  257/257 drug concepts at RxNorm Ingredient level (100%)
  45/45 bundles have valid Condition-domain concept IDs

Vocabulary distribution across concepts:
  SNOMED: 340 | LOINC: 259 | RxNorm: 188 | HCPCS: 63 | ...
```

Every concept ID in every care bundle, every quality measure, and every generated concept set has been verified against the live OMOP vocabulary. No hay rakes. No pregnancies in sickle cell bundles. No brand-name drugs where ingredient-level concepts belong.

## The 11 Bugs We Caught

This is the sort of feature that could have shipped "working" and then quietly produced wrong cohorts for months. Here's the full list of what we caught during the deep dive:

1. **Original 10 bundles had zero measures linked** — the seeder was written but never run
2. **9 bundles had invalid `omop_concept_ids`** — including a literal hay rake in PSO
3. **Circe `StartWindow.End.Days` used `lookbackDays` instead of 0** — generated future-looking windows
4. **65 measures had domain/concept mismatches** — SNOMED concepts span domains, Circe picks one table based on `domain`
5. **4 vaccine concepts didn't exist in vocab** — leftover CVX codes from a previous vocab era
6. **Concept items had placeholder names** — all concepts in a set showed the same measure name
7. **Empty `VOCABULARY_ID` / `CONCEPT_CLASS_ID`** — not compatible with Atlas imports
8. **Frontend `per_page: 50` would truncate at 51+ bundles** — no pagination handling
9. **PHPStan CDM source isolation violation** — needed `vocab` connection, not `omop`
10. **`SourceAware::vocab()` required middleware not present on bundle endpoint** — runtime 500 error
11. **`include_measures=true` default produced empty cohorts** — Circe `Type=ALL` excludes all care-gap patients

Seven of these were silent failures that wouldn't have thrown errors. They would have produced subtly wrong cohorts that looked right but returned zero patients or worse, wrong patients. The kind of bug that erodes trust in a platform.

## What This Unlocks

With 45 verified care bundles, a researcher studying any of these conditions can go from zero to a complete OHDSI Circe cohort definition in one click:

- Type 1 Diabetes (12 measures)
- Type 2 Diabetes, Hypertension, CAD, HF, COPD, Asthma
- CKD, Atrial Fibrillation, PAD, Hypothyroidism
- Rheumatoid Arthritis, SLE, Psoriasis, Osteoarthritis, Gout
- Major Depressive Disorder, Generalized Anxiety, PTSD, Bipolar, AUD, Tobacco Use Disorder
- Alzheimer's, Stroke Prevention, Parkinson's, MS, Epilepsy, Chronic Migraine
- HIV, Hepatitis B, Hepatitis C, Sickle Cell Disease
- Obesity, NAFLD/MASLD, IBD, GERD, BPH
- Pulmonary Arterial Hypertension, VTE Management
- Osteoporosis, Chronic Wound Management
- Iron Deficiency Anemia, Familial Hyperlipidemia
- OSA, Chronic Pain / Opioid Management

Each bundle carries eCQM references — CMS122v12 for diabetes, CMS165v12 for blood pressure, ACR Guideline for RA, AASLD for hepatitis. When you generate a cohort, those references flow into the cohort tags, making them traceable back to their clinical guideline source.

The same bundles generate concept sets: select PAD, get five concept sets (Conditions, Measurements, Drugs, Observations, Procedures) with the right concept IDs grouped by domain, `includeDescendants=true`, ready to use in analyses.

## Closing Thought

The original observation — "we only have 10 bundles when we should have 45" — took 30 seconds to make. The fix took seven hours, because *correctly* adding 35 bundles meant confronting the full stack: SQL schema integrity, OMOP vocabulary compliance, OHDSI Circe expression semantics, Laravel query builders, PostgreSQL CTE evaluation, Docker networking for Hecate, and the frontend state management that drives the modal.

The interesting lesson isn't about bundles specifically — it's about what "works" means for a healthcare analytics platform. A modal that shows 45 items "works." An API that returns 200 OK "works." A Circe expression that saves to the database "works." But none of those are sufficient until you compile the expression to SQL, execute it against real data, and get back a patient count that matches clinical reality.

OHDSI compliance isn't a checkbox. It's a discipline: every concept ID must be standard, every domain must match, every vocabulary must be authoritative, every lookback must be causal, every drug must be at ingredient level, every procedure must be in the right vocabulary. Each of those rules exists because someone, somewhere, shipped a cohort query that looked right and returned wrong patients.

We're building Parthenon for researchers who need to trust the platform's output. That trust is earned one rigorously-verified concept ID at a time.

---

**Files changed**:
- `backend/database/seeders/AdditionalConditionBundleSeeder.php` (35 new bundles)
- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php` (vocab lookup, StartWindow fix, include_measures default)
- `frontend/src/features/cohort-definitions/components/CreateFromBundleModal.tsx` (default toggle, clearer label)
- `frontend/src/features/concept-sets/components/CreateFromBundleModal.tsx` (pagination cap)
- `scripts/populate-measure-concepts.py` (OHDSI-compliant concept mapping script)

**Verification**: 928/928 standard concepts, 100% Ingredient-level drugs, 0 domain mismatches, Circe compiles to valid PostgreSQL, executes against live OMOP data with correct patient counts.
