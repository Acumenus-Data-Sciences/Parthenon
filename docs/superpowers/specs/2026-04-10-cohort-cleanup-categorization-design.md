# Cohort Definition Cleanup & Categorized View

**Date:** 2026-04-10
**Status:** Approved
**Author:** Dr. Sanjay Udoshi / Claude

## Problem

89 active cohort definitions with no organizational structure beyond free-text tags. Multiple exact duplicates exist across studies (identical concept fingerprints). Orphaned cohorts with zero study associations and no generation history clutter the list. Researchers cannot quickly identify study-ready cohorts vs. drafts, or browse by clinical domain.

## Goals

1. Consolidate duplicate cohorts into canonical shared definitions and soft-delete redundant copies
2. Soft-delete orphaned/junk cohorts
3. Add structured categorization (clinical domain, data source) with a toggle-based grouped table view
4. Compute and display a quality tier (Study-Ready / Validated / Draft) derived from expression complexity, generation history, and study usage

## Inventory Summary

- **89** active cohort definitions before cleanup
- **80** after cleanup (9 removed: 2 orphans + 7 duplicates)
- Domains: Cardiovascular (13), Renal (12), Metabolic (12), Rare Disease (22), Oncology (5), Pain & Substance Use (7), Pediatric (1), General (8)

---

## Section 1: Data Cleanup

### 1a — Rename canonical cohorts (strip study prefixes)

| ID | Current Name | New Name |
|---|---|---|
| 72 | Type 2 Diabetes Mellitus -- First Occurrence | *(keep as-is)* |
| 75 | CKD Advanced Progression -- Stages 4-5 or Dialysis First Occurrence | CKD Advanced Progression -- Stages 4-5 or Dialysis |
| 173 | S7: Composite MACE -- First Occurrence (With CHF) | Composite MACE -- First Occurrence (With CHF) |
| 155 | S10: Metabolic Syndrome -- First Occurrence | Metabolic Syndrome -- First Occurrence |
| 81 | Major Adverse Cardiovascular Events -- MI or Stroke First Occurrence (Study 4) | Composite MACE -- MI or Stroke First Occurrence |
| 174 | S7: All-Cause Death | All-Cause Death |

### 1b — Re-point study_cohorts references

| Redundant ID | Canonical ID | study_cohorts rows to update |
|---|---|---|
| 158 | 72 | S10 study refs |
| 78 | 75 | Study 3 (study_id 97) |
| 187 | 173 | S9 study refs |
| 164 | 155 | S6 study (study_id 102) |
| 84 | 81 | S5 study (study_id 99) |
| 181 | 174 | S8 study (study_id 103) |
| 188 | 174 | S9 study refs |

### 1c — Soft-delete 9 cohorts

**Orphans:** 139, 229
**Duplicates:** 158, 78, 187, 164, 84, 181, 188

### 1d — Update tags on canonical cohorts

Strip study-specific prefixes (S6:, S7:, S10:). Add `"shared"` tag to canonical cohorts that serve multiple studies.

---

## Section 2: New Database Columns

### Migration: add_domain_and_quality_tier_to_cohort_definitions

Add to `app.cohort_definitions`:

- `domain` -- `varchar(50)`, nullable, indexed
- `quality_tier` -- `varchar(20)`, nullable, indexed

### Domain vocabulary

| Key | Label |
|---|---|
| `cardiovascular` | Cardiovascular |
| `metabolic` | Metabolic |
| `renal` | Renal |
| `oncology` | Oncology |
| `rare-disease` | Rare Disease |
| `pain-substance-use` | Pain & Substance Use |
| `pediatric` | Pediatric |
| `general` | General |

### Domain assignment (one-time data migration)

| Domain | Cohort IDs |
|---|---|
| cardiovascular | 66, 67, 68, 79, 80, 81, 82, 83, 173, 175, 176, 195, 196 |
| metabolic | 70, 71, 72, 155, 156, 159, 184, 185, 186, 190, 189, 197 |
| renal | 69, 73, 74, 75, 76, 77, 157, 160, 161, 162, 167, 169 |
| rare-disease | 198-219 (all IRSF) |
| oncology | 221-225 (all Pancreas) |
| pain-substance-use | 177-183 (all S8 Opioid) |
| pediatric | 228 |
| general | 154, 163, 165, 166, 168, 170, 174 |

### Quality tier computation

```
study-ready:
  - has 1+ completed generation AND
  - has 1+ study_cohorts association AND
  - (concept_set_count >= 2 OR has inclusion_rules OR has end_strategy)

validated:
  - has 1+ completed generation AND
  - does NOT meet study-ready criteria

draft:
  - everything else
```

Tier is stored, not computed at query time. Recomputed via model observers when:
- CohortDefinition is updated
- CohortGeneration completes
- StudyCohort is created or deleted

Implemented as `recomputeQualityTier()` on the CohortDefinition model.

---

## Section 3: Frontend -- Enhanced Table with Grouped Rows

### Layout

```
+-------------------------------------------------------------+
|  [By Domain] [By Data Source]    Search...    [Filters]      |
|                                                              |
|  Tier: [All] [Study-Ready 38] [Validated 27] [Draft 15]     |
+--------------------------------------------------------------+
|                                                              |
|  > CARDIOVASCULAR (13)                                       |
|  +----------------------------------------------------------+|
|  | Name                    | Tier  | N     | Studies | Ver  ||
|  | Essential HTN w/ Rx     | S-R   | 62K   | 2       | 1    ||
|  | CAD w/ Statin           | S-R   | 33K   | 1       | 2    ||
|  | Heart Failure w/ BNP    | S-R   | 27K   | 2       | 1    ||
|  +----------------------------------------------------------+|
|                                                              |
|  > RENAL (12)                                                |
|  > METABOLIC (12)                                            |
|  > RARE DISEASE (22)                                         |
|  > ONCOLOGY (5)                                              |
|  > PAIN & SUBSTANCE USE (7)                                  |
|  > PEDIATRIC (1)                                             |
|  > GENERAL (8)                                               |
+--------------------------------------------------------------+
```

