<?php

declare(strict_types=1);

namespace Tests\Feature\Fhir;

use App\Jobs\Fhir\RunFhirSyncJob;
use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Models\App\Source;
use App\Models\User;
use App\Services\Fhir\FhirBulkExportService;
use App\Services\Fhir\FhirDedupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

/**
 * Parsing + dispatch coverage for RunFhirSyncJob::processBulkDeletions.
 *
 * The FhirBulkExportService is mocked to return a known deleted-Bundle NDJSON
 * file (no network), and FhirDedupService is mocked to assert deleteByResource
 * is invoked once per DELETE entry with the right (type, id, reason) and that
 * the returned tally is correct.
 */
class FhirBulkDeletionsJobTest extends TestCase
{
    use RefreshDatabase;

    private function makeConnection(): FhirConnection
    {
        $user = User::factory()->create();
        $source = Source::factory()->create();

        return FhirConnection::create([
            'site_name' => 'Deletion Test',
            'site_key' => 'deletion-test',
            'ehr_vendor' => 'epic',
            'fhir_base_url' => 'https://example.test/fhir',
            'token_endpoint' => 'https://example.test/token',
            'client_id' => 'client-1',
            'private_key_pem' => null,
            'scopes' => 'system/*.read',
            'target_source_id' => $source->id,
            'created_by' => $user->id,
        ]);
    }

    private function makeRun(FhirConnection $conn): FhirSyncRun
    {
        return FhirSyncRun::create([
            'fhir_connection_id' => $conn->id,
            'status' => 'processing',
            'started_at' => now(),
            'triggered_by' => $conn->created_by,
        ]);
    }

    public function test_process_bulk_deletions_dispatches_delete_per_entry(): void
    {
        $conn = $this->makeConnection();
        $run = $this->makeRun($conn);

        // Two transaction Bundles: first has a DELETE + a non-DELETE entry,
        // second has one DELETE. Three entries total, two of them DELETE.
        $ndjson = json_encode([
            'resourceType' => 'Bundle',
            'type' => 'transaction',
            'entry' => [
                ['request' => ['method' => 'DELETE', 'url' => 'Condition/cond-1']],
                ['request' => ['method' => 'PUT', 'url' => 'Patient/pat-9']],
            ],
        ])."\n".json_encode([
            'resourceType' => 'Bundle',
            'type' => 'transaction',
            'entry' => [
                ['request' => ['method' => 'DELETE', 'url' => 'Observation/obs-7']],
            ],
        ])."\n";

        $file = tempnam(sys_get_temp_dir(), 'del').'.ndjson';
        file_put_contents($file, $ndjson);

        $manifest = [
            'output' => [],
            'deleted' => [['type' => 'Bundle', 'url' => 'https://example.test/deleted-1']],
        ];

        $exportService = Mockery::mock(FhirBulkExportService::class);
        $exportService->shouldReceive('downloadDeletedFiles')
            ->once()
            ->with($conn, $run, $manifest)
            ->andReturn([$file]);
        app()->instance(FhirBulkExportService::class, $exportService);

        $dedup = Mockery::mock(FhirDedupService::class);
        $dedup->shouldReceive('deleteByResource')
            ->once()
            ->with('deletion-test', 'Condition', 'cond-1', 'bulk-deleted')
            ->andReturn(['resolved' => true, 'deleted' => true, 'cdm_table' => 'condition_occurrence', 'cdm_row_id' => 5, 'reason' => 'bulk-deleted']);
        $dedup->shouldReceive('deleteByResource')
            ->once()
            ->with('deletion-test', 'Observation', 'obs-7', 'bulk-deleted')
            ->andReturn(['resolved' => false, 'deleted' => false, 'cdm_table' => 'measurement', 'cdm_row_id' => 0, 'reason' => 'bulk-deleted']);

        $job = new RunFhirSyncJob($conn, $run);
        $tally = $job->processBulkDeletions($conn, $run, $manifest, $dedup);

        @unlink($file);

        expect($tally['files'])->toBe(1);
        expect($tally['processed'])->toBe(2);   // two DELETE entries (PUT skipped)
        expect($tally['deleted'])->toBe(1);     // one resolved+deleted
        expect($tally['unresolved'])->toBe(1);  // one placeholder/unresolved
    }

    public function test_process_bulk_deletions_returns_zeros_with_no_deleted_manifest(): void
    {
        $conn = $this->makeConnection();
        $run = $this->makeRun($conn);

        $dedup = Mockery::mock(FhirDedupService::class);
        $dedup->shouldReceive('deleteByResource')->never();

        $job = new RunFhirSyncJob($conn, $run);
        $tally = $job->processBulkDeletions($conn, $run, ['output' => []], $dedup);

        expect($tally)->toBe(['files' => 0, 'processed' => 0, 'deleted' => 0, 'unresolved' => 0]);
    }
}
