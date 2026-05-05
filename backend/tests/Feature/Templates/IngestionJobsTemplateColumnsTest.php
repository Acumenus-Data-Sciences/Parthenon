<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class IngestionJobsTemplateColumnsTest extends TestCase
{
    use RefreshDatabase;

    public function test_ingestion_jobs_has_template_run_id_and_kind_columns(): void
    {
        $columns = collect(DB::select("
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'app' AND table_name = 'ingestion_jobs'
              AND column_name IN ('template_run_id','kind')
        "))->keyBy('column_name');

        $this->assertTrue($columns->has('template_run_id'));
        $this->assertSame('YES', $columns['template_run_id']->is_nullable);
        $this->assertTrue($columns->has('kind'));
        $this->assertSame('NO', $columns['kind']->is_nullable);
        $this->assertStringContainsString("'upload'", (string) $columns['kind']->column_default);
    }

    public function test_kind_check_constraint_rejects_invalid(): void
    {
        $this->expectException(QueryException::class);

        DB::table('app.ingestion_jobs')->insert([
            'kind' => 'unknown_kind',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_indexes_exist(): void
    {
        $indexes = collect(DB::select("
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'app' AND tablename = 'ingestion_jobs'
        "))->pluck('indexname')->all();

        $this->assertContains('idx_ingestion_jobs_kind', $indexes);
        $this->assertContains('idx_ingestion_jobs_template_run_id', $indexes);
    }
}
