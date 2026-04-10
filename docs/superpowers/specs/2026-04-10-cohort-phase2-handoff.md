# Cohort Categorization Phase 2 -- Handoff Document

**Date:** 2026-04-10
**Predecessor:** `2026-04-10-cohort-cleanup-categorization-design.md`
**Status:** Not started -- deferred from Phase 1

## Context

Phase 1 adds `domain` and `quality_tier` columns to `app.cohort_definitions`, consolidates 9 duplicate/orphan cohorts, and builds a grouped table view with tier badges. Phase 2 extends this foundation with richer metadata, automation, and workflow capabilities.

## Phase 2 Scope

### 1. Approval Workflows / Review Status

**What:** Multi-user review gates for cohort promotion. A cohort moves through states: Draft -> Under Review -> Approved -> Published. Researchers submit cohorts for review; data stewards approve.

**Why deferred:** Phase 1 tiers are computed automatically. Adding human-in-the-loop review is a separate workflow system requiring role-based permissions, notifications, and audit trail.

**Dependencies:** Spatie RBAC roles (already exist: researcher, data-steward). Notification system (Laravel Notifications).

**Suggested approach:**
- Add `review_status` enum column: `draft`, `under_review`, `approved`, `published`
- Add `reviewed_by` FK to users
- Add `reviewed_at` timestamp
- Create `CohortReviewRequest` model for the review queue
- Data steward role gets `cohorts.review` permission
- Review status is independent of `quality_tier` -- a cohort can be study-ready (computed) but not yet approved (workflow)

### 2. Cohort Deprecation Flags

**What:** A "deprecated" state that keeps the cohort visible (for historical reference) but visually demoted and excluded from new study associations.

**Why deferred:** Soft-delete is binary (visible or gone). Deprecation is a middle state that requires UI treatment (strikethrough, warning badges, "superseded by" links).

**Suggested approach:**
- Add `deprecated_at` nullable timestamp
- Add `superseded_by` nullable FK to cohort_definitions (points to the replacement)
- Deprecated cohorts render with a warning badge and "Superseded by [link]" note
- Prevent adding deprecated cohorts to new studies (validation rule)
- Existing study associations remain untouched

### 3. Domain as Required Field

**What:** Make `domain` non-nullable with enforcement on create/update.

**Why deferred:** Phase 1 needs nullable for backward compatibility. Once all existing cohorts have domains assigned and the UI has a domain picker on the cohort editor, it can become required.

**Suggested approach:**
- Add domain dropdown to CohortDefinitionDetailPage (the editor)
- Run a check: `SELECT COUNT(*) FROM cohort_definitions WHERE domain IS NULL AND deleted_at IS NULL` -- should be 0
- Migration: `ALTER COLUMN domain SET NOT NULL`
- Update CreateCohortDefinitionRequest and UpdateCohortDefinitionRequest to require domain
- Update `createCohortFromBundle` to infer domain from bundle condition

### 4. Auto-Domain Detection

**What:** AI/NLP-based inference of clinical domain from concept sets in the expression JSON. When a user creates a cohort, suggest a domain based on the OMOP concepts used.

**Why deferred:** Requires concept-to-domain mapping logic. Could be simple (map OMOP domain_id + vocabulary_id patterns) or sophisticated (LLM classification). Needs design.

**Suggested approach:**
- Simple first: map concept DOMAIN_ID values to clinical domains. If >50% of concepts are Condition + Drug in cardiovascular SNOMED hierarchy, suggest "cardiovascular"
- Use the concept_ancestor table to walk up to high-level groupings
- Present as a suggestion, not auto-assignment -- user confirms or overrides
- Consider leveraging the existing clinical groupings (concept_hierarchy, 39 groupings built 2026-04-05)

### 5. Cohort Expression Editor Changes

**What:** Modifications to how cohorts are built -- potentially adding domain picker, quality checklist, or guided workflows to the expression builder.

**Why deferred:** Phase 1 is strictly about the list/browse experience. Editor changes are a separate UX effort.

**Suggested areas:**
- Domain picker in the editor sidebar
- Quality checklist panel showing what's missing for "study-ready" tier (e.g., "Add an end strategy", "Add inclusion rules")
- Concept set completeness indicator (how many descendants included vs. available)

### 6. Phenotype Library Integration

**What:** Interop between Parthenon's cohort definitions and the OHDSI Phenotype Library (synced via `phenotype:sync` Artisan command, ~1100 definitions).

**Why deferred:** The phenotype library is a separate system with its own storage. Linking library phenotypes to Parthenon cohorts requires identity mapping and import/diff workflows.

**Suggested approach:**
- Add `phenotype_library_id` nullable FK or reference field to cohort_definitions
- Show "Library match" badge when a Parthenon cohort corresponds to a known phenotype
- Allow one-click import from phenotype library into a new cohort definition
- Show phenotype library metadata (author, citations, validation status) alongside Parthenon metadata

### 7. Solr Facet Integration

**What:** Add `domain` and `quality_tier` as Solr facet fields so the existing Solr-powered search returns faceted counts and supports faceted filtering.

**Why deferred:** Phase 1 filters server-side via SQL. Solr integration requires updating the cohort configset schema, re-indexing, and modifying the search controller.

**Suggested approach:**
- Add `domain_s` and `quality_tier_s` fields to `solr/configsets/cohorts/managed-schema`
- Update the Solr indexing job to include these fields when indexing cohort documents
- Update `CohortDefinitionController` search logic to pass facet filters to Solr
- Re-index all cohorts after schema change: `php artisan solr:reindex cohorts`

## Implementation Order Recommendation

1. **Solr facets** (quick win, improves search immediately)
2. **Domain as required** (depends on Phase 1 domain picker being in place)
3. **Auto-domain detection** (depends on domain being a first-class field)
4. **Deprecation flags** (independent, can be done anytime)
5. **Approval workflows** (largest effort, needs UX design)
6. **Expression editor changes** (depends on approval workflow to show quality checklist)
7. **Phenotype library integration** (lowest priority, independent)

## Key Files to Reference

- `backend/app/Models/App/CohortDefinition.php` -- Model with domain/quality_tier columns (Phase 1)
- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php` -- API controller with group_by support (Phase 1)
- `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx` -- List page with grouped view (Phase 1)
- `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx` -- Table component (Phase 1)
- `backend/app/Observers/CohortDefinitionObserver.php` -- Tier recomputation observer (Phase 1)
- `solr/configsets/cohorts/` -- Solr schema for cohort search
- `backend/app/Console/Commands/PhenotypeSyncCommand.php` -- Phenotype library sync
