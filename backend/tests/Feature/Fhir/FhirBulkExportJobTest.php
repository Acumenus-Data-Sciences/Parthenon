<?php

declare(strict_types=1);

namespace Tests\Feature\Fhir;

use App\Context\SourceContext;
use App\Enums\DaimonType;
use App\Jobs\Fhir\RunFhirExportJob;
use App\Models\App\FhirExportJob;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\User;
use App\Services\Fhir\Export\OmopToFhirService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class FhirBulkExportJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_job_binds_source_context_paginates_and_writes_ndjson(): void
    {
        Storage::fake('local');

        $source = Source::factory()->create([
            'source_connection' => 'pgsql_testing',
        ]);
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => DaimonType::CDM->value,
            'table_qualifier' => 'export_cdm',
        ]);
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => DaimonType::Vocabulary->value,
            'table_qualifier' => 'export_vocab',
        ]);

        $job = FhirExportJob::create([
            'source_id' => $source->id,
            'status' => 'pending',
            'resource_types' => ['Patient'],
            'user_id' => User::factory()->create()->id,
        ]);

        $service = Mockery::mock(OmopToFhirService::class);
        $service->shouldReceive('search')
            ->once()
            ->with('Patient', ['_count' => 100, '_offset' => 0])
            ->andReturn([
                'resources' => [['resourceType' => 'Patient', 'id' => '1']],
                'total' => 2,
            ]);
        $service->shouldReceive('search')
            ->once()
            ->with('Patient', ['_count' => 100, '_offset' => 1])
            ->andReturn([
                'resources' => [['resourceType' => 'Patient', 'id' => '2']],
                'total' => 2,
            ]);

        (new RunFhirExportJob($job->id))->handle($service);

        $path = "fhir-exports/{$job->id}/Patient.ndjson";
        $fresh = $job->fresh();

        $this->assertSame('completed', $fresh->status);
        // assertEquals (not assertSame): the files column is jsonb, which
        // normalizes object key order on storage, so the round-tripped entry
        // is value-equal but not key-order-identical to the written array.
        $this->assertEquals([[
            'resource_type' => 'Patient',
            'url' => $path,
            'count' => 2,
        ]], $fresh->files);
        Storage::disk('local')->assertExists($path);
        $this->assertSame(
            '{"resourceType":"Patient","id":"1"}'."\n".'{"resourceType":"Patient","id":"2"}'."\n",
            Storage::disk('local')->get($path),
        );

        $context = app(SourceContext::class);
        $this->assertSame($source->id, $context->source?->id);
        $this->assertSame('export_cdm', $context->cdmSchema);
        $this->assertSame('"export_cdm","export_vocab",public', config('database.connections.ctx_cdm.search_path'));
    }
}
