<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity;

/**
 * Generates human-readable similarity explanations and shared feature summaries.
 *
 * Takes raw feature vectors and dimension scores, resolves concept IDs to names,
 * and produces structured explanations suitable for clinical researcher consumption.
 */
final class SimilarityExplainer
{
    private const int MAX_SHARED_ITEMS = 8;

    public function __construct(
        private readonly ConceptNameResolver $resolver,
    ) {}

    /**
     * Enrich a list of similar patients with shared features and explanations.
     *
     * @param  array<string, mixed>  $seedData  Seed patient feature vector (toArray)
     * @param  array<array<string, mixed>>  $scoredPatients  Scored patient results from search
     * @param  array<int, array<string, mixed>>  $candidateVectors  person_id => feature vector data
     * @return array<array<string, mixed>> Enriched scored patients
     */
    public function enrichResults(
        array $seedData,
        array $scoredPatients,
        array $candidateVectors,
    ): array {
        if ($scoredPatients === []) {
            return [];
        }

        // Collect all concept IDs we need to resolve in one batch
        $allConceptIds = [];
        $seedConditions = $seedData['condition_concepts'] ?? [];
        $seedDrugs = $seedData['drug_concepts'] ?? [];
        $seedProcedures = $seedData['procedure_concepts'] ?? [];

        $allConceptIds = array_merge($allConceptIds, $seedConditions, $seedDrugs, $seedProcedures);

        foreach ($scoredPatients as $patient) {
            $personId = $patient['person_id'] ?? null;
            if ($personId !== null && isset($candidateVectors[$personId])) {
                $vec = $candidateVectors[$personId];
                $allConceptIds = array_merge(
                    $allConceptIds,
                    $vec['condition_concepts'] ?? [],
                    $vec['drug_concepts'] ?? [],
                    $vec['procedure_concepts'] ?? [],
                );
            }
        }

        // Single batch resolution
        $names = $this->resolver->resolve(array_map('intval', $allConceptIds));

        // Enrich each patient
        return array_map(function (array $patient) use ($seedData, $candidateVectors, $names): array {
            $personId = $patient['person_id'] ?? null;
            if ($personId === null || ! isset($candidateVectors[$personId])) {
                return $patient;
            }

            $candidateData = $candidateVectors[$personId];
            $shared = $this->computeSharedFeatures($seedData, $candidateData, $names);
            $patient['shared_features'] = $shared;
            $patient['similarity_summary'] = $this->buildNarrative($patient, $shared, $seedData, $candidateData);

            return $patient;
        }, $scoredPatients);
    }

    /**
     * Enrich a compare result with resolved concept names.
     *
     * @param  array<string, mixed>  $compareResult  Raw compare result from controller
     * @return array<string, mixed> Enriched with resolved names
     */
    public function enrichComparison(array $compareResult): array
    {
        $sharedFeatures = $compareResult['shared_features'] ?? [];

        $allIds = array_merge(
            $sharedFeatures['conditions'] ?? [],
            $sharedFeatures['drugs'] ?? [],
            $sharedFeatures['procedures'] ?? [],
        );

        $names = $this->resolver->resolve(array_map('intval', $allIds));

        $compareResult['shared_features']['condition_names'] = $this->resolveList(
            $sharedFeatures['conditions'] ?? [],
            $names,
        );
        $compareResult['shared_features']['drug_names'] = $this->resolveList(
            $sharedFeatures['drugs'] ?? [],
            $names,
        );
        $compareResult['shared_features']['procedure_names'] = $this->resolveList(
            $sharedFeatures['procedures'] ?? [],
            $names,
        );

        return $compareResult;
    }

    /**
     * Compute shared features between seed and candidate with resolved names.
     *
     * @param  array<string, mixed>  $seedData
     * @param  array<string, mixed>  $candidateData
     * @param  array<int, string>  $names  Pre-resolved concept names
     * @return array<string, mixed>
     */
    private function computeSharedFeatures(array $seedData, array $candidateData, array $names): array
    {
        $sharedConditions = array_values(array_intersect(
            $seedData['condition_concepts'] ?? [],
            $candidateData['condition_concepts'] ?? [],
        ));
        $sharedDrugs = array_values(array_intersect(
            $seedData['drug_concepts'] ?? [],
            $candidateData['drug_concepts'] ?? [],
        ));
        $sharedProcedures = array_values(array_intersect(
            $seedData['procedure_concepts'] ?? [],
            $candidateData['procedure_concepts'] ?? [],
        ));

        return [
            'conditions' => [
                'shared_count' => count($sharedConditions),
                'seed_count' => count($seedData['condition_concepts'] ?? []),
                'candidate_count' => count($candidateData['condition_concepts'] ?? []),
                'top_shared' => $this->resolveList(
                    array_slice($sharedConditions, 0, self::MAX_SHARED_ITEMS),
                    $names,
                ),
            ],
            'drugs' => [
                'shared_count' => count($sharedDrugs),
                'seed_count' => count($seedData['drug_concepts'] ?? []),
                'candidate_count' => count($candidateData['drug_concepts'] ?? []),
                'top_shared' => $this->resolveList(
                    array_slice($sharedDrugs, 0, self::MAX_SHARED_ITEMS),
                    $names,
                ),
            ],
            'procedures' => [
                'shared_count' => count($sharedProcedures),
                'seed_count' => count($seedData['procedure_concepts'] ?? []),
                'candidate_count' => count($candidateData['procedure_concepts'] ?? []),
                'top_shared' => $this->resolveList(
                    array_slice($sharedProcedures, 0, self::MAX_SHARED_ITEMS),
                    $names,
                ),
            ],
        ];
    }

