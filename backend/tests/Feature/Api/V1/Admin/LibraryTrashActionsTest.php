<?php

namespace Tests\Feature\Api\V1\Admin;

use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Phase D · Task D7 — TrashTab back-end actions.
 *
 * Covers POST /api/v1/admin/library/restore and /purge-now: super-admin
 * gate, must-be-in-trash precondition, and audit_log writes.
 */
class LibraryTrashActionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
    }

    public function test_restore_returns_soft_deleted_item_to_archived(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'archived']);
        $set->delete();
        $this->assertSoftDeleted('concept_sets', ['id' => $set->id]);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/restore', [
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertOk()->assertJsonPath('restored.0', $set->id);
        $this->assertDatabaseHas('concept_sets', ['id' => $set->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('audit_log', [
            'action' => 'library.restore',
            'subject_type' => 'concept_set',
            'subject_id' => $set->id,
        ]);
    }

    public function test_restore_rejects_non_trashed_items(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'active']);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/restore', [
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertStatus(422)->assertJsonPath('errors.0.error', 'not_in_trash');
    }

    public function test_purge_now_force_deletes_with_snapshot(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'archived']);
        $set->delete();

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/purge-now', [
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertOk()->assertJsonPath('purged.0', $set->id);
        $this->assertDatabaseMissing('concept_sets', ['id' => $set->id]);
        $row = DB::table('audit_log')
            ->where('action', 'library.purge_now')
            ->where('subject_id', $set->id)
            ->first();
        $this->assertNotNull($row);
        $this->assertNotNull($row->snapshot);
    }

    public function test_purge_now_rejects_non_trashed_items(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'archived']);

        Sanctum::actingAs($super);
        $resp = $this->postJson('/api/v1/admin/library/purge-now', [
            'items' => [['type' => 'concept_set', 'id' => $set->id]],
        ]);

        $resp->assertStatus(422)->assertJsonPath('errors.0.error', 'not_in_trash');
    }
}
