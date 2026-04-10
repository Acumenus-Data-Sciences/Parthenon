<?php

namespace App\Services\Cohort;

use App\Concerns\SourceAware;
use App\Context\NoSourceContextException;
use App\Enums\CohortDomain;
use App\Models\App\ClinicalGrouping;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

class CohortDomainDetector
{
    use SourceAware;

    /**
     * Minimum fraction of concepts that must map to a single domain to be assigned.
     * Below this threshold, falls back to GENERAL.
     */
    private const MAJORITY_THRESHOLD = 0.40;

    /**
     * Detect the clinical domain for a cohort based on its expression JSON.
     *
     * Algorithm:
     * 1. Extract concept IDs from expression (primary criteria + inclusion rules)
     * 2. For each concept, walk up concept_ancestor to find ClinicalGrouping anchors
     * 3. Map ClinicalGrouping names to CohortDomain via clinicalGroupingMap()
     * 4. Majority vote — domain with most concept matches wins (>= 40% threshold)
     *
     * @param  array<string, mixed>  $expressionJson
     */
    public function detect(array $expressionJson): CohortDomain
    {
        $conceptIds = $this->extractConceptIds($expressionJson);

        if (empty($conceptIds)) {
            return CohortDomain::GENERAL;
        }

        // Get all ClinicalGrouping anchor concept IDs with their grouping names
        $groupings = ClinicalGrouping::whereNull('parent_grouping_id')->get(['name', 'anchor_concept_ids']);
        $anchorToGrouping = [];
        foreach ($groupings as $grouping) {
            foreach ($grouping->anchor_concept_ids as $anchorId) {
                $anchorToGrouping[$anchorId] = $grouping->name;
            }
        }

        $allAnchorIds = array_keys($anchorToGrouping);
        if (empty($allAnchorIds)) {
            return CohortDomain::GENERAL;
        }

        // Query concept_ancestor: for each input concept, find which anchor concepts are ancestors
        $placeholders = implode(',', array_fill(0, count($conceptIds), '?'));
        $anchorPlaceholders = implode(',', array_fill(0, count($allAnchorIds), '?'));

        $rows = $this->resolveVocab()->select(
            "SELECT DISTINCT ca.descendant_concept_id, ca.ancestor_concept_id
             FROM concept_ancestor ca
             WHERE ca.descendant_concept_id IN ({$placeholders})
               AND ca.ancestor_concept_id IN ({$anchorPlaceholders})",
            [...$conceptIds, ...$allAnchorIds]
        );

        // Count domain hits
        $domainCounts = [];
        $matchedConcepts = [];
        foreach ($rows as $row) {
            $groupingName = $anchorToGrouping[$row->ancestor_concept_id] ?? null;
            if ($groupingName === null) {
                continue;
            }

            $domain = CohortDomain::clinicalGroupingMap()[$groupingName] ?? CohortDomain::GENERAL;
            $key = $domain->value;

            // Count each concept only once per domain (a concept may match multiple anchors in same domain)
            $conceptDomainKey = $row->descendant_concept_id.':'.$key;
            if (! isset($matchedConcepts[$conceptDomainKey])) {
                $matchedConcepts[$conceptDomainKey] = true;
                $domainCounts[$key] = ($domainCounts[$key] ?? 0) + 1;
            }
        }

        if (empty($domainCounts)) {
            return CohortDomain::GENERAL;
        }

        // Majority vote
        arsort($domainCounts);
        $topDomain = array_key_first($domainCounts);
        $topCount = $domainCounts[$topDomain];
        $totalMatched = array_sum($domainCounts);

        if ($topCount / $totalMatched < self::MAJORITY_THRESHOLD) {
            return CohortDomain::GENERAL;
        }

        return CohortDomain::from($topDomain);
    }

    /**
     * Resolve the vocabulary database connection.
     *
     * Uses the SourceAware vocab() accessor when a SourceContext is active (HTTP/queue).
     * Falls back to the shared 'vocab' connection when running outside a source context
     * (e.g. observer on cohort save without an active source, or artisan commands).
     */
    private function resolveVocab(): Connection
    {
        try {
            return $this->vocab();
        } catch (NoSourceContextException) {
            return DB::connection('vocab');
        }
    }

    /**
     * Extract concept IDs from a CIRCE expression JSON.
     * Walks primary criteria concept sets and inclusion rule concept sets.
     *
     * @param  array<string, mixed>  $expression
     * @return list<int>
     */
    private function extractConceptIds(array $expression): array
    {
        $conceptIds = [];

        // Walk ConceptSets → items → concept → CONCEPT_ID
        $conceptSets = $expression['ConceptSets'] ?? [];
        foreach ($conceptSets as $cs) {
            $items = $cs['expression']['items'] ?? [];
            foreach ($items as $item) {
                $id = $item['concept']['CONCEPT_ID'] ?? null;
                if ($id !== null) {
                    $conceptIds[] = (int) $id;
                }
            }
        }

        return array_unique($conceptIds);
    }
}
