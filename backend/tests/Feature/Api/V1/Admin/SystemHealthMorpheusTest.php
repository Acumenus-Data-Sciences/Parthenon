<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);

    // Ensure a clean registry for every test. The migration
    // 2026_04_10_000001 creates this table when RefreshDatabase runs
    // migrations; we just wipe the rows so each test controls its own
    // state. Using the Morpheus test connection ensures these writes
    // stay inside parthenon_testing and never touch production.
    DB::connection('inpatient_testing')->unprepared('CREATE SCHEMA IF NOT EXISTS inpatient_ext');
    DB::connection('inpatient_testing')->unprepared(<<<'SQL'
        CREATE TABLE IF NOT EXISTS inpatient_ext.morpheus_dataset (
            dataset_id    BIGSERIAL PRIMARY KEY,
            name          TEXT NOT NULL,
            schema_name   TEXT NOT NULL UNIQUE,
            description   TEXT,
            source_type   TEXT,
            patient_count INTEGER NOT NULL DEFAULT 0,
            status        TEXT NOT NULL DEFAULT 'active',
            created_at    TIMESTAMP NOT NULL DEFAULT NOW()
        )
    SQL);
    DB::connection('inpatient_testing')->table('inpatient_ext.morpheus_dataset')->delete();
});

// Helper unique to this file — SystemHealthGrafanaTest.php already
// defines a top-level `adminUser()` function that would collide.
function morpheusSystemHealthAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

test('morpheus check reports down when registry is empty', function () {
    $this->actingAs(morpheusSystemHealthAdmin(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment([
            'key' => 'morpheus',
            'status' => 'down',
        ]);
});

test('morpheus check message calls out empty registry', function () {
    $response = $this->actingAs(morpheusSystemHealthAdmin(), 'sanctum')
        ->getJson('/api/v1/admin/system-health/morpheus')
        ->assertOk()
        ->assertJsonPath('service.key', 'morpheus')
        ->assertJsonPath('service.status', 'down');

    expect($response->json('service.message'))
        ->toContain('Dataset registry is empty');
});

test('morpheus check reports down when all rows are inactive', function () {
    DB::connection('inpatient_testing')->table('inpatient_ext.morpheus_dataset')->insert([
        'name' => 'Stale Dataset',
        'schema_name' => 'stale_dataset',
        'status' => 'inactive',
    ]);

    $response = $this->actingAs(morpheusSystemHealthAdmin(), 'sanctum')
        ->getJson('/api/v1/admin/system-health/morpheus')
        ->assertOk()
        ->assertJsonPath('service.key', 'morpheus')
        ->assertJsonPath('service.status', 'down');

    expect($response->json('service.message'))
        ->toContain('none are active');
});

test('morpheus check reports healthy when registry has an active row', function () {
    DB::connection('inpatient_testing')->table('inpatient_ext.morpheus_dataset')->insert([
        'name' => 'MIMIC-IV Demo',
        'schema_name' => 'mimiciv',
        'source_type' => 'MIMIC',
        'patient_count' => 100,
        'status' => 'active',
    ]);

    $this->actingAs(morpheusSystemHealthAdmin(), 'sanctum')
        ->getJson('/api/v1/admin/system-health/morpheus')
        ->assertOk()
        ->assertJsonPath('service.key', 'morpheus')
        ->assertJsonPath('service.status', 'healthy')
        ->assertJsonPath('service.message', '1 dataset registered and active.');
});

test('morpheus check reports pluralized count for multiple active rows', function () {
    DB::connection('inpatient_testing')->table('inpatient_ext.morpheus_dataset')->insert([
        [
            'name' => 'MIMIC-IV Demo',
            'schema_name' => 'mimiciv',
            'patient_count' => 100,
            'status' => 'active',
        ],
        [
            'name' => 'Atlantic Health System',
            'schema_name' => 'atlantic_health',
            'patient_count' => 3250,
            'status' => 'active',
        ],
    ]);

    $this->actingAs(morpheusSystemHealthAdmin(), 'sanctum')
        ->getJson('/api/v1/admin/system-health/morpheus')
        ->assertOk()
        ->assertJsonPath('service.key', 'morpheus')
        ->assertJsonPath('service.status', 'healthy')
        ->assertJsonPath('service.message', '2 datasets registered and active.');
});

test('morpheus show endpoint returns per-dataset metrics', function () {
    DB::connection('inpatient_testing')->table('inpatient_ext.morpheus_dataset')->insert([
        'name' => 'MIMIC-IV Demo',
        'schema_name' => 'mimiciv',
        'source_type' => 'MIMIC',
        'patient_count' => 100,
        'status' => 'active',
    ]);

    $response = $this->actingAs(morpheusSystemHealthAdmin(), 'sanctum')
        ->getJson('/api/v1/admin/system-health/morpheus')
        ->assertOk()
        ->assertJsonPath('metrics.datasets_total', 1)
        ->assertJsonPath('metrics.datasets_active', 1)
        ->assertJsonPath('metrics.total_patient_count', 100);

    $datasets = $response->json('metrics.datasets');
    expect($datasets)->toHaveCount(1);
    expect($datasets[0]['schema_name'])->toBe('mimiciv');
    expect($datasets[0]['patient_count'])->toBe(100);
    // schema_ready reflects whether the underlying per-dataset schema
    // has a patients table. In the testing DB it doesn't exist for
    // 'mimiciv', so this should be false — proving the check surfaces
    // dangling registry entries.
    expect($datasets[0]['schema_ready'])->toBeFalse();
});

test('system health index includes morpheus service in clinical tier', function () {
    $response = $this->actingAs(morpheusSystemHealthAdmin(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'morpheus']);

    $services = collect($response->json('services'));
    $morpheus = $services->firstWhere('key', 'morpheus');
    expect($morpheus)->not->toBeNull();
    expect($morpheus['tier'])->toBe('Clinical Services');
});
