<?php

declare(strict_types=1);

use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Services\FinnGen\Exceptions\SourceNotPreparedException;
use App\Services\FinnGen\Exceptions\Step1ArtifactMissingException;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\GwasCacheKeyHasher;
use App\Services\FinnGen\GwasRunService;
use Database\Seeders\FinnGenAnalysisModuleSeeder;
use Database\Seeders\FinnGenGwasCovariateSetSeeder;

beforeEach(function () {
    // Phase 14-04 SUMMARY established: RefreshDatabase collides with the
    // Phase 13.1 isolate_finngen_schema migration's ALTER TABLE...SET SCHEMA
    // on replay. We instead manually clean and ensure seeders for the data
    // shape we need.
    //
    // Cross-DB FK note: SourceVariantIndex (connection 'pgsql') and Run
    // (connection 'finngen') both target the LIVE parthenon DB while the
    // test harness writes seeded users to parthenon_testing. To avoid
    // FK violations on `users(id)`, we mock FinnGenRunService — the unit
    // under test (GwasRunService) is a thin precondition wrapper, not a
    // Run-row factory. This matches the spirit of the Wave 0 skeleton's
    // FinnGenClient fake.
    (new FinnGenAnalysisModuleSeeder)->run();
    (new FinnGenGwasCovariateSetSeeder)->run();

    // Ensure SourceVariantIndex row exists for PANCREAS so dispatch
    // preconditions pass. NULL built_by_user_id avoids the live-DB users(id)
    // FK collision.
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

    $this->covariateSet = GwasCovariateSet::where('is_default', true)->firstOrFail();

    // Mock FinnGenRunService so we don't actually insert Run rows (which
    // would require a user in the live parthenon DB — see comment above).
    // The mock records the create() args and returns a fake Run instance.
    $this->createCalls = [];
    $createCallsRef = &$this->createCalls;
    $this->fakeRunService = new class($createCallsRef) extends FinnGenRunService
    {
        /** @param array<int, array<string, mixed>> $callsRef */
        public function __construct(private array &$callsRef)
        {
            // Intentionally skip parent::__construct — we don't need the
            // analysis-module registry for the fake.
        }

        /**
         * @param  array<string, mixed>  $params
         */
        public function create(int $userId, string $sourceKey, string $analysisType, array $params): Run
        {
            $this->callsRef[] = compact('userId', 'sourceKey', 'analysisType', 'params');
            $run = new Run;
            $run->id = '01HFAKE'.str_pad((string) (count($this->callsRef)), 20, '0', STR_PAD_LEFT);
            $run->user_id = $userId;
            $run->source_key = $sourceKey;
            $run->analysis_type = $analysisType;
            $run->params = $params;
            $run->status = Run::STATUS_QUEUED;
            $run->exists = true;  // signal to Eloquent the row "exists"

            return $run;
        }
    };
    $this->app->instance(FinnGenRunService::class, $this->fakeRunService);
    $this->app->forgetInstance(GwasRunService::class);
});

afterEach(function () {
    SourceVariantIndex::query()->delete();
});

it('dispatches step-1 as gwas.regenie.step1 analysis type', function () {
    $service = app(GwasRunService::class);

    $run = $service->dispatchStep1(
        userId: 999,  // arbitrary — fake doesn't validate
        cohortDefinitionId: 221,
        covariateSetId: $this->covariateSet->id,
        sourceKey: 'PANCREAS',
    );

    expect($run)->toBeInstanceOf(Run::class);
    expect($run->analysis_type)->toBe(GwasRunService::ANALYSIS_TYPE_STEP1);
    expect($run->source_key)->toBe('PANCREAS');
    expect($run->status)->toBe(Run::STATUS_QUEUED);
    expect($run->params)->toMatchArray([
        'cohort_definition_id' => 221,
        'covariate_set_id' => $this->covariateSet->id,
        'source_key' => 'pancreas',
    ]);
    expect($run->params['cache_key'])->toMatch('/^[a-f0-9]{64}$/');
    expect($run->params['covariate_set_version_hash'])->toBe((string) $this->covariateSet->covariate_columns_hash);

    // FinnGenRunService::create was invoked exactly once with the right args.
    expect($this->createCalls)->toHaveCount(1);
    expect($this->createCalls[0]['analysisType'])->toBe(GwasRunService::ANALYSIS_TYPE_STEP1);
    expect($this->createCalls[0]['sourceKey'])->toBe('PANCREAS');
});

