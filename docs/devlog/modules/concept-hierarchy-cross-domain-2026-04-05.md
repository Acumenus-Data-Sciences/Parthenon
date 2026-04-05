# Concept Hierarchy: Cross-Domain SNOMED Tree & Clinical Groupings

**Date:** 2026-04-05
**Module:** Vocabulary Search → Browse Hierarchy
**Status:** Complete
**Commits:** `c4a12935a` → `ae897d0d8` (5 commits)

---

## Problem Statement

The Browse Hierarchy tab in the Vocabulary Search page was deeply illogical. Clicking into any SNOMED-based domain (Condition, Measurement, Observation) presented hundreds of alphabetically-sorted orphan concepts with no organizing structure — making the hierarchy browser functionally useless for clinical navigation.

**Root counts before this work:**

| Domain | Root-Level Items | User Experience |
|--------|-----------------|-----------------|
| Measurement | **1,223** | Flat alphabetical dump — "16pf Questionnaire scores", "Acid-base balance", "AH interval"… |
| Observation | **633** | Same — hundreds of unrelated concepts |
| Condition | **174** | Orphans like "Abnormal feces", "Abulia", "Anxiety" with no clinical grouping |
| Procedure | 12 | Acceptable |
| Drug | 14 | Good (ATC hierarchy) |
| Visit | 19 | Acceptable |

A clinical researcher clicking "Conditions" expected to see something like MedDRA's System Organ Classes (Cardiac disorders, Respiratory disorders, Neurological disorders…) — not 174 random SNOMED clinical findings listed alphabetically.

## Root Cause Analysis

### The SNOMED–OMOP Domain Boundary Problem

SNOMED CT is a polyhierarchical ontology organized around a single root concept ("Clinical finding" → 441,840). Its hierarchy does **not** respect OMOP CDM domain boundaries. OMOP assigns each concept to exactly one domain (Condition, Observation, Measurement, Procedure), but SNOMED's organizing concepts frequently span domains:

```
Clinical finding (441840, domain=Condition)
├── Cardiovascular finding (4023995, domain=Observation)  ← CROSS-DOMAIN
│   └── Heart disease (321588, domain=Condition)
│       └── Coronary arteriosclerosis (316139, domain=Condition)
├── Disease (4274025, domain=Condition)
│   └── Disorder of body system (4180628, domain=Condition)
│       └── Disorder of cardiovascular system (134057, domain=Condition)
```

The original `HierarchyBuilderService.buildSnomedDomain()` filtered `concept_ancestor` edges requiring **both parent and child** to share the same OMOP `domain_id`:

```sql
-- BROKEN: requires parent and child in same domain
WHERE parent.domain_id = 'Condition'
  AND child.domain_id = 'Condition'
```

This severed every cross-domain link. "Heart disease" couldn't find its parent "Cardiovascular finding" because that concept lives in the Observation domain. All 174 Condition "roots" were concepts whose SNOMED parents happened to be assigned to Observation (80 orphans) or Measurement (93 orphans).

## Solution: Three-Layer Architecture

### Layer 1: Cross-Domain SNOMED Tree Builder

**File:** `backend/app/Services/Vocabulary/HierarchyBuilderService.php`

Replaced `buildSnomedDomain()` (per-domain builder) with `buildUnifiedSnomedTree()` that builds all four SNOMED domains in a single pass:

1. **Phase 1 — Edge insertion:** Insert ALL `concept_ancestor` edges where `min_levels_of_separation = 1` and both parent and child are SNOMED + `standard_concept = 'S'`. The critical fix: **no `domain_id` filter on the parent**. Each edge is tagged with the child's `domain_id` for domain-scoped tree queries.

2. **Phase 2 — Cross-domain parent chain propagation:** The initial fix produced 839 Condition roots instead of 174 — cross-domain organizing concepts (e.g., "Cardiovascular finding" from Observation) correctly appeared as parents, but *their* parents weren't tagged for the Condition domain, so they became orphan roots.

   `propagateCrossDomainParents()` iteratively walks UP from cross-domain roots:
   - Find concepts under the virtual domain root that belong to a different OMOP domain
   - Look up their SNOMED parents via `concept_ancestor`
   - Insert parent→child edges tagged with the target domain
   - Remove the concept from the virtual root (it now has a real parent)
   - Repeat until no cross-domain roots remain or we reach true SNOMED roots

3. **Phase 3 — Depth computation:** Unchanged iterative algorithm from roots (depth=1) outward.

**Schema change:** The `concept_tree` primary key was altered from `(parent_concept_id, child_concept_id)` to `(parent_concept_id, child_concept_id, domain_id)` to support the same edge appearing in multiple domain trees with different domain tags.

### Layer 2: Clinical Groupings (MedDRA SOC Equivalent)

**Files:** Migration, `ClinicalGrouping` model, `ClinicalGroupingSeeder`, API endpoint

