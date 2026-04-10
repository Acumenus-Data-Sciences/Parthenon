# Cohort Cleanup & Categorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 9 duplicate/orphan cohorts, add domain + quality_tier columns, and build a grouped table view with tier badges on the Cohort Definitions page.

**Architecture:** Three Laravel migrations (schema, data seeding, consolidation), model observer for tier recomputation, new `domains` API endpoint, modified `index` endpoint with `group_by`/`domain`/`quality_tier` filters, and a refactored frontend list with collapsible grouped rows and tier filter pills.

**Tech Stack:** Laravel 11 (PHP 8.4), React 19 + TypeScript + TanStack Query, PostgreSQL 16, Tailwind 4

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `backend/database/migrations/2026_04_10_200001_add_domain_and_quality_tier_to_cohort_definitions.php` | Schema: add columns + indexes |
| Create | `backend/database/migrations/2026_04_10_200002_assign_cohort_domains_and_tiers.php` | Data: assign domain/tier to all 80 cohorts |
| Create | `backend/database/migrations/2026_04_10_200003_consolidate_duplicate_cohorts.php` | Data: rename, re-point, soft-delete |
| Modify | `backend/app/Models/App/CohortDefinition.php` | Add fillable, casts, relationships, `recomputeQualityTier()` |
| Modify | `backend/app/Observers/CohortDefinitionObserver.php` | Call tier recomputation on create/update |
| Modify | `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php` | Add `domains()`, modify `index()`, update `stats()` |
| Modify | `backend/routes/api.php` | Add `/cohort-definitions/domains` route |
| Modify | `frontend/src/features/cohort-definitions/types/cohortExpression.ts` | Add domain/tier to types |
| Modify | `frontend/src/features/cohort-definitions/api/cohortApi.ts` | Add `getCohortDomains()`, `getGroupedCohortDefinitions()` |
| Modify | `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts` | Add `useCohortDomains()`, `useGroupedCohortDefinitions()` |
| Modify | `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx` | Add toggle, tier pills, grouped view |
| Modify | `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx` | Add tier badge column, group headers, collapsible sections |

---

### Task 1: Migration — Add domain and quality_tier columns

**Files:**
- Create: `backend/database/migrations/2026_04_10_200001_add_domain_and_quality_tier_to_cohort_definitions.php`

- [ ] **Step 1: Create the migration**

```bash
cd /home/smudoshi/Github/Parthenon/backend && php artisan make:migration add_domain_and_quality_tier_to_cohort_definitions --table=cohort_definitions
```

Then replace its contents with:

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
            $table->string('domain', 50)->nullable()->after('share_expires_at');
            $table->string('quality_tier', 20)->nullable()->after('domain');
            $table->index('domain');
            $table->index('quality_tier');
        });
    }

    public function down(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->dropIndex(['domain']);
            $table->dropIndex(['quality_tier']);
            $table->dropColumn(['domain', 'quality_tier']);
        });
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
cd /home/smudoshi/Github/Parthenon && docker compose exec php php artisan migrate --path=database/migrations/2026_04_10_200001_add_domain_and_quality_tier_to_cohort_definitions.php
```

- [ ] **Step 3: Verify columns exist**

```bash
PGPASSFILE=~/.pgpass psql -h localhost -U claude_dev -d parthenon -c "\d app.cohort_definitions" | grep -E "domain|quality_tier"
```

Expected: two new nullable varchar columns with indexes.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_04_10_200001_add_domain_and_quality_tier_to_cohort_definitions.php
git commit -m "feat: add domain and quality_tier columns to cohort_definitions"
```

---

### Task 2: Migration — Assign domains and tiers to existing cohorts

**Files:**
- Create: `backend/database/migrations/2026_04_10_200002_assign_cohort_domains_and_tiers.php`

- [ ] **Step 1: Create the data migration**

```bash
cd /home/smudoshi/Github/Parthenon/backend && php artisan make:migration assign_cohort_domains_and_tiers
```

