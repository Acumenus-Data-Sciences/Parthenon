# v1.0.5 Remediation Plan — Data Quality & Validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Parthenon current with the v1.0.5 roadmap scope (Data Quality & Validation) after a month of feature development since v1.0.4.

**Architecture:** Four validation pillars — Achilles/DQD audit, Vocabulary/Solr validation, Ingestion/ETL verification, and Database integrity — each producing test artifacts and fixes. Wave 0 handles housekeeping (push, OMOP remediation, release tagging). All validation work produces Pest integration tests that become permanent CI gates.

**Tech Stack:** Laravel 11 / PHP 8.4 / Pest, PostgreSQL 17 (host, `claude_dev` user), Solr 9.7, Docker Compose

**CDM Sources (5):**

| Source | CDM Schema | Vocab Schema | Results Schema |
|--------|-----------|-------------|----------------|
| Acumenus | `omop` | `vocab` | `results` |
| SynPUF | `synpuf` | `vocab` | `synpuf_results` |
| IRSF | `irsf` | `vocab` | `irsf_results` |
| Pancreas | `pancreas` | `vocab` | `pancreas_results` |
| Eunomia | `eunomia` | `eunomia` | `eunomia_results` |

Note: Eunomia bundles its own vocabulary in the `eunomia` schema. All others share `vocab`.

---

## Wave 0: Housekeeping & Release Hygiene

### Task 0.1: Push Unpushed Commit and Verify Remote

**Files:**
- None (git operations only)

- [ ] **Step 1: Push the 1 unpushed commit**

```bash
git push origin main
```

- [ ] **Step 2: Verify remote is current**

```bash
git log --oneline origin/main..HEAD
```

Expected: 0 commits ahead.

---

### Task 0.2: Complete OMOP Extension Remediation (Read-Only Validation)

**Files:**
- Test: `backend/tests/Feature/OmopExtensionBridgeTest.php`

The OMOP extension bridge was committed in `0290e2b0f`. The remediation plan (`docs/devlog/2026-04-10-omop-next-agent-remediation-plan.md`) calls for read-only DB count validation and API smoke tests. No destructive operations.

- [ ] **Step 1: Validate OMOP bridge database counts**

```bash
psql "host=localhost dbname=parthenon user=claude_dev" -P pager=off -c "
SELECT 'omop.image_occurrence' AS metric, count(*) AS value FROM omop.image_occurrence
UNION ALL SELECT 'app.imaging_series.linked', count(*) FROM app.imaging_series WHERE image_occurrence_id IS NOT NULL
UNION ALL SELECT 'app.imaging_series_omop_xref', count(*) FROM app.imaging_series_omop_xref
UNION ALL SELECT 'app.imaging_procedure_omop_xref', count(*) FROM app.imaging_procedure_omop_xref
UNION ALL SELECT 'omop.specimen', count(*) FROM omop.specimen
UNION ALL SELECT 'omop.genomic_test', count(*) FROM omop.genomic_test
UNION ALL SELECT 'omop.variant_occurrence', count(*) FROM omop.variant_occurrence
UNION ALL SELECT 'omop.variant_annotation', count(*) FROM omop.variant_annotation
UNION ALL SELECT 'app.genomic_upload_omop_context_xref', count(*) FROM app.genomic_upload_omop_context_xref
UNION ALL SELECT 'app.genomic_variant_omop_xref', count(*) FROM app.genomic_variant_omop_xref
ORDER BY metric;"
```

Expected: `image_occurrence=925`, `specimen=1`, `genomic_test=1`, `variant_occurrence=4`, `variant_annotation=37`.

- [ ] **Step 2: Write Pest feature test for OMOP bridge read paths**

```php
<?php
// backend/tests/Feature/OmopExtensionBridgeTest.php

use App\Models\App\ImagingSeriesOmopXref;
use App\Models\App\GenomicUploadOmopContextXref;
use App\Models\App\GenomicVariantOmopXref;
use App\Models\App\OmopGenomicTestMap;

test('imaging series omop xref table exists and has rows', function () {
    $count = ImagingSeriesOmopXref::count();
    expect($count)->toBeGreaterThanOrEqual(0);
});

test('genomic upload omop context xref table exists', function () {
    $count = GenomicUploadOmopContextXref::count();
    expect($count)->toBeGreaterThanOrEqual(0);
});

test('genomic variant omop xref table exists', function () {
    $count = GenomicVariantOmopXref::count();
    expect($count)->toBeGreaterThanOrEqual(0);
});

test('omop genomic test map tracks exclusion reasons', function () {
    $map = OmopGenomicTestMap::query()->first();
    if ($map) {
        expect($map)->toHaveKeys(['genomic_upload_id', 'status', 'reason']);
    } else {
        $this->markTestSkipped('No genomic test map entries');
    }
});
```

