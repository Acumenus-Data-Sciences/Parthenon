<?php

declare(strict_types=1);

namespace Tests\Feature\Fhir;

use App\Context\SourceContext;
use App\Enums\DaimonType;
use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\User;
use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\FhirBulkMapper;
use App\Services\Fhir\FhirDedupService;
use App\Services\Fhir\FhirNdjsonProcessorService;
use App\Services\Fhir\VocabularyLookupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

/**
 * Processor-level proof that an entered-in-error resource is NOT hydrated and
 * instead dispatches a soft-delete. The mapper is mocked to fail the test if it
 * is ever asked to map the EIE resource; the dedup service is mocked to assert
 * deleteByResource is called with the right (type, id, reason).
 */
class FhirProcessorEnteredInErrorTest extends TestCase
{
    use RefreshDatabase;

    public function test_entered_in_error_resource_is_deleted_not_hydrated(): void
    {
        $source = Source::factory()->create(['source_connection' => 'pgsql_testing']);
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => DaimonType::CDM->value,
            'table_qualifier' => 'omop',
        ]);
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => DaimonType::Vocabulary->value,
            'table_qualifier' => 'vocab',
        ]);
        SourceContext::forSource($source);

        $siteKey = 'eie-proc-test';

        // Two NDJSON lines: one entered-in-error Observation, one normal one.
        $ndjson = json_encode([
            'resourceType' => 'Observation',
            'id' => 'bad-obs',
            'status' => 'entered-in-error',
        ])."\n".json_encode([
            'resourceType' => 'Observation',
            'id' => 'good-obs',
            'status' => 'final',
        ])."\n";

        $file = tempnam(sys_get_temp_dir(), 'eie').'.ndjson';
        file_put_contents($file, $ndjson);

        // Mapper must NEVER be called for the entered-in-error resource. It is
        // allowed to be called for the good resource (returns no rows so nothing
        // is written / no DB dependency is exercised).
        $mapper = Mockery::mock(FhirBulkMapper::class);
        $mapper->shouldReceive('mapResource')
            ->with(Mockery::on(fn ($r) => ($r['id'] ?? null) === 'bad-obs'), Mockery::any())
            ->never();
        $mapper->shouldReceive('mapResource')
            ->with(Mockery::on(fn ($r) => ($r['id'] ?? null) === 'good-obs'), Mockery::any())
            ->andReturn([]);

        $dedup = Mockery::mock(FhirDedupService::class);
        $dedup->shouldReceive('deleteByResource')
            ->once()
            ->with($siteKey, 'Observation', 'bad-obs', 'entered-in-error')
            ->andReturn([
                'resolved' => true,
                'deleted' => true,
                'cdm_table' => 'measurement',
                'cdm_row_id' => 42,
                'reason' => 'entered-in-error',
            ]);
        // Not incremental, so warmCache/getStats are not called.
        $dedup->shouldReceive('getStats')->andReturn(['tracked_resources' => 0, 'cache_size' => 0]);

        $vocab = Mockery::mock(VocabularyLookupService::class);
        $vocab->shouldReceive('getCacheStats')->andReturn([]);

        $crosswalk = Mockery::mock(CrosswalkService::class);

        $processor = new FhirNdjsonProcessorService($mapper, $vocab, $crosswalk, $dedup);

        $user = User::factory()->create();
        $connection = FhirConnection::create([
            'site_name' => 'EIE Test',
            'site_key' => $siteKey,
            'ehr_vendor' => 'epic',
            'fhir_base_url' => 'https://example.test/fhir',
            'token_endpoint' => 'https://example.test/token',
            'client_id' => 'client-1',
            'private_key_pem' => null,
            'scopes' => 'system/*.read',
            'target_source_id' => $source->id,
            'created_by' => $user->id,
        ]);
        $run = FhirSyncRun::create([
            'fhir_connection_id' => $connection->id,
            'status' => 'processing',
            'started_at' => now(),
            'triggered_by' => $user->id,
        ]);

        $stats = $processor->processFiles($run, ['Observation' => [$file]], $siteKey, false);

        @unlink($file);

        expect($stats['extracted'])->toBe(2);
        expect($stats['entered_in_error'])->toBe(1);
        expect($stats['deleted'])->toBe(1);

        // Mockery expectations (mapper never for bad-obs, dedup once) verified on teardown.
        $this->addToAssertionCount(1);
    }
}
