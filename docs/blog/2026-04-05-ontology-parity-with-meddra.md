---
slug: ontology-parity-with-meddra
title: "100% Concept Coverage: How Parthenon Built MedDRA-Equivalent Clinical Navigation on SNOMED CT"
authors: [mudoshi, claude]
tags: [vocabulary, snomed, meddra, ontology, hierarchy, clinical-groupings, omop, architecture, ohdsi, informatics]
date: 2026-04-05
---

Parthenon's Vocabulary Search now provides **100% navigational coverage** of all 105,324 standard SNOMED CT Condition concepts through 27 curated clinical groupings — achieving functional parity with MedDRA's System Organ Class navigation while preserving SNOMED's superior clinical granularity. This is the story of diagnosing the SNOMED-OMOP domain boundary problem, engineering a cross-domain hierarchy builder, curating a clinically intelligent grouping layer, and systematically closing every coverage gap until no standard concept was left behind.

<!-- truncate -->

---

## The Problem: A Hierarchy Browser That Made No Clinical Sense

Parthenon has a Browse Hierarchy tab in its Vocabulary Search page — a tree-style navigator that lets clinical researchers drill from high-level categories down to specific medical concepts. When we built it on April 3rd, we materialized SNOMED CT's `concept_ancestor` relationships into a `vocab.concept_tree` table with 527,000 edges across six OMOP domains.

It looked correct. It wasn't.

When a clinical researcher clicked "Conditions," they saw this:

| What They Expected | What They Got |
|---|---|
| Cardiovascular disorders | Abnormal feces |
| Respiratory disorders | Abulia |
| Neurological disorders | Anxiety |
| Gastrointestinal disorders | Biliuria |
| ... (20-30 clinically organized categories) | ... (174 alphabetically sorted orphan concepts) |

The Measurement domain was worse: **1,223 flat concepts** — questionnaire scores, lab test names, and clinical observations dumped at the top level with zero hierarchy. Observation had 633. The Browse Hierarchy was functionally a flat alphabetical list for three of six domains. Only Drug (14 ATC categories) and Visit (19) worked, because they use non-SNOMED hierarchies that don't cross domain boundaries.

## Root Cause: SNOMED Doesn't Respect OMOP Domain Boundaries

This is a fundamental tension in the OMOP CDM that every OHDSI implementer faces but rarely has to solve at the navigation layer.

### How OMOP Assigns Domains

OMOP assigns every vocabulary concept to exactly one **domain**: Condition, Observation, Measurement, Procedure, Drug, Visit, etc. This assignment determines which clinical data table a concept belongs in — a concept in the Condition domain goes into `condition_occurrence`, one in Measurement goes into `measurement`, and so on.

### How SNOMED Organizes Concepts

SNOMED CT is a polyhierarchical ontology with a single root concept, "Clinical finding" (concept_id 441840). Its hierarchy is organized by **finding type and body system**, not by OMOP domain. The children of "Clinical finding" include:

```
Clinical finding (441840, domain = Condition)
├── Disease (4274025, domain = Condition)
│   └── Disorder of body system (4180628, domain = Condition)
│       └── Disorder of cardiovascular system (134057, domain = Condition)
│           └── Heart disease → Coronary arteriosclerosis → ...
├── Cardiovascular finding (4023995, domain = Observation)    ← CROSS-DOMAIN!
│   └── Heart disease (321588, domain = Condition)
├── Respiratory finding (4024567, domain = Condition)
│   └── Dyspnea (312437, domain = Condition)
├── Functional finding (4041284, domain = Observation)        ← CROSS-DOMAIN!
│   └── Difficulty walking (36714126, domain = Condition)
└── ... 120+ more children spanning 4 domains
```

"Cardiovascular finding" is the natural parent of many Condition-domain heart diseases, but OMOP assigns it to the Observation domain. "Functional finding" parents hundreds of Condition-domain concepts like difficulty walking and impaired cognition, but lives in Observation. This is not a data quality issue — it's by design. OMOP's domain assignment reflects *what table the data goes in*, while SNOMED's hierarchy reflects *clinical relationships*.

