# Cohort Categorization Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Solr faceted search, domain picker + enum, auto-domain detection, domain NOT NULL enforcement, and deprecation flags to cohort definitions.

**Architecture:** Sequential build-up — each task layers on the previous. Backend changes use the existing observer pattern for side effects. Auto-domain detection uses OMOP concept vocabulary + ClinicalGrouping anchor concepts for majority-vote classification. Deprecation adds columns + endpoints + study-association guard.

**Tech Stack:** Laravel 11 / PHP 8.4, React 19 / TypeScript, Solr 9.7, PostgreSQL 17, TanStack Query

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `backend/app/Enums/CohortDomain.php` | String-backed enum with 8 clinical domain values + labels |
| `backend/app/Services/Cohort/CohortDomainDetector.php` | Concept-based domain inference from expression JSON |
| `backend/app/Console/Commands/CohortBackfillDomains.php` | Artisan command to backfill NULL domains |
| `backend/database/migrations/xxxx_add_deprecation_to_cohort_definitions.php` | Adds `deprecated_at` + `superseded_by` columns |
| `backend/database/migrations/xxxx_make_cohort_domain_not_null.php` | Sets domain NOT NULL with safety check |

### Modified Files
| File | What Changes |
|------|-------------|
| `solr/configsets/cohorts/conf/schema.xml` | Add `domain_s` and `quality_tier_s` fields |
| `backend/app/Services/Solr/CohortSearchService.php` | Add domain/tier facet fields + filter query support |
| `backend/app/Jobs/Solr/SolrUpdateCohortJob.php` | Include domain + quality_tier in indexed documents |
| `backend/app/Console/Commands/SolrIndexCohorts.php` | Include domain + quality_tier in batch indexing |
| `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php` | Enum-based domains(), domain validation in store/update, deprecate/restore endpoints, Solr filter passthrough |
| `backend/app/Models/App/CohortDefinition.php` | Enum cast, deprecation relationships/scopes/accessor |
| `backend/app/Observers/CohortDefinitionObserver.php` | Auto-domain detection hook |
| `backend/app/Http/Controllers/Api/V1/StudyCohortController.php` | Deprecation guard in store() |
| `backend/routes/api.php` | Deprecate + restore routes |
| `frontend/src/features/cohort-definitions/types/cohortExpression.ts` | Add deprecation fields to CohortDefinition, domain to UpdatePayload |
| `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx` | Domain dropdown, deprecation banner, deprecate/restore actions |
| `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx` | Deprecated row styling, "Show deprecated" toggle |
| `frontend/src/features/cohort-definitions/api/cohortApi.ts` | deprecateCohort, restoreCohort API functions |
| `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts` | useDeprecateCohort, useRestoreCohort mutation hooks |

---

## Task 1: Solr Schema — Add Domain and Quality Tier Fields

**Files:**
- Modify: `solr/configsets/cohorts/conf/schema.xml:54-57`

- [ ] **Step 1: Add Solr fields**

In `solr/configsets/cohorts/conf/schema.xml`, after line 57 (`version` field), add:

```xml
  <field name="domain_s" type="string" indexed="true" stored="true"/>
  <field name="quality_tier_s" type="string" indexed="true" stored="true"/>
```

- [ ] **Step 2: Commit**

```bash
git add solr/configsets/cohorts/conf/schema.xml
git commit -m "feat: add domain and quality_tier fields to Solr cohorts schema"
```

---

## Task 2: Solr Indexing — Include Domain and Quality Tier in Documents

**Files:**
- Modify: `backend/app/Jobs/Solr/SolrUpdateCohortJob.php:63-77`
- Modify: `backend/app/Console/Commands/SolrIndexCohorts.php:57-71`

- [ ] **Step 1: Update SolrUpdateCohortJob**

In `backend/app/Jobs/Solr/SolrUpdateCohortJob.php`, in the `indexCohort()` method, add two fields to the `$doc` array after `'version'` (line 77):

```php
            'domain_s' => $cohort->domain,
            'quality_tier_s' => $cohort->quality_tier,
```

- [ ] **Step 2: Update SolrIndexCohorts batch command**

In `backend/app/Console/Commands/SolrIndexCohorts.php`, in the cohort document array after `'version'` (line 70):

```php
                    'domain_s' => $cohort->domain,
                    'quality_tier_s' => $cohort->quality_tier,
```

- [ ] **Step 3: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Jobs/Solr/SolrUpdateCohortJob.php backend/app/Console/Commands/SolrIndexCohorts.php
git commit -m "feat: include domain and quality_tier in Solr cohort documents"
```

---

## Task 3: Solr Search — Add Facet Fields and Filter Queries

**Files:**
- Modify: `backend/app/Services/Solr/CohortSearchService.php:28-45,49-86`

- [ ] **Step 1: Add facet fields**

In `backend/app/Services/Solr/CohortSearchService.php`, update the `facet.field` array (line 41) to include the new fields:

```php
            'facet.field' => ['type', 'status', 'tags', 'author_name', 'study_type', 'phase', 'priority', 'domain_s', 'quality_tier_s'],
