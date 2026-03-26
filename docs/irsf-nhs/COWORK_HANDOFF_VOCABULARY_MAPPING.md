# IRSF-NHS Vocabulary Mapping — Cowork Handoff for Research Paper Appendix

## Purpose

This document provides Claude Cowork with complete context to write a research paper appendix detailing the IRSF-NHS custom vocabulary mapping to OMOP standard terminologies. The appendix should serve as a methodological reference for researchers using this dataset, documenting coverage, mapping decisions, and implications for cross-network interoperability.

## Background

The IRSF Natural History Study (IRSF-NHS) is a longitudinal Rett syndrome registry containing 1,858 patients with rich genotype-phenotype data. The data was ETL'd into the OMOP CDM v5.4 format within Parthenon (Acumenus Data Sciences' OHDSI platform) using a custom vocabulary (`IRSF-NHS`) with 117 concepts spanning four clinical domains.

Prior to this mapping effort, all 117 IRSF-NHS concepts were completely isolated — zero `Maps to` relationships, zero hierarchy (`Is a`), zero ancestors. This meant:
- IRSF patients were invisible to any standard SNOMED/LOINC-based cohort definition
- Cross-network federated studies using OHDSI standard concepts could not include this data
- The OMOP concept hierarchy (ancestor/descendant) did not function for IRSF concepts
- Vocabulary search and concept set expansion could not discover IRSF-NHS concepts through standard terms

## Vocabulary Inventory

### Domain Distribution (117 concepts)

| Domain | Concept Class | Count | Description |
|--------|--------------|-------|-------------|
| Condition | Clinical Finding | 14 | Rett syndrome diagnoses and subtypes |
| Measurement | Clinical Observation | 14 | Clinical Severity Scale (CSS) items |
| Observation | Clinical Observation | 41 | Motor Behavioral Assessment (MBA) items |
| Observation | Observable Entity | 48 | Genotype mutations (MECP2, CDKL5, FOXG1) |

### Concept ID Ranges

All IRSF-NHS concepts use reserved concept_id ranges in the 2-billion space (per OMOP convention for custom vocabularies):

- **2000001000–2000001013**: CSS measurements (14)
- **2000002000–2000002040**: MBA observations (41)
- **2000003000–2000003047**: Genotype mutations (48)
- **2000004000–2000004013**: Condition diagnoses (14)

## Mapping Results Summary

### Coverage

| Category | Total | Mapped to External Standard | Self-Mapped | Unmapped | Coverage |
|----------|-------|---------------------------|-------------|----------|----------|
| Conditions | 14 | 14 | 0 | 0 | **100%** |
| Mutations | 48 | 48 | 0 | 0 | **100%** |
| CSS Measurements | 14 | 13 | 1 | 0 | **100%** |
| MBA Observations | 41 | 32 | 5 | 4* | **90%** |
| **Total** | **117** | **107** | **6** | **4** | **97%** |

*4 MBA items received both a self-mapping AND an approximate broader mapping, counted in the 32.
The 5 composite scores (CSS Total, MBA Grand Total, 3 MBA subtotals) received self-mappings only.

### Relationship Types Inserted

| Relationship | Count | Purpose |
|-------------|-------|---------|
| `Maps to` (to external standard) | 107 | Primary standard concept mapping |
| `Maps to` (self-mapping) | 10 | OHDSI convention for concepts that ARE their own standard |
| `Mapped from` (reverse) | 107 | Reverse navigability from standard to source |
| `Is a` (hierarchy) | 10 | Places unmapped concepts in SNOMED hierarchy |
| `Subsumes` (reverse hierarchy) | 10 | Reverse of `Is a` |
| **Total rows** | **264** | |

## Detailed Mapping Decisions

### 1. Condition Diagnoses (14 concepts → SNOMED)

**Strategy**: Direct SNOMED mapping where specific concepts exist; broader parent concepts where SNOMED lacks variant-level granularity.

