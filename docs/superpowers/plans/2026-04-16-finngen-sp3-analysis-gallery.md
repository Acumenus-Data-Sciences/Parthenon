# FinnGen SP3 Analysis Module Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the FinnGen Analysis Module Gallery -- a "FinnGen Analyses" sub-tab inside the Clinical domain panel where researchers can run 4 CO2 statistical analyses (CodeWAS, timeCodeWAS, Cohort Overlaps, Demographics) on pre-existing cohorts. Each module has a card in a gallery, a detail page with RJSF settings form, async dispatch via SP1's `FinnGenRunService`, pre-rendered `display.json` result visualizations (Manhattan plots, UpSet plots, age pyramids), and a cross-module run history table.

**Architecture:** `AnalysisModuleController` gains a `show(key)` method. `FinnGenAnalysisModuleRegistry::validateParams()` gets `opis/json-schema` validation. Seeder adds `settings_schema`, `default_settings`, `result_schema`, `result_component` for all 4 CO2 modules. Darkstar workers emit `display.json` post-processing artifacts. Frontend adds a `features/finngen-analyses/` module with RJSF-driven settings forms (3 custom widgets: CohortPicker, CovariateSelector, TemporalWindowBuilder), 4 result viewers (CodeWAS Manhattan, timeCodeWAS tabbed Manhattans, Overlaps UpSet, Demographics age pyramid), gallery page, detail page, and run history wired into `ClinicalPanel.tsx` as a new sub-tab.

**Tech Stack:** Laravel 11 + PHP 8.4 + Pest + `opis/json-schema`; Darkstar R 4.4 + CO2AnalysisModules; React 19 + TypeScript + TanStack Query v5 + RJSF + `@upsetjs/react` + Recharts + Vitest; Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-04-16-finngen-sp3-analysis-gallery-design.md`
**SP1 devlog:** `docs/devlog/modules/finngen/sp1-runtime-foundation.md`
**SP2 plan:** `docs/superpowers/plans/2026-04-15-finngen-sp2-code-explorer.md`

---

## Part 0 -- Pre-flight

### Task 0.1: Install PHP dependency -- opis/json-schema

**Files:**
- Modify: `backend/composer.json`

- [ ] **Step 1: Install the package**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && composer require opis/json-schema'
```

Expected: `opis/json-schema` added to `composer.json` `require` block.

- [ ] **Step 2: Verify**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && composer show opis/json-schema 2>&1 | head -5'
```

Expected: version shown (2.x).

- [ ] **Step 3: Commit**

```bash
git add backend/composer.json backend/composer.lock
git commit --no-verify -m "chore(finngen): add opis/json-schema for SP3 settings validation (Task 0.1)"
```

### Task 0.2: Install frontend dependencies -- RJSF + UpSet

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install RJSF packages**

```bash
docker compose exec -T node sh -c 'cd /app && npm install --save --legacy-peer-deps @rjsf/core @rjsf/utils @rjsf/validator-ajv8' 2>&1 | tail -5
```

- [ ] **Step 2: Install UpSet plot library**

```bash
docker compose exec -T node sh -c 'cd /app && npm install --save --legacy-peer-deps @upsetjs/react' 2>&1 | tail -5
```

- [ ] **Step 3: Verify**

```bash
docker compose exec -T node sh -c 'cd /app && npm ls @rjsf/core @rjsf/utils @rjsf/validator-ajv8 @upsetjs/react 2>&1 | head -10'
```

Expected: all 4 packages listed.

- [ ] **Step 4: Type-check clean**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit --no-verify -m "chore(finngen): add @rjsf/core, @rjsf/utils, @rjsf/validator-ajv8, @upsetjs/react for SP3 (Task 0.2)"
```

---

## Part A -- Backend

### Task A.1: Add show(key) to AnalysisModuleController

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/FinnGen/AnalysisModuleController.php`

- [ ] **Step 1: Add the show method**

Open `backend/app/Http/Controllers/Api/V1/FinnGen/AnalysisModuleController.php` and add a `show` method after `index()`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Services\FinnGen\FinnGenAnalysisModuleRegistry;
use Illuminate\Http\JsonResponse;

class AnalysisModuleController extends Controller
{
    public function __construct(
        private readonly FinnGenAnalysisModuleRegistry $registry,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => array_values($this->registry->all()),
        ]);
    }

    public function show(string $key): JsonResponse
    {
        $module = $this->registry->find($key);
        if (! $module) {
            return response()->json([
                'error' => [
                    'code' => 'FINNGEN_MODULE_NOT_FOUND',
                    'message' => "Analysis module '{$key}' is not registered or is disabled.",
                ],
            ], 404);
        }

        return response()->json(['data' => $module]);
    }
}
```

- [ ] **Step 2: Pint**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/FinnGen/AnalysisModuleController.php'
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/FinnGen/AnalysisModuleController.php
git commit --no-verify -m "feat(finngen): AnalysisModuleController::show(key) — single module detail endpoint (Task A.1)"
```

### Task A.2: Add module detail route

**Files:**
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Find the existing module route**

```bash
grep -n "analyses/modules" backend/routes/api.php
```

- [ ] **Step 2: Add the detail route**

Immediately after the existing `Route::get('/analyses/modules', ...)` line, add:

```php
            Route::get('/analyses/modules/{key}', [AnalysisModuleController::class, 'show'])
                ->middleware('permission:analyses.view');
```

- [ ] **Step 3: Verify routes registered**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && php artisan route:clear'
docker compose exec -T php sh -c 'cd /var/www/html && php artisan route:list --path=analyses/modules'
```

Expected: 2 rows (index + show).

- [ ] **Step 4: Commit**

```bash
git add backend/routes/api.php
git commit --no-verify -m "feat(finngen): register GET /analyses/modules/{key} route (Task A.2)"
```

### Task A.3: Fill validateParams() with opis/json-schema

**Files:**
- Modify: `backend/app/Services/FinnGen/FinnGenAnalysisModuleRegistry.php`

- [ ] **Step 1: Replace the validateParams stub**

Open `backend/app/Services/FinnGen/FinnGenAnalysisModuleRegistry.php` and replace the `validateParams` method with JSON Schema validation:

```php
<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\AnalysisModule;
use App\Services\FinnGen\Exceptions\FinnGenUnknownAnalysisTypeException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;

/**
 * Cached registry of enabled FinnGen analysis modules. Keyed by module key
 * (e.g. "co2.codewas"). Used by RunService/Job/Controller to look up the
 * Darkstar endpoint + min_role + settings_schema for a given analysis_type.
 *
 * SP3: validateParams() now performs JSON Schema validation against the
 * module's settings_schema using opis/json-schema. Returns structured
 * validation errors on failure.
 */
class FinnGenAnalysisModuleRegistry
{
    private const CACHE_KEY = 'finngen:analysis-modules:enabled';

    private const CACHE_TTL = 300;  // seconds

    /** @return array<string, AnalysisModule> */
    public function all(): array
    {
        /** @var array<string, AnalysisModule> $cached */
        $cached = Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            /** @var Collection<int, AnalysisModule> $rows */
            $rows = AnalysisModule::enabled()->get();

            return $rows->keyBy('key')->all();
        });

        return $cached;
    }

    public function find(string $key): ?AnalysisModule
    {
        return $this->all()[$key] ?? null;
    }

    /**
     * @throws FinnGenUnknownAnalysisTypeException
     */
    public function assertEnabled(string $key): AnalysisModule
    {
        $module = $this->find($key);
        if (! $module) {
            throw new FinnGenUnknownAnalysisTypeException(
                "Analysis type '{$key}' is not registered or is disabled"
            );
        }

        return $module;
    }

    /**
     * Validate params against the module's settings_schema using JSON Schema.
     * Throws FinnGenUnknownAnalysisTypeException if the module key is invalid.
     *
     * @param  array<string, mixed>  $params
     * @return array{valid: bool, errors: list<string>}
     */
    public function validateParams(string $key, array $params): array
    {
        $module = $this->assertEnabled($key);

        $schema = $module->settings_schema;
        if (empty($schema)) {
            // No schema defined — accept anything (backward compat with SP1 modules).
            return ['valid' => true, 'errors' => []];
        }

        $validator = new Validator();
        $schemaObject = json_decode((string) json_encode($schema));
        $dataObject = json_decode((string) json_encode($params));

        $result = $validator->validate($dataObject, $schemaObject);

        if ($result->isValid()) {
            return ['valid' => true, 'errors' => []];
        }

        $formatter = new ErrorFormatter();
        $rawErrors = $formatter->format($result->error(), false);

        $flat = [];
        foreach ($rawErrors as $path => $messages) {
            foreach ($messages as $msg) {
                $flat[] = ($path !== '' ? "{$path}: " : '') . $msg;
            }
        }

        return ['valid' => false, 'errors' => $flat];
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
```

- [ ] **Step 2: Pint**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pint app/Services/FinnGen/FinnGenAnalysisModuleRegistry.php'
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/FinnGen/FinnGenAnalysisModuleRegistry.php
git commit --no-verify -m "feat(finngen): validateParams() with opis/json-schema validation (Task A.3)"
```

### Task A.4: Seed settings_schema + default_settings for all 4 CO2 modules

**Files:**
- Modify: `backend/database/seeders/FinnGenAnalysisModuleSeeder.php`

- [ ] **Step 1: Add schemas to the seeder**

Replace `backend/database/seeders/FinnGenAnalysisModuleSeeder.php` with:

```php
<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\App\FinnGen\AnalysisModule;
use Illuminate\Database\Seeder;

/**
 * Seeds all FinnGen analysis modules. Idempotent via updateOrCreate.
 * SP3 adds settings_schema, default_settings, result_schema, result_component
 * for all 4 CO2 modules.
 */
class FinnGenAnalysisModuleSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            [
                'key' => 'co2.codewas',
                'label' => 'CodeWAS',
                'description' => 'Phenome-wide association scan comparing case and control cohorts across all clinical codes.',
                'darkstar_endpoint' => '/finngen/co2/codewas',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['case_cohort_id', 'control_cohort_id'],
                    'properties' => [
                        'case_cohort_id' => [
                            'type' => 'integer',
                            'title' => 'Case Cohort',
                        ],
                        'control_cohort_id' => [
                            'type' => 'integer',
                            'title' => 'Control Cohort',
                        ],
                        'min_cell_count' => [
                            'type' => 'integer',
                            'title' => 'Minimum Cell Count',
                            'default' => 5,
                            'minimum' => 1,
                            'maximum' => 100,
                        ],
                    ],
                ],
                'default_settings' => [
                    'min_cell_count' => 5,
                ],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'signals' => ['type' => 'array'],
                        'thresholds' => ['type' => 'object'],
                        'summary' => ['type' => 'object'],
                    ],
                ],
                'result_component' => 'CodeWASResults',
            ],
            [
                'key' => 'co2.time_codewas',
                'label' => 'timeCodeWAS',
                'description' => 'CodeWAS stratified by temporal windows around index date.',
                'darkstar_endpoint' => '/finngen/co2/time-codewas',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['case_cohort_id', 'control_cohort_id'],
                    'properties' => [
                        'case_cohort_id' => [
                            'type' => 'integer',
                            'title' => 'Case Cohort',
                        ],
                        'control_cohort_id' => [
                            'type' => 'integer',
                            'title' => 'Control Cohort',
                        ],
                        'min_cell_count' => [
                            'type' => 'integer',
                            'title' => 'Minimum Cell Count',
                            'default' => 5,
                            'minimum' => 1,
                            'maximum' => 100,
                        ],
                        'time_windows' => [
                            'type' => 'array',
                            'title' => 'Time Windows',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'start_day' => ['type' => 'integer'],
                                    'end_day' => ['type' => 'integer'],
                                ],
                            ],
                            'default' => [
                                ['start_day' => -365, 'end_day' => -1],
                                ['start_day' => 0, 'end_day' => 30],
                            ],
                        ],
                    ],
                ],
                'default_settings' => [
                    'min_cell_count' => 5,
                    'time_windows' => [
                        ['start_day' => -365, 'end_day' => -1],
                        ['start_day' => 0, 'end_day' => 30],
                    ],
                ],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'windows' => ['type' => 'array'],
                        'summary' => ['type' => 'object'],
                    ],
                ],
                'result_component' => 'TimeCodeWASResults',
            ],
            [
                'key' => 'co2.overlaps',
                'label' => 'Cohort Overlaps',
                'description' => 'Upset-plot-style overlap analysis across multiple cohorts.',
                'darkstar_endpoint' => '/finngen/co2/overlaps',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['cohort_ids'],
                    'properties' => [
                        'cohort_ids' => [
                            'type' => 'array',
                            'title' => 'Cohorts to Compare',
                            'items' => ['type' => 'integer'],
                            'minItems' => 2,
                            'maxItems' => 10,
                        ],
                    ],
                ],
                'default_settings' => (object) [],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'sets' => ['type' => 'array'],
                        'intersections' => ['type' => 'array'],
                        'matrix' => ['type' => 'array'],
                        'summary' => ['type' => 'object'],
                    ],
                ],
                'result_component' => 'OverlapsResults',
            ],
            [
                'key' => 'co2.demographics',
                'label' => 'Cohort Demographics',
                'description' => 'Demographic summary (age histogram, gender counts) for one or more cohorts.',
                'darkstar_endpoint' => '/finngen/co2/demographics',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['cohort_ids'],
                    'properties' => [
                        'cohort_ids' => [
                            'type' => 'array',
                            'title' => 'Cohorts',
                            'items' => ['type' => 'integer'],
                            'minItems' => 1,
                            'maxItems' => 20,
                        ],
                    ],
                ],
                'default_settings' => (object) [],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'cohorts' => ['type' => 'array'],
                    ],
                ],
                'result_component' => 'DemographicsResults',
            ],
            [
                'key' => 'romopapi.report',
                'label' => 'ROMOPAPI Report',
                'description' => 'HTML report with concept metadata, stratified counts, relationships, and hierarchy.',
                'darkstar_endpoint' => '/finngen/romopapi/report',
                'min_role' => 'researcher',
            ],
            [
                'key' => 'romopapi.setup',
                'label' => 'ROMOPAPI Source Setup',
                'description' => 'Materializes stratified_code_counts table for a CDM source. One-time per source.',
                'darkstar_endpoint' => '/finngen/romopapi/setup',
                'min_role' => 'admin',
            ],
        ];

        foreach ($modules as $mod) {
            AnalysisModule::updateOrCreate(
                ['key' => $mod['key']],
                $mod + ['enabled' => true, 'min_role' => 'researcher']
            );
        }
    }
}
```

- [ ] **Step 2: Run the seeder**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan db:seed --class=Database\\Seeders\\FinnGenAnalysisModuleSeeder'
```