    /**
     * Build a natural-language similarity narrative.
     *
     * @param  array<string, mixed>  $patient  Scored patient with dimension_scores
     * @param  array<string, mixed>  $shared  Shared features
     * @param  array<string, mixed>  $seedData
     * @param  array<string, mixed>  $candidateData
     */
    private function buildNarrative(array $patient, array $shared, array $seedData, array $candidateData): string
    {
        $parts = [];
        $scores = $patient['dimension_scores'] ?? [];

        // Demographics
        $demoScore = $scores['demographics'] ?? null;
        if ($demoScore !== null && $demoScore >= 0.8) {
            $ageBucket = $patient['age_bucket'] ?? null;
            $ageRange = $ageBucket !== null ? ($ageBucket * 5).'-'.($ageBucket * 5 + 4) : '?';
            $gender = match ($patient['gender_concept_id'] ?? null) {
                8507 => 'male',
                8532 => 'female',
                default => null,
            };
            $demoParts = [];
            if ($gender !== null) {
                $demoParts[] = $gender;
            }
            $demoParts[] = "age {$ageRange}";
            $parts[] = 'Same demographic profile ('.implode(', ', $demoParts).')';
        }

        // Conditions
        $condScore = $scores['conditions'] ?? null;
        $condShared = $shared['conditions'] ?? [];
        if ($condScore !== null && ($condShared['shared_count'] ?? 0) > 0) {
            $topNames = array_column($condShared['top_shared'] ?? [], 'name');
            $count = $condShared['shared_count'];
            $preview = implode(', ', array_slice($topNames, 0, 3));
            $suffix = $count > 3 ? ' and '.($count - 3).' more' : '';
            $parts[] = "Shares {$count} conditions ({$preview}{$suffix})";
        }

        // Drugs
        $drugScore = $scores['drugs'] ?? null;
        $drugShared = $shared['drugs'] ?? [];
        if ($drugScore !== null && ($drugShared['shared_count'] ?? 0) > 0) {
            $topNames = array_column($drugShared['top_shared'] ?? [], 'name');
            $count = $drugShared['shared_count'];
            $preview = implode(', ', array_slice($topNames, 0, 3));
            $suffix = $count > 3 ? ' and '.($count - 3).' more' : '';
            $parts[] = "Shares {$count} medications ({$preview}{$suffix})";
        }

        // Procedures
        $procShared = $shared['procedures'] ?? [];
        if (($procShared['shared_count'] ?? 0) > 0) {
            $topNames = array_column($procShared['top_shared'] ?? [], 'name');
            $count = $procShared['shared_count'];
            $preview = implode(', ', array_slice($topNames, 0, 3));
            $suffix = $count > 3 ? ' and '.($count - 3).' more' : '';
            $parts[] = "Shares {$count} procedures ({$preview}{$suffix})";
        }

        // Measurements
        $measScore = $scores['measurements'] ?? null;
        if ($measScore !== null && $measScore >= 0.5) {
            $label = $measScore >= 0.8 ? 'Very similar' : ($measScore >= 0.6 ? 'Similar' : 'Moderately similar');
            $parts[] = "{$label} lab value profile";
        }

        if ($parts === []) {
            return 'Limited similarity data available.';
        }

        return implode('. ', $parts).'.';
    }

    /**
     * Resolve a list of concept IDs to [{concept_id, name}] objects.
     *
     * @param  array<int>  $conceptIds
     * @param  array<int, string>  $names  Pre-resolved name map
     * @return array<array{concept_id: int, name: string}>
     */
    private function resolveList(array $conceptIds, array $names): array
    {
        return array_map(fn (int $id): array => [
            'concept_id' => $id,
            'name' => $names[$id] ?? "Concept {$id}",
        ], $conceptIds);
    }
}
