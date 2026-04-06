<?php

namespace App\Services\Cohort\Builders;

class ConceptSetSqlBuilder
{
    /**
     * Build SQL CTEs for all inline concept sets in the expression.
     *
     * Each concept set produces a CTE named `codesetId_{id}` containing
     * the resolved concept_id values, honoring includeDescendants and includeMapped flags.
     *
     * @param  list<array<string, mixed>>  $conceptSets  The conceptSets array from the expression
     * @param  string  $vocabSchema  The vocabulary schema qualifier
     * @return list<string> Array of CTE definitions (without WITH keyword)
     */
    public function build(array $conceptSets, string $vocabSchema): array
    {
        $ctes = [];

        foreach ($conceptSets as $conceptSet) {
            $id = (int) $conceptSet['id'];
            $items = $conceptSet['expression']['items'] ?? [];

            if (empty($items)) {
                // Empty concept set — return no rows
                $ctes[] = "codesetId_{$id} AS (\n    SELECT CAST(NULL AS BIGINT) AS concept_id WHERE 1 = 0\n)";

                continue;
            }

            $ctes[] = $this->buildSingleConceptSetCte($id, $items, $vocabSchema);
        }

        return $ctes;
    }

    /**
     * Build a single concept set CTE.
     */
    private function buildSingleConceptSetCte(int $id, array $items, string $vocabSchema): string
    {
        $includedItems = array_filter($items, fn (array $item) => ! ($item['isExcluded'] ?? false));
        $excludedItems = array_filter($items, fn (array $item) => $item['isExcluded'] ?? false);

        $includedSql = $this->buildExpansionUnion($includedItems, $vocabSchema);
        $excludedSql = $this->buildExpansionUnion($excludedItems, $vocabSchema);

        $innerSql = "SELECT DISTINCT concept_id FROM (\n        {$includedSql}\n    ) included";

        if (! empty($excludedItems)) {
            $innerSql .= "\n    WHERE concept_id NOT IN (\n        {$excludedSql}\n    )";
        }

        return "codesetId_{$id} AS MATERIALIZED (\n    {$innerSql}\n)";
    }

    /**
     * Build the UNION ALL SQL for a set of concept set items with their expansion flags.
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    private function buildExpansionUnion(array $items, string $vocabSchema): string
    {
        if (empty($items)) {
            return 'SELECT CAST(NULL AS BIGINT) AS concept_id WHERE 1 = 0';
        }

        $parts = [];

        // Direct concept IDs — always included
        $directIds = array_map(
            fn (array $item) => (int) ($item['concept']['CONCEPT_ID'] ?? $item['concept']['concept_id'] ?? 0),
            $items
        );
        $directIds = array_filter($directIds, fn (int $id) => $id > 0);

        if (! empty($directIds)) {
            $idList = implode(', ', $directIds);
            $parts[] = "SELECT concept_id FROM {$vocabSchema}.concept WHERE concept_id IN ({$idList})";
        }

        // Descendants
        $descendantIds = array_map(
            fn (array $item) => (int) ($item['concept']['CONCEPT_ID'] ?? $item['concept']['concept_id'] ?? 0),
            array_filter($items, fn (array $item) => $item['includeDescendants'] ?? false)
        );
        $descendantIds = array_filter($descendantIds, fn (int $id) => $id > 0);

        if (! empty($descendantIds)) {
            $idList = implode(', ', $descendantIds);
            $parts[] = "SELECT ca.descendant_concept_id AS concept_id FROM {$vocabSchema}.concept_ancestor ca WHERE ca.ancestor_concept_id IN ({$idList})";
        }

        // Mapped
        $mappedIds = array_map(
            fn (array $item) => (int) ($item['concept']['CONCEPT_ID'] ?? $item['concept']['concept_id'] ?? 0),
            array_filter($items, fn (array $item) => $item['includeMapped'] ?? false)
        );
        $mappedIds = array_filter($mappedIds, fn (int $id) => $id > 0);

        if (! empty($mappedIds)) {
            $idList = implode(', ', $mappedIds);
            $parts[] = "SELECT cr.concept_id_2 AS concept_id FROM {$vocabSchema}.concept_relationship cr WHERE cr.concept_id_1 IN ({$idList}) AND cr.relationship_id = 'Maps to'";
        }

        if (empty($parts)) {
            return 'SELECT CAST(NULL AS BIGINT) AS concept_id WHERE 1 = 0';
        }

        return implode("\n        UNION ALL\n        ", $parts);
    }
}