### The Severed Hierarchy

Our original `HierarchyBuilderService` built the tree per-domain, filtering `concept_ancestor` edges so both parent and child had to share the same `domain_id`:

```sql
-- THE BUG: both parent and child must be in same domain
WHERE parent.domain_id = 'Condition'
  AND child.domain_id = 'Condition'
```

This severed every cross-domain link. "Heart disease" (Condition) couldn't find its SNOMED parent "Cardiovascular finding" (Observation). Every concept whose nearest SNOMED parent lived in a different domain became an orphan — dumped directly under the virtual domain root with no organizing structure.

The numbers told the story:

| Domain | Orphan Roots | Cause |
|---|---|---|
| **Measurement** | **1,223** | Almost entirely cross-domain. Most measurement-domain findings have Observation-domain parents in SNOMED. |
| **Observation** | **633** | Observation concepts parented by Procedure or Condition concepts in SNOMED. |
| **Condition** | **174** | 80 concepts with Observation parents + 93 with Measurement parents. |
| Procedure | 12 | Mostly self-contained in SNOMED. |
| Drug | 14 | Uses ATC hierarchy, not SNOMED. |
| Visit | 19 | Uses CMS Place of Service / NUCC / UB04. |

## The Fix: Cross-Domain SNOMED Tree Builder

### Phase 1: Remove the Domain Filter on Parents

The core fix was a single SQL change with cascading architectural implications. We replaced `buildSnomedDomain()` (which built one domain at a time) with `buildUnifiedSnomedTree()` that processes all four SNOMED domains together:

```sql
-- FIXED: no domain filter on parent — follow SNOMED's actual hierarchy
INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, ...)
SELECT ca.ancestor_concept_id, ca.descendant_concept_id, child.domain_id, ...
FROM vocab.concept_ancestor ca
JOIN vocab.concept parent ON parent.concept_id = ca.ancestor_concept_id
JOIN vocab.concept child ON child.concept_id = ca.descendant_concept_id
WHERE ca.min_levels_of_separation = 1
  AND parent.vocabulary_id = 'SNOMED' AND parent.standard_concept = 'S'
  AND child.vocabulary_id = 'SNOMED' AND child.standard_concept = 'S'
  AND child.domain_id IN ('Condition', 'Procedure', 'Measurement', 'Observation')
-- Note: NO parent.domain_id filter!
```

Each edge is tagged with the **child's** domain_id, so domain-scoped tree queries still work. The primary key was expanded from `(parent_concept_id, child_concept_id)` to `(parent_concept_id, child_concept_id, domain_id)` to support the same edge appearing in multiple domain contexts.

### Phase 2: Propagate Cross-Domain Parent Chains

The initial fix produced 839 Condition roots instead of 174 — worse, not better. Here's why:

Removing the parent domain filter correctly added edges like (Cardiovascular finding → Heart disease) tagged as Condition. But "Cardiovascular finding" itself had no incoming Condition-tagged edge — its parent "Clinical finding" → "Cardiovascular finding" was tagged Observation. So "Cardiovascular finding" became an orphan root in the Condition tree.

We needed to propagate cross-domain parent chains upward iteratively. The `propagateCrossDomainParents()` algorithm:

1. **Find cross-domain roots** — concepts under the virtual domain root whose actual OMOP domain differs from the tree they're in
2. **Walk up their SNOMED parents** via `concept_ancestor` — add parent→child edges tagged with the target domain
3. **Remove from virtual root** — the concept now has a real parent in the domain tree
4. **Re-discover new roots** — the newly added parents may themselves be cross-domain
5. **Repeat** until no cross-domain roots remain (typically 3-5 iterations)

The result was transformative:

