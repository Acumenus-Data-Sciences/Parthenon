<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity;

use App\Models\App\PatientFeatureVector;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

final class CohortCentroidBuilder
{
    /** @var array<string, int> */
    private const array PATHOGENICITY_WEIGHTS = [
        'Pathogenic' => 3,
        'Likely pathogenic' => 2,
        'Uncertain significance' => 1,
    ];

    /**
     * Build a virtual centroid feature vector from a set of cohort member person_ids.
     *
     * Demographics: median age_bucket, mode gender/race (most frequent).
     * Conditions/Drugs/Procedures: union of all member concepts.
     * Labs: mean of z-scores per measurement type.
     * Genomics: union of all variant_genes.
     *
     * @param  array<int>  $personIds
     * @return array<string, mixed> Virtual patient feature array (person_id = 0)
     */
    public function buildCentroid(array $personIds, Source $source): array
    {
        if ($personIds === []) {
            return [
                'person_id' => 0,
                'source_id' => $source->id,
                'dimensions_available' => [],
            ];
        }

        /** @var array<int, int> $ageCounts */
        $ageCounts = [];
        /** @var array<int, int> $genderCounts */
        $genderCounts = [];
        /** @var array<int, int> $raceCounts */
        $raceCounts = [];
        /** @var array<int, true> $conditionConcepts */
        $conditionConcepts = [];
        /** @var array<int, true> $recentConditionConcepts */
        $recentConditionConcepts = [];
        /** @var array<int, true> $drugConcepts */
        $drugConcepts = [];
        /** @var array<int, true> $recentDrugConcepts */
        $recentDrugConcepts = [];
        /** @var array<int, true> $procedureConcepts */
        $procedureConcepts = [];
        /** @var array<int, true> $recentProcedureConcepts */
        $recentProcedureConcepts = [];
        /** @var array<string, array{sum: float, count: int}> $labAccumulator */
        $labAccumulator = [];
        /** @var array<string, array{gene: string, pathogenicity: string, weight: int}> $variantGeneMap */
        $variantGeneMap = [];
        $featureVectorVersion = null;
        $vectorCount = 0;

        // For large cohorts, use a temp table to avoid PG's 65535 parameter limit
        if (count($personIds) > 50000) {
            $personIds = collect($personIds)->shuffle()->take(5000)->all();
        }

        $vectors = collect($personIds)
            ->chunk(5000)
            ->flatMap(fn ($chunk) => PatientFeatureVector::query()
                ->forSource($source->id)
                ->whereIn('person_id', $chunk->all())
                ->orderBy('id')
                ->get()
            );

        foreach ($vectors as $vector) {
            $vectorCount++;

            if (is_numeric($vector->age_bucket)) {
                $this->incrementCount($ageCounts, (int) $vector->age_bucket);
            }

            if (is_numeric($vector->gender_concept_id)) {
                $this->incrementCount($genderCounts, (int) $vector->gender_concept_id);
            }

            if (is_numeric($vector->race_concept_id)) {
                $this->incrementCount($raceCounts, (int) $vector->race_concept_id);
            }

            $this->accumulateIntSet($conditionConcepts, $vector->condition_concepts);
            $this->accumulateIntSet($recentConditionConcepts, $vector->recent_condition_concepts);
            $this->accumulateIntSet($drugConcepts, $vector->drug_concepts);
            $this->accumulateIntSet($recentDrugConcepts, $vector->recent_drug_concepts);
            $this->accumulateIntSet($procedureConcepts, $vector->procedure_concepts);
            $this->accumulateIntSet($recentProcedureConcepts, $vector->recent_procedure_concepts);
            $this->accumulateLabVector($labAccumulator, $vector->lab_vector);
            $this->accumulateVariantGenes($variantGeneMap, $vector->variant_genes);

            if (is_numeric($vector->version)) {
                $featureVectorVersion = max((int) ($featureVectorVersion ?? 0), (int) $vector->version);
            }
        }

        if ($vectorCount === 0) {
            return [
                'person_id' => 0,
                'source_id' => $source->id,
                'dimensions_available' => [],
            ];
        }

        $medianAge = $this->medianFromCounts($ageCounts);
        $genderMode = $this->modeFromCounts($genderCounts);
        $raceMode = $this->modeFromCounts($raceCounts);
        $conditionConceptList = $this->finalizeIntSet($conditionConcepts);
        $recentConditionConceptList = $this->finalizeIntSet($recentConditionConcepts);
        $drugConceptList = $this->finalizeIntSet($drugConcepts);
        $recentDrugConceptList = $this->finalizeIntSet($recentDrugConcepts);
        $procedureConceptList = $this->finalizeIntSet($procedureConcepts);
        $recentProcedureConceptList = $this->finalizeIntSet($recentProcedureConcepts);
        $labVector = $this->finalizeLabVector($labAccumulator);
        $variantGenes = $this->finalizeVariantGenes($variantGeneMap);

        // Determine which dimensions are available
        $dimensionsAvailable = [];
        if ($medianAge !== null || $genderMode !== null) {
            $dimensionsAvailable[] = 'demographics';
        }
        if (count($conditionConceptList) > 0) {
            $dimensionsAvailable[] = 'conditions';
        }
        if (count($drugConceptList) > 0) {
            $dimensionsAvailable[] = 'drugs';
        }
        if (count($procedureConceptList) > 0) {
            $dimensionsAvailable[] = 'procedures';
        }
        if (count($labVector) > 0) {
            $dimensionsAvailable[] = 'measurements';
        }
        if (count($variantGenes) > 0) {
            $dimensionsAvailable[] = 'genomics';
        }

        return [
            'person_id' => 0,
            'source_id' => $source->id,
            'age_bucket' => $medianAge,
            'gender_concept_id' => $genderMode,
            'race_concept_id' => $raceMode,
            'condition_concepts' => $conditionConceptList,
            'recent_condition_concepts' => $recentConditionConceptList,
            'condition_count' => count($conditionConceptList),
            'drug_concepts' => $drugConceptList,
            'recent_drug_concepts' => $recentDrugConceptList,
            'procedure_concepts' => $procedureConceptList,
            'recent_procedure_concepts' => $recentProcedureConceptList,
            'lab_vector' => $labVector,
            'lab_count' => count($labVector),
            'variant_genes' => $variantGenes,
            'variant_count' => count($variantGenes),
            'dimensions_available' => $dimensionsAvailable,
            'version' => $featureVectorVersion,
        ];
    }

