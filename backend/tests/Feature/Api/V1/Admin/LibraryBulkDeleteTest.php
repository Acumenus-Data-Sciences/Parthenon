<?php

namespace Tests\Feature\Api\V1\Admin;

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Phase D · Task D4 — POST /api/v1/admin/library/bulk-delete.
 *
 * Verifies: super-admin role gate, archived-only precondition,
 * Study-attachment preflight, audit_log write, and soft-delete behavior.
 */
class LibraryBulkDeleteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'viewer', 'guard_name' => 'web']);
    }

    public function test_non_super_admin_is_rejected(): void
    {
        $user = User::factory()->create();
        $user->assignRole('viewer');
        $set = ConceptSet::factory()->create(['status' => 'archived']);

        Sanctum::actingAs($user);
        $resp = $this->postJson('/api/v1/admin/library/bulk-delete', [
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $this->assertContains($resp->status(), [401, 403]);
    }

    public function test_blocks_when_item_not_archived(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'active']);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/bulk-delete', [
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertStatus(422);
        $this->assertEquals('must_be_archived', $resp->json('errors.0.error'));
        $this->assertDatabaseHas('concept_sets', ['id' => $set->id, 'deleted_at' => null]);
    }

    public function test_blocks_concept_set_when_attached_via_study_cohorts(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'archived']);

        $studyId = DB::table('studies')->insertGetId([
            'title' => 'Attached Study',
            'created_by' => $super->id,
            'status' => 'draft',
            'phase' => 'pre_study',
            'priority' => 'medium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('study_cohorts')->insert([
            'study_id' => $studyId,
            'cohort_definition_id' => CohortDefinition::factory()->create()->id,
            'role' => 'target',
            'label' => 'T',
            'concept_set_ids' => json_encode([$set->id]),
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/bulk-delete', [
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertStatus(422)
            ->assertJsonPath('blocked.0.id', $set->id)
            ->assertJsonPath('blocked.0.attached_to.0.study_id', $studyId);
        $this->assertDatabaseHas('concept_sets', ['id' => $set->id, 'deleted_at' => null]);
    }

    public function test_blocks_cohort_definition_when_attached_to_study(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $cohort = CohortDefinition::factory()->create(['status' => 'archived']);

        $studyId = DB::table('studies')->insertGetId([
            'title' => 'Cohort Owner',
            'created_by' => $super->id,
            'status' => 'draft',
            'phase' => 'pre_study',
            'priority' => 'medium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('study_cohorts')->insert([
            'study_id' => $studyId,
            'cohort_definition_id' => $cohort->id,
            'role' => 'target',
            'label' => 'T',
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/bulk-delete', [
            'items' => [['type' => 'cohort_definition', 'id' => $cohort->id]],
        ]);

        $resp->assertStatus(422)
            ->assertJsonPath('blocked.0.id', $cohort->id);
    }

    public function test_blocks_analysis_when_attached_via_study_analyses(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $analysis = IncidenceRateAnalysis::factory()->create(['status' => 'archived']);

        $studyId = DB::table('studies')->insertGetId([
            'title' => 'IR-Owner',
            'created_by' => $super->id,
            'status' => 'draft',
            'phase' => 'pre_study',
            'priority' => 'medium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('study_analyses')->insert([
            'study_id' => $studyId,
            'analysis_type' => 'incidence_rate_analysis',
            'analysis_id' => $analysis->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/bulk-delete', [
            'items' => [['type' => 'incidence_rate_analysis', 'id' => $analysis->id]],
        ]);

        $resp->assertStatus(422)
            ->assertJsonPath('blocked.0.id', $analysis->id);
    }

    public function test_succeeds_when_archived_and_no_attachments(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'archived']);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/bulk-delete', [
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertOk()
            ->assertJsonPath('deleted.0', $set->id);

        $this->assertSoftDeleted('concept_sets', ['id' => $set->id]);
        $this->assertDatabaseHas('audit_log', [
            'actor_id' => $super->id,
            'action' => 'library.hard_delete',
            'subject_type' => 'concept_set',
            'subject_id' => $set->id,
        ]);
    }

    public function test_validates_items_payload(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');

        Sanctum::actingAs($super);
        $this->postJson('/api/v1/admin/library/bulk-delete', ['items' => []])
            ->assertStatus(422);
        $this->postJson('/api/v1/admin/library/bulk-delete', [
            'items' => [['type' => 'not_a_type', 'id' => 1]],
        ])->assertStatus(422);
    }
}