Created `app.clinical_groupings` table providing curated, clinically intuitive entry points into the SNOMED hierarchy — our own System Organ Class equivalent:

```sql
CREATE TABLE app.clinical_groupings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    domain_id VARCHAR(20) NOT NULL,
    anchor_concept_ids INTEGER[] NOT NULL,  -- SNOMED concept_ids defining this group
    sort_order INTEGER DEFAULT 0,
    icon VARCHAR(50),
    color VARCHAR(7),
    parent_grouping_id INTEGER REFERENCES app.clinical_groupings(id)
);
```

**39 curated groupings seeded:**

| Domain | Count | Examples |
|--------|-------|---------|
| Condition | 20 | Cardiovascular (134057), Respiratory (320136), Neurological (376337), Gastrointestinal (4201745), Endocrine & Metabolic (436670+31821), Musculoskeletal (4244662), Neoplasm (443392+435506), Mental & Behavioral (432586)… |
| Measurement | 8 | Vital Signs (4 anchors: BP/temp/HR/RR), Blood Chemistry, Hematology, Urinalysis, Imaging, Microbiology, Cardiac Testing, Pulmonary Function |
| Observation | 6 | Social History, Family History, Personal History, Functional Status, Health Behaviors, Administrative |
| Procedure | 5 | Surgical, Evaluation, Therapeutic, Rehabilitation, Preventive |

Each grouping's `anchor_concept_ids` reference verified SNOMED concepts that serve as subtree roots. The seeder prioritizes hardcoded IDs (verified at development time) over ILIKE name matching to prevent mis-resolution.

**API endpoint:** `GET /v1/vocabulary/groupings?domain_id=Condition` — inside existing `auth:sanctum` + `permission:vocabulary.view` middleware.

### Layer 3: Browse Hierarchy UI with Groupings

**File:** `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx`

When a user enters a SNOMED domain (Condition, Procedure, Measurement, Observation), the first view shows clinical grouping cards instead of raw SNOMED roots:

- **Grouping cards:** 2-column grid with color accent bars, name, description, chevron
- **"Show all concepts" toggle:** Small text button switches between grouping cards and raw tree roots (for power users)
- **"Show groupings" toggle:** Switches back from raw view to groupings
- **Domain tracking:** `activeDomain` state tracks which domain we're in; groupings only shown for SNOMED domains
- **Breadcrumb reset:** Navigating back to domain root via breadcrumbs restores groupings view
- Drug and Visit domains skip groupings entirely (their existing hierarchies are already clean)

New supporting files:
- `useClinicalGroupings.ts` — TanStack Query hook
- `fetchClinicalGroupings()` in `vocabularyApi.ts`
- `ClinicalGrouping` interface in `vocabulary.ts`

## Bugs Found During Testing

### 1. Cross-Domain Propagation Not Iterating (Critical)

**Symptom:** After initial fix, Condition had 839 roots instead of expected <30.
**Cause:** Removing `parent.domain_id` filter pulled in cross-domain parents, but their OWN parent edges weren't tagged for the target domain. "Cardiovascular finding" (Observation) appeared as a Condition root because (ClinicalFinding → CardiovascularFinding) was tagged domain=Observation.
**Fix:** Added `propagateCrossDomainParents()` with iterative walk-up.
**Result:** 839 → **2 roots** (Clinical finding + Situation with explicit context).

### 2. Seeder ILIKE Mis-Resolution (7 broken anchors)

The seeder used `ILIKE` name matching which produced substring matches against wrong concepts:

| Grouping | Resolved To | Correct Concept | Fixed ID |
|----------|------------|-----------------|----------|
| Neoplasm (2nd anchor) | "Passing flatus" (4091513) | "Benign neoplastic disease" | 435506 |
| Genitourinary | "Urethritis" (195862) | "Disorder of the genitourinary system" | 4171379 |
| Immune System | "Malignant lymphoma" (432571) | "Disorder of immune function" | 440371 |
| Diagnostic (Procedure) | "Malignant tumor of pancreas" (4180793) | Renamed to "Evaluation" | 4297090 |
| Preventive (Procedure) | "SIADH" (4207539) | "Preventive procedure" | 4061660 |
| Functional Status | "Retired" (4022069) | "Functional finding" | 4041284 |
| Social/Personal History | Isolated leaf concepts (0 children) | Navigable subtree roots | 4028922, 4181664 |

**Root cause:** ILIKE matches substrings — `'%Immune system disorder%'` matched "Malignant lymphoma" before the actual concept.
**Fix:** Reversed resolver priority to trust verified hardcoded IDs first, falling back to name matching only if the ID doesn't exist (vocabulary version change).

## Results

**Root counts after fix:**