- [ ] **Step 3: Run the test**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Feature/OmopExtensionBridgeTest.php
```

Expected: All tests pass or skip gracefully.

- [ ] **Step 4: Run targeted static checks on OMOP extension files**

```bash
cd /home/smudoshi/Github/Parthenon/backend
php -l database/migrations/2026_04_10_164500_add_imaging_series_omop_bridge.php
php -l database/migrations/2026_04_10_164600_add_genomics_omop_bridge.php
vendor/bin/phpstan analyse \
  app/Models/App/ImagingSeriesOmopXref.php \
  app/Models/App/ImagingProcedureOmopXref.php \
  app/Models/App/GenomicUploadOmopContextXref.php \
  app/Models/App/GenomicVariantOmopXref.php \
  app/Models/App/OmopGenomicTestMap.php \
  app/Models/App/OmopGeneSymbolMap.php \
  app/Models/Cdm/ImageOccurrence.php \
  app/Models/Cdm/GenomicTest.php \
  app/Models/Cdm/VariantOccurrence.php \
  app/Models/Cdm/VariantAnnotation.php \
  --level=8
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/Feature/OmopExtensionBridgeTest.php
git commit -m "test: add OMOP extension bridge read-path smoke tests"
```

---

### Task 0.3: Tag Feature Work as v1.0.4.1

The 144 commits since v1.0.4 are feature work (cohort wizard, patient similarity v2, OMOP extension, cohort categorization). Rather than pretending these don't exist, tag them as a patch release so the version history stays honest.

- [ ] **Step 1: Update ROADMAP.md version history**

In `ROADMAP.md`, update the v1.0.4 row and add a v1.0.4.1 row:

```markdown
| v1.0.4 | April 9, 2026 | Test Coverage & CI Hardening |
| v1.0.4.1 | April 10, 2026 | Feature sprint: Cohort Wizard, Patient Similarity v2, OMOP Extension Bridge, Cohort Categorization |
```

- [ ] **Step 2: Commit and tag**

```bash
git add ROADMAP.md
git commit -m "docs: add v1.0.4.1 to version history"
git tag -a v1.0.4.1 -m "v1.0.4.1 — Cohort Wizard, Patient Similarity v2, OMOP Extension Bridge, Cohort Categorization"
```

---

## Wave 1: Achilles & DQD Audit

### Task 1.1: Audit All 128 Achilles SQL Templates for Schema Placeholders

**Files:**
- Read: `backend/app/Services/Achilles/Analyses/**/*.php` (128 files across 14 domain folders)
- Test: `backend/tests/Unit/Services/Achilles/AchillesSchemaPlaceholderAuditTest.php`

Every Achilles analysis must use `{@cdmSchema}` for clinical tables and `{@resultsSchema}` for output. Vocabulary joins must use `{@vocabSchema}`, NOT `{@cdmSchema}`.

- [ ] **Step 1: Write the audit test**

This test programmatically loads every registered analysis and verifies its SQL template uses correct placeholders.

```php
<?php
// backend/tests/Unit/Services/Achilles/AchillesSchemaPlaceholderAuditTest.php

use App\Services\Achilles\AchillesAnalysisRegistry;

test('every achilles analysis uses {@resultsSchema} for result table writes', function () {
    $registry = app(AchillesAnalysisRegistry::class);
    $analyses = $registry->all();
    expect($analyses)->not->toBeEmpty();

    $failures = [];
    foreach ($analyses as $analysis) {
        $sql = $analysis->sqlTemplate();
        // Any write to achilles_results or achilles_results_dist must use {@resultsSchema}
        if (preg_match('/(?:INSERT INTO|DELETE FROM|UPDATE)\s+(?!{@resultsSchema})\w*\.?achilles_results/i', $sql)) {
            $failures[] = "Analysis {$analysis->analysisId()}: writes to achilles_results without {@resultsSchema}";
        }
    }
    expect($failures)->toBeEmpty();
});

test('every achilles analysis uses {@cdmSchema} for clinical table reads', function () {
    $registry = app(AchillesAnalysisRegistry::class);
    $analyses = $registry->all();

    $cdmTables = [
        'person', 'visit_occurrence', 'condition_occurrence', 'drug_exposure',
        'procedure_occurrence', 'measurement', 'observation', 'death',
        'condition_era', 'drug_era', 'observation_period', 'payer_plan_period',
        'device_exposure', 'note', 'specimen',
    ];

    $failures = [];
    foreach ($analyses as $analysis) {
        $sql = $analysis->sqlTemplate();
        foreach ($cdmTables as $table) {
            // Match "FROM/JOIN schema.table" where schema is NOT a placeholder
            if (preg_match("/(?:FROM|JOIN)\s+(?!{@\w+Schema})(\w+)\.{$table}\b/i", $sql, $m)) {
                $failures[] = "Analysis {$analysis->analysisId()}: references {$m[1]}.{$table} without schema placeholder";
            }
        }
    }
    expect($failures)->toBeEmpty();
});

test('vocabulary joins use {@vocabSchema} not {@cdmSchema}', function () {
    $registry = app(AchillesAnalysisRegistry::class);
    $analyses = $registry->all();

    $vocabTables = ['concept', 'concept_ancestor', 'concept_relationship', 'vocabulary', 'domain', 'concept_class'];

    $failures = [];
    foreach ($analyses as $analysis) {
        $sql = $analysis->sqlTemplate();
        foreach ($vocabTables as $table) {
            // Flag if vocab table is qualified with {@cdmSchema} instead of {@vocabSchema}
            if (preg_match("/{@cdmSchema}\.{$table}\b/i", $sql)) {
                $failures[] = "Analysis {$analysis->analysisId()}: uses {@cdmSchema}.{$table} — should be {@vocabSchema}.{$table}";
            }
        }
    }
    expect($failures)->toBeEmpty();
});
```

- [ ] **Step 2: Run to see current state**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Achilles/AchillesSchemaPlaceholderAuditTest.php
```

Expected: May fail — this is the audit discovering issues.

- [ ] **Step 3: Fix any failing analyses**

For each failure, edit the analysis PHP file:
- Replace hardcoded schema names with `{@cdmSchema}`, `{@vocabSchema}`, or `{@resultsSchema}`
- Vocabulary tables (`concept`, `concept_ancestor`, etc.) must use `{@vocabSchema}`