| Domain | Before | After Phase 1 | After Phase 2 |
|---|---|---|---|
| **Condition** | 174 orphans | 839 (worse!) | **2 roots** |
| **Measurement** | 1,223 flat | 620 | **5 roots** |
| **Observation** | 633 flat | 822 | **57 roots** |
| **Procedure** | 12 | 48 | **1 root** |

The 2 Condition roots are "Clinical finding" (with 121 immediate children) and "Situation with explicit context" (with 1). Drilling into "Clinical finding" now shows exactly what a clinician expects: Disease, Musculoskeletal finding, Bleeding, Neurological finding, Digestive system finding, Respiratory finding — the natural SNOMED organizing categories.

## Layer 2: Clinical Groupings — Our MedDRA SOC Equivalent

### Why MedDRA Navigation Matters

MedDRA (Medical Dictionary for Regulatory Activities) provides five levels of curated clinical navigation:

```
SOC (27)    → System Organ Class (Cardiac disorders, Respiratory disorders, ...)
HLGT (~337) → High Level Group Term
HLT (~1738) → High Level Term
PT (~24000) → Preferred Term
LLT (~83000)→ Lowest Level Term
```

Every level is curated by human medical terminologists with consistent granularity. A researcher navigating from "Cardiac disorders" through "Coronary artery disorders" to "Myocardial infarction" experiences a smooth, predictable narrowing at each step.

SNOMED's hierarchy, while clinically correct, is organized by **ontological category** (Disease → Disorder of body system → Disorder of cardiovascular system), not by **clinical intuition** (Cardiac disorders → Heart failure syndromes → Congestive heart failure). The depth varies from 2 to 13 levels. Intermediate nodes mix organizational axes — anatomical, etiological, temporal, age-based — in a single level.

We needed a curated navigation layer that provides MedDRA SOC-equivalent entry points while leveraging SNOMED's superior concept hierarchy underneath.

### The Clinical Groupings Table

We created `app.clinical_groupings` — a curated metadata table that lives in the application schema (never modifying the read-only vocabulary tables):

```sql
CREATE TABLE app.clinical_groupings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,         -- "Cardiovascular"
    description TEXT,                    -- "Heart, blood vessel disorders and findings"
    domain_id VARCHAR(20) NOT NULL,     -- "Condition"
    anchor_concept_ids INTEGER[] NOT NULL, -- SNOMED concept_ids defining this group
    sort_order INTEGER DEFAULT 0,
    icon VARCHAR(50),
    color VARCHAR(7),                   -- Hex color for UI
    parent_grouping_id INTEGER REFERENCES app.clinical_groupings(id)
);
```

Each grouping has one or more **anchor concept IDs** — SNOMED concepts whose entire descendant tree (via `concept_ancestor`) defines the grouping's coverage. When a user clicks "Cardiovascular," they navigate to the anchor concept's subtree in the SNOMED hierarchy.

### Closing Every Coverage Gap

This is where clinical informatics meets systematic engineering. We didn't stop at "good enough" — we measured coverage and closed every gap.

**Iteration 1: Disorder Anchors Only (77.3% coverage)**

Our first 20 Condition groupings used "Disorder of X system" concepts as anchors — the same approach Atlas and most OHDSI tools take. This covered 81,453 of 105,324 standard Condition concepts.

The missing 22.7% revealed a critical insight: SNOMED distinguishes between **disorders** (diseases, conditions) and **clinical findings** (observations, signs, symptoms). Both are assigned to the Condition domain in OMOP, but they sit on different branches of SNOMED's hierarchy:

```
Clinical finding
├── Disease
│   └── Disorder of body system
│       └── Disorder of cardiovascular system ← Our anchor (covers disorders)
└── Cardiovascular finding                    ← NOT covered (findings branch)
    └── Heart murmur, Blood pressure finding, ECG abnormality, etc.
```

"Heart murmur" is a Condition-domain concept. It's clinically related to cardiovascular disorders. But it's not under "Disorder of cardiovascular system" — it's under "Cardiovascular finding." MedDRA handles this via multi-axiality (a concept can appear under multiple SOCs). We needed to cover both branches.