| Domain | Before | After | Top Concepts |
|--------|--------|-------|-------------|
| Condition | 174 → 839 | **2** | "Clinical finding" (121 children), "Situation with explicit context" (1) |
| Measurement | 1,223 → 620 | **5** | "Clinical finding", "Observable entity", "Staging and scales", "Procedure", 1 COVID test |
| Observation | 633 → 822 | **57** | Mostly occupation/religion SNOMED concepts (irreducible) |
| Procedure | 12 → 48 | **1** | "Procedure" (SNOMED root, 87 children) |
| Drug | 14 | **14** | Unchanged (ATC 1st-level classes) |
| Visit | 19 | **19** | Unchanged |

**Drilling into "Clinical finding" (Condition domain) now shows:**
- Disease (169 children) — the main disorder hierarchy
- Musculoskeletal finding (111)
- Bleeding (108)
- Neurological lesion (105)
- General finding of soft tissue (104)
- Mass of body structure (76)
- Neurological finding (64)
- Digestive system finding (57)
- Respiratory finding (48)
- … and 112 more clinically organized categories

This is the MedDRA SOC-equivalent navigation structure we needed, derived entirely from SNOMED's own hierarchy rather than a separate maintained classification.

## Technical Details

### concept_tree Table (Updated)

```
PK: (parent_concept_id, child_concept_id, domain_id)  -- was (parent, child)

vocab.concept_tree
├── 538,424 total edges
├── Condition:   226,763 edges, max depth 13
├── Observation: 127,767 edges, max depth 16
├── Procedure:    97,524 edges, max depth 12
├── Drug:         48,452 edges, max depth 6
├── Measurement:  37,634 edges, max depth 12
└── Visit:           278 edges, max depth 4
```

### Performance Characteristics

- `vocabulary:build-hierarchy --fresh --populate-results`: ~30 seconds
- Propagation loop: typically 3-5 iterations per domain for cross-domain chains
- concept_hierarchy (results schemas): 300,250 rows each, populated via recursive CTE
- Tree API (`/v1/vocabulary/tree`): single indexed query, LIMIT 500
- Groupings API (`/v1/vocabulary/groupings`): simple Eloquent query, ~39 rows total

### Files Modified/Created

| File | Change |
|------|--------|
| `backend/app/Services/Vocabulary/HierarchyBuilderService.php` | `buildUnifiedSnomedTree()` + `propagateCrossDomainParents()` |
| `backend/app/Http/Controllers/Api/V1/VocabularyController.php` | `groupings()` endpoint |
| `backend/routes/api.php` | `/vocabulary/groupings` route |
| `backend/database/migrations/2026_04_05_*_create_clinical_groupings_table.php` | New table |
| `backend/app/Models/App/ClinicalGrouping.php` | New model |
| `backend/database/seeders/ClinicalGroupingSeeder.php` | 39 curated groupings |
| `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx` | Groupings UI |
| `frontend/src/features/vocabulary/hooks/useClinicalGroupings.ts` | New hook |
| `frontend/src/features/vocabulary/api/vocabularyApi.ts` | `fetchClinicalGroupings()` |
| `frontend/src/features/vocabulary/types/vocabulary.ts` | `ClinicalGrouping` interface |

## Design Decisions

1. **Unified SNOMED tree vs per-domain trees:** Building all 4 SNOMED domains together ensures cross-domain edges are consistent. Requesting a single domain rebuild still rebuilds all 4.

2. **Tag edges with child's domain:** Each edge in `concept_tree` carries the child's `domain_id`. This lets domain-scoped queries work with a simple WHERE clause while preserving cross-domain parent chains.

3. **PK includes domain_id:** The same (parent, child) edge can appear tagged with different domains — necessary because a cross-domain organizing concept can parent concepts in multiple domains.

4. **Clinical groupings in `app` schema:** Groupings are application-level curation, not vocabulary data. They reference `vocab.concept` by ID but live in `app.clinical_groupings` to respect the read-only vocabulary contract.

5. **Hardcoded IDs over name matching:** ILIKE is fragile for concept resolution (7/39 failed). Verified IDs are vocabulary-version-specific but correct; name matching serves as fallback for vocabulary updates.

6. **Multi-anchor groupings:** 3 groupings use multiple anchors (Endocrine & Metabolic, Neoplasm, Injury & Poisoning). The UI currently navigates to the first anchor; future enhancement could show a sub-grouping selector.

## Future Work

- **Polyhierarchy indicators:** Show "2 parent paths" badges for concepts with multiple SNOMED parents
- **Data prevalence overlay:** Show person count / record count from Achilles results on grouping cards
- **Search-then-browse:** "Show in hierarchy" button from keyword search results
- **Observation root reduction:** 57 roots in Observation are mostly occupation/religion SNOMED concepts — could add Observation-specific groupings to cover them
- **Custom groupings:** Let researchers create and share their own grouping sets for specific therapeutic areas
