<?php

declare(strict_types=1);

use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\GwasCacheKeyHasher;
use App\Services\FinnGen\GwasRunService;
use App\Services\FinnGen\GwasSchemaProvisioner;
use Database\Seeders\FinnGenAnalysisModuleSeeder;
use Database\Seeders\FinnGenGwasCovariateSetSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

// Deliberately NOT using RefreshDatabase — mirrors GwasDispatchTest.php
// and PrepareSourceVariantsCommandTest.php. RefreshDatabase collides with
// Phase 13.1's isolate_finngen_schema migration's ALTER TABLE ... SET SCHEMA
// on replay. We clean deterministic starting state in beforeEach() instead.
//
// Cross-DB FK note (identical to GwasDispatchTest): SourceVariantIndex
// ('pgsql') + Run ('finngen') target the live parthenon DB while the test
// harness writes seeded users to parthenon_testing. We mock
// FinnGenRunService so no Run rows actually persist through the cross-DB
// connection; the mock records create() calls + returns hand-built Run
// instances with settable status/summary for deterministic polling.

beforeEach(function (): void {
    // Seed catalog rows (analysis modules + default covariate set).
    (new FinnGenAnalysisModuleSeeder)->run();
    (new FinnGenGwasCovariateSetSeeder)->run();

    // Ensure PANCREAS SourceVariantIndex row exists so dispatch precondition
    // passes. NULL built_by_user_id avoids the live-DB users(id) FK.
    SourceVariantIndex::updateOrCreate(
        ['source_key' => 'pancreas'],
        [
            'format' => 'pgen',
            'pgen_path' => '/opt/finngen-artifacts/variants/pancreas/all',
            'pc_tsv_path' => '/opt/finngen-artifacts/variants/pancreas/pcs.tsv',
            'variant_count' => 10000,
            'sample_count' => 360,
            'pc_count' => 20,
            'built_at' => now(),
        ]
    );

    // Ensure the per-source schema + summary_stats table exist so the
    // command's row-count assertion can succeed. The GwasSchemaProvisioner
    // is idempotent so running it in beforeEach is safe.
    app(GwasSchemaProvisioner::class)->provision('pancreas');

    // Clear any residual summary_stats rows from prior tests.
    DB::statement('TRUNCATE pancreas_gwas_results.summary_stats RESTART IDENTITY');

    // Also seed the smoke-test covariate set id into test-state for easy access.
    $this->covariateSet = GwasCovariateSet::where('is_default', true)->firstOrFail();

    // Track all dispatch requests made by the command. The fake simulates
    // Darkstar: on step-1, mark the run succeeded with summary.cache_hit
    // (alternating across calls via the counter). On step-2, mark the run
    // succeeded AND insert a synthetic summary_stats row keyed by the
    // run id, so the command's assertion passes end-to-end.
    $this->step1CallCount = 0;
    $this->step2CallCount = 0;
    $this->createdRuns = [];

    $step1CallCountRef = &$this->step1CallCount;
    $step2CallCountRef = &$this->step2CallCount;
    $createdRunsRef = &$this->createdRuns;

    $this->fakeRunService = new class($step1CallCountRef, $step2CallCountRef, $createdRunsRef) extends FinnGenRunService
    {
        /**
         * @param  array<int, Run>  $createdRunsRef
         */
        public function __construct(
            private int &$step1CallsRef,
            private int &$step2CallsRef,
            private array &$createdRunsRef,
        ) {
            // Intentionally skip parent::__construct — we don't need the
            // analysis-module registry for the fake.
        }

        /**
         * @param  array<string, mixed>  $params
         */
        public function create(int $userId, string $sourceKey, string $analysisType, array $params): Run
        {
            $run = new Run;

            // Build a deterministic-but-unique ULID-shaped string per call.
            $seq = str_pad((string) (count($this->createdRunsRef) + 1), 10, '0', STR_PAD_LEFT);
            $run->id = '01HFAKEGWAS'.$seq.'XXXXXXX';
            $run->user_id = $userId;
            $run->source_key = $sourceKey;
            $run->analysis_type = $analysisType;
            $run->params = $params;

            // Simulate Darkstar marking the run succeeded immediately.
            if ($analysisType === GwasRunService::ANALYSIS_TYPE_STEP1) {
                $this->step1CallsRef++;
                $run->status = Run::STATUS_SUCCEEDED;
                $run->summary = [
                    'cache_key' => $params['cache_key'] ?? '',
                    // First call is a cold miss, subsequent calls are cache hits.
                    'cache_hit' => ($this->step1CallsRef > 1),
                    'loco_count' => 1,
                ];
            } else {
                $this->step2CallsRef++;
                $run->status = Run::STATUS_SUCCEEDED;
                $run->summary = ['rows_written' => 1, 'warnings' => []];

                // Insert a synthetic summary_stats row so the command's
                // DB::selectOne assertion passes. Schema already provisioned
                // in the outer beforeEach.
                $sourceLower = strtolower($sourceKey);
                DB::insert(
                    sprintf(
                        'INSERT INTO %s_gwas_results.summary_stats
                            (chrom, pos, ref, alt, snp_id, af, beta, se, p_value,
                             case_n, control_n, cohort_definition_id, gwas_run_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        $sourceLower
                    ),
                    [
                        '1', 12345, 'A', 'G', 'rs1', 0.1, 0.05, 0.01, 1e-6,
                        100, 200, (int) ($params['cohort_definition_id'] ?? 0), $run->id,
                    ]
                );
            }
            $run->exists = true;  // signal to Eloquent the row "exists"
            $this->createdRunsRef[] = $run;

            return $run;
        }
    };

    $this->app->instance(FinnGenRunService::class, $this->fakeRunService);
    $this->app->forgetInstance(GwasRunService::class);

    // Bind a Run::fresh override via a Run query-macro-like shortcut: the
    // hand-built Run has exists=true and id set; the command calls
    // $run->fresh() which triggers a DB read on `runs` table in the
    // finngen DB. Since we don't actually persist rows, the real ->fresh()
    // would return null. We need to make fresh() return the current
    // instance (already terminal) so pollUntilTerminal exits immediately.
    //
    // Cleanest approach: swap the Run model at instance level via a
    // macro. But Model::fresh() isn't macroable — it's a final method on
    // the HasAttributes trait. Instead, we use a local anonymous subclass
    // pattern via newQuery-stubbing: the fake run we return from create()
    // is already STATUS_SUCCEEDED, so the command's pollUntilTerminal()
    // sees ->isTerminal()===true BEFORE it ever calls fresh()... UNLESS
    // it calls fresh() first. Read the command: the first line inside
    // the poll loop IS `$fresh = $run->fresh();`.
    //
    // Solution: attach a macro via Model::macro? No — fresh is not
    // macroable. We instead bind Run::fresh to return $this by using a
    // closure-bound macro on Model via addGlobalScope? Still not macroable.
    //
    // Simplest pragmatic fix: in the fake we RETURN a Run subclass that
    // overrides fresh(). That requires changing the fake to return an
    // anonymous subclass of Run. See below in a per-test pattern.
});

afterEach(function (): void {
    // Belt-and-suspenders cleanup: drop any rows the fake inserted.
    if (schemaExists('pancreas_gwas_results')) {
        DB::statement('TRUNCATE pancreas_gwas_results.summary_stats RESTART IDENTITY');
    }
    SourceVariantIndex::query()->delete();
});

/**
 * Helper: does a schema exist? Avoids noise when beforeEach hasn't yet run.
 */
function schemaExists(string $schema): bool
{
    $row = DB::selectOne(
        'SELECT 1 AS x FROM information_schema.schemata WHERE schema_name = ?',
        [$schema]
    );

    return $row !== null;
}

function tableExists(string $schema, string $table): bool
{
    $row = DB::selectOne(
        'SELECT 1 AS x FROM information_schema.tables '.
        'WHERE table_schema = ? AND table_name = ?',
        [$schema, $table]
    );

    return $row !== null;
}

it('runs step-1 → step-2 end-to-end with mocked FinnGenRunService', function () {
    // Swap the fake to return Run instances that short-circuit ->fresh()
    // so pollUntilTerminal exits immediately instead of timing out. We do
    // this per-test rather than in beforeEach because it needs to bind a
    // FRESH subclass per assertion context.
    $this->app->instance(FinnGenRunService::class, new class extends FinnGenRunService
    {
        public function __construct()
        {
            // Skip parent::__construct — no registry needed.
        }

        public function create(int $userId, string $sourceKey, string $analysisType, array $params): Run
        {
            $run = new class extends Run
            {
                public function fresh($with = []): static
                {
                    // Already terminal — return self so pollUntilTerminal
                    // exits on the first iteration without a DB round-trip.
                    return $this;
                }
            };
            $seq = bin2hex(random_bytes(6));
            $run->id = '01HTEST'.strtoupper($seq).'GWAS';
            $run->user_id = $userId;
            $run->source_key = $sourceKey;
            $run->analysis_type = $analysisType;
            $run->params = $params;

            if ($analysisType === GwasRunService::ANALYSIS_TYPE_STEP1) {
                $run->status = Run::STATUS_SUCCEEDED;
                $run->summary = [
                    'cache_key' => $params['cache_key'] ?? '',
                    'cache_hit' => false,
                    'loco_count' => 1,
                ];
            } else {
                $run->status = Run::STATUS_SUCCEEDED;
                $run->summary = ['rows_written' => 1, 'warnings' => []];

                $sourceLower = strtolower($sourceKey);
                DB::insert(
                    sprintf(
                        'INSERT INTO %s_gwas_results.summary_stats
                            (chrom, pos, ref, alt, snp_id, af, beta, se, p_value,
                             case_n, control_n, cohort_definition_id, gwas_run_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        $sourceLower
                    ),
                    [
                        '1', 12345, 'A', 'G', 'rs1', 0.1, 0.05, 0.01, 1e-6,
                        100, 200, (int) ($params['cohort_definition_id'] ?? 0), $run->id,
                    ]
                );
            }
            $run->exists = true;

            return $run;
        }
    });
    $this->app->forgetInstance(GwasRunService::class);

    // Also need to plant fit_pred.list so step-2's GwasRunService
    // precondition passes. Compute the cache_key the same way the service
    // does, then touch the marker file.
    $cacheKey = GwasCacheKeyHasher::hash(
        221,
        $this->covariateSet->id,
        (string) $this->covariateSet->covariate_columns_hash,
        'pancreas',
    );
    $dispatcher = app(GwasRunService::class);
    $cacheDir = $dispatcher->step1CacheDir('pancreas', $cacheKey);
    @mkdir($cacheDir, 0775, true);
    if (! is_dir($cacheDir) || ! is_writable($cacheDir)) {
        $this->markTestSkipped("artifacts volume not writable from PHP container at {$cacheDir}");
    }
    file_put_contents($cacheDir.'/fit_pred.list', 'dummy');

    try {
        $exit = Artisan::call('finngen:gwas-smoke-test', [
            '--source' => 'PANCREAS',
            '--cohort-id' => 221,
            '--covariate-set-id' => $this->covariateSet->id,
            '--timeout-minutes' => 1,
            '--force-as-user' => 1,
        ]);

        expect($exit)->toBe(0);

        // One summary_stats row was written by the fake.
        $rowCount = (int) DB::selectOne('SELECT COUNT(*) AS c FROM pancreas_gwas_results.summary_stats')->c;
        expect($rowCount)->toBeGreaterThanOrEqual(1);

        // stdout includes a JSON summary payload.
        $output = Artisan::output();
        expect($output)->toContain('"status":"ok"');
        expect($output)->toContain('"source":"PANCREAS"');
        expect($output)->toContain('"summary_stats_rows":1');
    } finally {
        @unlink($cacheDir.'/fit_pred.list');
        @rmdir($cacheDir);
    }
})->skip(
    fn () => ! tableExists('pancreas', 'person'),
    'Requires live PANCREAS CDM schema WITH populated pancreas.person + '.
    'pancreas.cohort tables (not just the schema namespace). On parthenon_testing '.
    'the pancreas schema exists but the CDM tables are not bootstrapped by any '.
    'migration — they live in an external ETL. The command\'s ensureCaseControlSplit '.
    'step queries pancreas.person to compute case/control balance. Full Darkstar-'.
    'side smoke-gen is exercised in DEV via the Phase 13.1-05 DEPLOY-LOG and Phase '.
    '13.2-05 runbook. Tracked as deferred test-hygiene item in Phase 13.2 residuals '.
    'triage (2026-04-18) — see residual #3 in 13.2-07-PEST-LOG.'
);

it('fails fast when source has no variant index', function () {
    SourceVariantIndex::query()->delete();

    $exit = Artisan::call('finngen:gwas-smoke-test', [
        '--source' => 'PANCREAS',
        '--cohort-id' => 221,
        '--covariate-set-id' => $this->covariateSet->id,
        '--timeout-minutes' => 1,
        '--force-as-user' => 1,
    ]);

    expect($exit)->not->toBe(0);
    // No dispatch calls recorded because the precondition check fires first.
    expect($this->step1CallCount)->toBe(0);
    expect($this->step2CallCount)->toBe(0);
});

it('refuses to run without super-admin gate when APP_ENV is production', function () {
    // Mirrors PrepareSourceVariantsCommandTest's approach — detectEnvironment
    // re-binds the environment closure without needing Application reinit.
    app()->detectEnvironment(fn () => 'production');

    $exit = Artisan::call('finngen:gwas-smoke-test', [
        '--source' => 'PANCREAS',
        '--cohort-id' => 221,
        '--covariate-set-id' => $this->covariateSet->id,
        '--timeout-minutes' => 1,
    ]);

    expect($exit)->not->toBe(0);
    expect($this->step1CallCount)->toBe(0);
});

it('rejects invalid --source format', function () {
    $exit = Artisan::call('finngen:gwas-smoke-test', [
        '--source' => '99 DROP TABLE',
        '--cohort-id' => 221,
        '--force-as-user' => 1,
    ]);

    expect($exit)->not->toBe(0);
    expect($this->step1CallCount)->toBe(0);
});
