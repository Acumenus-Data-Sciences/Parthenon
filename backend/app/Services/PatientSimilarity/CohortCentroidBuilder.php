<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity;

use App\Models\App\PatientFeatureVector;
use App\Models\App\Source;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class CohortCentroidBuilder
{
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
        $vectors = PatientFeatureVector::query()
            ->forSource($source->id)
            ->whereIn('person_id', $personIds)
            ->get();

        if ($vectors->isEmpty()) {
            return [
                'person_id' => 0,
                'source_id' => $source->id,
                'dimensions_available' => [],
            ];
        }

        // Demographics: median age_bucket
        $ageBuckets = $vectors->pluck('age_bucket')->filter()->sort()->values();
        $medianAge = $ageBuckets->isNotEmpty()
            ? (int) $ageBuckets->get((int) floor($ageBuckets->count() / 2))
            : null;

        // Demographics: mode gender (most frequent)
        $genderMode = $vectors->pluck('gender_concept_id')
            ->filter()
            ->countBy()
            ->sortDesc()
            ->keys()
            ->first();

        // Demographics: mode race (most frequent)
        $raceMode = $vectors->pluck('race_concept_id')
            ->filter()
            ->countBy()
            ->sortDesc()
            ->keys()
            ->first();

        // Conditions: union of all member condition_concepts
        $conditionConcepts = $vectors->pluck('condition_concepts')
            ->filter()
            ->flatten()
            ->unique()
            ->values()
            ->all();
        $recentConditionConcepts = $vectors->pluck('recent_condition_concepts')
            ->filter()
            ->flatten()
            ->unique()
            ->values()
            ->all();

        // Drugs: union of all member drug_concepts
        $drugConcepts = $vectors->pluck('drug_concepts')
            ->filter()
            ->flatten()
            ->unique()
            ->values()
            ->all();
        $recentDrugConcepts = $vectors->pluck('recent_drug_concepts')
            ->filter()
            ->flatten()
            ->unique()
            ->values()
            ->all();

        // Procedures: union of all member procedure_concepts
        $procedureConcepts = $vectors->pluck('procedure_concepts')
            ->filter()
            ->flatten()
            ->unique()
            ->values()
            ->all();
        $recentProcedureConcepts = $vectors->pluck('recent_procedure_concepts')
            ->filter()
            ->flatten()
            ->unique()
            ->values()
            ->all();

        // Labs: mean of z-scores per measurement type
        $labVector = $this->averageLabVectors($vectors);

        // Genomics: union of all variant_genes
        $variantGenes = $vectors->pluck('variant_genes')
            ->filter()
            ->flatten()
            ->unique()
            ->values()
            ->all();
        $featureVectorVersion = $vectors->max('version');

        // Determine which dimensions are available
        $dimensionsAvailable = [];
        if ($medianAge !== null || $genderMode !== null) {
            $dimensionsAvailable[] = 'demographics';
        }
        if (count($conditionConcepts) > 0) {
            $dimensionsAvailable[] = 'conditions';
        }
        if (count($drugConcepts) > 0) {
            $dimensionsAvailable[] = 'drugs';
        }
        if (count($procedureConcepts) > 0) {
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
            'condition_concepts' => $conditionConcepts,
            'recent_condition_concepts' => $recentConditionConcepts,
            'condition_count' => count($conditionConcepts),
            'drug_concepts' => $drugConcepts,
            'recent_drug_concepts' => $recentDrugConcepts,
            'procedure_concepts' => $procedureConcepts,
            'recent_procedure_concepts' => $recentProcedureConcepts,
            'lab_vector' => $labVector,
            'lab_count' => count($labVector),
            'variant_genes' => $variantGenes,
            'variant_count' => count($variantGenes),
            'dimensions_available' => $dimensionsAvailable,
            'version' => is_numeric($featureVectorVersion) ? (int) $featureVectorVersion : null,
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
     * Average lab vectors across all members. Each lab_vector is a key=>z-score map.
     *
     * @param  Collection<int, PatientFeatureVector>  $vectors
     * @return array<string, float>
     */
    private function averageLabVectors($vectors): array
    {
        /** @var array<string, array{sum: float, count: int}> $accumulator */
        $accumulator = [];

        foreach ($vectors as $vector) {
            $labVector = $vector->lab_vector;
            if (! is_array($labVector)) {
                continue;
            }

            foreach ($labVector as $key => $value) {
                if (! is_numeric($value)) {
                    continue;
                }

                if (! isset($accumulator[$key])) {
                    $accumulator[$key] = ['sum' => 0.0, 'count' => 0];
                }
                $accumulator[$key]['sum'] += (float) $value;
                $accumulator[$key]['count']++;
            }
        }

        $result = [];
        foreach ($accumulator as $key => $data) {
            $result[$key] = round($data['sum'] / $data['count'], 4);
        }

        return $result;
    }
}
