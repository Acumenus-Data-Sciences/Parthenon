<?php

use App\Models\App\EvidencePin;
use App\Models\App\Investigation;
use App\Models\App\InvestigationVersion;
use App\Models\User;
use App\Services\Investigation\InvestigationExportService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ── Export JSON ───────────────────────────────────────────────────────────────

it('exports investigation as JSON with correct structure', function () {
    $user = User::factory()->create();
    $inv = Investigation::create([
        'title' => 'CKD Study',
        'research_question' => 'Does intervention reduce progression?',
        'owner_id' => $user->id,
        'status' => 'active',
    ]);

    EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'phenotype',
        'section' => 'cohort',
        'finding_type' => 'cohort_definition',
        'finding_payload' => ['name' => 'CKD Cohort', 'count' => 1500],
        'sort_order' => 1,
        'is_key_finding' => true,
    ]);

    $response = $this->actingAs($user)->getJson("/api/v1/investigations/{$inv->id}/export/json");

    $response->assertStatus(200);
    $response->assertJsonStructure([
        'meta' => ['id', 'title', 'research_question', 'status', 'owner', 'exported_at', 'version'],
        'key_findings',
        'sections' => ['phenotype', 'clinical', 'genomic', 'synthesis'],
    ]);
    $response->assertJsonPath('meta.title', 'CKD Study');
    $response->assertJsonPath('meta.status', 'active');

    // key findings should include the pin
    $keyFindings = $response->json('key_findings');
    expect($keyFindings)->toHaveCount(1);
    expect($keyFindings[0]['finding_type'])->toBe('cohort_definition');
});

it('export JSON returns 403 for non-owner', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $inv = Investigation::create(['title' => 'Private', 'owner_id' => $owner->id, 'status' => 'draft']);

    $this->actingAs($other)->getJson("/api/v1/investigations/{$inv->id}/export/json")
        ->assertStatus(403);
});

// ── Export PDF ────────────────────────────────────────────────────────────────

it('exports investigation as PDF or HTML fallback', function () {
    $user = User::factory()->create();
    $inv = Investigation::create([
        'title' => 'SGLT2i Study',
        'owner_id' => $user->id,
        'status' => 'active',
    ]);

    // Mock the export service so Blade doesn't need to compile in test env
    // (storage/framework/views is owned by the Docker user in this environment)
    $mock = Mockery::mock(InvestigationExportService::class);
    $mock->shouldReceive('toPdf')->andReturn(null);
    $mock->shouldReceive('toPdfHtml')->andReturn('<html><body>Test dossier for SGLT2i Study</body></html>');
    $this->app->instance(InvestigationExportService::class, $mock);

    $response = $this->actingAs($user)->get("/api/v1/investigations/{$inv->id}/export/pdf");

    // Either PDF (200 with application/pdf) or HTML fallback (200 with text/html)
    $response->assertStatus(200);
    $contentType = $response->headers->get('Content-Type') ?? '';
    expect(str_contains($contentType, 'pdf') || str_contains($contentType, 'html'))->toBeTrue();
});

it('export PDF returns 403 for non-owner', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $inv = Investigation::create(['title' => 'Private', 'owner_id' => $owner->id, 'status' => 'draft']);

    $this->actingAs($other)->getJson("/api/v1/investigations/{$inv->id}/export/pdf")
        ->assertStatus(403);
});

// ── Versions ──────────────────────────────────────────────────────────────────

it('creates a manual version snapshot via POST', function () {
    $user = User::factory()->create();
    $inv = Investigation::create([
        'title' => 'Study A',
        'owner_id' => $user->id,
        'status' => 'active',
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/versions");

    $response->assertStatus(201);
    $response->assertJsonPath('data.version_number', 1);
    $response->assertJsonPath('data.investigation_id', $inv->id);

    $this->assertDatabaseHas('investigation_versions', [
        'investigation_id' => $inv->id,
        'version_number' => 1,
        'created_by' => $user->id,
    ]);
});

it('increments version_number on successive snapshots', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Study B', 'owner_id' => $user->id, 'status' => 'active']);

    $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/versions")->assertStatus(201);
    $second = $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/versions");

    $second->assertStatus(201);
    $second->assertJsonPath('data.version_number', 2);
});

it('lists versions ordered by version_number descending', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Study C', 'owner_id' => $user->id, 'status' => 'active']);

    InvestigationVersion::create([
        'investigation_id' => $inv->id,
        'version_number' => 1,
        'snapshot' => ['title' => 'v1'],
        'created_by' => $user->id,
    ]);
    InvestigationVersion::create([
        'investigation_id' => $inv->id,
        'version_number' => 2,
        'snapshot' => ['title' => 'v2'],
        'created_by' => $user->id,
    ]);

    $response = $this->actingAs($user)->getJson("/api/v1/investigations/{$inv->id}/versions");

    $response->assertStatus(200);
    $response->assertJsonCount(2, 'data');
    // First in list should be highest version number (descending order)
    expect($response->json('data.0.version_number'))->toBe(2);
    expect($response->json('data.1.version_number'))->toBe(1);
});

it('retrieves a specific version by version number', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Study D', 'owner_id' => $user->id, 'status' => 'active']);

    InvestigationVersion::create([
        'investigation_id' => $inv->id,
        'version_number' => 1,
        'snapshot' => ['title' => 'v1 snapshot'],
        'created_by' => $user->id,
    ]);

    $response = $this->actingAs($user)->getJson("/api/v1/investigations/{$inv->id}/versions/1");

    $response->assertStatus(200);
    $response->assertJsonPath('data.version_number', 1);
    $response->assertJsonPath('data.snapshot.title', 'v1 snapshot');
});

it('returns 404 for missing version number', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Study E', 'owner_id' => $user->id, 'status' => 'active']);

    $this->actingAs($user)->getJson("/api/v1/investigations/{$inv->id}/versions/99")
        ->assertStatus(404);
});

it('auto-creates version when investigation is marked complete', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Study F', 'owner_id' => $user->id, 'status' => 'active']);

    expect(InvestigationVersion::where('investigation_id', $inv->id)->count())->toBe(0);

    $this->actingAs($user)->patchJson("/api/v1/investigations/{$inv->id}", [
        'status' => 'complete',
    ])->assertStatus(200);

    expect(InvestigationVersion::where('investigation_id', $inv->id)->count())->toBe(1);
    $version = InvestigationVersion::where('investigation_id', $inv->id)->first();
    expect($version->snapshot['status'])->toBe('complete');
    expect($version->version_number)->toBe(1);
});

it('versions endpoint returns 403 for non-owner', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $inv = Investigation::create(['title' => 'Private', 'owner_id' => $owner->id, 'status' => 'draft']);

    $this->actingAs($other)->getJson("/api/v1/investigations/{$inv->id}/versions")
        ->assertStatus(403);

    $this->actingAs($other)->postJson("/api/v1/investigations/{$inv->id}/versions")
        ->assertStatus(403);

    $this->actingAs($other)->getJson("/api/v1/investigations/{$inv->id}/versions/1")
        ->assertStatus(403);
});
