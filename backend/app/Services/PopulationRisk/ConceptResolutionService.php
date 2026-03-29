<?php

namespace App\Services\PopulationRisk;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ConceptResolutionService
{
    /**
     * Resolve all valid descendant concept IDs for an ancestor concept.
     *
     * @return int[]
     */
    public function resolveDescendants(int $ancestorConceptId, string $connection, string $vocabSchema): array
    {
        $cacheKey = "concept_descendants:{$connection}:{$vocabSchema}:{$ancestorConceptId}";

        return Cache::remember($cacheKey, 3600, function () use ($ancestorConceptId, $connection, $vocabSchema): array {
            $rows = DB::connection($connection)->select(
                "SELECT DISTINCT ca.descendant_concept_id
                 FROM {$vocabSchema}.concept_ancestor ca
                 JOIN {$vocabSchema}.concept c ON ca.descendant_concept_id = c.concept_id
                 WHERE ca.ancestor_concept_id = ?
                   AND c.invalid_reason IS NULL",
                [$ancestorConceptId]
            );

            return array_map(fn (object $row): int => (int) $row->descendant_concept_id, $rows);
        });
    }

    /**
     * Resolve descendants for multiple ancestors and merge into a single flat array.
     *
     * @param  int[]  $ancestorConceptIds
     * @return int[]
     */
    public function resolveMultipleDescendants(array $ancestorConceptIds, string $connection, string $vocabSchema): array
    {
        $allDescendants = [];

        foreach ($ancestorConceptIds as $ancestorId) {
            $descendants = $this->resolveDescendants($ancestorId, $connection, $vocabSchema);
            $allDescendants = array_merge($allDescendants, $descendants);
        }

        return array_values(array_unique($allDescendants));
    }
}
