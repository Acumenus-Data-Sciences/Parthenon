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
 * Phase D · Task D3 — /api/v1/admin/library unified index.
 */
class LibraryControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        foreach (['concept-sets.view', 'cohorts.view', 'analyses.view'] as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }
    }

    public function test_unified_index_returns_rows_across_types(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $owner = User::factory()->create();

        ConceptSet::factory()->create([
            'name' => 'CS-X',
            'author_id' => $owner->id,
            'status' => 'active',
        ]);
        CohortDefinition::factory()->create([
            'name' => 'CD-Y',
            'author_id' => $owner->id,
            'status' => 'draft',
        ]);
        IncidenceRateAnalysis::factory()->create([
            'name' => 'IR-Z',
            'author_id' => $owner->id,
            'status' => 'archived',
        ]);

        Sanctum::actingAs($super);
        $resp = $this->getJson('/api/v1/admin/library');

        $resp->assertOk();
        $names = collect($resp->json('data'))->pluck('name')->all();
        $this->assertContains('CS-X', $names);
        $this->assertContains('CD-Y', $names);
        $this->assertContains('IR-Z', $names);
    }

    public function test_non_super_admin_is_forbidden(): void
    {
        $alice = User::factory()->create();
        $alice->assignRole('admin'); // admin role is NOT super-admin
        Sanctum::actingAs($alice);
        $this->getJson('/api/v1/admin/library')->assertForbidden();
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/v1/admin/library')->assertUnauthorized();
    }

    public function test_type_filter_restricts_to_single_table(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $owner = User::factory()->create();

        ConceptSet::factory()->create(['name' => 'CS-only', 'author_id' => $owner->id]);
        CohortDefinition::factory()->create(['name' => 'CD-excluded', 'author_id' => $owner->id]);

        Sanctum::actingAs($super);
        $resp = $this->getJson('/api/v1/admin/library?type=concept_set');

        $resp->assertOk();
        $rows = collect($resp->json('data'));
        $this->assertTrue($rows->every(fn ($r) => $r['item_type'] === 'concept_set'));
        $this->assertContains('CS-only', $rows->pluck('name')->all());
    }

    public function test_owner_filter_restricts_results(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $owner = User::factory()->create();
        $other = User::factory()->create();

        ConceptSet::factory()->create(['name' => 'Mine', 'author_id' => $owner->id]);
        ConceptSet::factory()->create(['name' => 'NotMine', 'author_id' => $other->id]);

        Sanctum::actingAs($super);
        $resp = $this->getJson('/api/v1/admin/library?type=concept_set&owner_id='.$owner->id);

        $resp->assertOk();
        $names = collect($resp->json('data'))->pluck('name')->all();
        $this->assertContains('Mine', $names);
        $this->assertNotContains('NotMine', $names);
    }

    public function test_status_filter_restricts_to_archived(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');

        ConceptSet::factory()->create(['name' => 'A-live', 'status' => 'active']);
        ConceptSet::factory()->create(['name' => 'A-arch', 'status' => 'archived']);

        Sanctum::actingAs($super);
        $resp = $this->getJson('/api/v1/admin/library?type=concept_set&status=archived');

        $resp->assertOk();
        $names = collect($resp->json('data'))->pluck('name')->all();
        $this->assertContains('A-arch', $names);
        $this->assertNotContains('A-live', $names);
    }

    public function test_include_trash_returns_soft_deleted_rows(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');

        $alive = ConceptSet::factory()->create(['name' => 'alive', 'status' => 'archived']);
        $trashed = ConceptSet::factory()->create(['name' => 'trashed', 'status' => 'archived']);
        $trashed->delete(); // SoftDeletes

        Sanctum::actingAs($super);

        $defaultResp = $this->getJson('/api/v1/admin/library?type=concept_set');
        $defaultNames = collect($defaultResp->json('data'))->pluck('name')->all();
        $this->assertContains('alive', $defaultNames);
        $this->assertNotContains('trashed', $defaultNames);

        $trashResp = $this->getJson('/api/v1/admin/library?type=concept_set&include_trash=1');
        $trashNames = collect($trashResp->json('data'))->pluck('name')->all();
        $this->assertContains('trashed', $trashNames);
        $this->assertNotContains('alive', $trashNames);
    }

    public function test_rows_include_owner_details(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $owner = User::factory()->create(['name' => 'Erika Owner', 'email' => 'erika@example.org']);

        ConceptSet::factory()->create(['name' => 'CS-with-owner', 'author_id' => $owner->id]);

        Sanctum::actingAs($super);
        $resp = $this->getJson('/api/v1/admin/library?type=concept_set');
        $resp->assertOk();

        $row = collect($resp->json('data'))->firstWhere('name', 'CS-with-owner');
        $this->assertNotNull($row);
        $this->assertSame('Erika Owner', $row['owner']['name'] ?? null);
        $this->assertSame('erika@example.org', $row['owner']['email'] ?? null);
    }
}
