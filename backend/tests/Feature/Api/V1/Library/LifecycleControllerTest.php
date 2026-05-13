<?php

namespace Tests\Feature\Api\V1\Library;

use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class LifecycleControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'concept-sets.edit', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'concept-sets.view', 'guard_name' => 'web']);
    }

    public function test_owner_can_promote_draft_concept_set(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');
        $set = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'draft']);
        Sanctum::actingAs($owner);

        $resp = $this->postJson("/api/v1/concept-sets/{$set->id}/promote");

        $resp->assertOk()->assertJson(['id' => $set->id, 'status' => 'active']);
        $this->assertSame('active', $set->fresh()->status->value);
    }

    public function test_non_owner_promote_returns_403(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $other->givePermissionTo('concept-sets.edit');
        $set = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'draft']);
        Sanctum::actingAs($other);

        $this->postJson("/api/v1/concept-sets/{$set->id}/promote")->assertForbidden();
    }

    public function test_archive_then_restore_round_trip(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');
        $set = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'active']);
        Sanctum::actingAs($owner);

        $this->postJson("/api/v1/concept-sets/{$set->id}/archive")->assertOk();
        $this->assertSame('archived', $set->fresh()->status->value);

        $this->postJson("/api/v1/concept-sets/{$set->id}/restore")->assertOk();
        $this->assertSame('active', $set->fresh()->status->value);
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $set = ConceptSet::factory()->create(['status' => 'draft']);
        $this->postJson("/api/v1/concept-sets/{$set->id}/promote")->assertUnauthorized();
    }

    public function test_unknown_entity_returns_404(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');
        Sanctum::actingAs($owner);

        $this->postJson('/api/v1/concept-sets/9999999/promote')->assertNotFound();
    }
}
