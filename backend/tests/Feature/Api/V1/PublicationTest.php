<?php

declare(strict_types=1);

use App\Models\App\PublicationDraft;
use App\Models\App\PublicationReportBundle;
use App\Models\User;
use App\Services\AI\AnalyticsLlmService;
use App\Services\Publication\PublicationService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    $this->mock(AnalyticsLlmService::class, function ($mock) {
        $mock->shouldReceive('chat')
            ->once()
            ->andReturn('A retrospective cohort study was conducted using the OMOP CDM.');
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

    $this->mock(AnalyticsLlmService::class, function ($mock) {
        $mock->shouldReceive('chat')
            ->once()
            ->andThrow(new RuntimeException('Connection refused'));
    });

    $this->actingAs($user)
        ->postJson('/api/v1/publish/narrative', [
            'section_type' => 'results',
            'context' => ['results_summary' => 'HR 0.85 (0.72-0.99)'],
        ])
        ->assertStatus(503)
        ->assertJsonPath('message', 'AI narrative generation failed: Connection refused');
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
            ->andReturn(new StreamedResponse(function () {
                echo 'fake-docx-content';
            }, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition' => 'attachment; filename="export.docx"',
            ]));
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

it('supports publication draft lifecycle for the authenticated user', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $payload = [
        'title' => 'Draft manuscript',
        'template' => 'generic-ohdsi',
        'document_json' => [
            'step' => 2,
            'title' => 'Draft manuscript',
            'authors' => ['Dr. Smith'],
            'sections' => [],
            'selectedExecutions' => [],
            'template' => 'generic-ohdsi',
        ],
    ];

    $created = $this->actingAs($user)
        ->postJson('/api/v1/publish/drafts', $payload)
        ->assertCreated()
        ->assertJsonPath('data.title', 'Draft manuscript')
        ->json('data');

    $draftId = $created['id'];

    $this->actingAs($user)
        ->getJson('/api/v1/publish/drafts')
        ->assertOk()
        ->assertJsonPath('data.0.id', $draftId);

    $this->actingAs($user)
        ->patchJson("/api/v1/publish/drafts/{$draftId}", [
            'title' => 'Updated manuscript',
            'status' => 'ready',
        ])
        ->assertOk()
        ->assertJsonPath('data.title', 'Updated manuscript')
        ->assertJsonPath('data.status', 'ready');

    $otherUser = User::factory()->create();
    $otherUser->assignRole('researcher');

    $this->actingAs($otherUser)
        ->getJson("/api/v1/publish/drafts/{$draftId}")
        ->assertNotFound();

    $this->actingAs($user)
        ->deleteJson("/api/v1/publish/drafts/{$draftId}")
        ->assertNoContent();

    expect(PublicationDraft::query()->whereKey($draftId)->exists())->toBeFalse();
});

it('exports and imports OHDSI report bundles from the publish API', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $document = [
        'format' => 'ohdsi_report_bundle',
        'title' => 'Bundle manuscript',
        'template' => 'generic-ohdsi',
        'authors' => ['Dr. Smith'],
        'sections' => [
            [
                'type' => 'results',
                'title' => 'Results',
                'included' => true,
                'content' => 'Results text.',
            ],
        ],
    ];

    $response = $this->actingAs($user)
        ->postJson('/api/v1/publish/report-bundles/export', $document)
        ->assertOk();

    expect(PublicationReportBundle::query()->where('direction', 'export')->exists())->toBeTrue();

    $artifact = json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR);

    $this->actingAs($user)
        ->postJson('/api/v1/publish/report-bundles/import', [
            'format' => 'ohdsi_report_bundle',
            'artifact' => $artifact,
        ])
        ->assertCreated()
        ->assertJsonPath('data.draft.title', 'Bundle manuscript');

    expect(PublicationReportBundle::query()->where('direction', 'import')->exists())->toBeTrue();
});
