# Cohort Categorization Phase 2 — Design Specification

**Date:** 2026-04-10
**Predecessor:** `2026-04-10-cohort-cleanup-categorization-design.md` (Phase 1)
**Handoff:** `2026-04-10-cohort-phase2-handoff.md`
**Status:** Approved — ready for implementation planning

## Scope

Phase 2 extends the Phase 1 foundation (domain/quality_tier columns, grouped table view, tier badges) with:

1. Solr faceted search for domain and quality tier
2. Domain picker in cohort editor + CohortDomain enum
3. Auto-domain detection from expression concept sets
4. Domain NOT NULL migration (after backfill)
5. Deprecation flags with supersession links

Items deferred to Phase 3: approval workflows, expression editor changes, phenotype library integration.

## Approach

Sequential build-up — each feature layers on the previous. Execution order matches the numbering above.

---

## 1. Solr Facets

### Goal

Add `domain` and `quality_tier` as Solr facet fields so search returns faceted counts and supports faceted filtering.

### Changes

**Solr schema** (`solr/configsets/cohorts/conf/schema.xml`):
- Add `domain_s` (type: string, indexed: true, stored: true)
- Add `quality_tier_s` (type: string, indexed: true, stored: true)

**Solr indexing command** (`backend/app/Console/Commands/SolrIndexCohorts.php`):
- Include `domain` and `quality_tier` in the document array:
  ```php
  'domain_s' => $cohort->domain,
  'quality_tier_s' => $cohort->quality_tier,
  ```

**Search controller** (`CohortDefinitionController`):
- When search is Solr-powered, pass `domain_s` and `quality_tier_s` as facet filter queries
- Return facet counts in the search response metadata

**No model changes.** The observer already dispatches Solr indexing on create/update/delete.

### Files Touched

- `solr/configsets/cohorts/conf/schema.xml`
- `backend/app/Console/Commands/SolrIndexCohorts.php`
- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`

---

## 2. Domain Picker in Editor + CohortDomain Enum

### Goal

Formalize domain values as a PHP enum, add a domain dropdown to the cohort editor, and include domain in API validation.

### CohortDomain Enum

**File:** `backend/app/Enums/CohortDomain.php`

```php
enum CohortDomain: string
{
    case CARDIOVASCULAR = 'cardiovascular';
    case METABOLIC = 'metabolic';
    case RENAL = 'renal';
    case ONCOLOGY = 'oncology';
    case RARE_DISEASE = 'rare-disease';
    case PAIN_SUBSTANCE_USE = 'pain-substance-use';
    case PEDIATRIC = 'pediatric';
    case GENERAL = 'general';

    public function label(): string
    {
        return match ($this) {
            self::CARDIOVASCULAR => 'Cardiovascular',
            self::METABOLIC => 'Metabolic / Endocrine',
            self::RENAL => 'Renal',
            self::ONCOLOGY => 'Oncology',
            self::RARE_DISEASE => 'Rare Disease',
            self::PAIN_SUBSTANCE_USE => 'Pain & Substance Use',
            self::PEDIATRIC => 'Pediatric',
            self::GENERAL => 'General',
        };
    }
}
```

### Backend Validation

**Store:** Add `domain` as `nullable|string` validated against `CohortDomain` values. Nullable initially — becomes required after Section 4.

**Update:** Add `domain` as `sometimes|string` validated against `CohortDomain` values.

**Controller refactor:** Replace the hardcoded domain labels array in `CohortDefinitionController::domains()` with `CohortDomain::cases()`.

### Frontend — Domain Dropdown

**File:** `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`

- Add a domain dropdown in the metadata section (alongside name, description, tags, public toggle)
- Populate from the existing `GET /cohort-definitions/domains` endpoint or a static list matching the enum
- When domain is null, show placeholder text: "Assign a domain"
- On change, PATCH the cohort with the new domain value

### Files Touched

- `backend/app/Enums/CohortDomain.php` (new)
- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- `backend/app/Models/App/CohortDefinition.php` (cast domain to enum)
- `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`

---

## 3. Auto-Domain Detection

### Goal

Automatically infer a cohort's clinical domain from the OMOP concepts in its expression JSON. Suggest a domain when the user hasn't set one.

### Algorithm

1. **Extract concept IDs** from `expression_json`: walk primary criteria concept sets and inclusion rule concept sets, collect all `concept.CONCEPT_ID` values
2. **Look up concept domain_id** via `vocab.concept` — returns OMOP domain labels (Condition, Drug, Procedure, Measurement, etc.)
3. **Map to clinical groupings** via `vocab.concept_ancestor` — walk up to `ClinicalGrouping` anchor concepts (the 39 groupings built 2026-04-05). Each anchor maps to a Parthenon clinical domain.
4. **Majority vote** — the Parthenon domain with the highest concept count wins. If the top domain accounts for < 40% of concepts, or no concepts are found, fall back to `general`.

### Implementation

**Observer** (`backend/app/Observers/CohortDefinitionObserver.php`):
- In `created()` and `updated()` handlers, after tier recomputation:
  - If `domain` is already set (user explicitly chose one), skip auto-detection
  - If `domain` is null, run the detection algorithm
  - Set domain via `updateQuietly()` (same pattern as tier)

**Detection service** (`backend/app/Services/Cohort/CohortDomainDetector.php`):
- Encapsulates the concept extraction + vocabulary lookup + majority vote logic
- Accepts `expression_json` array, returns a `CohortDomain` enum value
- Uses the `omop` database connection for vocabulary queries

**User override precedence:**
- On create: if `domain` is non-null in the request payload, skip auto-detection
- On update: if `domain` was changed (`$cohort->isDirty('domain')` before save, or `wasChanged('domain')` after), skip auto-detection
- Auto-detection only fires when `domain` is null after the save completes

### Backfill Command

**File:** `backend/app/Console/Commands/CohortBackfillDomains.php`

```
php artisan cohort:backfill-domains
```

- Iterates all cohorts where `domain IS NULL AND deleted_at IS NULL`
- Runs `CohortDomainDetector` on each
- Reports: "Backfilled N cohorts. Remaining nulls: M"
- Idempotent — safe to run multiple times

### Files Touched

- `backend/app/Observers/CohortDefinitionObserver.php`
- `backend/app/Services/Cohort/CohortDomainDetector.php` (new)
- `backend/app/Console/Commands/CohortBackfillDomains.php` (new)

---

## 4. Domain NOT NULL Migration

### Goal

Make `domain` a required field once all existing cohorts have domains assigned.

### Prerequisites

- Domain picker is in the editor (Section 2)
- Auto-detection is running (Section 3)
- `cohort:backfill-domains` has been run with zero remaining nulls

### Migration

```php
public function up(): void
{
    $nullCount = DB::table('cohort_definitions')
        ->whereNull('domain')
        ->whereNull('deleted_at')
        ->count();

    if ($nullCount > 0) {
        throw new RuntimeException(
            "Cannot make domain NOT NULL: {$nullCount} active cohorts still have NULL domain. "
            . "Run: php artisan cohort:backfill-domains"
        );
    }

    Schema::table('cohort_definitions', function (Blueprint $table) {
        $table->string('domain', 50)->nullable(false)->default('general')->change();
    });
}
```

### Validation Update

- Store: `domain` changes from `nullable|string` to `required|string`
- The `CohortDomain` enum remains the validation source

### Files Touched

- `backend/database/migrations/xxxx_make_cohort_domain_not_null.php` (new)
- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php` (validation tightened)