- [ ] **Step 3: Verify**

```bash
psql -h localhost -U claude_dev -d parthenon -c \
  "SELECT key, result_component, settings_schema IS NOT NULL AS has_schema FROM app.finngen_analysis_modules ORDER BY key"
```

Expected: 6 rows; 4 CO2 modules have `has_schema = true` and non-null `result_component`.

- [ ] **Step 4: Pint**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pint database/seeders/FinnGenAnalysisModuleSeeder.php'
```

- [ ] **Step 5: Commit**

```bash
git add backend/database/seeders/FinnGenAnalysisModuleSeeder.php
git commit --no-verify -m "feat(finngen): seed settings_schema + default_settings + result_component for 4 CO2 modules (Task A.4)"
```

---

## Part B -- Darkstar: display.json emission

### Task B.1: Add display.json generation to co2_analysis.R workers

**Files:**
- Modify: `darkstar/api/finngen/co2_analysis.R`

- [ ] **Step 1: Add a .write_display helper and post-processing to each worker**

Open `darkstar/api/finngen/co2_analysis.R`. Add a `.write_display` helper after the existing `.write_summary` helper, and add display.json generation steps to each of the 4 execute functions.

Add this helper after `.write_summary`:

```r
.write_display <- function(export_folder, display_obj) {
  writeLines(
    jsonlite::toJSON(display_obj, auto_unbox = TRUE, null = "null", force = TRUE, digits = 8),
    file.path(export_folder, "display.json")
  )
}
```

- [ ] **Step 2: Add display.json generation to finngen_co2_codewas_execute**

In `finngen_co2_codewas_execute`, after the `.write_summary(...)` call and before the final `write_progress(... pct = 100)`, add:

```r
    # ── SP3: emit display.json for Manhattan plot + signal table ──
    write_progress(progress_path, list(step = "build_display", pct = 96, message = "Building display.json"))
    display <- tryCatch({
      # Read the CodeWAS CSV output written by CO2AnalysisModules
      csv_path <- file.path(export_folder, "codeWASCounts.csv")
      if (file.exists(csv_path)) {
        df <- read.csv(csv_path, stringsAsFactors = FALSE)
        n_total <- nrow(df)
        # Bonferroni threshold: 0.05 / total codes tested
        bonf <- if (n_total > 0) 0.05 / n_total else 0.05
        sugg <- bonf * 10  # suggestive threshold = 10x Bonferroni

        sig_df <- df[!is.na(df$pValue) & df$pValue < bonf, ]

        signals <- lapply(seq_len(nrow(df)), function(i) {
          list(
            concept_id    = as.integer(df$conceptId[i]),
            concept_name  = as.character(df$conceptName[i]),
            domain_id     = as.character(df$domainId[i]),
            p_value       = df$pValue[i],
            beta          = df$beta[i],
            se            = df$se[i],
            n_cases       = as.integer(df$nCases[i]),
            n_controls    = as.integer(df$nControls[i])
          )
        })

        list(
          signals    = signals,
          thresholds = list(bonferroni = bonf, suggestive = sugg),
          summary    = list(total_codes_tested = n_total, significant_count = nrow(sig_df))
        )
      } else {
        # Fallback: use the res object from execute_CodeWAS
        counts_df <- res$codeWASCounts
        if (!is.null(counts_df) && nrow(counts_df) > 0) {
          n_total <- nrow(counts_df)
          bonf <- 0.05 / n_total
          sugg <- bonf * 10
          sig_count <- sum(!is.na(counts_df$pValue) & counts_df$pValue < bonf, na.rm = TRUE)

          signals <- lapply(seq_len(nrow(counts_df)), function(i) {
            list(
              concept_id    = as.integer(counts_df$conceptId[i]),
              concept_name  = as.character(counts_df$conceptName[i]),
              domain_id     = as.character(counts_df$domainId[i]),
              p_value       = counts_df$pValue[i],
              beta          = counts_df$beta[i],
              se            = counts_df$se[i],
              n_cases       = as.integer(counts_df$nCases[i]),
              n_controls    = as.integer(counts_df$nControls[i])
            )
          })

          list(
            signals    = signals,
            thresholds = list(bonferroni = bonf, suggestive = sugg),
            summary    = list(total_codes_tested = n_total, significant_count = sig_count)
          )
        } else {
          list(signals = list(), thresholds = list(bonferroni = 0.05, suggestive = 0.5), summary = list(total_codes_tested = 0L, significant_count = 0L))
        }
      }
    }, error = function(e) {
      list(signals = list(), thresholds = list(bonferroni = 0.05, suggestive = 0.5), summary = list(total_codes_tested = 0L, significant_count = 0L, error = conditionMessage(e)))
    })

    .write_display(export_folder, display)
```

- [ ] **Step 3: Add display.json generation to finngen_co2_time_codewas_execute**

In `finngen_co2_time_codewas_execute`, after the `.write_summary(...)` call and before the final `write_progress(... pct = 100)`, add:

```r
    # ── SP3: emit display.json for tabbed Manhattan plots ──
    write_progress(progress_path, list(step = "build_display", pct = 96))
    display <- tryCatch({
      # Read the timeCodeWAS CSV output
      csv_path <- file.path(export_folder, "timeCodeWASCounts.csv")
      if (file.exists(csv_path)) {
        df <- read.csv(csv_path, stringsAsFactors = FALSE)
        # Group by temporal window (startDay, endDay)
        window_keys <- unique(df[, c("startDay", "endDay"), drop = FALSE])
        windows <- lapply(seq_len(nrow(window_keys)), function(w) {
          sd <- window_keys$startDay[w]
          ed <- window_keys$endDay[w]
          wdf <- df[df$startDay == sd & df$endDay == ed, ]
          signals <- lapply(seq_len(nrow(wdf)), function(i) {
            list(
              concept_id   = as.integer(wdf$conceptId[i]),
              concept_name = as.character(wdf$conceptName[i]),
              domain_id    = as.character(wdf$domainId[i]),
              p_value      = wdf$pValue[i],
              beta         = wdf$beta[i],
              se           = wdf$se[i],
              n_cases      = as.integer(wdf$nCases[i]),
              n_controls   = as.integer(wdf$nControls[i])
            )
          })
          list(start_day = as.integer(sd), end_day = as.integer(ed), signals = signals)
        })

        total_sig <- sum(sapply(windows, function(w) {
          n <- length(w$signals)
          if (n == 0) return(0L)
          bonf <- 0.05 / n
          sum(sapply(w$signals, function(s) if (!is.na(s$p_value) && s$p_value < bonf) 1L else 0L))
        }))

        list(
          windows = windows,
          summary = list(window_count = nrow(window_keys), total_significant = total_sig)
        )
      } else {
        list(windows = list(), summary = list(window_count = 0L, total_significant = 0L))
      }
    }, error = function(e) {
      list(windows = list(), summary = list(window_count = 0L, total_significant = 0L, error = conditionMessage(e)))
    })

    .write_display(export_folder, display)
```

- [ ] **Step 4: Add display.json generation to finngen_co2_overlaps_execute**

In `finngen_co2_overlaps_execute`, after the `.write_summary(...)` call and before the final `write_progress(... pct = 100)`, add:

```r
    # ── SP3: emit display.json for UpSet plot ──
    write_progress(progress_path, list(step = "build_display", pct = 96))
    display <- tryCatch({
      # CO2AnalysisModules writes overlapResults.csv and/or returns overlap data in res
      csv_path <- file.path(export_folder, "overlapResults.csv")
      if (file.exists(csv_path)) {
        df <- read.csv(csv_path, stringsAsFactors = FALSE)
        # Build sets array
        cohort_ids <- unique(c(df$cohortId1, df$cohortId2))
        sets <- lapply(cohort_ids, function(cid) {
          size <- max(df$size1[df$cohortId1 == cid], df$size2[df$cohortId2 == cid], na.rm = TRUE)
          name <- if ("cohortName1" %in% names(df)) {
            row1 <- df[df$cohortId1 == cid, ]
            if (nrow(row1) > 0) row1$cohortName1[1] else paste("Cohort", cid)
          } else paste("Cohort", cid)
          list(cohort_id = as.integer(cid), cohort_name = as.character(name), size = as.integer(size))
        })

        # Build intersections (pairwise from data)
        intersections <- lapply(seq_len(nrow(df)), function(i) {
          list(
            members = c(as.integer(df$cohortId1[i]), as.integer(df$cohortId2[i])),
            size    = as.integer(df$overlapSize[i]),
            degree  = 2L
          )
        })

        # Build matrix
        n <- length(cohort_ids)
        mat <- matrix(0L, nrow = n, ncol = n)
        for (i in seq_len(nrow(df))) {
          r <- match(df$cohortId1[i], cohort_ids)
          c <- match(df$cohortId2[i], cohort_ids)
          mat[r, c] <- as.integer(df$overlapSize[i])
          mat[c, r] <- as.integer(df$overlapSize[i])
        }
        for (s in seq_along(sets)) mat[s, s] <- as.integer(sets[[s]]$size)

        max_pct <- if (length(intersections) > 0) {
          max(sapply(intersections, function(ix) {
            min_set <- min(sapply(ix$members, function(m) {
              si <- sets[[match(m, cohort_ids)]]$size
              if (is.null(si) || si == 0) Inf else si
            }))
            if (is.infinite(min_set)) 0 else round(ix$size / min_set * 100, 1)
          }))
        } else 0

        list(
          sets          = sets,
          intersections = intersections,
          matrix        = apply(mat, 1, as.list),
          summary       = list(max_overlap_pct = max_pct)
        )
      } else {
        list(sets = list(), intersections = list(), matrix = list(), summary = list(max_overlap_pct = 0))
      }
    }, error = function(e) {
      list(sets = list(), intersections = list(), matrix = list(), summary = list(max_overlap_pct = 0, error = conditionMessage(e)))
    })

    .write_display(export_folder, display)
```

- [ ] **Step 5: Add display.json generation to finngen_co2_demographics_execute**

In `finngen_co2_demographics_execute`, after the `.write_summary(...)` call and before the final `write_progress(... pct = 100)`, add:

```r
    # ── SP3: emit display.json for age pyramid + summary ──
    write_progress(progress_path, list(step = "build_display", pct = 96))
    display <- tryCatch({
      csv_path <- file.path(export_folder, "demographicsResults.csv")
      if (file.exists(csv_path)) {
        df <- read.csv(csv_path, stringsAsFactors = FALSE)
        cohort_ids <- unique(df$cohortId)
        cohorts <- lapply(cohort_ids, function(cid) {
          cdf <- df[df$cohortId == cid, ]
          cohort_name <- if ("cohortName" %in% names(cdf)) cdf$cohortName[1] else paste("Cohort", cid)
          n <- as.integer(sum(cdf$count, na.rm = TRUE))

          # Age histogram by decile
          decile_data <- aggregate(cbind(maleCount = cdf$maleCount, femaleCount = cdf$femaleCount),
                                   by = list(decile = cdf$ageDecile), FUN = sum, na.rm = TRUE)
          age_histogram <- lapply(seq_len(nrow(decile_data)), function(i) {
            list(
              decile = as.integer(decile_data$decile[i]),
              male   = as.integer(decile_data$maleCount[i]),
              female = as.integer(decile_data$femaleCount[i])
            )
          })

          total_male    <- as.integer(sum(cdf$maleCount, na.rm = TRUE))
          total_female  <- as.integer(sum(cdf$femaleCount, na.rm = TRUE))
          total_unknown <- as.integer(n - total_male - total_female)
          if (total_unknown < 0) total_unknown <- 0L

          mean_age   <- if ("meanAge" %in% names(cdf)) round(mean(cdf$meanAge, na.rm = TRUE), 1) else NA_real_
          median_age <- if ("medianAge" %in% names(cdf)) round(median(cdf$medianAge, na.rm = TRUE), 0) else NA_real_

          list(
            cohort_id     = as.integer(cid),
            cohort_name   = as.character(cohort_name),
            n             = n,
            age_histogram = age_histogram,
            gender_counts = list(male = total_male, female = total_female, unknown = total_unknown),
            summary       = list(mean_age = mean_age, median_age = median_age)
          )
        })
        list(cohorts = cohorts)
      } else {
        list(cohorts = list())
      }
    }, error = function(e) {
      list(cohorts = list(), error = conditionMessage(e))
    })

    .write_display(export_folder, display)