```

- [ ] **Step 2: Add domain_s to the `fl` return fields list**

In the `fl` param (line 35), append `domain_s,quality_tier_s`:

```php
            'fl' => 'id,type,name,description,tags,author_name,author_id,status,is_public,created_at,updated_at,person_count,generation_count,version,study_type,study_design,phase,priority,pi_name,domain_s,quality_tier_s',
```

- [ ] **Step 3: Add filter query support for domain and quality_tier**

In the filter query section (after the `priority` filter block around line 81), add:

```php
        if (! empty($filters['domain'])) {
            $fq[] = 'domain_s:'.self::escapeValue($filters['domain']);
        }

        if (! empty($filters['quality_tier'])) {
            $fq[] = 'quality_tier_s:'.self::escapeValue($filters['quality_tier']);
        }
```

- [ ] **Step 4: Pass domain/tier filters from controller to Solr**

In `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`, update the Solr search call in `index()` (around line 58). Change:

```php
                $solrResult = $this->cohortSearch->search($search, [
                    'type' => 'cohort',
                    'tags' => $tags ?: null,
                ], $perPage, $offset);
```

To:

```php
                $solrResult = $this->cohortSearch->search($search, [
                    'type' => 'cohort',
                    'tags' => $tags ?: null,
                    'domain' => $filterDomain ?: null,
                    'quality_tier' => $filterTier ?: null,
                ], $perPage, $offset);
```

- [ ] **Step 5: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/Solr/CohortSearchService.php backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php
git commit -m "feat: add domain and quality_tier Solr facets with filter query support"
```

---

## Task 4: Re-index Solr Cohorts

- [ ] **Step 1: Reload Solr configset and re-index**

```bash
docker compose restart solr
# Wait for Solr to come up
docker compose exec php php artisan solr:index-cohorts --fresh
```

- [ ] **Step 2: Verify facets appear in search results**

```bash
curl -s 'http://localhost:8983/solr/cohorts/select?q=*:*&rows=1&facet=true&facet.field=domain_s&facet.field=quality_tier_s&facet.mincount=1' | python3 -m json.tool | head -40
```

Expected: `facet_counts.facet_fields.domain_s` and `facet_counts.facet_fields.quality_tier_s` should have values.

---

## Task 5: CohortDomain Enum

**Files:**
- Create: `backend/app/Enums/CohortDomain.php`

- [ ] **Step 1: Create the enum**

Create `backend/app/Enums/CohortDomain.php`:

```php
<?php

namespace App\Enums;

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

    /**
     * Map ClinicalGrouping names (from app.clinical_groupings) to CohortDomain values.
     * ClinicalGroupings are more granular (39 groupings); this collapses them into 8 domains.
     *
     * @return array<string, self>
     */
    public static function clinicalGroupingMap(): array
    {
        return [
            // Cardiovascular
            'Cardiovascular' => self::CARDIOVASCULAR,
            'Vascular' => self::CARDIOVASCULAR,
            'Cardiac Testing' => self::CARDIOVASCULAR,

            // Metabolic / Endocrine
            'Endocrine & Metabolic' => self::METABOLIC,
            'Nutritional' => self::METABOLIC,
            'Blood Chemistry' => self::METABOLIC,

            // Renal
            'Renal & Urinary' => self::RENAL,
            'Urinalysis' => self::RENAL,

            // Oncology
            'Neoplasm' => self::ONCOLOGY,
            'Imaging Findings' => self::ONCOLOGY,

            // Pain & Substance Use
            'Pain Syndromes' => self::PAIN_SUBSTANCE_USE,
            'Mental & Behavioral' => self::PAIN_SUBSTANCE_USE,

            // Pediatric (no direct clinical groupings — assigned by age criteria)
            'Pregnancy & Perinatal' => self::PEDIATRIC,
            'Congenital & Genetic' => self::PEDIATRIC,

            // General (everything else)
            'Respiratory' => self::GENERAL,
            'Neurological' => self::GENERAL,
            'Gastrointestinal' => self::GENERAL,
            'Hepatobiliary' => self::GENERAL,
            'Musculoskeletal' => self::GENERAL,
            'Reproductive & Breast' => self::GENERAL,
            'Dermatological' => self::GENERAL,
            'Hematologic' => self::GENERAL,
            'Infectious Disease' => self::GENERAL,
            'Eye & Vision' => self::GENERAL,
            'Ear & Hearing' => self::GENERAL,
            'Injury, Poisoning & Procedural' => self::GENERAL,
            'Immune System' => self::GENERAL,
            'General Signs & Symptoms' => self::GENERAL,
            'Body Region Findings' => self::GENERAL,
            'Functional Impairment' => self::GENERAL,
            'Investigations' => self::GENERAL,
            'Vital Signs' => self::GENERAL,
            'Hematology' => self::GENERAL,
            'Microbiology' => self::GENERAL,
            'Pulmonary Function' => self::GENERAL,
            'Social History' => self::GENERAL,
            'Family History' => self::GENERAL,
            'Personal History' => self::GENERAL,
            'Functional Status' => self::GENERAL,
            'Health Behaviors' => self::GENERAL,
            'Administrative' => self::GENERAL,
            'Surgical' => self::GENERAL,
            'Evaluation' => self::GENERAL,
            'Therapeutic' => self::GENERAL,
            'Rehabilitation' => self::GENERAL,
            'Preventive' => self::GENERAL,
        ];
    }
}
```