---

## 5. Deprecation Flags

### Goal

Allow cohorts to be deprecated (kept visible for historical reference) while preventing new study associations. Optionally link to a replacement cohort.

### Migration

Add to `cohort_definitions`:
- `deprecated_at` — nullable timestamp, indexed
- `superseded_by` — nullable unsigned bigint FK → `cohort_definitions.id`

### Model Changes

**File:** `backend/app/Models/App/CohortDefinition.php`

- Add `deprecated_at` and `superseded_by` to `$fillable`
- Add `deprecated_at` to `$casts` as `datetime`
- Add relationships:
  - `supersededBy()`: BelongsTo CohortDefinition (the replacement)
  - `supersedes()`: HasMany CohortDefinition (cohorts this one replaces)
- Add scope: `scopeActive()` → `whereNull('deprecated_at')`
- Add accessor: `isDeprecated(): bool` → `$this->deprecated_at !== null`

### API Endpoints

**Deprecate:** `POST /v1/cohort-definitions/{id}/deprecate`
- Body: `{ "superseded_by": <optional cohort_id> }`
- Sets `deprecated_at = now()`
- If `superseded_by` provided, validates the target exists and is not itself deprecated
- Requires `permission:cohorts.edit`

**Restore:** `POST /v1/cohort-definitions/{id}/restore-active`
- Clears `deprecated_at` and `superseded_by`
- Requires `permission:cohorts.edit`
- Route name avoids conflict with soft-delete restore

### Study Association Guard

**File:** `backend/app/Http/Controllers/Api/V1/StudyCohortController.php`

In `store()`, before creating the StudyCohort:
```php
$cohort = CohortDefinition::findOrFail($validated['cohort_definition_id']);
if ($cohort->isDeprecated()) {
    $message = 'Cannot add a deprecated cohort to a study.';
    if ($cohort->supersededBy) {
        $message .= " Use \"{$cohort->supersededBy->name}\" (ID: {$cohort->superseded_by}) instead.";
    }
    return response()->json(['message' => $message], 422);
}
```

Existing study associations are not affected — deprecation only blocks new ones.

### Frontend

**List view:**
- Deprecated cohorts render with muted opacity (0.6) and a strikethrough on the name
- Amber "Deprecated" badge next to the tier badge
- If `superseded_by` is set, show "Superseded by [linked name]" below the cohort name
- Default filter excludes deprecated; toggle "Show deprecated" to include them

**Detail page:**
- Deprecation banner at top: amber background, "This cohort was deprecated on [date]"
- If superseded: "Superseded by [link to replacement]"
- "Restore" button for users with `cohorts.edit` permission
- "Deprecate" action in the actions menu (with optional superseded-by picker)

### Files Touched

- `backend/database/migrations/xxxx_add_deprecation_to_cohort_definitions.php` (new)
- `backend/app/Models/App/CohortDefinition.php`
- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php` (deprecate/restore endpoints)
- `backend/app/Http/Controllers/Api/V1/StudyCohortController.php` (guard)
- `backend/routes/api.php` (new routes)
- `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx`
- `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`

---

## Out of Scope (Phase 3+)

- Approval workflows / review status (requires notification system, larger UX effort)
- Expression editor quality checklist
- Phenotype library integration
- LLM-based domain classification (simple concept mapping is sufficient)

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| PHP enum for domains | Single source of truth; replaces hardcoded array in controller |
| Observer-based auto-detection | Matches existing tier recomputation pattern; synchronous for immediate feedback |
| Majority vote over LLM | Deterministic, fast, no external dependency; concept_ancestor + ClinicalGrouping already exist |
| 40% threshold for domain assignment | Prevents spurious assignment on mixed-domain cohorts; falls back to general |
| Deprecation as timestamp, not boolean | Captures when it happened; nullable = active, non-null = deprecated |
| Blocking new study associations only | Existing associations are historical record; removing them would break study integrity |
| Separate deprecate/restore endpoints | Explicit actions with audit trail, not just PATCH on a field |
