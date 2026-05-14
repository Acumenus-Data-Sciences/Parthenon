<?php

namespace Tests\Unit\Scopes;

use App\Models\App\Study;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StudyAccessibleByScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_sees_their_own_study_via_scope_accessible_by(): void
    {
        $user = User::factory()->create();
        $study = Study::factory()->create(['created_by' => $user->id]);

        $ids = Study::accessibleBy($user->id)->pluck('id')->all();

        $this->assertContains($study->id, $ids);
    }

    public function test_principal_investigator_sees_the_study_they_lead(): void
    {
        $pi = User::factory()->create();
        $study = Study::factory()->create(['principal_investigator_id' => $pi->id]);

        $ids = Study::accessibleBy($pi->id)->pluck('id')->all();

        $this->assertContains($study->id, $ids);
    }

    public function test_lead_data_scientist_sees_the_study_they_lead(): void
    {
        $ds = User::factory()->create();
        $study = Study::factory()->create(['lead_data_scientist_id' => $ds->id]);

        $ids = Study::accessibleBy($ds->id)->pluck('id')->all();

        $this->assertContains($study->id, $ids);
    }

    public function test_lead_statistician_sees_the_study_they_lead(): void
    {
        $stat = User::factory()->create();
        $study = Study::factory()->create(['lead_statistician_id' => $stat->id]);

        $ids = Study::accessibleBy($stat->id)->pluck('id')->all();

        $this->assertContains($study->id, $ids);
    }

    public function test_explicit_team_member_sees_the_study_via_team_members(): void
    {
        $member = User::factory()->create();
        $study = Study::factory()->create();

        DB::table('study_team_members')->insert([
            'study_id' => $study->id,
            'user_id' => $member->id,
            'role' => 'collaborator',
            'joined_at' => now(),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $ids = Study::accessibleBy($member->id)->pluck('id')->all();

        $this->assertContains($study->id, $ids);
    }

    public function test_outsider_does_not_see_the_study(): void
    {
        $outsider = User::factory()->create();
        $study = Study::factory()->create();

        $ids = Study::accessibleBy($outsider->id)->pluck('id')->all();

        $this->assertNotContains($study->id, $ids);
    }
}
