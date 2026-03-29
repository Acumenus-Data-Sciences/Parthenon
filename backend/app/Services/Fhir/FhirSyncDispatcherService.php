<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use App\Jobs\Fhir\RunFhirSyncJob;
use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Models\App\IngestionProject;

class FhirSyncDispatcherService
{
    public function startSync(
        FhirConnection $fhirConnection,
        bool $forceFull = false,
        ?IngestionProject $project = null,
        ?int $triggeredBy = null,
    ): FhirSyncRun {
        if (! $fhirConnection->is_active) {
            throw new \DomainException('Connection is not active. Enable it before syncing.');
        }

        if ($fhirConnection->usesSmartBackendServices() && ! $fhirConnection->has_private_key) {
            throw new \DomainException('No private key configured. Upload a PEM key first.');
        }

        $running = $fhirConnection->syncRuns()
            ->whereIn('status', ['pending', 'exporting', 'downloading', 'processing'])
            ->exists();

        if ($running) {
            throw new \RuntimeException('A sync is already in progress for this connection.');
        }

        $run = FhirSyncRun::create([
            'fhir_connection_id' => $fhirConnection->id,
            'ingestion_project_id' => $project?->id,
            'status' => 'pending',
            'triggered_by' => $triggeredBy,
        ]);

        $fhirConnection->update(['last_sync_status' => 'pending']);

        if ($project) {
            $project->update([
                'fhir_connection_id' => $fhirConnection->id,
                'last_fhir_sync_run_id' => $run->id,
                'last_fhir_sync_status' => 'pending',
                'status' => 'profiling',
            ]);
        }

        RunFhirSyncJob::dispatch($fhirConnection, $run, $forceFull);

        return $run;
    }
}