- [ ] **Step 2: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Enums/CohortDomain.php
git commit -m "feat: add CohortDomain enum with clinical grouping mapping"
```

---

## Task 6: Wire Enum into Model and Controller

**Files:**
- Modify: `backend/app/Models/App/CohortDefinition.php:16-28,33-41`
- Modify: `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php:161-170,286-293,375-382,812-841`

- [ ] **Step 1: Add enum cast to CohortDefinition model**

In `backend/app/Models/App/CohortDefinition.php`, add the import at top:

```php
use App\Enums\CohortDomain;
```

Update the `casts()` method to include domain:

```php
    protected function casts(): array
    {
        return [
            'expression_json' => 'array',
            'is_public' => 'boolean',
            'tags' => 'array',
            'share_expires_at' => 'datetime',
            'domain' => CohortDomain::class,
        ];
    }
```

- [ ] **Step 2: Add domain validation to store()**

In `CohortDefinitionController::store()`, update the validation rules (line 288-293):

```php
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'expression_json' => 'required|array',
            'is_public' => 'boolean',
            'domain' => ['nullable', 'string', Rule::in(array_column(CohortDomain::cases(), 'value'))],
        ]);
```

Add the `Rule` and `CohortDomain` imports at top of controller if not present:

```php
use App\Enums\CohortDomain;
use Illuminate\Validation\Rule;
```

- [ ] **Step 3: Add domain validation to update()**

In `CohortDefinitionController::update()`, update the validation rules (line 375-382):

```php
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'expression_json' => 'sometimes|required|array',
            'is_public' => 'boolean',
            'tags' => 'sometimes|array',
            'tags.*' => 'string|max:50',
            'domain' => ['sometimes', 'nullable', 'string', Rule::in(array_column(CohortDomain::cases(), 'value'))],
        ]);
```

- [ ] **Step 4: Refactor domains() to use enum**

Replace the `domains()` method body (lines 812-841):

```php
    public function domains(): JsonResponse
    {
        try {
            $counts = CohortDefinition::whereNotNull('domain')
                ->selectRaw('domain, count(*) as count')
                ->groupBy('domain')
                ->pluck('count', 'domain');

            $result = collect(CohortDomain::cases())->map(fn (CohortDomain $d) => [
                'key' => $d->value,
                'label' => $d->label(),
                'count' => (int) ($counts[$d->value] ?? 0),
            ])->sortByDesc('count')->values();

            return response()->json($result);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve domains', $e);
        }
    }
```

- [ ] **Step 5: Refactor the grouped view domainLabels in index()**

In the `index()` method, replace the hardcoded `$domainLabels` array (lines 161-170) with:

```php
                $domainLabels = collect(CohortDomain::cases())
                    ->mapWithKeys(fn (CohortDomain $d) => [$d->value => $d->label()])
                    ->all();
```

- [ ] **Step 6: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/Models/App/CohortDefinition.php backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php
git commit -m "feat: wire CohortDomain enum into model cast, validation, and controller"
```

---

## Task 7: Frontend — Add Domain to Types and Update Payload

**Files:**
- Modify: `frontend/src/features/cohort-definitions/types/cohortExpression.ts:333-339`

- [ ] **Step 1: Add domain to UpdateCohortDefinitionPayload**

In `frontend/src/features/cohort-definitions/types/cohortExpression.ts`, update the `UpdateCohortDefinitionPayload` interface (line 333):

```typescript
export interface UpdateCohortDefinitionPayload {
  name?: string;
  description?: string;
  expression_json?: CohortExpression;
  is_public?: boolean;
  tags?: string[];
  domain?: CohortDomain | null;
}
```

- [ ] **Step 2: Add deprecation fields to CohortDefinition interface**

In the `CohortDefinition` interface (line 219), add after `generation_sources`:

```typescript
  deprecated_at?: string | null;
  superseded_by?: number | null;
  superseded_by_cohort?: Pick<CohortDefinition, 'id' | 'name'> | null;
```

Note: This adds the deprecation fields now so we don't have to touch this interface again in Task 12.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/cohort-definitions/types/cohortExpression.ts
git commit -m "feat: add domain to update payload and deprecation fields to CohortDefinition type"
```

---

## Task 8: Frontend — Domain Dropdown in Detail Page

**Files:**
- Modify: `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`

- [ ] **Step 1: Add domain constants and handler**

Add the domain options array after the imports (before the component function):

```typescript
const DOMAIN_OPTIONS: Array<{ value: CohortDomain; label: string }> = [
  { value: "cardiovascular", label: "Cardiovascular" },
  { value: "metabolic", label: "Metabolic / Endocrine" },
  { value: "renal", label: "Renal" },
  { value: "oncology", label: "Oncology" },
  { value: "rare-disease", label: "Rare Disease" },
  { value: "pain-substance-use", label: "Pain & Substance Use" },
  { value: "pediatric", label: "Pediatric" },
  { value: "general", label: "General" },
];
```

Add the `CohortDomain` import from the types file (it already exists there).

- [ ] **Step 2: Add handleDomainChange handler**

Inside the component, after `handleRemoveTag` (line 180), add:

```typescript
  const handleDomainChange = (newDomain: string) => {
    if (!cohortId) return;
    updateMutation.mutate({
      id: cohortId,
      payload: { domain: (newDomain || null) as CohortDomain | null },
    });
  };
