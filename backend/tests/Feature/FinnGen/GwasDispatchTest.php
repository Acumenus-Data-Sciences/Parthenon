<?php

declare(strict_types=1);

use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\GwasCacheKeyHasher;

beforeEach(function () {
    // Wave 0 skeleton: FinnGenClient has a complex constructor; the Wave 4
    // implementation will bind a proper fake via $this->app->instance().
    // Until then, attempting to register the anonymous subclass below during
    // beforeEach() would explode before ->skip() fires, so short-circuit
    // if the fixture class is not fully implemented yet.
    if (! class_exists(GwasCacheKeyHasher::class)) {
        return;
    }
    // Bind a fake FinnGenClient that records dispatches in memory rather
    // than hitting Darkstar HTTP. Pattern from RunFinnGenAnalysisJobTest.
    $this->app->instance(FinnGenClient::class, new class('http://fake', 'fake-token') extends FinnGenClient
    {
        public array $dispatches = [];

        public function submitJob(string $endpoint, array $payload): string
        {
            $this->dispatches[] = compact('endpoint', 'payload');

            return 'fake-job-id';
        }
    });
});

it('dispatches step-1 as finngen.gwas.regenie.step1 analysis type', function () {
    // Act: trigger step-1 via GwasRunService (to be implemented Wave 4).
    // Assert: a Run exists with analysis_type == finngen.gwas.regenie.step1.
    expect(true)->toBeFalse(); // placeholder until Wave 4
})->skip('Wave 0 skeleton — implementation lands in Wave 4 Plan 14-05');

it('dispatches step-2 when step-1 cache_key artifact is present', function () {
    expect(true)->toBeFalse();
})->skip('Wave 0 skeleton — implementation lands in Wave 4 Plan 14-05');

it('rejects step-2 with 422-equivalent when cache_key artifact is missing', function () {
    expect(true)->toBeFalse();
})->skip('Wave 0 skeleton — implementation lands in Wave 4 Plan 14-05');

it('rejects dispatch with 422-equivalent when source is unprepared', function () {
    expect(true)->toBeFalse();
})->skip('Wave 0 skeleton — implementation lands in Wave 4 Plan 14-05');

it('produces a cache_key hash matching a known fixture (PHP/R parity)', function () {
    // Fixture: (cohort_id=221, covariate_set_id=1, covariate_set_version_hash='deadbeef', source_key='PANCREAS')
    // Expected hash: computed offline by the Wave 2 task; locked once both PHP and R implementations agree.
    // For Wave 0, the fixture value is a sentinel that the Wave 2 task replaces with the actual hex.
    $hash = GwasCacheKeyHasher::hash(221, 1, 'deadbeef', 'PANCREAS');
    expect($hash)->toMatch('/^[a-f0-9]{64}$/');
    // The exact hex is pinned in Wave 2 Plan 14-03 after PHP+R agree.
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03; parity locked in Wave 4');
