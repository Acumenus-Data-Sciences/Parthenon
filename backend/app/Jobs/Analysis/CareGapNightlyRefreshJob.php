<?php

namespace App\Jobs\Analysis;

use App\Models\App\Source;
use App\Services\Analysis\CareGapRefreshService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Nightly batch job that refreshes all care gap materialized tables
 * (care_gap_patient_bundles, care_gap_patient_measures, care_gap_snapshots)
 * for every active source using pure-SQL UPSERTs.
 *
 * Dispatched by the scheduler daily at 02:00 AM.
 * Can also be triggered manually via: php artisan care-gaps:refresh
 */
class CareGapNightlyRefreshJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 3600; // 1 hour max

    public int $tries = 1;      // No retries — nightly jobs are idempotent, next run will recover

    public function __construct()
    {
        $this->onQueue('analysis');
    }

    public function handle(CareGapRefreshService $refreshService): void
    {
        $started = now();

        Log::info('CareGapNightlyRefresh: starting');

        $sources = Source::all()->filter(function (Source $source) {
            $source->load('daimons');

            return $source->getTableQualifier(\App\Enums\DaimonType::CDM) !== null;
        });

        if ($sources->isEmpty()) {
            Log::warning('CareGapNightlyRefresh: no sources with CDM daimon configured');

            return;
        }

        $totalPatients = 0;
        $totalBundles = 0;
        $errors = [];

        foreach ($sources as $source) {
            try {
                $result = $refreshService->refreshSource($source);
                $totalPatients += $result['patients_total'];
                $totalBundles += $result['bundles'];
            } catch (\Throwable $e) {
                $errors[] = "Source {$source->source_key}: {$e->getMessage()}";
                Log::error('CareGapNightlyRefresh: source error', [
                    'source_id' => $source->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $durationMs = $started->diffInMilliseconds(now());

        Log::info('CareGapNightlyRefresh: complete', [
            'sources' => $sources->count(),
            'bundles_total' => $totalBundles,
            'patients_total' => $totalPatients,
            'errors' => count($errors),
            'duration_ms' => $durationMs,
        ]);

        if (! empty($errors)) {
            Log::error('CareGapNightlyRefresh: completed with errors', ['errors' => $errors]);
        }
    }
}
