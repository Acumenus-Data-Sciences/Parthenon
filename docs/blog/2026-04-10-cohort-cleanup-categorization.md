---
slug: cohort-cleanup-categorization
title: "Taming the Cohort Zoo: Clinical Domain Categorization and a Quality-Tiered Browse Experience"
authors: [mudoshi, claude]
tags: [cohort-definitions, ux, data-quality, categorization, omop, phenotyping, architecture, frontend, backend]
date: 2026-04-10
---

![A dense crowd of people — finding the right cohort in an unorganized list feels just like this.](./img/cohort-crowd.jpg)

Every research platform hits the same inflection point. You build a powerful cohort builder. Researchers love it. They create cohorts for Study 1, Study 2, the rare disease project, the pancreatic cancer corpus. Each study gets its own "All-Cause Death" outcome. Each gets its own "MACE" composite endpoint. Before long, you're staring at 89 cohort definitions in a flat, unsorted list where a meticulous seven-concept-set new-user design sits next to an auto-generated stub with one concept and no generations. A Rett syndrome genotype-stratified trial cohort is sandwiched between a SynPUF cardiometabolic triad and a never-run hypertension bundle. The list is technically complete and practically useless.

Today, Parthenon ships a cohort categorization system that solves this. We audited every cohort definition in the database, identified and consolidated 9 duplicates and orphans, assigned 80 surviving cohorts to 8 clinical domains, computed a quality tier for each one, and rebuilt the Cohort Definitions page with collapsible domain-grouped sections and quality filter pills. Researchers can now browse by clinical domain, filter to study-ready phenotypes, and find what they need in seconds instead of scrolling through a flat table.

This post describes the problem in detail, explains how we analyzed and scored the inventory, walks through the architecture, and shows what the result looks like.

<!-- truncate -->

---

## The Problem: Cohort Sprawl

Parthenon's cohort builder uses the OHDSI CIRCE expression format — JSON documents describing primary criteria, inclusion rules, concept sets, end strategies, censoring events, and demographic filters. Each cohort definition can be generated against any CDM source (SynPUF, Acumenus, IRSF-NHS, Pancreas) to materialize patient lists. Definitions are linked to studies via `study_cohorts`, which assigns each cohort a role: target, comparator, outcome, event, exclusion, or subgroup.

After five months of active development across 10+ studies and 4 CDM sources, the inventory looked like this:

| Category | Count | Examples |
|----------|-------|---------|
| SynPUF study cohorts (S1-S5) | 15 | Prediabetes Metformin Initiators, Post-MI Clopidogrel, Cardiometabolic Triad |
| SynPUF study cohorts (S6-S10) | 37 | Cardiorenal Cascade, Statin Paradox, Opioid Trajectory, Metformin Repurposing |
| IRSF Rett Syndrome cohorts | 22 | MECP2 genotype strata, CDKL5/FOXG1, AED treatment pathways, CSS outcomes |
| Pancreatic Cancer corpus | 5 | All PDAC, Resectable PDAC, FOLFIRINOX, KRAS Mutant, CA 19-9 |
| Seed/sample definitions | 5 | Essential Hypertension, CAD with Statin, Heart Failure with BNP |
| Miscellaneous | 5 | Pediatric HTN/DM, bundle-generated stubs, duplicates |
| **Total** | **89** | |

The flat list had no structure. Tags existed but were inconsistent — some cohorts used `["study-4", "MACE"]`, others used `["mace", "outcome", "s7"]`, and some had no tags at all. There was no concept of domain, no quality indicator, no way to distinguish a battle-tested phenotype from a draft stub.

---

## The Audit: Finding Duplicates

Before designing any UI, we ran a forensic audit. Using concept fingerprint analysis — extracting and comparing the sorted set of OMOP concept IDs across all concept sets in each expression — we identified **18 pairs of cohorts with identical clinical definitions**:

| Canonical | Duplicate | What Happened |
|-----------|-----------|---------------|
| #72 T2DM First Occurrence | #158 S10: T2DM First Occurrence | Same expression copied for S10 |
| #75 CKD Adv Progression | #78 CKD Adv Progression (Study 3) | Same outcome reused verbatim |
| #81 MACE MI/Stroke | #84 Recurrent MACE (Study 5) | Identical concept set |
| #173 MACE With CHF | #187 S9: MACE With CHF | Same composite endpoint |
| #155 Metabolic Syndrome | #164 S6: Metabolic Syndrome | Same single-concept lookup |
| #174 All-Cause Death | #181 S8 + #188 S9 All-Cause Death | Three-way duplicate |

