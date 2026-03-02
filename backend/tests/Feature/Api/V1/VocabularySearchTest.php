<?php

use App\Models\App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Create vocab schema tables for testing
    // Note: In CI, these are created by migrations. Here we seed minimal test data.
    try {
        DB::connection('vocab')->statement("
            INSERT INTO vocab.vocabularies (vocabulary_id, vocabulary_name, vocabulary_reference, vocabulary_version, vocabulary_concept_id)
            VALUES ('SNOMED', 'Systematic Nomenclature of Medicine', 'SNOMED CT', '20230901', 44819096)
            ON CONFLICT DO NOTHING
        ");

        DB::connection('vocab')->statement("
            INSERT INTO vocab.domains (domain_id, domain_name, domain_concept_id)
            VALUES ('Condition', 'Condition', 19)
            ON CONFLICT DO NOTHING
        ");

        DB::connection('vocab')->statement("
            INSERT INTO vocab.concept_classes (concept_class_id, concept_class_name, concept_class_concept_id)
            VALUES ('Clinical Finding', 'Clinical Finding', 44818979)
            ON CONFLICT DO NOTHING
        ");

        DB::connection('vocab')->statement("
            INSERT INTO vocab.concepts (concept_id, concept_name, domain_id, vocabulary_id, concept_class_id, standard_concept, concept_code, valid_start_date, valid_end_date, invalid_reason)
            VALUES
                (201826, 'Type 2 diabetes mellitus', 'Condition', 'SNOMED', 'Clinical Finding', 'S', '44054006', '1970-01-01', '2099-12-31', NULL),
                (443238, 'Diabetic retinopathy', 'Condition', 'SNOMED', 'Clinical Finding', 'S', '4855003', '1970-01-01', '2099-12-31', NULL),
                (316139, 'Heart failure', 'Condition', 'SNOMED', 'Clinical Finding', 'S', '84114007', '1970-01-01', '2099-12-31', NULL)
            ON CONFLICT DO NOTHING
        ");
    } catch (\Exception $e) {
        // Tables may not exist in test environment without vocab migrations
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
