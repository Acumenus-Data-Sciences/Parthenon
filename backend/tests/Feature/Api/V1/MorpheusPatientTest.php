<?php

use App\Models\User;
use App\Services\Morpheus\MorpheusPatientService;
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
    DB::connection('inpatient')->unprepared('DROP SCHEMA IF EXISTS inpatient_ext CASCADE');
});

test('unauthenticated user cannot list patients', function () {
    $this->getJson('/api/v1/morpheus/patients')
        ->assertStatus(401);
});

test('unauthenticated user cannot view patient details', function () {
    $this->getJson('/api/v1/morpheus/patients/10001')
        ->assertStatus(401);
});

test('authenticated user can list patients', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldReceive('listPatients')
            ->once()
            ->withArgs(function ($limit, $offset, $filters, $schema) {
                return $limit === 100 && $offset === 0 && $schema === 'mimiciv';
            })
            ->andReturn([
                'data' => [
                    ['subject_id' => 10001, 'gender' => 'M', 'anchor_age' => 65],
                    ['subject_id' => 10002, 'gender' => 'F', 'anchor_age' => 42],
                ],
                'total' => 2,
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients')
        ->assertOk()
        ->assertJsonStructure(['data', 'total']);
});

test('authenticated user can search patients', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldReceive('searchPatients')
            ->once()
            ->with('10001', 20, 'mimiciv')
            ->andReturn([
                ['subject_id' => 10001, 'gender' => 'M'],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients/search?q=10001')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('search with empty query returns empty data', function () {
    $user = User::factory()->create();

    // searchPatients should NOT be called when q is empty
    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldNotReceive('searchPatients');
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients/search?q=')
        ->assertOk()
        ->assertJsonPath('data', []);
});

test('authenticated user can view patient demographics', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldReceive('getDemographics')
            ->once()
            ->with('10001', 'mimiciv')
            ->andReturn([
                'subject_id' => 10001,
                'gender' => 'M',
                'anchor_age' => 65,
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients/10001')
        ->assertOk()
        ->assertJsonPath('data.subject_id', 10001);
});

test('patient not found returns 404', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldReceive('getDemographics')
            ->once()
            ->with('99999', 'mimiciv')
            ->andReturn(null);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients/99999')
        ->assertStatus(404)
        ->assertJsonPath('error', 'Patient not found');
});

test('authenticated user can view patient admissions', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldReceive('getAdmissions')
            ->once()
            ->with('10001', 'mimiciv')
            ->andReturn([
                ['hadm_id' => 20001, 'admittime' => '2020-01-01'],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients/10001/admissions')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can view patient diagnoses', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldReceive('getDiagnoses')
            ->once()
            ->with('10001', null, 'mimiciv')
            ->andReturn([
                ['icd_code' => 'A419', 'long_title' => 'Sepsis, unspecified organism'],
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients/10001/diagnoses')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can view patient medications', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldReceive('getMedications')
            ->once()
            ->with('10001', null, 'mimiciv')
            ->andReturn([]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients/10001/medications')
        ->assertOk()
        ->assertJsonStructure(['data']);
});

test('authenticated user can view patient lab results', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusPatientService::class, function ($mock) {
        $mock->shouldReceive('getLabResults')
            ->once()
            ->with('10001', null, 2000, 'mimiciv')
            ->andReturn([]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/patients/10001/lab-results')
        ->assertOk()
        ->assertJsonStructure(['data']);
});