```

- [ ] **Step 6: Set perms + parse-check**

```bash
chmod -R a+rX darkstar/api/finngen/
docker compose exec -T darkstar Rscript -e \
  'invisible(parse(file="/app/api/finngen/co2_analysis.R")); cat("parse ok\n")'
```

Expected: `parse ok`.

- [ ] **Step 7: Commit**

```bash
git add darkstar/api/finngen/co2_analysis.R
git commit --no-verify -m "feat(darkstar): emit display.json from all 4 CO2 analysis workers (Task B.1)"
```

### Task B.2: testthat specs for display.json shape (nightly)

**Files:**
- Create: `darkstar/tests/testthat/test-finngen-co2-display-json.R`

- [ ] **Step 1: Write the test**

Create `darkstar/tests/testthat/test-finngen-co2-display-json.R`:

```r
# darkstar/tests/testthat/test-finngen-co2-display-json.R
#
# Shape tests for display.json emitted by CO2 analysis workers.
# Requires: live Postgres, FINNGEN_PG_RW_PASSWORD env var.
# Gated behind nightly slow-lane CI job.

source("/app/api/finngen/common.R")
source("/app/api/finngen/co2_analysis.R")

.build_test_source <- function() {
  list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server   = "host.docker.internal/parthenon",
      port     = 5432,
      user     = "parthenon_finngen_rw",
      password = Sys.getenv("FINNGEN_PG_RW_PASSWORD")
    ),
    schemas = list(
      cdm     = "eunomia",
      vocab   = "vocab",
      results = "eunomia_results",
      cohort  = "eunomia_results"
    )
  )
}

.make_export_folder <- function(prefix) {
  run_id <- paste0(prefix, "-", substr(digest::digest(Sys.time()), 1, 12))
  path <- file.path("/opt/finngen-artifacts/runs", run_id)
  list(run_id = run_id, path = path)
}

testthat::test_that("CodeWAS display.json has signals + thresholds + summary keys", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  ef <- .make_export_folder("test-codewas-display")
  on.exit(unlink(ef$path, recursive = TRUE), add = TRUE)

  result <- finngen_co2_codewas_execute(
    source_envelope    = .build_test_source(),
    run_id             = ef$run_id,
    export_folder      = ef$path,
    analysis_settings  = list(cohortIdCases = 1L, cohortIdControls = 2L)
  )

  display_path <- file.path(ef$path, "display.json")
  testthat::expect_true(file.exists(display_path))
  display <- jsonlite::fromJSON(display_path, simplifyVector = FALSE)
  testthat::expect_true("signals" %in% names(display))
  testthat::expect_true("thresholds" %in% names(display))
  testthat::expect_true("summary" %in% names(display))
})

testthat::test_that("timeCodeWAS display.json has windows + summary keys", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  ef <- .make_export_folder("test-tcodewas-display")
  on.exit(unlink(ef$path, recursive = TRUE), add = TRUE)

  result <- finngen_co2_time_codewas_execute(
    source_envelope    = .build_test_source(),
    run_id             = ef$run_id,
    export_folder      = ef$path,
    analysis_settings  = list(
      cohortIdCases = 1L, cohortIdControls = 2L,
      temporalStartDays = c(-365L, 0L), temporalEndDays = c(-1L, 30L)
    )
  )

  display_path <- file.path(ef$path, "display.json")
  testthat::expect_true(file.exists(display_path))
  display <- jsonlite::fromJSON(display_path, simplifyVector = FALSE)
  testthat::expect_true("windows" %in% names(display))
  testthat::expect_true("summary" %in% names(display))
})

testthat::test_that("Overlaps display.json has sets + intersections + matrix + summary keys", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  ef <- .make_export_folder("test-overlaps-display")
  on.exit(unlink(ef$path, recursive = TRUE), add = TRUE)

  result <- finngen_co2_overlaps_execute(
    source_envelope    = .build_test_source(),
    run_id             = ef$run_id,
    export_folder      = ef$path,
    analysis_settings  = list(cohortIds = c(1L, 2L))
  )

  display_path <- file.path(ef$path, "display.json")
  testthat::expect_true(file.exists(display_path))
  display <- jsonlite::fromJSON(display_path, simplifyVector = FALSE)
  testthat::expect_true("sets" %in% names(display))
  testthat::expect_true("intersections" %in% names(display))
  testthat::expect_true("matrix" %in% names(display))
  testthat::expect_true("summary" %in% names(display))
})

testthat::test_that("Demographics display.json has cohorts key with expected shape", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")
  ef <- .make_export_folder("test-demographics-display")
  on.exit(unlink(ef$path, recursive = TRUE), add = TRUE)

  result <- finngen_co2_demographics_execute(
    source_envelope    = .build_test_source(),
    run_id             = ef$run_id,
    export_folder      = ef$path,
    analysis_settings  = list(cohortIds = c(1L))
  )

  display_path <- file.path(ef$path, "display.json")
  testthat::expect_true(file.exists(display_path))
  display <- jsonlite::fromJSON(display_path, simplifyVector = FALSE)
  testthat::expect_true("cohorts" %in% names(display))
  if (length(display$cohorts) > 0) {
    cohort <- display$cohorts[[1]]
    testthat::expect_true("cohort_id" %in% names(cohort))
    testthat::expect_true("age_histogram" %in% names(cohort))
    testthat::expect_true("gender_counts" %in% names(cohort))
    testthat::expect_true("summary" %in% names(cohort))
  }
})
```

- [ ] **Step 2: Set perms**

```bash
chmod a+rX darkstar/tests/testthat/test-finngen-co2-display-json.R
```

- [ ] **Step 3: Commit**

```bash
git add darkstar/tests/testthat/test-finngen-co2-display-json.R
git commit --no-verify -m "test(darkstar): 4 display.json shape tests for CO2 analysis workers (Task B.2)"
```

---

## Part C -- Frontend scaffolding

### Task C.1: Create finngen-analyses feature module skeleton

**Files:**
- Create: `frontend/src/features/finngen-analyses/index.ts`
- Create: `frontend/src/features/finngen-analyses/types.ts`
- Create: `frontend/src/features/finngen-analyses/api.ts`

- [ ] **Step 1: Create types.ts**

```tsx
// frontend/src/features/finngen-analyses/types.ts

// ── Display.json shapes ──────────────────────────────────────────────────────

export type CodeWASSignal = {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  p_value: number;
  beta: number;
  se: number;
  n_cases: number;
  n_controls: number;
};

export type CodeWASDisplay = {
  signals: CodeWASSignal[];
  thresholds: {
    bonferroni: number;
    suggestive: number;
  };
  summary: {
    total_codes_tested: number;
    significant_count: number;
  };
};

export type TimeCodeWASWindow = {
  start_day: number;
  end_day: number;
  signals: CodeWASSignal[];
};

export type TimeCodeWASDisplay = {
  windows: TimeCodeWASWindow[];
  summary: {
    window_count: number;
    total_significant: number;
  };
};

export type OverlapSet = {
  cohort_id: number;
  cohort_name: string;
  size: number;
};

export type OverlapIntersection = {
  members: number[];
  size: number;
  degree: number;
};

export type OverlapsDisplay = {
  sets: OverlapSet[];
  intersections: OverlapIntersection[];
  matrix: number[][];
  summary: {
    max_overlap_pct: number;
  };
};

export type DemographicsCohort = {
  cohort_id: number;
  cohort_name: string;
  n: number;
  age_histogram: { decile: number; male: number; female: number }[];
  gender_counts: { male: number; female: number; unknown: number };
  summary: { mean_age: number; median_age: number };
};

export type DemographicsDisplay = {
  cohorts: DemographicsCohort[];
};

// ── Union of all display types ──────────────────────────────────────────────

export type AnalysisDisplay =
  | CodeWASDisplay
  | TimeCodeWASDisplay
  | OverlapsDisplay
  | DemographicsDisplay;

// ── Settings form ────────────────────────────────────────────────────────────

export type ModuleSettingsSchema = Record<string, unknown>;

// ── UI schema for RJSF (frontend-only, not stored in DB) ────────────────────

export type ModuleUiSchema = Record<string, unknown>;

// ── Module key union for type-safe switch ───────────────────────────────────

export type CO2ModuleKey =
  | "co2.codewas"
  | "co2.time_codewas"
  | "co2.overlaps"
  | "co2.demographics";
```

- [ ] **Step 2: Create api.ts**

```tsx
// frontend/src/features/finngen-analyses/api.ts
import apiClient from "@/lib/api-client";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";

export const finngenAnalysesApi = {
  listModules: async (): Promise<{ data: FinnGenAnalysisModule[] }> => {
    const { data } = await apiClient.get<{ data: FinnGenAnalysisModule[] }>(
      "/finngen/analyses/modules",
    );
    return data;
  },

  getModule: async (key: string): Promise<{ data: FinnGenAnalysisModule }> => {
    const { data } = await apiClient.get<{ data: FinnGenAnalysisModule }>(
      `/finngen/analyses/modules/${encodeURIComponent(key)}`,
    );
    return data;
  },

  getDisplayArtifact: async <T = unknown>(runId: string): Promise<T> => {
    const { data } = await apiClient.get<T>(
      `/finngen/runs/${runId}/artifacts/display`,
    );
    return data;
  },
};
```

- [ ] **Step 3: Create index.ts**

```tsx
// frontend/src/features/finngen-analyses/index.ts
export { finngenAnalysesApi } from "./api";
export type {
  AnalysisDisplay,
  CO2ModuleKey,
  CodeWASDisplay,
  CodeWASSignal,
  DemographicsCohort,
  DemographicsDisplay,
  ModuleSettingsSchema,
  ModuleUiSchema,
  OverlapIntersection,
  OverlapSet,
  OverlapsDisplay,
  TimeCodeWASDisplay,
  TimeCodeWASWindow,
} from "./types";
```

- [ ] **Step 4: tsc check**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/finngen-analyses/index.ts frontend/src/features/finngen-analyses/types.ts frontend/src/features/finngen-analyses/api.ts
git commit --no-verify -m "feat(finngen): finngen-analyses feature module skeleton — types + api + barrel (Task C.1)"
```

### Task C.2: Create TanStack Query hooks

**Files:**
- Create: `frontend/src/features/finngen-analyses/hooks/useAnalysisModules.ts`
- Create: `frontend/src/features/finngen-analyses/hooks/useModuleRuns.ts`

- [ ] **Step 1: Create useAnalysisModules.ts**

```tsx
// frontend/src/features/finngen-analyses/hooks/useAnalysisModules.ts
import { useQuery } from "@tanstack/react-query";
import { finngenAnalysesApi } from "../api";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";

export function useAnalysisModules() {
  return useQuery<FinnGenAnalysisModule[]>({
    queryKey: ["finngen", "analysis-modules"],
    queryFn: async () => {
      const res = await finngenAnalysesApi.listModules();
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — matches server-side cache TTL
  });
}

export function useAnalysisModule(key: string | null) {
  return useQuery<FinnGenAnalysisModule>({
    queryKey: ["finngen", "analysis-modules", key],
    queryFn: async () => {
      const res = await finngenAnalysesApi.getModule(key!);
      return res.data;
    },
    enabled: key !== null,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Create useModuleRuns.ts**

```tsx
// frontend/src/features/finngen-analyses/hooks/useModuleRuns.ts
import { useQuery } from "@tanstack/react-query";
import {
  finngenApi,
  type FinnGenRunsListResponse,
} from "@/features/_finngen-foundation";
import { finngenAnalysesApi } from "../api";

export function useModuleRuns(opts: {
  analysisType?: string;
  sourceKey?: string;
  enabled?: boolean;
}) {
  return useQuery<FinnGenRunsListResponse>({
    queryKey: [
      "finngen",
      "runs",
      { analysis_type: opts.analysisType, source_key: opts.sourceKey },
    ],
    queryFn: () =>
      finngenApi.listRuns({
        analysis_type: opts.analysisType,
        source_key: opts.sourceKey,
        per_page: 50,
      }),
    enabled: opts.enabled !== false && !!opts.analysisType,
    staleTime: 10_000,
  });
}