```

- [ ] **Step 3: Add domain dropdown to the metadata section**

In the JSX, after the tags section (after line 390, before the closing `</div>` of the left column), add:

```tsx
          {/* Domain */}
          <div className="flex items-center gap-2 mt-2">
            <select
              value={definition.domain ?? ""}
              onChange={(e) => handleDomainChange(e.target.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs border transition-colors",
                "bg-[#1A1A1F] border-[#2A2A30] text-[#C5C0B8]",
                "hover:border-[#3A3A42] focus:border-[#2DD4BF] focus:outline-none",
                !definition.domain && "text-[#5A5650]",
              )}
            >
              <option value="">Assign a domain</option>
              {DOMAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 5: Verify visually in browser**

Navigate to http://localhost:5175/cohort-definitions/{id} and confirm:
- Domain dropdown appears below tags
- Selecting a domain saves immediately (no page reload needed)
- When domain is null, placeholder text "Assign a domain" shows

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx
git commit -m "feat: add domain dropdown to cohort definition detail page"
```

---

## Task 9: Auto-Domain Detection Service

**Files:**
- Create: `backend/app/Services/Cohort/CohortDomainDetector.php`

- [ ] **Step 1: Create the detection service**

Create `backend/app/Services/Cohort/CohortDomainDetector.php`:

```php
<?php

namespace App\Services\Cohort;

use App\Enums\CohortDomain;
use App\Models\App\ClinicalGrouping;
use Illuminate\Support\Facades\DB;

class CohortDomainDetector
{
    /**
     * Minimum fraction of concepts that must map to a single domain to be assigned.
     * Below this threshold, falls back to GENERAL.
     */
    private const MAJORITY_THRESHOLD = 0.40;

    /**
     * Detect the clinical domain for a cohort based on its expression JSON.
     *
     * Algorithm:
     * 1. Extract concept IDs from expression (primary criteria + inclusion rules)
     * 2. For each concept, walk up concept_ancestor to find ClinicalGrouping anchors
     * 3. Map ClinicalGrouping names to CohortDomain via clinicalGroupingMap()
     * 4. Majority vote — domain with most concept matches wins (>= 40% threshold)
     *
     * @param  array<string, mixed>  $expressionJson
     */
    public function detect(array $expressionJson): CohortDomain
    {
        $conceptIds = $this->extractConceptIds($expressionJson);

        if (empty($conceptIds)) {
            return CohortDomain::GENERAL;
        }

        // Get all ClinicalGrouping anchor concept IDs with their grouping names
        $groupings = ClinicalGrouping::whereNull('parent_grouping_id')->get(['name', 'anchor_concept_ids']);
        $anchorToGrouping = [];
        foreach ($groupings as $grouping) {
            foreach ($grouping->anchor_concept_ids as $anchorId) {
                $anchorToGrouping[$anchorId] = $grouping->name;
            }
        }

        $allAnchorIds = array_keys($anchorToGrouping);
        if (empty($allAnchorIds)) {
            return CohortDomain::GENERAL;
        }

        // Query concept_ancestor: for each input concept, find which anchor concepts are ancestors
        $placeholders = implode(',', array_fill(0, count($conceptIds), '?'));
        $anchorPlaceholders = implode(',', array_fill(0, count($allAnchorIds), '?'));

        $rows = DB::connection('omop')->select(
            "SELECT DISTINCT ca.descendant_concept_id, ca.ancestor_concept_id
             FROM vocab.concept_ancestor ca
             WHERE ca.descendant_concept_id IN ({$placeholders})
               AND ca.ancestor_concept_id IN ({$anchorPlaceholders})",
            [...$conceptIds, ...$allAnchorIds]
        );

        // Count domain hits
        $domainCounts = [];
        $matchedConcepts = [];
        foreach ($rows as $row) {
            $groupingName = $anchorToGrouping[$row->ancestor_concept_id] ?? null;
            if ($groupingName === null) {
                continue;
            }

            $domain = CohortDomain::clinicalGroupingMap()[$groupingName] ?? CohortDomain::GENERAL;
            $key = $domain->value;

            // Count each concept only once per domain (a concept may match multiple anchors in same domain)
            $conceptDomainKey = $row->descendant_concept_id.':'.$key;
            if (! isset($matchedConcepts[$conceptDomainKey])) {
                $matchedConcepts[$conceptDomainKey] = true;
                $domainCounts[$key] = ($domainCounts[$key] ?? 0) + 1;
            }
        }

        if (empty($domainCounts)) {
            return CohortDomain::GENERAL;
        }

        // Majority vote
        arsort($domainCounts);
        $topDomain = array_key_first($domainCounts);
        $topCount = $domainCounts[$topDomain];
        $totalMatched = array_sum($domainCounts);

        if ($topCount / $totalMatched < self::MAJORITY_THRESHOLD) {
            return CohortDomain::GENERAL;
        }

        return CohortDomain::from($topDomain);
    }

    /**
     * Extract concept IDs from a CIRCE expression JSON.
     * Walks primary criteria concept sets and inclusion rule concept sets.
     *
     * @param  array<string, mixed>  $expression
     * @return list<int>
     */
    private function extractConceptIds(array $expression): array
    {
        $conceptIds = [];

        // Walk ConceptSets → items → concept → CONCEPT_ID
        $conceptSets = $expression['ConceptSets'] ?? [];
        foreach ($conceptSets as $cs) {
            $items = $cs['expression']['items'] ?? [];
            foreach ($items as $item) {
                $id = $item['concept']['CONCEPT_ID'] ?? null;
                if ($id !== null) {
                    $conceptIds[] = (int) $id;
                }
            }
        }

        return array_unique($conceptIds);
    }
}
```

- [ ] **Step 2: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/Cohort/CohortDomainDetector.php
git commit -m "feat: add CohortDomainDetector service for concept-based domain inference"
```

---

## Task 10: Observer — Auto-Domain Detection Hook

**Files:**
- Modify: `backend/app/Observers/CohortDefinitionObserver.php`

- [ ] **Step 1: Add auto-detection to observer**

Replace the full `CohortDefinitionObserver.php` with:

```php
<?php

namespace App\Observers;

use App\Jobs\Solr\SolrUpdateCohortJob;
use App\Models\App\CohortDefinition;
use App\Services\Cohort\CohortDomainDetector;

class CohortDefinitionObserver
{
    public function __construct(
        private readonly CohortDomainDetector $detector,
    ) {}

    public function created(CohortDefinition $cohort): void
    {
        $cohort->recomputeQualityTier();
        $this->autoDetectDomain($cohort);
        $this->dispatchSolr($cohort);
    }

    public function updated(CohortDefinition $cohort): void
    {
        if ($cohort->wasChanged(['expression_json', 'name', 'description', 'is_public', 'tags', 'domain'])) {
            $cohort->recomputeQualityTier();
        }

        // Re-detect domain if expression changed and domain wasn't explicitly set
        if ($cohort->wasChanged('expression_json') && ! $cohort->wasChanged('domain')) {
            $this->autoDetectDomain($cohort);
        }

        $this->dispatchSolr($cohort);
    }

    public function deleted(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, true)->delay(5);
        }
    }

    /**
     * Auto-detect domain from expression concepts when domain is null.
     */
    private function autoDetectDomain(CohortDefinition $cohort): void
    {
        if ($cohort->domain !== null) {
            return;
        }

        $expression = $cohort->expression_json;
        if (empty($expression)) {
            return;
        }

        try {
            $detected = $this->detector->detect($expression);
            $cohort->updateQuietly(['domain' => $detected->value]);
        } catch (\Throwable) {
            // Non-critical — don't break the save if detection fails
        }
    }

    private function dispatchSolr(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, false)->delay(5);
        }
    }
}
```

- [ ] **Step 2: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Observers/CohortDefinitionObserver.php
git commit -m "feat: add auto-domain detection to CohortDefinitionObserver"
```

---

## Task 11: Backfill Command + Domain NOT NULL Migration

**Files:**
- Create: `backend/app/Console/Commands/CohortBackfillDomains.php`
- Create: `backend/database/migrations/xxxx_make_cohort_domain_not_null.php`

- [ ] **Step 1: Create the backfill command**

Create `backend/app/Console/Commands/CohortBackfillDomains.php`:

```php
<?php

namespace App\Console\Commands;

use App\Models\App\CohortDefinition;
use App\Services\Cohort\CohortDomainDetector;
use Illuminate\Console\Command;

class CohortBackfillDomains extends Command
{
    protected $signature = 'cohort:backfill-domains {--dry-run : Show what would be changed without saving}';

    protected $description = 'Backfill NULL domains on cohort definitions using auto-detection';

    public function handle(CohortDomainDetector $detector): int
    {
        $isDryRun = $this->option('dry-run');

        $cohorts = CohortDefinition::whereNull('domain')
            ->whereNotNull('expression_json')
            ->get();

        if ($cohorts->isEmpty()) {
            $this->info('No cohorts with NULL domain found. Nothing to backfill.');

            return self::SUCCESS;
        }

        $this->info("Found {$cohorts->count()} cohorts with NULL domain.");

        $filled = 0;
        $skipped = 0;

        foreach ($cohorts as $cohort) {
            $expression = $cohort->expression_json;
            if (empty($expression)) {
                $this->line("  [{$cohort->id}] {$cohort->name} — skipped (empty expression)");
                $skipped++;

                continue;
            }

            $detected = $detector->detect($expression);

            if ($isDryRun) {
                $this->line("  [{$cohort->id}] {$cohort->name} → {$detected->value} (dry run)");
            } else {
                $cohort->updateQuietly(['domain' => $detected->value]);
                $this->line("  [{$cohort->id}] {$cohort->name} → {$detected->value}");
            }

            $filled++;
        }

        $remainingNulls = CohortDefinition::whereNull('domain')
            ->whereNull('deleted_at')
            ->count();

        $this->newLine();
        $this->info("Backfilled: {$filled} | Skipped: {$skipped} | Remaining NULLs: {$remainingNulls}");

        if ($remainingNulls === 0 && ! $isDryRun) {
            $this->info('All active cohorts have domains. Safe to run the NOT NULL migration.');
        }

        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Create the NOT NULL migration**

```bash
docker compose exec php php artisan make:migration make_cohort_domain_not_null --table=cohort_definitions
```

Edit the newly created migration:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $nullCount = DB::table('cohort_definitions')
            ->whereNull('domain')
            ->whereNull('deleted_at')
            ->count();

        if ($nullCount > 0) {
            throw new \RuntimeException(
                "Cannot make domain NOT NULL: {$nullCount} active cohorts still have NULL domain. "
                .'Run: php artisan cohort:backfill-domains'
            );
        }

        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->string('domain', 50)->nullable(false)->default('general')->change();
        });
    }

    public function down(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->string('domain', 50)->nullable()->default(null)->change();
        });
    }
};
```

- [ ] **Step 3: Run the backfill**

```bash
docker compose exec php php artisan cohort:backfill-domains --dry-run
# Review output, then run for real:
docker compose exec php php artisan cohort:backfill-domains
```

- [ ] **Step 4: Run the migration**

```bash
docker compose exec php php artisan migrate --path=database/migrations/xxxx_make_cohort_domain_not_null.php
```

- [ ] **Step 5: Tighten store validation**

In `CohortDefinitionController::store()`, change domain validation from `nullable` to `required`:

```php
            'domain' => ['required', 'string', Rule::in(array_column(CohortDomain::cases(), 'value'))],
