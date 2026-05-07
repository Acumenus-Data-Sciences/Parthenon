<?php

declare(strict_types=1);

use App\Models\App\MappingReviewQueueItem;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);

    // Plan 7 reviewer queue migration ran via RefreshDatabase, but the
    // app.parthenon_concept_map and vocab.concept tables are referenced
    // by the controller. Seed a single standard concept that approve flows
    // can validate against.
    DB::statement(<<<'SQL'
        INSERT INTO vocab.concept (
            concept_id, concept_name, domain_id, vocabulary_id, concept_class_id,
            standard_concept, concept_code, valid_start_date, valid_end_date
        )
        VALUES
            (4193704, 'Glucose [Mass/volume] in Serum or Plasma', 'Measurement', 'LOINC', 'Lab Test',
                'S', '2345-7', '1970-01-01', '2099-12-31'),
            (4001234, 'Hypertensive disorder', 'Condition', 'SNOMED', 'Clinical Finding',
                'S', '38341003', '1970-01-01', '2099-12-31'),
            (4099999, 'Non-standard concept (must be rejected)', 'Condition', 'SNOMED', 'Clinical Finding',
                NULL, 'foo', '1970-01-01', '2099-12-31')
        ON CONFLICT (concept_id) DO NOTHING
    SQL);
});

function harmoniaUser(string $role): User
{
    $user = User::factory()->create();
    $user->assignRole($role);

    return $user;
}

function harmoniaQueueRow(array $overrides = []): MappingReviewQueueItem
{
    return MappingReviewQueueItem::factory()->create(array_merge([
        'source_code' => 'GLUC-FASTING',
        'source_vocab' => 'LOCAL_LIS',
        'source_text' => 'Fasting glucose, plasma',
        'top1_confidence' => 0.91,
        'candidate_ranking_json' => [
            ['concept_id' => 4193704, 'concept_name' => 'Glucose [Mass/volume] in Serum or Plasma',
                'vocabulary_id' => 'LOINC', 'domain_id' => 'Measurement', 'similarity' => 0.91],
            ['concept_id' => 4001234, 'concept_name' => 'Hypertensive disorder',
                'vocabulary_id' => 'SNOMED', 'domain_id' => 'Condition', 'similarity' => 0.62],
        ],
    ], $overrides));
}

it('lists pending queue rows by default with pagination metadata', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    harmoniaQueueRow(['source_code' => 'A', 'top1_confidence' => 0.55]);
    harmoniaQueueRow(['source_code' => 'B', 'top1_confidence' => 0.91]);
    // approved row should be hidden when status filter defaults to 'pending'
    harmoniaQueueRow(['source_code' => 'C', 'status' => MappingReviewQueueItem::STATUS_APPROVED]);

    $resp = $this->actingAs($reviewer)->getJson('/api/v1/mapping-review/queue');

    $resp->assertOk()
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('data.0.source_code', 'A')  // sort_by=confidence_asc default
        ->assertJsonPath('data.1.source_code', 'B')
        ->assertJsonStructure(['data' => [['queue_id', 'top_candidate', 'top1_confidence', 'status']]]);
});

it('filters queue by source_vocab', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    harmoniaQueueRow(['source_code' => 'X', 'source_vocab' => 'ICD10CM']);
    harmoniaQueueRow(['source_code' => 'Y', 'source_vocab' => 'NDC']);

    $resp = $this->actingAs($reviewer)->getJson('/api/v1/mapping-review/queue?source_vocab=NDC');

    $resp->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.source_code', 'Y');
});

it('returns aggregate stats counts by status', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    harmoniaQueueRow(['source_code' => 'P1']);
    harmoniaQueueRow(['source_code' => 'P2']);
    harmoniaQueueRow(['source_code' => 'A1', 'status' => MappingReviewQueueItem::STATUS_APPROVED]);
    harmoniaQueueRow(['source_code' => 'R1', 'status' => MappingReviewQueueItem::STATUS_REJECTED]);

    $resp = $this->actingAs($reviewer)->getJson('/api/v1/mapping-review/queue/stats');

    $resp->assertOk()
        ->assertJsonPath('data.pending', 2)
        ->assertJsonPath('data.approved', 1)
        ->assertJsonPath('data.rejected', 1)
        ->assertJsonPath('data.escalated', 0);
});

it('returns the full candidate list on detail with hydrated concept-name', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    $row = harmoniaQueueRow();

    $resp = $this->actingAs($reviewer)->getJson("/api/v1/mapping-review/queue/{$row->queue_id}");

    $resp->assertOk()
        ->assertJsonPath('data.queue_id', $row->queue_id)
        ->assertJsonCount(2, 'data.candidates')
        ->assertJsonPath('data.candidates.0.concept_id', 4193704)
        ->assertJsonPath('data.candidates.0.standard_concept', 'S')
        ->assertJsonPath('data.candidates.0.concept_still_valid', true);
});

