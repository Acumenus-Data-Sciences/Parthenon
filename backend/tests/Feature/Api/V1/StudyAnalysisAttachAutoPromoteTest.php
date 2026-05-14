<?php

namespace Tests\Feature\Api\V1;

use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\Study;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class StudyAnalysisAttachAutoPromoteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        foreach (['studies.edit', 'studies.create', 'analyses.edit', 'analyses.create'] as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }
    }

    public function test_attaching_owner_draft_analysis_returns_409(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo(['studies.create', 'analyses.create']);
        Sanctum::actingAs($owner);

        $study = Study::factory()->create();
        $analysis = IncidenceRateAnalysis::factory()->create([
            'author_id' => $owner->id,
            'status' => 'draft',
            'name' => 'My Draft IR',
        ]);

        $this->postJson("/api/v1/studies/{$study->slug}/analyses", [
            'analysis_type' => 'incidence_rate',
            'analysis_id' => $analysis->id,
        ])->assertStatus(409)->assertJson([
            'requires_promotion' => true,
            'item_type' => 'incidence_rate_analysis',
            'item_id' => $analysis->id,
            'item_name' => 'My Draft IR',
        ]);
    }

    public function test_attaching_active_analysis_succeeds(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo(['studies.create', 'analyses.create']);
        Sanctum::actingAs($owner);

        $study = Study::factory()->create();
        $analysis = IncidenceRateAnalysis::factory()->create([
            'author_id' => $owner->id,
            'status' => 'active',
        ]);

        $this->postJson("/api/v1/studies/{$study->slug}/analyses", [
            'analysis_type' => 'incidence_rate',
            'analysis_id' => $analysis->id,
        ])->assertSuccessful();
    }
}
