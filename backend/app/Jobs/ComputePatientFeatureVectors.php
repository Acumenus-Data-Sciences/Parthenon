<?php

namespace App\Jobs;

use App\Concerns\SourceAware;
use App\Context\SourceContext;
use App\Models\App\PatientFeatureVector;
use App\Models\App\Source;
use App\Services\PatientSimilarity\EmbeddingClient;
use App\Services\PatientSimilarity\SimilarityFeatureExtractor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ComputePatientFeatureVectors implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels, SourceAware;

    public int $timeout = 7200;

    public int $tries = 1;

    public function __construct(
        public Source $source,
        public bool $force = false,
    ) {
        $this->onQueue('similarity');
    }

    public function handle(SimilarityFeatureExtractor $extractor, EmbeddingClient $embeddingClient): void
    {
        $sourceId = $this->source->source_id;
        Log::info('ComputePatientFeatureVectors: starting', ['source_id' => $sourceId]);

        // Register source context so SourceAware trait can resolve connections
        SourceContext::forSource($this->source);

        // Step 1: pre-compute measurement z-score stats for this source
        $statCount = $extractor->computeMeasurementStats($this->source);
        Log::info('ComputePatientFeatureVectors: measurement stats computed', [
            'source_id' => $sourceId,
            'measurement_types' => $statCount,
        ]);

        // Step 2: get all person_ids from the source's CDM person table
        $personIds = $this->cdm()
            ->table('person')
            ->pluck('person_id')
            ->toArray();

        $totalPatients = count($personIds);
        Log::info('ComputePatientFeatureVectors: found patients', [
            'source_id' => $sourceId,
            'total' => $totalPatients,
        ]);

        if ($totalPatients === 0) {
            Log::warning('ComputePatientFeatureVectors: no patients found', ['source_id' => $sourceId]);

            return;
        }

        // Step 3: process in batches of 500
        $batchSize = 500;
        $batches = array_chunk($personIds, $batchSize);
        $processed = 0;

        foreach ($batches as $batchIndex => $batchPersonIds) {
            $vectors = $extractor->extractBatch($batchPersonIds, $this->source);

            foreach ($vectors as $vector) {
                PatientFeatureVector::updateOrCreate(
                    [
                        'source_id' => $sourceId,
                        'person_id' => $vector['person_id'],
                    ],
                    $vector,
                );
            }

            $processed += count($batchPersonIds);
            Log::info('ComputePatientFeatureVectors: batch complete', [
                'source_id' => $sourceId,
                'batch' => $batchIndex + 1,
                'total_batches' => count($batches),
                'processed' => $processed,
                'total' => $totalPatients,
            ]);
        }

        // Step 4: generate embeddings via AI service in batches
        Log::info('ComputePatientFeatureVectors: generating embeddings', ['source_id' => $sourceId]);

        $embeddingBatchSize = 200;
        $embeddingBatches = array_chunk($personIds, $embeddingBatchSize);
        $embeddingsGenerated = 0;

        foreach ($embeddingBatches as $embBatchIndex => $embBatchIds) {
            $featureRows = PatientFeatureVector::where('source_id', $sourceId)
                ->whereIn('person_id', $embBatchIds)
                ->get();

            $batchForEmbedding = [];
            foreach ($featureRows as $row) {
                $batchForEmbedding[] = array_merge($row->toArray(), ['person_id' => $row->person_id]);
            }

            $embeddings = $embeddingClient->embedBatch($batchForEmbedding);

            foreach ($embeddings as $pid => $embedding) {
                $embeddingStr = '['.implode(',', $embedding).']';
                DB::statement(
                    'UPDATE patient_feature_vectors SET embedding = ?::public.vector WHERE source_id = ? AND person_id = ?',
                    [$embeddingStr, $sourceId, $pid]
                );
                $embeddingsGenerated++;
            }

            Log::info('ComputePatientFeatureVectors: embedding batch complete', [
                'source_id' => $sourceId,
                'batch' => $embBatchIndex + 1,
                'total_batches' => count($embeddingBatches),
                'embeddings_in_batch' => count($embeddings),
            ]);
        }

        Log::info('ComputePatientFeatureVectors: embeddings generated', [
            'source_id' => $sourceId,
            'total_embeddings' => $embeddingsGenerated,
        ]);

        // Step 5: create IVFFlat index if enough patients
        if ($totalPatients >= 100) {
            try {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS idx_pfv_embedding ON patient_feature_vectors USING ivfflat (embedding public.vector_cosine_ops) WITH (lists = 100)'
                );
                Log::info('ComputePatientFeatureVectors: IVFFlat index created', ['source_id' => $sourceId]);
            } catch (\Throwable $e) {
                Log::warning('ComputePatientFeatureVectors: IVFFlat index creation failed', [
                    'source_id' => $sourceId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Step 6: invalidate similarity cache for this source
        Cache::forget("patient_similarity_cache:{$sourceId}");

        Log::info('ComputePatientFeatureVectors: complete', [
            'source_id' => $sourceId,
            'total_processed' => $processed,
        ]);
    }

    public function failed(\Throwable $e): void
    {
        Log::error('ComputePatientFeatureVectors: job failed', [
            'source_id' => $this->source->source_id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ]);
    }
}