    /**
     * Build a centroid embedding by averaging all member embeddings via pgvector.
     *
     * @param  array<int>  $personIds
     */
    public function buildCentroidEmbedding(array $personIds, Source $source): ?string
    {
        $result = DB::selectOne(
            'SELECT AVG(embedding)::text AS centroid FROM patient_feature_vectors WHERE source_id = ? AND person_id = ANY(?::bigint[]) AND embedding IS NOT NULL',
            [$source->id, '{'.implode(',', $personIds).'}']
        );

        return $result?->centroid;
    }

    /**
     * @param  array<int, int>  $counts
     */
    private function incrementCount(array &$counts, int $value): void
    {
        $counts[$value] = ($counts[$value] ?? 0) + 1;
    }

    /**
     * @param  array<int, true>  $set
     */
    private function accumulateIntSet(array &$set, mixed $values): void
    {
        if (! is_array($values)) {
            return;
        }

        foreach ($values as $value) {
            if (! is_numeric($value)) {
                continue;
            }

            $set[(int) $value] = true;
        }
    }

    /**
     * @param  array<string, array{sum: float, count: int}>  $accumulator
     *
     * @param-out array<string, array{sum: float, count: int}> $accumulator
     */
    private function accumulateLabVector(array &$accumulator, mixed $labVector): void
    {
        if (! is_array($labVector)) {
            return;
        }

        foreach ($labVector as $key => $value) {
            if (! is_numeric($value)) {
                continue;
            }

            $metricKey = (string) $key;

            if (! isset($accumulator[$metricKey])) {
                $accumulator[$metricKey] = ['sum' => 0.0, 'count' => 0];
            }
            $accumulator[$metricKey]['sum'] += (float) $value;
            $accumulator[$metricKey]['count']++;
        }
    }

    /**
     * @param  array<string, array{gene: string, pathogenicity: string, weight: int}>  $variantGeneMap
     */
    private function accumulateVariantGenes(array &$variantGeneMap, mixed $variantGenes): void
    {
        if (! is_array($variantGenes)) {
            return;
        }

        foreach ($variantGenes as $variant) {
            if (! is_array($variant)) {
                continue;
            }

            $gene = trim((string) ($variant['gene'] ?? ''));
            $pathogenicity = trim((string) ($variant['pathogenicity'] ?? ''));
            if ($gene === '') {
                continue;
            }

            $weight = self::PATHOGENICITY_WEIGHTS[$pathogenicity] ?? 1;
            $existing = $variantGeneMap[$gene]['weight'] ?? 0;

            if ($weight >= $existing) {
                $variantGeneMap[$gene] = [
                    'gene' => $gene,
                    'pathogenicity' => $pathogenicity !== '' ? $pathogenicity : 'Uncertain significance',
                    'weight' => $weight,
                ];
            }
        }
    }

    /**
     * @param  array<int, int>  $counts
     */
    private function medianFromCounts(array $counts): ?int
    {
        if ($counts === []) {
            return null;
        }

        ksort($counts);
        $targetIndex = (int) floor(array_sum($counts) / 2);
        $seen = 0;

        foreach ($counts as $value => $count) {
            $seen += $count;
            if ($seen > $targetIndex) {
                return (int) $value;
            }
        }

        return (int) array_key_last($counts);
    }

    /**
     * @param  array<int, int>  $counts
     */
    private function modeFromCounts(array $counts): ?int
    {
        if ($counts === []) {
            return null;
        }

        arsort($counts);

        return (int) array_key_first($counts);
    }

    /**
     * @param  array<int, true>  $set
     * @return array<int>
     */
    private function finalizeIntSet(array $set): array
    {
        $values = array_map('intval', array_keys($set));
        sort($values);

        return $values;
    }

    /**
     * @param  array<string, array{sum: float, count: int}>  $accumulator
     * @return array<string, float>
     */
    private function finalizeLabVector(array $accumulator): array
    {
        $result = [];
        foreach ($accumulator as $key => $data) {
            $result[$key] = round($data['sum'] / $data['count'], 4);
        }
        ksort($result);

        return $result;
    }

    /**
     * @param  array<string, array{gene: string, pathogenicity: string, weight: int}>  $variantGeneMap
     * @return array<int, array{gene: string, pathogenicity: string}>
     */
    private function finalizeVariantGenes(array $variantGeneMap): array
    {
        ksort($variantGeneMap);

        return array_values(array_map(
            static fn (array $variant): array => [
                'gene' => $variant['gene'],
                'pathogenicity' => $variant['pathogenicity'],
            ],
            $variantGeneMap
        ));
    }
}
