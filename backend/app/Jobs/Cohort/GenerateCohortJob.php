<?php

namespace App\Jobs\Cohort;

use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Services\Cohort\CohortGenerationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateCohortJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     * Cohort generation can be long-running for large datasets.
     */
    public int $timeout = 7200;

    /**
     * The number of times the job may be attempted.
     * Cohort generation is idempotent (DELETE + INSERT) so retries are safe,
     * but we limit to 1 to avoid excessive load on the database.
     */
    public int $tries = 1;

    public function __construct(
        public readonly CohortDefinition $cohortDefinition,
        public readonly Source $source,
    ) {
        $this->queue = 'cohort';
    }

    public function handle(CohortGenerationService $service): void
    {
        Log::info('GenerateCohortJob started', [
            'cohort_definition_id' => $this->cohortDefinition->id,
            'source_id' => $this->source->id,
        ]);

        $generation = $service->generate($this->cohortDefinition, $this->source);

        Log::info('GenerateCohortJob finished', [
            'cohort_definition_id' => $this->cohortDefinition->id,
            'generation_id' => $generation->id,
            'status' => $generation->status->value,
            'person_count' => $generation->person_count,
        ]);
    }
}