Additionally, two orphans had zero study associations and no analytical value:
- **#139** "Type 2 Diabetes Mellitus" — an older seed definition superseded by #72
- **#229** "Hypertension Cohort" — auto-generated from a care bundle, never executed

The pattern was clear: when researchers built a new study, they created study-specific copies of shared outcome and event cohorts rather than reusing canonical definitions. This is natural workflow behavior — you don't want to accidentally modify someone else's study endpoint. But it creates sprawl.

---

## The Solution: Consolidate, Categorize, Tier

The design had three parts, each reinforcing the others:

### Part 1: Consolidation (89 to 80)

For each duplicate pair, we chose a **canonical** cohort (usually the older one with more generation history), renamed it to be study-agnostic, re-pointed all `study_cohorts` foreign keys from duplicates to canonicals, and soft-deleted the redundant copies. This required careful transaction management — every re-point and delete had to be atomic.

```
BEFORE:
  Study 5 outcome → #84 "Recurrent MACE — MI or Stroke (Study 5)"
  Study 4 outcome → #81 "Major Adverse Cardiovascular Events — MI or Stroke (Study 4)"
  
AFTER:
  Study 5 outcome → #81 "Composite MACE — MI or Stroke First Occurrence"  ← renamed
  Study 4 outcome → #81 "Composite MACE — MI or Stroke First Occurrence"
  #84 → soft-deleted
```

The canonical cohorts also received a `"shared"` tag to signal their cross-study nature.

### Part 2: Clinical Domain Assignment

Every surviving cohort received a `domain` classification — a controlled vocabulary of 8 clinical domains:

| Domain | Count | Includes |
|--------|-------|----------|
| Rare Disease | 22 | IRSF Rett Syndrome genotype strata, AED treatment, CSS outcomes |
| Cardiovascular | 15 | Hypertension, CAD, Heart Failure, MACE, Post-MI antiplatelet, Statins |
| Metabolic | 12 | Prediabetes, T2DM, Metformin, Insulin, Metabolic Syndrome |
| Renal | 12 | CKD stages 1-5, eGFR monitoring, ESRD, Nephrotoxicity |
| General | 7 | All-Cause Death, Matched Controls, cross-domain utility cohorts |
| Pain & Substance Use | 6 | Opioid trajectories, NSAID vs Acetaminophen, MAT, Naloxone |
| Oncology | 5 | Pancreatic cancer: PDAC, FOLFIRINOX, KRAS, CA 19-9 |
| Pediatric | 1 | Pediatric HTN and Diabetes (Age 2-17) |

Domain assignment was done by analyzing tags, naming patterns, and concept content. It's stored as a `varchar(50)` column on `cohort_definitions`, indexed for fast filtering.

### Part 3: Quality Tier Computation

Each cohort receives a computed **quality tier** based on three signals available in the database:

```
STUDY-READY:
  completed_generations > 0       ← Has been executed successfully
  AND study_associations > 0      ← Used in at least one study
  AND (concept_sets >= 2          ← Has meaningful phenotype complexity
       OR has_inclusion_rules
       OR has_end_strategy)

VALIDATED:
  completed_generations > 0       ← Has been executed
  AND does NOT meet study-ready   ← Lacks study use or complexity

DRAFT:
  Everything else                 ← Never successfully generated
```

The tier logic intentionally distinguishes between a sophisticated multi-concept-set new-user design (study-ready) and a simple single-concept first-occurrence lookup used as a study outcome (validated). Both have been generated, but the former represents a reusable, carefully constructed phenotype definition while the latter is a lightweight building block.

The tier is **stored, not computed at query time**, because the calculation requires joining `cohort_generations` and `study_cohorts` and inspecting the expression JSON. Recomputation is event-driven: a model observer triggers `recomputeQualityTier()` whenever a cohort is created, updated, or when a generation completes.

Result across the 80 active cohorts:

| Tier | Count | Description |
|------|-------|-------------|
| Study-Ready | 23 | Fully operational phenotypes with study associations and expression complexity |
| Validated | 57 | Successfully generated but simpler (outcomes, events, single-concept lookups) |
| Draft | 0 | All current cohorts have been generated at least once |

