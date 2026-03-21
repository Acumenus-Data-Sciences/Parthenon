<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Seed minimal vocab data if the concept table is empty (CI environment).
    // In local dev, the omop schema already has 7M+ concepts — skip seeding.
    try {
        $count = DB::connection('omop')->table('concept')->count();
        if ($count === 0) {
            DB::connection('omop')->table('vocabulary')->insertOrIgnore([
                ['vocabulary_id' => 'SNOMED', 'vocabulary_name' => 'Systematic Nomenclature of Medicine', 'vocabulary_reference' => 'SNOMED CT', 'vocabulary_version' => '20230901', 'vocabulary_concept_id' => 44819096],
            ]);
            DB::connection('omop')->table('domain')->insertOrIgnore([
                ['domain_id' => 'Condition', 'domain_name' => 'Condition', 'domain_concept_id' => 19],
            ]);
            DB::connection('omop')->table('concept_class')->insertOrIgnore([
                ['concept_class_id' => 'Clinical Finding', 'concept_class_name' => 'Clinical Finding', 'concept_class_concept_id' => 44818979],
            ]);
            DB::connection('omop')->table('concept')->insertOrIgnore([
                ['concept_id' => 201826, 'concept_name' => 'Type 2 diabetes mellitus', 'domain_id' => 'Condition', 'vocabulary_id' => 'SNOMED', 'concept_class_id' => 'Clinical Finding', 'standard_concept' => 'S', 'concept_code' => '44054006', 'valid_start_date' => '1970-01-01', 'valid_end_date' => '2099-12-31', 'invalid_reason' => null],
                ['concept_id' => 443238, 'concept_name' => 'Diabetic retinopathy', 'domain_id' => 'Condition', 'vocabulary_id' => 'SNOMED', 'concept_class_id' => 'Clinical Finding', 'standard_concept' => 'S', 'concept_code' => '4855003', 'valid_start_date' => '1970-01-01', 'valid_end_date' => '2099-12-31', 'invalid_reason' => null],
                ['concept_id' => 316139, 'concept_name' => 'Heart failure', 'domain_id' => 'Condition', 'vocabulary_id' => 'SNOMED', 'concept_class_id' => 'Clinical Finding', 'standard_concept' => 'S', 'concept_code' => '84114007', 'valid_start_date' => '1970-01-01', 'valid_end_date' => '2099-12-31', 'invalid_reason' => null],
            ]);
        }
    } catch (Exception $e) {
        $this->markTestSkipped('Vocabulary tables not available: '.$e->getMessage());
    }
});

it('requires authentication for vocabulary search', function () {
    $this->getJson('/api/v1/vocabulary/search?q=diabetes')
        ->assertStatus(401);
});

it('validates search query parameter', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/vocabulary/search')
        ->assertStatus(422);
});

it('validates minimum query length', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/vocabulary/search?q=a')
        ->assertStatus(422);
});

it('searches concepts by name', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->getJson('/api/v1/vocabulary/search?q=diabetes')
        ->assertStatus(200);

    $response->assertJsonStructure([
        'data' => [
            '*' => ['concept_id', 'concept_name', 'domain_id', 'vocabulary_id'],
        ],
        'count',
    ]);

    expect($response->json('count'))->toBeGreaterThan(0);
});

it('filters concepts by domain', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->getJson('/api/v1/vocabulary/search?q=diabetes&domain=Condition')
        ->assertStatus(200);

    foreach ($response->json('data') as $concept) {
        expect($concept['domain_id'])->toBe('Condition');
    }
});

it('returns single concept with details', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/vocabulary/concepts/201826')
        ->assertStatus(200)
        ->assertJsonPath('data.concept_id', 201826)
        ->assertJsonPath('data.concept_name', 'Type 2 diabetes mellitus');
});

it('returns 404 for non-existent concept', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/vocabulary/concepts/999999999')
        ->assertStatus(404);
});
