<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TemplateRunsSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_template_runs_table_exists_with_required_columns(): void
    {
        $columns = DB::select("
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'app' AND table_name = 'template_runs'
            ORDER BY ordinal_position
        ");

        $names = array_map(fn ($c) => $c->column_name, $columns);

        $this->assertContains('id', $names);
        $this->assertContains('template_id', $names);
        $this->assertContains('template_version', $names);
        $this->assertContains('parameters', $names);
        $this->assertContains('status', $names);
        $this->assertContains('progress', $names);
        $this->assertContains('current_node', $names);
        $this->assertContains('prefect_run_id', $names);
        $this->assertContains('error_message', $names);
        $this->assertContains('post_conditions', $names);
        $this->assertContains('artifacts_path', $names);
        $this->assertContains('submitted_by', $names);
        $this->assertContains('submitted_at', $names);
        $this->assertContains('started_at', $names);
        $this->assertContains('finished_at', $names);
        $this->assertContains('correlation_id', $names);
        $this->assertContains('created_at', $names);
        $this->assertContains('updated_at', $names);
    }

    public function test_status_check_constraint_rejects_invalid_status(): void
    {
        $this->expectException(QueryException::class);

        DB::table('app.template_runs')->insert([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => json_encode([]),
            'status' => 'not_a_valid_status',
            'submitted_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_progress_check_constraint_rejects_out_of_range(): void
    {
        $this->expectException(QueryException::class);

        DB::table('app.template_runs')->insert([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => json_encode([]),
            'status' => 'pending',
            'progress' => 1.5,
            'submitted_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_indexes_exist(): void
    {
        $indexes = collect(DB::select("
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'app' AND tablename = 'template_runs'
        "))->pluck('indexname')->all();

        $this->assertContains('idx_template_runs_template_id', $indexes);
        $this->assertContains('idx_template_runs_status', $indexes);
        $this->assertContains('idx_template_runs_submitted_by', $indexes);
        $this->assertContains('idx_template_runs_submitted_at', $indexes);
    }
}
