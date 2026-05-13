<?php

namespace Tests\Feature\Api\V1\Library;

use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BulkLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'concept-sets.edit', 'guard_name' => 'web']);
    }

    public function test_bulk_archive_archives_only_authorized_ids(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');

        $mine = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'active']);
        $theirs = ConceptSet::factory()->create(['author_id' => $other->id, 'status' => 'active']);

        Sanctum::actingAs($owner);

        $resp = $this->postJson('/api/v1/concept-sets/bulk-archive', [
            'ids' => [$mine->id, $theirs->id],
        ]);

        $resp->assertOk()->assertJson([
            'done' => [$mine->id],
            'skipped' => [$theirs->id],
            'missing' => [],
        ]);
        $this->assertSame('archived', $mine->fresh()->status->value);
        $this->assertSame('active', $theirs->fresh()->status->value);
    }

    public function test_bulk_restore_returns_round_trip(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');

        $a = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'archived']);
        $b = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'archived']);
        Sanctum::actingAs($owner);

        $resp = $this->postJson('/api/v1/concept-sets/bulk-restore', [
            'ids' => [$a->id, $b->id],
        ]);

        $resp->assertOk()->assertJsonCount(2, 'done');
        $this->assertSame('active', $a->fresh()->status->value);
        $this->assertSame('active', $b->fresh()->status->value);
    }

    public function test_bulk_archive_reports_missing_ids(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');
        Sanctum::actingAs($owner);

        $resp = $this->postJson('/api/v1/concept-sets/bulk-archive', [
            'ids' => [9999998, 9999999],
        ]);

        $resp->assertOk()->assertJson([
            'done' => [],
            'skipped' => [],
            'missing' => [9999998, 9999999],
        ]);
    }

    public function test_bulk_archive_validates_ids_required(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');
        Sanctum::actingAs($owner);

        $this->postJson('/api/v1/concept-sets/bulk-archive', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('ids');
    }
}