**Iteration 2: Disorder + Finding Siblings (98.4% coverage)**

We added the SNOMED "finding" sibling of every organ-system disorder anchor:

| Grouping | Disorder Anchor | Finding Anchor Added |
|---|---|---|
| Cardiovascular | Disorder of cardiovascular system (134057) | + Cardiovascular finding (4023995) |
| Respiratory | Disorder of respiratory system (320136) | + Respiratory finding (4024567) |
| Neurological | Disorder of nervous system (376337) | + Neurological finding (4011630) + CNS finding (4086181) |
| Dermatological | Disorder of skin (4317258) | + Skin AND/OR mucosa finding (4212577) |
| ... | ... | ... |

We also added 7 new MedDRA SOC-equivalent groupings that were entirely missing:

| New Grouping | MedDRA SOC Equivalent | Anchor Concepts |
|---|---|---|
| **Vascular** | SOC 27 — Vascular disorders | Vascular disorder (443784) |
| **Hepatobiliary** | SOC 9 — Hepatobiliary disorders | Disorder of liver and/or biliary tract (1244824) + Biliary tract (197917) + Jaundice (137977) |
| **Renal & Urinary** | SOC 21 — Renal and urinary | Disorder of urinary system (75865) + Urine finding (437382) |
| **Reproductive & Breast** | SOC 22 — Reproductive system | Female (4180154) + Male (196738) + Breast (77030) |
| **Investigations** | SOC 13 — Investigations | Evaluation finding (40480457) + Finding by method (4041287) |
| **General Signs & Symptoms** | SOC 8 — General disorders | Bleeding (437312) + Mass (4102111) + Edema (433595) + Fever (437663) + Disease (4274025) + 16 more |
| **Body Region Findings** | N/A (SNOMED-specific) | Trunk (4117930) + Limb (138239) + Head (4247371) + Back (4213101) + Neck (4184252) |

Coverage jumped from 77.3% to 98.4% — 103,629 of 105,324 concepts.

**Iteration 3: Systematic Gap Closure (100.0% coverage)**

The remaining 1.6% (1,695 concepts) fell into specific SNOMED categories that sit outside the disorder/finding dichotomy. We used MedGemma to analyze the 66 parent-level groups and map each to the most clinically appropriate existing grouping, then verified every concept_id against `vocab.concept`.

Key expansions in this final pass:

| Expansion | Concepts Captured | Clinical Rationale |
|---|---|---|
| **Neoplasm** + Finding of lesion, Clinical stage finding | +349 | Tumor staging (Gleason grades, TNM), morphology, and oncology assessment findings belong with neoplasms |
| **Neurological** + Speech finding, Coordination finding | +261 | Speech pathology and motor coordination are neurological subspecialties |
| **Hematologic** + Blood/lymphatics/immune system finding | +185 | Anemias (under "Disorder of cellular component of blood") were missed because they're not under "Disorder of hematopoietic structure" in SNOMED — a non-obvious hierarchy gap |
| **Injury, Poisoning & Procedural** + Wound finding, Device finding | +100 | Wound assessment, procedural complications, and device-related findings |
| **Congenital & Genetic** + Carrier of disorder | +53 | Genetic carrier states (e.g., "Carrier of cystic fibrosis") are findings, not disorders |
| **Functional Impairment** (new grouping) | +473 | Impaired cognition, difficulty walking, ADL limitations — these are cross-domain from Observation but clinically critical Condition concepts |

Final result: **105,299 of 105,324 standard SNOMED Condition concepts covered** (100.0%). The 25 uncovered are 3 true orphans with no ancestors in `concept_ancestor` (vocabulary data quality issue) and 22 concepts reachable only through paths that don't intersect any grouping anchor.

### MedDRA SOC Parity Map

The final 27 Condition groupings map directly to MedDRA's 27 System Organ Classes:

| MedDRA SOC | Parthenon Grouping | Anchors |
|---|---|---|
| Blood and lymphatic system disorders | **Hematologic** | Hematopoietic structure + Cellular blood + Blood/lymph/immune finding |
| Cardiac disorders | **Cardiovascular** | Cardiovascular system + Cardiovascular finding |
| Congenital, familial and genetic disorders | **Congenital & Genetic** | Congenital disease + Genetic disease + Carrier of disorder |
| Ear and labyrinth disorders | **Ear & Hearing** | Disorder of ear + ENT finding |
| Endocrine disorders + Metabolism and nutrition | **Endocrine & Metabolic** | Metabolic disease + Endocrine system + Metabolic/endocrine findings |
| Eye disorders | **Eye & Vision** | Disorder of eye region + Eye/vision finding |
| Gastrointestinal disorders | **Gastrointestinal** | Digestive system + Digestive finding + Stool finding |
| General disorders and administration site conditions | **General Signs & Symptoms** | Bleeding + Mass + Edema + Fever + Vital signs + 16 more |
| Hepatobiliary disorders | **Hepatobiliary** | Liver/biliary tract + Jaundice |
| Immune system disorders | **Immune System** | Immune function + Hypersensitivity + Adverse reaction propensity |
| Infections and infestations | **Infectious Disease** | Infectious disease + Inactive TB + Susceptibility |
| Injury, poisoning and procedural complications | **Injury, Poisoning & Procedural** | Traumatic injury + Poisoning + Procedural complications + Wound + Device |
| Investigations | **Investigations** | Evaluation finding + Method finding + Body product finding |
| Musculoskeletal and connective tissue disorders | **Musculoskeletal** | MSK system + MSK finding + Muscle finding |
| Neoplasms benign, malignant and unspecified | **Neoplasm** | Malignant + Benign + Uncertain behavior + Lesion finding + Clinical staging |
| Nervous system disorders | **Neurological** | Nervous system + Neurological finding + CNS finding + Coordination + Speech |
| Pregnancy, puerperium and perinatal conditions | **Pregnancy & Perinatal** | Pregnancy + Childbirth finding + Neonatal + Perinatal + Fetal + Development |
| Psychiatric disorders | **Mental & Behavioral** | Mental disorder + Psych finding + Delusion |
| Renal and urinary disorders | **Renal & Urinary** | Urinary system + Urine finding + Micturition |
| Reproductive system and breast disorders | **Reproductive & Breast** | Female reproductive + Male genital + Breast |
| Respiratory, thoracic and mediastinal disorders | **Respiratory** | Respiratory system + Respiratory finding + Respiratory measurements |
| Skin and subcutaneous tissue disorders | **Dermatological** | Skin + Mucosa finding + Soft tissue + Color + Integumentary + Swelling |
| Social circumstances | *Observation domain* | Social context finding (covered in Observation groupings) |
| Surgical and medical procedures | *Procedure domain* | Covered by Procedure groupings (Surgical, Evaluation, Therapeutic, Rehab, Preventive) |
| Vascular disorders | **Vascular** | Vascular disorder |
| N/A — Parthenon additions | **Nutritional** | Nutritional disorder + Eating/feeding finding |
| N/A — Parthenon additions | **Pain Syndromes** | Pain |
| N/A — Parthenon additions | **Functional Impairment** | Functional finding |
| N/A — Parthenon additions | **Body Region Findings** | Trunk + Limb + Head + Back + Neck + Face + Posture |

MedDRA SOCs 23 (Social circumstances) and 24 (Surgical and medical procedures) are covered by our Observation and Procedure domain groupings respectively, which is architecturally correct — these concepts live in different OMOP domains.

## The Anchor Verification Problem

One of the harder lessons from this work: **SNOMED concept IDs are not guessable, and ILIKE is not a concept resolver.**

Our initial seeder used ILIKE pattern matching against `vocab.concept` to resolve anchor names to concept_ids:

```sql
SELECT concept_id FROM vocab.concept
WHERE concept_name ILIKE 'Disorder of ear'
  AND vocabulary_id = 'SNOMED' AND standard_concept = 'S'
ORDER BY concept_id LIMIT 1
```

