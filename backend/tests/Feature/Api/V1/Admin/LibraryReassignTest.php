<?php

namespace Tests\Feature\Api\V1\Admin;

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Phase D · Task D6 — POST /api/v1/admin/library/reassign.
 *
 * Covers: super-admin gate, permission check on target, audit trail, and
 * the three permission domains (concept-sets, cohorts, analyses).
 */
class LibraryReassignTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'viewer', 'guard_name' => 'web']);
        foreach (['concept-sets.view', 'cohorts.view', 'analyses.view'] as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
    }

    public function test_non_super_admin_is_rejected(): void
    {
        $user = User::factory()->create();
        $user->assignRole('viewer');
        $target = User::factory()->create();

        Sanctum::actingAs($user);
        $resp = $this->postJson('/api/v1/admin/library/reassign', [
            'target_email' => $target->email,
            'items' => [['type' => 'concept_set', 'id' => 1]],
        ]);

        $this->assertContains($resp->status(), [401, 403]);
    }

    public function test_blocks_when_target_lacks_permission(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $target = User::factory()->create();
        // Target has NO permissions.
        $set = ConceptSet::factory()->create(['status' => 'active']);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/reassign', [
            'target_email' => $target->email,
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertStatus(422)
            ->assertJsonPath('blocked.0.error', 'target_missing_permission')
            ->assertJsonPath('blocked.0.required_permission', 'concept-sets.view');
        // Item ownership unchanged.
        $set->refresh();
        $this->assertNotEquals($target->id, $set->author_id);
    }

    public function test_succeeds_and_writes_audit_when_target_has_permission(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $original = User::factory()->create();
        $target = User::factory()->create();
        $target->givePermissionTo('concept-sets.view');

        $set = ConceptSet::factory()->create([
            'status' => 'active',
            'author_id' => $original->id,
        ]);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/reassign', [
            'target_email' => $target->email,
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertOk()
            ->assertJsonPath('reassigned.0.id', $set->id)
            ->assertJsonPath('target.email', $target->email);

        $this->assertDatabaseHas('concept_sets', [
            'id' => $set->id,
            'author_id' => $target->id,
        ]);
        $this->assertDatabaseHas('audit_log', [
            'actor_id' => $super->id,
            'action' => 'library.reassign',
            'subject_type' => 'concept_set',
            'subject_id' => $set->id,
        ]);
    }

    public function test_handles_per_type_permission_domains(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $target = User::factory()->create();
        $target->givePermissionTo(['cohorts.view', 'analyses.view']);
        // Deliberately NOT granting concept-sets.view.

        $cs = ConceptSet::factory()->create(['status' => 'active']);
        $cd = CohortDefinition::factory()->create(['status' => 'active']);
        $ir = IncidenceRateAnalysis::factory()->create(['status' => 'active']);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/reassign', [
            'target_email' => $target->email,
            'items' => [
                ['type' => 'concept_set', 'id' => $cs->id],
                ['type' => 'cohort_definition', 'id' => $cd->id],
                ['type' => 'incidence_rate_analysis', 'id' => $ir->id],
            ],
        ]);

        $resp->assertStatus(422)
            ->assertJsonPath('blocked.0.type', 'concept_set');
        // cohort + analysis went through despite the partial-block 422.
        $this->assertDatabaseHas('cohort_definitions', ['id' => $cd->id, 'author_id' => $target->id]);
        $this->assertDatabaseHas('incidence_rate_analyses', ['id' => $ir->id, 'author_id' => $target->id]);
        // concept set untouched.
        $cs->refresh();
        $this->assertNotEquals($target->id, $cs->author_id);
    }

    public function test_rejects_unknown_email(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/reassign', [
            'target_email' => 'nobody@example.test',
            'items' => [['type' => 'concept_set', 'id' => 1]],
        ]);

        $resp->assertStatus(422);
    }

    public function test_noop_when_target_already_owns_item(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $target = User::factory()->create();
        $target->givePermissionTo('concept-sets.view');

        $set = ConceptSet::factory()->create([
            'status' => 'active',
            'author_id' => $target->id,
        ]);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/reassign', [
            'target_email' => $target->email,
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertOk()
            ->assertJsonPath('reassigned.0.unchanged', true);
        // No audit row written for noop.
        $this->assertDatabaseMissing('audit_log', [
            'action' => 'library.reassign',
            'subject_id' => $set->id,
        ]);
    }
}
