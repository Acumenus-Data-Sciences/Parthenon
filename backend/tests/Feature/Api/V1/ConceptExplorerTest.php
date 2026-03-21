<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\Investigation\ConceptSearchService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('requires authentication for concept search', function () {
    $this->getJson('/api/v1/concept-explorer/search?q=diabetes')
        ->assertStatus(401);
});

it('requires authentication for hierarchy lookup', function () {
    $this->getJson('/api/v1/concept-explorer/201826/hierarchy')
        ->assertStatus(401);
});

it('requires authentication for patient count', function () {
    $this->getJson('/api/v1/concept-explorer/201826/count')
        ->assertStatus(401);
});

it('returns empty results for short search queries', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $response = $this->actingAs($user)
        ->getJson('/api/v1/concept-explorer/search?q=a')
        ->assertStatus(200);

    $response->assertJsonPath('data', []);
});

it('searches concepts with valid query', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $mockResults = [
        [
            'concept_id' => 201826,
            'concept_name' => 'Type 2 diabetes mellitus',
            'domain_id' => 'Condition',
            'vocabulary_id' => 'SNOMED',
            'concept_class_id' => 'Clinical Finding',
            'standard_concept' => 'S',
            'concept_code' => '44054006',
        ],
    ];

    $this->mock(ConceptSearchService::class, function ($mock) use ($mockResults) {
        $mock->shouldReceive('search')
            ->once()
            ->with('diabetes', null, 25)
            ->andReturn($mockResults);
    });

    $response = $this->actingAs($user)
        ->getJson('/api/v1/concept-explorer/search?q=diabetes')
        ->assertStatus(200);

    $response->assertJsonPath('data.0.concept_id', 201826);
    $response->assertJsonPath('data.0.concept_name', 'Type 2 diabetes mellitus');
});

it('searches concepts with domain filter', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->mock(ConceptSearchService::class, function ($mock) {
        $mock->shouldReceive('search')
            ->once()
            ->with('aspirin', 'Drug', 25)
            ->andReturn([]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/concept-explorer/search?q=aspirin&domain=Drug')
        ->assertStatus(200)
        ->assertJsonPath('data', []);
});

it('retrieves concept hierarchy', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $mockHierarchy = [
        'ancestors' => [
            ['concept_id' => 4008453, 'concept_name' => 'Metabolic disease', 'level' => 3],
        ],
        'descendants' => [
            ['concept_id' => 443238, 'concept_name' => 'Diabetic complication', 'level' => 1],
        ],
    ];

    $this->mock(ConceptSearchService::class, function ($mock) use ($mockHierarchy) {
        $mock->shouldReceive('hierarchy')
            ->once()
            ->with(201826)
            ->andReturn($mockHierarchy);
    });

    $response = $this->actingAs($user)
        ->getJson('/api/v1/concept-explorer/201826/hierarchy')
        ->assertStatus(200);

    $response->assertJsonStructure(['data' => ['ancestors', 'descendants']]);
});

it('retrieves patient count for a concept', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->mock(ConceptSearchService::class, function ($mock) {
        $mock->shouldReceive('patientCount')
            ->once()
            ->with(201826)
            ->andReturn(['concept_id' => 201826, 'count' => 1542]);
    });

    $response = $this->actingAs($user)
        ->getJson('/api/v1/concept-explorer/201826/count')
        ->assertStatus(200);

    $response->assertJsonPath('data.concept_id', 201826);
    $response->assertJsonPath('data.count', 1542);
});
