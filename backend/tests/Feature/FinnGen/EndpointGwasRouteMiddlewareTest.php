<?php

declare(strict_types=1);

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Phase 15 Plan 08 — HTTP middleware coverage for the two new Phase 15 routes.
 *
 * Asserts HIGHSEC §2 three-layer protection:
 *   - auth:sanctum on both routes (401 for anonymous);
 *   - permission:finngen.workbench.use (403 for viewer who lacks the perm);
 *   - throttle: 10/min on POST /gwas, 60/min on GET /eligible-controls (429 at burst).
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);

    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    // Delete child rows first (FK: endpoint_generations → endpoint_definitions).
    FinnGenEndpointGeneration::query()->where('endpoint_name', 'E4_DM2')->delete();
    EndpointDefinition::query()->where('name', 'E4_DM2')->delete();
    EndpointDefinition::factory()->create([
        'name' => 'E4_DM2',
        'longname' => 'Type 2 diabetes',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
    ]);

    // Clear the rate-limiter between tests to keep throttle counts deterministic.
    RateLimiter::clear('throttle:10,1');
    RateLimiter::clear('throttle:60,1');
});

it('POST /gwas requires auth sanctum (401 anonymous)', function () {
    $response = $this->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
        'source_key' => 'PANCREAS',
        'control_cohort_id' => 221,
    ]);
    $response->assertStatus(401);
});

it('POST /gwas requires finngen.workbench.use permission (403 for viewer)', function () {
    $response = $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => 221,
        ]);
    $response->assertStatus(403);
});

it('POST /gwas is rate-limited to 10 per minute with Retry-After on the 11th', function () {
    // 11 rapid-fire requests. The 11th returns 429. Auth-gated so it must come
    // from a perm-holding user; we use researcher who has finngen.workbench.use.
    // We don't care that the earlier requests return 500 / 422 / 202 because of
    // missing fixtures — only that the 11th in a minute exceeds the throttle.
    $lastStatus = null;
    for ($i = 1; $i <= 11; $i++) {
        $response = $this->actingAs($this->researcher)
            ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
                'source_key' => 'PANCREAS',
                'control_cohort_id' => 221,
            ]);
        $lastStatus = $response->status();
        if ($lastStatus === 429) {
            expect($response->headers->has('Retry-After'))->toBeTrue();
            break;
        }
    }
    expect($lastStatus)->toBe(429);
});

it('GET /eligible-controls requires auth sanctum (401 anonymous)', function () {
    $response = $this->getJson('/api/v1/finngen/endpoints/E4_DM2/eligible-controls?source_key=PANCREAS');
    $response->assertStatus(401);
});

it('GET /eligible-controls is rate-limited to 60 per minute (429 on the 61st)', function () {
    $lastStatus = null;
    for ($i = 1; $i <= 61; $i++) {
        $response = $this->actingAs($this->researcher)
            ->getJson('/api/v1/finngen/endpoints/E4_DM2/eligible-controls?source_key=PANCREAS');
        $lastStatus = $response->status();
        if ($lastStatus === 429) {
            break;
        }
    }
    expect($lastStatus)->toBe(429);
});
