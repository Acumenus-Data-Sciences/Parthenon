<?php

use App\Models\App\EvidencePin;
use App\Models\App\Investigation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates a pin for an investigation', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $response = $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/pins", [
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['cohort_name' => 'T2DM', 'count' => 59226],
    ]);

    $response->assertStatus(201);
    $response->assertJsonPath('domain', 'phenotype');
    $this->assertDatabaseCount('evidence_pins', 1);
});

it('lists pins for an investigation', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'Test'],
    ]);

    $response = $this->actingAs($user)->getJson("/api/v1/investigations/{$inv->id}/pins");

    $response->assertStatus(200);
    $response->assertJsonCount(1, 'data');
});

it('updates a pin', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);
    $pin = EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'Test'],
    ]);

    $response = $this->actingAs($user)->patchJson(
        "/api/v1/investigations/{$inv->id}/pins/{$pin->id}",
        ['is_key_finding' => true, 'narrative_before' => 'This cohort represents...'],
    );

    $response->assertStatus(200);
    $response->assertJsonPath('data.is_key_finding', true);
});

it('deletes a pin', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);
    $pin = EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'Test'],
    ]);

    $response = $this->actingAs($user)->deleteJson("/api/v1/investigations/{$inv->id}/pins/{$pin->id}");

    $response->assertStatus(204);
    $this->assertDatabaseCount('evidence_pins', 0);
});

it('rejects invalid domain', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $response = $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/pins", [
        'domain' => 'invalid',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'Test'],
    ]);

    $response->assertStatus(422);
});

it('auto-increments sort_order within a section', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/pins", [
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'First'],
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/pins", [
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'codewas_hit',
        'finding_payload' => ['name' => 'Second'],
    ]);

    $response->assertStatus(201);
    $response->assertJsonPath('sort_order', 1);
});
