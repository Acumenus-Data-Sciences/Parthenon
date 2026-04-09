<?php

namespace App\Services\ConceptSet;

use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\Vocabulary\ConceptAncestor;
use App\Models\Vocabulary\ConceptRelationship;
use Illuminate\Support\Collection;

class ConceptSetResolverService
{
    /**
     * Resolve a concept set into a flat array of unique concept IDs,
     * honoring include_descendants, include_mapped, and is_excluded flags.
     *
     * @return array<int>
     */
    public function resolve(ConceptSet $conceptSet): array
    {
        $items = $conceptSet->items()->get();

        $included = $this->expandItems(
            $items->where('is_excluded', false)
        );

        $excluded = $this->expandItems(
            $items->where('is_excluded', true)
        );

        return array_values(
            array_diff($included, $excluded)
        );
    }

    /**
     * Generate a SQL subquery string that resolves concept set items inline,
     * suitable for embedding in cohort SQL.
     *
     * @param  array<ConceptSetItem>|Collection<int, ConceptSetItem>  $items
     */
    public function resolveToSql(array|Collection $items, string $vocabSchema): string
    {
        $items = collect($items);

        $includedItems = $items->where('is_excluded', false);
        $excludedItems = $items->where('is_excluded', true);

        $includedSql = $this->buildExpansionSql($includedItems, $vocabSchema);
        $excludedSql = $this->buildExpansionSql($excludedItems, $vocabSchema);

        $sql = "SELECT DISTINCT concept_id FROM ({$includedSql}) included";

        if ($excludedItems->isNotEmpty()) {
            $sql .= " WHERE concept_id NOT IN ({$excludedSql})";
        }

        return $sql;
    }

    /**
     * Expand a collection of items by applying descendants and mapped flags.
     *
     * @param  Collection<int, ConceptSetItem>  $items
     * @return array<int>
     */
    private function expandItems(Collection $items): array
    {
        $conceptIds = [];

        foreach ($items as $item) {
            $conceptIds[] = $item->concept_id;

            if ($item->include_descendants) {
                $descendants = ConceptAncestor::where('ancestor_concept_id', $item->concept_id)
                    ->pluck('descendant_concept_id')
                    ->all();

                $conceptIds = array_merge($conceptIds, $descendants);
            }

            if ($item->include_mapped) {
                $mapped = ConceptRelationship::where('concept_id_1', $item->concept_id)
                    ->where('relationship_id', 'Maps to')
                    ->pluck('concept_id_2')
                    ->all();

                $conceptIds = array_merge($conceptIds, $mapped);
            }
        }

        return array_unique($conceptIds);
    }

    /**
     * Build the UNION ALL SQL for a set of items with their expansion flags.
     *
     * @param  Collection<int, ConceptSetItem>  $items
     */
    private function buildExpansionSql(Collection $items, string $vocabSchema): string
    {
        if ($items->isEmpty()) {
            return 'SELECT NULL::integer AS concept_id WHERE false';
        }

        $parts = [];

        // Direct concept IDs
        $directIds = $items->pluck('concept_id')->implode(', ');
        $parts[] = "SELECT concept_id FROM {$vocabSchema}.concept WHERE concept_id IN ({$directIds})";

        // Descendants
        $descendantIds = $items->where('include_descendants', true)
            ->pluck('concept_id');

        if ($descendantIds->isNotEmpty()) {
            $ids = $descendantIds->implode(', ');
            $parts[] = "SELECT descendant_concept_id AS concept_id FROM {$vocabSchema}.concept_ancestor WHERE ancestor_concept_id IN ({$ids})";
        }

        // Mapped
        $mappedIds = $items->where('include_mapped', true)
            ->pluck('concept_id');

        if ($mappedIds->isNotEmpty()) {
            $ids = $mappedIds->implode(', ');
            $parts[] = "SELECT cr.concept_id_2 AS concept_id FROM {$vocabSchema}.concept_relationship cr WHERE cr.concept_id_1 IN ({$ids}) AND cr.relationship_id = 'Maps to'";
        }

        return implode(' UNION ALL ', $parts);
    }
}