Replace contents with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $domainMap = [
            'cardiovascular' => [66, 67, 68, 79, 80, 81, 82, 83, 173, 175, 176, 195, 196],
            'metabolic'      => [70, 71, 72, 155, 156, 159, 184, 185, 186, 189, 190, 197],
            'renal'          => [69, 73, 74, 75, 76, 77, 157, 160, 161, 162, 167, 169],
            'rare-disease'   => [198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219],
            'oncology'       => [221, 222, 223, 224, 225],
            'pain-substance-use' => [177, 178, 179, 180, 181, 182, 183],
            'pediatric'      => [228],
            'general'        => [154, 163, 165, 166, 168, 170, 174],
        ];

        foreach ($domainMap as $domain => $ids) {
            DB::table('cohort_definitions')
                ->whereIn('id', $ids)
                ->whereNull('deleted_at')
                ->update(['domain' => $domain]);
        }

        // Compute quality_tier for all active cohorts
        $cohorts = DB::table('cohort_definitions')
            ->whereNull('deleted_at')
            ->select('id', 'expression_json')
            ->get();

        foreach ($cohorts as $cohort) {
            $expression = json_decode($cohort->expression_json, true) ?? [];

            $completedGens = DB::table('cohort_generations')
                ->where('cohort_definition_id', $cohort->id)
                ->where('status', 'completed')
                ->count();

            $studyUses = DB::table('study_cohorts')
                ->where('cohort_definition_id', $cohort->id)
                ->count();

            $conceptSetCount = count($expression['ConceptSets'] ?? []);
            $inclusionRules = count($expression['AdditionalCriteria']['CriteriaList'] ?? []);
            $hasEndStrategy = isset($expression['EndStrategy']) && $expression['EndStrategy'] !== null;

            $hasComplexity = $conceptSetCount >= 2 || $inclusionRules > 0 || $hasEndStrategy;

            if ($completedGens > 0 && $studyUses > 0 && $hasComplexity) {
                $tier = 'study-ready';
            } elseif ($completedGens > 0) {
                $tier = 'validated';
            } else {
                $tier = 'draft';
            }

            DB::table('cohort_definitions')
                ->where('id', $cohort->id)
                ->update(['quality_tier' => $tier]);
        }
    }

    public function down(): void
    {
        DB::table('cohort_definitions')
            ->whereNull('deleted_at')
            ->update(['domain' => null, 'quality_tier' => null]);
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
cd /home/smudoshi/Github/Parthenon && docker compose exec php php artisan migrate --path=database/migrations/2026_04_10_200002_assign_cohort_domains_and_tiers.php
```

- [ ] **Step 3: Verify assignments**

```bash
PGPASSFILE=~/.pgpass psql -h localhost -U claude_dev -d parthenon -c "SELECT domain, quality_tier, COUNT(*) FROM app.cohort_definitions WHERE deleted_at IS NULL GROUP BY domain, quality_tier ORDER BY domain, quality_tier;"
```

Expected: all 89 active cohorts have a domain assigned and a quality_tier computed.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_04_10_200002_assign_cohort_domains_and_tiers.php
git commit -m "feat: assign clinical domains and quality tiers to existing cohorts"
```

---

### Task 3: Migration — Consolidate duplicates

**Files:**
- Create: `backend/database/migrations/2026_04_10_200003_consolidate_duplicate_cohorts.php`

- [ ] **Step 1: Create the consolidation migration**

```bash
cd /home/smudoshi/Github/Parthenon/backend && php artisan make:migration consolidate_duplicate_cohorts
```

Replace contents with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $now = now();

            // 1. Rename canonical cohorts — strip study prefixes
            $renames = [
                75  => 'CKD Advanced Progression — Stages 4-5 or Dialysis',
                173 => 'Composite MACE — First Occurrence (With CHF)',
                155 => 'Metabolic Syndrome — First Occurrence',
                81  => 'Composite MACE — MI or Stroke First Occurrence',
                174 => 'All-Cause Death',
            ];

            foreach ($renames as $id => $newName) {
                DB::table('cohort_definitions')
                    ->where('id', $id)
                    ->update(['name' => $newName, 'updated_at' => $now]);
                Log::info("[cohort-consolidation] Renamed #{$id} to: {$newName}");
            }

            // 2. Re-point study_cohorts from duplicate → canonical
            $repoints = [
                // [duplicate_id, canonical_id]
                [158, 72],   // S10 T2DM → canonical T2DM
                [78, 75],    // Study 3 CKD Progression → canonical
                [187, 173],  // S9 MACE (With CHF) → canonical
                [164, 155],  // S6 MetSyn → canonical
                [84, 81],    // S5 MACE MI/Stroke → canonical
                [181, 174],  // S8 All-Cause Death → canonical
                [188, 174],  // S9 All-Cause Death → canonical
            ];

            foreach ($repoints as [$duplicateId, $canonicalId]) {
                $affected = DB::table('study_cohorts')
                    ->where('cohort_definition_id', $duplicateId)
                    ->update(['cohort_definition_id' => $canonicalId]);
                Log::info("[cohort-consolidation] Re-pointed study_cohorts: #{$duplicateId} → #{$canonicalId} ({$affected} rows)");
            }

            // 3. Add "shared" tag to canonical cohorts used by multiple studies
            $sharedIds = [72, 75, 173, 155, 81, 174];
            foreach ($sharedIds as $id) {
                $cohort = DB::table('cohort_definitions')->where('id', $id)->first(['tags']);
                $tags = json_decode($cohort->tags ?? '[]', true);
                if (! in_array('shared', $tags, true)) {
                    $tags[] = 'shared';
                    DB::table('cohort_definitions')
                        ->where('id', $id)
                        ->update(['tags' => json_encode($tags)]);
                }
            }

            // 4. Soft-delete orphans and duplicates
            $deleteIds = [139, 229, 158, 78, 187, 164, 84, 181, 188];
            DB::table('cohort_definitions')
                ->whereIn('id', $deleteIds)
                ->update(['deleted_at' => $now]);
            Log::info('[cohort-consolidation] Soft-deleted ' . count($deleteIds) . ' cohorts: ' . implode(', ', $deleteIds));
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            // Restore soft-deleted cohorts
            $deleteIds = [139, 229, 158, 78, 187, 164, 84, 181, 188];
            DB::table('cohort_definitions')
                ->whereIn('id', $deleteIds)
                ->update(['deleted_at' => null]);

            // Reverse re-points
            $repoints = [
                [158, 72], [78, 75], [187, 173], [164, 155],
                [84, 81], [181, 174], [188, 174],
            ];
            foreach ($repoints as [$duplicateId, $canonicalId]) {
                DB::table('study_cohorts')
                    ->where('cohort_definition_id', $canonicalId)
                    // Only reverse rows that originally pointed to the duplicate
                    // This is imprecise — production rollback should verify manually
                    ->limit(0) // NOOP: manual rollback required for study_cohorts
                    ->update(['cohort_definition_id' => $duplicateId]);
            }

            // Reverse renames
            $originalNames = [
                75  => 'CKD Advanced Progression — Stages 4-5 or Dialysis First Occurrence',
                173 => 'S7: Composite MACE — First Occurrence (With CHF)',
                155 => 'S10: Metabolic Syndrome — First Occurrence',
                81  => 'Major Adverse Cardiovascular Events — MI or Stroke First Occurrence (Study 4)',
                174 => 'S7: All-Cause Death',
            ];
            foreach ($originalNames as $id => $name) {
                DB::table('cohort_definitions')
                    ->where('id', $id)
                    ->update(['name' => $name]);
            }
        });
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
cd /home/smudoshi/Github/Parthenon && docker compose exec php php artisan migrate --path=database/migrations/2026_04_10_200003_consolidate_duplicate_cohorts.php
```

- [ ] **Step 3: Verify consolidation**

```bash
PGPASSFILE=~/.pgpass psql -h localhost -U claude_dev -d parthenon -c "SELECT COUNT(*) as active FROM app.cohort_definitions WHERE deleted_at IS NULL;"
```

Expected: `80`

```bash
PGPASSFILE=~/.pgpass psql -h localhost -U claude_dev -d parthenon -c "SELECT id, name FROM app.cohort_definitions WHERE id IN (75, 173, 155, 81, 174) ORDER BY id;"
```

Expected: renamed canonical names without study prefixes.

```bash
PGPASSFILE=~/.pgpass psql -h localhost -U claude_dev -d parthenon -c "SELECT cohort_definition_id, COUNT(*) FROM app.study_cohorts WHERE cohort_definition_id IN (72, 75, 173, 155, 81, 174) GROUP BY cohort_definition_id ORDER BY cohort_definition_id;"
```

Expected: canonical IDs now have study associations from their former duplicates.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_04_10_200003_consolidate_duplicate_cohorts.php
git commit -m "feat: consolidate duplicate cohorts — rename canonicals, re-point studies, soft-delete 9"
```

