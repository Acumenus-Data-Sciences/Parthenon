<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('proxies the HADES package capability inventory from Darkstar', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    Http::fake([
        '*/hades/packages' => Http::response([
            'status' => 'partial',
            'total' => 4,
            'installed_count' => 3,
            'missing_count' => 1,
            'required_count' => 2,
            'required_missing_count' => 0,
            'required_missing' => [],
            'packages' => [
                [
                    'package' => 'CohortMethod',
                    'installed' => true,
                    'version' => '6.0.1',
                    'capability' => 'Population-level effect estimation',
                    'surface' => 'first_class',
                    'priority' => 'first_class',
                    'install_source' => 'Pinned OHDSI GitHub release tags',
                    'inclusion_reason' => 'First-class population estimation runtime support.',
                    'required_for_parity' => true,
                ],
                [
                    'package' => 'TreatmentPatterns',
                    'installed' => false,
                    'version' => null,
                    'capability' => 'Treatment pathway analysis',
                    'surface' => 'native_partial_missing_package',
                    'priority' => 'high',
                    'install_source' => 'OHDSI r-universe pinned with remotes::install_version',
                    'inclusion_reason' => 'Package-native TreatmentPatterns compatibility.',
                    'required_for_parity' => false,
                ],
                [
                    'package' => 'OhdsiShinyAppBuilder',
                    'install_package' => 'OhdsiShinyAppBuilder',
                    'installed' => true,
                    'version' => '1.0.0',
                    'capability' => 'Legacy Shiny app builder',
                    'surface' => 'optional_legacy',
                    'priority' => 'optional',
                    'install_source' => 'OHDSI r-universe pinned with remotes::install_version',
                    'inclusion_reason' => 'Shiny artifact compatibility only.',
                    'required_for_parity' => false,
                ],
                [
                    'package' => 'OhdsiShinyModules',
                    'install_package' => 'OhdsiShinyModules',
                    'installed' => true,
                    'version' => '3.5.0',
                    'capability' => 'Legacy Shiny modules',
                    'surface' => 'optional_legacy',
                    'priority' => 'optional',
                    'install_source' => 'Pinned OHDSI GitHub release tags',
                    'inclusion_reason' => 'Shiny module compatibility only.',
                    'required_for_parity' => false,
                ],
            ],
        ], 200),
    ]);

    $this->actingAs($user)
        ->getJson('/api/v1/hades/packages')
        ->assertOk()
        ->assertJsonPath('data.status', 'partial')
        ->assertJsonPath('data.required_missing_count', 0)
        ->assertJsonPath('data.shiny_policy.expose_hosted_surfaces', false)
        ->assertJsonPath('data.shiny_policy.allow_iframe_embedding', false)
        ->assertJsonPath('data.shiny_policy.allow_user_supplied_app_paths', false)
        ->assertJsonPath('data.shiny_policy.decision', 'superseded_by_native_parthenon')
        ->assertJsonPath('data.packages.0.package', 'CohortMethod')
        ->assertJsonPath('data.packages.0.install_source', 'Pinned OHDSI GitHub release tags')
        ->assertJsonPath('data.packages.0.required_for_parity', true)
        ->assertJsonPath('data.packages.1.installed', false)
        ->assertJsonPath('data.packages.2.surface', 'native_replacement_no_hosting')
        ->assertJsonPath('data.packages.2.priority', 'superseded')
        ->assertJsonPath('data.packages.2.hosted_surface', false)
        ->assertJsonPath('data.packages.2.exposure_policy', 'not_exposed')
        ->assertJsonPath('data.packages.2.decision', 'superseded_by_native_parthenon')
        ->assertJsonPath('data.packages.3.surface', 'native_replacement_no_hosting')
        ->assertJsonPath('data.packages.3.priority', 'superseded')
        ->assertJsonPath('data.packages.3.hosted_surface', false)
        ->assertJsonPath('data.packages.3.exposure_policy', 'not_exposed')
        ->assertJsonPath('data.packages.3.decision', 'superseded_by_native_parthenon');
});

it('allows DeepPatientLevelPrediction model types in prediction designs', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $payload = [
        'name' => 'Deep PLP Transformer',
        'design_json' => [
            'targetCohortId' => 1,
            'outcomeCohortId' => 2,
            'model' => [
                'type' => 'transformer',
                'hyperParameters' => [],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/v1/predictions', $payload)
        ->assertCreated()
        ->assertJsonPath('data.name', 'Deep PLP Transformer')
        ->assertJsonPath('data.design_json.model.type', 'transformer');
});
