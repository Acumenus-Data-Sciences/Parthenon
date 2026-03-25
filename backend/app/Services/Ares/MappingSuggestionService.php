<?php

namespace App\Services\Ares;

use App\Models\App\UnmappedSourceCode;
use App\Models\Vocabulary\ConceptEmbedding;
use App\Services\AiService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Pgvector\Laravel\Distance;
use Pgvector\Laravel\Vector;

class MappingSuggestionService
{
    public function __construct(
        private readonly AiService $aiService,
    ) {}

    /**
     * Suggest standard concept mappings for a source code using pgvector similarity.
     *
     * @return array<int, array{concept_id: int, concept_name: string, domain_id: string, vocabulary_id: string, confidence_score: float, distance: float}>
     */
    public function suggest(string $sourceCode, string $sourceVocabularyId, int $limit = 5): array
    {
        // Check if concept_embeddings table has data
        try {
            $embeddingCount = ConceptEmbedding::on('omop')->count();
            if ($embeddingCount === 0) {
                Log::info('MappingSuggestionService: No concept embeddings available');

                return [];
            }
        } catch (\Throwable $e) {
            Log::warning("MappingSuggestionService: Cannot access concept_embeddings table: {$e->getMessage()}");

            return [];
        }

        // Generate embedding for the source code text via AI service
        try {
            $encoded = $this->aiService->encodeText($sourceCode);
            $embedding = $encoded['embedding'] ?? null;

            if (! is_array($embedding) || empty($embedding)) {
                Log::warning("MappingSuggestionService: AI service returned no embedding for '{$sourceCode}'");

                return [];
            }
        } catch (\Throwable $e) {
            Log::warning("MappingSuggestionService: Failed to encode source code '{$sourceCode}': {$e->getMessage()}");

            return [];
        }

        // Query nearest neighbors using pgvector cosine distance
        // Only match standard concepts (standard_concept = 'S')
        try {
            $vector = new Vector($embedding);

            $neighbors = ConceptEmbedding::on('omop')
                ->nearestNeighbors('embedding', $vector, Distance::Cosine)
                ->join('concept', 'concept_embeddings.concept_id', '=', 'concept.concept_id')
                ->where('concept.standard_concept', 'S')
                ->select([
                    'concept_embeddings.concept_id',
                    'concept.concept_name',
                    'concept.domain_id',
                    'concept.vocabulary_id',
                ])
                ->take($limit)
                ->get();

            $results = [];
            foreach ($neighbors as $neighbor) {
                $distance = (float) ($neighbor->neighbor_distance ?? 0.0);
                $results[] = [
                    'concept_id' => (int) $neighbor->concept_id,
                    'concept_name' => (string) $neighbor->concept_name,
                    'domain_id' => (string) $neighbor->domain_id,
                    'vocabulary_id' => (string) $neighbor->vocabulary_id,
                    'confidence_score' => round(1.0 - $distance, 4),
                    'distance' => round($distance, 4),
                ];
            }

            return $results;
        } catch (\Throwable $e) {
            Log::warning("MappingSuggestionService: pgvector query failed for '{$sourceCode}': {$e->getMessage()}");

            return [];
        }
    }

    /**
     * Suggest mappings for an unmapped source code by its ID.
     *
     * @return array{unmapped_code: array{id: int, source_code: string, source_vocabulary_id: string, cdm_table: string, record_count: int}, suggestions: array<int, array{concept_id: int, concept_name: string, domain_id: string, vocabulary_id: string, confidence_score: float, distance: float}>}
     */
    public function suggestForUnmappedCode(int $unmappedCodeId): array
    {
        $code = UnmappedSourceCode::findOrFail($unmappedCodeId);

        $suggestions = $this->suggest(
            $code->source_code,
            $code->source_vocabulary_id,
        );

        return [
            'unmapped_code' => [
                'id' => $code->id,
                'source_code' => $code->source_code,
                'source_vocabulary_id' => $code->source_vocabulary_id,
                'cdm_table' => $code->cdm_table,
                'record_count' => $code->record_count,
            ],
            'suggestions' => $suggestions,
        ];
    }
}
