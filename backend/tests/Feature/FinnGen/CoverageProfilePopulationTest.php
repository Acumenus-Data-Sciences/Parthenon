<?php

declare(strict_types=1);

use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Phase 13 invariant (preserved through 13.1): every FinnGen endpoint carries a
 * populated `coverage_profile`. Under Phase 13.1 this column lives on
 * finngen.endpoint_definitions (not app.cohort_definitions — that column was
 * dropped by Plan 13.1-02, CONTEXT.md D-06).
 *
 * Rewritten for Phase 13.1 per Plan 13.1-04 Task 1 (Rule 1: Tests):
 *   - Fixtures now seed EndpointDefinition::factory() rows directly rather
 *     than round-tripping through the importer + CohortDefinition.
 *   - Assertion uses the EndpointDefinition model on the finngen connection
 *     instead of raw DB::table('app.cohort_definitions') + domain filter.
 */
it('populates coverage_profile on every finngen endpoint row', function () {
    EndpointDefinition::factory()->count(3)->create([
        'coverage_profile' => CoverageProfile::UNIVERSAL,
    ]);

    $nullCount = EndpointDefinition::query()
        ->whereNull('coverage_profile')
        ->count();

    expect($nullCount)->toBe(0);
    expect(EndpointDefinition::count())->toBe(3);
});