---

### Task 4: Update CohortDefinition model

**Files:**
- Modify: `backend/app/Models/App/CohortDefinition.php`

- [ ] **Step 1: Add domain and quality_tier to fillable and casts**

In `backend/app/Models/App/CohortDefinition.php`, add `'domain'` and `'quality_tier'` to the `$fillable` array (after `'share_expires_at'`):

```php
    protected $fillable = [
        'name',
        'description',
        'expression_json',
        'author_id',
        'is_public',
        'version',
        'tags',
        'share_token',
        'share_expires_at',
        'domain',
        'quality_tier',
    ];
```

- [ ] **Step 2: Add studyCohorts relationship and recomputeQualityTier method**

Add after the `generations()` method:

```php
    /**
     * @return HasMany<\App\Models\App\StudyCohort, $this>
     */
    public function studyCohorts(): HasMany
    {
        return $this->hasMany(\App\Models\App\StudyCohort::class);
    }

    /**
     * Recompute quality_tier from generation history, study usage, and expression complexity.
     */
    public function recomputeQualityTier(): void
    {
        $completedGens = $this->generations()->where('status', 'completed')->count();
        $studyUses = $this->studyCohorts()->count();

        $expression = $this->expression_json ?? [];
        $conceptSetCount = count($expression['ConceptSets'] ?? []);
        $inclusionRules = count($expression['AdditionalCriteria']['CriteriaList'] ?? []);
        $hasEndStrategy = isset($expression['EndStrategy']) && $expression['EndStrategy'] !== null;
        $hasComplexity = $conceptSetCount >= 2 || $inclusionRules > 0 || $hasEndStrategy;

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

Add the import at the top of the file if not already present:

```php
use App\Models\App\StudyCohort;
```

- [ ] **Step 3: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Models/App/CohortDefinition.php"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Models/App/CohortDefinition.php
git commit -m "feat: add domain, quality_tier, studyCohorts(), and recomputeQualityTier() to CohortDefinition"
```