---

## Architecture

### Database Changes

One schema migration adds two indexed columns:

```sql
ALTER TABLE cohort_definitions
  ADD COLUMN domain VARCHAR(50),
  ADD COLUMN quality_tier VARCHAR(20);

CREATE INDEX idx_cohort_definitions_domain ON cohort_definitions(domain);
CREATE INDEX idx_cohort_definitions_quality_tier ON cohort_definitions(quality_tier);
```

Two data migrations follow: one assigns domains and computes tiers for all existing cohorts, the other performs the consolidation (renames, re-points, soft-deletes) inside a single transaction with full audit logging.

### Backend API

The existing `GET /cohort-definitions` endpoint gained three new query parameters without breaking backward compatibility:

| Parameter | Type | Effect |
|-----------|------|--------|
| `domain` | string | Filter to a single clinical domain |
| `quality_tier` | string | Filter by tier (study-ready, validated, draft) |
| `group_by=domain` | string | Return grouped response instead of flat paginated list |

When `group_by=domain` is present, the response shape changes:

```json
{
  "data": {
    "groups": [
      {
        "key": "cardiovascular",
        "label": "Cardiovascular",
        "count": 15,
        "cohorts": [ ... ]
      }
    ],
    "tier_counts": {
      "study-ready": 23,
      "validated": 57,
      "draft": 0
    }
  }
}
```

Each cohort in the grouped response includes `latest_generation` and `generation_sources` — the same metadata the flat list provides. The grouped path reuses the same Eloquent query builder with all existing filters (search, tags, author_id) applied, so combined queries like `group_by=domain&search=KRAS` work correctly.

A new `GET /cohort-definitions/domains` endpoint returns the domain vocabulary with live counts, and the existing `GET /cohort-definitions/stats` endpoint now includes `tier_counts`.

### Tier Recomputation

The `CohortDefinitionObserver` was extended to call `recomputeQualityTier()` on create and update events. The method uses `updateQuietly()` to avoid recursive observer triggers:

```php
public function recomputeQualityTier(): void
{
    $completedGens = $this->generations()->where('status', 'completed')->count();
    $studyUses = $this->studyCohorts()->count();

    $expression = $this->expression_json ?? [];
    $hasComplexity = count($expression['ConceptSets'] ?? []) >= 2
        || count($expression['AdditionalCriteria']['CriteriaList'] ?? []) > 0
        || (isset($expression['EndStrategy']) && $expression['EndStrategy'] !== null);

    if ($completedGens > 0 && $studyUses > 0 && $hasComplexity) {
        $tier = 'study-ready';
    } elseif ($completedGens > 0) {
        $tier = 'validated';
    } else {
        $tier = 'draft';
    }

    if ($this->quality_tier !== $tier) {
        $this->updateQuietly(['quality_tier' => $tier]);
    }
}
```

### Frontend

The Cohort Definitions page gains three new UI elements:

**1. View Mode Toggle** — A segmented control ("By Domain" / "Flat List") at the top of the page. Defaults to domain view. Each mode has its own TanStack Query hook with an `enabled` guard so only the active mode's API call fires.

**2. Tier Filter Pills** — A horizontal row of clickable badges: All, Study-Ready, Validated, Draft. Clicking a pill filters the results in both view modes. The active pill highlights in the platform's teal accent.

**3. Collapsible Domain Sections** — In domain view, each clinical domain renders as a collapsible accordion section with a header showing the domain name (uppercase, tracking wider) and cohort count. The first three domains auto-expand on initial load. Each expanded section contains a table with columns for Name, Tier (badge), N (person count), Sources, and Updated.

