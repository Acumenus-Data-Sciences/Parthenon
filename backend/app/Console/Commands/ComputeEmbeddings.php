<?php

namespace App\Console\Commands;

use App\Services\AiService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ComputeEmbeddings extends Command
{
    /**
     * @var string
     */
    protected $signature = 'parthenon:compute-embeddings
        {--batch-size=64 : Number of concepts per batch}
        {--offset=0 : Starting offset for resume support}
        {--limit=0 : Maximum concepts to process (0 = all)}';

    /**
     * @var string
     */
    protected $description = 'Generate SapBERT embeddings for standard OMOP concepts via the AI service';

    public function handle(AiService $aiService): int
    {
        $batchSize = (int) $this->option('batch-size');
        $offset = (int) $this->option('offset');
        $limit = (int) $this->option('limit');

        // Count total standard concepts
        $totalQuery = DB::connection('omop')
            ->table('concepts')
            ->where('standard_concept', 'S');

        $total = $limit > 0
            ? min($limit, $totalQuery->count())
            : $totalQuery->count();

        $this->info("Computing embeddings for {$total} standard concepts...");
        $this->info("Batch size: {$batchSize}, Offset: {$offset}");
        $this->newLine();

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $processed = 0;
        $errors = 0;
        $currentOffset = $offset;

        while ($processed < $total) {
            $currentBatchSize = min($batchSize, $total - $processed);

            // Fetch batch of concepts
            $concepts = DB::connection('omop')
                ->table('concepts')
                ->where('standard_concept', 'S')
                ->orderBy('concept_id')
                ->offset($currentOffset)
                ->limit($currentBatchSize)
                ->get(['concept_id', 'concept_name']);

            if ($concepts->isEmpty()) {
                break;
            }

            $texts = $concepts->pluck('concept_name')->toArray();

            try {
                // Call AI service batch encode endpoint
                $response = $aiService->encodeBatch($texts);

                if (! isset($response['embeddings'])) {
                    $this->newLine();
                    $this->warn("No embeddings in response at offset {$currentOffset}");
                    $errors++;
                    $currentOffset += $currentBatchSize;
                    $processed += $currentBatchSize;
                    $bar->advance($currentBatchSize);

                    continue;
                }

                // Bulk insert embeddings
                $inserts = [];
                foreach ($concepts as $i => $concept) {
                    if (isset($response['embeddings'][$i])) {
                        $embedding = $response['embeddings'][$i];
                        $vectorStr = '['.implode(',', $embedding).']';

                        $inserts[] = [
                            'concept_id' => $concept->concept_id,
                            'concept_name' => $concept->concept_name,
                            'embedding' => $vectorStr,
                        ];
                    }
                }

                if (! empty($inserts)) {
                    // Use upsert to handle resume scenarios
                    foreach (array_chunk($inserts, 100) as $chunk) {
                        DB::connection('omop')->table('concept_embeddings')->upsert(
                            $chunk,
                            ['concept_id'],
                            ['concept_name', 'embedding']
                        );
                    }
                }
            } catch (\Exception $e) {
                $this->newLine();
                $this->warn("Batch error at offset {$currentOffset}: {$e->getMessage()}");
                $errors++;
            }

            $currentOffset += $currentBatchSize;
            $processed += $concepts->count();
            $bar->advance($concepts->count());
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("Processed: {$processed}, Errors: {$errors}");

        // Create HNSW index if we processed everything
        if ($offset === 0 && ($limit === 0 || $limit >= $total)) {
            $this->createHnswIndex();
        }

        $this->info('Embedding computation complete!');

        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function createHnswIndex(): void
    {
        $this->info('Creating HNSW index (this may take several minutes)...');

        // concept_embeddings lives in the per-CDM schema (omop), not in vocab.
        // The create-table migration runs on the omop connection, so the table
        // lands in omop.concept_embeddings.
        DB::connection('omop')->statement(
            'DROP INDEX IF EXISTS omop.concept_embeddings_hnsw'
        );

        // Create HNSW index for cosine similarity search
        DB::connection('omop')->statement(
            'CREATE INDEX concept_embeddings_hnsw ON omop.concept_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)'
        );

        DB::connection('omop')->statement('ANALYZE omop.concept_embeddings');

        $this->info('HNSW index created.');
    }
}