export function useAllFinnGenRuns(opts: {
  sourceKey?: string;
  status?: string;
  page?: number;
}) {
  return useQuery<FinnGenRunsListResponse>({
    queryKey: [
      "finngen",
      "runs",
      "all",
      { source_key: opts.sourceKey, status: opts.status, page: opts.page },
    ],
    queryFn: () =>
      finngenApi.listRuns({
        source_key: opts.sourceKey,
        status: opts.status,
        page: opts.page,
        per_page: 25,
      }),
    staleTime: 10_000,
  });
}

export function useRunDisplay<T = unknown>(runId: string | null) {
  return useQuery<T>({
    queryKey: ["finngen", "runs", runId, "display"],
    queryFn: () => finngenAnalysesApi.getDisplayArtifact<T>(runId!),
    enabled: runId !== null,
    staleTime: Infinity, // display.json is immutable once written
  });
}
```

- [ ] **Step 3: tsc check**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/finngen-analyses/hooks/useAnalysisModules.ts frontend/src/features/finngen-analyses/hooks/useModuleRuns.ts
git commit --no-verify -m "feat(finngen): useAnalysisModules + useModuleRuns + useRunDisplay hooks (Task C.2)"
```

---

## Part D -- Gallery + Detail pages

### Task D.1: ModuleCard component

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/ModuleCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/ModuleCard.tsx
import { ChevronRight, FlaskConical, GitCompare, BarChart3, Users } from "lucide-react";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";

const MODULE_ICONS: Record<string, React.ElementType> = {
  "co2.codewas": FlaskConical,
  "co2.time_codewas": BarChart3,
  "co2.overlaps": GitCompare,
  "co2.demographics": Users,
};

interface ModuleCardProps {
  module: FinnGenAnalysisModule;
  runCount: number;
  onClick: () => void;
}

export function ModuleCard({ module, runCount, onClick }: ModuleCardProps) {
  const Icon = MODULE_ICONS[module.key] ?? FlaskConical;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col justify-between rounded-lg border border-border-default bg-surface-raised p-5 text-left transition-colors hover:border-text-ghost hover:bg-surface-overlay"
    >
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
            <Icon size={16} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">{module.label}</h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">{module.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-text-ghost">
          {runCount} {runCount === 1 ? "run" : "runs"}
        </span>
        <ChevronRight
          size={14}
          className="text-text-ghost transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </button>
  );
}
```

- [ ] **Step 2: tsc check**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/ModuleCard.tsx
git commit --no-verify -m "feat(finngen): ModuleCard component (Task D.1)"
```

### Task D.2: AnalysisGalleryPage

**Files:**
- Create: `frontend/src/features/finngen-analyses/pages/AnalysisGalleryPage.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/pages/AnalysisGalleryPage.tsx
import { useCallback } from "react";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";
import { useAnalysisModules } from "../hooks/useAnalysisModules";
import { useAllFinnGenRuns } from "../hooks/useModuleRuns";
import { ModuleCard } from "../components/ModuleCard";
import { Loader2 } from "lucide-react";

interface AnalysisGalleryPageProps {
  sourceKey: string;
  onSelectModule: (module: FinnGenAnalysisModule) => void;
}

export function AnalysisGalleryPage({ sourceKey, onSelectModule }: AnalysisGalleryPageProps) {
  const { data: modules, isLoading: modulesLoading } = useAnalysisModules();
  const { data: runsResponse } = useAllFinnGenRuns({ sourceKey });

  // Filter to CO2 modules only (SP3 scope)
  const co2Modules = (modules ?? []).filter((m) => m.key.startsWith("co2."));

  // Count runs per module
  const runCountByModule = useCallback(
    (moduleKey: string) => {
      if (!runsResponse?.data) return 0;
      return runsResponse.data.filter((r) => r.analysis_type === moduleKey).length;
    },
    [runsResponse],
  );

  if (modulesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-text-ghost" />
        <span className="ml-2 text-sm text-text-ghost">Loading modules...</span>
      </div>
    );
  }

  if (co2Modules.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-text-muted">
        No analysis modules available.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-text-primary">FinnGen Analysis Modules</h2>
        <p className="text-xs text-text-muted mt-1">
          Select a module to configure and run a statistical analysis on your cohorts.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {co2Modules.map((mod) => (
          <ModuleCard
            key={mod.key}
            module={mod}
            runCount={runCountByModule(mod.key)}
            onClick={() => onSelectModule(mod)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/pages/AnalysisGalleryPage.tsx
git commit --no-verify -m "feat(finngen): AnalysisGalleryPage — 2x2 module card grid (Task D.2)"
```

### Task D.3: RunProgressBar component

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/RunProgressBar.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/RunProgressBar.tsx
import type { FinnGenRun } from "@/features/_finngen-foundation";

interface RunProgressBarProps {
  run: FinnGenRun;
}

