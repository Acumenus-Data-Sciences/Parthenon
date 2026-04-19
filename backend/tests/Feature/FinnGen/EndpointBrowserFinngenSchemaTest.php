<?php

declare(strict_types=1);

use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\getJson;

uses(RefreshDatabase::class);

/**
 * Phase 13.1 Wave 0 — SC 7.
 *
 * Expected state: RED until Plan 13.1-03 rewrites EndpointBrowserController
 * to read from finngen.endpoint_definitions via the finngen_ro connection
 * (and the Plan 13.1-02 migration creates the backing table).
 *
 * Confirms the controller returns the new typed shape
 * ({name, coverage_profile, coverage_bucket, ...}) rather than the legacy
 * CohortDefinition shape.
 *
 * @note RED until Plan 13.1-02 migration + Plan 13.1-03 controller rewrite ship.
 */
it('GET /api/v1/finngen/endpoints reads from finngen.endpoint_definitions', function (): void {
    $this->seed(RolePermissionSeeder::class);
    $user = User::factory()->create();
    $user->assignRole('super-admin');

    EndpointDefinition::factory()->count(3)->create();

    actingAs($user, 'sanctum');
    $response = getJson('/api/v1/finngen/endpoints?per_page=25');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(3);
    foreach ($response->json('data') as $row) {
        expect($row)->toHaveKeys(['name', 'coverage_profile', 'coverage_bucket']);
    }
});
