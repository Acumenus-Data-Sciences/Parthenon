<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplatesControllerCancelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);

        // Default registry mock so the controller can resolve from the
        // container even on permission-denied paths; tests override.
        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldIgnoreMissing();
        $this->app->instance(TemplateRegistryClient::class, $registry);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_cancel_requires_ingestion_delete(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);

        $this->actingAs($user)
            ->deleteJson('/api/v1/ingestion/templates/runs/'.$run->id)
            ->assertStatus(403);
    }

    public function test_cancel_with_permission_calls_python_and_marks_cancelled(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['ingestion.view', 'ingestion.delete']);
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '22222222-2222-2222-2222-222222222222',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('cancelRun')->with('22222222-2222-2222-2222-222222222222')->andReturn(['status' => 'cancelled']);
        // After cancel, the service polls upstream once to reconcile state.
        // For this test the run was already in RUNNING locally, so upstream
        // returning the same RUNNING/CANCELLED is fine — anything non-terminal
        // means the service falls back to optimistic CANCELLED.
        $registry->shouldReceive('getRun')->andReturn(['status' => 'cancelled']);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->deleteJson('/api/v1/ingestion/templates/runs/'.$run->id)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('id', $run->id)
            ->assertJsonPath('status', TemplateRun::STATUS_CANCELLED);

        $this->assertSame(TemplateRun::STATUS_CANCELLED, $run->refresh()->status);
    }
}