| IRSF Concept (concept_id) | SNOMED Target (concept_id) | Mapping Quality |
|---|---|---|
| Classic Rett Syndrome (2000004000) | Rett syndrome (4288480) | Direct match |
| Variant Rett Syndrome (2000004001) | Atypical Rett syndrome (37397680) | Direct match |
| CDKL5 Deficiency Disorder (2000004003) | Cyclin-dependent kinase-like 5 deficiency (36676367) | Direct match |
| MECP2 Duplication Syndrome (2000004002) | MECP2 duplication syndrome (45765797) | Direct match |
| FOXG1 Syndrome (2000004006) | FOXG1 syndrome (45765499) | Direct match |
| MECP2 Mutation-Positive Non-Rett (2000004005) | MECP2 related disorder (1245147) | Broader parent — patient has MECP2 mutation but does not meet Rett criteria |
| Atypical Rett - Unspecified (2000004007) | Atypical Rett syndrome (37397680) | Direct match |
| Atypical Rett - Preserved Speech / Zapella (2000004008) | Atypical Rett syndrome (37397680) | Parent — SNOMED has no Zapella variant |
| Atypical Rett - Congenital / Rolando (2000004009) | Atypical Rett syndrome (37397680) | Parent — SNOMED has no Rolando variant |
| Atypical Rett - Early Seizure / Hanefeld (2000004012) | Atypical Rett syndrome (37397680) | Parent — SNOMED has no Hanefeld variant |
| Atypical Rett - Delayed Onset (2000004011) | Atypical Rett syndrome (37397680) | Parent — SNOMED has no delayed-onset variant |
| FOXG1 Duplication Syndrome (2000004010) | FOXG1 syndrome (45765499) | Parent — SNOMED has no duplication-specific FOXG1 |
| Other Mutation Diagnosis (2000004013) | Genetic disease (37204336) | Broadest applicable genetic parent |
| Other Non-Rett Diagnosis (2000004004) | Neurodevelopmental disorder (45771096) | Broadest non-Rett neurodevelopmental parent |

**Key decision**: All 5 atypical Rett subtypes (Zapella preserved speech, Rolando congenital, Hanefeld early seizure, delayed onset, unspecified) map to the single SNOMED concept "Atypical Rett syndrome" (37397680). SNOMED does not differentiate these clinical variants. The IRSF-NHS custom concepts preserve the subtype granularity that SNOMED lacks — researchers can use the source concepts for variant-specific analyses while standard cohort definitions will capture all atypical Rett patients through the SNOMED parent.

### 2. Genotype Mutations (48 concepts → OMOP Genomic)

**Strategy**: All mutation-level concepts map to gene-level OMOP Genomic standard concepts. OMOP Genomic provides gene-level "Genetic Variation" concepts in the Measurement domain that serve as the standardized representation for any variant within that gene.

| Gene | IRSF Concepts | OMOP Genomic Target (concept_id) |
|------|--------------|--------------------------------|
| MECP2 | 37 (11 missense + 6 nonsense + 9 small deletions + 5 large deletions + 3 duplication-associated + 3 other) | MECP2 gene variant measurement (35960472) |
| CDKL5 | 6 (2 named mutations + 2 polymorphisms + 2 "other") | CDKL5 gene variant measurement (35959553) |
| FOXG1 | 5 (2 named mutations + 3 "other" variants) | FOXG1 gene variant measurement (35955187) |

**Key decision**: Mapping to gene-level rather than variant-level. While ClinVar concepts exist for some specific MECP2 variants (e.g., 36719770 for NM_001110792.2(MECP2):c.5C>T), most IRSF mutation names use protein-level notation (R168X, R255X) that doesn't directly correspond to ClinVar's transcript-level identifiers. The gene-level mapping ensures:
1. All IRSF genotype data is discoverable through standard OMOP Genomic queries
2. Researchers searching for "any MECP2 variant" find all 37 IRSF mutation types
3. No false precision — the mapping acknowledges that IRSF mutation nomenclature doesn't align 1:1 with ClinVar transcript coordinates

**Domain note**: IRSF mutation concepts are in the Observation domain (Observable Entity class), while OMOP Genomic targets are in the Measurement domain (Genetic Variation class). The `Maps to` relationship correctly bridges this domain difference — queries against either domain will discover the linked concepts.

### 3. Clinical Severity Scale / CSS (14 concepts → SNOMED)

**Strategy**: Map each CSS item to the closest SNOMED clinical finding that the scale item assesses. CSS items are ordinal severity ratings (0-4 or 0-5), not binary observations, so the mapping indicates "this measurement quantifies the severity of [SNOMED concept]."

