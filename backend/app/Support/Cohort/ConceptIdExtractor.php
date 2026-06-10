<?php

namespace App\Support\Cohort;

/**
 * Extracts the concept IDs referenced by a Circe cohort expression's concept
 * sets (Abby / ADR-0020). Shared by cohort diagnostics (orphan-concept checks)
 * and the study gate evaluators. Tolerates Atlas (`CONCEPT_ID`) and lower-case
 * (`concept_id`) casings on both the items and concept keys.
 */
final class ConceptIdExtractor
{
    /**
     * @param  array<string, mixed>  $expression
     * @return list<int> distinct positive concept IDs, in first-seen order
     */
    public static function fromExpression(array $expression): array
    {
        $conceptSets = $expression['ConceptSets'] ?? $expression['conceptSets'] ?? [];
        if (! is_array($conceptSets)) {
            return [];
        }

        $ids = [];
        foreach ($conceptSets as $set) {
            if (! is_array($set)) {
                continue;
            }
            $items = $set['expression']['items'] ?? $set['expression']['Items'] ?? [];
            if (! is_array($items)) {
                continue;
            }
            foreach ($items as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $concept = $item['concept'] ?? $item['Concept'] ?? [];
                if (! is_array($concept)) {
                    continue;
                }
                $id = $concept['CONCEPT_ID'] ?? $concept['concept_id'] ?? null;
                if (is_numeric($id) && (int) $id > 0) {
                    $ids[(int) $id] = true;
                }
            }
        }

        return array_map('intval', array_keys($ids));
    }
}