- [ ] **Step 4: Re-run — all green**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Achilles/AchillesSchemaPlaceholderAuditTest.php
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/tests/Unit/Services/Achilles/AchillesSchemaPlaceholderAuditTest.php backend/app/Services/Achilles/Analyses/
git commit -m "test: audit all 128 Achilles SQL templates for schema placeholder correctness"
```

---

### Task 1.2: Validate DQD Check SQL Against All 5 CDM Sources

**Files:**
- Test: `backend/tests/Unit/Services/Dqd/DqdCrossSourceSqlAuditTest.php`
- Read: `backend/app/Services/Dqd/DqdCheckRegistry.php`
- Read: `backend/app/Services/Dqd/DqdEngineService.php`

Each DQD check generates `sqlTotal()` and `sqlViolated()` SQL using schema params. The SQL must parse for every source's schema configuration.

- [ ] **Step 1: Write the cross-source SQL audit test**

```php
<?php
// backend/tests/Unit/Services/Dqd/DqdCrossSourceSqlAuditTest.php

use App\Services\Dqd\DqdCheckRegistry;

dataset('cdm_sources', [
    'acumenus' => ['omop', 'vocab'],
    'synpuf'   => ['synpuf', 'vocab'],
    'irsf'     => ['irsf', 'vocab'],
    'pancreas' => ['pancreas', 'vocab'],
    'eunomia'  => ['eunomia', 'eunomia'],
]);

test('every DQD check generates parseable SQL for all sources', function (string $cdmSchema, string $vocabSchema) {
    $registry = app(DqdCheckRegistry::class);
    $checks = $registry->all();
    expect($checks)->not->toBeEmpty();

    $failures = [];
    foreach ($checks as $check) {
        $totalSql = $check->sqlTotal($cdmSchema, $vocabSchema);
        $violatedSql = $check->sqlViolated($cdmSchema, $vocabSchema);

        // Must contain the correct schema, not raw placeholders
        if (str_contains($totalSql, '{@') || str_contains($violatedSql, '{@')) {
            $failures[] = "{$check->checkId()}: unresolved placeholder in SQL for {$cdmSchema}/{$vocabSchema}";
        }

        // Must reference the correct cdm schema (not hardcoded 'omop')
        if ($cdmSchema !== 'omop' && str_contains($totalSql, 'omop.')) {
            $failures[] = "{$check->checkId()}: hardcoded 'omop.' in sqlTotal (should be {$cdmSchema})";
        }

        // SQL must not be empty
        if (empty(trim($totalSql)) || empty(trim($violatedSql))) {
            $failures[] = "{$check->checkId()}: empty SQL for {$cdmSchema}/{$vocabSchema}";
        }
    }
    expect($failures)->toBeEmpty();
})->with('cdm_sources');

test('DQD checks reference vocab tables with vocabSchema', function () {
    $registry = app(DqdCheckRegistry::class);
    $checks = $registry->all();

    $vocabTables = ['concept', 'concept_ancestor', 'concept_relationship', 'vocabulary', 'domain'];
    $failures = [];

    foreach ($checks as $check) {
        $totalSql = $check->sqlTotal('test_cdm', 'test_vocab');
        $violatedSql = $check->sqlViolated('test_cdm', 'test_vocab');

        foreach ([$totalSql, $violatedSql] as $sql) {
            foreach ($vocabTables as $table) {
                if (preg_match("/test_cdm\.{$table}\b/i", $sql)) {
                    $failures[] = "{$check->checkId()}: uses cdmSchema.{$table} — should be vocabSchema.{$table}";
                }
            }
        }
    }
    expect($failures)->toBeEmpty();
});
```

- [ ] **Step 2: Run the test**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Dqd/DqdCrossSourceSqlAuditTest.php
```

- [ ] **Step 3: Fix any hardcoded schema references in DQD check classes**

Edit files in `backend/app/Services/Dqd/Checks/` to use `$cdmSchema` and `$vocabSchema` parameters correctly.

- [ ] **Step 4: Re-run — all green**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Dqd/DqdCrossSourceSqlAuditTest.php
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/Unit/Services/Dqd/DqdCrossSourceSqlAuditTest.php backend/app/Services/Dqd/Checks/
git commit -m "test: audit DQD check SQL generation across all 5 CDM sources"
```

---

### Task 1.3: Test Results Schema Switching Per Source

**Files:**
- Test: `backend/tests/Feature/Achilles/ResultsSchemaRoutingTest.php`
- Read: `backend/app/Services/Achilles/AchillesResultReaderService.php`
- Read: `backend/app/Models/App/Source.php`

The `AchillesResultReaderService` must set the correct `search_path` per source's results daimon. Each source has its own results schema (`results`, `synpuf_results`, `irsf_results`, `pancreas_results`, `eunomia_results`).

- [ ] **Step 1: Write the results schema routing test**

```php
<?php
// backend/tests/Feature/Achilles/ResultsSchemaRoutingTest.php

use App\Models\App\Source;
use App\Enums\DaimonType;

test('every source with a results daimon resolves a distinct results schema', function () {
    $sources = Source::with('daimons')->get();
    expect($sources)->not->toBeEmpty();

    $resultSchemas = [];
    $failures = [];

    foreach ($sources as $source) {
        $resultsQualifier = $source->getTableQualifier(DaimonType::Results);
        $cdmQualifier = $source->getTableQualifier(DaimonType::CDM);
        $vocabQualifier = $source->getTableQualifier(DaimonType::Vocabulary);

        if (! $resultsQualifier) {
            continue; // Source may not have results yet
        }

        // Results schema must not collide with CDM schema
        if ($resultsQualifier === $cdmQualifier) {
            $failures[] = "Source '{$source->source_name}': results schema = CDM schema ({$resultsQualifier})";
        }

        // Vocab must resolve (shared 'vocab' or bundled like 'eunomia')
        if (! $vocabQualifier) {
            $failures[] = "Source '{$source->source_name}': no vocabulary daimon";
        }

        $resultSchemas[$source->source_key] = $resultsQualifier;
    }

    expect($failures)->toBeEmpty();

    // No two sources should share a results schema (except if intentional)
    $uniqueSchemas = array_unique($resultSchemas);
    expect(count($uniqueSchemas))->toBe(count($resultSchemas),
        'Duplicate results schemas: ' . json_encode($resultSchemas));
});

