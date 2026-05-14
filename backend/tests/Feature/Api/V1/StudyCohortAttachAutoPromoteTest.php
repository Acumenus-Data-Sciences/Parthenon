<?php

namespace Tests\Feature\Api\V1;

use App\Models\App\CohortDefinition;
use App\Models\App\Study;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class StudyCohortAttachAutoPromoteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        foreach (['studies.edit', 'studies.view', 'cohorts.edit', 'cohorts.view'] as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }
    }

    public function test_attaching_owner_draft_returns_409_with_contract(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo(['studies.edit', 'cohorts.edit']);
        Sanctum::actingAs($owner);

        $study = Study::factory()->create();
        $cohort = CohortDefinition::factory()->create([
            'author_id' => $owner->id,
            'status' => 'draft',
            'name' => 'My Draft',
        ]);

        $resp = $this->postJson("/api/v1/studies/{$study->slug}/cohorts", [
            'cohort_definition_id' => $cohort->id,
            'role' => 'target',
            'label' => 'Target cohort',
        ]);

        $resp->assertStatus(409)->assertJson([
            'requires_promotion' => true,
            'item_type' => 'cohort_definition',
            'item_id' => $cohort->id,
            'item_name' => 'My Draft',
        ]);
    }

    public function test_attaching_active_cohort_succeeds(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo(['studies.edit', 'cohorts.edit']);
        Sanctum::actingAs($owner);

        $study = Study::factory()->create();
        $cohort = CohortDefinition::factory()->create([
            'author_id' => $owner->id,
            'status' => 'active',
        ]);

        $this->postJson("/api/v1/studies/{$study->slug}/cohorts", [
            'cohort_definition_id' => $cohort->id,
            'role' => 'target',
            'label' => 'Target cohort',
        ])->assertSuccessful();
    }

    public function test_attaching_archived_cohort_returns_422(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo(['studies.edit', 'cohorts.edit']);
        Sanctum::actingAs($owner);

        $study = Study::factory()->create();
        $cohort = CohortDefinition::factory()->create([
            'author_id' => $owner->id,
            'status' => 'archived',
        ]);

        $this->postJson("/api/v1/studies/{$study->slug}/cohorts", [
            'cohort_definition_id' => $cohort->id,
            'role' => 'target',
            'label' => 'Target cohort',
        ])->assertStatus(422);
    }

    public function test_attaching_other_users_draft_returns_403(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $other->givePermissionTo(['studies.edit', 'cohorts.edit']);
        Sanctum::actingAs($other);

        $study = Study::factory()->create();
        $cohort = CohortDefinition::factory()->create([
            'author_id' => $owner->id,
            'status' => 'draft',
        ]);

        $this->postJson("/api/v1/studies/{$study->slug}/cohorts", [
            'cohort_definition_id' => $cohort->id,
            'role' => 'target',
            'label' => 'Target cohort',
        ])->assertForbidden();
    }
}
