<?php

declare(strict_types=1);

/**
 * Phase 19 Wave 0 RED — IncidenceRateService.location_urban_pct +
 * IncidenceRateController stratifyByLocation FormRequest validation.
 *
 * Plan 04 (GIS-03) extends IncidenceRateService::buildIncidenceRateSql to
 * accept stratifyBy='location_urban_pct' and adds a new
 * design_json.stratifyByLocation field (enum: none|urban_pct|rucc).
 *
 * Wave 0 RED: this file references symbols that do NOT yet exist
 * (IncidenceRateService::supportedStratifications() / SUPPORTED_STRATIFICATIONS,
 * design_json.stratifyByLocation FormRequest rule). Tests must fail until
 * Plan 04 ships.
 *
 * Pest groups: phase19, studies, gis-03 — every test.
 */

use App\Models\User;
use App\Services\Analysis\IncidenceRateService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('IncidenceRateService advertises location_urban_pct as a supported stratification (GIS-03)', function (): void {
    $found = false;

    if (method_exists(IncidenceRateService::class, 'supportedStratifications')) {
        /** @var array<int, string> $list */
        $list = IncidenceRateService::supportedStratifications();
        $found = in_array('location_urban_pct', $list, true);
    } elseif (defined(IncidenceRateService::class.'::SUPPORTED_STRATIFICATIONS')) {
        /** @var array<int, string> $list */
        $list = IncidenceRateService::SUPPORTED_STRATIFICATIONS;
        $found = in_array('location_urban_pct', $list, true);
    }

    expect($found)->toBeTrue(
        'IncidenceRateService must expose location_urban_pct via supportedStratifications() or SUPPORTED_STRATIFICATIONS const (Plan 04 / GIS-03)'
    );
})->group('phase19', 'studies', 'gis-03');

it('IncidenceRateController validates stratifyByLocation as enum (none|urban_pct|rucc) (GIS-03)', function (): void {
    /** @var User $user */
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/incidence-rates', [
        'name' => 'Phase19 stratifyByLocation invalid value',
        'design_json' => [
            'targetCohortId' => 1,
            'outcomeCohortId' => 2,
            'stratifyByLocation' => 'urbanity',
        ],
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['design_json.stratifyByLocation']);
})->group('phase19', 'studies', 'gis-03');

it('IncidenceRateController accepts stratifyByLocation=urban_pct (GIS-03)', function (): void {
    /** @var User $user */
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/incidence-rates', [
        'name' => 'Phase19 stratifyByLocation urban_pct accepted',
        'design_json' => [
            'targetCohortId' => 1,
            'outcomeCohortId' => 2,
            'stratifyByLocation' => 'urban_pct',
        ],
    ]);

    // 422 is acceptable (referential validation may flag missing cohorts);
    // we only assert that 'design_json.stratifyByLocation' itself is NOT a
    // listed validation error.
    if ($response->status() === 422) {
        $errors = $response->json('errors') ?? [];
        expect($errors)->not->toHaveKey('design_json.stratifyByLocation');
    } else {
        expect($response->status())->toBeIn([200, 201, 202]);
    }
})->group('phase19', 'studies', 'gis-03');