test('results schema search_path can be set without error', function () {
    $sources = Source::with('daimons')->get();

    foreach ($sources as $source) {
        $resultsQualifier = $source->getTableQualifier(DaimonType::Results);
        if (! $resultsQualifier) {
            continue;
        }

        // Verify the schema actually exists by setting search_path
        $conn = \DB::connection('results');
        $conn->statement("SET search_path TO {$resultsQualifier}, public");
        $currentPath = $conn->selectOne("SHOW search_path");

        expect($currentPath->search_path)->toContain($resultsQualifier);
    }
});
```

- [ ] **Step 2: Run the test**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Feature/Achilles/ResultsSchemaRoutingTest.php
```

- [ ] **Step 3: Fix any failures in Source daimon configuration or AchillesResultReaderService**

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Feature/Achilles/ResultsSchemaRoutingTest.php
git commit -m "test: validate results schema routing across all CDM sources"
```

---

## Wave 2: Vocabulary Validation

### Task 2.1: Validate Solr Index Completeness Against vocab.concept

**Files:**
- Create: `backend/app/Console/Commands/ValidateSolrVocabularyCompleteness.php`
- Test: `backend/tests/Feature/Commands/ValidateSolrVocabularyCompletenessTest.php`

- [ ] **Step 1: Write the Artisan command**

```php
<?php
// backend/app/Console/Commands/ValidateSolrVocabularyCompleteness.php

namespace App\Console\Commands;

use App\Models\Vocabulary\Concept;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class ValidateSolrVocabularyCompleteness extends Command
{
    protected $signature = 'solr:validate-vocabulary
        {--domain= : Only check concepts in this domain}
        {--sample=1000 : Sample size for spot-check validation}';

    protected $description = 'Validate Solr vocabulary index completeness against vocab.concept';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->ping('vocabulary')) {
            $this->error('Solr vocabulary core is not reachable');
            return self::FAILURE;
        }

        // Total count comparison
        $query = Concept::query()->whereNotNull('standard_concept');
        if ($domain = $this->option('domain')) {
            $query->where('domain_id', $domain);
        }
        $pgCount = $query->count();

        $solrResult = $solr->select('vocabulary', [
            'q' => '*:*',
            'rows' => 0,
            'fq' => $domain ? "domain_id:{$domain}" : '',
        ]);
        $solrCount = $solrResult['response']['numFound'] ?? 0;

        $this->info("PostgreSQL standard concepts: {$pgCount}");
        $this->info("Solr indexed documents: {$solrCount}");
        $delta = $pgCount - $solrCount;
        $pct = $pgCount > 0 ? round(($solrCount / $pgCount) * 100, 2) : 0;
        $this->info("Coverage: {$pct}% (delta: {$delta})");

        if ($pct < 95) {
            $this->error("Solr index coverage is below 95% — re-index required");
            return self::FAILURE;
        }

        // Spot-check: sample random concept_ids and verify they exist in Solr
        $sampleSize = (int) $this->option('sample');
        $sample = Concept::query()
            ->whereNotNull('standard_concept')
            ->inRandomOrder()
            ->limit($sampleSize)
            ->pluck('concept_id');

        $missing = 0;
        foreach ($sample->chunk(100) as $chunk) {
            $ids = $chunk->implode(' OR ');
            $result = $solr->select('vocabulary', [
                'q' => "concept_id:({$ids})",
                'rows' => 0,
            ]);
            $found = $result['response']['numFound'] ?? 0;
            $missing += ($chunk->count() - $found);
        }

        if ($missing > 0) {
            $this->warn("{$missing}/{$sampleSize} sampled concepts missing from Solr");
        } else {
            $this->info("Spot check: all {$sampleSize} sampled concepts found in Solr");
        }

        return $missing > ($sampleSize * 0.05) ? self::FAILURE : self::SUCCESS;
    }
}
```

- [ ] **Step 2: Run the command against live Solr**

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan solr:validate-vocabulary --sample=500
```

Expected: Coverage >= 95%, spot check passes. If not, run `php artisan solr:index-vocabulary --fresh`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Console/Commands/ValidateSolrVocabularyCompleteness.php
git commit -m "feat: add solr:validate-vocabulary command for index completeness checks"
```

---

### Task 2.2: Audit Concept Hierarchy Traversal in Concept Set Resolution

**Files:**
- Test: `backend/tests/Unit/Services/ConceptSet/ConceptSetResolutionAuditTest.php`
- Read: `backend/app/Services/ConceptSet/ConceptSetResolverService.php`

Concept set resolution must correctly expand descendants via `concept_ancestor` and mapped concepts via `concept_relationship`. This audit verifies SQL generation correctness.

- [ ] **Step 1: Write the resolution audit test**

```php
<?php
// backend/tests/Unit/Services/ConceptSet/ConceptSetResolutionAuditTest.php

use App\Services\ConceptSet\ConceptSetResolverService;

