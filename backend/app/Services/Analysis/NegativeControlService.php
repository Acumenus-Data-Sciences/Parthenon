<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;

/**
 * Service for generating and managing negative control outcome concepts.
 *
 * Negative controls are outcomes that have no known causal relationship with an
 * exposure — used to detect residual systematic bias in observational studies.
 * This implementation is SQL-based (no R dependency).
 */
class NegativeControlService
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Suggest negative control outcomes for a given exposure concept set.
     *
     * Strategy: find condition concepts that appear in the CDM but have no known
     * relationship to the exposure concept(s) in the vocabulary, ranked by prevalence.
     *
     * @param  list<int>  $exposureConceptIds
     * @param  list<int>  $excludeConceptIds  Concepts to exclude (known outcomes)
     * @return list<array{concept_id: int, concept_name: string, person_count: int}>
     */
    public function suggestNegativeControls(
        array $exposureConceptIds,
        Source $source,
        int $limit = 50,
        array $excludeConceptIds = [],
    ): array {
        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;

        if ($cdmSchema === null) {
            throw new \RuntimeException('Source is missing required CDM schema configuration.');
        }

        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'omop';
        $params = ['cdmSchema' => $cdmSchema, 'vocabSchema' => $vocabSchema];

        $exposureIdList = implode(',', array_map('intval', $exposureConceptIds));
        $excludeClause = '';
        if (! empty($excludeConceptIds)) {
            $excludeIdList = implode(',', array_map('intval', $excludeConceptIds));
            $excludeClause = "AND co.condition_concept_id NOT IN ({$excludeIdList})";
        }

        // Find condition concepts that:
        // 1. Appear in the CDM with reasonable prevalence
        // 2. Have no direct relationship to the exposure concepts in concept_relationship
        // 3. Are standard concepts
        $sql = "
            WITH exposure_related AS (
                SELECT DISTINCT cr.concept_id_2 AS related_concept_id
                FROM {@vocabSchema}.concept_relationship cr
                WHERE cr.concept_id_1 IN ({$exposureIdList})
                UNION
                SELECT DISTINCT cr.concept_id_1 AS related_concept_id
                FROM {@vocabSchema}.concept_relationship cr
                WHERE cr.concept_id_2 IN ({$exposureIdList})
                UNION
                SELECT DISTINCT ca.descendant_concept_id AS related_concept_id
                FROM {@vocabSchema}.concept_ancestor ca
                WHERE ca.ancestor_concept_id IN ({$exposureIdList})
            ),
            candidate_conditions AS (
                SELECT
                    co.condition_concept_id AS concept_id,
                    c.concept_name,
                    COUNT(DISTINCT co.person_id) AS person_count
                FROM {@cdmSchema}.condition_occurrence co
                INNER JOIN {@vocabSchema}.concept c
                    ON co.condition_concept_id = c.concept_id
                WHERE co.condition_concept_id > 0
                  AND c.standard_concept = 'S'
                  AND c.domain_id = 'Condition'
                  AND co.condition_concept_id NOT IN (SELECT related_concept_id FROM exposure_related)
                  {$excludeClause}
                GROUP BY co.condition_concept_id, c.concept_name
                HAVING COUNT(DISTINCT co.person_id) >= 100
            )
            SELECT concept_id, concept_name, person_count
            FROM candidate_conditions
            ORDER BY person_count DESC
            LIMIT {$limit}
        ";

        $rendered = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($rendered);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Validate candidate negative controls — check they truly have no
     * relationship to the exposure in the vocabulary.
     *
     * @param  list<int>  $exposureConceptIds
     * @param  list<int>  $candidateConceptIds
     * @return list<array{concept_id: int, has_relationship: bool, relationship_ids: list<string>}>
     */
    public function validateCandidates(
        array $exposureConceptIds,
        array $candidateConceptIds,
        Source $source,
    ): array {
        $source->load('daimons');
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary)
            ?? $source->getTableQualifier(DaimonType::CDM);
        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'omop';
        $params = ['vocabSchema' => $vocabSchema];

        $exposureIdList = implode(',', array_map('intval', $exposureConceptIds));
        $candidateIdList = implode(',', array_map('intval', $candidateConceptIds));

        $sql = "
            SELECT
                cr.concept_id_1,
                cr.concept_id_2,
                cr.relationship_id
            FROM {@vocabSchema}.concept_relationship cr
            WHERE cr.concept_id_1 IN ({$exposureIdList})
              AND cr.concept_id_2 IN ({$candidateIdList})
        ";

        $rendered = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($rendered);

        // Group by candidate concept
        $relationshipMap = [];
        foreach ($rows as $row) {
            $candidateId = (int) $row->concept_id_2;
            $relationshipMap[$candidateId][] = $row->relationship_id;
        }

        $results = [];
        foreach ($candidateConceptIds as $candidateId) {
            $rels = $relationshipMap[$candidateId] ?? [];
            $results[] = [
                'concept_id' => $candidateId,
                'has_relationship' => ! empty($rels),
                'relationship_ids' => array_values(array_unique($rels)),
            ];
        }

        return $results;
    }
}