---

### Task 5: Update observer for tier recomputation

**Files:**
- Modify: `backend/app/Observers/CohortDefinitionObserver.php`

- [ ] **Step 1: Add tier recomputation to the observer**

Replace the contents of `backend/app/Observers/CohortDefinitionObserver.php`:

```php
<?php

namespace App\Observers;

use App\Jobs\Solr\SolrUpdateCohortJob;
use App\Models\App\CohortDefinition;

class CohortDefinitionObserver
{
    public function created(CohortDefinition $cohort): void
    {
        $cohort->recomputeQualityTier();
        $this->dispatchSolr($cohort);
    }

    public function updated(CohortDefinition $cohort): void
    {
        // Only recompute tier if expression or key fields changed (not if tier itself changed)
        if ($cohort->wasChanged(['expression_json', 'name', 'description', 'is_public', 'tags', 'domain'])) {
            $cohort->recomputeQualityTier();
        }
        $this->dispatchSolr($cohort);
    }

    public function deleted(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, true)->delay(5);
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
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Observers/CohortDefinitionObserver.php"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Observers/CohortDefinitionObserver.php
git commit -m "feat: recompute quality tier on cohort definition create/update"
```

---

### Task 6: Backend API — Add domains endpoint and modify index/stats

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add the `domains()` method to the controller**

Add after the `stats()` method (after line 715) in `CohortDefinitionController.php`:

```php
    /**
     * GET /v1/cohort-definitions/domains
     *
     * Return domain vocabulary with counts.
     */
    public function domains(): JsonResponse
    {
        try {
            $labels = [
                'cardiovascular'     => 'Cardiovascular',
                'metabolic'          => 'Metabolic',
                'renal'              => 'Renal',
                'oncology'           => 'Oncology',
                'rare-disease'       => 'Rare Disease',
                'pain-substance-use' => 'Pain & Substance Use',
                'pediatric'          => 'Pediatric',
                'general'            => 'General',
            ];

            $counts = CohortDefinition::whereNotNull('domain')
                ->selectRaw('domain, count(*) as count')
                ->groupBy('domain')
                ->orderByDesc('count')
                ->pluck('count', 'domain');

            $result = [];
            foreach ($labels as $key => $label) {
                $result[] = [
                    'key'   => $key,
                    'label' => $label,
                    'count' => $counts[$key] ?? 0,
                ];
            }

            return response()->json($result);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve domains', $e);
        }
    }
```

- [ ] **Step 2: Add domain, quality_tier, and group_by filters to the `index()` method**

In the `index()` method, add these lines after the `$filterAuthorId` line (after line 51):

```php
            $filterDomain = $request->input('domain');
            $filterTier = $request->input('quality_tier');
            $groupBy = $request->input('group_by'); // 'domain' or 'source'
```

In the PostgreSQL fallback section, add filters after the `$filterAuthorId` block (after line 147):

```php
            if ($filterDomain) {
                $query->where('domain', $filterDomain);
            }

            if ($filterTier) {
                $query->where('quality_tier', $filterTier);
            }
```

Then, after the `$result['engine'] = 'postgresql';` line (line 188), add the grouped response logic:

