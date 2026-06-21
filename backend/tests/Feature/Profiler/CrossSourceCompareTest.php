<?php

declare(strict_types=1);

use App\Models\App\FieldProfile;
use App\Models\App\Source;
use App\Models\App\SourceProfile;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

/**
 * @param  list<array{0: string, 1: string, 2: string}>  $fields
 */
function makeScanProfile(int $sourceId, array $fields): SourceProfile
{
    $profile = SourceProfile::create([
        'source_id' => $sourceId,
        'file_name' => 'scan.csv',
        'file_format' => 'csv',
        'row_count' => 100,
        'column_count' => count($fields),
    ]);

    foreach ($fields as $index => $field) {
        FieldProfile::create([
            'source_profile_id' => $profile->id,
            'table_name' => $field[0],
            'column_name' => $field[1],
            'column_index' => $index,
            'inferred_type' => $field[2],
            'non_null_count' => 100,
            'null_count' => 0,
            'null_percentage' => 0,
            'distinct_count' => 100,
            'distinct_percentage' => 100,
        ]);
    }

    return $profile;
}

it('requires authentication to compare profiles', function () {
    $this->getJson('/api/v1/scan-profiles/compare?current=1&baseline=2')
        ->assertStatus(401);
});

it('requires profiler.view permission', function () {
    $this->actingAs(User::factory()->create())
        ->getJson('/api/v1/scan-profiles/compare?current=1&baseline=2')
        ->assertStatus(403);
});

it('validates that both profile ids exist', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->getJson('/api/v1/scan-profiles/compare?current=999999&baseline=999998')
        ->assertStatus(422)
        ->assertJsonValidationErrors(['current', 'baseline']);
});

it('compares two profiles from different sources and labels each side', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $sourceA = Source::factory()->create(['source_name' => 'Source A']);
    $sourceB = Source::factory()->create(['source_name' => 'Source B']);

    $baseline = makeScanProfile($sourceA->id, [['person', 'id', 'integer'], ['person', 'name', 'varchar']]);
    $current = makeScanProfile($sourceB->id, [['person', 'id', 'integer'], ['person', 'email', 'varchar']]);

    $this->actingAs($user)
        ->getJson("/api/v1/scan-profiles/compare?current={$current->id}&baseline={$baseline->id}")
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['summary', 'regressions', 'improvements', 'schema_changes'],
            'current_label',
            'baseline_label',
        ])
        ->assertJsonPath('current_label', 'Source B')
        ->assertJsonPath('baseline_label', 'Source A');
});
