<?php

declare(strict_types=1);

use App\Models\App\FinnGen\Run;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Phase 16-02 — HIGHSEC §2 three-layer invariant coverage for the 3 Phase 16
 * Wave-2 routes.
 *
 * Asserts:
 *   Layer 1 (auth:sanctum)   — unauthenticated → 401 on every route
 *   Layer 2 (permission gate)— viewer (no finngen.workbench.use) → 403 on the
 *                               3 finngen routes; viewer → 200/422 (NOT 403)
 *                               on /gencode/genes since viewer has cohorts.view.
 *
 * (Ownership invariant is covered by GwasManhattanControllerTest,
 * GwasManhattanRegionTest, and TopVariantsControllerTest directly.)
 *
 * Plan 03 extends the finngenRoutes dataset to include the top-variants route.
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    $this->run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'analysis_type' => 'finngen.gwas.step2',
        'params' => [],
        'status' => Run::STATUS_SUCCEEDED,
        'started_at' => now()->subMinutes(5),
        'finished_at' => now(),
    ]);
});

dataset('finngenRoutes', function () {
    // Routes are seeded at beforeEach; we build URLs lazily by referring
    // to a stub run id per test via the closure signature's `$this` binding.
    return [
        'manhattan thinned' => ['path' => '/api/v1/finngen/runs/__RUN__/manhattan'],
        'manhattan region' => ['path' => '/api/v1/finngen/runs/__RUN__/manhattan/region?chrom=1&start=1&end=1000'],
        'top-variants' => ['path' => '/api/v1/finngen/runs/__RUN__/top-variants'],
    ];
});

it('returns 401 for unauthenticated on every finngen Wave-2 route', function (string $path) {
    $url = str_replace('__RUN__', $this->run->id, $path);
    $this->getJson($url)->assertStatus(401);
})->with('finngenRoutes');

it('returns 403 for viewer on every finngen Wave-2 route', function (string $path) {
    $url = str_replace('__RUN__', $this->run->id, $path);
    $this->actingAs($this->viewer)->getJson($url)->assertStatus(403);
})->with('finngenRoutes');

it('gencode route — unauthenticated 401, viewer 200/422 (NOT 403)', function () {
    // Layer 1: unauthenticated
    $this->getJson('/api/v1/gencode/genes?chrom=17&start=1&end=1000')
        ->assertStatus(401);

    // Layer 2: viewer has cohorts.view → NOT 403.
    $resp = $this->actingAs($this->viewer)
        ->getJson('/api/v1/gencode/genes?chrom=17&start=1&end=1000');

    expect($resp->status())->not->toBe(403);
});