```php
            // Grouped response
            if ($groupBy === 'domain') {
                $groupedQuery = CohortDefinition::withCount('generations')
                    ->with(['author:id,name,email'])
                    ->whereNotNull('domain')
                    ->orderBy('domain')
                    ->orderByDesc('updated_at');

                if ($filterTier) {
                    $groupedQuery->where('quality_tier', $filterTier);
                }
                if ($filterDomain) {
                    $groupedQuery->where('domain', $filterDomain);
                }
                if ($search) {
                    $groupedQuery->where(function ($q) use ($search) {
                        $q->where('name', 'ilike', "%{$search}%")
                            ->orWhere('description', 'ilike', "%{$search}%");
                    });
                }
                foreach ($tags as $tag) {
                    $groupedQuery->whereRaw('tags @> ?::jsonb', [json_encode([$tag])]);
                }
                if ($filterAuthorId) {
                    $groupedQuery->where('author_id', $filterAuthorId);
                }

                $allCohorts = $groupedQuery->get();

                // Append latest_generation and generation_sources to each cohort
                $allCohorts->transform(function (CohortDefinition $def) {
                    $latestGeneration = $def->generations()
                        ->where('status', 'completed')
                        ->orderByDesc('completed_at')
                        ->first(['id', 'status', 'person_count', 'completed_at', 'source_id']);
                    if (! $latestGeneration) {
                        $latestGeneration = $def->generations()
                            ->orderByDesc('created_at')
                            ->first(['id', 'status', 'person_count', 'completed_at', 'source_id']);
                    }
                    $def->setAttribute('latest_generation', $latestGeneration);

                    $generationSources = $def->generations()
                        ->where('status', 'completed')
                        ->with('source:id,source_name,source_key')
                        ->orderByDesc('completed_at')
                        ->get(['id', 'source_id', 'person_count', 'completed_at'])
                        ->unique('source_id')
                        ->map(fn (CohortGeneration $gen) => [
                            'source_id'    => $gen->source_id,
                            'source_name'  => $gen->source?->source_name,
                            'source_key'   => $gen->source?->source_key,
                            'person_count' => $gen->person_count,
                            'completed_at' => $gen->completed_at,
                        ])
                        ->values();
                    $def->setAttribute('generation_sources', $generationSources);

                    return $def;
                });

                $domainLabels = [
                    'cardiovascular'     => 'Cardiovascular',
                    'metabolic'          => 'Metabolic',
                    'renal'              => 'Renal',
                    'oncology'           => 'Oncology',
                    'rare-disease'       => 'Rare Disease',
                    'pain-substance-use' => 'Pain & Substance Use',
                    'pediatric'          => 'Pediatric',
                    'general'            => 'General',
                ];

                $groups = $allCohorts->groupBy('domain')
                    ->map(fn ($cohorts, $domain) => [
                        'key'     => $domain,
                        'label'   => $domainLabels[$domain] ?? ucfirst($domain),
                        'count'   => $cohorts->count(),
                        'cohorts' => $cohorts->values(),
                    ])
                    ->sortByDesc('count')
                    ->values();

                $tierCounts = [
                    'study-ready' => CohortDefinition::where('quality_tier', 'study-ready')->count(),
                    'validated'   => CohortDefinition::where('quality_tier', 'validated')->count(),
                    'draft'       => CohortDefinition::where('quality_tier', 'draft')->count(),
                ];

                return response()->json([
                    'data' => [
                        'groups'      => $groups,
                        'tier_counts' => $tierCounts,
                    ],
                    'engine' => 'postgresql',
                ]);
            }
```

- [ ] **Step 3: Update stats() to include tier counts**

Replace the `stats()` method body (lines 704-715):

```php
    public function stats(): JsonResponse
    {
        try {
            return response()->json([
                'total' => CohortDefinition::count(),
                'with_generations' => CohortDefinition::whereHas('generations', fn ($q) => $q->where('status', 'completed'))->count(),
                'public' => CohortDefinition::where('is_public', true)->count(),
                'tier_counts' => [
                    'study-ready' => CohortDefinition::where('quality_tier', 'study-ready')->count(),
                    'validated'   => CohortDefinition::where('quality_tier', 'validated')->count(),
                    'draft'       => CohortDefinition::where('quality_tier', 'draft')->count(),
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve stats', $e);
        }
    }
```

- [ ] **Step 4: Add the domains route**

In `backend/routes/api.php`, add after line 553 (the stats route):

```php
        Route::get('/cohort-definitions/domains', [CohortDefinitionController::class, 'domains']);
```

