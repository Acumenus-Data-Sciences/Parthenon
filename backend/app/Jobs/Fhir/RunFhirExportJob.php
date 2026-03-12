<?php

declare(strict_types=1);

namespace App\Jobs\Fhir;

use App\Models\App\FhirExportJob;
use App\Services\Fhir\Export\OmopToFhirService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class RunFhirExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 3600;

    public int $tries = 1;

    public function __construct(
        private readonly string $exportJobId,
    ) {}

    public function handle(OmopToFhirService $service): void
    {
        $job = FhirExportJob::findOrFail($this->exportJobId);
        $job->update(['status' => 'processing', 'started_at' => now()]);

        try {
            $files = [];
            $resourceTypes = $job->resource_types ?? [];

            foreach ($resourceTypes as $type) {
                $params = ['_count' => 1000];
                if ($job->patient_ids) {
                    // Process per patient
                    $resources = [];
                    foreach ($job->patient_ids as $patientId) {
                        $params['patient'] = $patientId;
                        $result = $service->search($type, $params);
                        $resources = [...$resources, ...$result['resources']];
                    }
                } else {
                    $result = $service->search($type, $params);
                    $resources = $result['resources'];
                }

                if (empty($resources)) {
                    continue;
                }

                // Write NDJSON file
                $filename = "fhir-exports/{$job->id}/{$type}.ndjson";
                $ndjson = '';
                foreach ($resources as $resource) {
                    $ndjson .= json_encode($resource, JSON_UNESCAPED_SLASHES)."\n";
                }

                Storage::disk('local')->put($filename, $ndjson);

                $files[] = [
                    'resource_type' => $type,
                    'url' => $filename,
                    'count' => count($resources),
                ];
            }

            $job->update([
                'status' => 'completed',
                'files' => $files,
                'finished_at' => now(),
            ]);

            Log::info('FHIR export completed', [
                'job_id' => $job->id,
                'files' => count($files),
            ]);
        } catch (\Throwable $e) {
            $job->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'finished_at' => now(),
            ]);

            Log::error('FHIR export failed', [
                'job_id' => $job->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
