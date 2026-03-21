<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\AiService;
use App\Services\Publication\PublicationService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('requires authentication for narrative generation', function () {
    $this->postJson('/api/v1/publish/narrative')
        ->assertStatus(401);
});

it('requires authentication for publication export', function () {
    $this->postJson('/api/v1/publish/export')
        ->assertStatus(401);
});

it('validates required fields for narrative generation', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/publish/narrative', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['section_type', 'context']);
});

it('validates section_type must be valid enum value', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/publish/narrative', [
            'section_type' => 'invalid_section',
            'context' => ['study_name' => 'Test'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['section_type']);
});

it('generates narrative text via AI service', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->mock(AiService::class, function ($mock) {
        $mock->shouldReceive('abbyChat')
            ->once()
            ->andReturn(['reply' => 'A retrospective cohort study was conducted using the OMOP CDM.']);
    });

    $response = $this->actingAs($user)
        ->postJson('/api/v1/publish/narrative', [
            'section_type' => 'methods',
            'context' => [
                'study_name' => 'SGLT2i and CKD',
                'data_source' => 'Acumenus CDM',
                'study_period' => '2015-2023',
            ],
        ])
        ->assertStatus(200);

    $response->assertJsonPath('data.section_type', 'methods');
    $response->assertJsonPath('data.text', 'A retrospective cohort study was conducted using the OMOP CDM.');
});

it('returns 503 when AI service is unavailable', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->mock(AiService::class, function ($mock) {
        $mock->shouldReceive('abbyChat')
            ->once()
            ->andThrow(new RuntimeException('Connection refused'));
    });

    $this->actingAs($user)
        ->postJson('/api/v1/publish/narrative', [
            'section_type' => 'results',
            'context' => ['results_summary' => 'HR 0.85 (0.72-0.99)'],
        ])
        ->assertStatus(503)
        ->assertJsonPath('message', 'AI service is unavailable. Please try again later.');
});

it('validates required fields for publication export', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/publish/export', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['template', 'format', 'title', 'authors', 'sections']);
});

it('validates export format must be valid enum value', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/publish/export', [
            'template' => 'generic-ohdsi',
            'format' => 'invalid_format',
            'title' => 'Test Publication',
            'authors' => ['Dr. Smith'],
            'sections' => [
                ['type' => 'methods', 'content' => 'Study methods...', 'included' => true],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['format']);
});

it('exports a publication document successfully', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->mock(PublicationService::class, function ($mock) {
        $mock->shouldReceive('export')
            ->once()
            ->andReturn(response()->json(['data' => ['url' => '/exports/test.docx']]));
    });

    $response = $this->actingAs($user)
        ->postJson('/api/v1/publish/export', [
            'template' => 'generic-ohdsi',
            'format' => 'docx',
            'title' => 'SGLT2i CKD Study Report',
            'authors' => ['Dr. Smith', 'Dr. Jones'],
            'sections' => [
                ['type' => 'title', 'content' => 'SGLT2i CKD Study', 'included' => true],
                ['type' => 'methods', 'content' => 'Study methods text...', 'included' => true],
                ['type' => 'results', 'content' => 'Results summary...', 'included' => true],
            ],
        ])
        ->assertStatus(200);
});