- [ ] **Step 5: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/CohortDefinitionController.php routes/api.php"
```

- [ ] **Step 6: Verify endpoints**

```bash
curl -s http://localhost:8082/api/v1/cohort-definitions/domains -H "Authorization: Bearer $(curl -s http://localhost:8082/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"admin@acumenus.net","password":"superuser"}' | jq -r '.token')" | jq '.[0:3]'
```

Expected: array of `{key, label, count}` objects.

```bash
TOKEN=$(curl -s http://localhost:8082/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"admin@acumenus.net","password":"superuser"}' | jq -r '.token')
curl -s "http://localhost:8082/api/v1/cohort-definitions?group_by=domain" -H "Authorization: Bearer $TOKEN" | jq '.data.groups | length'
```

Expected: `8` (number of domains).

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php backend/routes/api.php
git commit -m "feat: add /domains endpoint, group_by/domain/quality_tier filters to cohort index"
```

---

### Task 7: Frontend types — Add domain and quality_tier

**Files:**
- Modify: `frontend/src/features/cohort-definitions/types/cohortExpression.ts`

- [ ] **Step 1: Add domain and quality_tier to CohortDefinition interface**

In `frontend/src/features/cohort-definitions/types/cohortExpression.ts`, update the `CohortDefinition` interface (lines 219-234) to add the two new fields after `tags`:

```typescript
export interface CohortDefinition {
  id: number;
  name: string;
  description: string | null;
  expression_json: CohortExpression;
  author_id: number;
  is_public: boolean;
  version: number;
  tags?: string[];
  domain?: string | null;
  quality_tier?: "study-ready" | "validated" | "draft" | null;
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  generations?: CohortGeneration[];
  latest_generation?: CohortGeneration | null;
  generation_sources?: GenerationSource[];
}
```

- [ ] **Step 2: Add new types for grouped response and domains**

Add after the `CohortDefinitionListParams` interface (after line 274):

```typescript
export type CohortDomain =
  | "cardiovascular"
  | "metabolic"
  | "renal"
  | "oncology"
  | "rare-disease"
  | "pain-substance-use"
  | "pediatric"
  | "general";

export type QualityTier = "study-ready" | "validated" | "draft";

export interface DomainInfo {
  key: CohortDomain;
  label: string;
  count: number;
}

export interface CohortGroup {
  key: string;
  label: string;
  count: number;
  cohorts: CohortDefinition[];
}

export interface GroupedCohortResponse {
  data: {
    groups: CohortGroup[];
    tier_counts: Record<QualityTier, number>;
  };
  engine?: string;
}

export interface CohortDefinitionGroupedParams {
  group_by: "domain" | "source";
  domain?: CohortDomain;
  quality_tier?: QualityTier;
  search?: string;
  tags?: string[];
  author_id?: number;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/cohort-definitions/types/cohortExpression.ts
git commit -m "feat: add domain, quality_tier, and grouped response types"
```

---

### Task 8: Frontend API — Add getCohortDomains and getGroupedCohortDefinitions

**Files:**
- Modify: `frontend/src/features/cohort-definitions/api/cohortApi.ts`

- [ ] **Step 1: Add imports for new types**

In `frontend/src/features/cohort-definitions/api/cohortApi.ts`, add the new types to the import block (lines 2-15):

```typescript
import type {
  CohortDefinition,
  CohortGeneration,
  CohortDefinitionListParams,
  PaginatedResponse,
  CreateCohortDefinitionPayload,
  UpdateCohortDefinitionPayload,
  CohortOverlapResult,
  NegativeControlSuggestion,
  NegativeControlValidation,
  CohortDiagnosticsResult,
  RDiagnosticsResponse,
  RunCohortDiagnosticsPayload,
  DomainInfo,
  GroupedCohortResponse,
  CohortDefinitionGroupedParams,
} from "../types/cohortExpression";
```

- [ ] **Step 2: Add the two new API functions**

Add after the `getCohortDefinitions` function (after line 32):

```typescript
export async function getCohortDomains(): Promise<DomainInfo[]> {
  const { data } = await apiClient.get(`${BASE}/domains`);
  return data;
}

export async function getGroupedCohortDefinitions(
  params: CohortDefinitionGroupedParams,
): Promise<GroupedCohortResponse> {
  const { data } = await apiClient.get(BASE, { params });
  return data;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/cohort-definitions/api/cohortApi.ts
git commit -m "feat: add getCohortDomains and getGroupedCohortDefinitions API functions"
```

---

### Task 9: Frontend hooks — Add useCohortDomains and useGroupedCohortDefinitions

**Files:**
- Modify: `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts`

- [ ] **Step 1: Add imports**

Update imports in `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCohortDefinitions,
  getCohortDefinition,
  getCohortGenerations,
  createCohortDefinition,
  updateCohortDefinition,
  deleteCohortDefinition,
  generateCohort,
  copyCohortDefinition,
  compareCohorts,
  getCohortStats,
  createCohortFromBundle,
  getCohortDomains,
  getGroupedCohortDefinitions,
} from "../api/cohortApi";
import type {
  CohortDefinitionListParams,
  CohortDefinitionGroupedParams,
  CreateCohortDefinitionPayload,
  UpdateCohortDefinitionPayload,
} from "../types/cohortExpression";
```

- [ ] **Step 2: Add the two new hooks**

Add after the `useCohortDefinitions` hook (after line 30):

```typescript
export function useCohortDomains() {
  return useQuery({
    queryKey: ["cohort-definitions", "domains"],
    queryFn: getCohortDomains,
    staleTime: 60_000,
  });
}

export function useGroupedCohortDefinitions(params: CohortDefinitionGroupedParams) {
  return useQuery({
    queryKey: ["cohort-definitions", "grouped", params],
    queryFn: () => getGroupedCohortDefinitions(params),
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts
git commit -m "feat: add useCohortDomains and useGroupedCohortDefinitions hooks"
```

---

### Task 10: Frontend — Add TierBadge component and update CohortDefinitionList

**Files:**
- Modify: `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx`

- [ ] **Step 1: Add TierBadge component and update imports**

In `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx`, add `ChevronDown, ChevronRight, Shield, Award, FileText` to the lucide imports (line 3):

```typescript
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Globe,
  Lock,
  Stethoscope,
  Plus,
  Database,
  User,
  Shield,
  Award,
  FileText,
} from "lucide-react";
```

Add after the `SourceBadges` component (after line 101):

```typescript
function TierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return <span className="text-xs text-[#5A5650]">--</span>;

  const config: Record<string, { color: string; label: string; Icon: typeof Shield }> = {
    "study-ready": { color: "#2DD4BF", label: "Study-Ready", Icon: Shield },
    validated: { color: "#C9A227", label: "Validated", Icon: Award },
    draft: { color: "#6B7280", label: "Draft", Icon: FileText },
  };

  const c = config[tier];
  if (!c) return <span className="text-xs text-[#5A5650]">{tier}</span>;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${c.color}15`, color: c.color }}
    >
      <c.Icon size={10} />
      {c.label}
    </span>
  );
}
```

- [ ] **Step 2: Add the Tier column to the table header**

In the `<thead>` section (around line 230), add a new `<th>` for Tier after the Name column:

```typescript
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Name
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Tier
              </th>