```

Note: `required` at the API level, but the observer auto-detects if not provided. Since the frontend now has a domain dropdown and auto-detection runs on create, this is safe.

Actually — reconsider: the observer auto-fills domain *after* validation. If we make it `required`, the API will reject requests without domain. Keep it `nullable` so that creates without explicit domain still work (observer fills it). The NOT NULL constraint on the column is the real enforcement — it will catch any case where both the user and the observer fail to set a domain.

Revert: keep `nullable` in validation. The database constraint is the enforcement layer.

- [ ] **Step 6: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/Console/Commands/CohortBackfillDomains.php backend/database/migrations/*make_cohort_domain_not_null*
git commit -m "feat: add cohort:backfill-domains command and domain NOT NULL migration"
```

---

## Task 12: Deprecation Migration

**Files:**
- Create: `backend/database/migrations/xxxx_add_deprecation_to_cohort_definitions.php`

- [ ] **Step 1: Create the migration**

```bash
docker compose exec php php artisan make:migration add_deprecation_to_cohort_definitions --table=cohort_definitions
```

Edit the migration:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->timestamp('deprecated_at')->nullable()->after('quality_tier');
            $table->unsignedBigInteger('superseded_by')->nullable()->after('deprecated_at');

            $table->index('deprecated_at');
            $table->foreign('superseded_by')
                ->references('id')
                ->on('cohort_definitions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->dropForeign(['superseded_by']);
            $table->dropIndex(['deprecated_at']);
            $table->dropColumn(['deprecated_at', 'superseded_by']);
        });
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
docker compose exec php php artisan migrate --path=database/migrations/xxxx_add_deprecation_to_cohort_definitions.php
```

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/*add_deprecation_to_cohort_definitions*
git commit -m "feat: add deprecated_at and superseded_by columns to cohort_definitions"
```