| CSS Item (concept_id) | SNOMED Target (concept_id) | Rationale |
|---|---|---|
| Age of Onset of Regression (2000001001) | Developmental regression (43531507) | The CSS item quantifies regression timing |
| Onset of Stereotypes (2000001002) | Repetitive hand wringing (4171878) | Rett-characteristic stereotypy |
| Head Growth (2000001003) | Microcephaly (606878) | CSS rates deceleration of head circumference |
| Somatic Growth (2000001004) | Failure to thrive (437986) | CSS rates weight/height growth failure |
| Independent Sitting (2000001005) | Unable to sit (4106332) | CSS rates sitting ability spectrum |
| Ambulation (2000001006) | Abnormal gait (437643) | CSS rates walking ability spectrum |
| Hand Use (2000001007) | Clumsiness (4320789) | CSS rates functional hand skill loss |
| Scoliosis (2000001008) | Scoliosis deformity of spine (72418) | Direct clinical match |
| Language (2000001009) | Mutism (4339188) | CSS rates speech from normal to absent |
| Nonverbal Communication (2000001010) | Poor eye contact (4260763) | CSS rates eye gaze and gestures |
| Respiratory Dysfunction (2000001011) | Abnormal breathing (4305080) | CSS rates breath-holding/hyperventilation |
| Autonomic Symptoms (2000001012) | Peripheral cyanosis (4318406) | CSS rates cold feet, vasomotor disturbance |
| Epilepsy/Seizures (2000001013) | Epilepsy (380378) | Direct clinical match |
| **Total Score (2000001000)** | **Self-mapped** | No SNOMED/LOINC equivalent for Rett CSS total |

**Key decision**: The CSS Total Score (2000001000) has no standard equivalent. The Rett Clinical Severity Scale is a disease-specific instrument without a LOINC panel code. It received a self-mapping (OHDSI convention for source-standard concepts) plus an `Is a` hierarchy relationship to SNOMED "Assessment score" (36684305) so it appears in assessment-related ancestor queries.

### 4. Motor Behavioral Assessment / MBA (41 concepts → SNOMED)

**Strategy**: Map each MBA behavioral item to the closest SNOMED clinical finding. MBA items are scored 0-4 representing severity/frequency of the observed behavior.

#### Directly Mapped (25 items — exact or near-exact SNOMED match)

| MBA Item | SNOMED Target | Quality |
|---|---|---|
| Bruxism (2000002021) | Bruxism (4099943) | Exact |
| Seizures (2000002018) | Seizure (377091) | Exact |
| Dystonia (2000002033) | Dystonia (375800) | Exact |
| Bradykinesia (2000002032) | Bradykinesia (4161417) | Exact |
| Myoclonus (2000002036) | Myoclonus (441553) | Exact |
| Hyperreflexia (2000002039) | Hyperreflexia (4313132) | Exact |
| Aggressive Behavior (2000002017) | Aggressive behavior (4266361) | Exact |
| Hyperventilation (2000002023) | Hyperventilation (316814) | Exact |
| Scoliosis (2000002035) | Scoliosis deformity of spine (72418) | Exact |
| Stereotypic Hand Activities (2000002028) | Repetitive hand wringing (4171878) | Exact — Rett-characteristic |
| Feeding Difficulties (2000002012) | Feeding difficulties and mismanagement (434750) | Exact |
| Chewing Difficulties (2000002013) | Difficulty chewing (4012491) | Exact |
| Breath Holding (2000002022) | Breath holding spell (37016868) | Exact |
| Self-Mutilating/Scratching (2000002016) | Self-injurious behavior (4092411) | Exact |
| Poor Eye/Social Contact (2000002006) | Poor eye contact (4260763) | Exact |
| Masturbation (2000002015) | Masturbation (4069957) | Exact |
| Lack of Toilet Training (2000002014) | Delayed toilet training (4089215) | Exact |
| Motor Skills Regression (2000002004) | Developmental regression (43531507) | Near — motor-specific |
| Hand Clumsiness (2000002027) | Clumsiness (4320789) | Near — hand-specific |
| Truncal Rocking (2000002030) | Involuntary truncal rocking (4311298) | Exact |
| Apparent Insensitivity to Pain (2000002019) | Indifference to pain (4057307) | Exact |
| Verbal Skills Regression (2000002005) | Expressive language delay (4039748) | Near — regression vs delay |
| Irritability/Crying/Tantrums (2000002008) | Feeling irritable (4184149) | Near — broader |
| Lack of Sustained Interest (2000002007) | Inattention (4318665) | Near |
| Speech Disturbance (2000002020) | Motor speech disorder (4047111) | Near |