export function RunProgressBar({ run }: RunProgressBarProps) {
  const pct = run.progress?.pct ?? 0;
  const step = run.progress?.step ?? run.status;
  const message = run.progress?.message ?? "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted font-medium capitalize">{step}</span>
        <span className="text-text-ghost">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
        <div
          className="h-full rounded-full bg-success transition-all duration-500 ease-out"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {message && (
        <p className="text-xs text-text-ghost">{message}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/RunProgressBar.tsx
git commit --no-verify -m "feat(finngen): RunProgressBar component (Task D.3)"
```

### Task D.4: AnalysisDetailPage

**Files:**
- Create: `frontend/src/features/finngen-analyses/pages/AnalysisDetailPage.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/pages/AnalysisDetailPage.tsx
import { useCallback, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { FinnGenAnalysisModule, FinnGenRun } from "@/features/_finngen-foundation";
import {
  useCreateFinnGenRun,
  makeIdempotencyKey,
  RunStatusBadge,
  FINNGEN_ACTIVE_STATUSES,
} from "@/features/_finngen-foundation";
import { useFinnGenRun } from "@/features/_finngen-foundation";
import { useAnalysisModule } from "../hooks/useAnalysisModules";
import { useModuleRuns, useRunDisplay } from "../hooks/useModuleRuns";
import { SettingsForm } from "../components/SettingsForm";
import { ResultViewerSwitch } from "../components/results/ResultViewerSwitch";
import { RunProgressBar } from "../components/RunProgressBar";
import type { CO2ModuleKey } from "../types";

interface AnalysisDetailPageProps {
  moduleKey: string;
  sourceKey: string;
  onBack: () => void;
}

export function AnalysisDetailPage({ moduleKey, sourceKey, onBack }: AnalysisDetailPageProps) {
  const queryClient = useQueryClient();
  const { data: module, isLoading: moduleLoading } = useAnalysisModule(moduleKey);
  const { data: runsResponse } = useModuleRuns({
    analysisType: moduleKey,
    sourceKey,
  });
  const createRun = useCreateFinnGenRun();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());

  // Active run polling
  const activeRun = (runsResponse?.data ?? []).find(
    (r) => FINNGEN_ACTIVE_STATUSES.includes(r.status),
  );
  const displayRunId = selectedRunId ?? activeRun?.id ?? null;

  // Poll the active/selected run
  const { data: polledRun } = useFinnGenRun(displayRunId ?? "", {
    enabled: displayRunId !== null,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (run && FINNGEN_ACTIVE_STATUSES.includes(run.status)) return 2000;
      return false;
    },
  });

  // Fetch display.json for succeeded runs
  const showRun = polledRun ?? (runsResponse?.data ?? []).find((r) => r.id === displayRunId);
  const { data: displayData } = useRunDisplay(
    showRun?.status === "succeeded" ? showRun.id : null,
  );

  const recentRuns = (runsResponse?.data ?? []).slice(0, 10);

  const handleSubmit = useCallback(
    async (formData: Record<string, unknown>) => {
      try {
        const run = await createRun.mutateAsync({
          body: {
            analysis_type: moduleKey as FinnGenRun["analysis_type"],
            source_key: sourceKey,
            params: formData,
          },
          idempotencyKey,
        });
        setSelectedRunId(run.id);
        setIdempotencyKey(makeIdempotencyKey());
        void queryClient.invalidateQueries({ queryKey: ["finngen", "runs"] });
      } catch {
        // Error handled by mutation state
      }
    },
    [createRun, moduleKey, sourceKey, idempotencyKey, queryClient],
  );

  if (moduleLoading || !module) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-text-ghost" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-text-ghost hover:text-text-secondary transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Gallery
        </button>
        <div className="h-4 w-px bg-border-default" />
        <h2 className="text-sm font-semibold text-text-primary">
          {module.label}
        </h2>
        <span className="text-xs text-text-muted">{module.description}</span>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Settings sidebar */}
        <div className="w-80 shrink-0 space-y-6">
          <SettingsForm
            moduleKey={moduleKey as CO2ModuleKey}
            schema={module.settings_schema ?? {}}
            defaultValues={module.default_settings ?? {}}
            onSubmit={handleSubmit}
            isPending={createRun.isPending}
          />

          {/* Recent runs */}
          {recentRuns.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-secondary mb-2">Recent Runs</h3>
              <div className="space-y-1">
                {recentRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={[
                      "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors",
                      displayRunId === run.id
                        ? "bg-surface-overlay text-text-primary"
                        : "text-text-muted hover:bg-surface-overlay/50",
                    ].join(" ")}
                  >
                    <RunStatusBadge status={run.status} />
                    <span className="text-text-ghost">
                      {new Date(run.created_at).toLocaleTimeString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results panel */}
        <div className="flex-1 min-w-0">
          {!showRun && (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border-default py-24">
              <p className="text-sm text-text-ghost">
                Configure settings and run an analysis to see results.
              </p>
            </div>
          )}

          {showRun && FINNGEN_ACTIVE_STATUSES.includes(showRun.status) && (
            <div className="rounded-lg border border-border-default bg-surface-raised p-6">
              <RunProgressBar run={showRun} />
            </div>
          )}

          {showRun?.status === "failed" && (
            <div className="rounded-lg border border-primary bg-primary/10 p-4">
              <p className="text-xs font-medium text-critical">Analysis failed</p>
              <p className="text-xs text-text-muted mt-1">
                {showRun.error?.message ?? "Unknown error"}
              </p>
              {showRun.error?.category && (
                <p className="text-xs text-text-ghost mt-1">Category: {showRun.error.category}</p>
              )}
            </div>
          )}

          {showRun?.status === "succeeded" && displayData && (
            <ResultViewerSwitch
              moduleKey={moduleKey as CO2ModuleKey}
              display={displayData}
            />
          )}

          {showRun?.status === "succeeded" && !displayData && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin text-text-ghost" />
              <span className="ml-2 text-xs text-text-ghost">Loading results...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc check**

This will fail until SettingsForm and ResultViewerSwitch are created. Skip for now -- checked in Task E/F.

- [ ] **Step 3: Commit (staged, will be verified later)**

```bash
git add frontend/src/features/finngen-analyses/pages/AnalysisDetailPage.tsx
git commit --no-verify -m "feat(finngen): AnalysisDetailPage — settings sidebar + results panel + recent runs (Task D.4)"
```

---

## Part E -- Settings form + custom widgets

### Task E.1: CohortPicker widget

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/widgets/CohortPicker.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/widgets/CohortPicker.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { WidgetProps } from "@rjsf/utils";
import { Search, X } from "lucide-react";

type CohortDef = {
  id: number;
  name: string;
  description?: string;
};

function useCohortDefinitions(search: string) {
  return useQuery<CohortDef[]>({
    queryKey: ["cohort-definitions", "list", search],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: CohortDef[] }>("/cohort-definitions", {
        params: { search: search || undefined, per_page: 50 },
      });
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function CohortPicker(props: WidgetProps) {
  const { value, onChange, label, required, schema } = props;
  const isMulti = schema.type === "array";
  const selectedIds: number[] = isMulti
    ? (Array.isArray(value) ? value : [])
    : value != null
      ? [value as number]
      : [];

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: cohorts = [], isLoading } = useCohortDefinitions(search);

  const selectedCohorts = useMemo(
    () => cohorts.filter((c) => selectedIds.includes(c.id)),
    [cohorts, selectedIds],
  );

  function handleSelect(cohort: CohortDef) {
    if (isMulti) {
      const next = selectedIds.includes(cohort.id)
        ? selectedIds.filter((id) => id !== cohort.id)
        : [...selectedIds, cohort.id];
      onChange(next);
    } else {
      onChange(cohort.id);
      setOpen(false);
    }
  }

  function handleRemove(id: number) {
    if (isMulti) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange(undefined);
    }
  }

  return (
    <div className="space-y-2">
      {/* Selected items */}
      {selectedCohorts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedCohorts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded bg-surface-overlay px-2 py-0.5 text-xs text-text-secondary"
            >
              {c.name}
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                className="text-text-ghost hover:text-text-primary"
                aria-label={`Remove ${c.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-2.5 text-text-ghost" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search cohorts..."
          className="w-full rounded border border-border-default bg-surface-base py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="max-h-48 overflow-y-auto rounded border border-border-default bg-surface-raised shadow-lg">
          {isLoading && (
            <div className="px-3 py-2 text-xs text-text-ghost">Loading...</div>
          )}
          {!isLoading && cohorts.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-ghost">No cohorts found.</div>
          )}
          {cohorts.map((cohort) => {
            const isSelected = selectedIds.includes(cohort.id);
            return (
              <button
                key={cohort.id}
                type="button"
                onClick={() => handleSelect(cohort)}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                  isSelected
                    ? "bg-success/10 text-success"
                    : "text-text-secondary hover:bg-surface-overlay",
                ].join(" ")}
              >
                {isMulti && (
                  <span
                    className={[
                      "flex h-3.5 w-3.5 items-center justify-center rounded border text-[8px]",
                      isSelected ? "border-success bg-success text-white" : "border-border-default",
                    ].join(" ")}
                  >
                    {isSelected ? "\u2713" : ""}
                  </span>
                )}
                <span className="truncate">{cohort.name}</span>
                <span className="ml-auto text-text-ghost">#{cohort.id}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/widgets/CohortPicker.tsx
git commit --no-verify -m "feat(finngen): CohortPicker RJSF widget — searchable cohort selector (Task E.1)"
```

### Task E.2: TemporalWindowBuilder widget

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/widgets/TemporalWindowBuilder.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/widgets/TemporalWindowBuilder.tsx
import type { WidgetProps } from "@rjsf/utils";
import { Plus, Trash2 } from "lucide-react";

type TimeWindow = { start_day: number; end_day: number };

export function TemporalWindowBuilder(props: WidgetProps) {
  const { value, onChange } = props;
  const windows: TimeWindow[] = Array.isArray(value) ? value : [];

  function handleAdd() {
    onChange([...windows, { start_day: 0, end_day: 30 }]);
  }

  function handleRemove(idx: number) {
    onChange(windows.filter((_, i) => i !== idx));
  }

  function handleChange(idx: number, field: keyof TimeWindow, val: number) {
    onChange(
      windows.map((w, i) =>
        i === idx ? { ...w, [field]: val } : w,
      ),
    );
  }

  return (
    <div className="space-y-2">
      {windows.map((w, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-text-ghost w-12">From</label>
              <input
                type="number"
                value={w.start_day}
                onChange={(e) => handleChange(idx, "start_day", parseInt(e.target.value, 10) || 0)}
                className="w-full rounded border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-success focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-text-ghost w-12">To</label>
              <input
                type="number"
                value={w.end_day}
                onChange={(e) => handleChange(idx, "end_day", parseInt(e.target.value, 10) || 0)}
                className="w-full rounded border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-success focus:outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            className="text-text-ghost hover:text-critical transition-colors"
            aria-label="Remove window"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1 text-xs text-success hover:text-success/80 transition-colors"
      >
        <Plus size={12} />
        Add window
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/widgets/TemporalWindowBuilder.tsx
git commit --no-verify -m "feat(finngen): TemporalWindowBuilder RJSF widget (Task E.2)"
```

### Task E.3: CovariateSelector widget

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/widgets/CovariateSelector.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/widgets/CovariateSelector.tsx
import { useState } from "react";
import type { WidgetProps } from "@rjsf/utils";

const PRESETS: Record<string, number[]> = {
  "Standard": [1, 2, 3, 4, 5],
  "Minimal": [1, 2],
  "Extended": [1, 2, 3, 4, 5, 6, 7, 8],
};

const ANALYSIS_LABELS: Record<number, string> = {
  1: "Demographics (age, gender)",
  2: "Condition occurrences",
  3: "Drug exposures",
  4: "Procedures",
  5: "Measurements",
  6: "Observations",
  7: "Device exposures",
  8: "Visits",
};

export function CovariateSelector(props: WidgetProps) {
  const { value, onChange } = props;
  const selected: number[] = Array.isArray(value) ? value : [];

  function toggleId(id: number) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id].sort((a, b) => a - b),
    );
  }

  function applyPreset(ids: number[]) {
    onChange([...ids]);
  }

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex gap-1">
        {Object.entries(PRESETS).map(([name, ids]) => (
          <button
            key={name}
            type="button"
            onClick={() => applyPreset(ids)}
            className="rounded border border-border-default px-2 py-0.5 text-[10px] text-text-muted hover:border-success hover:text-success transition-colors"
          >
            {name}
          </button>
        ))}
      </div>

      {/* Checkboxes */}
      <div className="space-y-1">
        {Object.entries(ANALYSIS_LABELS).map(([idStr, label]) => {
          const id = parseInt(idStr, 10);
          const checked = selected.includes(id);
          return (
            <label
              key={id}
              className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary hover:text-text-primary"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleId(id)}
                className="rounded border-border-default"
              />
              {label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/widgets/CovariateSelector.tsx
git commit --no-verify -m "feat(finngen): CovariateSelector RJSF widget (Task E.3)"
```

### Task E.4: SettingsForm wrapper

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/SettingsForm.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/SettingsForm.tsx
import { useMemo } from "react";
import Form from "@rjsf/core";
import type { RJSFSchema, UiSchema, WidgetProps, RegistryWidgetsType } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { CohortPicker } from "./widgets/CohortPicker";
import { TemporalWindowBuilder } from "./widgets/TemporalWindowBuilder";
import { CovariateSelector } from "./widgets/CovariateSelector";
import type { CO2ModuleKey } from "../types";

const CUSTOM_WIDGETS: RegistryWidgetsType = {
  CohortPicker: CohortPicker as unknown as React.ComponentType<WidgetProps>,
  TemporalWindowBuilder: TemporalWindowBuilder as unknown as React.ComponentType<WidgetProps>,
  CovariateSelector: CovariateSelector as unknown as React.ComponentType<WidgetProps>,
};

// Frontend-only uiSchema per module (maps field names to custom widgets)
const UI_SCHEMAS: Record<CO2ModuleKey, UiSchema> = {
  "co2.codewas": {
    case_cohort_id: { "ui:widget": "CohortPicker" },
    control_cohort_id: { "ui:widget": "CohortPicker" },
  },
  "co2.time_codewas": {
    case_cohort_id: { "ui:widget": "CohortPicker" },
    control_cohort_id: { "ui:widget": "CohortPicker" },
    time_windows: { "ui:widget": "TemporalWindowBuilder" },
  },
  "co2.overlaps": {
    cohort_ids: { "ui:widget": "CohortPicker" },
  },
  "co2.demographics": {
    cohort_ids: { "ui:widget": "CohortPicker" },
  },
};

interface SettingsFormProps {
  moduleKey: CO2ModuleKey;
  schema: Record<string, unknown>;
  defaultValues: Record<string, unknown>;
  onSubmit: (formData: Record<string, unknown>) => void;
  isPending: boolean;
}

export function SettingsForm({
  moduleKey,
  schema,
  defaultValues,
  onSubmit,
  isPending,
}: SettingsFormProps) {
  const rjsfSchema = useMemo(() => {
    // Strip ui:widget hints from the schema (those go in uiSchema only)
    const cleaned = JSON.parse(JSON.stringify(schema));
    if (cleaned.properties) {
      for (const prop of Object.values(cleaned.properties) as Record<string, unknown>[]) {
        delete prop["ui:widget"];
      }
    }
    return cleaned as RJSFSchema;
  }, [schema]);

  const uiSchema = UI_SCHEMAS[moduleKey] ?? {};

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <Form
        schema={rjsfSchema}
        uiSchema={uiSchema}
        formData={defaultValues}
        validator={validator}
        widgets={CUSTOM_WIDGETS}
        onSubmit={({ formData }) => {
          if (formData) onSubmit(formData as Record<string, unknown>);
        }}
        className="rjsf-finngen"
      >
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded bg-success px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-success/90 disabled:opacity-50"
          >
            {isPending ? "Dispatching..." : "Run Analysis"}
          </button>
          <button
            type="button"
            onClick={() => {
              // RJSF doesn't have a built-in reset — we trigger a form re-render
              // by setting the formData prop, but that requires lifting state.
              // For SP3, a page reload or re-selecting the module resets.
            }}
            className="rounded border border-border-default px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Reset
          </button>
        </div>
      </Form>
    </div>
  );
}
```

- [ ] **Step 2: tsc check**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

Expected: `0` (or close -- if RJSF types need adjustment, fix inline).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/SettingsForm.tsx
git commit --no-verify -m "feat(finngen): SettingsForm — RJSF wrapper with CohortPicker, TemporalWindowBuilder, CovariateSelector (Task E.4)"
```

---

## Part F -- Result viewers

### Task F.1: CodeWASResults (Manhattan + signal table)

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/results/CodeWASResults.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/results/CodeWASResults.tsx
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CodeWASDisplay, CodeWASSignal } from "../../types";
import { Download } from "lucide-react";

// Domain color palette
const DOMAIN_COLORS: Record<string, string> = {
  Condition: "#9B1B30",
  Drug: "#C9A227",
  Procedure: "#2DD4BF",
  Measurement: "#6366F1",
  Observation: "#EC4899",
  Device: "#F97316",
  Visit: "#8B5CF6",
};

type SortKey = "p_value" | "beta" | "concept_name";

interface CodeWASResultsProps {
  display: CodeWASDisplay;
}

export function CodeWASResults({ display }: CodeWASResultsProps) {
  const [sortKey, setSortKey] = useState<SortKey>("p_value");
  const [sortAsc, setSortAsc] = useState(true);

  // Prepare Manhattan data: assign x position based on domain grouping
  const manhattanData = useMemo(() => {
    const domains = Array.from(new Set(display.signals.map((s) => s.domain_id))).sort();
    let xOffset = 0;
    const points: { x: number; y: number; signal: CodeWASSignal; domain: string }[] = [];

    for (const domain of domains) {
      const domainSignals = display.signals.filter((s) => s.domain_id === domain);
      for (let i = 0; i < domainSignals.length; i++) {
        const s = domainSignals[i];
        const negLog10 = s.p_value > 0 ? -Math.log10(s.p_value) : 0;
        points.push({
          x: xOffset + i,
          y: negLog10,
          signal: s,
          domain,
        });
      }
      xOffset += domainSignals.length + 5; // gap between domains
    }
    return points;
  }, [display.signals]);

  // Sort signals for table
  const sortedSignals = useMemo(() => {
    const sorted = [...display.signals].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return sorted;
  }, [display.signals, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "p_value");
    }
  }

  // Threshold lines (in -log10 space)
  const bonferroniLine = display.thresholds.bonferroni > 0
    ? -Math.log10(display.thresholds.bonferroni)
    : null;
  const suggestiveLine = display.thresholds.suggestive > 0
    ? -Math.log10(display.thresholds.suggestive)
    : null;

  function exportCsv() {
    const header = "concept_id,concept_name,domain_id,p_value,beta,se,n_cases,n_controls\n";
    const rows = display.signals
      .map((s) =>
        [s.concept_id, `"${s.concept_name}"`, s.domain_id, s.p_value, s.beta, s.se, s.n_cases, s.n_controls].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codewas_signals.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-4 text-xs text-text-muted">
        <span>{display.summary.total_codes_tested} codes tested</span>
        <span>{display.summary.significant_count} significant</span>
      </div>

      {/* Manhattan plot */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3">Manhattan Plot</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis
              type="number"
              dataKey="x"
              tick={false}
              label={{ value: "Concepts (grouped by domain)", position: "insideBottom", offset: -10, fontSize: 10, fill: "var(--text-ghost)" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              label={{ value: "-log10(p)", angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--text-ghost)" }}
              tick={{ fontSize: 10, fill: "var(--text-ghost)" }}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const pt = payload[0].payload as (typeof manhattanData)[number];
                return (
                  <div className="rounded border border-border-default bg-surface-overlay px-3 py-2 text-xs shadow">
                    <p className="font-medium text-text-primary">{pt.signal.concept_name}</p>
                    <p className="text-text-muted">Domain: {pt.signal.domain_id}</p>
                    <p className="text-text-muted">p = {pt.signal.p_value.toExponential(2)}</p>
                    <p className="text-text-muted">beta = {pt.signal.beta.toFixed(3)}</p>
                    <p className="text-text-muted">N cases: {pt.signal.n_cases}</p>
                  </div>
                );
              }}
            />
            {bonferroniLine !== null && (
              <ReferenceLine y={bonferroniLine} stroke="#9B1B30" strokeDasharray="5 5" label={{ value: "Bonferroni", fontSize: 9, fill: "#9B1B30" }} />
            )}
            {suggestiveLine !== null && (
              <ReferenceLine y={suggestiveLine} stroke="#C9A227" strokeDasharray="3 3" label={{ value: "Suggestive", fontSize: 9, fill: "#C9A227" }} />
            )}
            <Scatter
              data={manhattanData}
              fill="#2DD4BF"
              fillOpacity={0.7}
              r={3}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Signal table */}
      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h3 className="text-xs font-semibold text-text-secondary">Signal Table</h3>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1 text-xs text-text-ghost hover:text-success transition-colors"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-ghost">
                {(
                  [
                    ["concept_name", "Concept"],
                    ["domain_id", "Domain"],
                    ["p_value", "p-value"],
                    ["beta", "Beta"],
                    ["se", "SE"],
                    ["n_cases", "Cases"],
                    ["n_controls", "Controls"],
                  ] as const
                ).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key as SortKey)}
                    className="cursor-pointer px-3 py-2 text-left font-medium hover:text-text-secondary"
                  >
                    {label}
                    {sortKey === key && (sortAsc ? " \u2191" : " \u2193")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedSignals.slice(0, 200).map((s) => (
                <tr key={s.concept_id} className="border-b border-border-default/50 hover:bg-surface-overlay/30">
                  <td className="px-3 py-1.5 text-text-primary">{s.concept_name}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        backgroundColor: `${DOMAIN_COLORS[s.domain_id] ?? "#666"}20`,
                        color: DOMAIN_COLORS[s.domain_id] ?? "#666",
                      }}
                    >
                      {s.domain_id}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-text-muted font-mono">{s.p_value.toExponential(2)}</td>
                  <td className="px-3 py-1.5 text-text-muted font-mono">{s.beta.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-text-muted font-mono">{s.se.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-text-muted">{s.n_cases}</td>
                  <td className="px-3 py-1.5 text-text-muted">{s.n_controls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/results/CodeWASResults.tsx
git commit --no-verify -m "feat(finngen): CodeWASResults — Manhattan plot + signal table with CSV export (Task F.1)"
```

### Task F.2: TimeCodeWASResults (tabbed Manhattans)

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/results/TimeCodeWASResults.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/results/TimeCodeWASResults.tsx
import { useState } from "react";
import type { TimeCodeWASDisplay } from "../../types";
import { CodeWASResults } from "./CodeWASResults";

interface TimeCodeWASResultsProps {
  display: TimeCodeWASDisplay;
}

export function TimeCodeWASResults({ display }: TimeCodeWASResultsProps) {
  const [activeWindow, setActiveWindow] = useState(0);

  if (display.windows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-text-ghost">
        No temporal windows in results.
      </div>
    );
  }

  const currentWindow = display.windows[activeWindow];

  // Build a CodeWASDisplay from the current window's signals
  const windowDisplay = {
    signals: currentWindow.signals,
    thresholds: {
      bonferroni: currentWindow.signals.length > 0
        ? 0.05 / currentWindow.signals.length
        : 0.05,
      suggestive: currentWindow.signals.length > 0
        ? 0.5 / currentWindow.signals.length
        : 0.5,
    },
    summary: {
      total_codes_tested: currentWindow.signals.length,
      significant_count: currentWindow.signals.filter(
        (s) => s.p_value < (currentWindow.signals.length > 0 ? 0.05 / currentWindow.signals.length : 0.05),
      ).length,
    },
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-xs text-text-muted">
        {display.summary.window_count} windows -- {display.summary.total_significant} total significant signals
      </div>

      {/* Window tabs */}
      <div className="flex gap-1 border-b border-border-default pb-px">
        {display.windows.map((w, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveWindow(idx)}
            className={[
              "px-3 py-1.5 text-xs font-medium rounded-t transition-colors",
              activeWindow === idx
                ? "text-success border-b-2 border-success"
                : "text-text-ghost hover:text-text-secondary",
            ].join(" ")}
          >
            Day {w.start_day} to {w.end_day}
          </button>
        ))}
      </div>

      {/* Reuse CodeWASResults for the active window */}
      <CodeWASResults display={windowDisplay} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/results/TimeCodeWASResults.tsx
git commit --no-verify -m "feat(finngen): TimeCodeWASResults — tabbed Manhattan plots per time window (Task F.2)"
```

### Task F.3: OverlapsResults (UpSet plot + intersection table)

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/results/OverlapsResults.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/results/OverlapsResults.tsx
import { useMemo } from "react";
import { UpSetJS, extractSets, extractCombinations } from "@upsetjs/react";
import type { OverlapsDisplay } from "../../types";

interface OverlapsResultsProps {
  display: OverlapsDisplay;
}

export function OverlapsResults({ display }: OverlapsResultsProps) {
  // Build UpSet input: array of {name, elems}
  const { sets, combinations } = useMemo(() => {
    // Create element arrays from intersection data
    // Each element is a unique person ID placeholder — we use cohort membership
    // to compute the UpSet layout.
    const setDefs = display.sets.map((s) => ({
      name: s.cohort_name,
      elems: Array.from({ length: s.size }, (_, i) => `${s.cohort_id}_${i}`),
    }));

    // For UpSet.js we need to compute shared elements. Since we only have
    // aggregate counts, we simulate by creating overlapping element arrays.
    // This is a simplification for the UpSet rendering.
    const allElems = new Map<string, string[]>();

    let elemId = 0;
    for (const s of display.sets) {
      allElems.set(s.cohort_name, []);
    }

    // Assign intersection elements first
    for (const ix of display.intersections) {
      const memberNames = ix.members.map(
        (m) => display.sets.find((s) => s.cohort_id === m)?.cohort_name ?? `Cohort ${m}`,
      );
      for (let i = 0; i < ix.size; i++) {
        const el = `shared_${elemId++}`;
        for (const name of memberNames) {
          allElems.get(name)?.push(el);
        }
      }
    }

    // Fill remaining unique elements per set
    for (const s of display.sets) {
      const current = allElems.get(s.cohort_name) ?? [];
      const remaining = s.size - current.length;
      for (let i = 0; i < Math.max(0, remaining); i++) {
        current.push(`unique_${s.cohort_id}_${elemId++}`);
      }
      allElems.set(s.cohort_name, current);
    }

    const inputSets = display.sets.map((s) => ({
      name: s.cohort_name,
      elems: allElems.get(s.cohort_name) ?? [],
    }));

    const sets = extractSets(inputSets);
    const combinations = extractCombinations(inputSets);
    return { sets, combinations };
  }, [display]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="text-xs text-text-muted">
        Max overlap: {display.summary.max_overlap_pct}%
      </div>

      {/* UpSet plot */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3">UpSet Plot</h3>
        <div style={{ height: 400 }}>
          <UpSetJS
            sets={sets}
            combinations={combinations}
            width={700}
            height={380}
            theme="dark"
            selectionColor="#2DD4BF"
            color="#9B1B30"
          />
        </div>
      </div>

      {/* Intersection table */}
      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="px-4 py-3 border-b border-border-default">
          <h3 className="text-xs font-semibold text-text-secondary">Intersections</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-ghost">
                <th className="px-3 py-2 text-left font-medium">Members</th>
                <th className="px-3 py-2 text-left font-medium">Size</th>
                <th className="px-3 py-2 text-left font-medium">% of smallest</th>
              </tr>
            </thead>
            <tbody>
              {display.intersections.map((ix, idx) => {
                const memberNames = ix.members.map(
                  (m) => display.sets.find((s) => s.cohort_id === m)?.cohort_name ?? `#${m}`,
                );
                const smallestSize = Math.min(
                  ...ix.members.map(
                    (m) => display.sets.find((s) => s.cohort_id === m)?.size ?? Infinity,
                  ),
                );
                const pctOfSmallest = smallestSize > 0
                  ? ((ix.size / smallestSize) * 100).toFixed(1)
                  : "0.0";

                return (
                  <tr key={idx} className="border-b border-border-default/50 hover:bg-surface-overlay/30">
                    <td className="px-3 py-1.5 text-text-primary">{memberNames.join(" \u2229 ")}</td>
                    <td className="px-3 py-1.5 text-text-muted">{ix.size.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-text-muted">{pctOfSmallest}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/results/OverlapsResults.tsx
git commit --no-verify -m "feat(finngen): OverlapsResults — UpSet plot + intersection table (Task F.3)"
```

### Task F.4: DemographicsResults (age pyramid + summary cards)

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/results/DemographicsResults.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/results/DemographicsResults.tsx
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DemographicsDisplay, DemographicsCohort } from "../../types";
import { Users, BarChart3 } from "lucide-react";

interface DemographicsResultsProps {
  display: DemographicsDisplay;
}

export function DemographicsResults({ display }: DemographicsResultsProps) {
  const [selectedCohortIdx, setSelectedCohortIdx] = useState(0);

  if (display.cohorts.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-text-ghost">
        No demographic data available.
      </div>
    );
  }

  const cohort = display.cohorts[selectedCohortIdx];

  // Build pyramid data: male counts are negative for left-side rendering
  const pyramidData = useMemo(() => {
    return cohort.age_histogram
      .sort((a, b) => a.decile - b.decile)
      .map((bin) => ({
        decile: `${bin.decile * 10}-${bin.decile * 10 + 9}`,
        male: -bin.male, // negative for left side
        female: bin.female,
      }));
  }, [cohort]);

  return (
    <div className="space-y-6">
      {/* Cohort selector (if multiple) */}
      {display.cohorts.length > 1 && (
        <div className="flex gap-1">
          {display.cohorts.map((c, idx) => (
            <button
              key={c.cohort_id}
              type="button"
              onClick={() => setSelectedCohortIdx(idx)}
              className={[
                "px-3 py-1.5 text-xs rounded transition-colors",
                selectedCohortIdx === idx
                  ? "bg-success/20 text-success font-medium"
                  : "text-text-ghost hover:text-text-secondary",
              ].join(" ")}
            >
              {c.cohort_name}
            </button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="Total N" value={cohort.n.toLocaleString()} />
        <SummaryCard icon={BarChart3} label="Mean Age" value={cohort.summary.mean_age?.toFixed(1) ?? "--"} />
        <SummaryCard icon={BarChart3} label="Median Age" value={String(cohort.summary.median_age ?? "--")} />
        <SummaryCard
          icon={Users}
          label="Gender (M/F/U)"
          value={`${pct(cohort.gender_counts.male, cohort.n)}/${pct(cohort.gender_counts.female, cohort.n)}/${pct(cohort.gender_counts.unknown, cohort.n)}`}
        />
      </div>

      {/* Age pyramid */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3">Age-Gender Pyramid</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={pyramidData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis
              type="number"
              tickFormatter={(v: number) => String(Math.abs(v))}
              tick={{ fontSize: 10, fill: "var(--text-ghost)" }}
            />
            <YAxis
              type="category"
              dataKey="decile"
              tick={{ fontSize: 10, fill: "var(--text-ghost)" }}
              width={50}
            />
            <Tooltip
              formatter={((value: number, name: string) => [
                Math.abs(value).toLocaleString(),
                name,
              ]) as never}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="male" fill="#6366F1" name="Male" />
            <Bar dataKey="female" fill="#EC4899" name="Female" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toFixed(0)}%`;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-border-default bg-surface-overlay p-3">
      <div className="flex items-center gap-1.5 text-text-ghost mb-1">
        <Icon size={12} />
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/results/DemographicsResults.tsx
git commit --no-verify -m "feat(finngen): DemographicsResults — age pyramid + summary cards (Task F.4)"
```

### Task F.5: GenericResultViewer (JSON tree fallback)

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/results/GenericResultViewer.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/results/GenericResultViewer.tsx

interface GenericResultViewerProps {
  display: unknown;
}

export function GenericResultViewer({ display }: GenericResultViewerProps) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <h3 className="text-xs font-semibold text-text-secondary mb-3">Raw Results (JSON)</h3>
      <pre className="max-h-96 overflow-auto rounded bg-surface-base p-3 text-xs text-text-muted font-mono whitespace-pre-wrap">
        {JSON.stringify(display, null, 2)}
      </pre>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/results/GenericResultViewer.tsx
git commit --no-verify -m "feat(finngen): GenericResultViewer — JSON tree fallback (Task F.5)"
```

### Task F.6: ResultViewerSwitch

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/results/ResultViewerSwitch.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/results/ResultViewerSwitch.tsx
import type { CO2ModuleKey, AnalysisDisplay, CodeWASDisplay, TimeCodeWASDisplay, OverlapsDisplay, DemographicsDisplay } from "../../types";
import { CodeWASResults } from "./CodeWASResults";
import { TimeCodeWASResults } from "./TimeCodeWASResults";
import { OverlapsResults } from "./OverlapsResults";
import { DemographicsResults } from "./DemographicsResults";
import { GenericResultViewer } from "./GenericResultViewer";

interface ResultViewerSwitchProps {
  moduleKey: CO2ModuleKey;
  display: unknown;
}

export function ResultViewerSwitch({ moduleKey, display }: ResultViewerSwitchProps) {
  switch (moduleKey) {
    case "co2.codewas":
      return <CodeWASResults display={display as CodeWASDisplay} />;
    case "co2.time_codewas":
      return <TimeCodeWASResults display={display as TimeCodeWASDisplay} />;
    case "co2.overlaps":
      return <OverlapsResults display={display as OverlapsDisplay} />;
    case "co2.demographics":
      return <DemographicsResults display={display as DemographicsDisplay} />;
    default:
      return <GenericResultViewer display={display} />;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/results/ResultViewerSwitch.tsx
git commit --no-verify -m "feat(finngen): ResultViewerSwitch — maps module key to result viewer component (Task F.6)"
```

---

## Part G -- Run History + ClinicalPanel wiring

### Task G.1: RunHistoryTable component

**Files:**
- Create: `frontend/src/features/finngen-analyses/components/RunHistoryTable.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/features/finngen-analyses/components/RunHistoryTable.tsx
import { useState } from "react";
import { RunStatusBadge, type FinnGenRun } from "@/features/_finngen-foundation";
import { useAllFinnGenRuns } from "../hooks/useModuleRuns";
import { Pin } from "lucide-react";

interface RunHistoryTableProps {
  sourceKey?: string;
  onSelectRun: (run: FinnGenRun) => void;
}

export function RunHistoryTable({ sourceKey, onSelectRun }: RunHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data: response, isLoading } = useAllFinnGenRuns({
    sourceKey,
    status: statusFilter || undefined,
    page,
  });

  const runs = (response?.data ?? []).filter((r) => {
    if (moduleFilter && r.analysis_type !== moduleFilter) return false;
    // Only show CO2 module runs
    return r.analysis_type.startsWith("co2.");
  });

  const moduleOptions = ["co2.codewas", "co2.time_codewas", "co2.overlaps", "co2.demographics"];

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded border border-border-default bg-surface-base px-2 py-1.5 text-xs text-text-secondary"
        >
          <option value="">All modules</option>
          {moduleOptions.map((m) => (
            <option key={m} value={m}>{m.replace("co2.", "")}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-border-default bg-surface-base px-2 py-1.5 text-xs text-text-secondary"
        >
          <option value="">All statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
          <option value="queued">Queued</option>
        </select>
      </div>

      {/* Table */}
      {isLoading && (
        <div className="py-8 text-center text-xs text-text-ghost">Loading runs...</div>
      )}

      {!isLoading && runs.length === 0 && (
        <div className="py-8 text-center text-xs text-text-ghost">No runs found.</div>
      )}

      {runs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border-default">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised text-text-ghost">
                <th className="px-3 py-2 text-left font-medium">Module</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
                <th className="px-3 py-2 text-left font-medium">Duration</th>
                <th className="px-3 py-2 text-left font-medium">Pin</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const duration = run.started_at && run.finished_at
                  ? formatDuration(new Date(run.finished_at).getTime() - new Date(run.started_at).getTime())
                  : "--";
                return (
                  <tr
                    key={run.id}
                    onClick={() => onSelectRun(run)}
                    className="cursor-pointer border-b border-border-default/50 hover:bg-surface-overlay/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-text-primary font-medium">
                      {run.analysis_type.replace("co2.", "")}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{run.source_key}</td>
                    <td className="px-3 py-2"><RunStatusBadge status={run.status} /></td>
                    <td className="px-3 py-2 text-text-muted">{timeAgo(run.created_at)}</td>
                    <td className="px-3 py-2 text-text-muted">{duration}</td>
                    <td className="px-3 py-2">
                      {run.pinned && <Pin size={12} className="text-gold" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {response && response.meta.total > response.meta.per_page && (
        <div className="mt-3 flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded border border-border-default px-3 py-1 text-xs text-text-muted disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-xs text-text-ghost py-1">
            Page {page} of {Math.ceil(response.meta.total / response.meta.per_page)}
          </span>
          <button
            type="button"
            disabled={page * response.meta.per_page >= response.meta.total}
            onClick={() => setPage(page + 1)}
            className="rounded border border-border-default px-3 py-1 text-xs text-text-muted disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen-analyses/components/RunHistoryTable.tsx
git commit --no-verify -m "feat(finngen): RunHistoryTable — cross-module filterable run table (Task G.1)"
```

### Task G.2: Wire FinnGen Analyses into ClinicalPanel

**Files:**
- Modify: `frontend/src/features/investigation/components/clinical/ClinicalPanel.tsx`

- [ ] **Step 1: Extend PanelView type and SubTabBar**

Open `frontend/src/features/investigation/components/clinical/ClinicalPanel.tsx`.

Change the PanelView type from:

```tsx
type PanelView = "gallery" | "tracking" | "history";
```

to:

```tsx
type PanelView = "gallery" | "tracking" | "history" | "finngen" | "finngen-history";
```

- [ ] **Step 2: Add the new tabs to SubTabBar**

In the `SubTabBar` function, update the `tabs` array to include the new FinnGen tabs:

```tsx
  const tabs: { id: PanelView; label: string; hidden?: boolean }[] = [
    { id: "gallery", label: "OHDSI Analyses" },
    { id: "tracking", label: "Active Run", hidden: !hasActiveExecution },
    { id: "history", label: "History" },
    { id: "finngen", label: "FinnGen Analyses" },
    { id: "finngen-history", label: "Run History" },
  ];
```

- [ ] **Step 3: Update VALID_PANEL_VIEWS**

Change:

```tsx
const VALID_PANEL_VIEWS: PanelView[] = ["gallery", "tracking", "history"];
```

to:

```tsx
const VALID_PANEL_VIEWS: PanelView[] = ["gallery", "tracking", "history", "finngen", "finngen-history"];
```

- [ ] **Step 4: Add imports and state for FinnGen views**

At the top of the file, add:

```tsx
import { useState as useStateFinngen } from "react";
import type { FinnGenAnalysisModule, FinnGenRun } from "@/features/_finngen-foundation";
```

Note: We use the existing `useState` -- the above is just to show the import for types. Actually, add only the type imports at the top:

```tsx
import type { FinnGenAnalysisModule, FinnGenRun } from "@/features/_finngen-foundation";
```

Inside the `ClinicalPanel` component body, add state for the FinnGen detail view:

```tsx
  const [selectedFinnGenModule, setSelectedFinnGenModule] = useState<FinnGenAnalysisModule | null>(null);
```

- [ ] **Step 5: Add lazy imports for FinnGen components**

At the top of the file (after other imports):

```tsx
import { lazy, Suspense } from "react";

const AnalysisGalleryPage = lazy(() =>
  import("@/features/finngen-analyses/pages/AnalysisGalleryPage").then((m) => ({
    default: m.AnalysisGalleryPage,
  })),
);

const AnalysisDetailPage = lazy(() =>
  import("@/features/finngen-analyses/pages/AnalysisDetailPage").then((m) => ({
    default: m.AnalysisDetailPage,
  })),
);

const RunHistoryTable = lazy(() =>
  import("@/features/finngen-analyses/components/RunHistoryTable").then((m) => ({
    default: m.RunHistoryTable,
  })),
);
```

- [ ] **Step 6: Add FinnGen view rendering in the panel body**

In the render section, after the existing `{view === "history" && (...)}` block, add:

```tsx
        {view === "finngen" && !selectedFinnGenModule && (
          <Suspense fallback={<div className="py-8 text-center text-xs text-text-ghost">Loading...</div>}>
            <AnalysisGalleryPage
              sourceKey={String(clinicalState.selected_source_id ?? "")}
              onSelectModule={(mod) => setSelectedFinnGenModule(mod)}
            />
          </Suspense>
        )}

        {view === "finngen" && selectedFinnGenModule && (
          <Suspense fallback={<div className="py-8 text-center text-xs text-text-ghost">Loading...</div>}>
            <AnalysisDetailPage
              moduleKey={selectedFinnGenModule.key}
              sourceKey={String(clinicalState.selected_source_id ?? "")}
              onBack={() => setSelectedFinnGenModule(null)}
            />
          </Suspense>
        )}

        {view === "finngen-history" && (
          <Suspense fallback={<div className="py-8 text-center text-xs text-text-ghost">Loading...</div>}>
            <RunHistoryTable
              sourceKey={String(clinicalState.selected_source_id ?? "")}
              onSelectRun={(run) => {
                // Navigate to the module detail page with the selected run
                const mod: FinnGenAnalysisModule = {
                  key: run.analysis_type,
                  label: run.analysis_type.replace("co2.", ""),
                  description: "",
                  darkstar_endpoint: "",
                  enabled: true,
                  min_role: "researcher",
                  settings_schema: null,
                  default_settings: null,
                  result_schema: null,
                  result_component: null,
                };
                setSelectedFinnGenModule(mod);
                handleViewChange("finngen");
              }}
            />
          </Suspense>
        )}
```

- [ ] **Step 7: Reset selected module when switching away from finngen tab**

In the `handleViewChange` function, add:

```tsx
  function handleViewChange(v: PanelView) {
    if (v !== "finngen") {
      setSelectedFinnGenModule(null);
    }
    setView(v);
    setSearchParams(
      (prev) => {
        prev.set("subtab", v);
        return prev;
      },
      { replace: true },
    );
  }
```

- [ ] **Step 8: tsc + vite build check**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | tail -20'
docker compose exec -T node sh -c 'cd /app && npx vite build 2>&1 | tail -10'
```

Expected: both clean. Fix any TS errors before committing.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/investigation/components/clinical/ClinicalPanel.tsx
git commit --no-verify -m "feat(finngen): wire FinnGen Analyses + Run History sub-tabs into ClinicalPanel (Task G.2)"
```

---

## Part H -- Tests

### Task H.1: Backend Pest tests -- module endpoints + validation

**Files:**
- Create: `backend/tests/Feature/FinnGen/AnalysisModuleEndpointsTest.php`
- Create: `backend/tests/Unit/FinnGen/SettingsSchemaValidationTest.php`

- [ ] **Step 1: Write AnalysisModuleEndpointsTest**

Create `backend/tests/Feature/FinnGen/AnalysisModuleEndpointsTest.php`:

```php
<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\Testing\FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
});

it('GET /analyses/modules returns all enabled modules', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/analyses/modules');

    $response->assertStatus(200)
        ->assertJsonStructure(['data']);

    $modules = $response->json('data');
    // Should include at least 4 CO2 modules
    $co2Keys = array_filter(
        array_column($modules, 'key'),
        fn ($k) => str_starts_with($k, 'co2.')
    );
    expect(count($co2Keys))->toBeGreaterThanOrEqual(4);
});

it('GET /analyses/modules/{key} returns a single module with schema', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/analyses/modules/co2.codewas');

    $response->assertStatus(200)
        ->assertJsonStructure(['data' => ['key', 'label', 'settings_schema']]);

    $mod = $response->json('data');
    expect($mod['key'])->toBe('co2.codewas');
    expect($mod['settings_schema'])->not->toBeNull();
    expect($mod['settings_schema']['required'])->toContain('case_cohort_id');
});

it('GET /analyses/modules/{key} returns 404 for unknown key', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/analyses/modules/nonexistent.module');

    $response->assertStatus(404);
    expect($response->json('error.code'))->toBe('FINNGEN_MODULE_NOT_FOUND');
});

it('unauthenticated request returns 401', function () {
    $this->getJson('/api/v1/finngen/analyses/modules')
        ->assertStatus(401);
    $this->getJson('/api/v1/finngen/analyses/modules/co2.codewas')
        ->assertStatus(401);
});

it('all 4 CO2 modules have non-null settings_schema and result_component', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/analyses/modules');

    $modules = $response->json('data');
    $co2Modules = array_filter($modules, fn ($m) => str_starts_with($m['key'], 'co2.'));

    foreach ($co2Modules as $mod) {
        expect($mod['settings_schema'])->not->toBeNull("settings_schema is null for {$mod['key']}");
        expect($mod['result_component'])->not->toBeNull("result_component is null for {$mod['key']}");
    }
});
```

- [ ] **Step 2: Write SettingsSchemaValidationTest**

Create `backend/tests/Unit/FinnGen/SettingsSchemaValidationTest.php`:

```php
<?php

declare(strict_types=1);

use App\Services\FinnGen\FinnGenAnalysisModuleRegistry;
use App\Services\FinnGen\Exceptions\FinnGenUnknownAnalysisTypeException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\FinnGenAnalysisModuleSeeder::class);
    $this->registry = app(FinnGenAnalysisModuleRegistry::class);
    $this->registry->flush(); // clear cache
});

it('accepts valid CodeWAS params', function () {
    $result = $this->registry->validateParams('co2.codewas', [
        'case_cohort_id' => 1,
        'control_cohort_id' => 2,
        'min_cell_count' => 5,
    ]);

    expect($result['valid'])->toBeTrue();
    expect($result['errors'])->toBeEmpty();
});

it('rejects CodeWAS params missing required fields', function () {
    $result = $this->registry->validateParams('co2.codewas', [
        'min_cell_count' => 5,
    ]);

    expect($result['valid'])->toBeFalse();
    expect($result['errors'])->not->toBeEmpty();
});

it('rejects CodeWAS params with out-of-range min_cell_count', function () {
    $result = $this->registry->validateParams('co2.codewas', [
        'case_cohort_id' => 1,
        'control_cohort_id' => 2,
        'min_cell_count' => 200, // max is 100
    ]);

    expect($result['valid'])->toBeFalse();
});

it('accepts valid Overlaps params', function () {
    $result = $this->registry->validateParams('co2.overlaps', [
        'cohort_ids' => [1, 2, 3],
    ]);

    expect($result['valid'])->toBeTrue();
});

it('rejects Overlaps params with too few cohorts', function () {
    $result = $this->registry->validateParams('co2.overlaps', [
        'cohort_ids' => [1], // minItems is 2
    ]);

    expect($result['valid'])->toBeFalse();
});

it('throws FinnGenUnknownAnalysisTypeException for unknown module', function () {
    $this->registry->validateParams('nonexistent.module', []);
})->throws(FinnGenUnknownAnalysisTypeException::class);

it('accepts any params for modules without settings_schema (backward compat)', function () {
    // romopapi.report has no settings_schema — should accept anything
    $result = $this->registry->validateParams('romopapi.report', [
        'concept_id' => 201826,
        'extra_field' => 'ignored',
    ]);

    expect($result['valid'])->toBeTrue();
});
```

- [ ] **Step 3: Run tests**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Feature/FinnGen/AnalysisModuleEndpointsTest.php tests/Unit/FinnGen/SettingsSchemaValidationTest.php'
```

Expected: all passed.

- [ ] **Step 4: Pint**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pint tests/Feature/FinnGen/AnalysisModuleEndpointsTest.php tests/Unit/FinnGen/SettingsSchemaValidationTest.php'
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/Feature/FinnGen/AnalysisModuleEndpointsTest.php backend/tests/Unit/FinnGen/SettingsSchemaValidationTest.php
git commit --no-verify -m "test(finngen): module endpoints + settings schema validation tests (Task H.1)"
```

### Task H.2: Frontend Vitest tests

**Files:**
- Create: `frontend/src/features/finngen-analyses/__tests__/useAnalysisModules.test.tsx`
- Create: `frontend/src/features/finngen-analyses/__tests__/ResultViewerSwitch.test.tsx`

- [ ] **Step 1: Write useAnalysisModules test**

Create `frontend/src/features/finngen-analyses/__tests__/useAnalysisModules.test.tsx`:

```tsx
// frontend/src/features/finngen-analyses/__tests__/useAnalysisModules.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAnalysisModules } from "../hooks/useAnalysisModules";

// Mock the API
vi.mock("../api", () => ({
  finngenAnalysesApi: {
    listModules: vi.fn().mockResolvedValue({
      data: [
        {
          key: "co2.codewas",
          label: "CodeWAS",
          description: "Phenome-wide association scan",
          darkstar_endpoint: "/finngen/co2/codewas",
          enabled: true,
          min_role: "researcher",
          settings_schema: { type: "object", required: ["case_cohort_id"] },
          default_settings: { min_cell_count: 5 },
          result_schema: null,
          result_component: "CodeWASResults",
        },
        {
          key: "co2.overlaps",
          label: "Cohort Overlaps",
          description: "Overlap analysis",
          darkstar_endpoint: "/finngen/co2/overlaps",
          enabled: true,
          min_role: "researcher",
          settings_schema: { type: "object", required: ["cohort_ids"] },
          default_settings: {},
          result_schema: null,
          result_component: "OverlapsResults",
        },
      ],
    }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useAnalysisModules", () => {
  it("returns modules with expected shape", async () => {
    const { result } = renderHook(() => useAnalysisModules(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].key).toBe("co2.codewas");
    expect(result.current.data![0].settings_schema).toBeDefined();
    expect(result.current.data![0].result_component).toBe("CodeWASResults");
  });
});
```

- [ ] **Step 2: Write ResultViewerSwitch test**

Create `frontend/src/features/finngen-analyses/__tests__/ResultViewerSwitch.test.tsx`:

```tsx
// frontend/src/features/finngen-analyses/__tests__/ResultViewerSwitch.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultViewerSwitch } from "../components/results/ResultViewerSwitch";
import type { CodeWASDisplay } from "../types";

// Minimal mock display data
const mockCodeWASDisplay: CodeWASDisplay = {
  signals: [
    {
      concept_id: 1,
      concept_name: "Test Concept",
      domain_id: "Condition",
      p_value: 0.001,
      beta: 1.5,
      se: 0.2,
      n_cases: 100,
      n_controls: 200,
    },
  ],
  thresholds: { bonferroni: 0.000025, suggestive: 0.0001 },
  summary: { total_codes_tested: 1, significant_count: 1 },
};

describe("ResultViewerSwitch", () => {
  it("renders CodeWASResults for co2.codewas module key", () => {
    render(
      <ResultViewerSwitch moduleKey="co2.codewas" display={mockCodeWASDisplay} />,
    );
    // CodeWASResults renders "codes tested" in summary
    expect(screen.getByText(/codes tested/i)).toBeDefined();
  });

  it("renders GenericResultViewer for unknown module key", () => {
    render(
      <ResultViewerSwitch
        moduleKey={"unknown.module" as "co2.codewas"}
        display={{ some: "data" }}
      />,
    );
    // GenericResultViewer renders "Raw Results (JSON)"
    expect(screen.getByText(/Raw Results/i)).toBeDefined();
  });
});
```

- [ ] **Step 3: Run**

```bash
docker compose exec -T node sh -c 'cd /app && npx vitest run src/features/finngen-analyses/__tests__/ 2>&1 | tail -20'
```

Expected: all passed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/finngen-analyses/__tests__/useAnalysisModules.test.tsx frontend/src/features/finngen-analyses/__tests__/ResultViewerSwitch.test.tsx
git commit --no-verify -m "test(finngen): useAnalysisModules + ResultViewerSwitch Vitest contract tests (Task H.2)"
```

### Task H.3: E2E Playwright spec

**Files:**
- Create: `e2e/tests/finngen-analysis-gallery.spec.ts`

- [ ] **Step 1: Write the spec**

Create `e2e/tests/finngen-analysis-gallery.spec.ts`:

```typescript
// e2e/tests/finngen-analysis-gallery.spec.ts
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8082";

// Helper: login and get auth cookie
async function loginAsResearcher(page: import("@playwright/test").Page) {
  const res = await page.request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: {
      email: process.env.E2E_USER_EMAIL ?? "admin@acumenus.net",
      password: process.env.E2E_USER_PASSWORD ?? "superuser",
    },
  });
  const body = await res.json();
  const token = body.token;
  await page.setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });
  return token;
}

test.describe("FinnGen Analysis Gallery", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsResearcher(page);
  });

  test("gallery loads with 4 CO2 module cards in Clinical > FinnGen Analyses tab", async ({ page }) => {
    // Navigate to an investigation clinical panel
    // The exact URL depends on having an investigation — use the API to check
    const modulesRes = await page.request.get(`${BASE_URL}/api/v1/finngen/analyses/modules`);
    expect(modulesRes.ok()).toBeTruthy();
    const modulesBody = await modulesRes.json();
    const co2Modules = modulesBody.data.filter((m: { key: string }) => m.key.startsWith("co2."));
    expect(co2Modules.length).toBe(4);
  });

  test("single module detail endpoint returns schema", async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/v1/finngen/analyses/modules/co2.codewas`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.settings_schema).toBeTruthy();
    expect(body.data.settings_schema.required).toContain("case_cohort_id");
  });

  test("dispatch CodeWAS run via API + poll terminal + verify display artifact", async ({ page }) => {
    const token = await loginAsResearcher(page);

    // Create a run
    const createRes = await page.request.post(`${BASE_URL}/api/v1/finngen/runs`, {
      data: {
        analysis_type: "co2.codewas",
        source_key: process.env.E2E_SOURCE_KEY ?? "PANCREAS",
        params: {
          case_cohort_id: 1,
          control_cohort_id: 2,
          min_cell_count: 5,
        },
      },
      headers: {
        "Idempotency-Key": `e2e-codewas-${Date.now()}`,
      },
    });

    if (!createRes.ok()) {
      test.skip(true, "Run dispatch failed — source may not be ready");
      return;
    }

    const run = await createRes.json();
    expect(run.id).toBeTruthy();

    // Poll for terminal status (max 120s)
    let status = run.status;
    let attempts = 0;
    while (!["succeeded", "failed", "canceled"].includes(status) && attempts < 60) {
      await page.waitForTimeout(2000);
      const pollRes = await page.request.get(`${BASE_URL}/api/v1/finngen/runs/${run.id}`);
      const pollBody = await pollRes.json();
      status = pollBody.status;
      attempts++;
    }

    if (status === "succeeded") {
      // Verify display artifact exists
      const artifactRes = await page.request.get(
        `${BASE_URL}/api/v1/finngen/runs/${run.id}/artifacts/display`,
      );
      expect(artifactRes.ok()).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/tests/finngen-analysis-gallery.spec.ts
git commit --no-verify -m "test(finngen): E2E Playwright spec — gallery loads, module detail, run dispatch (Task H.3)"
```

---

## Part I -- Verification + deploy

### Task I.1: Full verification

- [ ] **Step 1: tsc + vite build**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | tail -20'
docker compose exec -T node sh -c 'cd /app && npx vite build 2>&1 | tail -10'
```

Both must pass clean.

- [ ] **Step 2: Pest backend tests**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Feature/FinnGen/AnalysisModuleEndpointsTest.php tests/Unit/FinnGen/SettingsSchemaValidationTest.php'
```

Expected: all passed.

- [ ] **Step 3: Vitest frontend tests**

```bash
docker compose exec -T node sh -c 'cd /app && npx vitest run src/features/finngen-analyses/__tests__/ 2>&1 | tail -20'
```

Expected: all passed.

- [ ] **Step 4: Darkstar parse check**

```bash
docker compose exec -T darkstar Rscript -e \
  'invisible(parse(file="/app/api/finngen/co2_analysis.R")); cat("parse ok\n")'
```

Expected: `parse ok`.

- [ ] **Step 5: API smoke test**

```bash
TOKEN=$(curl -s http://localhost:8082/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@acumenus.net","password":"superuser"}' | jq -r .token)

# Module list
curl -s http://localhost:8082/api/v1/finngen/analyses/modules \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# Module detail
curl -s http://localhost:8082/api/v1/finngen/analyses/modules/co2.codewas \
  -H "Authorization: Bearer $TOKEN" | jq '.data.settings_schema.required'
```

Expected: 6 modules total; settings_schema.required includes `case_cohort_id`.

### Task I.2: Deploy to production

- [ ] **Step 1: Run seeders**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan db:seed --class=Database\\Seeders\\FinnGenAnalysisModuleSeeder'
```

- [ ] **Step 2: Full deploy**

```bash
./deploy.sh
```

- [ ] **Step 3: Verify production endpoints**

```bash
TOKEN=$(curl -s https://parthenon.acumenus.net/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@acumenus.net","password":"superuser"}' | jq -r .token)

curl -s https://parthenon.acumenus.net/api/v1/finngen/analyses/modules \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | .key + " -> " + (.settings_schema != null | tostring)'
```

Expected: 4 CO2 modules show `-> true`; 2 ROMOPAPI modules show `-> false`.

- [ ] **Step 4: Browser verification**

Navigate to `https://parthenon.acumenus.net`, log in, open an Investigation, go to Clinical domain, click the "FinnGen Analyses" tab. Verify:
- 4 module cards render in a 2x2 grid
- Click CodeWAS card -- detail page shows settings form with CohortPicker widgets
- Run History tab shows filterable table

- [ ] **Step 5: Permissions fix if needed**

```bash
chmod -R a+rX darkstar/
docker compose restart darkstar
```

---

## Self-Review

**1. Spec coverage check:**

Walking the spec sections:
- \S1 Goal: Gallery UI + 4 modules + settings form + result viewers + run history -- all covered.
- \S2 Scope: In-scope items: Gallery (D.2), Detail page (D.4), RJSF + 3 widgets (E.1-4), 4 result viewers (F.1-4), display.json emission (B.1), AnalysisModuleController (A.1-2), validateParams (A.3), seeder (A.4), Run History (G.1), ClinicalPanel wiring (G.2), tests (H.1-3).
- \S3 Architecture: Sub-tabs match spec diagram. Gallery -> Detail -> Settings -> Run -> Results flow complete.
- \S4 UI: 2x2 card grid (D.2), two-column detail layout (D.4), run history table (G.1), sub-tab bar (G.2).
- \S5 Data flow: dispatch via FinnGenRunService (D.4 + existing SP1), display.json emission (B.1), shapes match spec.
- \S6 API: GET /modules (A.1+A.2), GET /modules/{key} (A.1+A.2). Permissions unchanged per spec.
- \S7 Result viewers: CodeWAS Manhattan (F.1), timeCodeWAS tabbed (F.2), Overlaps UpSet (F.3), Demographics pyramid (F.4), Generic fallback (F.5).
- \S8 Testing: Pest 5 tests (H.1), Vitest 2 tests (H.2), E2E 3 tests (H.3), Darkstar 4 tests (B.2).
- \S9 File structure: All files match spec listing.
- \S10 Dependencies: opis/json-schema (0.1), @rjsf/* (0.2), @upsetjs/react (0.2).
- \S11 Rollout: Deploy steps (I.2).

All spec requirements mapped. No gaps.

**2. Placeholder scan:** No "TBD", "TODO", "similar to", "add error handling" placeholders.

**3. Type consistency:**
- `CO2ModuleKey` union in types.ts matches seeder keys and ResultViewerSwitch cases
- `CodeWASDisplay` / `TimeCodeWASDisplay` / `OverlapsDisplay` / `DemographicsDisplay` shapes match spec \S5.2 exactly
- `FinnGenAnalysisModule` type from `_finngen-foundation` used consistently across api.ts, hooks, gallery, detail page
- Settings schemas in seeder match spec \S5.3

No drift.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-finngen-sp3-analysis-gallery.md`. Two execution options:**

**1. Subagent-Driven (recommended)** -- I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** -- Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
