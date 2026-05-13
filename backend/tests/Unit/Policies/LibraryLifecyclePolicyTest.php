<?php

namespace Tests\Unit\Policies;

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class LibraryLifecyclePolicyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
    }

    public function test_owner_can_promote_archive_restore_own_concept_set(): void
    {
        $owner = User::factory()->create();
        $set = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'draft']);

        $this->assertTrue($owner->can('promote', $set));
        $this->assertTrue($owner->can('archive', $set));
        $this->assertTrue($owner->can('restoreLifecycle', $set));
    }

    public function test_non_owner_cannot_promote_others_concept_set(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $set = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'draft']);

        $this->assertFalse($stranger->can('promote', $set));
        $this->assertFalse($stranger->can('archive', $set));
    }

    public function test_super_admin_can_act_on_others_items(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $owner = User::factory()->create();
        $set = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'active']);

        $this->assertTrue($super->can('archive', $set));
    }

    public function test_super_admin_can_hard_delete_archived(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $owner = User::factory()->create();
        $set = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'archived']);

        $this->assertTrue($super->can('hardDelete', $set));
    }

    public function test_super_admin_cannot_hard_delete_non_archived(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'active']);

        $this->assertFalse($super->can('hardDelete', $set));
    }

    public function test_regular_user_cannot_hard_delete_even_own_archived(): void
    {
        $owner = User::factory()->create();
        $set = ConceptSet::factory()->create(['author_id' => $owner->id, 'status' => 'archived']);

        $this->assertFalse($owner->can('hardDelete', $set));
    }

    public function test_policy_applies_to_cohort_definitions(): void
    {
        $owner = User::factory()->create();
        $cohort = CohortDefinition::factory()->create(['author_id' => $owner->id, 'status' => 'draft']);

        $this->assertTrue($owner->can('promote', $cohort));
    }
}
