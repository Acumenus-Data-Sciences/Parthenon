<?php

namespace App\Jobs\Ingestion;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Models\App\IngestionJob;
use App\Services\AiService;
use App\Services\Ingestion\ConfidenceRouterService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class RunConceptMappingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 1800;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    public function __construct(
        public readonly IngestionJob $ingestionJob,
    ) {
        $this->queue = 'ingestion';
    }

    public function handle(AiService $aiService, ConfidenceRouterService $confidenceRouter): void
    {
        // Update job status to running
        $this->ingestionJob->update([
            'status' => ExecutionStatus::Running,
            'current_step' => IngestionStep::ConceptMapping,
        ]);

        // Get source profile fields for the job
        $sourceProfile = $this->ingestionJob->profiles()->with('fields')->first();

        if (! $sourceProfile) {
            $this->ingestionJob->update([
                'status' => ExecutionStatus::Failed,
                'error_message' => 'No source profile found for concept mapping.',
            ]);

            return;
        }

        $fields = $sourceProfile->fields;

        // Identify fields that likely need concept mapping:
        // - inferred_type is 'code' or 'string' with low distinct percentage
        $mappableFields = $fields->filter(function ($field) {
            if ($field->inferred_type === 'code') {
                return true;
            }

            if ($field->inferred_type === 'string' && $field->distinct_percentage <= 50.00) {
                return true;
            }

            return false;
        });

        foreach ($mappableFields as $field) {
            /** @var array<int, mixed>|null $topValues */
            $topValues = $field->top_values;
            $topValues = $topValues ?? [];

            if (empty($topValues)) {
                continue;
            }

            // Build terms array from top values for batch mapping
            $terms = [];
            foreach ($topValues as $valueEntry) {
                $value = is_array($valueEntry) ? ($valueEntry['value'] ?? null) : $valueEntry;
                $frequency = is_array($valueEntry) ? ($valueEntry['count'] ?? 1) : 1;

                if ($value === null || trim((string) $value) === '') {
                    continue;
                }

                $terms[] = [
                    'source_code' => (string) $value,
                    'source_description' => null,
                    'source_vocabulary_id' => null,
                    'source_table' => $sourceProfile->file_name,
                    'source_column' => $field->column_name,
                    'frequency' => $frequency,
                ];
            }

            if (empty($terms)) {
                continue;
            }

            // Call AI service for batch mapping
            $response = $aiService->mapBatch($terms);
            $results = $response['results'] ?? [];

            foreach ($results as $result) {
                $sourceCode = $result['source_code'] ?? '';
                $candidates = $result['candidates'] ?? [];
                $termMeta = collect($terms)->firstWhere('source_code', $sourceCode);

                if (empty($candidates)) {
                    continue;
                }

                // Top candidate is the first one (highest score)
                $topCandidate = $candidates[0] ?? null;

                // Create ConceptMapping record
                $conceptMapping = $this->ingestionJob->conceptMappings()->create([
                    'source_code' => $sourceCode,
                    'source_description' => $termMeta['source_description'] ?? null,
                    'source_vocabulary_id' => $termMeta['source_vocabulary_id'] ?? null,
                    'source_table' => $termMeta['source_table'] ?? null,
                    'source_column' => $termMeta['source_column'] ?? null,
                    'source_frequency' => $termMeta['frequency'] ?? null,
                    'target_concept_id' => $topCandidate['concept_id'] ?? null,
                    'confidence' => $topCandidate['score'] ?? null,
                    'strategy' => $topCandidate['strategy'] ?? null,
                ]);

                // Create MappingCandidate records for all candidates
                foreach ($candidates as $rank => $candidate) {
                    $conceptMapping->candidates()->create([
                        'target_concept_id' => $candidate['concept_id'] ?? 0,
                        'concept_name' => $candidate['concept_name'] ?? '',
                        'domain_id' => $candidate['domain_id'] ?? '',
                        'vocabulary_id' => $candidate['vocabulary_id'] ?? '',
                        'standard_concept' => $candidate['standard_concept'] ?? null,
                        'score' => $candidate['score'] ?? 0,
                        'strategy' => $candidate['strategy'] ?? '',
                        'strategy_scores' => $candidate['strategy_scores'] ?? null,
                        'rank' => $rank + 1,
                    ]);
                }
            }
        }

        // Route all mappings through confidence tiers
        $routingCounts = $confidenceRouter->routeMappings($this->ingestionJob);

        // Update job progress to 50% (3/6 steps)
        $existingStats = $this->ingestionJob->stats_json ?? [];
        $existingStats['concept_mapping'] = [
            'routing' => $routingCounts,
            'completed_at' => now()->toIso8601String(),
        ];

        $this->ingestionJob->update([
            'progress_percentage' => 50,
            'stats_json' => $existingStats,
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(?Throwable $exception): void
    {
        $this->ingestionJob->update([
            'status' => ExecutionStatus::Failed,
            'error_message' => $exception?->getMessage() ?? 'Unknown error during concept mapping.',
        ]);
    }
}
