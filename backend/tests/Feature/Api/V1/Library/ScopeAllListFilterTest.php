<?php

namespace Tests\Feature\Api\V1\Library;

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Phase D · Task D1 — list endpoints honor `?scope=all` for super-admin only.
 */
class ScopeAllListFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        foreach ([
            'concept-sets.view', 'concept-sets.create', 'concept-sets.edit',
            'cohorts.view', 'cohorts.create', 'cohorts.edit',
        ] as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }
    }

    public function test_super_admin_with_scope_all_sees_all_users_draft_concept_sets(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $other = User::factory()->create();

        ConceptSet::factory()->create([
            'author_id' => $other->id,
            'status' => 'draft',
            'name' => 'OtherDraftCS',
        ]);

        Sanctum::actingAs($super);
        $resp = $this->getJson('/api/v1/concept-sets?scope=all&status=draft');

        $resp->assertOk();
        $names = collect($resp->json('data'))->pluck('name')->all();
        $this->assertContains('OtherDraftCS', $names);
    }

    public function test_non_super_admin_scope_all_is_ignored_for_drafts(): void
    {
        $alice = User::factory()->create();
        $alice->givePermissionTo('concept-sets.view');
        $other = User::factory()->create();

        ConceptSet::factory()->create([
            'author_id' => $other->id,
            'status' => 'draft',
            'name' => 'OtherUserDraft',
        ]);

        Sanctum::actingAs($alice);
        $resp = $this->getJson('/api/v1/concept-sets?scope=all&status=draft');

        $resp->assertOk();
        $names = collect($resp->json('data'))->pluck('name')->all();
        $this->assertNotContains('OtherUserDraft', $names);
    }

    public function test_drafts_default_to_owner_only_for_non_super_admin(): void
    {
        $alice = User::factory()->create();
        $other = User::factory()->create();

        ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'draft', 'name' => 'MyDraft']);
        ConceptSet::factory()->create(['author_id' => $other->id, 'status' => 'draft', 'name' => 'OtherDraft']);

        Sanctum::actingAs($alice);
        $resp = $this->getJson('/api/v1/concept-sets?status=draft');

        $resp->assertOk();
        $names = collect($resp->json('data'))->pluck('name')->all();
        $this->assertContains('MyDraft', $names);
        $this->assertNotContains('OtherDraft', $names);
    }

    public function test_super_admin_with_scope_all_sees_other_users_archived_cohorts(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $other = User::factory()->create();

        CohortDefinition::factory()->create([
            'author_id' => $other->id,
            'status' => 'archived',
            'name' => 'OtherArchivedCD',
        ]);

        Sanctum::actingAs($super);
        $resp = $this->getJson('/api/v1/cohort-definitions?scope=all&status=archived');

        $resp->assertOk();
        $names = collect($resp->json('data'))->pluck('name')->all();
        $this->assertContains('OtherArchivedCD', $names);
    }

    public function test_active_tab_shows_other_users_active_for_normal_users(): void
    {
        $alice = User::factory()->create();
        $other = User::factory()->create();

        ConceptSet::factory()->create(['author_id' => $other->id, 'status' => 'active', 'name' => 'PublicActive']);

        Sanctum::actingAs($alice);
        $resp = $this->getJson('/api/v1/concept-sets?status=active');

        $resp->assertOk();
        $names = collect($resp->json('data'))->pluck('name')->all();
        $this->assertContains('PublicActive', $names);
    }
}