it('approves a candidate and writes to parthenon_concept_map', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    $row = harmoniaQueueRow();

    $resp = $this->actingAs($reviewer)->postJson(
        "/api/v1/mapping-review/queue/{$row->queue_id}/approve",
        ['concept_id' => 4193704]
    );

    $resp->assertOk()
        ->assertJsonPath('data.status', MappingReviewQueueItem::STATUS_APPROVED)
        ->assertJsonPath('data.approved_concept_id', 4193704);

    $mapped = DB::selectOne(
        'SELECT omop_concept_id, reviewer_id FROM app.parthenon_concept_map WHERE source_code = ? AND source_vocab = ?',
        [$row->source_code, $row->source_vocab]
    );
    expect($mapped)->not->toBeNull();
    expect((int) $mapped->omop_concept_id)->toBe(4193704);
    expect((int) $mapped->reviewer_id)->toBe($reviewer->id);
});

it('refuses to approve a concept_id not in the candidate set', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    $row = harmoniaQueueRow();  // candidates are 4193704, 4001234

    $resp = $this->actingAs($reviewer)->postJson(
        "/api/v1/mapping-review/queue/{$row->queue_id}/approve",
        ['concept_id' => 4193705]  // not in candidate list
    );

    $resp->assertStatus(422);
    expect($row->fresh()->status)->toBe(MappingReviewQueueItem::STATUS_PENDING);
});

it('refuses to approve a non-standard concept (validation layer)', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    $row = harmoniaQueueRow([
        'candidate_ranking_json' => [
            ['concept_id' => 4099999, 'concept_name' => 'Non-standard',
                'vocabulary_id' => 'SNOMED', 'domain_id' => 'Condition', 'similarity' => 0.91],
        ],
    ]);

    $resp = $this->actingAs($reviewer)->postJson(
        "/api/v1/mapping-review/queue/{$row->queue_id}/approve",
        ['concept_id' => 4099999]
    );

    $resp->assertStatus(422)
        ->assertJsonValidationErrors(['concept_id']);
});

it('rejects a queue row with a reason and preserves the row', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    $row = harmoniaQueueRow();

    $resp = $this->actingAs($reviewer)->postJson(
        "/api/v1/mapping-review/queue/{$row->queue_id}/reject",
        ['rejection_reason' => 'Source code refers to a panel; needs decomposition before mapping.']
    );

    $resp->assertOk()
        ->assertJsonPath('data.status', MappingReviewQueueItem::STATUS_REJECTED)
        ->assertJsonPath('data.rejection_reason', 'Source code refers to a panel; needs decomposition before mapping.');

    $count = DB::scalar('SELECT COUNT(*) FROM app.parthenon_concept_map WHERE source_code = ?', [$row->source_code]);
    expect((int) $count)->toBe(0);
});

it('escalates a queue row and sets escalated_at', function () {
    $reviewer = harmoniaUser('mapping-reviewer');
    $row = harmoniaQueueRow();

    $resp = $this->actingAs($reviewer)->postJson(
        "/api/v1/mapping-review/queue/{$row->queue_id}/escalate",
        ['note' => 'Two candidates equally plausible; need senior clinical review.']
    );

    $resp->assertOk()
        ->assertJsonPath('data.status', MappingReviewQueueItem::STATUS_ESCALATED);

    $fresh = $row->fresh();
    expect($fresh->escalated_at)->not->toBeNull();
});

it('denies viewer-role users for any queue route (RBAC)', function () {
    $viewer = harmoniaUser('viewer');
    $row = harmoniaQueueRow();

    $this->actingAs($viewer)->getJson('/api/v1/mapping-review/queue')->assertForbidden();
    $this->actingAs($viewer)->getJson("/api/v1/mapping-review/queue/{$row->queue_id}")->assertForbidden();
    $this->actingAs($viewer)->postJson(
        "/api/v1/mapping-review/queue/{$row->queue_id}/approve",
        ['concept_id' => 4193704]
    )->assertForbidden();
});

it('denies unauthenticated requests', function () {
    $row = harmoniaQueueRow();

    $this->getJson('/api/v1/mapping-review/queue')->assertUnauthorized();
    $this->getJson("/api/v1/mapping-review/queue/{$row->queue_id}")->assertUnauthorized();
    $this->postJson("/api/v1/mapping-review/queue/{$row->queue_id}/approve", ['concept_id' => 4193704])
        ->assertUnauthorized();
});

it('allows mapping.review without mapping.approve to read but not write', function () {
    // Custom role with read-only mapping.review.
    $role = Role::findOrCreate('readonly-mapping');
    $role->givePermissionTo(['mapping.review']);

    $user = User::factory()->create();
    $user->assignRole('readonly-mapping');

    $row = harmoniaQueueRow();

    $this->actingAs($user)->getJson('/api/v1/mapping-review/queue')->assertOk();
    $this->actingAs($user)->postJson(
        "/api/v1/mapping-review/queue/{$row->queue_id}/approve",
        ['concept_id' => 4193704]
    )->assertForbidden();
});