it('dispatches step-2 when step-1 cache_key artifact is present', function () {
    $service = app(GwasRunService::class);

    // Pre-compute the cache_key so we can plant a fake fit_pred.list at
    // the canonical layout BEFORE invoking step-2.
    $cacheKey = GwasCacheKeyHasher::hash(
        221,
        $this->covariateSet->id,
        (string) $this->covariateSet->covariate_columns_hash,
        'pancreas',
    );
    $cacheDir = $service->step1CacheDir('pancreas', $cacheKey);
    @mkdir($cacheDir, 0775, true);
    if (! is_dir($cacheDir) || ! is_writable($cacheDir)) {
        $this->markTestSkipped("artifacts volume not writable from PHP container at {$cacheDir}");
    }
    file_put_contents($cacheDir.'/fit_pred.list', 'dummy');

    try {
        $run = $service->dispatchStep2(
            userId: 999,
            cohortDefinitionId: 221,
            covariateSetId: $this->covariateSet->id,
            sourceKey: 'PANCREAS',
        );

        expect($run->analysis_type)->toBe(GwasRunService::ANALYSIS_TYPE_STEP2);
        expect($run->params['cache_key'])->toBe($cacheKey);
        expect($run->status)->toBe(Run::STATUS_QUEUED);
        expect($this->createCalls)->toHaveCount(1);
        expect($this->createCalls[0]['analysisType'])->toBe(GwasRunService::ANALYSIS_TYPE_STEP2);
    } finally {
        @unlink($cacheDir.'/fit_pred.list');
        @rmdir($cacheDir);
    }
});

it('rejects step-2 with 422-equivalent when cache_key artifact is missing', function () {
    $service = app(GwasRunService::class);

    $cacheKey = GwasCacheKeyHasher::hash(
        221,
        $this->covariateSet->id,
        (string) $this->covariateSet->covariate_columns_hash,
        'pancreas',
    );
    // Belt-and-suspenders: ensure no artifact lurks from a prior test run.
    @unlink($service->step1CacheDir('pancreas', $cacheKey).'/fit_pred.list');

    expect(fn () => $service->dispatchStep2(
        userId: 999,
        cohortDefinitionId: 221,
        covariateSetId: $this->covariateSet->id,
        sourceKey: 'PANCREAS',
    ))->toThrow(Step1ArtifactMissingException::class);

    // FinnGenRunService::create must NOT have been invoked.
    expect($this->createCalls)->toHaveCount(0);
});

it('rejects dispatch with 422-equivalent when source is unprepared', function () {
    SourceVariantIndex::query()->delete();

    $service = app(GwasRunService::class);

    expect(fn () => $service->dispatchStep1(
        userId: 999,
        cohortDefinitionId: 221,
        covariateSetId: $this->covariateSet->id,
        sourceKey: 'PANCREAS',
    ))->toThrow(SourceNotPreparedException::class);

    expect(fn () => $service->dispatchStep2(
        userId: 999,
        cohortDefinitionId: 221,
        covariateSetId: $this->covariateSet->id,
        sourceKey: 'PANCREAS',
    ))->toThrow(SourceNotPreparedException::class);

    expect($this->createCalls)->toHaveCount(0);
});

it('produces a cache_key hash matching the Plan 14-03 SUMMARY fixture (PHP/R parity)', function () {
    // FIXTURE PINNED IN .planning/phases/14-regenie-gwas-infrastructure/14-03-SUMMARY.md
    // Input:  (cohort_id=221, covariate_set_id=1, covariate_set_version_hash='deadbeef',
    //          source_key='PANCREAS')
    // SHA-256: b58a15fc61e7bca9d2ecc767782c98de90a0c32e1f3855df79214d72190df8c1
    //
    // The R worker (gwas_regenie.R) pins the same hex in its testthat
    // suite. Any drift between PHP and R surfaces in CI (T-14-12).
    $expected = 'b58a15fc61e7bca9d2ecc767782c98de90a0c32e1f3855df79214d72190df8c1';
    $actual = GwasCacheKeyHasher::hash(221, 1, 'deadbeef', 'PANCREAS');
    expect($actual)->toBe($expected);
    expect($actual)->toMatch('/^[a-f0-9]{64}$/');

    // Case-insensitive parity: PANCREAS and pancreas hash identically.
    expect(GwasCacheKeyHasher::hash(221, 1, 'deadbeef', 'pancreas'))->toBe($expected);
});