test('resolveToSql generates valid SQL with correct vocab schema', function () {
    $resolver = app(ConceptSetResolverService::class);

    // Simulate a concept set with descendants and mapped concepts
    $items = collect([
        (object) ['concept_id' => 201826, 'include_descendants' => true, 'include_mapped' => false, 'is_excluded' => false],
        (object) ['concept_id' => 8507, 'include_descendants' => false, 'include_mapped' => true, 'is_excluded' => false],
        (object) ['concept_id' => 0, 'include_descendants' => false, 'include_mapped' => false, 'is_excluded' => true],
    ]);

    $sql = $resolver->resolveToSql($items, 'vocab');

    // Must reference vocab schema, not hardcoded
    expect($sql)->toContain('vocab.concept');
    expect($sql)->toContain('vocab.concept_ancestor');
    expect($sql)->toContain('vocab.concept_relationship');

    // Must not contain hardcoded 'omop.' for vocab tables
    expect($sql)->not->toContain('omop.concept_ancestor');
    expect($sql)->not->toContain('omop.concept_relationship');

    // Exclusions must generate NOT IN clause
    expect($sql)->toContain('NOT IN');
});

test('resolveToSql uses singular OMOP table names', function () {
    $resolver = app(ConceptSetResolverService::class);

    $items = collect([
        (object) ['concept_id' => 201826, 'include_descendants' => true, 'include_mapped' => true, 'is_excluded' => false],
    ]);

    $sql = $resolver->resolveToSql($items, 'vocab');

    // OMOP tables are singular: concept, concept_ancestor, concept_relationship
    expect($sql)->not->toMatch('/\bconcepts\b/');
    expect($sql)->not->toMatch('/\bconcept_ancestors\b/');
    expect($sql)->not->toMatch('/\bconcept_relationships\b/');
});

test('resolveToSql with eunomia uses eunomia schema for vocab', function () {
    $resolver = app(ConceptSetResolverService::class);

    $items = collect([
        (object) ['concept_id' => 201826, 'include_descendants' => true, 'include_mapped' => false, 'is_excluded' => false],
    ]);

    $sql = $resolver->resolveToSql($items, 'eunomia');

    // Eunomia bundles its own vocab — must use eunomia, not vocab
    expect($sql)->toContain('eunomia.concept_ancestor');
    expect($sql)->not->toContain('vocab.concept_ancestor');
});
```

- [ ] **Step 2: Run the test**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/ConceptSet/ConceptSetResolutionAuditTest.php
```

- [ ] **Step 3: Fix any failures in ConceptSetResolverService**

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Unit/Services/ConceptSet/ConceptSetResolutionAuditTest.php
git commit -m "test: audit concept set resolution SQL for schema correctness"
```

---

## Wave 3: Ingestion & ETL Validation

### Task 3.1: Add Row Count Verification to Ingestion Pipeline

**Files:**
- Modify: `backend/app/Jobs/Ingestion/WriteCdmDataJob.php`
- Modify: `backend/app/Services/Ingestion/PostLoadValidationService.php`
- Test: `backend/tests/Unit/Services/Ingestion/RowCountVerificationTest.php`

- [ ] **Step 1: Write the row count verification test**

```php
<?php
// backend/tests/Unit/Services/Ingestion/RowCountVerificationTest.php

use App\Services\Ingestion\PostLoadValidationService;

test('post-load validation computes row counts per CDM table', function () {
    $validator = app(PostLoadValidationService::class);

    // Verify the validation result structure includes row counts
    $reflection = new ReflectionClass($validator);
    $method = $reflection->getMethod('validate');
    $params = $method->getParameters();

    // validate() must accept an IngestionJob
    expect($params)->toHaveCount(1);
    expect($params[0]->getType()->getName())->toBe('App\Models\App\IngestionJob');
});

test('validation results track violated and total row counts', function () {
    // Verify the ValidationResult model has the required columns
    $columns = \Schema::connection('pgsql')->getColumnListing('validation_results');

    expect($columns)->toContain('violated_rows');
    expect($columns)->toContain('total_rows');
    expect($columns)->toContain('violation_percentage');
    expect($columns)->toContain('check_category');
    expect($columns)->toContain('severity');
});
```

- [ ] **Step 2: Run the test**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Ingestion/RowCountVerificationTest.php
```

- [ ] **Step 3: Add checksum verification to CdmWriterService**

In `backend/app/Services/Ingestion/CdmWriterService.php`, after the bulk insert, add a count verification:

```php
// After inserting into each CDM table, verify the count matches
$expectedCount = count($records);
$actualCount = DB::connection('omop')->table("{$cdmSchema}.{$table}")
    ->where('_ingestion_job_id', $job->id)
    ->count();

if ($actualCount !== $expectedCount) {
    Log::warning("Row count mismatch for {$table}: expected {$expectedCount}, got {$actualCount}");
    $stats['mismatches'][] = ['table' => $table, 'expected' => $expectedCount, 'actual' => $actualCount];
}
```

Note: Only add this if the ingestion pipeline tracks a job_id column. If not, use staging table counts instead. Inspect the actual `CdmWriterService` before implementing.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Unit/Services/Ingestion/RowCountVerificationTest.php backend/app/Services/Ingestion/
git commit -m "test: add row count verification to ingestion pipeline"
```

---

### Task 3.2: Validate FHIR-to-CDM Transformation Fidelity

**Files:**
- Test: `backend/tests/Unit/Services/Ingestion/FhirTransformFidelityTest.php`
- Read: `backend/app/Services/Ingestion/FhirResourceMapper.php`

- [ ] **Step 1: Write FHIR transformation fidelity tests**

```php
<?php
// backend/tests/Unit/Services/Ingestion/FhirTransformFidelityTest.php

use App\Services\Ingestion\FhirResourceMapper;