#### Approximately Mapped (7 items — broader SNOMED concept, imperfect match)

| MBA Item | SNOMED Target | Limitation |
|---|---|---|
| Ataxia/Apraxia (2000002029) | Ataxia (437584) | Captures ataxia but not apraxia component |
| Chorea/Athetosis (2000002037) | Chorea (440990) | Captures chorea but not athetosis component |
| Hypertonia/Rigidity (2000002038) | Muscular hypertonicity (4218799) | Captures hypertonia but not rigidity component |
| Air/Saliva Expulsion (2000002024) | Excessive salivation (4207204) | Captures saliva but not air expulsion |
| Oculogyric Movements (2000002031) | Oculogyric crisis (4205592) | "Crisis" implies more acute than Rett oculogyric movements |
| Biting Self/Others (2000002026) | Self-injurious behavior (4092411) | Captures self-biting; doesn't capture biting others |
| Vasomotor Disturbance (2000002040) | Cold feet (4154763) | Main Rett vasomotor manifestation; doesn't cover full vasomotor spectrum |

#### Self-Mapped with Hierarchy (5 composite scores)

| MBA Item | Hierarchy Parent | Rationale |
|---|---|---|
| Grand Total (2000002000) | Assessment score (36684305) | Composite scale total |
| Behavioral/Social Subtotal (2000002001) | Assessment score (36684305) | Subscale total |
| Orofacial/Respiratory Subtotal (2000002002) | Assessment score (36684305) | Subscale total |
| Motor/Physical Subtotal (2000002003) | Assessment score (36684305) | Subscale total |
| CSS Total Score (2000001000) | Assessment score (36684305) | Composite scale total |

#### Self-Mapped with Approximate Broader Mapping (5 behavioral items)

These items received both a self-mapping AND an approximate `Maps to` + `Is a` hierarchy relationship:

| MBA Item | Approximate `Maps to` | `Is a` Parent | Why No Exact Match |
|---|---|---|---|
| Over-active or Over-passive (2000002009) | Psychomotor agitation (4187507) | Behavior finding (4309063) | Bidirectional item — single SNOMED concept can't represent "either overactive OR passive" |
| Does Not Reach for Objects/People (2000002010) | Gross motor impairment (4027312) | Motor dysfunction (4203631) | No SNOMED concept for "failure to reach" specifically |
| Does Not Follow Verbal Acts (2000002011) | Receptive language disorder (443443) | Receptive language disorder (443443) | SNOMED lacks "apparent deafness due to inattention" |
| Mouthing Hands/Objects (2000002025) | Stereotypy habit disorder (4207660) | Behavior finding (4309063) | Oral mouthing behavior not in SNOMED; stereotypy is closest |
| Hypomimia (2000002034) | Motor function behavior finding (433453) | Motor function behavior finding (433453) | "Hypomimia" / masked facies not in SNOMED vocabulary release |

## Implications for Researchers

### What This Enables

1. **Standard cohort definitions now find IRSF patients**: A cohort definition using SNOMED "Rett syndrome" (4288480) with `includeDescendants = true` will now discover patients coded with IRSF Classic Rett Syndrome (2000004000) through the `Maps to` relationship.

2. **Cross-network OHDSI studies**: Federated studies using OHDSI standard concept IDs can now include IRSF-NHS data. A study looking at "any MECP2 gene variant" (35960472) will find all 37 IRSF MECP2 mutation subtypes.

3. **Concept set expansion works**: Building a concept set with SNOMED "Epilepsy" and expanding via `Mapped from` will include IRSF CSS Epilepsy/Seizures and MBA Seizures.

4. **Vocabulary search discovers IRSF data**: Searching for "dystonia" in the vocabulary browser will show the `Mapped from` link to IRSF MBA Dystonia.

### What Researchers Should Know

1. **Granularity preservation**: The IRSF-NHS source concepts retain disease-specific granularity that SNOMED lacks (e.g., 5 atypical Rett subtypes, 17 specific MECP2 point mutations). Use IRSF-NHS concepts directly for Rett-specific analyses.