---

## Task 13: Deprecation — Model Changes

**Files:**
- Modify: `backend/app/Models/App/CohortDefinition.php`

- [ ] **Step 1: Add deprecation fields to model**

In `CohortDefinition.php`:

Add to `$fillable` array (after `share_expires_at`):

```php
        'deprecated_at',
        'superseded_by',
```

Add to `casts()` method:

```php
            'deprecated_at' => 'datetime',
```

- [ ] **Step 2: Add relationships and scope**

After the `studyCohorts()` relationship, add:

```php
    /**
     * The cohort that replaces this one.
     *
     * @return BelongsTo<self, $this>
     */
    public function supersededByCohort(): BelongsTo
    {
        return $this->belongsTo(self::class, 'superseded_by');
    }

    /**
     * Cohorts that this one supersedes (replaces).
     *
     * @return HasMany<self, $this>
     */
    public function supersedes(): HasMany
    {
        return $this->hasMany(self::class, 'superseded_by');
    }

    /**
     * Scope to active (non-deprecated) cohorts.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<self>  $query
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeActive(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereNull('deprecated_at');
    }

    public function isDeprecated(): bool
    {
        return $this->deprecated_at !== null;
    }
```

- [ ] **Step 3: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Models/App/CohortDefinition.php
git commit -m "feat: add deprecation relationships, scope, and accessor to CohortDefinition"
```

---

## Task 14: Deprecation — Backend Endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- Modify: `backend/routes/api.php:558-566`

- [ ] **Step 1: Add deprecate endpoint to controller**

Add the following method to `CohortDefinitionController`:

```php
    public function deprecate(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        $validated = $request->validate([
            'superseded_by' => 'nullable|integer|exists:cohort_definitions,id',
        ]);

        if ($cohortDefinition->isDeprecated()) {
            return response()->json(['message' => 'Cohort is already deprecated.'], 422);
        }

        // Validate replacement is not itself deprecated
        if (! empty($validated['superseded_by'])) {
            $replacement = CohortDefinition::find($validated['superseded_by']);
            if ($replacement && $replacement->isDeprecated()) {
                return response()->json([
                    'message' => 'Cannot supersede with a deprecated cohort.',
                ], 422);
            }
        }

        $cohortDefinition->update([
            'deprecated_at' => now(),
            'superseded_by' => $validated['superseded_by'] ?? null,
        ]);

        return response()->json([
            'data' => $cohortDefinition->fresh(['author:id,name,email', 'supersededByCohort:id,name']),
            'message' => 'Cohort deprecated.',
        ]);
    }