```

- [ ] **Step 3: Add Tier cell to each row**

In the `<tbody>` row mapping, add a `<td>` for the tier badge after the Name cell (after the `</td>` that closes the name cell, around line 280):

```typescript
                <td className="px-3 py-3">
                  <TierBadge tier={def.quality_tier} />
                </td>
```

- [ ] **Step 4: Add domain and quality_tier to Props and the grouped view**

Update the `Props` interface (lines 103-109):

```typescript
interface Props {
  tags?: string[];
  search?: string;
  isPublic?: boolean;
  withGenerations?: boolean;
  onCreateFromBundle?: () => void;
  groupBy?: "domain" | null;
  tierFilter?: string | null;
}
```

Update the component signature to destructure the new props:

```typescript
export function CohortDefinitionList({ tags, search, isPublic, withGenerations, onCreateFromBundle, groupBy, tierFilter }: Props) {
```

- [ ] **Step 5: Add grouped view rendering**

Add a new import at the top:

```typescript
import type { CohortDefinition as CohortDefType, CohortGroup } from "../types/cohortExpression";
import { useGroupedCohortDefinitions } from "../hooks/useCohortDefinitions";
```

Inside the component, before the flat list rendering, add the grouped view branch. Add this state after `const limit = 20;` (line 116):

```typescript
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { data: groupedData, isLoading: groupedLoading } = useGroupedCohortDefinitions({
    group_by: "domain",
    quality_tier: tierFilter as "study-ready" | "validated" | "draft" | undefined ?? undefined,
    search: search || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    author_id: myOnly && currentUser ? currentUser.id : undefined,
  });

  // Auto-expand first 3 groups on initial load
  useEffect(() => {
    if (groupedData?.data?.groups && expandedGroups.size === 0) {
      const firstThree = groupedData.data.groups.slice(0, 3).map((g) => g.key);
      setExpandedGroups(new Set(firstThree));
    }
  }, [groupedData?.data?.groups]);
```

Then, right before the `return (` for the main table (the `<div className="space-y-4">` block), add the grouped view conditional:

```typescript
  if (groupBy === "domain" && groupedData?.data?.groups) {
    const groups = groupedData.data.groups;

    if (groupedLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-[#8A857D]" />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {/* My / All toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-[#1C1C20] p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setMyOnly(true)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              myOnly ? "bg-[#232328] text-[#F0EDE8] shadow-sm" : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            <User size={12} />
            My Definitions
          </button>
          <button
            type="button"
            onClick={() => setMyOnly(false)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              !myOnly ? "bg-[#232328] text-[#F0EDE8] shadow-sm" : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            <Globe size={12} />
            All Definitions
          </button>
        </div>

        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.key);
          return (
            <div key={group.key} className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
              {/* Group header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#1C1C20] hover:bg-[#232328] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-[#8A857D]" />
                  ) : (
                    <ChevronRight size={14} className="text-[#8A857D]" />
                  )}
                  <span className="text-sm font-semibold text-[#F0EDE8] uppercase tracking-wider">
                    {group.label}
                  </span>
                  <span className="text-xs text-[#5A5650]">({group.count})</span>
                </div>
              </button>

              {/* Group table */}
              {isExpanded && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1A1A1E]">
                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Name</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Tier</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">N</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Studies</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Sources</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.cohorts.map((def, i) => (
                      <tr
                        key={def.id}
                        onClick={() => navigate(`/cohort-definitions/${def.id}`)}
                        className={cn(
                          "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                          i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {def.is_public ? (
                              <Globe size={11} className="text-[#60A5FA] shrink-0" />
                            ) : (
                              <Lock size={11} className="text-[#5A5650] shrink-0" />
                            )}
                            <p className="text-sm font-medium text-[#F0EDE8] truncate max-w-[350px]">
                              {def.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <TierBadge tier={def.quality_tier} />
                        </td>
                        <td className="px-3 py-2.5">
                          {def.latest_generation?.person_count != null ? (
                            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#2DD4BF]">
                              {def.latest_generation.person_count.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-xs text-[#5A5650]">--</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#8A857D]">
                          {(def as CohortDefType & { study_cohorts_count?: number }).study_cohorts_count ?? "--"}
                        </td>
                        <td className="px-3 py-2.5">
                          <SourceBadges sources={def.generation_sources} />
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#8A857D]">
                          {formatDate(def.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    );
  }
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx
git commit -m "feat: add TierBadge component and grouped domain view to CohortDefinitionList"
```

---

### Task 11: Frontend — Add toggle and tier filter to CohortDefinitionsPage

**Files:**
- Modify: `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx`

- [ ] **Step 1: Add state for view mode and tier filter**

Add imports at the top:

```typescript
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Upload, X, Search, Stethoscope, LayoutGrid, List } from "lucide-react";
```

Add state variables inside the component (after the `debouncedSearch` state, around line 37):

```typescript
  const [viewMode, setViewMode] = useState<"domain" | "flat">("domain");
  const [tierFilter, setTierFilter] = useState<string | null>(null);
```

- [ ] **Step 2: Add the view mode toggle and tier filter pills**

Add after the search bar section (after line 166), before the tag filter chips:

```typescript
      {/* View toggle + Tier filter */}
      <div className="flex items-center justify-between">
        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-[#1C1C20] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("domain")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "domain"
                ? "bg-[#232328] text-[#F0EDE8] shadow-sm"
                : "text-[#8A857D] hover:text-[#C5C0B8]"
            }`}
          >
            <LayoutGrid size={12} />
            By Domain
          </button>
          <button
            type="button"
            onClick={() => setViewMode("flat")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "flat"
                ? "bg-[#232328] text-[#F0EDE8] shadow-sm"
                : "text-[#8A857D] hover:text-[#C5C0B8]"
            }`}
          >
            <List size={12} />
            Flat List
          </button>
        </div>

        {/* Tier filter pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#5A5650]">Tier:</span>
          {[
            { key: null, label: "All" },
            { key: "study-ready", label: "Study-Ready", color: "#2DD4BF" },
            { key: "validated", label: "Validated", color: "#C9A227" },
            { key: "draft", label: "Draft", color: "#6B7280" },
          ].map((t) => (
            <button
              key={t.key ?? "all"}
              type="button"
              onClick={() => setTierFilter(tierFilter === t.key ? null : t.key)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border ${
                tierFilter === t.key
                  ? "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]"
                  : "border-[#2A2A30] bg-[#1A1A1F] text-[#8A857D] hover:border-[#3A3A42]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: Pass groupBy and tierFilter to CohortDefinitionList**

Update the `<CohortDefinitionList>` usage (around line 213):

```typescript
      <CohortDefinitionList
        tags={activeTags.length > 0 ? activeTags : undefined}
        search={debouncedSearch || undefined}
        isPublic={statFilter === "public" || undefined}
        withGenerations={statFilter === "generated" || undefined}
        onCreateFromBundle={() => setShowFromBundle(true)}
        groupBy={viewMode === "domain" ? "domain" : null}
        tierFilter={tierFilter}
      />
```

- [ ] **Step 4: Verify TypeScript compiles and build succeeds**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit && npx vite build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx
git commit -m "feat: add domain/flat view toggle and tier filter pills to CohortDefinitionsPage"
```

---

### Task 12: Deploy and verify end-to-end

**Files:** None (deployment only)

- [ ] **Step 1: Run all 3 migrations via deploy**

```bash
cd /home/smudoshi/Github/Parthenon && ./deploy.sh --db
```

If migrations already ran individually during development, this is a no-op. Verify:

```bash
docker compose exec php php artisan migrate:status | grep "2026_04_10_200"
```

Expected: all three show `Ran`.

- [ ] **Step 2: Build frontend**

```bash
cd /home/smudoshi/Github/Parthenon && ./deploy.sh --frontend
```

- [ ] **Step 3: Verify the domains endpoint**

```bash
TOKEN=$(curl -s http://localhost:8082/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"admin@acumenus.net","password":"superuser"}' | jq -r '.token')
curl -s http://localhost:8082/api/v1/cohort-definitions/domains -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: 8 domain objects with counts summing to 80.

- [ ] **Step 4: Verify the grouped endpoint**

```bash
curl -s "http://localhost:8082/api/v1/cohort-definitions?group_by=domain" -H "Authorization: Bearer $TOKEN" | jq '.data.tier_counts'
```

Expected: `{"study-ready": N, "validated": N, "draft": N}` where N > 0.

- [ ] **Step 5: Verify active cohort count**

```bash
PGPASSFILE=~/.pgpass psql -h localhost -U claude_dev -d parthenon -c "SELECT COUNT(*) FROM app.cohort_definitions WHERE deleted_at IS NULL;"
```

Expected: `80`

- [ ] **Step 6: Verify UI at https://parthenon.acumenus.net**

Open the Cohort Definitions page. Verify:
- "By Domain" / "Flat List" toggle is visible
- Tier filter pills (All, Study-Ready, Validated, Draft) are visible
- Domain view shows collapsible grouped sections with counts
- Tier badges appear on each row
- Clicking a tier pill filters the results
- Flat List mode shows the original table with the new Tier column

- [ ] **Step 7: Run CI checks**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit && npx eslint src/features/cohort-definitions/
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test && vendor/bin/phpstan analyse app/Models/App/CohortDefinition.php app/Http/Controllers/Api/V1/CohortDefinitionController.php app/Observers/CohortDefinitionObserver.php"
```

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: cohort cleanup & categorization — deploy verified"
```