### UI elements

**Toggle bar** -- Segmented control: "By Domain" | "By Data Source". Switches group headers. By Data Source groups: SynPUF, IRSF-NHS, Pancreas, Acumenus.

**Tier filter pills** -- Clickable badges with counts. Filters table within all groups.

**Group headers** -- Collapsible. First 2-3 expanded by default. Sticky on scroll.

**Table columns:**

| Column | Content |
|---|---|
| Name | Clickable link to detail page |
| Tier | Badge: teal "Study-Ready", gold "Validated", gray "Draft" |
| N | Latest person_count from most recent completed generation, or "--" |
| Studies | Count of study_cohorts associations |
| Ver | Version number |
| Sources | Small badges for CDM sources generated against |
| Updated | Relative timestamp |

**Tier badge colors (clinical theme):**
- Study-Ready: teal `#2DD4BF`
- Validated: gold `#C9A227`
- Draft: muted gray `#6B7280`

**"By Data Source" grouping logic:**
- IRSF cohorts (198-219): identified by `rare-disease` domain or `IRSF-NHS` / `irsf` tags
- Pancreas cohorts (221-225): identified by `oncology` domain or `pancreatic-cancer` / `pdac` tags
- SynPUF cohorts: any cohort with a completed generation against the SynPUF source
- Acumenus cohorts: any cohort with a completed generation against the Acumenus source
- Cohorts generated against multiple sources appear in each group (not deduplicated)
- Cohorts with no generations and no source-identifying tags appear under "Unassigned"

**Preserved features:** Search, tag filters, import modal, bundle creation, pagination.

---

## Section 4: Backend API Changes

### Modified: GET /api/v1/cohort-definitions

New query parameters:
- `domain=cardiovascular` -- filter by domain
- `quality_tier=study-ready` -- filter by tier
- `group_by=domain|source` -- returns grouped response

Grouped response shape:

```json
{
  "data": {
    "groups": [
      {
        "key": "cardiovascular",
        "label": "Cardiovascular",
        "count": 13,
        "cohorts": [ ... ]
      }
    ],
    "tier_counts": {
      "study-ready": 38,
      "validated": 27,
      "draft": 15
    }
  }
}
```

Without `group_by`, response is unchanged (flat paginated list). No breaking change.

### New: GET /api/v1/cohort-definitions/domains

Returns domain vocabulary with counts:

```json
[
  { "key": "cardiovascular", "label": "Cardiovascular", "count": 13 }
]
```

### Tier recomputation

Triggered by model observers on CohortDefinition, CohortGeneration, and StudyCohort events. Calls `CohortDefinition::recomputeQualityTier()`.

### No changes to

Create, update, delete, generate, export, import, share, diagnostics, compare, SQL preview, stats, or bundle endpoints.

---

## Section 5: Migration & Data Integrity

### Three migrations in sequence

**Migration 1:** `add_domain_and_quality_tier_to_cohort_definitions`
- Add columns with indexes
- Standard `down()` drops columns

**Migration 2:** `assign_cohort_domains_and_tiers`
- Data migration: assigns domain and quality_tier to all active cohorts
- Idempotent

**Migration 3:** `consolidate_duplicate_cohorts`
- Renames 6 canonical cohorts
- Updates 7 study_cohorts rows
- Updates tags on canonical cohorts
- Soft-deletes 9 cohorts
- Wrapped in transaction
- Logs all changes for audit

### Rollback safety
- Soft-deletes are reversible (restore deleted_at)
- study_cohorts re-pointing logged with original IDs
- Column drops via standard down()

### Pre-flight checks (Migration 3)
- All re-point targets exist and are not soft-deleted
- No care_gap_evaluations/care_gap_snapshots lose critical data (FK is SET NULL)

---

## Section 6: Explicitly Out of Scope (Phase 2)

The following are deferred to Phase 2. See `docs/superpowers/specs/2026-04-10-cohort-phase2-handoff.md` for details.

1. **Approval workflows / review status** -- Multi-user review gates for cohort promotion
2. **Cohort deprecation flags** -- "Deprecated but visible" state beyond soft-delete
3. **Domain as required field** -- Currently nullable; making it mandatory with enforcement
4. **Auto-domain detection** -- AI/NLP-based domain inference from concept sets
5. **Cohort expression editor changes** -- Modifications to how cohorts are built
6. **Phenotype library integration** -- OHDSI phenotype library sync interop
7. **Solr facet integration** -- Domain and tier as Solr facets for search (initial implementation filters server-side)

---

## Duplicate Analysis Reference

Identical concept fingerprint pairs found in the database:

| Canonical | Duplicate | Reason |
|---|---|---|
| 72 T2DM First Occurrence | 158 S10: T2DM First Occurrence | Same expression |
| 75 CKD Adv Progression | 78 CKD Adv Progression (Study 3) | Same expression |
| 173 S7: MACE (With CHF) | 187 S9: MACE (With CHF) | Same expression |
| 155 S10: MetSyn | 164 S6: MetSyn | Same expression |
| 81 S4: MACE MI/Stroke | 84 S5: MACE MI/Stroke | Same expression |
| 174 S7: All-Cause Death | 181 S8 + 188 S9 All-Cause Death | Same expression (3-way) |
| -- | 139 T2DM (old seed) | Orphan, 0 study uses |
| -- | 229 Hypertension Cohort | Bundle-generated, never run, 0 uses |
