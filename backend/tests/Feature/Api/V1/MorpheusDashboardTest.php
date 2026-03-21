<?php

use App\Models\User;
use App\Services\Morpheus\MorpheusDashboardService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);

    // Create the inpatient_ext schema and morpheus_dataset table in the test DB
    // so the controller's resolveSchema() can find an active dataset.
    DB::connection('inpatient')->unprepared('CREATE SCHEMA IF NOT EXISTS inpatient_ext');
    DB::connection('inpatient')->unprepared("
        CREATE TABLE IF NOT EXISTS inpatient_ext.morpheus_dataset (
            id SERIAL PRIMARY KEY,
            schema_name VARCHAR(100) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active'
        )
    ");
    DB::connection('inpatient')->table('inpatient_ext.morpheus_dataset')->insertOrIgnore([
        'schema_name' => 'mimiciv',
        'status' => 'active',
    ]);
});

afterEach(function () {
    // Clean up the test schema
    DB::connection('inpatient')->unprepared('DROP SCHEMA IF EXISTS inpatient_ext CASCADE');
});

test('unauthenticated user cannot access dashboard metrics', function () {
    $this->getJson('/api/v1/morpheus/dashboard/metrics')
        ->assertStatus(401);
});

test('unauthenticated user cannot access dashboard trends', function () {
    $this->getJson('/api/v1/morpheus/dashboard/trends')
        ->assertStatus(401);
});

test('authenticated user can access dashboard metrics', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getMetrics')
            ->once()
            ->with('mimiciv')
            ->andReturn((object) [
                'total_patients' => 1000,
                'total_admissions' => 2500,
                'total_icu_stays' => 800,
                'mortality_rate' => 0.12,
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/metrics')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can access dashboard trends', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getTrends')
            ->once()
            ->with('mimiciv')
            ->andReturn([
                ['year' => 2020, 'admissions' => 500],
                ['year' => 2021, 'admissions' => 600],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/trends')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can access top diagnoses', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getTopDiagnoses')
            ->once()
            ->with(10, 'mimiciv')
            ->andReturn([
                ['diagnosis' => 'Sepsis', 'count' => 300],
                ['diagnosis' => 'Pneumonia', 'count' => 250],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/top-diagnoses')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can access top procedures', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getTopProcedures')
            ->once()
            ->with(10, 'mimiciv')
            ->andReturn([
                ['procedure' => 'Mechanical ventilation', 'count' => 400],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/top-procedures')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can access demographics', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getDemographics')
            ->once()
            ->with('mimiciv')
            ->andReturn([
                'gender' => ['M' => 550, 'F' => 450],
                'age_groups' => ['18-30' => 100, '31-50' => 300],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/demographics')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can access LOS distribution', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getLosDistribution')
            ->once()
            ->with('mimiciv')
            ->andReturn([
                ['days' => '0-3', 'count' => 200],
                ['days' => '4-7', 'count' => 350],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/los-distribution')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can access ICU units', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getIcuUnits')
            ->once()
            ->with('mimiciv')
            ->andReturn([
                ['unit' => 'MICU', 'count' => 300],
                ['unit' => 'SICU', 'count' => 200],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/icu-units')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can access mortality by type', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getMortalityByType')
            ->once()
            ->with('mimiciv')
            ->andReturn([
                ['type' => 'EMERGENCY', 'mortality_rate' => 0.15],
                ['type' => 'ELECTIVE', 'mortality_rate' => 0.03],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/mortality-by-type')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('top diagnoses respects custom limit parameter', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getTopDiagnoses')
            ->once()
            ->with(5, 'mimiciv')
            ->andReturn([]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/top-diagnoses?limit=5')
        ->assertOk();
});