The tier badge component uses the clinical theme's color vocabulary:
- **Study-Ready:** Teal (#2DD4BF) with Shield icon
- **Validated:** Gold (#C9A227) with Award icon
- **Draft:** Gray (#6B7280) with FileText icon

---

## Bugs Found During Testing

Deep end-to-end testing after initial implementation revealed three bugs that would have been invisible in component-level testing:

**1. Phantom grouped API call.** The `useGroupedCohortDefinitions` hook fired unconditionally — even when the user was in flat list mode. Every page load made two API calls (grouped + flat) instead of one. Fix: added `enabled` guards to both hooks, gated on the active view mode.

**2. Flat states blocking grouped view.** The component checked flat query loading/error/empty states *before* the grouped view branch. When `My Only` was toggled on and the flat query returned empty (the admin authored all cohorts, but a regular user authored none), the empty state rendered instead of the grouped view. Fix: moved the grouped check above the flat early returns.

**3. Solr hijacking grouped requests.** When a user searched while in domain view (`group_by=domain&search=KRAS`), the Solr full-text search path activated first and returned a flat response, bypassing the grouped logic entirely. The frontend received unexpected JSON and crashed silently. Fix: skip Solr when `group_by` is present — the PostgreSQL ILIKE fallback handles search correctly in the grouped path.

All three were interaction bugs — they only manifested when specific combinations of UI state (view mode + filter + user context) aligned. They passed TypeScript compilation, unit tests, and individual endpoint testing. They failed end-to-end.

---

## Data Integrity Verification

The consolidation touched live study associations, so we verified every invariant:

| Check | Expected | Actual |
|-------|----------|--------|
| Active cohort count | 80 | 80 |
| Cohorts with null domain | 0 | 0 |
| Cohorts with null quality_tier | 0 | 0 |
| study_cohorts pointing to soft-deleted cohorts | 0 | 0 |
| Domains endpoint sum | 80 | 80 |
| Tier misclassifications (validated that should be study-ready) | 0 | 0 |
| Reverse misclassifications (study-ready without qualifying criteria) | 0 | 0 |
| Canonical cohort renames applied | 5/5 | 5/5 |
| "shared" tag on canonical cohorts | 6/6 | 6/6 |
| Soft-deleted cohorts count | 9 | 9 |

---

## What Changed (By the Numbers)

| Metric | Before | After |
|--------|--------|-------|
| Active cohort definitions | 89 | 80 |
| Duplicate definitions | 18 pairs | 0 |
| Orphaned definitions | 2 | 0 |
| Cohorts with domain classification | 0 | 80 (100%) |
| Cohorts with quality tier | 0 | 80 (100%) |
| Study-ready phenotypes identifiable | No | 23 highlighted |
| API response for `group_by=domain` | N/A | 8 groups, 80 cohorts, tier counts |
| Clicks to find a cardiovascular study-ready cohort | ~15 (scroll, scan, guess) | 2 (click domain, click tier) |

---

## What's Next (Phase 2)

The categorization system ships today as Phase 1. A comprehensive Phase 2 handoff document is already written, covering:

1. **Solr facet integration** — Domain and tier as Solr search facets for sub-second filtered search
2. **Domain as required field** — Make domain mandatory on new cohort creation with a picker in the editor
3. **Auto-domain detection** — Infer domain from concept sets using OMOP concept hierarchy mappings
4. **Deprecation flags** — A "deprecated but visible" state with "superseded by" links
5. **Approval workflows** — Multi-user review gates (Draft -> Under Review -> Approved -> Published)
6. **Expression editor enhancements** — Quality checklist panel showing what's needed for study-ready tier
7. **Phenotype library integration** — Link to the OHDSI Phenotype Library's 1,100+ validated definitions

---

## Conclusion

Cohort definitions are the atomic unit of observational research. Every study, every analysis, every incidence rate calculation starts with a cohort. When researchers can't find the right cohort — or worse, unknowingly create a duplicate of one that already exists — the entire research workflow degrades. Time is wasted, consistency is lost, and institutional knowledge decays into a flat list of 89 entries that no one wants to scroll through.

The categorization system doesn't change what cohorts *are*. It changes how researchers *find* them. Eight clinical domains, three quality tiers, collapsible grouping, and the elimination of duplicates transform the cohort library from a warehouse into a catalog. A cardiovascular researcher sees cardiovascular cohorts first. A study designer filters to study-ready phenotypes. A new team member browses by domain to understand what's already been built.

The best part: it required zero changes to how cohorts are built, generated, or analyzed. The expression editor, the SQL compiler, the generation pipeline, the diagnostics engine — all untouched. We added two database columns, three migrations, one observer method, and a few hundred lines of React. The heaviest lift was the audit that preceded it: reading 89 expression JSONs, identifying the duplicate fingerprints, tracing the study associations, and deciding which cohorts to canonicalize.

Twelve commits. Three migrations. Nine cohorts retired. Eighty cohorts organized. Zero cohorts lost.