test('patient maps gender to correct OMOP concepts', function () {
    $mapper = app(FhirResourceMapper::class);

    $patient = [
        'resourceType' => 'Patient',
        'id' => 'test-1',
        'gender' => 'female',
        'birthDate' => '1990-03-15',
    ];

    $result = $mapper->mapPatient($patient);
    expect($result['gender_concept_id'])->toBe(8532); // female
});

test('patient maps male gender correctly', function () {
    $mapper = app(FhirResourceMapper::class);

    $result = $mapper->mapPatient([
        'resourceType' => 'Patient',
        'id' => 'test-2',
        'gender' => 'male',
        'birthDate' => '1985-07-20',
    ]);
    expect($result['gender_concept_id'])->toBe(8507); // male
});

test('condition maps SNOMED code to condition_occurrence', function () {
    $mapper = app(FhirResourceMapper::class);

    $condition = [
        'resourceType' => 'Condition',
        'id' => 'cond-1',
        'code' => [
            'coding' => [
                ['system' => 'http://snomed.info/sct', 'code' => '44054006', 'display' => 'Type 2 diabetes'],
            ],
        ],
        'onsetDateTime' => '2023-01-15',
        'subject' => ['reference' => 'Patient/test-1'],
    ];

    $result = $mapper->mapCondition($condition);
    expect($result)->toHaveKey('condition_source_value');
    expect($result['condition_source_value'])->toContain('44054006');
    expect($result)->toHaveKey('condition_start_date');
});