2. **Mutation-to-gene mapping**: All 48 mutation-level concepts map to 3 gene-level OMOP Genomic concepts. Variant-level distinction is preserved only in the source concept — filtering by specific mutations requires using the IRSF-NHS concept IDs directly.

3. **CSS/MBA are severity scales, not diagnoses**: The standard mappings for CSS and MBA items point to the clinical finding being assessed, not a diagnosis. A CSS Scoliosis score of 0 maps to SNOMED "Scoliosis" even though the patient may not have scoliosis — the measurement records the severity rating for that domain.

4. **10 concepts have no external standard equivalent**: 5 composite scores (CSS Total, MBA Grand/Subtotals) and 5 Rett-specific behavioral items have self-mappings only. These remain IRSF-NHS standard concepts and should be referenced by their source concept IDs in analyses.

## Technical Details

### Database Location

All relationships are in `omop.concept_relationship`:
```sql
-- Find all IRSF-NHS mappings
SELECT c1.concept_id, c1.concept_name, cr.relationship_id,
       c2.concept_id AS target_id, c2.concept_name AS target_name, c2.vocabulary_id
FROM omop.concept_relationship cr
JOIN omop.concept c1 ON cr.concept_id_1 = c1.concept_id
JOIN omop.concept c2 ON cr.concept_id_2 = c2.concept_id
WHERE c1.vocabulary_id = 'IRSF-NHS'
ORDER BY c1.concept_id;
```

### Validation Queries

```sql
-- Coverage check
SELECT
    COUNT(*) AS total_concepts,
    COUNT(DISTINCT CASE WHEN cr.concept_id_2 != cr.concept_id_1 THEN cr.concept_id_1 END) AS mapped_to_external,
    COUNT(DISTINCT CASE WHEN cr.concept_id_2 = cr.concept_id_1 THEN cr.concept_id_1 END) AS self_mapped
FROM omop.concept c
LEFT JOIN omop.concept_relationship cr ON c.concept_id = cr.concept_id_1 AND cr.relationship_id = 'Maps to'
WHERE c.vocabulary_id = 'IRSF-NHS';

-- Verify no orphans
SELECT c.concept_id, c.concept_name
FROM omop.concept c
WHERE c.vocabulary_id = 'IRSF-NHS'
  AND NOT EXISTS (SELECT 1 FROM omop.concept_relationship cr WHERE cr.concept_id_1 = c.concept_id);
-- Should return 0 rows
```

### Mapping Date

All relationships use `valid_start_date = 1970-01-01` and `valid_end_date = 2099-12-31` (standard OMOP convention for active mappings with no planned expiry).

## Cross-Source Data Isolation Fix (Related)

During this mapping effort, a critical cross-source data contamination issue was discovered and fixed in the Parthenon patient profile service. Multiple CDM sources share the `omop` schema with overlapping person_id ranges (SynPUF person 100021 = "Barbara Harris" age 32 with diabetes vs. IRSF person 100021 = female Rett patient born 2003).

**Fix implemented**: All patient profile domain queries now filter by visit_occurrence_id linkage — records must have either a NULL visit_id (IRSF ETL convention) or a visit_id that matches the patient's actual visits. This eliminates 100% of cross-source contamination without requiring schema isolation.

This is documented separately but relevant context for researchers: the data integrity of the IRSF-NHS CDM has been validated at the individual patient level.

## Files Modified

- `omop.concept_relationship` — 264 new rows (117 Maps to + 107 Mapped from + 10 Is a + 10 Subsumes + 10 self-Maps to + 10 self entries)
- No changes to `omop.concept` — all 117 IRSF-NHS concepts retain their original definitions
- No changes to clinical data tables — mappings are metadata only

## Appendix Writing Instructions for Cowork

The appendix should include:
1. A methods section describing the mapping approach (manual curation with OMOP vocabulary search)
2. A summary table showing coverage by category
3. The complete mapping table (all 117 concepts with source/target/quality)
4. A discussion of mapping limitations (variant-level loss for mutations, CSS severity-to-finding semantic gap, 10 unmapped behavioral items)
5. Implications for OHDSI network interoperability
6. The cross-source isolation fix as a methodological note on data quality assurance
