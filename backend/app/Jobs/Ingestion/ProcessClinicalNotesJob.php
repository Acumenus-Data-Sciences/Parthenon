<?php

declare(strict_types=1);

namespace App\Jobs\Ingestion;

use App\Models\App\IngestionJob;
use App\Services\Ingestion\ClinicalNlpService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessClinicalNotesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800;

    public int $tries = 2;

    public function __construct(
        private readonly int $ingestionJobId,
    ) {
        $this->queue = 'ingestion';
    }

    public function handle(ClinicalNlpService $nlpService): void
    {
        $job = IngestionJob::findOrFail($this->ingestionJobId);

        try {
            // Get note records from CDM that need NLP processing
            $notes = DB::connection('omop')
                ->table('omop.note')
                ->whereNull('note_nlp_processed')
                ->where('note_text', '!=', '')
                ->limit(1000)
                ->get();

            if ($notes->isEmpty()) {
                Log::info("No clinical notes to process for job {$this->ingestionJobId}");

                return;
            }

            $batchSize = 10;
            $processed = 0;

            foreach ($notes->chunk($batchSize) as $batch) {
                $texts = $batch->pluck('note_text')->toArray();
                $result = $nlpService->extractBatch($texts);

                foreach ($batch->values() as $index => $note) {
                    $nlpResult = $result['results'][$index] ?? null;
                    if (! $nlpResult || empty($nlpResult['entities'])) {
                        continue;
                    }

                    foreach ($nlpResult['entities'] as $entity) {
                        // Insert into note_nlp table
                        DB::connection('omop')->table('omop.note_nlp')->insert([
                            'note_id' => $note->note_id,
                            'section_concept_id' => 0,
                            'snippet' => $entity['context'] ?? substr($note->note_text, max(0, $entity['start'] - 50), 200),
                            'offset' => (string) $entity['start'],
                            'lexical_variant' => $entity['text'],
                            'note_nlp_concept_id' => $entity['concept_id'] ?? 0,
                            'note_nlp_source_concept_id' => 0,
                            'nlp_system' => 'parthenon-clinical-nlp',
                            'nlp_date' => now()->toDateString(),
                            'nlp_datetime' => now()->toDateTimeString(),
                            'term_exists' => $entity['concept_id'] ? 'Y' : 'N',
                            'term_temporal' => $entity['negated'] ? 'Negated' : 'Present',
                            'term_modifiers' => json_encode([
                                'label' => $entity['label'],
                                'confidence' => $entity['confidence'],
                                'negated' => $entity['negated'],
                            ]),
                        ]);
                    }

                    $processed++;
                }
            }

            Log::info("Processed {$processed} clinical notes for job {$this->ingestionJobId}");

        } catch (\Exception $e) {
            Log::error("Clinical NLP processing failed for job {$this->ingestionJobId}: {$e->getMessage()}");
            throw $e;
        }
    }
}