```

- [ ] **Step 2: Add restore endpoint to controller**

```php
    public function restoreActive(CohortDefinition $cohortDefinition): JsonResponse
    {
        if (! $cohortDefinition->isDeprecated()) {
            return response()->json(['message' => 'Cohort is not deprecated.'], 422);
        }

        $cohortDefinition->update([
            'deprecated_at' => null,
            'superseded_by' => null,
        ]);

        return response()->json([
            'data' => $cohortDefinition->fresh('author:id,name,email'),
            'message' => 'Cohort restored to active.',
        ]);
    }
```

- [ ] **Step 3: Add routes**

In `backend/routes/api.php`, after the `diagnostics` route (line 566), add:

```php
        Route::post('/cohort-definitions/{cohortDefinition}/deprecate', [CohortDefinitionController::class, 'deprecate']);
        Route::post('/cohort-definitions/{cohortDefinition}/restore-active', [CohortDefinitionController::class, 'restoreActive']);
```

- [ ] **Step 4: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php backend/routes/api.php
git commit -m "feat: add deprecate and restore-active endpoints for cohort definitions"
```

---

## Task 15: Deprecation — Study Association Guard

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/StudyCohortController.php:42-68`

- [ ] **Step 1: Add deprecation check to store()**

In `StudyCohortController::store()`, after the validation block and inside the try block (before `StudyCohort::create`), add:

```php
            $cohort = CohortDefinition::findOrFail($validated['cohort_definition_id']);
            if ($cohort->isDeprecated()) {
                $message = 'Cannot add a deprecated cohort to a study.';
                if ($cohort->supersededByCohort) {
                    $message .= " Use \"{$cohort->supersededByCohort->name}\" (ID: {$cohort->superseded_by}) instead.";
                }

                return response()->json(['message' => $message], 422);
            }
```

Add the import at the top:

```php
use App\Models\App\CohortDefinition;
```

- [ ] **Step 2: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/StudyCohortController.php
git commit -m "feat: block adding deprecated cohorts to studies"
```

---

## Task 16: Deprecation — Frontend API and Hooks

**Files:**
- Modify: `frontend/src/features/cohort-definitions/api/cohortApi.ts`
- Modify: `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts`

- [ ] **Step 1: Add API functions**

In `frontend/src/features/cohort-definitions/api/cohortApi.ts`, add:

```typescript
export async function deprecateCohort(
  id: number,
  supersededBy?: number,
): Promise<CohortDefinition> {
  const { data } = await api.post(`/cohort-definitions/${id}/deprecate`, {
    superseded_by: supersededBy ?? null,
  });
  return data.data;
}

export async function restoreActiveCohort(
  id: number,
): Promise<CohortDefinition> {
  const { data } = await api.post(
    `/cohort-definitions/${id}/restore-active`,
  );
  return data.data;
}
```

Make sure `CohortDefinition` is imported from the types file.

- [ ] **Step 2: Add mutation hooks**

In `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts`, add the imports:

```typescript
import {
  // ... existing imports ...
  deprecateCohort,
  restoreActiveCohort,
} from "../api/cohortApi";
```

Then add the hooks:

```typescript
export function useDeprecateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, supersededBy }: { id: number; supersededBy?: number }) =>
      deprecateCohort(id, supersededBy),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cohort-definitions", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["cohort-definitions"] });
    },
  });
}

export function useRestoreActiveCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => restoreActiveCohort(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cohort-definitions", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["cohort-definitions"] });
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/cohort-definitions/api/cohortApi.ts frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts
git commit -m "feat: add deprecate/restore API functions and mutation hooks"
```

---

## Task 17: Deprecation — Detail Page UI

**Files:**
- Modify: `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`

- [ ] **Step 1: Add imports and hooks**

Add to the icon imports:

```typescript
import { AlertTriangle, RotateCcw } from "lucide-react";
```

Add the hook imports:

```typescript
import {
  // ... existing imports ...
  useDeprecateCohort,
  useRestoreActiveCohort,
} from "../hooks/useCohortDefinitions";
```

Inside the component, add after the existing mutation hooks:

```typescript
  const deprecateMutation = useDeprecateCohort();
  const restoreMutation = useRestoreActiveCohort();
```

- [ ] **Step 2: Add deprecate/restore handlers**

After `handleDomainChange`, add:

```typescript
  const handleDeprecate = () => {
    if (!cohortId) return;
    if (
      window.confirm(
        "Deprecate this cohort? It will remain visible but cannot be added to new studies.",
      )
    ) {
      deprecateMutation.mutate({ id: cohortId });
    }
  };

  const handleRestoreActive = () => {
    if (!cohortId) return;
    restoreMutation.mutate(cohortId);
  };
```

