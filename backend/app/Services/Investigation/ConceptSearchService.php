<?php

namespace App\Services\Investigation;

use App\Concerns\SourceAware;
use Illuminate\Support\Facades\Cache;

class ConceptSearchService
{
    use SourceAware;

    /**
     * Search OMOP concepts by name with optional domain filter.
     *
     * @return list<array<string, mixed>>
     */
    public function search(string $term, ?string $domain = null, int $limit = 25): array
    {
        $query = $this->vocab()
            ->table('concept')
            ->select([
                'concept_id', 'concept_name', 'domain_id',
                'vocabulary_id', 'concept_class_id', 'standard_concept', 'concept_code',
            ])
            ->where('concept_name', 'ILIKE', '%'.$term.'%')
            ->where('invalid_reason', null);

        if ($domain !== null && $domain !== '' && $domain !== 'all') {
            $query->where('domain_id', $domain);
        }

        return $query
            ->orderByRaw('CASE WHEN concept_name ILIKE ? THEN 0 WHEN concept_name ILIKE ? THEN 1 ELSE 2 END', [$term, $term.'%'])
            ->orderBy('concept_name')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    /**
     * Get ancestor and descendant concepts for hierarchy display.
     *
     * @return array{ancestors: list<array<string, mixed>>, descendants: list<array<string, mixed>>}
     */
    public function hierarchy(int $conceptId): array
    {
        $ancestors = $this->vocab()
            ->table('concept_ancestor')
            ->join('concept', 'concept.concept_id', '=', 'concept_ancestor.ancestor_concept_id')
            ->where('concept_ancestor.descendant_concept_id', $conceptId)
            ->where('concept_ancestor.ancestor_concept_id', '!=', $conceptId)
            ->select([
                'concept.concept_id', 'concept.concept_name', 'concept.domain_id',
                'concept.vocabulary_id', 'concept.concept_class_id',
                'concept.standard_concept', 'concept.concept_code',
                'concept_ancestor.min_levels_of_separation as level',
            ])
            ->orderBy('concept_ancestor.min_levels_of_separation', 'desc')
            ->limit(50)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();

        $descendants = $this->vocab()
            ->table('concept_ancestor')
            ->join('concept', 'concept.concept_id', '=', 'concept_ancestor.descendant_concept_id')
            ->where('concept_ancestor.ancestor_concept_id', $conceptId)
            ->where('concept_ancestor.descendant_concept_id', '!=', $conceptId)
            ->select([
                'concept.concept_id', 'concept.concept_name', 'concept.domain_id',
                'concept.vocabulary_id', 'concept.concept_class_id',
                'concept.standard_concept', 'concept.concept_code',
                'concept_ancestor.min_levels_of_separation as level',
            ])
            ->orderBy('concept_ancestor.min_levels_of_separation')
            ->limit(100)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();

        return ['ancestors' => $ancestors, 'descendants' => $descendants];
    }

    /**
     * Count distinct patients with records for a concept.
     * Cached in Redis for 1 hour.
     *
     * @return array{concept_id: int, patient_count: int}
     */
    public function patientCount(int $conceptId): array
    {
        $count = Cache::remember("concept:count:{$conceptId}", 3600, function () use ($conceptId) {
            $concept = $this->vocab()
                ->table('concept')
                ->where('concept_id', $conceptId)
                ->select('domain_id')
                ->first();

            if (! $concept) {
                return 0;
            }

            $table = match ($concept->domain_id) {
                'Condition' => 'condition_occurrence',
                'Drug' => 'drug_exposure',
                'Measurement' => 'measurement',
                'Procedure' => 'procedure_occurrence',
                'Observation' => 'observation',
                'Device' => 'device_exposure',
                'Visit' => 'visit_occurrence',
                default => null,
            };

            if ($table === null) {
                return 0;
            }

            $conceptColumn = match ($concept->domain_id) {
                'Condition' => 'condition_concept_id',
                'Drug' => 'drug_concept_id',
                'Measurement' => 'measurement_concept_id',
                'Procedure' => 'procedure_concept_id',
                'Observation' => 'observation_concept_id',
                'Device' => 'device_concept_id',
                'Visit' => 'visit_concept_id',
                default => null,
            };

            if ($conceptColumn === null) {
                return 0;
            }

            return $this->cdm()
                ->table($table)
                ->where($conceptColumn, $conceptId)
                ->distinct('person_id')
                ->count('person_id');
        });

        return ['concept_id' => $conceptId, 'patient_count' => $count];
    }
}
