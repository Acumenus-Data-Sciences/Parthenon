<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TemplateRunModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_status_constants_match_check_constraint(): void
    {
        $this->assertSame('pending', TemplateRun::STATUS_PENDING);
        $this->assertSame('queued', TemplateRun::STATUS_QUEUED);
        $this->assertSame('running', TemplateRun::STATUS_RUNNING);
        $this->assertSame('completed', TemplateRun::STATUS_COMPLETED);
        $this->assertSame('failed', TemplateRun::STATUS_FAILED);
        $this->assertSame('cancelled', TemplateRun::STATUS_CANCELLED);
    }

    public function test_fillable_whitelist_is_set(): void
    {
        $run = new TemplateRun;
        $expected = [
            'template_id',
            'template_version',
            'parameters',
            'status',
            'progress',
            'current_node',
            'prefect_run_id',
            'error_message',
            'post_conditions',
            'artifacts_path',
            'submitted_by',
            'submitted_at',
            'started_at',
            'finished_at',
            'correlation_id',
        ];
        $this->assertSame($expected, $run->getFillable());
    }

    public function test_casts_parameters_and_post_conditions_as_arrays(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => ['target_schema' => 'eunomia'],
            'status' => TemplateRun::STATUS_PENDING,
            'post_conditions' => [['kind' => 'row_count', 'status' => 'pending']],
            'submitted_by' => $user->id,
        ]);

        $fresh = TemplateRun::find($run->id);
        $this->assertIsArray($fresh->parameters);
        $this->assertSame('eunomia', $fresh->parameters['target_schema']);
        $this->assertIsArray($fresh->post_conditions);
        $this->assertSame('row_count', $fresh->post_conditions[0]['kind']);
    }

    public function test_submitted_by_relationship_returns_user(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING,
            'submitted_by' => $user->id,
        ]);
        $this->assertTrue($run->submittedBy->is($user));
    }

    public function test_ingestion_jobs_relationship(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING,
            'submitted_by' => $user->id,
        ]);
        IngestionJob::create([
            'kind' => 'template',
            'status' => 'pending',
            'template_run_id' => $run->id,
            'created_by' => $user->id,
        ]);

        $this->assertCount(1, $run->ingestionJobs);
        $this->assertSame('template', $run->ingestionJobs->first()->kind);
    }

    public function test_scope_non_terminal_excludes_terminal_states(): void
    {
        $user = User::factory()->create();
        TemplateRun::create([
            'template_id' => 't', 'template_version' => '1', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
        ]);
        TemplateRun::create([
            'template_id' => 't', 'template_version' => '1', 'parameters' => [],
            'status' => TemplateRun::STATUS_COMPLETED, 'submitted_by' => $user->id,
        ]);
        TemplateRun::create([
            'template_id' => 't', 'template_version' => '1', 'parameters' => [],
            'status' => TemplateRun::STATUS_FAILED, 'submitted_by' => $user->id,
        ]);

        $this->assertSame(1, TemplateRun::nonTerminal()->count());
    }

    public function test_scope_for_template_filters_by_id_and_version(): void
    {
        $user = User::factory()->create();
        TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING, 'submitted_by' => $user->id,
        ]);
        TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.2.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING, 'submitted_by' => $user->id,
        ]);
        TemplateRun::create([
            'template_id' => 'nodes_test', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING, 'submitted_by' => $user->id,
        ]);

        $this->assertSame(1, TemplateRun::forTemplate('hello_cdm', '0.1.0')->count());
    }
}