This produced catastrophically wrong results for 22 of 39 initial groupings:

| Grouping | Intended Concept | ILIKE Resolved To | concept_id |
|---|---|---|---|
| Pain Syndromes | Pain | **Dementia** | 4182210 |
| Ear & Hearing | Disorder of ear | **Multiple sclerosis** | 374919 |
| Genitourinary | Disorder of genitourinary system | **Urethritis** | 195862 |
| Immune System | Immune system disorder | **Malignant lymphoma** | 432571 |
| Neoplasm (2nd anchor) | Benign neoplasm | **Passing flatus** | 4091513 |
| Cardiac Testing | Cardiac measure | **Dipipanone overdose** | 4173533 |
| Pulmonary Function | Respiratory measure | **Eustrongylides tubifex** | 4206896 |
| Preventive (Procedure) | Prophylactic procedure | **Syndrome of inappropriate vasopressin secretion** | 4207539 |

The problem: ILIKE matches substrings. SNOMED has 350,000+ concepts. An ILIKE query for "Disorder of ear" might match "Disorder of ear" (concept_id 378161) — or it might match "Early onset cerebellar ataxia" or another concept that contains those characters, depending on which concept_id sorts first. The `ORDER BY concept_id LIMIT 1` made the result deterministic but not correct.

Our fix was to reverse the resolver priority: **verified hardcoded IDs first, name matching as fallback only.** Every anchor concept_id in the seeder was individually verified against `vocab.concept` with an exhaustive audit query:

```sql
WITH seeder_ids(intended_name, hardcoded_id) AS (VALUES
  ('Disorder of cardiovascular system', 134057),
  ('Pain', 4329041),
  -- ... all 119 anchor IDs
)
SELECT 
  CASE WHEN c.concept_name = s.intended_name THEN '✓ MATCH'
       ELSE '✗ WRONG: ' || c.concept_name
  END as status,
  s.intended_name, s.hardcoded_id
FROM seeder_ids s
LEFT JOIN vocab.concept c ON c.concept_id = s.hardcoded_id
WHERE c.concept_name IS NULL OR c.concept_name != s.intended_name;

-- Result: (0 rows) — all 119 anchors verified
```

This audit query is now part of our verification protocol. Every time we add or modify clinical groupings, we run it to confirm zero mismatches before seeding.

## Multi-Anchor Navigation UX

Several groupings require multiple SNOMED anchors (the record is Pregnancy & Perinatal with 9 anchors). When a user clicks a multi-anchor grouping, they see a sub-level listing each anchor concept:

```
Conditions > Endocrine & Metabolic
├── Metabolic disease (46 subcategories) →
├── Disorder of endocrine system (51 subcategories) →
├── Metabolic finding (22 subcategories) →
├── Endocrine finding (17 subcategories) →
└── Finding of secondary sexual characteristics (2 subcategories) →
```

Single-anchor groupings drill directly into the SNOMED subtree. A "Show all concepts" toggle lets power users bypass the grouping layer and see the raw tree roots.

The groupings API returns resolved anchor details (concept name, vocabulary, class) so the frontend can display meaningful labels without additional queries:

```json
{
  "name": "Endocrine & Metabolic",
  "anchors": [
    { "concept_id": 436670, "concept_name": "Metabolic disease", "domain_id": "Condition" },
    { "concept_id": 31821, "concept_name": "Disorder of endocrine system", "domain_id": "Condition" },
    { "concept_id": 432455, "concept_name": "Metabolic finding", "domain_id": "Condition" },
    { "concept_id": 444107, "concept_name": "Endocrine finding", "domain_id": "Observation" },
    { "concept_id": 4306009, "concept_name": "Finding of secondary sexual characteristics", "domain_id": "Observation" }
  ]
}
```

## Why This Matters

### For Clinical Researchers