- [ ] **Step 3: Add deprecation banner**

In the JSX, right after the opening `<div className="space-y-6">` (line 222), add:

```tsx
      {/* Deprecation banner */}
      {definition.deprecated_at && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-400">
              Deprecated on{" "}
              {new Date(definition.deprecated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {definition.superseded_by_cohort && (
              <p className="text-xs text-amber-400/70 mt-0.5">
                Superseded by{" "}
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/cohort-definitions/${definition.superseded_by_cohort!.id}`,
                    )
                  }
                  className="underline hover:text-amber-300 transition-colors"
                >
                  {definition.superseded_by_cohort.name}
                </button>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRestoreActive}
            disabled={restoreMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            {restoreMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCcw size={12} />
            )}
            Restore
          </button>
        </div>
      )}
```

- [ ] **Step 4: Add deprecate button to action bar**

In the action buttons section, before the Delete button (around line 484), add:

```tsx
          {/* Deprecate */}
          {!definition.deprecated_at && (
            <button
              type="button"
              onClick={handleDeprecate}
              disabled={deprecateMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-amber-400 hover:border-amber-500/30 transition-colors disabled:opacity-50"
            >
              {deprecateMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <AlertTriangle size={14} />
              )}
              Deprecate
            </button>
          )}
```

- [ ] **Step 5: Eagerly load supersededByCohort in the API response**

In `CohortDefinitionController::show()`, make sure the response includes the `supersededByCohort` relationship. Find the `show()` method and ensure it loads:

```php
$cohortDefinition->load(['author:id,name,email', 'supersededByCohort:id,name']);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 7: Verify visually**

Navigate to http://localhost:5175/cohort-definitions/{id} and confirm:
- Deprecate button appears in the action bar
- After deprecating: amber banner appears with restore button
- Clicking Restore clears the deprecation

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php
git commit -m "feat: add deprecation banner and deprecate/restore actions to detail page"
```

---

## Task 18: Deprecation — List View Styling

**Files:**
- Modify: `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx`

- [ ] **Step 1: Add AlertTriangle import**

```typescript
import { AlertTriangle } from "lucide-react";
```

- [ ] **Step 2: Add DeprecatedBadge component**

After the `TierBadge` component (line 125), add:

```typescript
function DeprecatedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-500">
      <AlertTriangle size={10} />
      Deprecated
    </span>
  );
}
```

- [ ] **Step 3: Add deprecated styling to flat list rows**

In the flat view table body (line 475 area), wrap the row's `className` to add opacity for deprecated cohorts:

Change the `<tr>` className from:

```tsx
                className={cn(
                  "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                  i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                )}
```

To:

```tsx
                className={cn(
                  "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                  i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                  def.deprecated_at && "opacity-60",
                )}
```

In the name cell, add strikethrough and deprecated badge:

```tsx
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {def.is_public ? (
                      <Globe size={12} className="text-[#60A5FA] shrink-0" />
                    ) : (
                      <Lock size={12} className="text-[#5A5650] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className={cn(
                        "text-sm font-medium text-[#F0EDE8] truncate",
                        def.deprecated_at && "line-through",
                      )}>
                        {def.name}
                      </p>
                      {def.description && (
                        <p className="text-[10px] text-[#5A5650] truncate max-w-[250px]">
                          {def.description}
                        </p>
                      )}
                    </div>
                    {def.deprecated_at && <DeprecatedBadge />}
                  </div>
                </td>
```

- [ ] **Step 4: Apply same styling to grouped view rows**

In the grouped view table body (line 294 area), apply the same pattern:

Add `def.deprecated_at && "opacity-60"` to the `<tr>` className.

Add `def.deprecated_at && "line-through"` to the name `<p>` and `{def.deprecated_at && <DeprecatedBadge />}` after the name.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 6: Verify visually**

Check both flat and grouped views — deprecated cohorts should show muted, with strikethrough names and amber badge.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx
git commit -m "feat: add deprecated styling and badges to cohort definition list views"
```

---

## Task 19: Final Verification

- [ ] **Step 1: Run full Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 2: Run TypeScript check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 3: Run Vite build**

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 4: Run PHPStan**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse"
```

- [ ] **Step 5: Verify API endpoints**

```bash
# Test domains endpoint returns enum-based labels
curl -s http://localhost:8082/api/v1/cohort-definitions/domains -H 'Authorization: Bearer TOKEN' | python3 -m json.tool

# Test deprecate
curl -s -X POST http://localhost:8082/api/v1/cohort-definitions/{id}/deprecate -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' -d '{}' | python3 -m json.tool

# Test restore
curl -s -X POST http://localhost:8082/api/v1/cohort-definitions/{id}/restore-active -H 'Authorization: Bearer TOKEN' | python3 -m json.tool
```

- [ ] **Step 6: Visual smoke test**

Navigate to http://localhost:5175/cohort-definitions and verify:
1. Grouped view shows domain labels from enum
2. Flat view shows tier badges
3. Domain dropdown works on detail page
4. Deprecate/restore flow works end-to-end
5. Deprecated cohorts show muted with strikethrough in list

- [ ] **Step 7: Deploy frontend build**

```bash
./deploy.sh --frontend
```