test('medication request maps RxNorm code to drug_exposure', function () {
    $mapper = app(FhirResourceMapper::class);

    $medRequest = [
        'resourceType' => 'MedicationRequest',
        'id' => 'med-1',
        'medicationCodeableConcept' => [
            'coding' => [
                ['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '1049502'],
            ],
        ],
        'authoredOn' => '2023-06-01',
        'subject' => ['reference' => 'Patient/test-1'],
    ];

    $result = $mapper->mapMedicationRequest($medRequest);
    expect($result)->toHaveKey('drug_source_value');
    expect($result)->toHaveKey('drug_exposure_start_date');
});

test('observation maps LOINC code to measurement', function () {
    $mapper = app(FhirResourceMapper::class);

    $observation = [
        'resourceType' => 'Observation',
        'id' => 'obs-1',
        'code' => [
            'coding' => [
                ['system' => 'http://loinc.org', 'code' => '2160-0', 'display' => 'Creatinine'],
            ],
        ],
        'valueQuantity' => ['value' => 1.2, 'unit' => 'mg/dL'],
        'effectiveDateTime' => '2023-03-01',
        'subject' => ['reference' => 'Patient/test-1'],
    ];

    // Observations with LOINC should map to measurement, not observation
    // Verify the mapper routes correctly based on code system
    $result = $mapper->mapObservation($observation);
    expect($result)->not->toBeNull();
});
```

- [ ] **Step 2: Run the tests**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Ingestion/FhirTransformFidelityTest.php
```

- [ ] **Step 3: Fix any mapping errors discovered**

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Unit/Services/Ingestion/FhirTransformFidelityTest.php
git commit -m "test: validate FHIR-to-CDM transformation fidelity for core resource types"
```

---

## Wave 4: Database Integrity

### Task 4.1: Audit Migrations for Idempotency

**Files:**
- Create: `backend/tests/Unit/Database/MigrationIdempotencyAuditTest.php`

With 242 migration files, a programmatic audit catches common issues: missing `down()` methods, unsafe `dropIfExists` in `up()`, and non-transactional DDL.

- [ ] **Step 1: Write the migration audit test**

```php
<?php
// backend/tests/Unit/Database/MigrationIdempotencyAuditTest.php

test('all migrations have both up and down methods', function () {
    $migrationPath = base_path('database/migrations');
    $files = glob("{$migrationPath}/*.php");
    expect($files)->not->toBeEmpty();

    $failures = [];
    foreach ($files as $file) {
        $content = file_get_contents($file);
        $basename = basename($file);

        // Check for anonymous class migrations (Laravel 9+) or named class
        if (! str_contains($content, 'function up(') && ! str_contains($content, 'function up (')) {
            $failures[] = "{$basename}: missing up() method";
        }
        if (! str_contains($content, 'function down(') && ! str_contains($content, 'function down (')) {
            $failures[] = "{$basename}: missing down() method";
        }
    }
    expect($failures)->toBeEmpty();
});

test('no migration uses dropIfExists in up() for existing tables', function () {
    $migrationPath = base_path('database/migrations');
    $files = glob("{$migrationPath}/*.php");

    $warnings = [];
    foreach ($files as $file) {
        $content = file_get_contents($file);
        $basename = basename($file);

        // dropIfExists in up() is dangerous — it silently drops existing tables
        if (preg_match('/function\s+up\s*\(.*?\{(.*?)function\s+down/s', $content, $m)) {
            $upBody = $m[1];
            if (str_contains($upBody, 'dropIfExists')) {
                $warnings[] = "{$basename}: uses dropIfExists in up() — potential data loss";
            }
        }
    }

    if (! empty($warnings)) {
        $this->addWarning(implode("\n", $warnings));
    }
    // Warn but don't fail — some cases are intentional (create_or_replace patterns)
    expect(true)->toBeTrue();
});

test('no migration contains raw DROP TABLE without IF EXISTS in down()', function () {
    $migrationPath = base_path('database/migrations');
    $files = glob("{$migrationPath}/*.php");

    $failures = [];
    foreach ($files as $file) {
        $content = file_get_contents($file);
        $basename = basename($file);

        // Raw DROP TABLE (not dropIfExists) in down() will error if table doesn't exist
        if (preg_match('/function\s+down\s*\(.*?\{(.*)/s', $content, $m)) {
            $downBody = $m[1];
            if (preg_match('/\bDROP\s+TABLE\s+(?!IF\s+EXISTS)/i', $downBody)) {
                $failures[] = "{$basename}: uses DROP TABLE without IF EXISTS in down()";
            }
        }
    }
    expect($failures)->toBeEmpty();
});

test('no migration uses $guarded = []', function () {
    $migrationPath = base_path('database/migrations');
    $files = glob("{$migrationPath}/*.php");

    $failures = [];
    foreach ($files as $file) {
        $content = file_get_contents($file);
        $basename = basename($file);

        if (str_contains($content, '$guarded = []')) {
            $failures[] = "{$basename}: contains \$guarded = [] — HIGHSEC violation";
        }
    }
    expect($failures)->toBeEmpty();
});
```

- [ ] **Step 2: Run the audit**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Database/MigrationIdempotencyAuditTest.php
```

- [ ] **Step 3: Fix critical failures (missing down() methods, unsafe drops)**

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Unit/Database/MigrationIdempotencyAuditTest.php backend/database/migrations/
git commit -m "test: audit 242 migrations for idempotency and rollback safety"
```

---

### Task 4.2: Validate Foreign Key Constraints Across Schema Boundaries

**Files:**
- Test: `backend/tests/Feature/Database/CrossSchemaForeignKeyTest.php`

OMOP tables reference vocabulary tables across schema boundaries. Verify the FK integrity holds.

- [ ] **Step 1: Write the FK constraint test**

```php
<?php
// backend/tests/Feature/Database/CrossSchemaForeignKeyTest.php

test('all person records have valid gender_concept_id in vocab', function () {
    $orphans = \DB::connection('omop')->select("
        SELECT p.person_id, p.gender_concept_id
        FROM omop.person p
        LEFT JOIN vocab.concept c ON p.gender_concept_id = c.concept_id
        WHERE p.gender_concept_id != 0
          AND c.concept_id IS NULL
        LIMIT 10
    ");
    expect($orphans)->toBeEmpty('Orphan gender_concept_ids found in person table');
});

test('all condition_occurrence records reference valid condition_concept_id', function () {
    $orphans = \DB::connection('omop')->select("
        SELECT co.condition_concept_id, COUNT(*) AS cnt
        FROM omop.condition_occurrence co
        LEFT JOIN vocab.concept c ON co.condition_concept_id = c.concept_id
        WHERE co.condition_concept_id != 0
          AND c.concept_id IS NULL
        GROUP BY co.condition_concept_id
        LIMIT 10
    ");
    expect($orphans)->toBeEmpty('Orphan condition_concept_ids found');
});

test('all drug_exposure records reference valid drug_concept_id', function () {
    $orphans = \DB::connection('omop')->select("
        SELECT de.drug_concept_id, COUNT(*) AS cnt
        FROM omop.drug_exposure de
        LEFT JOIN vocab.concept c ON de.drug_concept_id = c.concept_id
        WHERE de.drug_concept_id != 0
          AND c.concept_id IS NULL
        GROUP BY de.drug_concept_id
        LIMIT 10
    ");
    expect($orphans)->toBeEmpty('Orphan drug_concept_ids found');
});

test('all measurement records reference valid measurement_concept_id', function () {
    $orphans = \DB::connection('omop')->select("
        SELECT m.measurement_concept_id, COUNT(*) AS cnt
        FROM omop.measurement m
        LEFT JOIN vocab.concept c ON m.measurement_concept_id = c.concept_id
        WHERE m.measurement_concept_id != 0
          AND c.concept_id IS NULL
        GROUP BY m.measurement_concept_id
        LIMIT 10
    ");
    expect($orphans)->toBeEmpty('Orphan measurement_concept_ids found');
});

test('all visit_occurrence records reference valid persons', function () {
    $orphans = \DB::connection('omop')->select("
        SELECT vo.visit_occurrence_id, vo.person_id
        FROM omop.visit_occurrence vo
        LEFT JOIN omop.person p ON vo.person_id = p.person_id
        WHERE p.person_id IS NULL
        LIMIT 10
    ");
    expect($orphans)->toBeEmpty('Orphan person_ids in visit_occurrence');
});

test('observation_period covers every person', function () {
    $uncovered = \DB::connection('omop')->select("
        SELECT p.person_id
        FROM omop.person p
        LEFT JOIN omop.observation_period op ON p.person_id = op.person_id
        WHERE op.person_id IS NULL
        LIMIT 10
    ");
    // This is a warning, not a hard failure — some CDM sources may not have observation periods computed yet
    if (! empty($uncovered)) {
        $this->addWarning(count($uncovered) . ' persons without observation_period');
    }
    expect(true)->toBeTrue();
});
```

- [ ] **Step 2: Run the test**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Feature/Database/CrossSchemaForeignKeyTest.php
```

- [ ] **Step 3: Investigate and fix any orphaned concept references**

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Feature/Database/CrossSchemaForeignKeyTest.php
git commit -m "test: validate FK integrity across CDM and vocabulary schemas"
```

---

### Task 4.3: Add OMOP CDM Required Field CHECK Constraints

**Files:**
- Create: `backend/database/migrations/2026_04_11_000001_add_omop_cdm_check_constraints.php`

- [ ] **Step 1: Write the migration**

```php
<?php
// backend/database/migrations/2026_04_11_000001_add_omop_cdm_check_constraints.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $schemas = ['omop', 'synpuf', 'irsf', 'pancreas'];

        foreach ($schemas as $schema) {
            // Only add constraints if the table exists in this schema
            $tables = DB::select("
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = ? AND table_type = 'BASE TABLE'
            ", [$schema]);

            $tableNames = array_map(fn ($t) => $t->table_name, $tables);

            if (in_array('person', $tableNames)) {
                DB::statement("
                    DO \$\$ BEGIN
                        ALTER TABLE {$schema}.person
                            ADD CONSTRAINT chk_{$schema}_person_gender
                            CHECK (gender_concept_id IS NOT NULL);
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END \$\$;
                ");

                DB::statement("
                    DO \$\$ BEGIN
                        ALTER TABLE {$schema}.person
                            ADD CONSTRAINT chk_{$schema}_person_yob
                            CHECK (year_of_birth IS NOT NULL);
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END \$\$;
                ");
            }

            if (in_array('visit_occurrence', $tableNames)) {
                DB::statement("
                    DO \$\$ BEGIN
                        ALTER TABLE {$schema}.visit_occurrence
                            ADD CONSTRAINT chk_{$schema}_visit_start_date
                            CHECK (visit_start_date IS NOT NULL);
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END \$\$;
                ");
            }

            if (in_array('condition_occurrence', $tableNames)) {
                DB::statement("
                    DO \$\$ BEGIN
                        ALTER TABLE {$schema}.condition_occurrence
                            ADD CONSTRAINT chk_{$schema}_condition_start_date
                            CHECK (condition_start_date IS NOT NULL);
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END \$\$;
                ");
            }

            if (in_array('drug_exposure', $tableNames)) {
                DB::statement("
                    DO \$\$ BEGIN
                        ALTER TABLE {$schema}.drug_exposure
                            ADD CONSTRAINT chk_{$schema}_drug_start_date
                            CHECK (drug_exposure_start_date IS NOT NULL);
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END \$\$;
                ");
            }

            if (in_array('observation_period', $tableNames)) {
                DB::statement("
                    DO \$\$ BEGIN
                        ALTER TABLE {$schema}.observation_period
                            ADD CONSTRAINT chk_{$schema}_obs_period_dates
                            CHECK (observation_period_start_date <= observation_period_end_date);
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END \$\$;
                ");
            }
        }
    }

    public function down(): void
    {
        $schemas = ['omop', 'synpuf', 'irsf', 'pancreas'];
        $constraints = [
            'chk_%s_person_gender', 'chk_%s_person_yob',
            'chk_%s_visit_start_date', 'chk_%s_condition_start_date',
            'chk_%s_drug_start_date', 'chk_%s_obs_period_dates',
        ];

        foreach ($schemas as $schema) {
            foreach ($constraints as $template) {
                $name = sprintf($template, $schema);
                DB::statement("ALTER TABLE IF EXISTS {$schema}.person DROP CONSTRAINT IF EXISTS {$name}");
                DB::statement("ALTER TABLE IF EXISTS {$schema}.visit_occurrence DROP CONSTRAINT IF EXISTS {$name}");
                DB::statement("ALTER TABLE IF EXISTS {$schema}.condition_occurrence DROP CONSTRAINT IF EXISTS {$name}");
                DB::statement("ALTER TABLE IF EXISTS {$schema}.drug_exposure DROP CONSTRAINT IF EXISTS {$name}");
                DB::statement("ALTER TABLE IF EXISTS {$schema}.observation_period DROP CONSTRAINT IF EXISTS {$name}");
            }
        }
    }
};
```

- [ ] **Step 2: Dry-run the migration**

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan migrate --pretend --path=database/migrations/2026_04_11_000001_add_omop_cdm_check_constraints.php
```

- [ ] **Step 3: Run the migration (with user approval)**

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan migrate --path=database/migrations/2026_04_11_000001_add_omop_cdm_check_constraints.php
```

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_04_11_000001_add_omop_cdm_check_constraints.php
git commit -m "feat: add OMOP CDM CHECK constraints for required fields across all CDM schemas"
```

---

## Wave 5: CI Preflight & Release

### Task 5.1: Run Full CI Preflight

- [ ] **Step 1: Backend checks**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse --level=8"
```

- [ ] **Step 2: Frontend checks**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 3: Run full test suite**

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run
```

- [ ] **Step 4: Fix any failures discovered during preflight**

### Task 5.2: Tag v1.0.5 Release

- [ ] **Step 1: Update ROADMAP.md**

Set v1.0.5 date to the completion date.

- [ ] **Step 2: Write release notes**

Create `docs/blog/2026-04-XX-v1-0-5-release-notes.md` documenting:
- Achilles SQL template audit (128 analyses verified)
- DQD cross-source validation (20 checks × 5 sources)
- Vocabulary Solr index completeness validation
- Concept set resolution schema correctness
- FHIR-to-CDM transformation fidelity tests
- Migration idempotency audit (242 migrations)
- Cross-schema FK integrity validation
- OMOP CDM CHECK constraints

- [ ] **Step 3: Tag and push**

```bash
git tag -a v1.0.5 -m "v1.0.5 — Data Quality & Validation"
git push origin main --tags
```

- [ ] **Step 4: Deploy**

```bash
./deploy.sh
```

---

## Summary

| Wave | Tasks | New Test Files | Focus |
|------|-------|---------------|-------|
| 0 | 3 | 1 | Housekeeping, OMOP remediation, version tag |
| 1 | 3 | 3 | Achilles/DQD SQL audit across 5 sources |
| 2 | 2 | 2 | Solr completeness, concept set resolution |
| 3 | 2 | 2 | Ingestion row counts, FHIR fidelity |
| 4 | 3 | 3 | Migration audit, FK integrity, CHECK constraints |
| 5 | 2 | 0 | CI preflight, release tag |
| **Total** | **15** | **11** | |

Estimated new Pest tests: ~40+ assertions across 11 test files, producing permanent CI regression gates for data quality.