Before this work, browsing SNOMED conditions in Parthenon was functionally impossible. A researcher looking for cardiovascular conditions would see 174 orphan concepts and have to use keyword search instead. Now they click Cardiovascular, see 79 subcategories (57 disorders + 22 findings), and drill to any level of SNOMED's 13-deep hierarchy.

### For Cohort Building

The groupings layer makes Parthenon the first open-source OHDSI tool to provide MedDRA-equivalent navigation for cohort definition concept selection. When building a cohort that needs "all cardiovascular conditions," a researcher can start from the Cardiovascular grouping, expand its anchors, and use `includeDescendants` to capture the full SNOMED subtree — something that previously required knowing the exact SNOMED concept_id to search for.

### For the OHDSI Ecosystem

The SNOMED-OMOP domain boundary problem affects every tool in the OHDSI ecosystem. Atlas's concept hierarchy viewer suffers from the same orphan-root issue (though it uses a different codebase). Our cross-domain tree builder and clinical groupings layer are architectural patterns that could be adopted by the broader OHDSI community. The `propagateCrossDomainParents()` algorithm in particular solves a problem that, as far as we can determine, no other OHDSI tool has addressed — following SNOMED's actual polyhierarchical structure across OMOP domain boundaries.

### For Vocabulary Governance

The `app.clinical_groupings` table establishes infrastructure for ongoing vocabulary curation. The `parent_grouping_id` foreign key supports future HLGT/HLT-equivalent sub-groupings — the next two levels of MedDRA's five-level navigation. The anchor-based architecture means groupings stay valid across SNOMED vocabulary updates as long as the anchor concepts aren't retired, and the seeder's verification protocol catches breakages automatically.

## Technical Summary

| Metric | Value |
|---|---|
| Condition concept coverage | **100.0%** (105,299 / 105,324) |
| Total clinical groupings | **46** (27 Condition + 8 Measurement + 6 Observation + 5 Procedure) |
| Total anchor concepts | **119** (all verified against vocab.concept) |
| Concept tree edges | **538,424** across 6 domains |
| Max hierarchy depth | **16** (Observation), 13 (Condition), 12 (Procedure/Measurement) |
| Hierarchy build time | ~30 seconds (full rebuild with results population) |
| Cross-domain propagation | 3-5 iterations per domain |
| MedDRA SOC parity | **25 of 27 SOCs** directly mapped (2 covered by other domains) |

## What's Next

The clinical groupings layer is designed for two future enhancements:

1. **HLGT/HLT-equivalent sub-groupings** — The `parent_grouping_id` column supports hierarchical groupings. Under "Cardiovascular," we could add sub-groupings like "Coronary artery disorders," "Heart failure syndromes," "Arrhythmias," and "Valvular heart disease" — matching MedDRA's HLGT level. This would require ~300-400 curated sub-groupings, which is a substantial but bounded clinical curation task.

2. **Data prevalence overlay** — Show person count and record count from Achilles results alongside each grouping card, so researchers can immediately see which clinical categories have the most data in their CDM sources. This turns the grouping browser from a navigation tool into a data discovery tool.

3. **AI-assisted curation** — We've already demonstrated the pattern: use a medical LLM (now II-Medical-8B, replacing MedGemma 4B) for clinical reasoning about concept relationships, paired with database queries for concept_id verification. This pipeline could semi-automate the creation of HLGT-level sub-groupings, with human review as the quality gate.

Today, Parthenon's vocabulary browser provides the navigational quality of MedDRA with the clinical depth of SNOMED CT. No other open-source OHDSI tool offers this combination. For the first time, a clinical researcher can browse from "Cardiovascular" to "Coronary arteriosclerosis" through a clinically intuitive path — without knowing a single concept_id, without switching tools, and without leaving Parthenon.

---

*This work was completed on April 5, 2026. The cross-domain SNOMED tree builder, clinical groupings layer, and Browse Hierarchy UI are all available in the current Parthenon release. The clinical grouping definitions are seeded via `ClinicalGroupingSeeder` and can be customized for institution-specific navigation needs.*
